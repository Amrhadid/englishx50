import presenting from '../assets/presenting.svg'

interface HeroProps {
  onStart: () => void
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="bg-[#EEEDFE] px-6 pt-14 pb-12 sm:px-8 sm:pt-[60px]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 md:flex-row">
        {/* Left column — RTL Arabic */}
        <div className="flex-1 text-center md:text-right" dir="rtl">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-[20px] border-[0.5px] border-[#CECBF6] bg-white px-3.5 py-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-semibold text-[#534AB7]">تحدي ٥٠ يوم</span>
          </div>

          <h1 className="mb-2 text-[38px] font-extrabold leading-[1.2] text-[#111]">تحدي ٥٠ يوم</h1>
          <p className="mb-4 text-[19px] font-bold text-[#534AB7]">لتتحدث الإنجليزية</p>

          <p className="mb-1.5 text-sm text-[#555]">مصدر للتعلم + درس شرح تفاعلي ٢٠ دقيقة</p>
          <p className="mb-4 text-sm text-[#555]">مهمة تحدث + تقييم وتطوير</p>
          <p className="mb-7 text-sm font-bold text-[#534AB7]">
            ١٠ تحديات خلال ٥٠ يوم = نتيجة مضمونة ١٠٠٪ إن شاء الله
          </p>

          <button
            onClick={onStart}
            className="inline-block rounded-xl bg-[#111] px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-black"
          >
            ابدأ التحدي ←
          </button>
        </div>

        {/* Right column — illustration */}
        <div className="flex flex-1 items-center justify-center">
          <img src={presenting} alt="" className="w-full max-w-sm" />
        </div>
      </div>
    </section>
  )
}
