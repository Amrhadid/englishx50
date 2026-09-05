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

/**
 * Real-playback percent at which a lesson video counts as fully watched.
 * Forward seeking is blocked, so reaching this means nearly the whole video was
 * actually played. Kept below 100 because players often report the final few
 * percent unreliably (the watched percent can cap around 95%), so a stricter
 * value would never unlock even after watching the whole thing. Reaching the
 * actual end (`ended` / within a couple seconds of the end) also counts.
 */
export const VIDEO_WATCHED_PCT = 90

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

const PCT_PREFIX = 'x50_vidpct_'

function pctKey(userId: string | null | undefined, challengeId: string): string {
  return `${PCT_PREFIX}${userId ?? 'anon'}:${challengeId}`
}

/** Per-video watched percent (real playback) for this account+challenge. */
export function getVideoProgress(
  userId: string | null | undefined,
  challengeId: string,
): Record<string, number> {
  try {
    const raw = localStorage.getItem(pctKey(userId, challengeId))
    const obj = raw ? JSON.parse(raw) : {}
    return obj && typeof obj === 'object' ? (obj as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** Persist a video's watched percent (keeps the maximum seen). */
export function saveVideoProgress(
  userId: string | null | undefined,
  challengeId: string,
  uid: string,
  pct: number,
): void {
  try {
    const all = getVideoProgress(userId, challengeId)
    all[uid] = Math.min(100, Math.max(all[uid] ?? 0, Math.round(pct)))
    localStorage.setItem(pctKey(userId, challengeId), JSON.stringify(all))
  } catch {
    /* ignore storage errors */
  }
}

const POS_PREFIX = 'x50_vidpos_'

function posKey(userId: string | null | undefined, challengeId: string): string {
  return `${POS_PREFIX}${userId ?? 'anon'}:${challengeId}`
}

/** Last playback position (seconds) for a video, so it resumes on reopen. */
export function getVideoPosition(
  userId: string | null | undefined,
  challengeId: string,
  uid: string,
): number {
  try {
    const raw = localStorage.getItem(posKey(userId, challengeId))
    const obj = raw ? JSON.parse(raw) : {}
    const v = obj && typeof obj === 'object' ? obj[uid] : 0
    return typeof v === 'number' && v > 0 ? v : 0
  } catch {
    return 0
  }
}

/** Persist the last playback position (seconds) for a video. */
export function saveVideoPosition(
  userId: string | null | undefined,
  challengeId: string,
  uid: string,
  seconds: number,
): void {
  try {
    const raw = localStorage.getItem(posKey(userId, challengeId))
    const obj = raw ? JSON.parse(raw) : {}
    const all = obj && typeof obj === 'object' ? (obj as Record<string, number>) : {}
    all[uid] = Math.floor(seconds)
    localStorage.setItem(posKey(userId, challengeId), JSON.stringify(all))
  } catch {
    /* ignore storage errors */
  }
}

/** True once every lesson video of the challenge has been fully watched. */
export function allVideosWatched(userId: string | null | undefined, c: Challenge): boolean {
  const videos = challengeVideos(c)
  if (videos.length === 0) return false
  const watched = new Set(getWatchedVideos(userId, c.id))
  return videos.every((v) => watched.has(v.uid))
}

const TASK_PREFIX = 'x50_taskdone_'

function taskKey(userId: string | null | undefined, challengeId: string): string {
  return `${TASK_PREFIX}${userId ?? 'anon'}:${challengeId}`
}

/** Speaking-task indices the SERVER says this account has submitted. */
function getServerDoneTasks(userId: string | null | undefined, challengeId: string): number[] {
  try {
    const raw = localStorage.getItem(taskKey(userId, challengeId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveServerDoneTasks(userId: string, challengeId: string, indices: number[]): void {
  try {
    localStorage.setItem(taskKey(userId, challengeId), JSON.stringify(indices))
  } catch {
    /* ignore storage errors */
  }
}

/** True once a speaking task has a saved attempt here or a submission on the server. */
export function isTaskDone(userId: string | null | undefined, c: Challenge, index: number): boolean {
  if (getAttempt(challengeTaskId(userId, c.id, c.number, index))) return true
  return getServerDoneTasks(userId, c.id).includes(index)
}

/**
 * Pull this account's watched videos and speaking submissions for a challenge
 * from the DB into the local caches. Completion used to be judged from
 * localStorage alone, so a student who finished on another device (or cleared
 * the cache) was told to "complete the previous challenge" / "watch part 1"
 * again. Best-effort: any failure just leaves the local state as it was.
 */
export async function syncChallengeFromServer(userId: string, c: Challenge): Promise<void> {
  if (!supabase) return
  const videos = challengeVideos(c)
  const tasks = challengeSpeakingTasks(c)
  const [views, subs] = await Promise.all([
    videos.length
      ? supabase
          .from('x50_video_views')
          .select('video_id, watched_percent')
          .eq('user_id', userId)
          .in('video_id', videos.map((v) => v.uid))
          .gte('watched_percent', VIDEO_WATCHED_PCT)
      : Promise.resolve({ data: null, error: null }),
    tasks.length
      ? supabase
          .from('x50_submissions')
          .select('question, challenge_id, challenge_number')
          .eq('user_id', userId)
          .or(`challenge_id.eq.${c.id},challenge_number.eq.${c.number}`)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (!views.error) {
    for (const row of (views.data as { video_id: string }[] | null) ?? []) {
      markVideoWatched(userId, c.id, row.video_id)
    }
  }
  if (!subs.error && subs.data) {
    const questions = (subs.data as { question: string | null }[]).map((r) =>
      (r.question ?? '').trim(),
    )
    const done = tasks
      .map((_, i) => i)
      .filter((i) => {
        // A single-task challenge is done by any submission for it; with
        // several tasks the submission's question identifies which one.
        if (tasks.length === 1) return questions.length > 0
        return questions.includes(tasks[i].trim())
      })
    if (done.length) saveServerDoneTasks(userId, c.id, done)
  }
}

/** True once every video is watched and every speaking task has a saved attempt. */
export function isChallengeComplete(userId: string | null | undefined, c: Challenge): boolean {
  const videos = challengeVideos(c)
  const tasks = challengeSpeakingTasks(c)
  if (videos.length === 0 && tasks.length === 0) return false // nothing to complete

  const watched = new Set(getWatchedVideos(userId, c.id))
  const allVideos = videos.every((v) => watched.has(v.uid))
  const allTasks = tasks.every((_, i) => isTaskDone(userId, c, i))
  return allVideos && allTasks
}

/**
 * If the challenge just became complete and isn't recorded yet, persist
 * completed_at to the DB. Returns true when a new completion was recorded.
 * Checks the local state first and, when that falls short, the server's
 * record of this account's views and submissions.
 */
export async function recordCompletionIfDone(userId: string, c: Challenge): Promise<boolean> {
  if (!supabase) return false
  if (!isChallengeComplete(userId, c)) {
    await syncChallengeFromServer(userId, c)
    if (!isChallengeComplete(userId, c)) return false
  }
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
 * one needs the previous challenge completed AND 5 days passed since.
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
): LockState {
  const idx = realNumbers.indexOf(challenge.number)
  if (idx <= 0) return { locked: false }
  if (unlocks.includes(challenge.number)) return { locked: false }
  const prevNumber = realNumbers[idx - 1]
  const prevDone = progress[prevNumber]
  if (!prevDone) return { locked: true, reason: 'prev' }
  if (skips.includes(challenge.number)) return { locked: false }
  const elapsedDays = Math.floor((Date.now() - new Date(prevDone).getTime()) / 86_400_000)
  const daysLeft = COOLDOWN_DAYS - elapsedDays
  if (daysLeft > 0) return { locked: true, reason: 'cooldown', daysLeft }
  return { locked: false }
}
