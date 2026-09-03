// The conversation state machine for /speak. Owns the turns, the phase, the
// current scenario/level and the round trips through SpeakApi. The recorder
// and the player are injected so the machine is testable with fakes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Recorder, RecorderErrorCode } from './useRecorder'
import type { AudioPlayer } from './useAudioPlayer'
import type {
  ConversationTurn,
  HistoryMessage,
  LevelId,
  ScenarioId,
  SessionPhase,
  SpeakApi,
  SpeakError,
  SpeakErrorCode,
} from '../types'

interface Options {
  api: SpeakApi
  recorder: Recorder
  player: AudioPlayer
  scenario: ScenarioId
  level: LevelId
  /** Whether Emma's replies should be spoken aloud. */
  voice: boolean
}

export interface SpeakSession {
  phase: SessionPhase
  turns: ConversationTurn[]
  error: SpeakError | null
  /** Seconds the learner has spoken in this session. */
  speakingSeconds: number
  /** True when the current phase allows pressing the mic / typing. */
  canSpeak: boolean
  /** Elapsed seconds of the recording in progress. */
  recordingSeconds: number
  start(opts?: { autoplay?: boolean }): Promise<void>
  toggleMic(): Promise<void>
  cancelRecording(): void
  sendText(text: string): Promise<void>
  stopSpeaking(): void
  replay(): Promise<void>
  retry(): Promise<void>
  dismissError(): void
  /** Wire to the player's `onEnded`. */
  onPlaybackEnded(): void
}

type InternalPhase = Exclude<SessionPhase, 'requesting_mic' | 'recording'>

const RECORDER_ERRORS: Record<Exclude<RecorderErrorCode, 'cancelled' | 'busy'>, SpeakErrorCode> = {
  unsupported: 'mic_unsupported',
  denied: 'mic_denied',
  no_device: 'mic_missing',
  empty: 'empty_recording',
  failed: 'mic_failed',
}

let idCounter = 0
const nextId = () => `t${++idCounter}-${Date.now().toString(36)}`

export function useSpeakSession(opts: Options): SpeakSession {
  const { api, recorder, player, scenario, level, voice } = opts
  const [phase, setPhase] = useState<InternalPhase>('idle')
  const [turns, setTurns] = useState<ConversationTurn[]>([])
  const [error, setError] = useState<SpeakError | null>(null)
  const [speakingSeconds, setSpeakingSeconds] = useState(0)

  // Everything async checks `sessionRef` so a response from a previous
  // scenario (or from before unmount) can never land in the wrong session.
  const sessionRef = useRef(0)
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const turnsRef = useRef<ConversationTurn[]>([])
  /** The learner turn Emma has not answered yet (resent by `retry()`). */
  const pendingRef = useRef<ConversationTurn | null>(null)
  const optsRef = useRef({ scenario, level, voice })
  useEffect(() => {
    optsRef.current = { scenario, level, voice }
  })

  const commitTurns = useCallback((updater: (prev: ConversationTurn[]) => ConversationTurn[]) => {
    turnsRef.current = updater(turnsRef.current)
    setTurns(turnsRef.current)
  }, [])

  const alive = useCallback((session: number) => mountedRef.current && sessionRef.current === session, [])

  const failWith = useCallback((code: SpeakErrorCode, retryable: boolean) => {
    setError({ code, retryable })
    setPhase('ready')
  }, [])

  const speak = useCallback(
    async (session: number, audio: { base64: string; mime: string } | null, autoplay: boolean) => {
      if (!audio) {
        setPhase('ready')
        return
      }
      if (!autoplay || !optsRef.current.voice) {
        player.load(audio)
        setPhase('ready')
        return
      }
      setPhase('speaking')
      const started = await player.play(audio)
      if (!alive(session)) return
      if (!started) setPhase('ready')
      // Otherwise `onPlaybackEnded` moves us back to ready.
    },
    [alive, player],
  )

  const start = useCallback(
    async ({ autoplay = false }: { autoplay?: boolean } = {}) => {
      recorder.cancel()
      player.stop()
      const session = ++sessionRef.current
      busyRef.current = false
      pendingRef.current = null
      commitTurns(() => [])
      setSpeakingSeconds(0)
      setError(null)
      setPhase('starting')
      const { scenario: sc, level: lv, voice: vc } = optsRef.current
      const res = await api.start({ scenario: sc, level: lv, wantAudio: vc })
      if (!alive(session)) return
      if (!res.ok) {
        setError({ code: res.code, retryable: true })
        setPhase('idle')
        return
      }
      commitTurns(() => [{ id: nextId(), role: 'ai', text: res.reply }])
      await speak(session, res.audio, autoplay)
    },
    [alive, api, commitTurns, player, recorder, speak],
  )

  /** Ask Emma to answer `userTurn` (already on screen) and play her reply. */
  const respond = useCallback(
    async (session: number, userTurn: ConversationTurn, seconds: number) => {
      const history: HistoryMessage[] = turnsRef.current
        .filter((t) => t.id !== userTurn.id)
        .map((t) => ({ role: t.role === 'ai' ? 'assistant' : 'user', text: t.text }))
      pendingRef.current = userTurn
      setPhase('thinking')
      const { scenario: sc, level: lv, voice: vc } = optsRef.current
      const res = await api.respond({
        scenario: sc,
        level: lv,
        text: userTurn.text,
        history,
        speakingSeconds: seconds,
        wantAudio: vc,
      })
      if (!alive(session)) return
      if (!res.ok) {
        // The learner's words stay on screen; `retry()` resends them.
        failWith(res.code, true)
        return
      }
      pendingRef.current = null
      commitTurns((prev) => [
        ...prev.map((t) => (t.id === userTurn.id ? { ...t, feedback: res.feedback } : t)),
        { id: nextId(), role: 'ai', text: res.reply },
      ])
      await speak(session, res.audio, true)
    },
    [alive, api, commitTurns, failWith, speak],
  )

  const addUserTurn = useCallback(
    (text: string, seconds: number): ConversationTurn => {
      const userTurn: ConversationTurn = { id: nextId(), role: 'user', text }
      commitTurns((prev) => [...prev, userTurn])
      if (seconds > 0) setSpeakingSeconds((s) => Math.round((s + seconds) * 10) / 10)
      return userTurn
    },
    [commitTurns],
  )

  const submitRecording = useCallback(
    async (session: number, blob: Blob, seconds: number) => {
      setPhase('transcribing')
      const { scenario: sc, level: lv } = optsRef.current
      const res = await api.transcribe({ scenario: sc, level: lv, audio: blob, speakingSeconds: seconds })
      if (!alive(session)) return
      if (!res.ok) {
        failWith(res.code, false)
        return
      }
      await respond(session, addUserTurn(res.transcript, seconds), seconds)
    },
    [addUserTurn, alive, api, failWith, respond],
  )

  const toggleMic = useCallback(async () => {
    if (recorder.status === 'recording') {
      recorder.stop()
      return
    }
    if (recorder.status !== 'idle' || busyRef.current) return
    if (phase !== 'ready' && phase !== 'speaking') return
    const session = sessionRef.current
    busyRef.current = true
    player.stop()
    setError(null)
    setPhase('ready')
    try {
      const outcome = await recorder.start()
      if (!alive(session)) return
      if (!outcome.ok) {
        if (outcome.error !== 'cancelled' && outcome.error !== 'busy') {
          failWith(RECORDER_ERRORS[outcome.error], false)
        }
        return
      }
      await submitRecording(session, outcome.blob, outcome.seconds)
    } finally {
      busyRef.current = false
    }
  }, [alive, failWith, phase, player, recorder, submitRecording])

  const cancelRecording = useCallback(() => {
    recorder.cancel()
  }, [recorder])

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.replace(/\s+/g, ' ').trim()
      if (!text || busyRef.current || (phase !== 'ready' && phase !== 'speaking')) return
      const session = sessionRef.current
      busyRef.current = true
      player.stop()
      setError(null)
      try {
        await respond(session, addUserTurn(text, 0), 0)
      } finally {
        busyRef.current = false
      }
    },
    [addUserTurn, phase, player, respond],
  )

  const retry = useCallback(async () => {
    if (busyRef.current) return
    const session = sessionRef.current
    if (phase === 'idle') {
      await start({ autoplay: true })
      return
    }
    const pending = pendingRef.current
    setError(null)
    if (!pending) return
    busyRef.current = true
    try {
      await respond(session, pending, 0)
    } finally {
      busyRef.current = false
    }
  }, [phase, respond, start])

  const stopSpeaking = useCallback(() => {
    player.stop()
    setPhase((p) => (p === 'speaking' ? 'ready' : p))
  }, [player])

  const onPlaybackEnded = useCallback(() => {
    setPhase((p) => (p === 'speaking' ? 'ready' : p))
  }, [])

  const replay = useCallback(async () => {
    if (phase !== 'ready' && phase !== 'speaking') return
    if (recorder.status !== 'idle') return
    setPhase('speaking')
    const ok = await player.replay()
    if (!ok) setPhase('ready')
  }, [phase, player, recorder.status])

  const dismissError = useCallback(() => setError(null), [])

  useEffect(() => {
    const mounted = mountedRef
    const session = sessionRef
    mounted.current = true
    return () => {
      mounted.current = false
      session.current++
    }
  }, [])

  const effectivePhase: SessionPhase =
    recorder.status === 'requesting'
      ? 'requesting_mic'
      : recorder.status === 'recording' || recorder.status === 'stopping'
        ? 'recording'
        : phase

  const canSpeak = (phase === 'ready' || phase === 'speaking') && recorder.status === 'idle'

  return useMemo(
    () => ({
      phase: effectivePhase,
      turns,
      error,
      speakingSeconds,
      canSpeak,
      recordingSeconds: recorder.seconds,
      start,
      toggleMic,
      cancelRecording,
      sendText,
      stopSpeaking,
      replay,
      retry,
      dismissError,
      onPlaybackEnded,
    }),
    [
      effectivePhase,
      turns,
      error,
      speakingSeconds,
      canSpeak,
      recorder.seconds,
      start,
      toggleMic,
      cancelRecording,
      sendText,
      stopSpeaking,
      replay,
      retry,
      dismissError,
      onPlaybackEnded,
    ],
  )
}
