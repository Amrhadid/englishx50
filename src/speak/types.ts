// EnglishX50 /speak — client-side types. Mirrors the `speak-turn` Edge
// Function contract (supabase/functions/speak-turn/handler.ts).

export type ScenarioId =
  | 'introduce'
  | 'daily'
  | 'weekend'
  | 'family'
  | 'hobbies'
  | 'cooking'
  | 'restaurant'
  | 'shopping'
  | 'airport'
  | 'hotel'
  | 'directions'
  | 'doctor'
  | 'past'
  | 'future'
  | 'vacation'
  | 'interview'
  | 'work'
  | 'meeting'
  | 'customer'
  | 'opinion'
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
  | 'storage_unavailable'
  | 'conversation_not_found'
  | 'conversation_completed'
  | 'daily_limit'
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
  /** For `daily_limit`: when the next conversation may start (ISO). */
  nextAvailableAt?: string | null
}

/** One stored learner turn with Emma's answer and note. */
export interface StoredTurn {
  id: string
  transcript: string
  reply: string
  feedback: SpeakFeedback | null
  speakingSeconds: number
  createdAt: string
}

export type ConversationStatus = 'active' | 'completed'

export interface Conversation {
  id: string
  scenario: ScenarioId
  level: LevelId
  status: ConversationStatus
  speakingSeconds: number
  goalSeconds: number
  startedAt: string
  completedAt: string | null
  /** Emma's fixed opening question for the scenario. */
  opener: string
  /** Present when the server returned the turns (current / single conversation). */
  turns?: StoredTurn[]
}

export type SessionResult =
  | {
      ok: true
      /** Active conversation, or a completed one still inside its 24 h window. */
      current: Conversation | null
      nextAvailableAt: string | null
      history: Conversation[]
    }
  | ApiFailure

export type StartResult =
  | { ok: true; conversation: Conversation; reply: string; audio: SpeakAudio | null; resumed: boolean }
  | ApiFailure
export type ConversationResult = { ok: true; conversation: Conversation } | ApiFailure
export type EndResult = { ok: true; conversation: Conversation; nextAvailableAt: string | null } | ApiFailure
export type TranscribeResult = { ok: true; transcript: string; audioPath: string | null } | ApiFailure
export type TurnResult =
  | {
      ok: true
      reply: string
      feedback: SpeakFeedback
      audio: SpeakAudio | null
      speakingSeconds: number
      goalSeconds: number
      completed: boolean
      completedAt: string | null
      nextAvailableAt: string | null
    }
  | ApiFailure

/** The only door to the paid pipeline. Implemented by api.ts (real) and mockApi.ts (dev). */
export interface SpeakApi {
  session(): Promise<SessionResult>
  conversation(input: { conversationId: string }): Promise<ConversationResult>
  start(input: { scenario: ScenarioId; level: LevelId; wantAudio: boolean }): Promise<StartResult>
  transcribe(input: { audio: Blob; speakingSeconds: number }): Promise<TranscribeResult>
  respond(input: {
    conversationId: string
    level: LevelId
    text: string
    speakingSeconds: number
    wantAudio: boolean
    /** From a prior transcribe() call, so the recording gets attached to this turn. */
    audioPath?: string | null
  }): Promise<TurnResult>
  /** End the active conversation early, before the speaking goal is reached. */
  end(input: { conversationId: string }): Promise<EndResult>
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
 *   idle       — no conversation yet: pick a scenario, press start
 *   locked     — today's conversation is complete; the next one is not due yet
 *   completed  — this conversation just reached its goal (review shown)
 */
export type SessionPhase =
  | 'loading'
  | 'idle'
  | 'locked'
  | 'starting'
  | 'ready'
  | 'requesting_mic'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'completed'

export interface SpeakError {
  code: SpeakErrorCode
  /** True when the failed step can be repeated with `retry()`. */
  retryable: boolean
}
