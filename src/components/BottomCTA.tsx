import success from '../assets/success.svg'

interface BottomCTAProps {
  onStart: () => void
}

export default function BottomCTA({ onStart }: BottomCTAProps) {
  return (
    <section className="bg-[#EEEDFE] px-6 pt-10 pb-12 text-center sm:px-8" dir="rtl">
      <img src={success} alt="" className="mx-auto mb-5 w-full max-w-[220px]" />
      <h2 className="mb-2 text-2xl font-extrabold text-[#111]">جاهز للبدء؟</h2>
      <p className="mb-6 text-sm font-semibold text-[#534AB7]">
        ١٠ تحديات خلال ٥٠ يوم = نتيجة مضمونة ١٠٠٪ إن شاء الله
      </p>
      <button
        onClick={onStart}
        className="inline-block rounded-[14px] bg-[#534AB7] px-9 py-3.5 text-base font-bold text-white transition hover:bg-[#46409c]"
      >
        ابدأ التحدي ←
      </button>
    </section>
  )
}
