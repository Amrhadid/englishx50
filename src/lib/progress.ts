// Persists a completed speaking attempt (transcript + AI feedback) per task, so
// reopening the level test or a challenge speaking task shows the saved
// transcription and the same feedback instead of starting a new recording.
// Stored client-side (per browser); the server already keeps its own copy in
// x50_submissions.

import type { SpeakingResult } from '../types'

export type TaskOutcome = 'passed' | 'failed' | 'rejected'

export interface SavedAttempt {
  transcript: string
  result: SpeakingResult
  outcome: TaskOutcome
  savedAt: string
}

const PREFIX = 'x50_attempt_'

/** Stable id for the level test (pre task). */
export const LEVEL_TEST_TASK_ID = 'level_test'

/** Stable id for a challenge speaking task (prefers the row id, falls back to number). */
export function challengeTaskId(challengeId?: string, challengeNumber?: number): string | null {
  if (challengeId) return `challenge_${challengeId}`
  if (challengeNumber != null) return `challenge_${challengeNumber}`
  return null
}

export function getAttempt(taskId: string | null): SavedAttempt | null {
  if (!taskId) return null
  try {
    const raw = localStorage.getItem(PREFIX + taskId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedAttempt
    return parsed && parsed.result ? parsed : null
  } catch {
    return null
  }
}

export function saveAttempt(taskId: string | null, attempt: Omit<SavedAttempt, 'savedAt'>): void {
  if (!taskId) return
  try {
    localStorage.setItem(
      PREFIX + taskId,
      JSON.stringify({ ...attempt, savedAt: new Date().toISOString() }),
    )
  } catch {
    /* ignore storage errors */
  }
}

export function clearAttempt(taskId: string | null): void {
  if (!taskId) return
  try {
    localStorage.removeItem(PREFIX + taskId)
  } catch {
    /* ignore storage errors */
  }
}
