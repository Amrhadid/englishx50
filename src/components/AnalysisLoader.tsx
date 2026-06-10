import { useEffect, useState } from 'react'
import { toArabicDigits } from '../lib/theme'

const PURPLE = '#534AB7'
const R = 52
const C = 2 * Math.PI * R

/**
 * Animated "analysing your answer" graphic shown while voice-to-text and AI
 * grading run. The percentage climbs actively from 0 and eases toward 99% —
 * the parent unmounts it the moment the real result arrives.
 */
export default function AnalysisLoader({ label }: { label: string }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      // Quick to ~70%, then a slow crawl toward 99 — long analyses keep
      // visibly moving mid-range instead of pinning at 99% and looking
      // frozen, and it never claims done before the real result arrives.
      setPct((p) => Math.min(99, p + (99 - p) * 0.004 + (p < 70 ? 0.3 : 0.01)))
    }, 100)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center py-8" dir="rtl">
      {/* Progress ring with a live percentage in the centre */}
      <div className="relative flex h-[140px] w-[140px] items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#ECEAFF" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="url(#x50-analysis-gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.2s linear' }}
          />
          <defs>
            <linearGradient id="x50-analysis-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C6FF0" />
              <stop offset="55%" stopColor="#A964F0" />
              <stop offset="100%" stopColor="#F25C8A" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col items-center">
          <span className="animate-pulse text-xl leading-none">✨</span>
          <span className="mt-1 text-[26px] font-black leading-none tabular-nums" style={{ color: PURPLE }}>
            {toArabicDigits(Math.floor(pct))}٪
          </span>
        </div>
      </div>

      {/* Equalizer bars — analysing the recorded audio */}
      <div className="mt-4 flex h-6 items-end gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="animate-equalize w-1.5 rounded-full"
            style={{ backgroundColor: PURPLE, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <p className="mt-3 max-w-sm text-center text-[14px] font-bold leading-relaxed text-[#1b1730]">
        {label}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-[#a39ec0]">يستغرق التحليل عادةً أقل من دقيقة</p>
    </div>
  )
}
