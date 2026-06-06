import { toArabicDigits } from '../lib/theme'

const PURPLE = '#534AB7'
const CORAL = '#993C1D'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function DaysLeftBadge({ daysLeft }: { daysLeft: number }) {
  const expired = daysLeft <= 0
  const warning = daysLeft <= 10 // includes expired
  const bg = warning ? CORAL : PURPLE

  return (
    <span
      dir="rtl"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white"
      style={{ backgroundColor: bg, fontFamily: "'Cairo', sans-serif" }}
    >
      <CalendarIcon />
      {expired ? 'انتهى اشتراكك' : `متبقي ${toArabicDigits(daysLeft)} يوم`}
    </span>
  )
}
