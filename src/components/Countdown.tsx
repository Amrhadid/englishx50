import { useEffect, useState } from 'react'
import { BRAND_GRADIENT, toArabicDigits } from '../lib/theme'

interface CountdownProps {
  onStart: () => void
}

// Next challenge start date. Update this when a new round is scheduled.
const TARGET = new Date('2026-06-10T00:00:00')

const UNITS = [
  { key: 'days', label: 'يوم' },
  { key: 'hours', label: 'ساعة' },
  { key: 'minutes', label: 'دقيقة' },
  { key: 'seconds', label: 'ثانية' },
] as const

function getRemaining() {
  const diff = TARGET.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: false,
  }
}

export default function Countdown({ onStart }: CountdownProps) {
  const [t, setT] = useState(getRemaining)

  useEffect(() => {
    const id = setInterval(() => setT(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="px-5 py-16 sm:px-8" dir="rtl">
      <div
        className="relative mx-auto max-w-3xl overflow-hidden rounded-[36px] px-6 py-12 text-center shadow-2xl shadow-[#A964F0]/30 sm:px-12"
        style={{ background: BRAND_GRADIENT }}
      >
        {/* Decorative glows */}
        <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-12 -right-8 h-56 w-56 rounded-full bg-white/15 blur-2xl" />

        <div className="relative">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[13px] font-bold text-white backdrop-blur">
            ⏳ التحدي القادم
          </span>
          <h2 className="mb-1 text-[26px] font-black text-white sm:text-[32px]">
            يبدأ التحدي القادم
          </h2>
          <p className="mb-7 text-[15px] font-semibold text-white/90">
            ١٠ يونيو · June 10th
          </p>

          {/* Countdown tiles */}
          <div className="mx-auto mb-8 flex max-w-md justify-center gap-2.5 sm:gap-4">
            {UNITS.map((u) => (
              <div
                key={u.key}
                className="flex min-w-[64px] flex-1 flex-col items-center rounded-2xl border border-white/20 bg-white/15 py-3 backdrop-blur sm:min-w-[80px]"
              >
                <span className="text-[28px] font-black leading-none text-white tabular-nums sm:text-[38px]">
                  {toArabicDigits(String(t[u.key]).padStart(2, '0'))}
                </span>
                <span className="mt-1.5 text-[11px] font-semibold text-white/80 sm:text-[12px]">
                  {u.label}
                </span>
              </div>
            ))}
          </div>

          {t.done && (
            <p className="mb-5 text-sm font-bold text-white">انطلق التحدي! انضم الآن 🚀</p>
          )}

          <button
            onClick={onStart}
            className="rounded-full bg-white px-10 py-4 text-base font-extrabold text-[#7C6FF0] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            اضمن مكانك الآن ←
          </button>
        </div>
      </div>
    </section>
  )
}
