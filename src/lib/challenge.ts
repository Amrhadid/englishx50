import type { Challenge, ChallengeVideo } from '../types'

// A challenge can carry multiple videos / speaking tasks (stored as JSON arrays
// and managed in the admin). These helpers read the arrays but fall back to the
// legacy single `video_url` / `speaking_task` so older challenges still work.

export function challengeVideos(c: Challenge): ChallengeVideo[] {
  const list = Array.isArray(c.videos)
    ? c.videos.filter((v) => v && typeof v.uid === 'string' && v.uid.trim())
    : []
  if (list.length) return list.map((v) => ({ title: v.title ?? '', uid: v.uid.trim() }))
  if (c.video_url && c.video_url.trim()) return [{ title: '', uid: c.video_url.trim() }]
  return []
}

export function challengeSpeakingTasks(c: Challenge): string[] {
  const list = Array.isArray(c.speaking_tasks)
    ? c.speaking_tasks.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
    : []
  if (list.length) return list
  if (c.speaking_task && c.speaking_task.trim()) return [c.speaking_task.trim()]
  return []
}
