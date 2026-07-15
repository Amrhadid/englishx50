// Aggregated cohort stats for the admin "Students → Overview" dashboard:
// how many students completed each challenge (and their progress through the
// program), plus how many have done the speaking tasks. Everything is keyed by
// the auth `user_id`, the identity shared by x50_challenge_progress and
// x50_submissions (see supabase/level_test_done.sql). The admin account can
// read every row of these tables under RLS, so a single set of reads gives the
// whole-cohort picture.

import { supabase } from './supabase'
import { challengeSpeakingTasks } from './challenge'
import type { Challenge } from '../types'

export interface ChallengeStat {
  id: string
  number: number
  title: string
  /** Whether this challenge has any speaking prompt. */
  hasSpeaking: boolean
  speakingTaskCount: number
  /** Students who fully completed the challenge (all videos + all tasks). */
  completed: number
  completedPct: number
  /** Students who submitted at least one speaking task for this challenge. */
  speakingSubmitted: number
  speakingSubmittedPct: number
  /** Students who passed at least one speaking task for this challenge. */
  speakingPassed: number
}

export interface StudentsDashboardData {
  /** Tracked learners: enrolled students plus anyone with challenge activity. */
  totalStudents: number
  /** Students who redeemed a code (x50_students rows). */
  enrolledStudents: number
  /** Students who completed at least one challenge. */
  activeStudents: number
  /** Sum of every per-challenge completion across the cohort. */
  totalCompletions: number
  /** Average challenges completed per tracked student. */
  avgCompleted: number
  /** Number of published challenges. */
  challengeCount: number
  speaking: {
    /** Students who submitted at least one challenge speaking task. */
    attemptedStudents: number
    attemptedPct: number
    /** Students who passed at least one challenge speaking task. */
    passedStudents: number
    /** Total speaking submissions (challenge tasks, excludes level test). */
    totalSubmissions: number
    /** Students who submitted the level-test speaking task. */
    levelTestStudents: number
  }
  challenges: ChallengeStat[]
  updatedAt: number
}

export interface ProgressRow {
  user_id: string | null
  challenge_number: number | null
}
export interface SubmissionRow {
  user_id: string | null
  challenge_number: number | null
  passed: boolean | null
}

/**
 * Load and aggregate the whole-cohort dashboard. Throws when Supabase is not
 * configured or a query fails (the caller surfaces the message).
 */
export async function getStudentsDashboard(nowMs: number): Promise<StudentsDashboardData> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const [challengesRes, studentsRes, progressRes, subsRes] = await Promise.all([
    supabase.from('x50_challenges').select('*').order('number', { ascending: true }),
    supabase.from('x50_students').select('user_id'),
    supabase.from('x50_challenge_progress').select('user_id, challenge_number'),
    supabase.from('x50_submissions').select('user_id, challenge_number, passed'),
  ])

  const err = challengesRes.error || studentsRes.error || progressRes.error || subsRes.error
  if (err) throw err

  return aggregateDashboard(
    (challengesRes.data as Challenge[]) ?? [],
    ((studentsRes.data as { user_id: string | null }[]) ?? []).map((s) => s.user_id),
    (progressRes.data as ProgressRow[]) ?? [],
    (subsRes.data as SubmissionRow[]) ?? [],
    nowMs,
  )
}

/**
 * Pure aggregation of the raw table rows into dashboard stats. Kept separate
 * from the Supabase reads so the counting logic is testable in isolation.
 */
export function aggregateDashboard(
  challenges: Challenge[],
  rosterIdsRaw: (string | null)[],
  progressRows: ProgressRow[],
  subRows: SubmissionRow[],
  nowMs: number,
): StudentsDashboardData {
  const rosterIds = rosterIdsRaw.filter((id): id is string => !!id)

  // The tracked universe: enrolled students plus anyone with real challenge
  // activity (so the dashboard still reads sensibly if the roster is thin, and
  // per-challenge counts can never exceed the total).
  const universe = new Set<string>(rosterIds)
  for (const r of progressRows) if (r.user_id) universe.add(r.user_id)
  for (const r of subRows) if (r.user_id && r.challenge_number != null) universe.add(r.user_id)
  const totalStudents = universe.size

  // Challenge completion: distinct students per challenge number.
  const completedByNum = new Map<number, Set<string>>()
  const completedCountByUser = new Map<string, number>()
  for (const r of progressRows) {
    if (!r.user_id || r.challenge_number == null) continue
    let set = completedByNum.get(r.challenge_number)
    if (!set) {
      set = new Set<string>()
      completedByNum.set(r.challenge_number, set)
    }
    if (!set.has(r.user_id)) {
      set.add(r.user_id)
      completedCountByUser.set(r.user_id, (completedCountByUser.get(r.user_id) ?? 0) + 1)
    }
  }

  // Speaking submissions: per-challenge submitted / passed, plus overall.
  const submittedByNum = new Map<number, Set<string>>()
  const passedByNum = new Map<number, Set<string>>()
  const attemptedAny = new Set<string>()
  const passedAny = new Set<string>()
  const levelTest = new Set<string>()
  let totalSubmissions = 0
  const bump = (m: Map<number, Set<string>>, n: number, uid: string) => {
    let set = m.get(n)
    if (!set) {
      set = new Set<string>()
      m.set(n, set)
    }
    set.add(uid)
  }
  for (const r of subRows) {
    if (!r.user_id) continue
    if (r.challenge_number == null) {
      levelTest.add(r.user_id)
      continue
    }
    totalSubmissions++
    attemptedAny.add(r.user_id)
    bump(submittedByNum, r.challenge_number, r.user_id)
    if (r.passed) {
      passedAny.add(r.user_id)
      bump(passedByNum, r.challenge_number, r.user_id)
    }
  }

  const pct = (n: number) => (totalStudents > 0 ? Math.round((n / totalStudents) * 100) : 0)

  const challengeStats: ChallengeStat[] = challenges.map((c) => {
    const tasks = challengeSpeakingTasks(c)
    const completed = completedByNum.get(c.number)?.size ?? 0
    const speakingSubmitted = submittedByNum.get(c.number)?.size ?? 0
    return {
      id: c.id,
      number: c.number,
      title: c.title ?? '',
      hasSpeaking: tasks.length > 0,
      speakingTaskCount: tasks.length,
      completed,
      completedPct: pct(completed),
      speakingSubmitted,
      speakingSubmittedPct: pct(speakingSubmitted),
      speakingPassed: passedByNum.get(c.number)?.size ?? 0,
    }
  })

  const totalCompletions = challengeStats.reduce((n, c) => n + c.completed, 0)

  return {
    totalStudents,
    enrolledStudents: new Set(rosterIds).size,
    activeStudents: completedCountByUser.size,
    totalCompletions,
    avgCompleted: totalStudents > 0 ? totalCompletions / totalStudents : 0,
    challengeCount: challenges.length,
    speaking: {
      attemptedStudents: attemptedAny.size,
      attemptedPct: pct(attemptedAny.size),
      passedStudents: passedAny.size,
      totalSubmissions,
      levelTestStudents: levelTest.size,
    },
    challenges: challengeStats,
    updatedAt: nowMs,
  }
}
