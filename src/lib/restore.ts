// Rebuilds the browser's per-account progress cache from the server.
//
// A finished speaking task (transcript + AI feedback) and a fully watched
// lesson video are both tracked in localStorage, so a cleared cache, a new
// browser, a private window or a second device makes a student's completed
// work look undone — even though every graded attempt is safely stored in
// x50_submissions. This pulls the account's OWN submission rows back and
// seeds the local cache from them, so «التقييم» shows the saved feedback
// again and the challenge stops asking for work that is already done.
//
// Never clobbers a local entry: localStorage is only written where nothing is
// stored yet, so an attempt made in this browser always wins.

import { supabase } from './supabase'
import { parseSubmission } from './grading'
import { challengeSpeakingTasks, challengeVideos } from './challenge'
import { challengeTaskId, levelTestTaskId, getAttempt, saveAttempt } from './progress'
import { markVideoWatched, saveVideoProgress } from './completion'
import type { Challenge } from '../types'

interface SubmissionRow {
  challenge_id: string | null
  challenge_number: number | null
  question: string | null
  transcript: string | null
  passed: boolean | null
  created_at: string
  [key: string]: unknown
}

/** Seed one saved attempt, unless this browser already has one for the task. */
function seed(taskId: string | null, row: SubmissionRow): boolean {
  if (!taskId || getAttempt(taskId)) return false
  saveAttempt(taskId, {
    transcript: row.transcript ?? '',
    result: parseSubmission(row),
    outcome: row.passed ? 'passed' : 'failed',
  })
  return true
}

/**
 * Which speaking task of `c` a submission belongs to. Submissions store the
 * prompt, not its index, so match on the prompt text and fall back to the
 * first slot no earlier row has claimed (covers legacy single-task challenges
 * and the "تحدّث بالإنجليزية عن…" fallback prompt, whose text is not in
 * `speaking_tasks`).
 */
function taskIndexFor(c: Challenge, question: string | null, claimed: Set<number>): number {
  const prompts = challengeSpeakingTasks(c)
  const match = question ? prompts.indexOf(question) : -1
  if (match >= 0) return match
  const slots = Math.max(prompts.length, 1)
  for (let i = 0; i < slots; i++) if (!claimed.has(i)) return i
  return slots - 1
}

/**
 * Restore this account's completed speaking tasks (and the lesson videos they
 * imply) into localStorage. Returns the number of entries written, so a caller
 * can re-render once something actually came back.
 */
export async function restoreProgressFromServer(
  userId: string,
  challenges: Challenge[],
): Promise<number> {
  if (!supabase || !userId) return 0

  const { data, error } = await supabase
    .from('x50_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error || !data) return 0

  const rows = data as SubmissionRow[]
  const byId = new Map(challenges.map((c) => [c.id, c]))
  const byNumber = new Map(challenges.map((c) => [c.number, c]))

  let restored = 0
  // Prompt slots already taken, per challenge — reset per challenge below.
  const claimed = new Map<string, Set<number>>()
  const withSubmissions = new Set<string>()

  for (const row of rows) {
    // The level test is the row with no challenge at all.
    if (!row.challenge_id && row.challenge_number == null) {
      if (seed(levelTestTaskId(userId), row)) restored++
      continue
    }
    const c =
      (row.challenge_id ? byId.get(row.challenge_id) : undefined) ??
      (row.challenge_number != null ? byNumber.get(row.challenge_number) : undefined)
    if (!c) continue

    const taken = claimed.get(c.id) ?? new Set<number>()
    claimed.set(c.id, taken)
    const index = taskIndexFor(c, row.question, taken)
    taken.add(index)
    withSubmissions.add(c.id)

    // Rows come oldest-first, so a later retry overwrites the earlier attempt.
    if (seed(challengeTaskId(userId, c.id, c.number, index), row)) restored++
  }

  // Recording a speaking task is only reachable after every lesson video of
  // the challenge was watched in full, so a submission is proof the videos
  // were finished — restore that too, or the student is sent back to «الدرس»
  // before a task they already completed.
  for (const c of challenges) {
    if (!withSubmissions.has(c.id)) continue
    for (const v of challengeVideos(c)) {
      markVideoWatched(userId, c.id, v.uid)
      saveVideoProgress(userId, c.id, v.uid, 100)
    }
  }

  return restored
}
