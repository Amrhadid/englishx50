import type { Challenge } from '../types'
import { themeFor, toArabicDigits, ACTION_THEMES, UI } from '../lib/theme'
import LevelTest from './LevelTest'

interface ChallengesProps {
  challenges: Challenge[]
  onTask: (challenge: Challenge) => void
  onFeedback: (challenge: Challenge) => void
  onSpeak: (challenge: Challenge) => void
  onLesson: (challenge: Challenge) => void
  onSource: (challenge: Challenge) => void
  onFile: (challenge: Challenge) => void
  onUpgrade: () => void
  onLevelTestComplete?: () => void
  levelTestDone?: boolean
  lockLabelFor?: (challenge: Challenge) => string | null
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="4" y="12" width="4" height="8" rx="1.5" />
      <rect x="10" y="7" width="4" height="13" rx="1.5" />
      <rect x="16" y="3" width="4" height="17" rx="1.5" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13 3v6h6M9 13h6M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The six objects every challenge is made of, in the order a student works
 * through them: read the source, read the task, watch the lesson, record,
 * get the feedback, then keep the file.
 */
const OBJECTS = [
  { key: 'source', label: 'المصدر', hint: 'Source', icon: <LinkIcon />, theme: ACTION_THEMES.source },
  { key: 'task', label: 'المهمة', hint: 'Task', icon: <TargetIcon />, theme: ACTION_THEMES.task },
  { key: 'lesson', label: 'الدرس', hint: 'Lesson', icon: <PlayIcon />, theme: ACTION_THEMES.lesson },
  { key: 'speaking', label: 'التحدّث', hint: 'Speaking', icon: <MicIcon />, theme: ACTION_THEMES.speaking },
  { key: 'feedback', label: 'التقييم', hint: 'Feedback', icon: <ChartBarIcon />, theme: ACTION_THEMES.feedback },
  { key: 'file', label: 'الملف', hint: 'File', icon: <FileIcon />, theme: ACTION_THEMES.file },
] as const

type ObjectKey = (typeof OBJECTS)[number]['key']

function ChallengeSection({
  challenge,
  index,
  id,
  lockLabel,
  onObject,
}: {
  challenge: Challenge
  index: number
  id?: string
  lockLabel?: string | null
  onObject: (key: ObjectKey) => void
}) {
  const theme = themeFor(index)
  const num = toArabicDigits(String(challenge.number).padStart(2, '0'))

  return (
    <section
      id={id}
      className="overflow-hidden rounded-[20px] border transition hover:border-[#14171F]"
      style={{ borderColor: UI.line }}
      dir="rtl"
    >
      {/* Section header — the challenge itself */}
      <header className="flex flex-wrap items-center gap-4 px-6 py-5" style={{ backgroundColor: UI.sand }}>
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[20px] font-black tabular-nums"
          style={{ backgroundColor: theme.accent, color: '#fff' }}
        >
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color: UI.muted }}>
            التحدي {toArabicDigits(challenge.number)}
          </p>
          <h3 className="text-[22px] font-black leading-tight tracking-tight" style={{ color: UI.ink }}>
            {challenge.title || `التحدي ${toArabicDigits(challenge.number)}`}
          </h3>
        </div>
        {lockLabel && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-bold"
            style={{ backgroundColor: '#fff', color: UI.muted }}
          >
            {lockLabel}
          </span>
        )}
      </header>

      {/* The six objects */}
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 pt-1 sm:grid-cols-3 lg:grid-cols-6">
        {OBJECTS.map((o) => (
          <button
            key={o.key}
            onClick={() => onObject(o.key)}
            className="flex flex-col items-center gap-2 rounded-[20px] px-3 py-4 text-center transition hover:-translate-y-0.5 hover:brightness-95"
            style={{ backgroundColor: o.theme.soft, color: o.theme.deep }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: o.theme.accent }}
            >
              {o.icon}
            </span>
            <span className="text-[13.5px] font-extrabold leading-none">{o.label}</span>
            <span dir="ltr" className="text-[10.5px] font-bold uppercase tracking-wide opacity-60">
              {o.hint}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function Challenges({
  challenges,
  onTask,
  onFeedback,
  onSpeak,
  onLesson,
  onSource,
  onFile,
  onUpgrade,
  onLevelTestComplete,
  levelTestDone,
  lockLabelFor,
}: ChallengesProps) {
  const handlers: Record<ObjectKey, (c: Challenge) => void> = {
    source: onSource,
    task: onTask,
    lesson: onLesson,
    speaking: onSpeak,
    feedback: onFeedback,
    file: onFile,
  }

  return (
    <div id="challenges" className="bg-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-14 sm:px-8">
        <div className="mb-4 text-center" dir="rtl">
          <h2 className="text-[32px] font-black leading-tight tracking-tight sm:text-[40px]" style={{ color: UI.ink }}>
            التحديات
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[16px] leading-relaxed" style={{ color: UI.muted }}>
            كل تحدي فيه ٦ خطوات: المصدر · المهمة · الدرس · التحدّث · التقييم · الملف
          </p>
        </div>
        <LevelTest onUpgrade={onUpgrade} onComplete={onLevelTestComplete} done={levelTestDone} />
        {challenges.map((c, i) => (
          <ChallengeSection
            key={c.id}
            challenge={c}
            index={i}
            id={i === 0 ? 'challenge-1' : undefined}
            lockLabel={lockLabelFor?.(c)}
            onObject={(key) => handlers[key](c)}
          />
        ))}
      </div>
    </div>
  )
}
