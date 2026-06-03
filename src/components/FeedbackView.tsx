import { toArabicDigits } from '../lib/theme'
import type { SpeakingResult } from '../types'

function Card({
  title,
  tint,
  color,
  children,
}: {
  title: string
  tint: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#efeafc] bg-white p-4">
      <p
        className="mb-2 inline-block rounded-full px-3 py-1 text-[12px] font-bold"
        style={{ backgroundColor: tint, color }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

/** Renders AI speaking feedback. Shared by the speaking task, the Feedback
 *  chip modal, and the admin Students view. */
export default function FeedbackView({
  result,
  onRetry,
}: {
  result: SpeakingResult
  onRetry?: () => void
}) {
  const f = result.feedback
  return (
    <div className="space-y-4" dir="rtl">
      {/* Status + score */}
      <div
        className={`rounded-[24px] p-5 text-center text-white ${result.passed ? '' : 'bg-[#C2410C]'}`}
        style={result.passed ? { background: 'linear-gradient(135deg,#23C4A0,#0F6E56)' } : undefined}
      >
        <p className="text-3xl font-black">{toArabicDigits(f.score)}٪</p>
        <p className="mt-1 text-sm font-bold">
          {result.passed ? 'اكتملت المهمة ✓' : 'لم تكتمل — تحتاج ٣ جمل كاملة مرتبطة بالسؤال'}
        </p>
        <p className="mt-1 text-[12px] text-white/90">
          عدد الجمل الكاملة: {toArabicDigits(f.complete_sentence_count)}
        </p>
      </div>

      {f.overall && (
        <div className="rounded-2xl border border-[#efeafc] bg-white p-4">
          <p className="text-[14px] leading-relaxed text-[#3a3550]">{f.overall}</p>
        </div>
      )}

      {f.strengths.length > 0 && (
        <Card title="✅ نقاط القوة" tint="#E1F5EE" color="#0C7C62">
          <ul className="list-disc space-y-1 pr-5 text-[14px] text-[#3a3550]">
            {f.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      {f.mistakes.length > 0 && (
        <Card title="✏️ أخطاء وتصحيحات" tint="#FFE7DB" color="#C2410C">
          <ul className="space-y-2">
            {f.mistakes.map((m, i) => (
              <li key={i} className="text-[14px]" dir="ltr">
                <span className="text-[#C2410C] line-through">{m.error}</span>
                <span className="mx-2 text-[#a39ec0]">→</span>
                <span className="font-semibold text-[#0C7C62]">{m.correction}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {f.vocabulary.length > 0 && (
        <Card title="📚 كلمات مقترحة" tint="#EDEBFF" color="#473BBE">
          <ul className="space-y-2">
            {f.vocabulary.map((v, i) => (
              <li key={i} className="text-[14px]">
                <span className="font-bold text-[#473BBE]" dir="ltr">
                  {v.word}
                </span>
                <span className="mx-1.5 text-[#7a7596]">— {v.meaning}</span>
                <span className="block text-[12px] text-[#a39ec0]" dir="ltr">
                  {v.example}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full rounded-2xl border border-[#ece7fb] py-3 text-sm font-bold text-[#7C6FF0] hover:bg-[#f1edff]"
        >
          حاول مرة أخرى
        </button>
      )}
    </div>
  )
}
