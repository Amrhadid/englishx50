// The real SpeakApi: talks to the `speak-turn` Edge Function with the
// signed-in user's access token (the existing Supabase session), never with a
// provider key. Every call is time-boxed and every failure is mapped to a
// SpeakErrorCode the UI knows how to explain.

import { supabase } from '../lib/supabase'
import { REQUEST_TIMEOUT_MS } from './constants'
import { isLevelId, isScenarioId } from './scenarios'
import type { ApiFailure, Conversation, SpeakApi, SpeakErrorCode, SpeakFeedback, StoredTurn } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const FUNCTION_SLUG = 'speak-turn'

const SERVER_CODES: SpeakErrorCode[] = [
  'unauthenticated',
  'not_premium',
  'entitlement_unavailable',
  'rate_limited',
  'invalid_request',
  'empty_transcript',
  'provider_unavailable',
  'storage_unavailable',
  'conversation_not_found',
  'conversation_completed',
  'daily_limit',
  'transcription_failed',
  'ai_failed',
  'ai_malformed',
  'ai_refused',
  'timeout',
]

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const s = String(reader.result ?? '')
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  try {
    return (await supabase.auth.getSession()).data.session?.access_token ?? null
  } catch {
    return null
  }
}

type CallOutcome = { ok: true; data: Record<string, unknown> } | ApiFailure

async function call(body: Record<string, unknown>): Promise<CallOutcome> {
  if (!SUPABASE_URL || !ANON_KEY) return { ok: false, code: 'provider_unavailable' }
  const token = await accessToken()
  if (!token) return { ok: false, code: 'unauthenticated' }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_SLUG}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON_KEY, authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch {
    clearTimeout(timer)
    return { ok: false, code: ctrl.signal.aborted ? 'timeout' : 'network' }
  }
  clearTimeout(timer)

  let data: Record<string, unknown> = {}
  try {
    data = (await resp.json()) as Record<string, unknown>
  } catch {
    /* non-JSON body: fall through to the status mapping */
  }
  if (resp.ok && data.ok !== false) return { ok: true, data }

  const code = data.code
  const next = typeof data.nextAvailableAt === 'string' ? data.nextAvailableAt : null
  if (typeof code === 'string' && (SERVER_CODES as string[]).includes(code)) {
    return { ok: false, code: code as SpeakErrorCode, status: resp.status, nextAvailableAt: next }
  }
  if (resp.status === 401) return { ok: false, code: 'unauthenticated', status: 401 }
  if (resp.status === 403) return { ok: false, code: 'not_premium', status: 403 }
  if (resp.status === 429) return { ok: false, code: 'rate_limited', status: 429 }
  return { ok: false, code: 'server', status: resp.status }
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function audioOf(data: Record<string, unknown>) {
  const a = data.audio as { base64?: unknown; mime?: unknown } | null | undefined
  return a && typeof a.base64 === 'string' && a.base64 ? { base64: a.base64, mime: String(a.mime || 'audio/mpeg') } : null
}

function feedbackOf(raw: unknown): SpeakFeedback | null {
  const fb = raw as Record<string, unknown> | null | undefined
  const positive = fb && typeof fb.positive === 'string' ? fb.positive : ''
  if (!positive) return null
  return {
    positive,
    original: str(fb!.original),
    correction: str(fb!.correction),
    explanationArabic: str(fb!.explanationArabic),
  }
}

function turnOf(raw: unknown): StoredTurn | null {
  const t = raw as Record<string, unknown> | null
  if (!t || typeof t.id !== 'string') return null
  return {
    id: t.id,
    transcript: typeof t.transcript === 'string' ? t.transcript : '',
    reply: typeof t.reply === 'string' ? t.reply : '',
    feedback: feedbackOf(t.feedback),
    speakingSeconds: Number(t.speakingSeconds) || 0,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : '',
  }
}

/** Parse a conversation from the wire; null when it is not one. */
export function conversationOf(raw: unknown): Conversation | null {
  const c = raw as Record<string, unknown> | null
  if (!c || typeof c.id !== 'string') return null
  const turns = Array.isArray(c.turns) ? c.turns.map(turnOf).filter((t): t is StoredTurn => t !== null) : undefined
  return {
    id: c.id,
    scenario: isScenarioId(c.scenario) ? c.scenario : 'daily',
    level: isLevelId(c.level) ? c.level : 'intermediate',
    status: c.status === 'completed' ? 'completed' : 'active',
    speakingSeconds: Number(c.speakingSeconds) || 0,
    goalSeconds: Number(c.goalSeconds) || 300,
    startedAt: typeof c.startedAt === 'string' ? c.startedAt : '',
    completedAt: typeof c.completedAt === 'string' ? c.completedAt : null,
    opener: typeof c.opener === 'string' ? c.opener : '',
    turns,
  }
}

export function createSupabaseSpeakApi(): SpeakApi {
  return {
    async session() {
      const res = await call({ action: 'session' })
      if (!res.ok) return res
      const history = Array.isArray(res.data.history)
        ? res.data.history.map(conversationOf).filter((c): c is Conversation => c !== null)
        : []
      return {
        ok: true,
        current: conversationOf(res.data.current),
        nextAvailableAt: typeof res.data.nextAvailableAt === 'string' ? res.data.nextAvailableAt : null,
        history,
      }
    },

    async conversation({ conversationId }) {
      const res = await call({ action: 'conversation', conversationId })
      if (!res.ok) return res
      const conversation = conversationOf(res.data.conversation)
      if (!conversation) return { ok: false, code: 'server' }
      return { ok: true, conversation }
    },

    async start({ scenario, level, wantAudio }) {
      const res = await call({ action: 'start', scenario, level, wantAudio })
      if (!res.ok) return res
      const conversation = conversationOf(res.data.conversation)
      const reply = typeof res.data.reply === 'string' ? res.data.reply : ''
      if (!conversation || !reply) return { ok: false, code: 'server' }
      return { ok: true, conversation, reply, audio: audioOf(res.data), resumed: res.data.resumed === true }
    },

    async transcribe({ audio, speakingSeconds }) {
      let base64: string
      try {
        base64 = await blobToBase64(audio)
      } catch {
        return { ok: false, code: 'mic_failed' }
      }
      const res = await call({
        action: 'transcribe',
        audio: base64,
        mime: audio.type || 'audio/webm',
        speakingSeconds,
      })
      if (!res.ok) return res
      const transcript = typeof res.data.transcript === 'string' ? res.data.transcript.trim() : ''
      if (!transcript) return { ok: false, code: 'empty_transcript' }
      return { ok: true, transcript }
    },

    async respond({ conversationId, level, text, speakingSeconds, wantAudio }) {
      const res = await call({ action: 'respond', conversationId, level, text, speakingSeconds, wantAudio })
      if (!res.ok) return res
      const reply = typeof res.data.reply === 'string' ? res.data.reply.trim() : ''
      const feedback = feedbackOf(res.data.feedback)
      // The server already validated the model output; this guards the wire.
      if (!reply || !feedback) return { ok: false, code: 'ai_malformed' }
      return {
        ok: true,
        reply,
        feedback,
        audio: audioOf(res.data),
        speakingSeconds: Number(res.data.speakingSeconds) || 0,
        goalSeconds: Number(res.data.goalSeconds) || 300,
        completed: res.data.completed === true,
        completedAt: typeof res.data.completedAt === 'string' ? res.data.completedAt : null,
        nextAvailableAt: typeof res.data.nextAvailableAt === 'string' ? res.data.nextAvailableAt : null,
      }
    },
  }
}
