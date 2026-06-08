// Sends recorded audio to the `whisper` transcription Edge Function and returns
// the transcript. Replaces the browser Web Speech API as the voice-to-text
// source; the returned text is used exactly where the old transcript was.
//
// The function's exact request/response contract isn't known here, so this is
// tolerant: it tries a multipart upload (file field) first, falls back to a
// base64 JSON body, and reads the transcript from whichever field is present.

import { supabase } from './supabase'
import { reportFunctionError } from './functionError'

const FUNCTION = 'whisper'

export type TranscribeOutcome =
  | { ok: true; transcript: string }
  | { ok: false; detail: string }

/** Pull the transcript string out of whatever shape the function returns. */
function extractTranscript(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const key of ['text', 'transcript', 'result', 'data']) {
      const v = d[key]
      if (typeof v === 'string') return v
    }
  }
  return null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const s = String(reader.result ?? '')
      // strip the "data:<mime>;base64," prefix
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function extOf(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

export async function transcribeAudio(blob: Blob): Promise<TranscribeOutcome> {
  if (!supabase) return { ok: false, detail: 'Supabase not configured' }
  const mime = blob.type || 'audio/webm'
  let lastError: unknown = null

  // Attempt 1: multipart form-data (file field) — standard OpenAI passthrough.
  try {
    const form = new FormData()
    form.append('file', blob, `audio.${extOf(mime)}`)
    form.append('model', 'whisper-1')
    const { data, error } = await supabase.functions.invoke(FUNCTION, { body: form })
    const t = extractTranscript(data)
    if (!error && t != null) return { ok: true, transcript: t.trim() }
    lastError = error ?? lastError
  } catch (e) {
    lastError = e
  }

  // Attempt 2: base64 JSON.
  try {
    const audio = await blobToBase64(blob)
    const { data, error } = await supabase.functions.invoke(FUNCTION, {
      body: { audio, mime, model: 'whisper-1' },
    })
    const t = extractTranscript(data)
    if (!error && t != null) return { ok: true, transcript: t.trim() }
    lastError = error ?? lastError
  } catch (e) {
    lastError = e
  }

  const detail = await reportFunctionError('transcription', lastError)
  return { ok: false, detail }
}

/** True when this browser can record audio for transcription. */
export function canRecordAudio(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

/** Pick a MediaRecorder mime type this browser supports (or let it default). */
export function recorderOptions(): MediaRecorderOptions | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  const supported = (t: string) =>
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!window.MediaRecorder.isTypeSupported &&
    window.MediaRecorder.isTypeSupported(t)
  for (const t of types) if (supported(t)) return { mimeType: t }
  return undefined
}
