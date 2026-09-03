// EnglishX50 /speak — client-side types. Mirrors the `speak-turn` Edge
// Function contract (supabase/functions/speak-turn/handler.ts).

export type ScenarioId = 'daily' | 'interview' | 'airport' | 'meeting' | 'shopping' | 'free'
export type LevelId = 'beginner' | 'intermediate' | 'advanced'

/** Compact, structured feedback on one learner answer. */
export interface SpeakFeedback {
  positive: string
  original?: string
  correction?: string
  explanationArabic?: string
}

export interface SpeakAudio {
  base64: string
  mime: string
}

export type SpeakErrorCode =
  // server
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
  // client-only
  | 'network'
  | 'server'
  | 'mic_denied'
  | 'mic_missing'
  | 'mic_busy'
  | 'mic_unsupported'
  | 'mic_failed'
  | 'empty_recording'

export interface ApiFailure {
  ok: false
  code: SpeakErrorCode
  status?: number
}

export type StartResult = { ok: true; reply: string; audio: SpeakAudio | null } | ApiFailure
export type TranscribeResult = { ok: true; transcript: string } | ApiFailure
export type TurnResult =
  | { ok: true; reply: string; feedback: SpeakFeedback; audio: SpeakAudio | null }
  | ApiFailure

export interface HistoryMessage {
  role: 'assistant' | 'user'
  text: string
}

/** The only door to the paid pipeline. Implemented by api.ts (real) and mockApi.ts (dev). */
export interface SpeakApi {
  start(input: { scenario: ScenarioId; level: LevelId; wantAudio: boolean }): Promise<StartResult>
  transcribe(input: {
    scenario: ScenarioId
    level: LevelId
    audio: Blob
    speakingSeconds: number
  }): Promise<TranscribeResult>
  respond(input: {
    scenario: ScenarioId
    level: LevelId
    text: string
    history: HistoryMessage[]
    speakingSeconds: number
    wantAudio: boolean
  }): Promise<TurnResult>
}

export interface ConversationTurn {
  id: string
  role: 'ai' | 'user'
  text: string
  /** Feedback on this (learner) turn, once Emma has answered. */
  feedback?: SpeakFeedback
}

/**
 * One phase at a time. `requesting_mic` and `recording` come from the
 * recorder; the rest from the round trip with the server.
 */
export type SessionPhase =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'requesting_mic'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'

export interface SpeakError {
  code: SpeakErrorCode
  /** True when the failed step can be repeated with `retry()`. */
  retryable: boolean
}
