import type { Challenge } from '../types'
import { themeFor, toArabicDigits, ACTION_THEMES } from '../lib/theme'

interface ChallengesProps {
  challenges: Challenge[]
  onSelect: (challenge: Challenge) => void
  onFeedback: (challenge: Challenge) => void
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[15px] w-[15px]" aria-hidden="true">
      <path
        d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5Zm16 0a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2V5Z"
        fill="currentColor"
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const ACTIONS = [
  { key: 'source', label: 'المصدر', icon: <BookIcon />, theme: ACTION_THEMES.source },
  { key: 'speaking', label: 'تحدّث', icon: <MicIcon />, theme: ACTION_THEMES.speaking },
  { key: 'feedback', label: 'تقييم', icon: <ChartBarIcon />, theme: ACTION_THEMES.feedback },
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
  onSelect,
  onFeedback,
}: {
  challenge: Challenge
  index: number
  onSelect: () => void
  onFeedback: () => void
}) {
  const theme = themeFor(index)
  const num = String(challenge.number).padStart(2, '0')

  return (
    <div
      className="group flex items-center gap-3 rounded-[24px] border border-[#efeafc] bg-white p-2.5 shadow-[0_6px_24px_-14px_rgba(124,111,240,0.25)] transition duration-300 hover:-translate-y-0.5 hover:border-[#e0d8fa] hover:shadow-[0_16px_38px_-18px_rgba(124,111,240,0.4)] sm:gap-5 sm:p-3"
      dir="rtl"
    >
      {/* Episode number */}
      <span
        className="w-7 shrink-0 text-center text-2xl font-black tabular-nums sm:w-12 sm:text-[44px]"
        style={{ color: theme.accent }}
      >
        {toArabicDigits(num)}
      </span>

      {/* Thumbnail */}
      <button
        onClick={onSelect}
        className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-2xl sm:w-44"
        style={{ background: `linear-gradient(135deg, ${theme.soft} 0%, #ffffff 130%)` }}
        aria-label={`التحدي ${num}`}
      >
        <span
          className="pointer-events-none absolute -bottom-3 right-1 text-[52px] font-black leading-none opacity-15"
          style={{ color: theme.accent }}
        >
          {num}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-110"
            style={{ backgroundColor: theme.accent, boxShadow: `0 10px 22px -6px ${theme.accent}` }}
          >
            <PlayIcon />
          </span>
        </span>
        {challenge.is_locked && (
          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-[#8a85a0] shadow-sm backdrop-blur">
            <LockIcon />
          </span>
        )}
      </button>

      {/* Title + actions */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 pl-1 text-right">
        <div>
          <p className="text-[11px] font-bold" style={{ color: theme.accent }}>
            التحدي {toArabicDigits(challenge.number)}
          </p>
          <h3
            className="truncate text-[15px] font-extrabold sm:text-[17px]"
            style={{ color: theme.deep }}
          >
            {challenge.title || `التحدي ${toArabicDigits(challenge.number)}`}
          </h3>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={a.key === 'feedback' ? onFeedback : onSelect}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition hover:brightness-95 sm:px-3"
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

export default function Challenges({ challenges, onSelect, onFeedback }: ChallengesProps) {
  return (
    <section id="challenges" className="mx-auto max-w-3xl px-5 pb-16 pt-4 sm:px-8">
      <div className="mb-8" dir="rtl">
        <div className="text-center">
          <span className="mb-3 inline-block rounded-full bg-[#f1edff] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#7C6FF0]">
            نظام التحدي
          </span>
          <h2 className="text-[28px] font-black text-[#1b1730] sm:text-[34px]">٢ تحدي كل اسبوع ⚡</h2>
        </div>

        {/* Steps card */}
        <div className="mt-6 rounded-[28px] border border-[#efeafc] bg-white p-5 shadow-[0_10px_36px_-18px_rgba(124,111,240,0.35)] sm:p-7">
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

        {/* Info badges */}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
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

      <div className="flex flex-col gap-3">
        {challenges.map((c, i) => (
          <ChallengeRow
            key={c.id}
            challenge={c}
            index={i}
            onSelect={() => onSelect(c)}
            onFeedback={() => onFeedback(c)}
          />
        ))}
      </div>
    </section>
  )
}
