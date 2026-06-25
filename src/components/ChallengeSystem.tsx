import { themeFor, toArabicDigits } from '../lib/theme'
import achievement from '../assets/Achievement-bro.svg'

const STEPS = [
  'راجع المصدر جيداً',
  'سجل ملاحظاتك يدوياً',
  'شاهد درس الشرح وسجل كل الملاحظات الاضافية',
  'تعلم النطق والتحدث من فيديو الشرح',
  'مارس التحدث مع AI Coach',
  'احصل على تقييم و اقتراحات للتطوير',
  'قم بمراجعة غلطاتك جيداً',
]

/**
 * The "نظام التحدي / ٢ تحدي كل اسبوع" program-details block — the steps,
 * weekly cadence badges and a quick stats strip. Lives on the dedicated
 * program page (تعرف على البرنامج).
 */
export default function ChallengeSystem() {
  return (
    <section id="program-details" className="bg-[#ECEAFF]">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-14 pt-4 sm:px-8 md:grid-cols-[1.1fr_1fr]" dir="rtl">
        {/* Steps card + badges */}
        <div>
          <span className="mb-3 inline-block rounded-full bg-white px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#8B5CF6]">
            نظام التحدي
          </span>
          <h2 className="mb-6 text-[28px] font-black text-[#1b1730] sm:text-[34px]">٢ تحدي كل اسبوع ⚡</h2>

          <div className="rounded-[28px] border-2 border-[#ede8ff] bg-white p-5 shadow-[0_10px_36px_-18px_rgba(139,92,246,0.3)] sm:p-7">
            <p className="mb-4 text-lg font-extrabold text-[#1b1730]">الخطوات :</p>
            <ol className="flex flex-col gap-2.5">
              {STEPS.map((step, i) => {
                const theme = themeFor(i)
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
                      style={{ backgroundColor: theme.accent }}
                    >
                      {toArabicDigits(i + 1)}
                    </span>
                    <span className="text-[14px] font-semibold leading-relaxed text-[#3a3550] sm:text-[15px]">
                      {step}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="flex items-center gap-2 rounded-full bg-[#FEEFD2] px-4 py-2.5 text-[13px] font-bold text-[#A66A09]">
              <span className="text-base">⏱️</span>
              ٤ إلى ٦ ساعات اسبوعياً
            </span>
            <span className="flex items-center gap-2 rounded-full bg-[#D8FAF0] px-4 py-2.5 text-[13px] font-bold text-[#0C7C62]">
              <span className="text-base">✅</span>
              يناسب كل المستويات (بشرط تكون طالب او خريج جامعي)
            </span>
          </div>
        </div>

        {/* Illustration */}
        <div className="flex items-center justify-center">
          <img src={achievement} alt="" className="w-full max-w-[360px]" />
        </div>
      </div>
    </section>
  )
}
