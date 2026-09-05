// Small presentational pieces shared by the Students dashboard.

import type { ReactNode } from 'react'
import type { ChallengeStatus, SubscriptionState } from '../../lib/students'
import { PURPLE, avatarColor, initials } from './format'

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${cls}`}
      style={{ backgroundColor: avatarColor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

export function ProgressBar({
  pct,
  color = PURPLE,
  height = 'h-2',
  track = '#EEEDFE',
}: {
  pct: number
  color?: string
  height?: string
  track?: string
}) {
  return (
    <div className={`${height} w-full overflow-hidden rounded-full`} style={{ backgroundColor: track }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}

type Tone = 'purple' | 'green' | 'amber' | 'red' | 'gray' | 'blue'

const TONES: Record<Tone, string> = {
  purple: 'bg-[#EEEDFE] text-[#473BBE]',
  green: 'bg-[#E1F5EE] text-[#0C7C62]',
  amber: 'bg-[#FEEFD2] text-[#A66A09]',
  red: 'bg-[#FEE2E2] text-[#B91C1C]',
  gray: 'bg-[#f0eff5] text-[#6b6784]',
  blue: 'bg-[#E3EEFF] text-[#1D4ED8]',
}

export function Badge({ tone = 'gray', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function SubscriptionBadge({ state, daysLeft }: { state: SubscriptionState; daysLeft: number | null }) {
  if (state === 'none') return <Badge tone="gray">No code</Badge>
  if (state === 'expired') return <Badge tone="red">Expired {daysLeft != null ? `${Math.abs(daysLeft)}d ago` : ''}</Badge>
  if (state === 'expiring') return <Badge tone="amber">{daysLeft}d left</Badge>
  return <Badge tone="green">{daysLeft}d left</Badge>
}

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  if (status === 'completed') return <Badge tone="green">✓ Completed</Badge>
  if (status === 'in-progress') return <Badge tone="amber">In progress</Badge>
  return <Badge tone="gray">Not started</Badge>
}

export function PassBadge({ passed, score }: { passed: boolean | null; score: number | null }) {
  return (
    <Badge tone={passed ? 'green' : 'red'}>
      {passed ? 'Passed' : 'Not passed'}
      {score != null ? ` · ${score}%` : ''}
    </Badge>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#f0ecf8] bg-white ${className}`}>{children}</div>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="text-sm font-extrabold uppercase tracking-wide text-[#6b6784]">{children}</h4>
      {hint && <span className="text-xs text-[#9a9aa2]">{hint}</span>}
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'purple',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'purple' | 'green' | 'amber' | 'red' | 'gray'
}) {
  const color =
    tone === 'green' ? '#0C7C62' : tone === 'amber' ? '#A66A09' : tone === 'red' ? '#B91C1C' : tone === 'gray' ? '#6b6784' : PURPLE
  return (
    <div className="rounded-2xl border border-[#f0ecf8] bg-[#faf9ff] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#9a9aa2]">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold leading-tight" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-[#7a7596]">{sub}</p>}
    </div>
  )
}

export function Empty({ icon = '🗂️', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e8e0f0] p-8 text-center">
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 text-sm font-bold text-[#111]">{title}</p>
      {hint && <p className="mt-1 text-xs text-[#9a9aa2]">{hint}</p>}
    </div>
  )
}
