// Live, word-by-word speech-to-text via the OpenAI Realtime API, relayed
// through the `realtime-transcribe` Edge Function (so the key stays server-side).
//
// LiveSession also records the answer with MediaRecorder in parallel and, if the
// realtime path produces nothing (relay/realtime failure), falls back to the
// batch `transcribe` function — so the final transcript + grading never regress.

import { recorderOptions, transcribeAudio } from './transcribe'
import { withTimeout } from './async'
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

async function relayUrl(): Promise<string | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null
  const base = SUPABASE_URL.replace(/^http/, 'ws')
  // Browsers can't set WebSocket headers, so the user's access token rides
  // along as a query param — the relay validates premium server-side with it.
  let token = ''
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token ?? ''
  } catch {
    /* no session — the relay will reject and the batch fallback covers it */
  }
  return `${base}/functions/v1/realtime-transcribe?apikey=${ANON_KEY}${
    token ? `&token=${encodeURIComponent(token)}` : ''
  }`
}

function floatToPCM16(input: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(input.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buf
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/** Streams mic audio to OpenAI Realtime and emits a growing transcript. */
class RealtimeTranscriber {
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private committed = ''
  private partial = ''
  failed = false
  private liveNotified = false
  private stream: MediaStream
  private onTranscript: (text: string) => void
  private onLive: () => void

  constructor(stream: MediaStream, onTranscript: (text: string) => void, onLive: () => void) {
    this.stream = stream
    this.onTranscript = onTranscript
    this.onLive = onLive
  }

  get text(): string {
    return `${this.committed} ${this.partial}`.replace(/\s+/g, ' ').trim()
  }

  async start(): Promise<void> {
    const url = await relayUrl()
    if (!url) {
      this.failed = true
      return
    }
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onmessage = (e) => this.handle(typeof e.data === 'string' ? e.data : '')
    ws.onerror = () => {
      this.failed = true
    }

    await new Promise<void>((resolve) => {
      const done = () => resolve()
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'transcription_session.update',
            session: {
              input_audio_format: 'pcm16',
              input_audio_transcription: { model: 'gpt-4o-transcribe', language: 'en' },
              turn_detection: { type: 'server_vad', silence_duration_ms: 500 },
            },
          }),
        )
        this.startAudio()
        done()
      }
      // Don't hang forever if the relay never opens.
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          this.failed = true
          done()
        }
      }, 4000)
    })
  }

  private startAudio(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx({ sampleRate: 24000 })
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (ev) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      const pcm = floatToPCM16(ev.inputBuffer.getChannelData(0))
      this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: bufToBase64(pcm) }))
    }
    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination)
  }

  private handle(data: string): void {
    if (!data) return
    let ev: { type?: string; delta?: string; transcript?: string; error?: { message?: string } }
    try {
      ev = JSON.parse(data)
    } catch {
      return
    }
    const type = ev.type ?? ''
    if (type.endsWith('input_audio_transcription.delta')) {
      if (!this.liveNotified) {
        this.liveNotified = true
        this.onLive()
      }
      this.partial += ev.delta ?? ''
      this.onTranscript(this.text)
    } else if (type.endsWith('input_audio_transcription.completed')) {
      if (!this.liveNotified) {
        this.liveNotified = true
        this.onLive()
      }
      this.committed = `${this.committed} ${ev.transcript ?? this.partial}`.trim()
      this.partial = ''
      this.onTranscript(this.text)
    } else if (type === 'error') {
      this.failed = true
    }
  }

  /** Stop streaming, flush, and return the final transcript. */
  async stop(): Promise<string> {
    try {
      this.processor?.disconnect()
      this.source?.disconnect()
    } catch {
      /* ignore */
    }
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
        await new Promise((r) => setTimeout(r, 900))
      }
    } catch {
      /* ignore */
    }
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    try {
      await this.ctx?.close()
    } catch {
      /* ignore */
    }
    return this.text
  }

  cancel(): void {
    try {
      this.processor?.disconnect()
      this.source?.disconnect()
      this.ws?.close()
      this.ctx?.close()
    } catch {
      /* ignore */
    }
  }
}

/**
 * One recording session: live realtime transcription with a batch fallback.
 * - `onPartial` fires with the growing transcript while the user speaks.
 * - `stop()` returns the best final transcript (realtime, or batch Whisper).
 */
export class LiveSession {
  private rt: RealtimeTranscriber | null = null
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private live = ''
  private onPartial: (text: string) => void
  private onLive: () => void

  constructor(opts: { onPartial: (text: string) => void; onLive?: () => void }) {
    this.onPartial = opts.onPartial
    this.onLive = opts.onLive ?? (() => {})
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Parallel recorder for the batch fallback.
    this.chunks = []
    try {
      this.recorder = new MediaRecorder(this.stream, recorderOptions())
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data)
      }
      this.recorder.start()
    } catch {
      this.recorder = null
    }

    // Live realtime transcription — connect in the background so recording
    // starts instantly; the batch fallback covers it if realtime never connects.
    this.rt = new RealtimeTranscriber(
      this.stream,
      (t) => {
        this.live = t
        this.onPartial(t)
      },
      () => this.onLive(),
    )
    this.rt.start().catch(() => {
      if (this.rt) this.rt.failed = true
    })
  }

  async stop(): Promise<{ transcript: string; audio: Blob; error?: string }> {
    const blobPromise = new Promise<Blob>((resolve) => {
      const rec = this.recorder
      if (!rec || rec.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }))
        return
      }
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }))
      try {
        rec.stop()
      } catch {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }))
      }
    })

    // Every step is time-boxed: a hung socket/recorder/function call must
    // degrade to the best transcript we have, never freeze the UI forever.
    const rtText = await withTimeout(
      this.rt?.stop() ?? Promise.resolve(''),
      10_000,
      this.live,
    )
    const rtFailed = this.rt?.failed ?? true

    this.stream?.getTracks().forEach((t) => t.stop())
    const audio = await withTimeout(blobPromise, 10_000, new Blob(this.chunks, { type: 'audio/webm' }))

    // Prefer the realtime transcript; fall back to batch Whisper otherwise.
    // `error` carries the batch failure reason so the UI can show what
    // actually went wrong instead of a generic "no clear voice".
    let transcript = !rtFailed && rtText.trim().length >= 2 ? rtText.trim() : ''
    let error: string | undefined
    if (!transcript) {
      if (audio.size > 0) {
        const res = await withTimeout(
          transcribeAudio(audio),
          90_000,
          { ok: false as const, detail: 'timeout' },
        )
        if (res.ok && res.transcript.trim().length >= 2) {
          transcript = res.transcript.trim()
        } else {
          transcript = rtText.trim()
          if (!res.ok) error = res.detail
        }
      } else {
        transcript = rtText.trim()
      }
    }
    return { transcript, audio, error }
  }

  cancel(): void {
    try {
      this.recorder?.stop()
    } catch {
      /* ignore */
    }
    this.rt?.cancel()
    this.stream?.getTracks().forEach((t) => t.stop())
  }
}

/** True when this browser can record audio (live or fallback). */
export function canLiveTranscribe(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined'
  )
}
