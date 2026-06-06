import { useEffect, useState } from 'react'
import { toArabicDigits } from '../lib/theme'
import urgent from '../assets/Urgent-amico.svg'

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
    <section className="bg-[#ECEAFF]" dir="rtl">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_1.1fr]">
        {/* Illustration — left */}
        <div className="flex items-center justify-center md:order-1">
          <img src={urgent} alt="" className="w-full max-w-[340px]" />
        </div>

        {/* Copy — right */}
        <div className="md:order-2">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[13px] font-extrabold text-[#8B5CF6] shadow-sm">
            ⏳ التحدي القادم
          </span>
          <h2 className="mb-1.5 text-[28px] font-black text-[#1b1730] sm:text-[36px]">
            يبدأ التحدي القادم
          </h2>
          <p className="mb-7 text-[17px] font-extrabold text-[#8B5CF6]">
            ١٠ يونيو · June 10th
          </p>

          {/* Countdown tiles */}
          <div className="mb-8 flex max-w-md gap-2.5 sm:gap-3.5">
            {UNITS.map((u) => (
              <div
                key={u.key}
                className="flex min-w-[64px] flex-1 flex-col items-center rounded-2xl border-2 border-[#d4c9ff] bg-white py-3.5 sm:min-w-[80px]"
              >
                <span className="text-[28px] font-black leading-none text-[#1b1730] tabular-nums sm:text-[38px]">
                  {toArabicDigits(String(t[u.key]).padStart(2, '0'))}
                </span>
                <span className="mt-1.5 text-[11px] font-bold text-[#8b85a0] sm:text-[12px]">
                  {u.label}
                </span>
              </div>
            ))}
          </div>

          {t.done && (
            <p className="mb-5 text-sm font-bold text-[#EC4899]">انطلق التحدي! انضم الآن 🚀</p>
          )}

          <button
            onClick={onStart}
            className="rounded-full bg-[#8B5CF6] px-10 py-4 text-base font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#1b1730]"
          >
            اضمن مكانك الآن ←
          </button>
        </div>
      </div>
    </section>
  )
}
