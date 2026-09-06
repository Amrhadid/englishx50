// Challenge completion + the 5-day cooldown that unlocks the next challenge.
//
// A challenge is COMPLETE once the account has watched all of its lesson
// videos. Video progress lives on the server (x50_video_progress, see
// videoProgress.ts) and a database trigger writes the completion row
// (x50_challenge_progress.completed_at) the moment the last video is watched,
// so the cooldown starts server-side and holds across devices. The client only
// reads that state; recordCompletionIfDone is a fallback for the rare case the
// trigger has not run.

import { supabase } from './supabase'
import { challengeVideos } from './challenge'
import { fetchChallengeVideoProgress, allVideosWatched } from './videoProgress'
import type { Challenge } from '../types'

export const COOLDOWN_DAYS = 5

/**
 * Real-playback percent at which a lesson video counts as fully watched.
 * Forward seeking is blocked, so reaching this means nearly the whole video was
 * actually played. Kept below 100 because players often report the final few
 * percent unreliably (the watched percent can cap around 95%), so a stricter
 * value would never unlock even after watching the whole thing. Reaching the
 * actual end (`ended` / within a couple seconds of the end) also counts. The
 * same threshold is applied by the x50_video_progress trigger.
 */
export const VIDEO_WATCHED_PCT = 90

/**
 * Fallback for the server trigger: if every video of the challenge is watched
 * on the server and no completion row exists yet, insert one. Returns true
 * when a new completion was recorded.
 */
export async function recordCompletionIfDone(userId: string, c: Challenge): Promise<boolean> {
  if (!supabase || !challengeVideos(c).length) return false
  const progress = await fetchChallengeVideoProgress(userId, c)
  if (!allVideosWatched(c, progress)) return false
  const { data } = await supabase
    .from('x50_challenge_progress')
    .select('challenge_number')
    .eq('user_id', userId)
    .eq('challenge_number', c.number)
    .maybeSingle()
  if (data) return false
  const { error } = await supabase
    .from('x50_challenge_progress')
    .insert({ user_id: userId, challenge_number: c.number, completed_at: new Date().toISOString() })
  return !error
}

/** Challenge numbers listed for this account in one of the admin grant tables. */
async function fetchGrantedNumbers(table: string, userId: string): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select('challenge_number').eq('user_id', userId)
  if (error) return []
  return ((data as { challenge_number: number }[] | null) ?? []).map((r) => r.challenge_number)
}

/**
 * Challenge numbers an admin has waived the cooldown for on this account
 * (x50_cooldown_skips). Only the wait is waived — the student still has to
 * finish the previous challenge.
 */
export function fetchCooldownSkips(userId: string): Promise<number[]> {
  return fetchGrantedNumbers('x50_cooldown_skips', userId)
}

/**
 * Challenge numbers an admin has opened outright for this account
 * (x50_challenge_unlocks). Unlike a cooldown skip this clears every sequential
 * gate: the challenge opens even if the one before it was never finished.
 */
export function fetchChallengeUnlocks(userId: string): Promise<number[]> {
  return fetchGrantedNumbers('x50_challenge_unlocks', userId)
}

export type LockState =
  | { locked: false }
  | { locked: true; reason: 'prev' }
  | { locked: true; reason: 'cooldown'; daysLeft: number }

/**
 * Sequential lock with cooldown: the first added challenge is open; each later
 * one needs the previous challenge's videos finished AND 5 days passed since,
 * after which it opens immediately. Applies to every challenge, with or
 * without a source link.
 *
 * Two admin overrides, both granted per (student, challenge) from the Students
 * tab and deliberately different in strength:
 *
 * - `unlocks` ("Unlock now") opens the challenge outright — the previous
 *   challenge does not have to be finished.
 * - `skips` ("Skip the cooldown") only drops the wait: the challenge opens as
 *   soon as the previous one is done, instead of 5 days later.
 */
export function challengeLockState(
  challenge: Challenge,
  realNumbers: number[],
  progress: Record<number, string>,
  skips: number[] = [],
  unlocks: number[] = [],
  now: number = Date.now(),
): LockState {
  const idx = realNumbers.indexOf(challenge.number)
  if (idx <= 0) return { locked: false }
  if (unlocks.includes(challenge.number)) return { locked: false }
  const prevNumber = realNumbers[idx - 1]
  const prevDone = progress[prevNumber]
  if (!prevDone) return { locked: true, reason: 'prev' }
  if (skips.includes(challenge.number)) return { locked: false }
  const elapsedMs = now - new Date(prevDone).getTime()
  const daysLeft = Math.ceil((COOLDOWN_DAYS * 86_400_000 - elapsedMs) / 86_400_000)
  if (daysLeft > 0) return { locked: true, reason: 'cooldown', daysLeft }
  return { locked: false }
}
