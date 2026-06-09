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
const TRIALS_PREFIX = 'x50_trials_'

/** Max grading attempts a normal user gets per speaking task. */
export const MAX_TRIALS = 2

/** How many grading attempts have been used for a task. */
export function getTrials(taskId: string | null): number {
  if (!taskId) return 0
  try {
    const n = parseInt(localStorage.getItem(TRIALS_PREFIX + taskId) ?? '0', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** Record one used grading attempt; returns the new count. */
export function incrementTrials(taskId: string | null): number {
  if (!taskId) return 0
  const next = getTrials(taskId) + 1
  try {
    localStorage.setItem(TRIALS_PREFIX + taskId, String(next))
  } catch {
    /* ignore storage errors */
  }
  return next
}

// Keys are scoped to the signed-in account so saved attempts/trials never leak
// between accounts sharing the same browser (localStorage is per-device).
function scope(userId: string | null | undefined): string {
  return userId ?? 'anon'
}

/** Stable, per-user id for the level test (pre task). */
export function levelTestTaskId(userId: string | null | undefined): string {
  return `${scope(userId)}:level_test`
}

/** Per-user id for a challenge speaking task (prefers the row id, falls back to number). */
export function challengeTaskId(
  userId: string | null | undefined,
  challengeId?: string,
  challengeNumber?: number,
): string | null {
  const s = scope(userId)
  if (challengeId) return `${s}:challenge_${challengeId}`
  if (challengeNumber != null) return `${s}:challenge_${challengeNumber}`
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
