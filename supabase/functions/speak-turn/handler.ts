// EnglishX50 /speak — the request handler behind the `speak-turn` Edge
// Function, written against web-standard Request/Response only so it runs in
// Deno on the edge and in Vitest under Node (see __tests__/handler.test.ts).
//
// One endpoint, six actions (POST JSON, `action` field):
//
//   session       → the learner's current conversation (active, or completed
//                   inside the 24 h window), when the next one may start, and
//                   the list of past conversations
//   conversation  → one past conversation with its turns (for review/download)
//   start         → create today's conversation (or resume the active one) and
//                   return the scenario's opening question (+ audio)
//   transcribe    → learner audio (base64) → transcript
//   respond       → transcript → Emma's reply, compact feedback, audio; the turn
//                   is persisted, speaking time accumulates, and the
//                   conversation completes once it reaches the goal
//   end           → the learner ends the conversation early, before the
//                   speaking goal is reached; marks it completed as-is so the
//                   review/PDF and the 24 h window behave exactly as a normal
//                   completion would
//
// Every action first resolves the caller through the fail-closed entitlement
// check (access.ts), then the per-minute limiter, and only then touches a paid
// provider. Nothing about the caller beyond the user id reaches a provider.

import { bearerToken, resolveAccess, type AccessEnv, type FetchLike } from './access.ts'
import { buildSystemPrompt, openerFor, isScenarioId, isLevelId, type LevelId, type ScenarioId } from './prompt.ts'
import { MinuteLimiter, countTurnsToday } from './ratelimit.ts'
import {
  CONVERSATION_WINDOW_MS,
  GOAL_SECONDS,
  HISTORY_TURN_PAIRS,
  LIMITS,
  parseSpeakRequest,
  validateModelOutput,
  type SpeakRequest,
  type SpeakingTurnResponse,
} from './validate.ts'
import { ProviderError, type ModelMessage, type Providers, type SpeechAudio } from './providers.ts'
import { estimateSpokenSeconds, type ConversationRow, type Store, type TurnRow } from './store.ts'

export interface SpeakEnv extends AccessEnv {
  /** Explicit dev switch: canned providers, no paid calls. Never inferred. */
  mockMode: boolean
}

export interface SpeakDeps {
  env: SpeakEnv
  fetch: FetchLike
  providers: Providers
  store: Store
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
  | 'storage_unavailable'
  | 'conversation_not_found'
  | 'conversation_completed'
  | 'daily_limit'
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

function fail(code: SpeakErrorCode, status: number, error: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, error, ...extra }, status)
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
        return json({ ok: false, code: 'rate_limited', error: 'The AI service is busy, try again in a moment' }, 429, {
          'Retry-After': '20',
        })
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

/** Stored turns → model messages: opener first, then each (learner, Emma) pair, then the new text. */
export function toModelMessages(opener: string, turns: TurnRow[], latestUserText: string): ModelMessage[] {
  const recent = turns.slice(-HISTORY_TURN_PAIRS)
  const out: ModelMessage[] = [
    { role: 'user', content: '[The learner has joined and is ready to practise.]' },
    { role: 'assistant', content: opener },
  ]
  for (const t of recent) {
    if (t.transcript) out.push({ role: 'user', content: t.transcript })
    if (t.reply) out.push({ role: 'assistant', content: t.reply })
  }
  const last = out[out.length - 1]
  if (last.role === 'user') last.content = `${last.content}\n${latestUserText}`
  else out.push({ role: 'user', content: latestUserText })
  return out
}

/** Wire shape of a conversation, with its turns when requested. */
export function serialiseConversation(row: ConversationRow, turns: TurnRow[] | null) {
  const scenario: ScenarioId = isScenarioId(row.scenario) ? row.scenario : 'daily'
  const level: LevelId = isLevelId(row.level) ? row.level : 'intermediate'
  return {
    id: row.id,
    scenario,
    level,
    status: row.status,
    speakingSeconds: row.speaking_seconds,
    goalSeconds: row.goal_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    opener: openerFor(scenario),
    turns: turns
      ? turns.map((t) => ({
          id: t.id,
          transcript: t.transcript,
          reply: t.reply,
          feedback: t.feedback,
          speakingSeconds: t.speaking_seconds,
          createdAt: t.created_at,
        }))
      : undefined,
  }
}

/** When the learner may start a new conversation: null = now. */
export function nextAvailableAt(latest: ConversationRow | null, now: number): string | null {
  if (!latest || latest.status !== 'completed' || !latest.completed_at) return null
  const at = new Date(latest.completed_at).getTime() + CONVERSATION_WINDOW_MS
  return at > now ? new Date(at).toISOString() : null
}

export function createSpeakHandler(deps: SpeakDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? Date.now
  const limiter = deps.limiter ?? new MinuteLimiter(LIMITS.perMinute)
  const { env, providers, store } = deps

  const synthesize = async (text: string): Promise<SpeechAudio | null> => {
    if (!providers.synthesizer) return null
    try {
      return await withTimeout(LIMITS.ttsTimeoutMs, (signal) => providers.synthesizer!.synthesize(text, { signal }))
    } catch {
      // Speech is an enhancement: the text reply still goes out.
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
    const request: SpeakRequest = parsed.value

    // --- 3. Limits ---
    if (!limiter.allow(access.userId, now())) {
      return json({ ok: false, code: 'rate_limited', error: 'Too many requests, slow down a little' }, 429, {
        'Retry-After': '30',
      })
    }

    // --- 4. Actions ---
    if (request.action === 'session') {
      const latest = await store.latestConversation(access.userId)
      if (latest === undefined) return fail('storage_unavailable', 503, 'Conversation storage is unavailable')
      const history = (await store.listConversations(access.userId, 30)) ?? []
      const next = access.isAdmin ? null : nextAvailableAt(latest, now())
      // The current conversation: the active one, or a completed one still inside its window.
      const current = latest && (latest.status === 'active' || next) ? latest : null
      const turns = current ? await store.turns(current.id) : null
      return json({
        ok: true,
        current: current ? serialiseConversation(current, turns ?? []) : null,
        nextAvailableAt: next,
        history: history.filter((c) => c.status === 'completed').map((c) => serialiseConversation(c, null)),
      })
    }

    if (request.action === 'conversation') {
      const row = await store.conversation(request.conversationId!, access.userId)
      if (row === undefined) return fail('storage_unavailable', 503, 'Conversation storage is unavailable')
      if (!row) return fail('conversation_not_found', 404, 'No such conversation')
      const turns = (await store.turns(row.id)) ?? []
      return json({ ok: true, conversation: serialiseConversation(row, turns) })
    }

    if (request.action === 'end') {
      const row = await store.conversation(request.conversationId!, access.userId)
      if (row === undefined) return fail('storage_unavailable', 503, 'Conversation storage is unavailable')
      if (!row) return fail('conversation_not_found', 404, 'No such conversation')
      // Already completed (e.g. a double tap, or it just reached its goal):
      // hand back the current row rather than erroring — ending is idempotent.
      const updated =
        row.status === 'active'
          ? await store.updateConversation(row.id, { status: 'completed', completed_at: new Date(now()).toISOString() })
          : row
      if (!updated) return fail('storage_unavailable', 503, 'Could not end the conversation')
      const turns = (await store.turns(updated.id)) ?? []
      return json({
        ok: true,
        conversation: serialiseConversation(updated, turns),
        nextAvailableAt: access.isAdmin ? null : nextAvailableAt(updated, now()),
      })
    }

    if (request.action === 'start') {
      const latest = await store.latestConversation(access.userId)
      if (latest === undefined) return fail('storage_unavailable', 503, 'Conversation storage is unavailable')
      let conversation: ConversationRow
      let turns: TurnRow[] = []
      if (latest?.status === 'active') {
        // Resume rather than open a second one.
        conversation = latest
        turns = (await store.turns(latest.id)) ?? []
      } else {
        const next = access.isAdmin ? null : nextAvailableAt(latest, now())
        if (next) return fail('daily_limit', 409, 'One conversation per 24 hours', { nextAvailableAt: next })
        const created = await store.createConversation({
          userId: access.userId,
          scenario: request.scenario,
          level: request.level,
          goalSeconds: GOAL_SECONDS,
        })
        if (!created) return fail('storage_unavailable', 503, 'Could not create the conversation')
        conversation = created
      }
      const reply = openerFor(isScenarioId(conversation.scenario) ? conversation.scenario : 'daily')
      const audio = request.wantAudio ? await synthesize(reply) : null
      return json({
        ok: true,
        conversation: serialiseConversation(conversation, turns),
        reply,
        audio,
        resumed: latest?.status === 'active',
        limits: { maxRecordingSeconds: LIMITS.maxRecordingSeconds, maxTranscriptChars: LIMITS.maxTranscriptChars },
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
    const conversation = await store.conversation(request.conversationId!, access.userId)
    if (conversation === undefined) return fail('storage_unavailable', 503, 'Conversation storage is unavailable')
    if (!conversation) return fail('conversation_not_found', 404, 'No such conversation')
    if (conversation.status !== 'active') return fail('conversation_completed', 409, 'This conversation is complete')

    if (!access.isAdmin) {
      const today = await countTurnsToday(access.userId, env, deps.fetch, now())
      if (today != null && today >= LIMITS.perDay) {
        return json({ ok: false, code: 'rate_limited', error: 'Daily practice limit reached' }, 429, {
          'Retry-After': '3600',
        })
      }
    }

    const scenario: ScenarioId = isScenarioId(conversation.scenario) ? conversation.scenario : 'daily'
    // The level may be changed mid-conversation from the settings sheet.
    const level: LevelId = request.level
    const stored = (await store.turns(conversation.id)) ?? []
    const system = buildSystemPrompt(scenario, level)
    const messages = toModelMessages(openerFor(scenario), stored, request.text!)

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

    // Typed answers carry no recording time; credit them with an estimate so a
    // keyboard-only learner can still complete the goal.
    const seconds =
      request.speakingSeconds > 0
        ? request.speakingSeconds
        : estimateSpokenSeconds(request.text!, LIMITS.maxRecordingSeconds)

    const audio = request.wantAudio ? await synthesize(turn.reply) : null
    const turnId = await store.insertTurn({
      userId: access.userId,
      conversationId: conversation.id,
      scenario,
      level,
      transcript: request.text!,
      reply: turn.reply,
      feedback: turn.feedback,
      speakingSeconds: seconds,
    })
    const total = Math.round((conversation.speaking_seconds + seconds) * 10) / 10
    const completed = total >= conversation.goal_seconds
    const updated = await store.updateConversation(conversation.id, {
      speaking_seconds: total,
      ...(completed ? { status: 'completed', completed_at: new Date(now()).toISOString() } : {}),
    })
    return json({
      ok: true,
      reply: turn.reply,
      feedback: turn.feedback,
      audio,
      turnId,
      speakingSeconds: updated?.speaking_seconds ?? total,
      goalSeconds: conversation.goal_seconds,
      completed,
      completedAt: completed ? (updated?.completed_at ?? new Date(now()).toISOString()) : null,
      nextAvailableAt: completed && !access.isAdmin ? new Date(now() + CONVERSATION_WINDOW_MS).toISOString() : null,
    })
  }
}
