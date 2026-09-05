import { describe, expect, it } from 'vitest'
import { buildStudents, studentsToCsv, type RawStudentData } from '../students'
import type { Challenge } from '../../types'

const DAY = 86_400_000
const NOW = new Date('2026-09-05T12:00:00Z').getTime()
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()

const challenge = (number: number, extra: Partial<Challenge> = {}): Challenge => ({
  id: `c${number}`,
  number,
  title: `Title ${number}`,
  video_url: null,
  pdf_url: null,
  speaking_task: null,
  videos: [{ title: `V${number}a`, uid: `v${number}a` }, { title: `V${number}b`, uid: `v${number}b` }],
  speaking_tasks: ['Talk about it'],
  is_locked: false,
  ...extra,
})

const empty = (): RawStudentData => ({
  profiles: [],
  challenges: [challenge(1), challenge(2), challenge(3)],
  views: [],
  submissions: [],
  notes: [],
  progress: [],
  conversations: [],
  turns: [],
  trials: [],
  skips: [],
  unlocks: [],
})

const sara = {
  user_id: 'u-sara',
  name: 'Sara',
  phone: '01000000000',
  job: 'Doctor',
  university: null,
  code: 'ABC',
  code_redeemed_at: ago(30),
  created_at: ago(31),
}

describe('buildStudents', () => {
  it('rolls up a student with mixed activity', () => {
    const raw = empty()
    raw.profiles = [sara]
    // Video views are keyed by the "name - job" label, not user_id.
    raw.views = [
      { student: 'Sara - Doctor', video_id: 'v1a', opened_at: ago(10), watched_percent: 100 },
      { student: 'Sara - Doctor', video_id: 'v1a', opened_at: ago(12), watched_percent: 40 },
      { student: 'Sara - Doctor', video_id: 'v1b', opened_at: ago(9), watched_percent: 95 },
      { student: 'Sara - Doctor', video_id: 'v2a', opened_at: ago(2), watched_percent: 50 },
    ]
    raw.submissions = [
      sub('s1', { user_id: 'u-sara', challenge_number: 1, score: 80, passed: true, created_at: ago(9) }),
      sub('s2', { user_id: null, student: 'Sara - Doctor', challenge_number: 1, score: 40, passed: false, created_at: ago(9.5) }),
      sub('lt', { user_id: 'u-sara', challenge_number: null, score: 70, passed: true, created_at: ago(20) }),
    ]
    raw.notes = [{ user_id: 'u-sara', student: null, challenge_number: 1, entries: ['apple', 'pear'], updated_at: ago(11) }]
    raw.progress = [{ user_id: 'u-sara', challenge_number: 1, completed_at: ago(8) }]
    raw.conversations = [
      { id: 'conv1', user_id: 'u-sara', scenario: 'daily', level: 'beginner', status: 'completed', speaking_seconds: 300, goal_seconds: 300, started_at: ago(3), completed_at: ago(3) },
      { id: 'conv2', user_id: 'u-sara', scenario: 'work', level: 'beginner', status: 'active', speaking_seconds: 60, goal_seconds: 300, started_at: ago(1), completed_at: null },
    ]
    raw.turns = [
      { id: 't1', conversation_id: 'conv1', user_id: 'u-sara', transcript: 'hi', reply: 'hello', feedback: { positive: 'good', correction: 'Hi there' }, speaking_seconds: 5, created_at: ago(3), audio_path: null },
      { id: 't2', conversation_id: 'conv1', user_id: 'u-sara', transcript: 'ok', reply: 'great', feedback: { positive: 'good' }, speaking_seconds: 5, created_at: ago(3), audio_path: null },
    ]
    raw.trials = [{ user_id: 'u-sara', task_id: 'level_test', used: 2, bonus: 1, updated_at: ago(20) }]
    raw.skips = [{ user_id: 'u-sara', challenge_number: 3 }]

    const { students, totals } = buildStudents(raw, NOW)
    expect(students).toHaveLength(1)
    const s = students[0]

    expect(s.name).toBe('Sara')
    expect(s.daysLeft).toBe(70)
    expect(s.subscription).toBe('active')

    // Challenge 1: completed, both videos watched, 2 submissions (one matched by label).
    const c1 = s.challenges[0]
    expect(c1.status).toBe('completed')
    expect(c1.videos.map((v) => v.percent)).toEqual([100, 95])
    expect(c1.videos.every((v) => v.watched)).toBe(true)
    expect(c1.submissions).toHaveLength(2)
    expect(c1.submissions[0].id).toBe('s1') // newest first
    expect(c1.bestScore).toBe(80)
    expect(c1.speakingPassed).toBe(true)
    expect(c1.notes).toEqual(['apple', 'pear'])

    // Challenge 2: in progress; 3: not started but cooldown-skipped.
    expect(s.challenges[1].status).toBe('in-progress')
    expect(s.challenges[1].avgWatched).toBe(25)
    expect(s.challenges[2].status).toBe('not-started')
    expect(s.challenges[2].cooldownSkipped).toBe(true)

    expect(s.stats.completed).toBe(1)
    expect(s.stats.currentChallenge).toBe(2)
    expect(s.stats.videosWatched).toBe(2)
    expect(s.stats.videoCount).toBe(6)
    expect(s.stats.speaking).toBe(2)
    expect(s.stats.speakingPassed).toBe(1)
    expect(s.stats.avgScore).toBe(60)
    expect(s.stats.levelTest).toBe('passed')
    expect(s.levelTestSubmissions).toHaveLength(1)
    expect(s.stats.emmaSessions).toBe(2)
    expect(s.stats.emmaCompleted).toBe(1)
    expect(s.stats.emmaMinutes).toBe(6)
    expect(s.stats.emmaCorrections).toBe(1)
    expect(s.emma[0].id).toBe('conv2') // newest first
    expect(s.emma[1].turns).toHaveLength(2)
    expect(s.stats.noteWords).toBe(2)
    expect(s.trials[0].bonus).toBe(1)
    expect(s.skips).toEqual([3])

    // Last activity is the Emma session started a day ago.
    expect(s.stats.inactiveDays).toBe(1)
    expect(s.atRisk).toBe(false)
    expect(s.timeline[0].kind).toBe('emma')
    expect(s.timeline[s.timeline.length - 1].kind).toBe('joined')

    // Challenge 2 is the next one; challenge 1 finished 8 days ago so no cooldown left.
    expect(s.nextUnlock).toBeNull()

    expect(totals.students).toBe(1)
    expect(totals.active).toBe(1)
    expect(totals.subscribed).toBe(1)
    expect(totals.emmaSessions).toBe(2)
  })

  it('flags idle subscribers as at risk and reports the cooldown', () => {
    const raw = empty()
    raw.profiles = [sara]
    raw.progress = [{ user_id: 'u-sara', challenge_number: 1, completed_at: ago(2) }]
    const { students, totals } = buildStudents(raw, NOW)
    const s = students[0]
    // Completed 2 days ago, cooldown is 5 days → 3 days left before challenge 2.
    expect(s.nextUnlock).toEqual({ number: 2, daysLeft: 3 })
    expect(s.atRisk).toBe(false)

    raw.progress = [{ user_id: 'u-sara', challenge_number: 1, completed_at: ago(9) }]
    const again = buildStudents(raw, NOW).students[0]
    expect(again.stats.inactiveDays).toBe(9)
    expect(again.atRisk).toBe(true)
    expect(again.nextUnlock).toBeNull()
    expect(totals.atRisk).toBe(0)
  })

  it('handles students with no activity, no code, or an expired code', () => {
    const raw = empty()
    raw.profiles = [
      { ...sara, user_id: 'u-none', name: 'Nobody', code: null, code_redeemed_at: null },
      { ...sara, user_id: 'u-old', name: 'Old', code_redeemed_at: ago(120) },
      { ...sara, user_id: 'u-soon', name: 'Soon', code_redeemed_at: ago(95) },
      { ...sara, user_id: 'u-blank', name: null, phone: '0123', code: null, code_redeemed_at: null },
    ]
    const { students } = buildStudents(raw, NOW)
    const by = (id: string) => students.find((s) => s.id === id)!
    expect(by('u-none').subscription).toBe('none')
    expect(by('u-none').stats.lastActive).toBeNull()
    expect(by('u-none').stats.currentChallenge).toBe(1)
    expect(by('u-none').atRisk).toBe(false)
    expect(by('u-old').subscription).toBe('expired')
    expect(by('u-old').daysLeft).toBe(-20)
    expect(by('u-soon').subscription).toBe('expiring')
    expect(by('u-blank').name).toBe('0123')
  })

  it('does not match a bare name when two students share it', () => {
    const raw = empty()
    raw.profiles = [
      { ...sara, user_id: 'a', name: 'Ali', job: 'Nurse' },
      { ...sara, user_id: 'b', name: 'Ali', job: 'Chef' },
    ]
    raw.views = [
      { student: 'Ali', video_id: 'v1a', opened_at: ago(1), watched_percent: 100 },
      { student: 'Ali - Chef', video_id: 'v1b', opened_at: ago(1), watched_percent: 100 },
    ]
    const { students } = buildStudents(raw, NOW)
    const a = students.find((s) => s.id === 'a')!
    const b = students.find((s) => s.id === 'b')!
    expect(a.stats.videosWatched).toBe(0)
    expect(b.stats.videosWatched).toBe(1)
  })

  it('exports a CSV with one row per student', () => {
    const raw = empty()
    raw.profiles = [{ ...sara, name: 'Sara, "The Doc"' }]
    const csv = studentsToCsv(buildStudents(raw, NOW).students)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].startsWith('Name,Phone,Job')).toBe(true)
    expect(lines[1].startsWith('"Sara, ""The Doc""",01000000000,Doctor')).toBe(true)
  })
})

function sub(
  id: string,
  o: Partial<RawStudentData['submissions'][number]>,
): RawStudentData['submissions'][number] {
  return {
    id,
    user_id: null,
    student: null,
    challenge_id: null,
    challenge_number: null,
    question: 'Q',
    transcript: 'T',
    score: null,
    passed: null,
    feedback: null,
    audio_key: null,
    created_at: ago(0),
    ...o,
  }
}
