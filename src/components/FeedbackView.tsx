import type { SpeakingResult } from '../types'

const PURPLE = '#534AB7'
const TEAL = '#0F6E56'
const CORAL = '#993C1D'

/** Renders AI speaking feedback. Shared by the speaking task, the Feedback
 *  chip modal, and the admin Students view. */
export default function FeedbackView({
  result,
  onRetry,
}: {
  result: SpeakingResult
  onRetry?: () => void
}) {
  const passed = result.passed
  const accent = passed ? TEAL : CORAL
  const mistakes = result.mistakes ?? []
  const corrected = result.corrected_sentences ?? []
  const vocabulary = result.vocabulary ?? []
  const strengths = result.strengths ?? []
  const weaknesses = result.weaknesses ?? []

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .feedback-print-area, .feedback-print-area * { visibility: visible !important; }
          .feedback-print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 24px;
            width: 100%;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="feedback-print-area space-y-5"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Score circle */}
        <div className="flex flex-col items-center">
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-full text-white shadow-lg"
            style={{ backgroundColor: accent }}
          >
            <span className="text-4xl font-black leading-none">{result.score}</span>
            <span className="mt-1 text-xs font-bold opacity-90">من ١٠٠</span>
          </div>
          <p className="mt-3 text-lg font-extrabold" style={{ color: accent }}>
            {passed ? 'ناجح' : 'راسب'}
          </p>
          {result.feedback && (
            <p className="mt-2 max-w-md text-center text-[14px] leading-relaxed text-[#3a3550]">
              {result.feedback}
            </p>
          )}
        </div>

        {/* Mistakes */}
        {mistakes.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-base font-extrabold" style={{ color: PURPLE }}>
              ✏️ الأخطاء والتصحيحات
            </h3>
            {mistakes.map((m, i) => (
              <div key={i} className="rounded-2xl border border-[#efeafc] bg-white p-4 shadow-sm">
                <p
                  className="rounded-xl border-2 p-3 font-semibold"
                  style={{ borderColor: '#DC2626', backgroundColor: '#FEF2F2', color: '#DC2626' }}
                  dir="ltr"
                >
                  {m.original}
                </p>
                <p className="mt-2 font-bold" style={{ color: TEAL }} dir="ltr">
                  {m.correction}
                </p>
                {m.explanation && (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6b6680]">{m.explanation}</p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Corrected sentences */}
        {corrected.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-base font-extrabold" style={{ color: PURPLE }}>
              ✅ الجمل المُصحّحة
            </h3>
            {corrected.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border-2 p-3 text-[14px] text-[#1b1730]"
                style={{ borderColor: TEAL, backgroundColor: '#F0FAF6' }}
                dir="ltr"
              >
                {s}
              </div>
            ))}
          </section>
        )}

        {/* Vocabulary */}
        {vocabulary.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-base font-extrabold" style={{ color: PURPLE }}>
              📚 كلمات مقترحة
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {vocabulary.map((v, i) => (
                <div key={i} className="rounded-2xl border border-[#efeafc] bg-white p-4 shadow-sm">
                  <p className="text-lg font-extrabold" style={{ color: PURPLE }} dir="ltr">
                    {v.word}
                  </p>
                  <p className="mt-1 text-[14px] text-[#3a3550]">{v.meaning}</p>
                  {v.example && (
                    <p className="mt-2 text-[13px] italic text-[#7a7596]" dir="ltr">
                      “{v.example}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-base font-extrabold" style={{ color: PURPLE }}>
              نقاط القوة
            </h3>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-[#3a3550]">
                  <span className="mt-0.5 font-bold" style={{ color: TEAL }}>
                    ✔
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-base font-extrabold" style={{ color: PURPLE }}>
              نقاط الضعف
            </h3>
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-[#3a3550]">
                  <span className="mt-0.5 font-bold" style={{ color: CORAL }}>
                    ⚠
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions (hidden when printing) */}
        <div className="no-print flex gap-2.5 pt-2">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white shadow-lg"
            style={{ backgroundColor: PURPLE }}
          >
            تصدير PDF
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-2xl border border-[#ece7fb] px-5 py-3 text-sm font-bold"
              style={{ color: PURPLE }}
            >
              حاول مرة أخرى
            </button>
          )}
        </div>
      </div>
    </>
  )
}
