import type { Challenge } from '../types'
import { themeFor, toArabicDigits, ACTION_THEMES } from '../lib/theme'

interface ChallengesProps {
  challenges: Challenge[]
  loading: boolean
  error: string | null
  onSelect: (challenge: Challenge) => void
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
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-1 h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5Zm16 0a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2V5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-1 h-[18px] w-[18px]" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-1 h-[18px] w-[18px]" aria-hidden="true">
      <rect x="4" y="12" width="4" height="8" rx="1.5" />
      <rect x="10" y="7" width="4" height="13" rx="1.5" />
      <rect x="16" y="3" width="4" height="17" rx="1.5" />
    </svg>
  )
}

const ACTIONS = [
  { key: 'source', label: 'المصدر', icon: <BookIcon />, theme: ACTION_THEMES.source },
  { key: 'speaking', label: 'تحدّث', icon: <MicIcon />, theme: ACTION_THEMES.speaking },
  { key: 'feedback', label: 'تقييم', icon: <ChartBarIcon />, theme: ACTION_THEMES.feedback },
] as const

function ChallengeCard({
  challenge,
  index,
  onSelect,
}: {
  challenge: Challenge
  index: number
  onSelect: () => void
}) {
  const theme = themeFor(index)
  const num = String(challenge.number).padStart(2, '0')

  return (
    <div className="group flex flex-col overflow-hidden rounded-[28px] border border-[#efeafc] bg-white shadow-[0_8px_30px_-12px_rgba(124,111,240,0.18)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_-15px_rgba(124,111,240,0.4)]">
      {/* Coloured thumbnail */}
      <button
        onClick={onSelect}
        className="relative flex h-[124px] w-full items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.soft} 0%, #ffffff 130%)` }}
        aria-label={`التحدي ${num}`}
      >
        {/* Big watermark number */}
        <span
          className="pointer-events-none absolute -bottom-5 left-2 text-[80px] font-black leading-none opacity-15"
          style={{ color: theme.accent }}
        >
          {num}
        </span>

        <span
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-110"
          style={{ backgroundColor: theme.accent, boxShadow: `0 10px 24px -6px ${theme.accent}` }}
        >
          <PlayIcon />
        </span>

        <span
          className="absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-extrabold text-white shadow-sm"
          style={{ backgroundColor: theme.accent }}
        >
          التحدي {toArabicDigits(challenge.number)}
        </span>

        {challenge.is_locked && (
          <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-[#8a85a0] shadow-sm backdrop-blur">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor" />
              <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
        )}
      </button>

      {/* Title */}
      <div className="px-4 pt-3.5 pb-1 text-right" dir="rtl">
        <h3 className="truncate text-[15px] font-extrabold" style={{ color: theme.deep }}>
          {challenge.title || `التحدي ${toArabicDigits(challenge.number)}`}
        </h3>
      </div>

      {/* Action chips */}
      <div className="grid grid-cols-3 gap-1.5 p-3 pt-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={onSelect}
            className="rounded-2xl px-1 py-2.5 text-[11px] font-bold transition hover:brightness-95"
            style={{ backgroundColor: a.theme.soft, color: a.theme.deep }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Challenges({ challenges, loading, error, onSelect }: ChallengesProps) {
  return (
    <section id="challenges" className="mx-auto max-w-5xl px-5 pb-16 pt-4 sm:px-8">
      <div className="mb-8 text-center" dir="rtl">
        <span className="mb-3 inline-block rounded-full bg-[#f1edff] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#7C6FF0]">
          خريطة الرحلة
        </span>
        <h2 className="text-[28px] font-black text-[#1b1730] sm:text-[34px]">٥٠ يوم، ١٠ تحديات 🎯</h2>
        <p className="mt-2 text-[15px] text-[#7a7596]">كل تحدٍّ يقرّبك خطوة من الطلاقة</p>
      </div>

      {loading && <p className="text-center text-sm text-[#7a7689]">جارٍ التحميل…</p>}

      {error && (
        <p className="rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
          تعذّر تحميل التحديات. {error}
        </p>
      )}

      {!loading && !error && challenges.length === 0 && (
        <p className="text-center text-sm text-[#7a7689]">لا توجد تحديات بعد.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
        {challenges.map((c, i) => (
          <ChallengeCard key={c.id} challenge={c} index={i} onSelect={() => onSelect(c)} />
        ))}
      </div>
    </section>
  )
}
