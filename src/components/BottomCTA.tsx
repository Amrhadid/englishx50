import { BRAND_GRADIENT } from '../lib/theme'

interface BottomCTAProps {
  onStart: () => void
}

export default function BottomCTA({ onStart }: BottomCTAProps) {
  return (
    <section className="px-5 pb-16 pt-6 sm:px-8" dir="rtl">
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-[36px] px-6 py-14 text-center shadow-2xl shadow-[#A964F0]/30 sm:px-12"
        style={{ background: BRAND_GRADIENT }}
      >
        {/* Decorative glows */}
        <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-12 -right-8 h-56 w-56 rounded-full bg-white/15 blur-2xl" />

        <div className="relative">
          <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-4xl backdrop-blur">
            🏆
          </span>
          <h2 className="mb-3 text-[28px] font-black text-white sm:text-[36px]">جاهز للبدء؟</h2>
          <p className="mx-auto mb-8 max-w-md text-[15px] font-semibold text-white/90">
            ١٠ تحديات خلال ٥٠ يوم = نتيجة مضمونة ١٠٠٪ إن شاء الله
          </p>
          <button
            onClick={onStart}
            className="rounded-full bg-white px-10 py-4 text-base font-extrabold text-[#7C6FF0] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            ابدأ التحدي ←
          </button>
        </div>
      </div>
    </section>
  )
}
