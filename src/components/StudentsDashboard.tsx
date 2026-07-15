import { useEffect, useState } from 'react'
import { getStudentsDashboard, type StudentsDashboardData } from '../lib/dashboard'

const PURPLE = '#534AB7'
const GREEN = '#23C4A0'
const AMBER = '#F5A623'

/** Admin "Students → Overview": whole-cohort challenge + speaking progress. */
export default function StudentsDashboard() {
  const [data, setData] = useState<StudentsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const next = await getStudentsDashboard(Date.now())
      setData(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Manual refresh (a click handler, so setting state synchronously is fine).
  const refresh = () => {
    setLoading(true)
    setError(null)
    load()
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) return <p className="text-sm text-[#9a9aa2]">Loading dashboard…</p>

  if (error)
    return (
      <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] p-4">
        <p className="text-sm font-bold text-[#B91C1C]">{error}</p>
        <button
          onClick={refresh}
          className="mt-3 rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-bold text-white hover:bg-[#46409c]"
        >
          Retry
        </button>
      </div>
    )

  if (!data) return null

  const noStudents = data.totalStudents === 0
  const speakingChallenges = data.challenges.filter((c) => c.hasSpeaking)

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-[#111]">Students overview</h3>
          <p className="text-xs text-[#9a9aa2]">
            Whole-cohort progress across every challenge and the speaking tasks.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-xl border border-[#e8e0f0] px-4 py-2 text-sm font-bold text-[#5b5670] hover:bg-[#f4f3f7] disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {noStudents ? (
        <div className="rounded-2xl border border-[#f0ecf8] p-10 text-center">
          <p className="text-3xl">👋</p>
          <p className="mt-2 text-sm font-bold text-[#111]">No student activity yet</p>
          <p className="mt-1 text-sm text-[#9a9aa2]">
            Completion and speaking numbers will appear here as students work through the challenges.
          </p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Students"
              value={data.totalStudents}
              sub={
                data.enrolledStudents !== data.totalStudents
                  ? `${data.enrolledStudents} enrolled`
                  : 'tracked learners'
              }
            />
            <Kpi
              label="Active"
              value={data.activeStudents}
              sub={`${pct(data.activeStudents, data.totalStudents)}% started a challenge`}
            />
            <Kpi
              label="Avg completed"
              value={data.avgCompleted.toFixed(1)}
              sub={`of ${data.challengeCount} challenge${data.challengeCount === 1 ? '' : 's'}`}
            />
            <Kpi
              label="Did speaking"
              value={data.speaking.attemptedStudents}
              sub={`${data.speaking.attemptedPct}% of students · ${data.speaking.passedStudents} passed`}
            />
          </div>

          {/* Challenge completion funnel */}
          <section className="rounded-2xl border border-[#f0ecf8] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[#111]">Challenge completion</h4>
                <p className="text-xs text-[#9a9aa2]">
                  Students who finished each challenge (all videos + speaking tasks).
                </p>
              </div>
              <span className="hidden shrink-0 text-xs font-bold text-[#9a9aa2] sm:block">
                of {data.totalStudents} students
              </span>
            </div>

            {data.challenges.length === 0 ? (
              <p className="text-sm text-[#9a9aa2]">No challenges created yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.challenges.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-extrabold text-[#534AB7]">
                      #{String(c.number).padStart(2, '0')}
                    </span>
                    <span
                      className="hidden w-40 shrink-0 truncate text-xs font-semibold text-[#5b5670] sm:block"
                      title={c.title}
                      dir="ltr"
                    >
                      {c.title || '—'}
                    </span>
                    <Bar pct={c.completedPct} color={c.completedPct >= 100 ? GREEN : PURPLE} />
                    <span className="w-16 shrink-0 text-right text-xs font-bold text-[#111]">
                      {c.completed}
                      <span className="text-[#9a9aa2]">/{data.totalStudents}</span>
                    </span>
                    <span className="w-9 shrink-0 text-right text-xs font-extrabold text-[#534AB7]">
                      {c.completedPct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Speaking tasks */}
          <section className="rounded-2xl border border-[#f0ecf8] p-5">
            <div className="mb-4">
              <h4 className="font-extrabold text-[#111]">Speaking tasks</h4>
              <p className="text-xs text-[#9a9aa2]">
                {data.speaking.attemptedStudents} of {data.totalStudents} students submitted a
                speaking task · {data.speaking.passedStudents} passed at least one ·{' '}
                {data.speaking.totalSubmissions} total submissions
                {data.speaking.levelTestStudents > 0 && (
                  <> · {data.speaking.levelTestStudents} did the level test</>
                )}
              </p>
            </div>

            {speakingChallenges.length === 0 ? (
              <p className="text-sm text-[#9a9aa2]">No challenge has a speaking task yet.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#9a9aa2]">
                  <Legend color={GREEN} label="Passed" />
                  <Legend color={AMBER} label="Submitted · not passed" />
                </div>
                <div className="space-y-2.5">
                  {speakingChallenges.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs font-extrabold text-[#534AB7]">
                        #{String(c.number).padStart(2, '0')}
                      </span>
                      <StackedBar
                        total={data.totalStudents}
                        passed={c.speakingPassed}
                        submitted={c.speakingSubmitted}
                      />
                      <span className="w-24 shrink-0 text-right text-xs font-bold text-[#111]">
                        {c.speakingPassed}
                        <span className="text-[#9a9aa2]"> / {c.speakingSubmitted} did</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-2xl border border-[#f0ecf8] bg-[#faf9ff] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#9a9aa2]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#534AB7]">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-[#7a7596]">{sub}</p>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEEDFE]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}

/**
 * Speaking bar: green = passed, amber = submitted-but-not-passed, both as a share
 * of the whole cohort so bars are comparable across challenges.
 */
function StackedBar({
  total,
  passed,
  submitted,
}: {
  total: number
  passed: number
  submitted: number
}) {
  const passedPct = total > 0 ? Math.min(100, (passed / total) * 100) : 0
  const pendingPct = total > 0 ? Math.min(100 - passedPct, (Math.max(0, submitted - passed) / total) * 100) : 0
  return (
    <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEEDFE]">
      <div className="h-full transition-all" style={{ width: `${passedPct}%`, backgroundColor: GREEN }} />
      <div className="h-full transition-all" style={{ width: `${pendingPct}%`, backgroundColor: AMBER }} />
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
