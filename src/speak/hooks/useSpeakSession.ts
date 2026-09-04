// The conversation state machine for /speak. Owns the current conversation
// (server-side object: one per learner per 24 h, complete at the 5-minute
// speaking goal), the visible turns, the phase, and the round trips through
// SpeakApi. The recorder and the player are injected so the machine is
// testable with fakes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Recorder, RecorderErrorCode } from './useRecorder'
import type { AudioPlayer } from './useAudioPlayer'
import type {
  Conversation,
  ConversationTurn,
  LevelId,
  ScenarioId,
  SessionPhase,
  SpeakApi,
  SpeakError,
  SpeakErrorCode,
  StoredTurn,
} from '../types'

interface Options {
  api: SpeakApi
  recorder: Recorder
  player: AudioPlayer
  level: LevelId
  /** Whether Emma's replies should be spoken aloud. */
  voice: boolean
}

export interface SpeakSession {
  phase: SessionPhase
  turns: ConversationTurn[]
  error: SpeakError | null
  /** The active or just-completed conversation (null before one starts). */
  conversation: Conversation | null
  /** Learner speaking time in the current conversation (seconds). */
  speakingSeconds: number
  goalSeconds: number
  /** When the next conversation may start (ISO), while locked. */
  nextAvailableAt: string | null
  /** Completed conversations, newest first. */
  history: Conversation[]
  /** True when the page picked up an unfinished conversation. */
  resumed: boolean
  /** True when the current phase allows pressing the mic / typing. */
  canSpeak: boolean
  /** Elapsed seconds of the recording in progress. */
  recordingSeconds: number
  /** Fetch the learner's current conversation (called on mount). */
  load(): Promise<void>
  /** Start today's conversation with `scenario` (or resume the active one). */
  start(scenario: ScenarioId): Promise<void>
  toggleMic(): Promise<void>
  cancelRecording(): void
  sendText(text: string): Promise<void>
  /** End the active conversation now, before the speaking goal is reached. */
  endConversation(): Promise<void>
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

/** Stored conversation → visible turns (opener first, then each pair). */
export function turnsOf(conversation: Conversation): ConversationTurn[] {
  const out: ConversationTurn[] = [{ id: `opener-${conversation.id}`, role: 'ai', text: conversation.opener }]
  for (const t of conversation.turns ?? []) {
    if (t.transcript) out.push({ id: `${t.id}-u`, role: 'user', text: t.transcript, feedback: t.feedback ?? undefined })
    if (t.reply) out.push({ id: `${t.id}-a`, role: 'ai', text: t.reply })
  }
  return out
}

export function useSpeakSession(opts: Options): SpeakSession {
  const { api, recorder, player, level, voice } = opts
  const [phase, setPhase] = useState<InternalPhase>('loading')
  const [turns, setTurns] = useState<ConversationTurn[]>([])
  const [error, setError] = useState<SpeakError | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [nextAvailableAt, setNextAvailableAt] = useState<string | null>(null)
  const [history, setHistory] = useState<Conversation[]>([])
  const [resumed, setResumed] = useState(false)

  // Everything async checks `sessionRef` so a response from a previous
  // conversation (or from before unmount) can never land in the wrong one.
  const sessionRef = useRef(0)
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const turnsRef = useRef<ConversationTurn[]>([])
  const conversationRef = useRef<Conversation | null>(null)
  /** The learner turn Emma has not answered yet (resent by `retry()`). */
  const pendingRef = useRef<ConversationTurn | null>(null)
  /** The pending turn's recording path, if any, so a retry keeps it attached. */
  const pendingAudioPathRef = useRef<string | null>(null)
  const lastScenarioRef = useRef<ScenarioId | null>(null)
  /** Set when the last reply completed the conversation: review after playback. */
  const completeAfterSpeechRef = useRef(false)
  const optsRef = useRef({ level, voice })
  useEffect(() => {
    optsRef.current = { level, voice }
  })

  const commitTurns = useCallback((updater: (prev: ConversationTurn[]) => ConversationTurn[]) => {
    turnsRef.current = updater(turnsRef.current)
    setTurns(turnsRef.current)
  }, [])

  const commitConversation = useCallback((c: Conversation | null) => {
    conversationRef.current = c
    setConversation(c)
  }, [])

  const alive = useCallback((session: number) => mountedRef.current && sessionRef.current === session, [])

  const failWith = useCallback((code: SpeakErrorCode, retryable: boolean) => {
    setError({ code, retryable })
    setPhase('ready')
  }, [])

  /**
   * Leave the speaking phase. `force` moves to ready from any phase (used
   * right after a reply when there is nothing to play); otherwise only a
   * genuine end of playback changes the phase.
   */
  const finishSpeech = useCallback((force: boolean) => {
    if (completeAfterSpeechRef.current) {
      completeAfterSpeechRef.current = false
      setPhase('completed')
    } else if (force) {
      setPhase('ready')
    } else {
      setPhase((p) => (p === 'speaking' ? 'ready' : p))
    }
  }, [])

  const speak = useCallback(
    async (session: number, audio: { base64: string; mime: string } | null, autoplay: boolean) => {
      if (!audio || !autoplay || !optsRef.current.voice) {
        if (audio) player.load(audio)
        finishSpeech(true)
        return
      }
      setPhase('speaking')
      const started = await player.play(audio)
      if (!alive(session)) return
      if (!started) finishSpeech(true)
      // Otherwise `onPlaybackEnded` finishes.
    },
    [alive, finishSpeech, player],
  )

  const adopt = useCallback(
    (c: Conversation) => {
      commitConversation(c)
      commitTurns(() => turnsOf(c))
    },
    [commitConversation, commitTurns],
  )

  const load = useCallback(async () => {
    const session = ++sessionRef.current
    setPhase('loading')
    setError(null)
    const res = await api.session()
    if (!alive(session)) return
    if (!res.ok) {
      setError({ code: res.code, retryable: true })
      setPhase('idle')
      return
    }
    setHistory(res.history)
    setNextAvailableAt(res.nextAvailableAt)
    if (res.current) {
      adopt(res.current)
      if (res.current.status === 'active') {
        setResumed((res.current.turns?.length ?? 0) > 0)
        setPhase('ready')
      } else {
        setPhase('locked')
      }
    } else {
      commitConversation(null)
      commitTurns(() => [])
      setPhase('idle')
    }
  }, [adopt, alive, api, commitConversation, commitTurns])

  const start = useCallback(
    async (scenario: ScenarioId) => {
      if (busyRef.current) return
      recorder.cancel()
      player.stop()
      const session = ++sessionRef.current
      busyRef.current = true
      lastScenarioRef.current = scenario
      pendingRef.current = null
      completeAfterSpeechRef.current = false
      setError(null)
      setResumed(false)
      setPhase('starting')
      try {
        const { level: lv, voice: vc } = optsRef.current
        const res = await api.start({ scenario, level: lv, wantAudio: vc })
        if (!alive(session)) return
        if (!res.ok) {
          if (res.code === 'daily_limit') {
            setNextAvailableAt(res.nextAvailableAt ?? null)
            setPhase('locked')
            return
          }
          setError({ code: res.code, retryable: true })
          setPhase('idle')
          return
        }
        adopt(res.conversation)
        setResumed(res.resumed)
        await speak(session, res.audio, true)
      } finally {
        busyRef.current = false
      }
    },
    [adopt, alive, api, player, recorder, speak],
  )

  /** Ask Emma to answer `userTurn` (already on screen) and play her reply. */
  const respond = useCallback(
    async (session: number, userTurn: ConversationTurn, seconds: number, audioPath: string | null = null) => {
      const current = conversationRef.current
      if (!current) return
      pendingRef.current = userTurn
      pendingAudioPathRef.current = audioPath
      setPhase('thinking')
      const { level: lv, voice: vc } = optsRef.current
      const res = await api.respond({
        conversationId: current.id,
        level: lv,
        text: userTurn.text,
        speakingSeconds: seconds,
        wantAudio: vc,
        audioPath,
      })
      if (!alive(session)) return
      if (!res.ok) {
        if (res.code === 'conversation_completed') {
          // Completed elsewhere (another tab): reload the state instead of retrying.
          pendingRef.current = null
          void load()
          return
        }
        // The learner's words stay on screen; `retry()` resends them.
        failWith(res.code, true)
        return
      }
      pendingRef.current = null
      const stored: StoredTurn = {
        id: nextId(),
        transcript: userTurn.text,
        reply: res.reply,
        feedback: res.feedback,
        speakingSeconds: seconds,
        createdAt: new Date().toISOString(),
      }
      const updated: Conversation = {
        ...current,
        speakingSeconds: res.speakingSeconds,
        goalSeconds: res.goalSeconds,
        status: res.completed ? 'completed' : 'active',
        completedAt: res.completedAt,
        turns: [...(current.turns ?? []), stored],
      }
      commitConversation(updated)
      commitTurns((prev) => [
        ...prev.map((t) => (t.id === userTurn.id ? { ...t, feedback: res.feedback } : t)),
        { id: nextId(), role: 'ai', text: res.reply },
      ])
      if (res.completed) {
        setNextAvailableAt(res.nextAvailableAt)
        setHistory((h) => [updated, ...h.filter((c) => c.id !== updated.id)])
        completeAfterSpeechRef.current = true
      }
      await speak(session, res.audio, true)
    },
    [alive, api, commitConversation, commitTurns, failWith, load, speak],
  )

  const addUserTurn = useCallback(
    (text: string): ConversationTurn => {
      const userTurn: ConversationTurn = { id: nextId(), role: 'user', text }
      commitTurns((prev) => [...prev, userTurn])
      return userTurn
    },
    [commitTurns],
  )

  const submitRecording = useCallback(
    async (session: number, blob: Blob, seconds: number) => {
      setPhase('transcribing')
      const res = await api.transcribe({ audio: blob, speakingSeconds: seconds })
      if (!alive(session)) return
      if (!res.ok) {
        failWith(res.code, false)
        return
      }
      await respond(session, addUserTurn(res.transcript), seconds, res.audioPath)
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
        await respond(session, addUserTurn(text), 0)
      } finally {
        busyRef.current = false
      }
    },
    [addUserTurn, phase, player, respond],
  )

  const endConversation = useCallback(async () => {
    const current = conversationRef.current
    if (!current || current.status !== 'active' || busyRef.current) return
    if (phase !== 'ready' && phase !== 'speaking') return
    const session = sessionRef.current
    busyRef.current = true
    recorder.cancel()
    player.stop()
    setError(null)
    try {
      const res = await api.end({ conversationId: current.id })
      if (!alive(session)) return
      if (!res.ok) {
        failWith(res.code, false)
        return
      }
      completeAfterSpeechRef.current = false
      adopt(res.conversation)
      setNextAvailableAt(res.nextAvailableAt)
      setHistory((h) => [res.conversation, ...h.filter((c) => c.id !== res.conversation.id)])
      setPhase('completed')
    } finally {
      busyRef.current = false
    }
  }, [adopt, alive, api, failWith, phase, player, recorder])

  const retry = useCallback(async () => {
    if (busyRef.current) return
    const session = sessionRef.current
    if (phase === 'idle') {
      if (lastScenarioRef.current) await start(lastScenarioRef.current)
      else await load()
      return
    }
    const pending = pendingRef.current
    setError(null)
    if (!pending) return
    busyRef.current = true
    try {
      await respond(session, pending, 0, pendingAudioPathRef.current)
    } finally {
      busyRef.current = false
    }
  }, [load, phase, respond, start])

  const stopSpeaking = useCallback(() => {
    player.stop()
    finishSpeech(false)
  }, [finishSpeech, player])

  const onPlaybackEnded = useCallback(() => {
    finishSpeech(false)
  }, [finishSpeech])

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
      conversation,
      speakingSeconds: conversation?.speakingSeconds ?? 0,
      goalSeconds: conversation?.goalSeconds ?? 300,
      nextAvailableAt,
      history,
      resumed,
      canSpeak,
      recordingSeconds: recorder.seconds,
      load,
      start,
      toggleMic,
      cancelRecording,
      sendText,
      endConversation,
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
      conversation,
      nextAvailableAt,
      history,
      resumed,
      canSpeak,
      recorder.seconds,
      load,
      start,
      toggleMic,
      cancelRecording,
      sendText,
      endConversation,
      stopSpeaking,
      replay,
      retry,
      dismissError,
      onPlaybackEnded,
    ],
  )
}
