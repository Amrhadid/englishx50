// Persists a completed speaking attempt (transcript + AI feedback) per task, so
// reopening the level test or a challenge speaking task shows the saved
// transcription and the same feedback instead of starting a new recording.
// Stored client-side (per browser); the server already keeps its own copy in
// x50_submissions.

import { supabase } from './supabase'
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

/** Overwrite the locally cached trial count (used to mirror the server's). */
export function setStoredTrials(taskId: string | null, used: number): void {
  if (!taskId) return
  try {
    localStorage.setItem(TRIALS_PREFIX + taskId, String(used))
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Task key used by the SERVER-side trial counter (x50_trials). Unlike the
 * local taskId it carries no user prefix — the account comes from the JWT.
 * Must stay in sync with the fallback derivation in the feedback function.
 */
export function serverTaskKey(challengeId?: string, challengeNumber?: number, taskIndex = 0): string {
  const suffix = taskIndex > 0 ? `#${taskIndex}` : ''
  if (challengeId) return `challenge_${challengeId}${suffix}`
  if (challengeNumber != null) return `challenge_${challengeNumber}${suffix}`
  return 'speaking'
}

/**
 * The authoritative attempts-used count from the DB (null when unavailable —
 * e.g. signed out, no row yet, or the table hasn't been created).
 */
export async function fetchServerTrials(taskKey: string, userId: string): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('x50_trials')
    .select('used')
    .eq('user_id', userId)
    .eq('task_id', taskKey)
    .maybeSingle()
  if (error || !data) return null
  const used = (data as { used: number }).used
  return Number.isFinite(used) ? used : null
}

/**
 * Authoritative, cross-device check: has this account ever recorded a level-test
 * attempt? Reads the user's OWN level-test submission (challenge id/number NULL)
 * — RLS lets a user read only their own rows. Returns false when signed out or
 * unavailable, so callers fall back to other signals. This survives a new
 * device / cleared cache, unlike the localStorage saved attempt.
 */
export async function hasLevelTestSubmission(userId: string | null | undefined): Promise<boolean> {
  if (!supabase || !userId) return false
  const { data, error } = await supabase
    .from('x50_submissions')
    .select('id')
    .eq('user_id', userId)
    .is('challenge_number', null)
    .is('challenge_id', null)
    .limit(1)
    .maybeSingle()
  if (error || !data) return false
  return true
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

/**
 * Per-user id for a challenge speaking task (prefers the row id, falls back to
 * number). `taskIndex` distinguishes multiple speaking tasks within one
 * challenge so each has its own saved attempt / trials.
 */
export function challengeTaskId(
  userId: string | null | undefined,
  challengeId?: string,
  challengeNumber?: number,
  taskIndex = 0,
): string | null {
  const s = scope(userId)
  const suffix = taskIndex > 0 ? `#${taskIndex}` : ''
  if (challengeId) return `${s}:challenge_${challengeId}${suffix}`
  if (challengeNumber != null) return `${s}:challenge_${challengeNumber}${suffix}`
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
