// Per-account lesson-video progress, stored on the server (x50_video_progress)
// so a student who leaves a video at any minute continues from that moment on
// any device, and so "watched" is judged from one authoritative record.
//
// Nothing here touches localStorage: the row on the server is the state.

import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'
import { challengeVideos } from './challenge'
import type { Challenge } from '../types'

export interface VideoProgress {
  /** Last playback position in seconds (0 = start from the beginning). */
  position: number
  /** Furthest point genuinely played, in seconds. */
  maxReached: number
  /** Watched percent of real playback (0–100). */
  percent: number
  /** True once the server counted the video as fully watched. */
  watched: boolean
}

export type ProgressByVideo = Record<string, VideoProgress>

const TABLE = 'x50_video_progress'

interface Row {
  video_id: string
  position_seconds: number | string | null
  max_reached_seconds: number | string | null
  watched_percent: number | null
  watched_at: string | null
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

function fromRow(r: Row): VideoProgress {
  return {
    position: num(r.position_seconds),
    maxReached: num(r.max_reached_seconds),
    percent: Math.min(100, Math.max(0, r.watched_percent ?? 0)),
    watched: !!r.watched_at,
  }
}

/** Every video row this account has (all challenges), keyed by video uid. */
export async function fetchAllVideoProgress(userId: string): Promise<ProgressByVideo> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from(TABLE)
    .select('video_id, position_seconds, max_reached_seconds, watched_percent, watched_at')
    .eq('user_id', userId)
  if (error || !data) return {}
  return Object.fromEntries((data as Row[]).map((r) => [r.video_id, fromRow(r)]))
}

/** Progress for the videos of one challenge, keyed by video uid. */
export async function fetchChallengeVideoProgress(
  userId: string,
  challenge: Challenge,
): Promise<ProgressByVideo> {
  if (!supabase) return {}
  const uids = challengeVideos(challenge).map((v) => v.uid)
  if (!uids.length) return {}
  const { data, error } = await supabase
    .from(TABLE)
    .select('video_id, position_seconds, max_reached_seconds, watched_percent, watched_at')
    .eq('user_id', userId)
    .in('video_id', uids)
  if (error || !data) return {}
  return Object.fromEntries((data as Row[]).map((r) => [r.video_id, fromRow(r)]))
}

/** True once every lesson video of the challenge is watched on the server. */
export function allVideosWatched(challenge: Challenge, progress: ProgressByVideo): boolean {
  const videos = challengeVideos(challenge)
  if (!videos.length) return false
  return videos.every((v) => progress[v.uid]?.watched)
}

export interface VideoProgressUpdate {
  position: number
  maxReached: number
  percent: number
  duration?: number
}

/**
 * Write a video's progress to the server (insert or update). The row's
 * watched percent / furthest point only ever grow (enforced server-side), so
 * calls may arrive out of order without losing progress.
 *
 * `keepalive` sends the request in a way the browser lets finish after the
 * page is hidden or closed — used for the last save on pagehide/unmount, when
 * an ordinary request would be cancelled.
 */
export async function saveVideoProgress(
  userId: string,
  challenge: Challenge,
  uid: string,
  update: VideoProgressUpdate,
  opts: { keepalive?: boolean } = {},
): Promise<boolean> {
  if (!supabase || !userId || !uid) return false
  const row = {
    user_id: userId,
    video_id: uid,
    challenge_id: challenge.id,
    challenge_number: challenge.number,
    position_seconds: Math.max(0, Math.floor(update.position)),
    max_reached_seconds: Math.max(0, Math.floor(update.maxReached)),
    watched_percent: Math.min(100, Math.max(0, Math.round(update.percent))),
    ...(update.duration && update.duration > 0 ? { duration_seconds: Math.floor(update.duration) } : {}),
  }
  if (opts.keepalive && supabaseUrl && supabaseAnonKey) {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return false
      const res = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?on_conflict=user_id,video_id`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      })
      return res.ok
    } catch {
      return false
    }
  }
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id,video_id' })
  return !error
}
