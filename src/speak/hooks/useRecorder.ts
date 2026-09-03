// Push-to-talk recorder for /speak.
//
// The microphone is requested only inside `start()` — i.e. only after the
// learner pressed the button — and every stream track is stopped as soon as a
// recording ends, is cancelled, or the component unmounts. `start()` resolves
// when the recording is over (stop, auto-stop at `maxSeconds`, or cancel), so
// the caller can `await` it and submit the result in one place.

import { useCallback, useEffect, useRef, useState } from 'react'
import { canRecordAudio, recorderOptions } from '../../lib/transcribe'
import { MIN_RECORDING_SECONDS } from '../constants'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopping'
export type RecorderErrorCode = 'unsupported' | 'denied' | 'no_device' | 'busy' | 'empty' | 'failed' | 'cancelled'

export type RecordingOutcome = { ok: true; blob: Blob; seconds: number } | { ok: false; error: RecorderErrorCode }

export interface Recorder {
  status: RecorderStatus
  /** Seconds elapsed in the current recording (0 when idle). */
  seconds: number
  supported: boolean
  /** Ask for the mic and record until stop()/cancel()/maxSeconds. */
  start(): Promise<RecordingOutcome>
  stop(): void
  cancel(): void
}

/** Map a getUserMedia rejection to a recorder error. */
export function classifyMicError(err: unknown): RecorderErrorCode {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no_device'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  return 'failed'
}

export function useRecorder(opts: { maxSeconds: number }): Recorder {
  const { maxSeconds } = opts
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [supported] = useState(() => canRecordAudio())

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const resolveRef = useRef<((o: RecordingOutcome) => void) | null>(null)
  const stopRef = useRef<() => void>(() => {})

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finish = useCallback(
    (outcome: RecordingOutcome) => {
      clearTimer()
      releaseStream()
      recorderRef.current = null
      chunksRef.current = []
      setStatus('idle')
      setSeconds(0)
      const resolve = resolveRef.current
      resolveRef.current = null
      resolve?.(outcome)
    },
    [clearTimer, releaseStream],
  )

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return
    setStatus('stopping')
    clearTimer()
    try {
      rec.stop()
    } catch {
      finish({ ok: false, error: 'failed' })
    }
  }, [clearTimer, finish])
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      // Detach the handlers first so the stop event does not resolve as success.
      rec.ondataavailable = null
      rec.onstop = null
      rec.onerror = null
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
    }
    if (resolveRef.current) finish({ ok: false, error: 'cancelled' })
    else {
      clearTimer()
      releaseStream()
      recorderRef.current = null
    }
  }, [clearTimer, finish, releaseStream])

  const start = useCallback((): Promise<RecordingOutcome> => {
    if (!canRecordAudio()) return Promise.resolve({ ok: false, error: 'unsupported' })
    if (resolveRef.current) return Promise.resolve({ ok: false, error: 'busy' })

    return new Promise<RecordingOutcome>((resolve) => {
      resolveRef.current = resolve
      setStatus('requesting')
      navigator.mediaDevices.getUserMedia({ audio: true }).then(
        (stream) => {
          // Cancelled (or unmounted) while the permission prompt was open.
          if (resolveRef.current !== resolve) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          let rec: MediaRecorder
          try {
            rec = new MediaRecorder(stream, recorderOptions())
          } catch {
            finish({ ok: false, error: 'failed' })
            return
          }
          recorderRef.current = rec
          chunksRef.current = []
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
          }
          rec.onerror = () => finish({ ok: false, error: 'failed' })
          rec.onstop = () => {
            const elapsed = (Date.now() - startedAtRef.current) / 1000
            const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
            if (blob.size === 0 || elapsed < MIN_RECORDING_SECONDS) finish({ ok: false, error: 'empty' })
            else finish({ ok: true, blob, seconds: Math.round(elapsed * 10) / 10 })
          }
          try {
            rec.start()
          } catch {
            finish({ ok: false, error: 'failed' })
            return
          }
          startedAtRef.current = Date.now()
          setSeconds(0)
          setStatus('recording')
          timerRef.current = window.setInterval(() => {
            const elapsed = (Date.now() - startedAtRef.current) / 1000
            setSeconds(Math.min(elapsed, maxSeconds))
            if (elapsed >= maxSeconds) stopRef.current()
          }, 200)
        },
        (err) => {
          if (resolveRef.current !== resolve) return
          finish({ ok: false, error: classifyMicError(err) })
        },
      )
    })
  }, [finish, maxSeconds])

  // Never leave a microphone open in the background.
  useEffect(() => {
    const cancelNow = cancel
    return () => cancelNow()
  }, [cancel])

  return { status, seconds, supported, start, stop, cancel }
}
