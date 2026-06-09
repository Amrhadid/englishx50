// Challenge completion + the 5-day cooldown that unlocks the next challenge.
//
// A challenge is COMPLETE when the account has watched all of its videos and
// submitted all of its speaking tasks. Completion is detected client-side
// (videos tracked in user-scoped localStorage, tasks via saved attempts) and
// then persisted to x50_challenge_progress so the cooldown is durable across
// devices / cache clears.

import { supabase } from './supabase'
import { challengeVideos, challengeSpeakingTasks } from './challenge'
import { challengeTaskId, getAttempt } from './progress'
import type { Challenge } from '../types'

export const COOLDOWN_DAYS = 5

const VID_PREFIX = 'x50_vid_'

function vidKey(userId: string | null | undefined, challengeId: string): string {
  return `${VID_PREFIX}${userId ?? 'anon'}:${challengeId}`
}

export function getWatchedVideos(userId: string | null | undefined, challengeId: string): string[] {
  try {
    const raw = localStorage.getItem(vidKey(userId, challengeId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** Mark a video (by Cloudflare uid) as watched for this account+challenge. */
export function markVideoWatched(
  userId: string | null | undefined,
  challengeId: string,
  uid: string,
): void {
  try {
    const set = new Set(getWatchedVideos(userId, challengeId))
    set.add(uid)
    localStorage.setItem(vidKey(userId, challengeId), JSON.stringify([...set]))
  } catch {
    /* ignore storage errors */
  }
}

/** True once every video is watched and every speaking task has a saved attempt. */
export function isChallengeComplete(userId: string | null | undefined, c: Challenge): boolean {
  const videos = challengeVideos(c)
  const tasks = challengeSpeakingTasks(c)
  if (videos.length === 0 && tasks.length === 0) return false // nothing to complete

  const watched = new Set(getWatchedVideos(userId, c.id))
  const allVideos = videos.every((v) => watched.has(v.uid))
  const allTasks = tasks.every(
    (_, i) => !!getAttempt(challengeTaskId(userId, c.id, c.number, i)),
  )
  return allVideos && allTasks
}

/**
 * If the challenge just became complete and isn't recorded yet, persist
 * completed_at to the DB. Returns true when a new completion was recorded.
 */
export async function recordCompletionIfDone(userId: string, c: Challenge): Promise<boolean> {
  if (!supabase || !isChallengeComplete(userId, c)) return false
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

export type LockState =
  | { locked: false }
  | { locked: true; reason: 'prev' }
  | { locked: true; reason: 'cooldown'; daysLeft: number }

/**
 * Sequential lock with cooldown: the first added challenge is open; each later
 * one needs the previous challenge completed AND 5 days passed since.
 */
export function challengeLockState(
  challenge: Challenge,
  realNumbers: number[],
  progress: Record<number, string>,
): LockState {
  const idx = realNumbers.indexOf(challenge.number)
  if (idx <= 0) return { locked: false }
  const prevNumber = realNumbers[idx - 1]
  const prevDone = progress[prevNumber]
  if (!prevDone) return { locked: true, reason: 'prev' }
  const elapsedDays = Math.floor((Date.now() - new Date(prevDone).getTime()) / 86_400_000)
  const daysLeft = COOLDOWN_DAYS - elapsedDays
  if (daysLeft > 0) return { locked: true, reason: 'cooldown', daysLeft }
  return { locked: false }
}
