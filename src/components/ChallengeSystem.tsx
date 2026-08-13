import { themeFor, toArabicDigits, UI } from '../lib/theme'
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
    <section id="program-details" style={{ backgroundColor: UI.sand }}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-14 pt-4 sm:px-8 md:grid-cols-[1.1fr_1fr]" dir="rtl">
        {/* Steps card + badges */}
        <div>
          <h2
            className="mb-7 text-[30px] font-black leading-tight tracking-tight sm:text-[40px]"
            style={{ color: UI.ink }}
          >
            تحدي جديد كل <span style={{ color: UI.pinkInk }}>٥ أيام</span> ⚡
          </h2>

          <div className="rounded-[20px] border bg-white p-6 sm:p-8" style={{ borderColor: UI.line }}>
            <p className="mb-5 text-[18px] font-bold" style={{ color: UI.ink }}>الخطوات :</p>
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
                    <span className="text-[15px] leading-relaxed sm:text-[16px]" style={{ color: UI.ink }}>
                      {step}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span
              className="flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[14px] font-bold"
              style={{ borderColor: UI.line, color: UI.ink }}
            >
              <span className="text-base">⏱️</span>
              ٤ إلى ٦ ساعات اسبوعياً
            </span>
            <span
              className="flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[14px] font-bold"
              style={{ borderColor: UI.line, color: UI.ink }}
            >
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
