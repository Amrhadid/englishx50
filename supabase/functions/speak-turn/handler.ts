// EnglishX50 /speak — the request handler behind the `speak-turn` Edge
// Function, written against web-standard Request/Response only so it runs in
// Deno on the edge and in Vitest under Node (see __tests__/handler.test.ts).
//
// One endpoint, three actions (POST JSON, `action` field):
//
//   start       → the scenario's opening question (+ its audio)
//   transcribe  → learner audio (base64) → transcript
//   respond     → transcript + history → Emma's reply, compact feedback, audio;
//                 the turn is persisted to x50_speaking_turns
//
// Every action first resolves the caller through the fail-closed entitlement
// check (access.ts), then the per-minute limiter, and only then touches a paid
// provider. Nothing about the caller beyond the user id reaches a provider.

import { bearerToken, resolveAccess, type AccessEnv, type FetchLike } from './access.ts'
import { buildSystemPrompt, openerFor } from './prompt.ts'
import { MinuteLimiter, countTurnsToday } from './ratelimit.ts'
import {
  LIMITS,
  parseSpeakRequest,
  validateModelOutput,
  type HistoryMessage,
  type SpeakRequest,
  type SpeakingTurnResponse,
} from './validate.ts'
import { ProviderError, type ModelMessage, type Providers, type SpeechAudio } from './providers.ts'

export interface SpeakEnv extends AccessEnv {
  /** Explicit dev switch: canned providers, no paid calls. Never inferred. */
  mockMode: boolean
}

export interface SpeakDeps {
  env: SpeakEnv
  fetch: FetchLike
  providers: Providers
  now?: () => number
  limiter?: MinuteLimiter
}

export type SpeakErrorCode =
  | 'unauthenticated'
  | 'not_premium'
  | 'entitlement_unavailable'
  | 'rate_limited'
  | 'invalid_request'
  | 'empty_transcript'
  | 'provider_unavailable'
  | 'transcription_failed'
  | 'ai_failed'
  | 'ai_malformed'
  | 'ai_refused'
  | 'timeout'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  })
}

function fail(code: SpeakErrorCode, status: number, error: string, extra: Record<string, string> = {}) {
  return json({ ok: false, code, error }, status, extra)
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Run a provider call under a hard timeout; AbortError becomes a timeout ProviderError. */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await run(ctrl.signal)
  } catch (e) {
    if (ctrl.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
      throw new ProviderError('timeout', 'Provider timed out')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function providerFailure(e: unknown, fallback: SpeakErrorCode): Response {
  if (e instanceof ProviderError) {
    switch (e.kind) {
      case 'rate_limited':
        return fail('rate_limited', 429, 'The AI service is busy, try again in a moment', { 'Retry-After': '20' })
      case 'timeout':
        return fail('timeout', 504, 'The AI service took too long')
      case 'refused':
        return fail('ai_refused', 502, 'The AI declined this turn')
      case 'malformed':
        return fail('ai_malformed', 502, 'The AI returned an unusable answer')
      default:
        return fail(fallback, 502, e.message)
    }
  }
  return fail(fallback, 502, 'Unexpected provider failure')
}

/** History → model messages: alternate roles, and the first message must be `user`. */
export function toModelMessages(history: HistoryMessage[], latestUserText: string): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const m of history) {
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.content = `${last.content}\n${m.text}`
    } else {
      out.push({ role, content: m.text })
    }
  }
  if (out.length === 0 || out[0].role !== 'user') {
    out.unshift({ role: 'user', content: '[The learner has joined and is ready to practise.]' })
  }
  const last = out[out.length - 1]
  if (last.role === 'user') last.content = `${last.content}\n${latestUserText}`
  else out.push({ role: 'user', content: latestUserText })
  return out
}

export function createSpeakHandler(deps: SpeakDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? Date.now
  const limiter = deps.limiter ?? new MinuteLimiter(LIMITS.perMinute)
  const { env, providers } = deps

  const synthesize = async (text: string): Promise<SpeechAudio | null> => {
    if (!providers.synthesizer) return null
    try {
      return await withTimeout(LIMITS.ttsTimeoutMs, (signal) => providers.synthesizer!.synthesize(text, { signal }))
    } catch {
      // Speech is an enhancement: the text reply still goes out.
      return null
    }
  }

  const persistTurn = async (
    userId: string,
    req: SpeakRequest,
    turn: SpeakingTurnResponse,
  ): Promise<string | null> => {
    if (!env.supabaseUrl || !env.serviceRoleKey) return null
    try {
      const resp = await deps.fetch(`${env.supabaseUrl}/rest/v1/x50_speaking_turns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.serviceRoleKey,
          authorization: `Bearer ${env.serviceRoleKey}`,
          prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          scenario: req.scenario,
          level: req.level,
          transcript: req.text,
          reply: turn.reply,
          feedback: turn.feedback,
          speaking_seconds: Math.round(req.speakingSeconds * 10) / 10,
        }),
      })
      if (!resp.ok) return null
      const rows = (await resp.json()) as { id?: string }[]
      return rows?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
    if (req.method !== 'POST') return fail('invalid_request', 405, 'Method not allowed')

    // --- 1. Who is calling, and are they entitled? (fail closed) ---
    const access = await resolveAccess(bearerToken(req), env, deps.fetch, now)
    if (!access.ok) {
      if (access.reason === 'unauthenticated') return fail('unauthenticated', 401, 'Sign in required')
      if (access.reason === 'not_premium') return fail('not_premium', 403, 'Premium subscription required')
      return fail('entitlement_unavailable', 503, 'Could not verify the subscription right now')
    }

    // --- 2. Request shape ---
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return fail('invalid_request', 400, 'Invalid JSON body')
    }
    const parsed = parseSpeakRequest(body)
    if (!parsed.ok) return fail('invalid_request', 400, parsed.error)
    const request = parsed.value

    // --- 3. Limits ---
    if (!limiter.allow(access.userId, now())) {
      return fail('rate_limited', 429, 'Too many requests, slow down a little', { 'Retry-After': '30' })
    }
    if (request.action === 'respond' && !access.isAdmin) {
      const today = await countTurnsToday(access.userId, env, deps.fetch, now())
      if (today != null && today >= LIMITS.perDay) {
        return fail('rate_limited', 429, 'Daily practice limit reached', { 'Retry-After': '3600' })
      }
    }

    // --- 4. Actions ---
    if (request.action === 'start') {
      const reply = openerFor(request.scenario)
      const audio = request.wantAudio ? await synthesize(reply) : null
      return json({
        ok: true,
        reply,
        audio,
        limits: {
          maxRecordingSeconds: LIMITS.maxRecordingSeconds,
          maxTranscriptChars: LIMITS.maxTranscriptChars,
        },
        mock: env.mockMode,
      })
    }

    if (request.action === 'transcribe') {
      if (!providers.transcriber) return fail('provider_unavailable', 503, 'Transcription is not configured')
      let bytes: Uint8Array
      try {
        bytes = decodeBase64(request.audio!)
      } catch {
        return fail('invalid_request', 400, 'Audio is not valid base64')
      }
      if (bytes.length === 0) return fail('empty_transcript', 422, 'Empty recording')
      if (bytes.length > LIMITS.maxAudioBytes) return fail('invalid_request', 413, 'Audio too large')
      const blob = new Blob([bytes], { type: request.mime || 'audio/webm' })
      let transcript: string
      try {
        transcript = await withTimeout(LIMITS.transcribeTimeoutMs, (signal) =>
          providers.transcriber!.transcribe(blob, { signal }),
        )
      } catch (e) {
        return providerFailure(e, 'transcription_failed')
      }
      transcript = transcript.replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxTranscriptChars)
      if (transcript.length < 2) return fail('empty_transcript', 422, 'No speech detected')
      return json({ ok: true, transcript })
    }

    // respond
    if (!providers.model) return fail('provider_unavailable', 503, 'The conversation model is not configured')
    const system = buildSystemPrompt(request.scenario, request.level)
    const messages = toModelMessages(request.history, request.text!)

    let turn: SpeakingTurnResponse | null = null
    let lastError: unknown = null
    // One retry covers the occasional non-tool answer; anything else is reported.
    for (let attempt = 0; attempt < 2 && !turn; attempt++) {
      try {
        const raw = await withTimeout(LIMITS.modelTimeoutMs, (signal) =>
          providers.model!.turn({ system, messages }, { signal }),
        )
        turn = validateModelOutput(raw)
        if (!turn) lastError = new ProviderError('malformed', 'Model output failed validation')
      } catch (e) {
        lastError = e
        if (!(e instanceof ProviderError && e.kind === 'malformed')) break
      }
    }
    if (!turn) return providerFailure(lastError, 'ai_failed')

    const audio = request.wantAudio ? await synthesize(turn.reply) : null
    const turnId = await persistTurn(access.userId, request, turn)
    return json({ ok: true, reply: turn.reply, feedback: turn.feedback, audio, turnId })
  }
}
