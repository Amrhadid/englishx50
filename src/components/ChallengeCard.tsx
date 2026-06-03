import type { Challenge } from '../types'
import { LockIcon, FlameIcon } from './icons'

// Icon box color cycle: 0=purple, 1=teal, 2=coral, 3=blue, 4=pink
const ICON_COLORS = ['#534AB7', '#13B5A6', '#FF6B6B', '#3B82F6', '#EC4899']

interface ChallengeCardProps {
  challenge: Challenge
  index: number
  onClick: () => void
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color, backgroundColor: bg }}>
      {label}
    </span>
  )
}

export default function ChallengeCard({ challenge, index, onClick }: ChallengeCardProps) {
  const locked = challenge.is_locked
  const accent = ICON_COLORS[index % ICON_COLORS.length]
  const num = String(challenge.number).padStart(2, '0')

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start gap-3 rounded-2xl border p-5 text-right transition hover:shadow-md"
      style={{
        borderColor: '#e8e0f0',
        borderWidth: '0.5px',
        backgroundColor: locked ? '#F9F9F9' : '#ffffff',
      }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: locked ? '#c9c9cf' : accent }}
      >
        {locked ? <LockIcon className="h-5 w-5" /> : <FlameIcon className="h-5 w-5" />}
      </div>

      <span
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: locked ? '#9a9aa2' : accent }}
      >
        Challenge {num}
      </span>

      <h3 className="text-lg font-bold" style={{ color: locked ? '#9a9aa2' : '#111' }}>
        {challenge.title}
      </h3>

      <div className="mt-1 flex flex-wrap gap-2">
        {locked ? (
          <>
            <Pill label="Source" color="#9a9aa2" bg="#efefef" />
            <Pill label="Speaking task" color="#9a9aa2" bg="#efefef" />
            <Pill label="Feedback" color="#9a9aa2" bg="#efefef" />
          </>
        ) : (
          <>
            <Pill label="Source" color="#534AB7" bg="#EEEDFE" />
            <Pill label="Speaking task" color="#0E8C80" bg="#D7F5F1" />
            <Pill label="Feedback" color="#B45309" bg="#FEF3C7" />
          </>
        )}
      </div>
    </button>
  )
}
