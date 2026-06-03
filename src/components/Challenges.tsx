import type { Challenge } from '../types'

interface ChallengesProps {
  challenges: Challenge[]
  loading: boolean
  error: string | null
  onSelect: (challenge: Challenge) => void
}

// Cycles repeat every 7 entries (indices 7,8,9 reuse 0,1,2).
const PLAY_COLORS = ['#534AB7', '#0F6E56', '#993C1D', '#185FA5', '#993556', '#3B6D11', '#854F0B']
const DARK_BGS = ['#1a1a2e', '#0a2e1a', '#2e0a0a', '#0a1a2e', '#2e0a2e', '#1a2e0a', '#2e2a0a']

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-[3px] h-[14px] w-[14px]" aria-hidden="true">
      <path
        d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5Zm16 0a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2V5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mx-auto mb-[3px] h-[14px] w-[14px]" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-[3px] h-[14px] w-[14px]" aria-hidden="true">
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="16" y="3" width="4" height="17" rx="1" />
    </svg>
  )
}

function ChallengeCard({
  challenge,
  index,
  onSelect,
}: {
  challenge: Challenge
  index: number
  onSelect: () => void
}) {
  const accent = PLAY_COLORS[index % PLAY_COLORS.length]
  const darkBg = DARK_BGS[index % DARK_BGS.length]
  const num = String(challenge.number).padStart(2, '0')

  const buttonBase =
    'cursor-pointer border-none py-2.5 px-1 text-[11px] font-bold transition hover:brightness-95'

  return (
    <div className="overflow-hidden rounded-[20px] border-[0.5px] border-[#e8e0f0] bg-white">
      {/* Thumbnail */}
      <button
        onClick={onSelect}
        className="relative flex h-[90px] w-full items-center justify-center"
        style={{ backgroundColor: darkBg }}
        aria-label={`Challenge ${num}`}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: accent }}
        >
          <PlayIcon />
        </span>
        <span
          className="absolute right-2 top-2 rounded-[20px] px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          Challenge {num}
        </span>
      </button>

      {/* Action buttons */}
      <div className="grid grid-cols-3">
        <button
          onClick={onSelect}
          className={`${buttonBase} border-r-[0.5px] border-[#e8e0f0] bg-[#EEEDFE] text-[#3C3489]`}
        >
          <BookIcon />
          Source
        </button>
        <button
          onClick={onSelect}
          className={`${buttonBase} border-r-[0.5px] border-[#e8e0f0] bg-[#E1F5EE] text-[#085041]`}
        >
          <MicIcon />
          Speaking
        </button>
        <button onClick={onSelect} className={`${buttonBase} bg-[#FAEEDA] text-[#633806]`}>
          <ChartBarIcon />
          Feedback
        </button>
      </div>
    </div>
  )
}

export default function Challenges({ challenges, loading, error, onSelect }: ChallengesProps) {
  return (
    <section id="challenges" className="mx-auto max-w-5xl px-6 pb-10 sm:px-8">
      <div className="mb-5" dir="rtl">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-[#aaa]">التحديات</p>
        <h2 className="text-xl font-bold text-[#111]">٥٠ يوم، ١٠ تحديات</h2>
      </div>

      {loading && <p className="text-center text-sm text-[#7a7689]">جارٍ التحميل…</p>}

      {error && (
        <p className="rounded-xl bg-[#FAEEDA] p-4 text-center text-sm text-[#633806]">
          تعذّر تحميل التحديات. {error}
        </p>
      )}

      {!loading && !error && challenges.length === 0 && (
        <p className="text-center text-sm text-[#7a7689]">لا توجد تحديات بعد.</p>
      )}

      <div className="grid grid-cols-2 gap-3.5">
        {challenges.map((c, i) => (
          <ChallengeCard key={c.id} challenge={c} index={i} onSelect={() => onSelect(c)} />
        ))}
      </div>
    </section>
  )
}
