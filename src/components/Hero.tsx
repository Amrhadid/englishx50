import presenting from '../assets/presenting.svg'
import { BRAND_GRADIENT } from '../lib/theme'

interface HeroProps {
  onStart: () => void
}

const STATS = [
  { value: '٥٠', label: 'يوم', emoji: '🗓️', color: '#7C6FF0' },
  { value: '١٠', label: 'تحديات', emoji: '🚀', color: '#23C4A0' },
  { value: '٢٠', label: 'دقيقة شرح', emoji: '⏱️', color: '#FF8A5B' },
]

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 sm:px-8">
      {/* Pastel gradient wash + floating colour blobs */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#F3F0FF] via-[#FDF3FB] to-[#fdfcff]" />
      <div className="absolute -left-20 top-10 -z-10 h-72 w-72 rounded-full bg-[#A964F0]/25 blur-3xl animate-float-slow" />
      <div className="absolute -right-16 top-24 -z-10 h-80 w-80 rounded-full bg-[#23C4A0]/20 blur-3xl animate-float-slow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute bottom-0 left-1/3 -z-10 h-64 w-64 rounded-full bg-[#FF8A5B]/15 blur-3xl animate-float-slow" style={{ animationDelay: '3s' }} />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-12 md:flex-row">
        {/* Copy — RTL Arabic */}
        <div className="flex-1 text-center md:text-right" dir="rtl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2 shadow-sm shadow-[#A964F0]/10 backdrop-blur">
            <span className="text-base">🔥</span>
            <span className="text-[13px] font-bold text-[#7C6FF0]">تحدي ٥٠ يوم لتتحدث الإنجليزية</span>
          </div>

          <h1 className="mb-3 text-[44px] font-black leading-[1.15] text-[#1b1730] sm:text-[52px]">
            تحدّى نفسك،
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: BRAND_GRADIENT }}
            >
              وتحدّث الإنجليزية
            </span>
          </h1>

          <p className="mx-auto mb-2 max-w-md text-[15px] leading-relaxed text-[#5a5570] md:mx-0">
            مصدر للتعلم + درس شرح تفاعلي ٢٠ دقيقة، مهمة تحدّث، وتقييم وتطوير مستمر.
          </p>
          <p className="mb-8 text-[15px] font-bold text-[#7C6FF0]">
            ١٠ تحديات خلال ٥٠ يوم = نتيجة مضمونة ١٠٠٪ إن شاء الله ✨
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start">
            <button
              onClick={onStart}
              className="rounded-full px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#A964F0]/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#A964F0]/40"
              style={{ background: BRAND_GRADIENT }}
            >
              ابدأ التحدي الآن ←
            </button>
            <a
              href="#challenges"
              className="rounded-full border-2 border-[#E6E0FF] bg-white px-8 py-4 text-center text-base font-bold text-[#7C6FF0] transition hover:border-[#7C6FF0]"
            >
              شوف التحديات
            </a>
          </div>

          {/* Stat chips */}
          <div className="mt-10 flex flex-wrap justify-center gap-3 md:justify-start">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm backdrop-blur"
              >
                <span className="text-xl">{s.emoji}</span>
                <span>
                  <span className="block text-xl font-black leading-none" style={{ color: s.color }}>
                    {s.value}
                  </span>
                  <span className="text-[12px] font-semibold text-[#8a85a0]">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Illustration on a colourful glow */}
        <div className="relative flex flex-1 items-center justify-center">
          <div
            className="absolute h-72 w-72 rounded-[40%] blur-2xl opacity-40"
            style={{ background: BRAND_GRADIENT }}
          />
          <div className="relative flex h-72 w-72 items-center justify-center rounded-[48px] border border-white bg-white/70 shadow-2xl shadow-[#A964F0]/20 backdrop-blur sm:h-80 sm:w-80">
            <img src={presenting} alt="" className="w-3/4 animate-float-slow" />
            <span className="absolute -right-3 -top-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-lg">
              🎯
            </span>
            <span className="absolute -bottom-3 -left-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-lg">
              💬
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
