import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { audioUrl } from '../../lib/audio'
import { parseSubmission } from '../../lib/grading'
import { relativeTime, type EmmaConversation, type StudentChallenge, type StudentRecord, type SubmissionRow } from '../../lib/students'
import type { Challenge } from '../../types'
import FeedbackView from '../FeedbackView'
import StudentActions from './StudentActions'
import { Avatar, Badge, Card, Empty, PassBadge, ProgressBar, SectionTitle, Stat, StatusBadge, SubscriptionBadge } from './ui'
import { BTN_GHOST, fmtDate, fmtDateTime, formatDuration, progressColor, whatsappLink, GREEN, PURPLE } from './format'

type Tab = 'overview' | 'challenges' | 'speaking' | 'emma' | 'notes' | 'actions'

const SCENARIO_LABEL: Record<string, string> = {
  introduce: 'Introduce Yourself',
  daily: 'My Daily Routine',
  weekend: 'My Weekend',
  family: 'Friends and Family',
  hobbies: 'Hobbies and Free Time',
  cooking: 'Food and Cooking',
  restaurant: 'At a Restaurant',
  shopping: 'Shopping for Clothes',
  airport: 'At the Airport',
  hotel: 'Hotel Check-in',
  directions: 'Asking for Directions',
  doctor: 'Visiting a Doctor',
  past: 'Talking About the Past',
  future: 'Future Plans',
  vacation: 'My Dream Vacation',
  interview: 'Job Interview',
  work: 'A Day at Work',
  meeting: 'Joining a Meeting',
  customer: "Solving a Customer's Problem",
  opinion: 'Expressing and Defending an Opinion',
}
const LEVEL_LABEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

/** Private bucket for Emma recordings — see supabase/speaking_audio.sql. */
const EMMA_AUDIO_BUCKET = 'x50-speaking-audio'
const EMMA_AUDIO_TTL = 60 * 60

const EVENT_ICON: Record<string, string> = {
  video: '🎬',
  speaking: '🎤',
  'level-test': '🧪',
  note: '📝',
  completed: '✅',
  emma: '🗣️',
  joined: '🎟️',
}

export default function StudentDetail({
  student: s,
  challenges,
  onBack,
  onChanged,
  prev,
  next,
  onNavigate,
}: {
  student: StudentRecord
  challenges: Challenge[]
  onBack: () => void
  /** Called after an admin action changed data, so the parent reloads. */
  onChanged: () => void
  prev: StudentRecord | null
  next: StudentRecord | null
  onNavigate: (s: StudentRecord) => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [copied, setCopied] = useState(false)

  const copyPhone = async () => {
    if (!s.phone) return
    try {
      await navigator.clipboard.writeText(s.phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'challenges', label: 'Challenges', count: s.stats.completed },
    { key: 'speaking', label: 'Speaking tasks', count: s.stats.speaking + s.levelTestSubmissions.length },
    { key: 'emma', label: 'Emma sessions', count: s.stats.emmaSessions },
    { key: 'notes', label: 'Vocabulary', count: s.stats.noteWords },
    { key: 'actions', label: 'Actions' },
  ]

  return (
    <div className="space-y-5">
      {/* Nav */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm font-bold text-[#534AB7] hover:underline">
          ← All students
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => prev && onNavigate(prev)} disabled={!prev} className={BTN_GHOST} title={prev?.name}>
            ← Prev
          </button>
          <button onClick={() => next && onNavigate(next)} disabled={!next} className={BTN_GHOST} title={next?.name}>
            Next →
          </button>
        </div>
      </div>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={s.name} size="lg" />
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-[#111]">
                {s.name}
                {s.atRisk && <Badge tone="red">At risk · idle {s.stats.inactiveDays}d</Badge>}
                {s.stats.totalChallenges > 0 && s.stats.completed >= s.stats.totalChallenges && (
                  <Badge tone="green">🎉 Finished the program</Badge>
                )}
              </h3>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#5b5670]">
                {s.job && <span>💼 {s.job}</span>}
                {s.university && <span>🎓 {s.university}</span>}
                {s.code && (
                  <span dir="ltr" className="font-mono">
                    🎟️ {s.code}
                  </span>
                )}
                <span>📅 Joined {fmtDate(s.redeemedAt ?? s.createdAt)}</span>
              </p>
              {s.phone && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="text-sm font-bold text-[#111]">
                    📞 {s.phone}
                  </span>
                  <a
                    href={whatsappLink(s.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[#E1F5EE] px-2.5 py-1 text-xs font-bold text-[#0C7C62] hover:bg-[#cdeee0]"
                  >
                    WhatsApp
                  </a>
                  <button onClick={copyPhone} className="rounded-lg bg-[#f0eff5] px-2.5 py-1 text-xs font-bold text-[#5b5670] hover:bg-[#e6e4ee]">
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SubscriptionBadge state={s.subscription} daysLeft={s.daysLeft} />
            {s.emmaGiftClaimedAt && <Badge tone="purple">🎁 Emma gift claimed</Badge>}
            <span className="text-[11px] font-semibold text-[#9a9aa2]">Last active {relativeTime(s.stats.lastActive)}</span>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-bold">
            <span className="text-[#5b5670]">Program progress</span>
            <span className="text-[#534AB7]">{s.stats.overallPct}%</span>
          </div>
          <ProgressBar pct={s.stats.overallPct} color={progressColor(s.stats.overallPct)} height="h-3" />
        </div>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Challenges" value={`${s.stats.completed}/${s.stats.totalChallenges}`} sub={s.stats.currentChallenge != null ? `now on #${s.stats.currentChallenge}` : 'completed'} />
        <Stat label="Videos" value={`${s.stats.videosWatched}/${s.stats.videoCount}`} sub={`${s.stats.avgWatched}% avg watched`} />
        <Stat
          label="Speaking"
          value={s.stats.speaking}
          sub={s.stats.speaking ? `${s.stats.speakingPassed} passed · avg ${s.stats.avgScore ?? 0}%` : 'no submissions'}
          tone="amber"
        />
        <Stat
          label="Level test"
          value={s.stats.levelTest === 'passed' ? 'Passed' : s.stats.levelTest === 'failed' ? 'Failed' : '—'}
          sub={s.levelTestSubmissions.length ? `${s.levelTestSubmissions.length} attempt${s.levelTestSubmissions.length === 1 ? '' : 's'}` : 'not taken'}
          tone={s.stats.levelTest === 'passed' ? 'green' : s.stats.levelTest === 'failed' ? 'red' : 'gray'}
        />
        <Stat label="Emma" value={s.stats.emmaCompleted} sub={`${s.stats.emmaSessions} session${s.stats.emmaSessions === 1 ? "" : "s"} · ${s.stats.emmaMinutes} min`} tone="green" />
        <Stat label="Vocabulary" value={s.stats.noteWords} sub="words saved" tone="gray" />
      </div>

      {/* Tabs */}
      <div className="-mx-5 flex gap-1 overflow-x-auto border-b border-[#f0ecf8] px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-bold transition ${
              tab === t.key ? 'border-[#534AB7] text-[#534AB7]' : 'border-transparent text-[#7a7596] hover:text-[#111]'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${tab === t.key ? 'bg-[#EEEDFE]' : 'bg-[#f0eff5] text-[#9a9aa2]'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab s={s} onOpenTab={setTab} />}
      {tab === 'challenges' && <ChallengesTab s={s} />}
      {tab === 'speaking' && <SpeakingTab s={s} />}
      {tab === 'emma' && <EmmaTab s={s} />}
      {tab === 'notes' && <NotesTab s={s} />}
      {tab === 'actions' && <StudentActions student={s} challenges={challenges} onChanged={onChanged} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ s, onOpenTab }: { s: StudentRecord; onOpenTab: (t: Tab) => void }) {
  const recent = s.timeline.slice(0, 12)
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <Card className="p-5">
          <SectionTitle hint={`${s.stats.completed} of ${s.stats.totalChallenges} completed`}>Challenge map</SectionTitle>
          {s.challenges.length === 0 ? (
            <p className="text-sm text-[#9a9aa2]">No challenges created yet.</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
              {s.challenges.map((c) => {
                const bg =
                  c.status === 'completed' ? GREEN : c.status === 'in-progress' ? '#F5A623' : '#EEEDFE'
                const fg = c.status === 'not-started' ? '#8b86a8' : '#fff'
                return (
                  <button
                    key={c.id}
                    onClick={() => onOpenTab('challenges')}
                    title={`Challenge ${c.number}${c.title ? ` · ${c.title}` : ''} — ${c.status.replace('-', ' ')}${
                      c.status === 'in-progress' ? ` (${c.avgWatched}% watched)` : ''
                    }`}
                    className="relative flex aspect-square items-center justify-center rounded-xl text-xs font-extrabold transition hover:scale-105"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    {c.number}
                    {(c.unlocked || c.cooldownSkipped) && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-white text-[10px] shadow" title={c.unlocked ? 'Unlocked by admin' : 'Cooldown skipped'}>
                        🔓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-bold text-[#9a9aa2]">
            <LegendDot color={GREEN} label="Completed" />
            <LegendDot color="#F5A623" label="In progress" />
            <LegendDot color="#EEEDFE" label="Not started" />
          </div>
          {s.nextUnlock && (
            <p className="mt-3 rounded-xl bg-[#FFF8EC] px-3 py-2 text-xs font-semibold text-[#A66A09]">
              🔒 Challenge {s.nextUnlock.number} unlocks in {s.nextUnlock.daysLeft} day{s.nextUnlock.daysLeft === 1 ? '' : 's'} (cooldown).{' '}
              <button onClick={() => onOpenTab('actions')} className="underline">
                Skip it
              </button>
            </p>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Speaking performance</SectionTitle>
          {s.stats.speaking === 0 && s.levelTestSubmissions.length === 0 ? (
            <p className="text-sm text-[#9a9aa2]">No speaking submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {s.levelTestSubmissions.length > 0 && (
                <ScoreRow label="Level test" score={s.levelTestSubmissions[0].score} passed={!!s.levelTestSubmissions[0].passed} />
              )}
              {s.challenges
                .filter((c) => c.submissions.length > 0)
                .map((c) => (
                  <ScoreRow key={c.id} label={`Challenge ${c.number}`} score={c.bestScore} passed={c.speakingPassed} attempts={c.submissions.length} />
                ))}
            </div>
          )}
          {s.stats.speaking > 0 && (
            <button onClick={() => onOpenTab('speaking')} className="mt-3 text-xs font-bold text-[#534AB7] hover:underline">
              Listen to every submission →
            </button>
          )}
        </Card>
      </div>

      <div className="space-y-5 lg:col-span-2">
        <Card className="p-5">
          <SectionTitle hint={recent.length ? relativeTime(recent[0].at) : undefined}>Recent activity</SectionTitle>
          {recent.length === 0 ? (
            <p className="text-sm text-[#9a9aa2]">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {recent.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#faf9ff] text-sm ring-1 ring-[#f0ecf8]">
                    {EVENT_ICON[e.kind] ?? '•'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#111]">{e.label}</p>
                    <p className="text-[11px] text-[#9a9aa2]">
                      {e.detail ? `${e.detail} · ` : ''}
                      {fmtDateTime(new Date(e.at).toISOString())}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Emma</SectionTitle>
          {s.emma.length === 0 ? (
            <p className="text-sm text-[#9a9aa2]">Hasn't talked to Emma yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat value={s.stats.emmaCompleted} label="finished" />
                <MiniStat value={s.stats.emmaMinutes} label="minutes" />
                <MiniStat value={s.stats.emmaCorrections} label="corrections" />
              </div>
              <p className="mt-3 text-[11px] font-semibold text-[#9a9aa2]">
                Last session {relativeTime(new Date(s.emma[0].started_at).getTime())} · {SCENARIO_LABEL[s.emma[0].scenario] ?? s.emma[0].scenario}
              </p>
              <button onClick={() => onOpenTab('emma')} className="mt-2 text-xs font-bold text-[#534AB7] hover:underline">
                Read the conversations →
              </button>
            </>
          )}
        </Card>

        {(s.unlocks.length > 0 || s.skips.length > 0 || s.trials.some((t) => t.bonus > 0)) && (
          <Card className="p-5">
            <SectionTitle>Admin grants</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {s.unlocks.map((n) => (
                <Badge key={`u${n}`} tone="purple">
                  🔓 Unlocked #{n}
                </Badge>
              ))}
              {s.skips.map((n) => (
                <Badge key={`s${n}`} tone="blue">
                  ⏩ No cooldown #{n}
                </Badge>
              ))}
              {s.trials
                .filter((t) => t.bonus > 0)
                .map((t) => (
                  <Badge key={t.task_id} tone="amber">
                    +{t.bonus} trials · {t.task_id === 'level_test' ? 'level test' : t.task_id}
                  </Badge>
                ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-[#faf9ff] py-2">
      <p className="text-lg font-extrabold text-[#534AB7]">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a9aa2]">{label}</p>
    </div>
  )
}

function ScoreRow({ label, score, passed, attempts }: { label: string; score: number | null; passed: boolean; attempts?: number }) {
  const v = score ?? 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-bold text-[#5b5670]">{label}</span>
      <ProgressBar pct={v} color={passed ? GREEN : v >= 50 ? '#F5A623' : '#E5484D'} />
      <span className="w-10 shrink-0 text-right text-xs font-extrabold text-[#111]">{v}%</span>
      <span className="w-14 shrink-0 text-right text-[11px] text-[#9a9aa2]">{attempts ? `${attempts}×` : ''}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

function ChallengesTab({ s }: { s: StudentRecord }) {
  const [open, setOpen] = useState<string | null>(() => s.challenges.find((c) => c.status === 'in-progress')?.id ?? null)
  const [filter, setFilter] = useState<'all' | 'touched'>('touched')
  const list = filter === 'all' ? s.challenges : s.challenges.filter((c) => c.status !== 'not-started')

  if (s.challenges.length === 0) return <Empty title="No challenges created yet" />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(
          [
            ['touched', 'Started or completed'],
            ['all', 'All challenges'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${filter === v ? 'bg-[#534AB7] text-white' : 'bg-[#f4f3f7] text-[#5b5670]'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon="🚀" title="Hasn't started any challenge yet" />
      ) : (
        list.map((c) => <ChallengeCard key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />)
      )}
    </div>
  )
}

function ChallengeCard({ c, open, onToggle }: { c: StudentChallenge; open: boolean; onToggle: () => void }) {
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#faf9ff]">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white"
          style={{ backgroundColor: c.status === 'completed' ? GREEN : c.status === 'in-progress' ? '#F5A623' : '#C9C6D8' }}
        >
          {c.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#111]">{c.title || `Challenge ${c.number}`}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-[#9a9aa2]">
            {c.videos.length > 0 && <span>🎬 {c.videos.filter((v) => v.watched).length}/{c.videos.length} videos · {c.avgWatched}%</span>}
            <span>
              🎤 {c.submissions.length}/{c.speakingTaskCount || 0} task{c.speakingTaskCount === 1 ? '' : 's'}
              {c.bestScore != null ? ` · best ${c.bestScore}%` : ''}
            </span>
            <span>📝 {c.notes.length} words</span>
            {c.completedAt && <span>✅ {fmtDate(c.completedAt)}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {c.unlocked && <Badge tone="purple">🔓</Badge>}
          {c.cooldownSkipped && <Badge tone="blue">⏩</Badge>}
          <StatusBadge status={c.status} />
          <span className="text-[#534AB7]">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#f0ecf8] p-4">
          {c.videos.length > 0 && (
            <section>
              <SectionTitle>Videos</SectionTitle>
              <div className="space-y-2">
                {c.videos.map((v) => (
                  <div key={v.uid} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs font-semibold text-[#5b5670]" dir="ltr" title={v.title}>
                      {v.title}
                    </span>
                    <ProgressBar pct={v.percent} color={v.watched ? GREEN : PURPLE} />
                    <span className="w-10 shrink-0 text-right text-xs font-bold text-[#534AB7]">{v.percent}%</span>
                    <span className="hidden w-24 shrink-0 text-right text-[11px] text-[#9a9aa2] sm:block">
                      {v.lastOpened ? relativeTime(new Date(v.lastOpened).getTime()) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle hint={c.speakingTaskCount ? `${c.speakingTaskCount} task${c.speakingTaskCount === 1 ? '' : 's'} in this challenge` : undefined}>
              Speaking
            </SectionTitle>
            {c.submissions.length === 0 ? (
              <p className="text-sm text-[#9a9aa2]">No speaking submission yet.</p>
            ) : (
              <div className="space-y-3">
                {c.submissions.map((sub) => (
                  <SubmissionCard key={sub.id} sub={sub} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle hint={c.notesUpdatedAt ? `updated ${fmtDate(c.notesUpdatedAt)}` : undefined}>Vocabulary notes</SectionTitle>
            {c.notes.length === 0 ? (
              <p className="text-sm text-[#9a9aa2]">No notes saved.</p>
            ) : (
              <WordChips words={c.notes} />
            )}
          </section>
        </div>
      )}
    </Card>
  )
}

function WordChips({ words }: { words: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" dir="ltr">
      {words.map((w, i) => (
        <span key={i} className="rounded-lg bg-[#f1edff] px-2.5 py-1 text-[13px] font-semibold text-[#473BBE]">
          {w}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Speaking tasks
// ---------------------------------------------------------------------------

function SubmissionCard({ sub, title }: { sub: SubmissionRow; title?: string }) {
  const [showFeedback, setShowFeedback] = useState(false)
  return (
    <div className="rounded-xl border border-[#f0ecf8] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {title && <p className="truncate text-sm font-bold text-[#111]">{title}</p>}
          <p className="text-[11px] font-bold text-[#9a9aa2]">{fmtDateTime(sub.created_at)}</p>
        </div>
        <PassBadge passed={sub.passed} score={sub.score} />
      </div>
      {sub.question && (
        <p className="mb-2 text-xs text-[#7a7596]" dir="ltr">
          <span className="font-bold">Task:</span> {sub.question}
        </p>
      )}
      {sub.audio_key ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <audio controls preload="none" src={audioUrl(sub.audio_key)} className="h-9 w-full max-w-sm" />
          <a href={audioUrl(sub.audio_key, { download: true })} className="rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7]">
            ⬇ Download
          </a>
        </div>
      ) : (
        <p className="mb-2 text-[11px] italic text-[#c0bdd0]">No recording stored for this attempt.</p>
      )}
      {sub.transcript && (
        <p className="mb-2 rounded-lg bg-[#faf9ff] p-2.5 text-[13px] leading-relaxed text-[#3a3550]" dir="ltr">
          “{sub.transcript}”
        </p>
      )}
      {sub.feedback != null && (
        <>
          <button onClick={() => setShowFeedback((v) => !v)} className="text-xs font-bold text-[#534AB7] hover:underline">
            {showFeedback ? 'Hide AI feedback' : 'View AI feedback'}
          </button>
          {showFeedback && (
            <div className="mt-2">
              <FeedbackView result={parseSubmission(sub as Record<string, unknown>)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SpeakingTab({ s }: { s: StudentRecord }) {
  const [only, setOnly] = useState<'all' | 'passed' | 'failed'>('all')
  const items = useMemo(() => {
    const list: { sub: SubmissionRow; title: string }[] = []
    for (const sub of s.levelTestSubmissions) list.push({ sub, title: 'Level test' })
    for (const c of s.challenges) for (const sub of c.submissions) list.push({ sub, title: `Challenge ${c.number}${c.title ? ` · ${c.title}` : ''}` })
    list.sort((a, b) => new Date(b.sub.created_at).getTime() - new Date(a.sub.created_at).getTime())
    return list.filter((x) => (only === 'all' ? true : only === 'passed' ? !!x.sub.passed : !x.sub.passed))
  }, [s, only])

  const total = s.stats.speaking + s.levelTestSubmissions.length
  if (total === 0) return <Empty icon="🎤" title="No speaking submissions yet" hint="Recordings, transcripts and AI feedback appear here once the student submits a speaking task." />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(
            [
              ['all', `All (${total})`],
              ['passed', 'Passed'],
              ['failed', 'Not passed'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setOnly(v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${only === v ? 'bg-[#534AB7] text-white' : 'bg-[#f4f3f7] text-[#5b5670]'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#9a9aa2]">
          {s.stats.speakingPassed} passed · avg {s.stats.avgScore ?? 0}% · best {s.stats.bestScore ?? 0}%
        </p>
      </div>
      {items.length === 0 ? (
        <Empty title="Nothing matches" />
      ) : (
        items.map(({ sub, title }) => <SubmissionCard key={sub.id} sub={sub} title={title} />)
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Emma
// ---------------------------------------------------------------------------

function EmmaTab({ s }: { s: StudentRecord }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (s.emma.length === 0)
    return <Empty icon="🗣️" title="No Emma sessions yet" hint="Conversations with Emma (transcripts, corrections and recordings) show up here." />
  const open = openId ? s.emma.find((c) => c.id === openId) ?? null : null
  if (open) return <ConversationView c={open} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-[#9a9aa2]">
        {s.stats.emmaCompleted} completed of {s.stats.emmaSessions} · {s.stats.emmaMinutes} minutes spoken · {s.stats.emmaCorrections} corrections
      </p>
      {s.emma.map((c) => {
        const pct = c.goal_seconds ? Math.min(100, (Number(c.speaking_seconds) / c.goal_seconds) * 100) : 0
        return (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full rounded-2xl border border-[#f0ecf8] bg-white p-4 text-left hover:bg-[#faf9ff]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#111]">{SCENARIO_LABEL[c.scenario] ?? c.scenario}</p>
                <p className="text-[11px] font-semibold text-[#9a9aa2]">
                  {LEVEL_LABEL[c.level] ?? c.level} · {fmtDateTime(c.started_at)} · {c.turns.length} turn{c.turns.length === 1 ? '' : 's'}
                  {c.corrections ? ` · ${c.corrections} correction${c.corrections === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <Badge tone={c.status === 'completed' ? 'green' : 'amber'}>{c.status === 'completed' ? 'Completed' : 'Active'}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar pct={pct} color={c.status === 'completed' ? GREEN : '#F5A623'} />
              <span className="w-24 shrink-0 text-right text-[11px] font-bold text-[#5b5670]">
                {formatDuration(c.speaking_seconds)} / {formatDuration(c.goal_seconds)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ConversationView({ c, onBack }: { c: EmmaConversation; onBack: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [audioError, setAudioError] = useState<string | null>(null)

  // Sign listen links for every recorded turn (private bucket).
  useEffect(() => {
    if (!supabase) return
    const paths = c.turns.map((t) => t.audio_path).filter((p): p is string => !!p)
    if (paths.length === 0) return
    let cancelled = false
    supabase.storage
      .from(EMMA_AUDIO_BUCKET)
      .createSignedUrls(paths, EMMA_AUDIO_TTL)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setAudioError(error.message)
          return
        }
        const next: Record<string, string> = {}
        for (const row of data ?? []) if (row.path && row.signedUrl) next[row.path] = row.signedUrl
        setUrls(next)
      })
    return () => {
      cancelled = true
    }
  }, [c])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-[#534AB7] hover:underline">
        ← All sessions
      </button>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-extrabold text-[#111]">{SCENARIO_LABEL[c.scenario] ?? c.scenario}</p>
          <Badge tone={c.status === 'completed' ? 'green' : 'amber'}>{c.status === 'completed' ? 'Completed' : 'Active'}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Level</dt>
            <dd className="font-bold text-[#111]">{LEVEL_LABEL[c.level] ?? c.level}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Speaking time</dt>
            <dd className="font-bold text-[#111]">
              {formatDuration(c.speaking_seconds)} / {formatDuration(c.goal_seconds)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Started</dt>
            <dd className="font-bold text-[#111]">{fmtDateTime(c.started_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Finished</dt>
            <dd className="font-bold text-[#111]">{fmtDateTime(c.completed_at)}</dd>
          </div>
        </dl>
      </Card>

      {audioError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Couldn't prepare recordings: {audioError}</p>}

      {c.turns.length === 0 ? (
        <p className="text-sm text-[#9a9aa2]">No turns recorded for this session.</p>
      ) : (
        <div className="space-y-3">
          {c.turns.map((t, i) => (
            <div key={t.id} className="rounded-2xl border border-[#f0ecf8] bg-white p-4">
              <p className="mb-2 text-[11px] font-bold text-[#9a9aa2]">
                Turn {i + 1} · {fmtDateTime(t.created_at)} · {formatDuration(t.speaking_seconds)} spoken
              </p>
              {t.audio_path && (
                <div className="mb-2">
                  {urls[t.audio_path] ? (
                    <audio controls preload="none" src={urls[t.audio_path]} className="h-9 w-full max-w-sm" />
                  ) : (
                    <p className="text-xs text-[#9a9aa2]">Preparing recording…</p>
                  )}
                </div>
              )}
              <div className="mb-2 rounded-xl bg-[#f4f3f7] px-3 py-2 text-sm text-[#111]" dir="ltr">
                <span className="font-bold text-[#534AB7]">Student: </span>
                {t.transcript}
              </div>
              <div className="mb-2 rounded-xl bg-[#EDEBFF] px-3 py-2 text-sm text-[#111]" dir="ltr">
                <span className="font-bold text-[#534AB7]">Emma: </span>
                {t.reply}
              </div>
              {t.feedback?.positive && (
                <div className="rounded-xl border border-[#D8FAF0] bg-[#F3FCFA] px-3 py-2 text-sm">
                  <p className="font-bold text-[#0C7C62]">✓ {t.feedback.positive}</p>
                  {t.feedback.correction && (
                    <div className="mt-1.5 space-y-1" dir="ltr">
                      {t.feedback.original && (
                        <p className="text-[#B11D54]">
                          <span className="text-xs font-bold text-[#9a9aa2]">Original: </span>
                          {t.feedback.original}
                        </p>
                      )}
                      <p className="font-bold text-[#0C7C62]">
                        <span className="text-xs font-bold text-[#9a9aa2]">Suggested: </span>
                        {t.feedback.correction}
                      </p>
                      {t.feedback.explanationArabic && (
                        <p className="text-[#5b5670]" dir="rtl">
                          {t.feedback.explanationArabic}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesTab({ s }: { s: StudentRecord }) {
  const withNotes = s.challenges.filter((c) => c.notes.length > 0)
  if (withNotes.length === 0) return <Empty icon="📝" title="No vocabulary notes yet" hint="Students save 10+ words per challenge before the lesson video unlocks." />
  return (
    <div className="space-y-3">
      {withNotes.map((c) => (
        <Card key={c.id} className="p-4">
          <SectionTitle hint={`${c.notes.length} words · ${fmtDate(c.notesUpdatedAt)}`}>
            Challenge {c.number}
            {c.title ? ` · ${c.title}` : ''}
          </SectionTitle>
          <WordChips words={c.notes} />
        </Card>
      ))}
    </div>
  )
}
