import type { Challenge } from '../types'
import { themeFor, toArabicDigits, ACTION_THEMES } from '../lib/theme'
import achievement from '../assets/Achievement-bro.svg'
import LevelTest from './LevelTest'

interface ChallengesProps {
  challenges: Challenge[]
  onSelect: (challenge: Challenge) => void
  onFeedback: (challenge: Challenge) => void
  onSpeak: (challenge: Challenge) => void
  onWatch: (challenge: Challenge) => void
  onSource: (challenge: Challenge) => void
  onFile: (challenge: Challenge) => void
  onUpgrade: () => void
  lockLabelFor?: (challenge: Challenge) => string | null
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true">
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

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[15px] w-[15px]" aria-hidden="true">
      <rect x="4" y="12" width="4" height="8" rx="1.5" />
      <rect x="10" y="7" width="4" height="13" rx="1.5" />
      <rect x="16" y="3" width="4" height="17" rx="1.5" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true">
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const ACTIONS = [
  { key: 'source', label: 'المصدر', icon: <LinkIcon />, theme: ACTION_THEMES.source },
  { key: 'speaking', label: 'تحدّث', icon: <MicIcon />, theme: ACTION_THEMES.speaking },
  { key: 'feedback', label: 'تقييم', icon: <ChartBarIcon />, theme: ACTION_THEMES.feedback },
  { key: 'file', label: 'ملف التحدي', icon: <FileIcon />, theme: ACTION_THEMES.file },
] as const

const STEPS = [
  'راجع المصدر جيداً',
  'سجل ملاحظاتك يدوياً',
  'شاهد درس الشرح وسجل كل الملاحظات الاضافية',
  'تعلم النطق والتحدث من فيديو الشرح',
  'مارس التحدث مع AI Coach',
  'احصل على تقييم و اقتراحات للتطوير',
  'قم بمراجعة غلطاتك جيداً',
]

function ChallengeRow({
  challenge,
  index,
  id,
  lockLabel,
  onSelect,
  onFeedback,
  onSpeak,
  onWatch,
  onSource,
  onFile,
}: {
  challenge: Challenge
  index: number
  id?: string
  lockLabel?: string | null
  onSelect: () => void
  onFeedback: () => void
  onSpeak: () => void
  onWatch: () => void
  onSource: () => void
  onFile: () => void
}) {
  const theme = themeFor(index)
  const num = String(challenge.number).padStart(2, '0')

  return (
    <div id={id} className="group grid min-h-[180px] grid-cols-[120px_1fr] overflow-hidden rounded-[24px] border-[1.5px] border-[#ede8ff] bg-white transition duration-300 hover:border-[#c4b8ff] hover:shadow-[0_8px_32px_rgba(139,92,246,0.12)] sm:grid-cols-[280px_1fr]">
      {/* Thumbnail (left) */}
      <button
        onClick={onWatch}
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.soft} 0%, #ffffff 100%)` }}
        aria-label={`التحدي ${num}`}
      >
        <span
          className="pointer-events-none absolute -bottom-2 left-2 text-[80px] font-black leading-none tabular-nums"
          style={{ color: theme.accent, opacity: 0.12 }}
        >
          {num}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-white transition group-hover:scale-110"
            style={{ backgroundColor: theme.accent, boxShadow: `0 8px 24px ${theme.accent}66` }}
          >
            <PlayIcon />
          </span>
        </span>
        {challenge.is_locked && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#8b85a0]">
            <LockIcon />
          </span>
        )}
      </button>

      {/* Info (right) */}
      <div className="flex flex-col justify-center gap-3 px-7 py-6" dir="rtl">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-bold" style={{ color: theme.accent }}>
            التحدي {toArabicDigits(challenge.number)}
          </p>
          <h3 className="text-[22px] font-black leading-tight text-[#1b1730]">
            {challenge.title || `التحدي ${toArabicDigits(challenge.number)}`}
          </h3>
          {lockLabel && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-[#FEEFD2] px-3 py-1 text-[12px] font-bold text-[#A66A09]">
              {lockLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={
                a.key === 'feedback'
                  ? onFeedback
                  : a.key === 'speaking'
                    ? onSpeak
                    : a.key === 'source'
                      ? onSource
                      : a.key === 'file'
                        ? onFile
                        : onSelect
              }
              className="flex items-center gap-1.5 rounded-[30px] px-[18px] py-2.5 text-[13px] font-bold transition hover:brightness-95"
              style={{ backgroundColor: a.theme.soft, color: a.theme.deep }}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Challenges({
  challenges,
  onSelect,
  onFeedback,
  onSpeak,
  onWatch,
  onSource,
  onFile,
  onUpgrade,
  lockLabelFor,
}: ChallengesProps) {
  return (
    <section id="challenges">
      {/* Header — lavender */}
      <div className="bg-[#ECEAFF]">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.1fr_1fr]" dir="rtl">
          {/* Steps card + badges */}
          <div>
            <span className="mb-3 inline-block rounded-full bg-white px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#8B5CF6]">
              نظام التحدي
            </span>
            <h2 className="mb-6 text-[28px] font-black text-[#1b1730] sm:text-[34px]">٢ تحدي كل اسبوع ⚡</h2>

            <div className="rounded-[28px] border-2 border-[#ede8ff] bg-white p-5 shadow-[0_10px_36px_-18px_rgba(139,92,246,0.3)] sm:p-7">
              <p className="mb-4 text-lg font-extrabold text-[#1b1730]">الخطوات :</p>
              <ol className="flex flex-col gap-2.5">
                {STEPS.map((step, i) => {
                  const theme = themeFor(i)
                  return (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
                        style={{ backgroundColor: theme.accent }}
                      >
                        {toArabicDigits(i + 1)}
                      </span>
                      <span className="text-[14px] font-semibold leading-relaxed text-[#3a3550] sm:text-[15px]">
                        {step}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className="flex items-center gap-2 rounded-full bg-[#FEEFD2] px-4 py-2.5 text-[13px] font-bold text-[#A66A09]">
                <span className="text-base">⏱️</span>
                ٤ إلى ٦ ساعات اسبوعياً
              </span>
              <span className="flex items-center gap-2 rounded-full bg-[#D8FAF0] px-4 py-2.5 text-[13px] font-bold text-[#0C7C62]">
                <span className="text-base">✅</span>
                يناسب كل المستويات (بشرط تكون طالب او خريج جامعي)
              </span>
            </div>
          </div>

          {/* Illustration */}
          <div className="flex items-center justify-center">
            <img src={achievement} alt="" className="w-full max-w-[360px]" />
          </div>
        </div>
      </div>

      {/* Challenge cards — white */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-14 sm:px-8">
          <LevelTest onUpgrade={onUpgrade} />
          {challenges.map((c, i) => (
            <ChallengeRow
              key={c.id}
              challenge={c}
              index={i}
              id={i === 0 ? 'challenge-1' : undefined}
              lockLabel={lockLabelFor?.(c)}
              onSelect={() => onSelect(c)}
              onFeedback={() => onFeedback(c)}
              onSpeak={() => onSpeak(c)}
              onWatch={() => onWatch(c)}
              onSource={() => onSource(c)}
              onFile={() => onFile(c)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
