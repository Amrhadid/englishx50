// Data layer for the admin "Students" dashboard.
//
// One loader pulls every table that says something about a learner and folds
// it into a single `StudentRecord` per account (keyed by the auth `user_id`
// from x50_students). Most tables are already keyed by user_id; the older
// activity tables (x50_video_views, early x50_submissions rows) only carry the
// text label the client wrote (`name - job`, or `name - phone` in the very
// first version), so those are matched back to a profile by label.
//
// Everything after the reads is a pure function (`buildStudents`) so the
// roll-ups are testable without Supabase.

import { supabase } from './supabase'
import { challengeVideos, challengeSpeakingTasks } from './challenge'
import { VIDEO_WATCHED_PCT, COOLDOWN_DAYS } from './completion'
import type { Challenge } from '../types'

/** Subscription length granted by a redeemed code (see useOnboarding). */
export const PROGRAM_DAYS = 100
/** A student with no activity for this many days is flagged "at risk". */
export const INACTIVE_DAYS = 7

// ---------------------------------------------------------------------------
// Raw rows (what the tables return)
// ---------------------------------------------------------------------------

export interface ProfileRow {
  user_id: string
  name: string | null
  phone: string | null
  job: string | null
  university: string | null
  code: string | null
  code_redeemed_at: string | null
  created_at: string | null
  emma_gift_claimed_at?: string | null
}

export interface VideoViewRow {
  student: string | null
  video_id: string | null
  opened_at: string | null
  watched_percent: number | null
}

export interface SubmissionRow {
  id: string
  user_id: string | null
  student: string | null
  challenge_id: string | null
  challenge_number: number | null
  question: string | null
  transcript: string | null
  score: number | null
  passed: boolean | null
  feedback: unknown
  audio_key: string | null
  created_at: string
  [key: string]: unknown
}

export interface NoteRow {
  user_id: string | null
  student: string | null
  challenge_number: number | null
  entries: string[] | null
  updated_at: string | null
}

export interface ProgressRow {
  user_id: string
  challenge_number: number
  completed_at: string | null
}

export interface ConversationRow {
  id: string
  user_id: string
  scenario: string
  level: string
  status: 'active' | 'completed'
  speaking_seconds: number
  goal_seconds: number
  started_at: string
  completed_at: string | null
}

export interface TurnRow {
  id: string
  conversation_id: string | null
  user_id: string
  transcript: string
  reply: string
  feedback: {
    positive?: string
    original?: string
    correction?: string
    explanationArabic?: string
  } | null
  speaking_seconds: number
  created_at: string
  audio_path: string | null
}

export interface TrialRow {
  user_id: string
  task_id: string
  used: number
  bonus: number
  updated_at: string | null
}

export interface GrantRow {
  user_id: string
  challenge_number: number
}

export interface RawStudentData {
  profiles: ProfileRow[]
  challenges: Challenge[]
  views: VideoViewRow[]
  submissions: SubmissionRow[]
  notes: NoteRow[]
  progress: ProgressRow[]
  conversations: ConversationRow[]
  turns: TurnRow[]
  trials: TrialRow[]
  skips: GrantRow[]
  unlocks: GrantRow[]
}

// ---------------------------------------------------------------------------
// Aggregated shapes (what the UI reads)
// ---------------------------------------------------------------------------

export interface VideoProgress {
  title: string
  uid: string
  percent: number
  watched: boolean
  lastOpened: string | null
}

export type ChallengeStatus = 'not-started' | 'in-progress' | 'completed'

export interface StudentChallenge {
  id: string
  number: number
  title: string
  status: ChallengeStatus
  completedAt: string | null
  videos: VideoProgress[]
  avgWatched: number
  speakingTaskCount: number
  submissions: SubmissionRow[]
  /** Best score among this challenge's submissions, when any. */
  bestScore: number | null
  speakingPassed: boolean
  notes: string[]
  notesUpdatedAt: string | null
  /** Admin grants that apply to this challenge. */
  unlocked: boolean
  cooldownSkipped: boolean
}

export interface EmmaConversation extends ConversationRow {
  turns: TurnRow[]
  /** Corrections Emma made across the turns (turns with a `correction`). */
  corrections: number
}

export type SubscriptionState = 'active' | 'expiring' | 'expired' | 'none'
export type LevelTestState = 'none' | 'passed' | 'failed'

export interface ActivityEvent {
  at: number
  kind: 'video' | 'speaking' | 'level-test' | 'note' | 'completed' | 'emma' | 'joined'
  label: string
  detail?: string
}

export interface StudentStats {
  completed: number
  totalChallenges: number
  /** Number of the highest challenge the student is currently working on. */
  currentChallenge: number | null
  videosWatched: number
  videoCount: number
  avgWatched: number
  speaking: number
  speakingPassed: number
  avgScore: number | null
  bestScore: number | null
  noteWords: number
  emmaSessions: number
  emmaCompleted: number
  emmaMinutes: number
  emmaCorrections: number
  lastActive: number | null
  /** Days since last activity, null when never active. */
  inactiveDays: number | null
  /** Level-test speaking result. */
  levelTest: LevelTestState
  /** 0–100: challenges completed weighted with partial video progress. */
  overallPct: number
}

export interface StudentRecord {
  id: string
  name: string
  phone: string | null
  job: string | null
  university: string | null
  code: string | null
  redeemedAt: string | null
  createdAt: string | null
  joinedAt: number | null
  /** Days left on the 100-day subscription; negative once expired. */
  daysLeft: number | null
  subscription: SubscriptionState
  emmaGiftClaimedAt: string | null
  levelTestSubmissions: SubmissionRow[]
  challenges: StudentChallenge[]
  emma: EmmaConversation[]
  trials: TrialRow[]
  skips: number[]
  unlocks: number[]
  timeline: ActivityEvent[]
  stats: StudentStats
  /** True when the student has been idle for INACTIVE_DAYS+ (and had started). */
  atRisk: boolean
  /** Cooldown info for the next challenge, when it is currently locked by time. */
  nextUnlock: { number: number; daysLeft: number } | null
}

export interface StudentsCohort {
  students: StudentRecord[]
  challenges: Challenge[]
  totals: {
    students: number
    active: number
    subscribed: number
    atRisk: number
    completions: number
    speaking: number
    emmaSessions: number
    avgProgress: number
  }
  /** Tables that failed to load (missing migrations etc.), for a soft warning. */
  warnings: string[]
  loadedAt: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Activity label the client writes to localStorage `x50_user` ("name - job"). */
export function studentLabel(p: { name?: string | null; job?: string | null }): string {
  const name = (p.name ?? '').trim()
  const job = (p.job ?? '').trim()
  if (!name && !job) return ''
  return `${name} - ${job}`.trim()
}

const ms = (s: string | null | undefined): number | null => {
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isNaN(t) ? null : t
}

function daysSince(iso: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000)
}

/** Human "3d ago" style label for an epoch timestamp. */
export function relativeTime(ts: number | null, nowMs = Date.now()): string {
  if (ts === null) return 'never'
  const mins = Math.floor((nowMs - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.floor(days / 365)}y ago`
}

/** Server-side trial key for a challenge task (mirrors lib/progress.serverTaskKey). */
export function trialTaskKey(challengeId: string, taskIndex = 0): string {
  return taskIndex > 0 ? `challenge_${challengeId}#${taskIndex}` : `challenge_${challengeId}`
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function buildStudents(raw: RawStudentData, nowMs = Date.now()): StudentsCohort {
  const challenges = [...raw.challenges].sort((a, b) => a.number - b.number)
  const challengeNumbers = challenges.map((c) => c.number)

  // Label → user_id index for the label-keyed activity tables.
  const idByLabel = new Map<string, string>()
  for (const p of raw.profiles) {
    const label = studentLabel(p)
    if (label && !idByLabel.has(label)) idByLabel.set(label, p.user_id)
    const name = (p.name ?? '').trim()
    const phone = (p.phone ?? '').trim()
    if (name && phone) {
      const legacy = `${name} - ${phone}`
      if (!idByLabel.has(legacy)) idByLabel.set(legacy, p.user_id)
    }
  }
  // Bare-name fallback only when the name is unambiguous.
  const nameCounts = new Map<string, number>()
  for (const p of raw.profiles) {
    const name = (p.name ?? '').trim()
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  for (const p of raw.profiles) {
    const name = (p.name ?? '').trim()
    if (name && nameCounts.get(name) === 1 && !idByLabel.has(name)) idByLabel.set(name, p.user_id)
  }
  const resolve = (label: string | null | undefined): string | null => {
    if (!label) return null
    const t = label.trim()
    return idByLabel.get(t) ?? null
  }

  // Bucket every row under its user_id.
  const viewsBy = new Map<string, VideoViewRow[]>()
  for (const v of raw.views) {
    const id = resolve(v.student)
    if (!id) continue
    ;(viewsBy.get(id) ?? viewsBy.set(id, []).get(id)!).push(v)
  }
  const subsBy = new Map<string, SubmissionRow[]>()
  for (const s of raw.submissions) {
    const id = s.user_id ?? resolve(s.student)
    if (!id) continue
    ;(subsBy.get(id) ?? subsBy.set(id, []).get(id)!).push(s)
  }
  const notesBy = new Map<string, NoteRow[]>()
  for (const n of raw.notes) {
    const id = n.user_id ?? resolve(n.student)
    if (!id) continue
    ;(notesBy.get(id) ?? notesBy.set(id, []).get(id)!).push(n)
  }
  const progressBy = new Map<string, Map<number, string | null>>()
  for (const r of raw.progress) {
    const m = progressBy.get(r.user_id) ?? progressBy.set(r.user_id, new Map()).get(r.user_id)!
    m.set(r.challenge_number, r.completed_at)
  }
  const turnsByConv = new Map<string, TurnRow[]>()
  for (const t of raw.turns) {
    if (!t.conversation_id) continue
    ;(turnsByConv.get(t.conversation_id) ?? turnsByConv.set(t.conversation_id, []).get(t.conversation_id)!).push(t)
  }
  const convsBy = new Map<string, ConversationRow[]>()
  for (const c of raw.conversations) {
    ;(convsBy.get(c.user_id) ?? convsBy.set(c.user_id, []).get(c.user_id)!).push(c)
  }
  const trialsBy = new Map<string, TrialRow[]>()
  for (const t of raw.trials) {
    ;(trialsBy.get(t.user_id) ?? trialsBy.set(t.user_id, []).get(t.user_id)!).push(t)
  }
  const skipsBy = new Map<string, number[]>()
  for (const g of raw.skips) (skipsBy.get(g.user_id) ?? skipsBy.set(g.user_id, []).get(g.user_id)!).push(g.challenge_number)
  const unlocksBy = new Map<string, number[]>()
  for (const g of raw.unlocks) (unlocksBy.get(g.user_id) ?? unlocksBy.set(g.user_id, []).get(g.user_id)!).push(g.challenge_number)

  const students: StudentRecord[] = raw.profiles.map((p) => {
    const id = p.user_id
    const views = viewsBy.get(id) ?? []
    const subs = subsBy.get(id) ?? []
    const notes = notesBy.get(id) ?? []
    const progress = progressBy.get(id) ?? new Map<number, string | null>()
    const skips = skipsBy.get(id) ?? []
    const unlocks = unlocksBy.get(id) ?? []

    // Furthest watched percent + last open per video uid.
    const pctByUid = new Map<string, number>()
    const openedByUid = new Map<string, number>()
    for (const v of views) {
      if (!v.video_id) continue
      pctByUid.set(v.video_id, Math.max(pctByUid.get(v.video_id) ?? 0, v.watched_percent ?? 0))
      const t = ms(v.opened_at)
      if (t !== null) openedByUid.set(v.video_id, Math.max(openedByUid.get(v.video_id) ?? 0, t))
    }

    const subsByNum = new Map<number, SubmissionRow[]>()
    const levelTestSubmissions: SubmissionRow[] = []
    for (const s of subs) {
      if (s.challenge_number == null) levelTestSubmissions.push(s)
      else (subsByNum.get(s.challenge_number) ?? subsByNum.set(s.challenge_number, []).get(s.challenge_number)!).push(s)
    }
    const byDateDesc = (a: SubmissionRow, b: SubmissionRow) =>
      (ms(b.created_at) ?? 0) - (ms(a.created_at) ?? 0)
    levelTestSubmissions.sort(byDateDesc)

    const notesByNum = new Map<number, NoteRow>()
    for (const n of notes) {
      if (n.challenge_number == null) continue
      const prev = notesByNum.get(n.challenge_number)
      if (!prev || (ms(n.updated_at) ?? 0) > (ms(prev.updated_at) ?? 0)) notesByNum.set(n.challenge_number, n)
    }

    const timeline: ActivityEvent[] = []
    const joinedAt = ms(p.code_redeemed_at) ?? ms(p.created_at)
    if (joinedAt !== null) timeline.push({ at: joinedAt, kind: 'joined', label: p.code_redeemed_at ? 'Redeemed a code' : 'Created an account' })

    const studentChallenges: StudentChallenge[] = challenges.map((c) => {
      const vids = challengeVideos(c).map((v, i): VideoProgress => {
        const percent = pctByUid.get(v.uid) ?? 0
        const opened = openedByUid.get(v.uid) ?? null
        return {
          title: v.title || `Video ${i + 1}`,
          uid: v.uid,
          percent,
          watched: percent >= VIDEO_WATCHED_PCT,
          lastOpened: opened ? new Date(opened).toISOString() : null,
        }
      })
      const cSubs = (subsByNum.get(c.number) ?? []).sort(byDateDesc)
      const note = notesByNum.get(c.number)
      const noteWords = note?.entries ?? []
      const completedAt = progress.has(c.number) ? (progress.get(c.number) ?? null) : null
      const completed = progress.has(c.number)
      const touched = vids.some((v) => v.percent > 0) || cSubs.length > 0 || noteWords.length > 0
      const scores = cSubs.map((s) => s.score).filter((n): n is number => typeof n === 'number')
      const avgWatched = vids.length ? Math.round(vids.reduce((m, v) => m + v.percent, 0) / vids.length) : 0

      for (const v of vids) {
        const t = openedByUid.get(v.uid)
        if (t) timeline.push({ at: t, kind: 'video', label: `Watched ${v.title}`, detail: `Challenge ${c.number} · ${v.percent}%` })
      }
      for (const s of cSubs) {
        const t = ms(s.created_at)
        if (t !== null)
          timeline.push({
            at: t,
            kind: 'speaking',
            label: `Speaking task · Challenge ${c.number}`,
            detail: `${s.passed ? 'Passed' : 'Not passed'} · ${s.score ?? 0}%`,
          })
      }
      if (note) {
        const t = ms(note.updated_at)
        if (t !== null) timeline.push({ at: t, kind: 'note', label: `Saved ${noteWords.length} vocabulary words`, detail: `Challenge ${c.number}` })
      }
      if (completed) {
        const t = ms(completedAt)
        if (t !== null) timeline.push({ at: t, kind: 'completed', label: `Completed Challenge ${c.number}`, detail: c.title ?? undefined })
      }

      return {
        id: c.id,
        number: c.number,
        title: c.title ?? '',
        status: completed ? 'completed' : touched ? 'in-progress' : 'not-started',
        completedAt,
        videos: vids,
        avgWatched,
        speakingTaskCount: challengeSpeakingTasks(c).length,
        submissions: cSubs,
        bestScore: scores.length ? Math.max(...scores) : null,
        speakingPassed: cSubs.some((s) => !!s.passed),
        notes: noteWords,
        notesUpdatedAt: note?.updated_at ?? null,
        unlocked: unlocks.includes(c.number),
        cooldownSkipped: skips.includes(c.number),
      }
    })

    for (const s of levelTestSubmissions) {
      const t = ms(s.created_at)
      if (t !== null)
        timeline.push({ at: t, kind: 'level-test', label: 'Level test', detail: `${s.passed ? 'Passed' : 'Not passed'} · ${s.score ?? 0}%` })
    }

    const emma: EmmaConversation[] = (convsBy.get(id) ?? [])
      .map((c) => {
        const turns = (turnsByConv.get(c.id) ?? []).sort((a, b) => (ms(a.created_at) ?? 0) - (ms(b.created_at) ?? 0))
        return { ...c, turns, corrections: turns.filter((t) => !!t.feedback?.correction).length }
      })
      .sort((a, b) => (ms(b.started_at) ?? 0) - (ms(a.started_at) ?? 0))
    for (const c of emma) {
      const t = ms(c.completed_at ?? c.started_at)
      if (t !== null)
        timeline.push({
          at: t,
          kind: 'emma',
          label: c.status === 'completed' ? 'Finished an Emma session' : 'Started an Emma session',
          detail: `${Math.round(c.speaking_seconds / 60)} min · ${c.scenario}`,
        })
    }

    timeline.sort((a, b) => b.at - a.at)

    // Stats -----------------------------------------------------------------
    const allVideos = studentChallenges.flatMap((c) => c.videos)
    const challengeSubs = studentChallenges.flatMap((c) => c.submissions)
    const scores = challengeSubs.map((s) => s.score).filter((n): n is number => typeof n === 'number')
    const completedCount = studentChallenges.filter((c) => c.status === 'completed').length
    const activityTimes = timeline.filter((e) => e.kind !== 'joined').map((e) => e.at)
    const lastActive = activityTimes.length ? Math.max(...activityTimes) : null
    const inactiveDays = lastActive === null ? null : Math.floor((nowMs - lastActive) / 86_400_000)

    const inProgress = studentChallenges.find((c) => c.status === 'in-progress')
    const lastCompleted = [...studentChallenges].reverse().find((c) => c.status === 'completed')
    let currentChallenge: number | null = inProgress?.number ?? null
    if (currentChallenge === null && lastCompleted) {
      const idx = challengeNumbers.indexOf(lastCompleted.number)
      currentChallenge = idx >= 0 && idx + 1 < challengeNumbers.length ? challengeNumbers[idx + 1] : null
    }
    if (currentChallenge === null && !lastCompleted && challengeNumbers.length) currentChallenge = challengeNumbers[0]

    // Overall progress: each challenge is worth an equal share; a completed
    // one counts fully, an in-progress one counts by its video progress.
    const overallPct = challenges.length
      ? Math.round(
          (studentChallenges.reduce((m, c) => m + (c.status === 'completed' ? 100 : c.avgWatched * 0.8), 0) /
            (challenges.length * 100)) *
            100,
        )
      : 0

    // Next challenge cooldown (mirrors challengeLockState).
    let nextUnlock: StudentRecord['nextUnlock'] = null
    if (lastCompleted && lastCompleted.completedAt) {
      const idx = challengeNumbers.indexOf(lastCompleted.number)
      const nextNum = idx + 1 < challengeNumbers.length ? challengeNumbers[idx + 1] : null
      if (nextNum !== null && !progress.has(nextNum) && !unlocks.includes(nextNum) && !skips.includes(nextNum)) {
        const left = COOLDOWN_DAYS - daysSince(lastCompleted.completedAt, nowMs)
        if (left > 0) nextUnlock = { number: nextNum, daysLeft: left }
      }
    }

    const daysLeft = p.code_redeemed_at ? PROGRAM_DAYS - daysSince(p.code_redeemed_at, nowMs) : null
    const subscription: SubscriptionState =
      !p.code || daysLeft === null ? 'none' : daysLeft <= 0 ? 'expired' : daysLeft <= 10 ? 'expiring' : 'active'

    const stats: StudentStats = {
      completed: completedCount,
      totalChallenges: challenges.length,
      currentChallenge,
      videosWatched: allVideos.filter((v) => v.watched).length,
      videoCount: allVideos.length,
      avgWatched: allVideos.length ? Math.round(allVideos.reduce((m, v) => m + v.percent, 0) / allVideos.length) : 0,
      speaking: challengeSubs.length,
      speakingPassed: challengeSubs.filter((s) => !!s.passed).length,
      avgScore: scores.length ? Math.round(scores.reduce((m, n) => m + n, 0) / scores.length) : null,
      bestScore: scores.length ? Math.max(...scores) : null,
      noteWords: studentChallenges.reduce((m, c) => m + c.notes.length, 0),
      emmaSessions: emma.length,
      emmaCompleted: emma.filter((c) => c.status === 'completed').length,
      emmaMinutes: Math.round(emma.reduce((m, c) => m + (Number(c.speaking_seconds) || 0), 0) / 60),
      emmaCorrections: emma.reduce((m, c) => m + c.corrections, 0),
      lastActive,
      inactiveDays,
      levelTest:
        levelTestSubmissions.length === 0 ? 'none' : levelTestSubmissions.some((s) => s.passed) ? 'passed' : 'failed',
      overallPct: Math.min(100, overallPct),
    }

    return {
      id,
      name: (p.name ?? '').trim() || (p.phone ?? '').trim() || `Student ${id.slice(0, 6)}`,
      phone: p.phone?.trim() || null,
      job: p.job?.trim() || null,
      university: p.university?.trim() || null,
      code: p.code,
      redeemedAt: p.code_redeemed_at,
      createdAt: p.created_at,
      joinedAt,
      daysLeft,
      subscription,
      emmaGiftClaimedAt: p.emma_gift_claimed_at ?? null,
      levelTestSubmissions,
      challenges: studentChallenges,
      emma,
      trials: trialsBy.get(id) ?? [],
      skips,
      unlocks,
      timeline,
      stats,
      atRisk: subscription === 'active' && inactiveDays !== null && inactiveDays >= INACTIVE_DAYS,
      nextUnlock,
    }
  })

  students.sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  const active = students.filter((s) => s.stats.lastActive !== null).length
  return {
    students,
    challenges,
    totals: {
      students: students.length,
      active,
      subscribed: students.filter((s) => s.subscription === 'active' || s.subscription === 'expiring').length,
      atRisk: students.filter((s) => s.atRisk).length,
      completions: students.reduce((m, s) => m + s.stats.completed, 0),
      speaking: students.reduce((m, s) => m + s.stats.speaking, 0),
      emmaSessions: students.reduce((m, s) => m + s.stats.emmaSessions, 0),
      avgProgress: students.length
        ? Math.round(students.reduce((m, s) => m + s.stats.overallPct, 0) / students.length)
        : 0,
    },
    warnings: [],
    loadedAt: nowMs,
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

type Res<T> = { data: T[] | null; error: { message: string } | null }

/** Read a table, but treat a failure as "empty" and record a warning instead of throwing. */
async function optional<T>(label: string, q: PromiseLike<Res<T>>, warnings: string[]): Promise<T[]> {
  try {
    const { data, error } = await q
    if (error) {
      warnings.push(`${label}: ${error.message}`)
      return []
    }
    return data ?? []
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
}

export async function loadStudents(nowMs = Date.now()): Promise<StudentsCohort> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const db = supabase
  const warnings: string[] = []

  const [profilesRes, challengesRes] = await Promise.all([
    db
      .from('x50_students')
      .select('user_id, name, phone, job, university, code, code_redeemed_at, created_at, emma_gift_claimed_at'),
    db.from('x50_challenges').select('*').order('number', { ascending: true }),
  ])
  let profiles = (profilesRes.data as ProfileRow[] | null) ?? []
  if (profilesRes.error) {
    // emma_gift_claimed_at only exists once emma_gift.sql has been run.
    const retry = await db
      .from('x50_students')
      .select('user_id, name, phone, job, university, code, code_redeemed_at, created_at')
    if (retry.error) throw retry.error
    profiles = (retry.data as ProfileRow[] | null) ?? []
  }
  if (challengesRes.error) throw challengesRes.error

  const [views, submissions, notes, progress, conversations, turns, trials, skips, unlocks] = await Promise.all([
    optional<VideoViewRow>('Video views', db.from('x50_video_views').select('student, video_id, opened_at, watched_percent'), warnings),
    optional<SubmissionRow>('Speaking submissions', db.from('x50_submissions').select('*').order('created_at', { ascending: false }), warnings),
    optional<NoteRow>('Notes', db.from('x50_notes').select('user_id, student, challenge_number, entries, updated_at'), warnings),
    optional<ProgressRow>('Challenge progress', db.from('x50_challenge_progress').select('user_id, challenge_number, completed_at'), warnings),
    optional<ConversationRow>(
      'Emma conversations',
      db
        .from('x50_speaking_conversations')
        .select('id, user_id, scenario, level, status, speaking_seconds, goal_seconds, started_at, completed_at')
        .order('started_at', { ascending: false })
        .limit(2000),
      warnings,
    ),
    optional<TurnRow>(
      'Emma turns',
      db
        .from('x50_speaking_turns')
        .select('id, conversation_id, user_id, transcript, reply, feedback, speaking_seconds, created_at, audio_path')
        .order('created_at', { ascending: true })
        .limit(10000),
      warnings,
    ),
    optional<TrialRow>('Trials', db.from('x50_trials').select('user_id, task_id, used, bonus, updated_at'), warnings),
    optional<GrantRow>('Cooldown skips', db.from('x50_cooldown_skips').select('user_id, challenge_number'), warnings),
    optional<GrantRow>('Challenge unlocks', db.from('x50_challenge_unlocks').select('user_id, challenge_number'), warnings),
  ])

  const cohort = buildStudents(
    {
      profiles,
      challenges: (challengesRes.data as Challenge[] | null) ?? [],
      views,
      submissions,
      notes,
      progress,
      conversations,
      turns,
      trials,
      skips,
      unlocks,
    },
    nowMs,
  )
  cohort.warnings = warnings
  return cohort
}

// ---------------------------------------------------------------------------
// Admin actions (all rely on the admin RLS branch already granted per table)
// ---------------------------------------------------------------------------

type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (e: { message: string } | Error | null | undefined): ActionResult => ({
  ok: false,
  error: e?.message ?? 'Unknown error',
})

async function grantRow(table: string, userId: string, challengeNumber: number): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
  // ON CONFLICT DO NOTHING: re-granting an existing pair is a no-op (the
  // tables have no update policy, so a plain upsert would be refused).
  const { error } = await supabase
    .from(table)
    .upsert({ user_id: userId, challenge_number: challengeNumber }, { onConflict: 'user_id,challenge_number', ignoreDuplicates: true })
  return error ? fail(error) : { ok: true }
}

async function revokeRow(table: string, userId: string, challengeNumber: number): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
  const { error } = await supabase.from(table).delete().eq('user_id', userId).eq('challenge_number', challengeNumber)
  return error ? fail(error) : { ok: true }
}

/** Open a challenge outright for a student (ignores order + cooldown). */
export const unlockChallenge = (userId: string, n: number) => grantRow('x50_challenge_unlocks', userId, n)
export const revokeUnlock = (userId: string, n: number) => revokeRow('x50_challenge_unlocks', userId, n)
/** Waive the 5-day wait before a challenge (previous one must still be done). */
export const skipCooldown = (userId: string, n: number) => grantRow('x50_cooldown_skips', userId, n)
export const revokeSkip = (userId: string, n: number) => revokeRow('x50_cooldown_skips', userId, n)

/** Set the bonus attempts for a task (0 clears it). */
export async function setTrialBonus(userId: string, taskKey: string, bonus: number): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
  const { error } = await supabase.rpc('x50_grant_trials', {
    p_user: userId,
    p_task: taskKey,
    p_bonus: Math.min(Math.max(Math.round(bonus) || 0, 0), 50),
  })
  return error ? fail(error) : { ok: true }
}

/**
 * Mark the level test as passed without the student taking it: updates their
 * latest level-test row or inserts a synthetic, pre-passed one.
 */
export async function bypassLevelTest(student: StudentRecord): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' }
  const existing = student.levelTestSubmissions[0]
  const { error } = existing
    ? await supabase.from('x50_submissions').update({ passed: true, score: 100 }).eq('id', existing.id)
    : await supabase.from('x50_submissions').insert({
        challenge_id: null,
        challenge_number: null,
        user_id: student.id,
        student: student.name,
        question: 'Level Test — marked passed by admin',
        transcript: null,
        score: 100,
        passed: true,
        feedback: 'Marked as passed by an admin, without taking the test.',
        mistakes_json: '[]',
        vocabulary_json: '[]',
        strengths_json: '[]',
        weaknesses_json: '[]',
        corrected_sentences_json: '[]',
        audio_key: null,
      })
  return error ? fail(error) : { ok: true }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** CSV of the (filtered) student list for a spreadsheet. */
export function studentsToCsv(students: StudentRecord[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = [
    'Name',
    'Phone',
    'Job',
    'University',
    'Code',
    'Joined',
    'Days left',
    'Subscription',
    'Challenges completed',
    'Total challenges',
    'Current challenge',
    'Progress %',
    'Videos watched',
    'Avg watched %',
    'Speaking submissions',
    'Speaking passed',
    'Avg score',
    'Level test',
    'Emma sessions',
    'Emma completed',
    'Emma minutes',
    'Vocabulary words',
    'Last active',
  ]
  const rows = students.map((s) => [
    s.name,
    s.phone,
    s.job,
    s.university,
    s.code,
    s.joinedAt ? new Date(s.joinedAt).toISOString().slice(0, 10) : '',
    s.daysLeft ?? '',
    s.subscription,
    s.stats.completed,
    s.stats.totalChallenges,
    s.stats.currentChallenge ?? '',
    s.stats.overallPct,
    `${s.stats.videosWatched}/${s.stats.videoCount}`,
    s.stats.avgWatched,
    s.stats.speaking,
    s.stats.speakingPassed,
    s.stats.avgScore ?? '',
    s.stats.levelTest,
    s.stats.emmaSessions,
    s.stats.emmaCompleted,
    s.stats.emmaMinutes,
    s.stats.noteWords,
    s.stats.lastActive ? new Date(s.stats.lastActive).toISOString() : '',
  ])
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}
