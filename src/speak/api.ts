// The real SpeakApi: talks to the `speak-turn` Edge Function with the
// signed-in user's access token (the existing Supabase session), never with a
// provider key. Every call is time-boxed and every failure is mapped to a
// SpeakErrorCode the UI knows how to explain.

import { supabase } from '../lib/supabase'
import { REQUEST_TIMEOUT_MS } from './constants'
import type { ApiFailure, SpeakApi, SpeakErrorCode } from './types'

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
  if (typeof code === 'string' && (SERVER_CODES as string[]).includes(code)) {
    return { ok: false, code: code as SpeakErrorCode, status: resp.status }
  }
  if (resp.status === 401) return { ok: false, code: 'unauthenticated', status: 401 }
  if (resp.status === 403) return { ok: false, code: 'not_premium', status: 403 }
  if (resp.status === 429) return { ok: false, code: 'rate_limited', status: 429 }
  return { ok: false, code: 'server', status: resp.status }
}

function audioOf(data: Record<string, unknown>) {
  const a = data.audio as { base64?: unknown; mime?: unknown } | null | undefined
  return a && typeof a.base64 === 'string' && a.base64 ? { base64: a.base64, mime: String(a.mime || 'audio/mpeg') } : null
}

export function createSupabaseSpeakApi(): SpeakApi {
  return {
    async start({ scenario, level, wantAudio }) {
      const res = await call({ action: 'start', scenario, level, wantAudio })
      if (!res.ok) return res
      const reply = typeof res.data.reply === 'string' ? res.data.reply : ''
      if (!reply) return { ok: false, code: 'server' }
      return { ok: true, reply, audio: audioOf(res.data) }
    },

    async transcribe({ scenario, level, audio, speakingSeconds }) {
      let base64: string
      try {
        base64 = await blobToBase64(audio)
      } catch {
        return { ok: false, code: 'mic_failed' }
      }
      const res = await call({
        action: 'transcribe',
        scenario,
        level,
        audio: base64,
        mime: audio.type || 'audio/webm',
        speakingSeconds,
      })
      if (!res.ok) return res
      const transcript = typeof res.data.transcript === 'string' ? res.data.transcript.trim() : ''
      if (!transcript) return { ok: false, code: 'empty_transcript' }
      return { ok: true, transcript }
    },

    async respond({ scenario, level, text, history, speakingSeconds, wantAudio }) {
      const res = await call({ action: 'respond', scenario, level, text, history, speakingSeconds, wantAudio })
      if (!res.ok) return res
      const reply = typeof res.data.reply === 'string' ? res.data.reply.trim() : ''
      const fb = res.data.feedback as Record<string, unknown> | undefined
      const positive = fb && typeof fb.positive === 'string' ? fb.positive : ''
      // The server already validated the model output; this guards the wire.
      if (!reply || !positive) return { ok: false, code: 'ai_malformed' }
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
      return {
        ok: true,
        reply,
        feedback: {
          positive,
          original: str(fb!.original),
          correction: str(fb!.correction),
          explanationArabic: str(fb!.explanationArabic),
        },
        audio: audioOf(res.data),
      }
    },
  }
}
