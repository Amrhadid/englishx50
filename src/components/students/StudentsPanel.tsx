import { useEffect, useMemo, useState } from 'react'
import {
  loadStudents,
  relativeTime,
  studentsToCsv,
  type StudentRecord,
  type StudentsCohort,
} from '../../lib/students'
import StudentsDashboard from '../StudentsDashboard'
import StudentDetail from './StudentDetail'
import { Avatar, Badge, Empty, ProgressBar, Stat, SubscriptionBadge } from './ui'
import { BTN_GHOST, BTN_PRIMARY, FIELD, progressColor } from './format'

type View = 'students' | 'overview'
type Quick = 'all' | 'active' | 'at-risk' | 'not-started' | 'finished' | 'expiring' | 'expired'
type Sort =
  | 'name'
  | 'active-desc'
  | 'progress-desc'
  | 'progress-asc'
  | 'speaking-desc'
  | 'emma-desc'
  | 'score-desc'
  | 'joined-desc'
  | 'joined-asc'
  | 'days-left-asc'

const SORTS: [Sort, string][] = [
  ['active-desc', 'Recently active'],
  ['name', 'Name A → Z'],
  ['progress-desc', 'Most progress'],
  ['progress-asc', 'Least progress'],
  ['speaking-desc', 'Most speaking tasks'],
  ['emma-desc', 'Most Emma sessions'],
  ['score-desc', 'Highest average score'],
  ['joined-desc', 'Newest students'],
  ['joined-asc', 'Oldest students'],
  ['days-left-asc', 'Subscription ending soonest'],
]

const QUICK: [Quick, string][] = [
  ['all', 'All'],
  ['active', 'Active this week'],
  ['at-risk', 'At risk'],
  ['not-started', 'Not started'],
  ['finished', 'Finished all'],
  ['expiring', 'Expiring soon'],
  ['expired', 'Expired'],
]

const LABEL = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#9a9aa2]'

/**
 * Admin → Students. A searchable, filterable roster with per-student progress
 * at a glance; clicking a student opens the full profile (challenges, speaking
 * tasks, Emma sessions, notes and admin actions). The cohort "Overview"
 * dashboard lives behind a sub-tab.
 */
export default function StudentsPanel() {
  const [cohort, setCohort] = useState<StudentsCohort | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('students')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<Quick>('all')
  const [sort, setSort] = useState<Sort>('active-desc')
  const [more, setMore] = useState(false)
  const [levelTest, setLevelTest] = useState('all')
  const [speaking, setSpeaking] = useState('all')
  const [emma, setEmma] = useState('all')
  const [challengeNum, setChallengeNum] = useState('all')
  const [challengeState, setChallengeState] = useState('any')
  const [job, setJob] = useState('all')
  const [university, setUniversity] = useState('all')

  const load = () =>
    loadStudents()
      .then((next) => {
        setCohort(next)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load students'))
      .finally(() => setLoading(false))
  const refresh = () => {
    setLoading(true)
    load()
  }
  useEffect(() => {
    load()
  }, [])

  const jobs = useMemo(() => distinct(cohort?.students ?? [], (s) => s.job), [cohort])
  const universities = useMemo(() => distinct(cohort?.students ?? [], (s) => s.university), [cohort])

  const shown = useMemo(() => {
    if (!cohort) return []
    const q = search.trim().toLowerCase()
    const num = challengeNum === 'all' ? null : Number(challengeNum)
    const total = cohort.challenges.length

    const list = cohort.students.filter((s) => {
      const st = s.stats
      switch (quick) {
        case 'active':
          if (st.inactiveDays === null || st.inactiveDays > 7) return false
          break
        case 'at-risk':
          if (!s.atRisk) return false
          break
        case 'not-started':
          if (st.lastActive !== null) return false
          break
        case 'finished':
          if (total === 0 || st.completed < total) return false
          break
        case 'expiring':
          if (s.subscription !== 'expiring') return false
          break
        case 'expired':
          if (s.subscription !== 'expired') return false
          break
      }
      if (levelTest !== 'all' && st.levelTest !== levelTest) return false
      if (speaking === 'some' && st.speaking === 0) return false
      if (speaking === 'none' && st.speaking > 0) return false
      if (speaking === 'passed' && st.speakingPassed === 0) return false
      if (speaking === 'not-passed' && (st.speaking === 0 || st.speakingPassed > 0)) return false
      if (emma === 'some' && st.emmaSessions === 0) return false
      if (emma === 'none' && st.emmaSessions > 0) return false
      if (emma === 'completed' && st.emmaCompleted === 0) return false
      if (job !== 'all' && (s.job ?? '') !== job) return false
      if (university !== 'all' && (s.university ?? '') !== university) return false
      if (num !== null && challengeState !== 'any') {
        const c = s.challenges.find((x) => x.number === num)
        if (!c) return false
        if (challengeState === 'completed' && c.status !== 'completed') return false
        if (challengeState === 'started' && c.status !== 'in-progress') return false
        if (challengeState === 'not-started' && c.status !== 'not-started') return false
        if (challengeState === 'speaking' && c.submissions.length === 0) return false
        if (challengeState === 'speaking-passed' && !c.speakingPassed) return false
      }
      if (q) {
        const hay = [s.name, s.phone, s.job, s.university, s.code, s.id].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const byName = (a: StudentRecord, b: StudentRecord) => a.name.localeCompare(b.name, 'ar')
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'active-desc':
          return (b.stats.lastActive ?? 0) - (a.stats.lastActive ?? 0) || byName(a, b)
        case 'progress-desc':
          return b.stats.overallPct - a.stats.overallPct || b.stats.completed - a.stats.completed || byName(a, b)
        case 'progress-asc':
          return a.stats.overallPct - b.stats.overallPct || byName(a, b)
        case 'speaking-desc':
          return b.stats.speaking - a.stats.speaking || byName(a, b)
        case 'emma-desc':
          return b.stats.emmaSessions - a.stats.emmaSessions || b.stats.emmaMinutes - a.stats.emmaMinutes || byName(a, b)
        case 'score-desc':
          return (b.stats.avgScore ?? -1) - (a.stats.avgScore ?? -1) || byName(a, b)
        case 'joined-desc':
          return (b.joinedAt ?? 0) - (a.joinedAt ?? 0) || byName(a, b)
        case 'joined-asc':
          return (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || byName(a, b)
        case 'days-left-asc':
          return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || byName(a, b)
        default:
          return byName(a, b)
      }
    })
  }, [cohort, search, quick, sort, levelTest, speaking, emma, challengeNum, challengeState, job, university])

  const filtersActive =
    levelTest !== 'all' ||
    speaking !== 'all' ||
    emma !== 'all' ||
    challengeNum !== 'all' ||
    job !== 'all' ||
    university !== 'all'

  const resetFilters = () => {
    setSearch('')
    setQuick('all')
    setLevelTest('all')
    setSpeaking('all')
    setEmma('all')
    setChallengeNum('all')
    setChallengeState('any')
    setJob('all')
    setUniversity('all')
  }

  const exportCsv = () => {
    const blob = new Blob(['﻿' + studentsToCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `englishx50-students-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Drill-down ---------------------------------------------------------------
  const selected = selectedId && cohort ? cohort.students.find((s) => s.id === selectedId) ?? null : null
  if (selected && cohort) {
    const idx = shown.findIndex((s) => s.id === selected.id)
    return (
      <StudentDetail
        key={selected.id}
        student={selected}
        challenges={cohort.challenges}
        onBack={() => setSelectedId(null)}
        onChanged={load}
        prev={idx > 0 ? shown[idx - 1] : null}
        next={idx >= 0 && idx < shown.length - 1 ? shown[idx + 1] : null}
        onNavigate={(s) => setSelectedId(s.id)}
      />
    )
  }

  if (loading && !cohort) return <p className="text-sm text-[#9a9aa2]">Loading students…</p>

  if (error && !cohort)
    return (
      <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] p-4">
        <p className="text-sm font-bold text-[#B91C1C]">{error}</p>
        <button onClick={refresh} className={`${BTN_PRIMARY} mt-3`}>
          Retry
        </button>
      </div>
    )

  if (!cohort) return null
  const t = cohort.totals

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full bg-[#f4f3f7] p-1">
          {(
            [
              ['students', `Students (${t.students})`],
              ['overview', 'Cohort overview'],
            ] as [View, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                view === key ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#5b5670]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'students' && (
            <button onClick={exportCsv} disabled={shown.length === 0} className={BTN_GHOST}>
              ⬇ Export CSV
            </button>
          )}
          <button onClick={refresh} disabled={loading} className={BTN_GHOST}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {cohort.warnings.length > 0 && (
        <details className="rounded-xl border border-[#FDE9C8] bg-[#FFF8EC] px-3 py-2 text-xs text-[#A66A09]">
          <summary className="cursor-pointer font-bold">
            Some data could not be loaded ({cohort.warnings.length}) — numbers may be incomplete
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {cohort.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {view === 'overview' ? (
        <StudentsDashboard />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Students" value={t.students} sub={`${t.subscribed} subscribed`} />
            <Stat label="Active" value={t.active} sub="have any activity" tone="green" />
            <Stat label="At risk" value={t.atRisk} sub="idle 7+ days" tone={t.atRisk > 0 ? 'red' : 'gray'} />
            <Stat label="Avg progress" value={`${t.avgProgress}%`} sub="of the program" />
            <Stat label="Speaking tasks" value={t.speaking} sub={`${t.completions} challenges done`} tone="amber" />
            <Stat label="Emma sessions" value={t.emmaSessions} sub="conversations" tone="purple" />
          </div>

          {/* Toolbar */}
          <div className="space-y-3 rounded-2xl border border-[#f0ecf8] bg-[#faf9ff] p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, job, university or code…"
                aria-label="Search students"
                className={`${FIELD} flex-1`}
              />
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={FIELD} aria-label="Sort">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setMore((m) => !m)}
                className={`${BTN_GHOST} ${filtersActive ? 'border-[#534AB7] text-[#534AB7]' : ''}`}
              >
                {more ? 'Hide filters' : 'More filters'}
                {filtersActive ? ' •' : ''}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {QUICK.map(([v, l]) => {
                const count = quickCount(cohort, v)
                return (
                  <button
                    key={v}
                    onClick={() => setQuick(v)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      quick === v ? 'bg-[#534AB7] text-white' : 'bg-white text-[#5b5670] ring-1 ring-[#e8e0f0] hover:ring-[#534AB7]'
                    }`}
                  >
                    {l}
                    <span className={`ml-1.5 ${quick === v ? 'text-white/70' : 'text-[#9a9aa2]'}`}>{count}</span>
                  </button>
                )
              })}
              {(filtersActive || quick !== 'all' || search) && (
                <button onClick={resetFilters} className="ml-auto text-xs font-bold text-[#534AB7] hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {more && (
              <div className="grid gap-3 border-t border-[#ece8f5] pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={LABEL}>Level test</label>
                  <select value={levelTest} onChange={(e) => setLevelTest(e.target.value)} className={`${FIELD} w-full`}>
                    <option value="all">Any</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Taken · not passed</option>
                    <option value="none">Not taken</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Speaking tasks</label>
                  <select value={speaking} onChange={(e) => setSpeaking(e.target.value)} className={`${FIELD} w-full`}>
                    <option value="all">Any</option>
                    <option value="some">Submitted at least one</option>
                    <option value="passed">Passed at least one</option>
                    <option value="not-passed">Submitted · none passed</option>
                    <option value="none">Never submitted</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Emma sessions</label>
                  <select value={emma} onChange={(e) => setEmma(e.target.value)} className={`${FIELD} w-full`}>
                    <option value="all">Any</option>
                    <option value="some">Started at least one</option>
                    <option value="completed">Completed at least one</option>
                    <option value="none">Never used Emma</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Job</label>
                  <select value={job} onChange={(e) => setJob(e.target.value)} className={`${FIELD} w-full`}>
                    <option value="all">All jobs</option>
                    {jobs.map((j) => (
                      <option key={j} value={j}>
                        {j || '— not specified —'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Challenge</label>
                  <select
                    value={challengeNum}
                    onChange={(e) => {
                      setChallengeNum(e.target.value)
                      if (e.target.value === 'all') setChallengeState('any')
                    }}
                    className={`${FIELD} w-full`}
                  >
                    <option value="all">Any challenge</option>
                    {cohort.challenges.map((c) => (
                      <option key={c.id} value={c.number}>
                        #{c.number}
                        {c.title ? ` · ${c.title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>…with status</label>
                  <select
                    value={challengeState}
                    onChange={(e) => setChallengeState(e.target.value)}
                    disabled={challengeNum === 'all'}
                    className={`${FIELD} w-full disabled:opacity-50`}
                  >
                    <option value="any">Any status</option>
                    <option value="not-started">Not started</option>
                    <option value="started">Started · not finished</option>
                    <option value="completed">Completed</option>
                    <option value="speaking">Speaking submitted</option>
                    <option value="speaking-passed">Speaking passed</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>University</label>
                  <select value={university} onChange={(e) => setUniversity(e.target.value)} className={`${FIELD} w-full`}>
                    <option value="all">Any</option>
                    {universities.map((u) => (
                      <option key={u} value={u}>
                        {u || '— not specified —'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <p className="px-1 text-xs font-semibold text-[#9a9aa2]">
            Showing {shown.length} of {cohort.students.length} students · click a student to open their profile
          </p>

          {cohort.students.length === 0 ? (
            <Empty icon="👋" title="No students yet" hint="Students appear here once they sign in and redeem a code." />
          ) : shown.length === 0 ? (
            <Empty icon="🔍" title="No student matches these filters" />
          ) : (
            <StudentTable students={shown} onOpen={(s) => setSelectedId(s.id)} />
          )}
        </>
      )}
    </div>
  )
}

function quickCount(cohort: StudentsCohort, q: Quick): number {
  const total = cohort.challenges.length
  return cohort.students.filter((s) => {
    switch (q) {
      case 'active':
        return s.stats.inactiveDays !== null && s.stats.inactiveDays <= 7
      case 'at-risk':
        return s.atRisk
      case 'not-started':
        return s.stats.lastActive === null
      case 'finished':
        return total > 0 && s.stats.completed >= total
      case 'expiring':
        return s.subscription === 'expiring'
      case 'expired':
        return s.subscription === 'expired'
      default:
        return true
    }
  }).length
}

function distinct(students: StudentRecord[], pick: (s: StudentRecord) => string | null): string[] {
  const set = new Set<string>()
  for (const s of students) set.add(pick(s) ?? '')
  return [...set].sort((a, b) => a.localeCompare(b, 'ar'))
}

function StudentTable({ students, onOpen }: { students: StudentRecord[]; onOpen: (s: StudentRecord) => void }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-[#f0ecf8] md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
              <th className="px-4 py-3 font-bold">Student</th>
              <th className="px-3 py-3 font-bold">Progress</th>
              <th className="px-3 py-3 font-bold">Now on</th>
              <th className="px-3 py-3 font-bold">Speaking</th>
              <th className="px-3 py-3 font-bold">Emma</th>
              <th className="px-3 py-3 font-bold">Last active</th>
              <th className="px-3 py-3 font-bold">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpen(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(s)
                  }
                }}
                tabIndex={0}
                role="button"
                className="cursor-pointer border-b border-[#f5f2fb] transition last:border-0 hover:bg-[#faf9ff] focus:bg-[#faf9ff] focus:outline-none"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-bold text-[#111]">
                        <span className="truncate">{s.name}</span>
                        {s.atRisk && <Badge tone="red">At risk</Badge>}
                      </p>
                      <p className="truncate text-[11px] text-[#9a9aa2]" dir="ltr">
                        {[s.phone, s.job].filter(Boolean).join(' · ') || s.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="w-44 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={s.stats.overallPct} color={progressColor(s.stats.overallPct)} />
                    <span className="w-9 shrink-0 text-right text-xs font-extrabold text-[#534AB7]">{s.stats.overallPct}%</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#9a9aa2]">
                    {s.stats.completed}/{s.stats.totalChallenges} challenges · {s.stats.videosWatched}/{s.stats.videoCount} videos
                  </p>
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-[#5b5670]">
                  {s.stats.totalChallenges > 0 && s.stats.completed >= s.stats.totalChallenges ? (
                    <Badge tone="green">🎉 Finished</Badge>
                  ) : s.stats.currentChallenge != null ? (
                    <>
                      Challenge {s.stats.currentChallenge}
                      {s.nextUnlock && <p className="text-[11px] font-medium text-[#A66A09]">🔒 opens in {s.nextUnlock.daysLeft}d</p>}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-[#5b5670]">
                  {s.stats.speaking === 0 ? (
                    <span className="text-[#c0bdd0]">none</span>
                  ) : (
                    <>
                      <span className="text-[#0C7C62]">{s.stats.speakingPassed} passed</span> / {s.stats.speaking}
                      {s.stats.avgScore != null && <p className="text-[11px] font-medium text-[#9a9aa2]">avg {s.stats.avgScore}%</p>}
                    </>
                  )}
                  {s.stats.levelTest !== 'none' && (
                    <p className="text-[11px] font-medium text-[#9a9aa2]">
                      level test {s.stats.levelTest === 'passed' ? '✓' : '✗'}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-[#5b5670]">
                  {s.stats.emmaSessions === 0 ? (
                    <span className="text-[#c0bdd0]">none</span>
                  ) : (
                    <>
                      {s.stats.emmaCompleted}/{s.stats.emmaSessions} done
                      <p className="text-[11px] font-medium text-[#9a9aa2]">{s.stats.emmaMinutes} min spoken</p>
                    </>
                  )}
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-[#5b5670]">{relativeTime(s.stats.lastActive)}</td>
                <td className="px-3 py-3">
                  <SubscriptionBadge state={s.subscription} daysLeft={s.daysLeft} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className="w-full rounded-2xl border border-[#f0ecf8] bg-white p-3 text-left hover:bg-[#faf9ff]"
          >
            <div className="flex items-center gap-3">
              <Avatar name={s.name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold text-[#111]">
                  <span className="truncate">{s.name}</span>
                  {s.atRisk && <Badge tone="red">At risk</Badge>}
                </p>
                <p className="truncate text-[11px] text-[#9a9aa2]" dir="ltr">
                  {[s.phone, s.job].filter(Boolean).join(' · ')}
                </p>
              </div>
              <SubscriptionBadge state={s.subscription} daysLeft={s.daysLeft} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar pct={s.stats.overallPct} color={progressColor(s.stats.overallPct)} />
              <span className="w-9 shrink-0 text-right text-xs font-extrabold text-[#534AB7]">{s.stats.overallPct}%</span>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-[#9a9aa2]">
              <span>✅ {s.stats.completed}/{s.stats.totalChallenges}</span>
              <span>🎤 {s.stats.speakingPassed}/{s.stats.speaking}</span>
              <span>🗣️ {s.stats.emmaSessions} Emma</span>
              <span>🕒 {relativeTime(s.stats.lastActive)}</span>
            </p>
          </button>
        ))}
      </div>
    </>
  )
}
