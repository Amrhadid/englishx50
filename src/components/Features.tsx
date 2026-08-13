import { UI } from '../lib/theme'

/**
 * The "مميزات التحدي" block. Used to be the first view of PremiumModal; it is
 * now a plain section on the join page so a visitor scrolls straight through
 * video → CTA → features → form without another popup.
 */

const FEATURES = [
  { emoji: '📚', title: 'مصدر تعليمي لكل تحدي', desc: 'مادة مختارة تبدأ بها كل تحدٍّ' },
  { emoji: '🎬', title: 'درس شرح قصير وتفاعلي', desc: 'شرح مركّز يوصّل الفكرة بسرعة' },
  { emoji: '🎤', title: 'مهمة تحدّث عملية', desc: 'تتكلّم فعليًا في كل تحدي' },
  { emoji: '🤖', title: 'تدرّب مع AI Coach', desc: 'تمرّن على النطق والمحادثة في أي وقت' },
  { emoji: '📊', title: 'تقييم واقتراحات للتطوير', desc: 'تعرف نقاط قوتك وما يحتاج تحسين' },
  { emoji: '🏆', title: 'متابعة حتى النهاية', desc: 'التزام للنهاية = نتيجة مضمونة إن شاء الله' },
]

export default function Features() {
  return (
    <section id="features" className="px-5 py-16 sm:px-8" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <h2
          className="mb-10 text-center text-[30px] font-black leading-tight tracking-tight sm:text-[40px]"
          style={{ color: UI.ink }}
        >
          إيه اللي <span style={{ color: UI.pinkInk }}>هتاخده</span>؟
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3.5 rounded-[20px] border p-5 transition hover:border-[#14171F]"
              style={{ borderColor: UI.line }}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{ backgroundColor: UI.sand }}
              >
                {f.emoji}
              </span>
              <div>
                <p className="text-[16px] font-bold leading-snug" style={{ color: UI.ink }}>
                  {f.title}
                </p>
                <p className="mt-1 text-[14px]" style={{ color: UI.muted }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
