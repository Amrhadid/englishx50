// EnglishX50 — speech-to-text Edge Function (Deno / Supabase).
//
// Receives recorded audio from the browser and returns the transcript using
// OpenAI's transcription API (whisper-1). Replaces the browser Web Speech API.
//
// Accepts the audio either as multipart/form-data (field `file`) or as a base64
// JSON body ({ audio, mime }), matching src/lib/transcribe.ts.
//
// Deploy:
//   supabase functions deploy transcribe --no-verify-jwt
// Secret required:
//   supabase secrets set OPENAI_API_KEY=sk-...
//
// Access: premium users (or the admin) only — see _shared/premium.ts. The JWT
// arrives automatically via supabase-js functions.invoke().

import { callerHasPremium } from '../_shared/premium.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''

// CORS must cover the preflight (OPTIONS) AND every real response — otherwise
// the browser blocks the call before any status is read, which surfaces in the
// app as "Failed to send a request to the Edge Function".
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extOf(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY not configured' }, 500)
  if (!(await callerHasPremium(req))) {
    return json({ error: 'Premium account required', code: 'not_premium' }, 401)
  }

  // --- Read the audio (multipart file or base64 JSON) ---
  let audio: Blob
  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const f = form.get('file')
      if (!(f instanceof Blob)) return json({ error: 'No audio file provided' }, 400)
      audio = f
    } else {
      const body = (await req.json()) as { audio?: string; mime?: string }
      if (!body.audio) return json({ error: 'No audio provided' }, 400)
      const bin = atob(body.audio)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      audio = new Blob([bytes], { type: body.mime || 'audio/webm' })
    }
  } catch (e) {
    return json({ error: 'Invalid request body', detail: String(e) }, 400)
  }

  if (audio.size === 0) return json({ error: 'Empty audio' }, 400)

  // --- Transcribe with OpenAI ---
  try {
    const form = new FormData()
    form.append('file', audio, `audio.${extOf(audio.type || 'audio/webm')}`)
    form.append('model', 'whisper-1')
    // Students answer in English. Without this Whisper auto-detects the
    // language and can transcribe (or translate) accented English as Arabic.
    form.append('language', 'en')

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    })

    if (!resp.ok) {
      if (resp.status === 429) return json({ error: 'Rate limit exceeded, try again later.' }, 429)
      const detail = await resp.text()
      return json({ error: `OpenAI error (${resp.status})`, detail }, 502)
    }

    const data = (await resp.json()) as { text?: string }
    return json({ text: data.text ?? '' })
  } catch (e) {
    return json({ error: 'Failed to transcribe audio', detail: String(e) }, 502)
  }
})
