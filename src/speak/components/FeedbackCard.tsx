import { T } from '../text'
import type { SpeakFeedback } from '../types'

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Compact feedback on one learner answer: a positive, one fix, a short why. */
export default function FeedbackCard({ feedback, compact = false }: { feedback: SpeakFeedback; compact?: boolean }) {
  return (
    <section
      className={`rounded-[20px] border border-[#ece7fb] bg-white ${compact ? 'p-3.5' : 'p-4'}`}
      aria-label={T.feedbackTitle}
    >
      <p className="flex items-center gap-2 text-[14px] font-extrabold text-[#0C7C62]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D8FAF0] text-[#0C7C62]">
          <CheckIcon />
        </span>
        {feedback.positive}
      </p>
      {feedback.correction && (
        <dl className="mt-3 space-y-2">
          {feedback.original && (
            <div className="flex items-start gap-2">
              <dt className="w-12 shrink-0 pt-0.5 text-[12px] font-bold text-[#a39ec0]">{T.feedbackOriginal}</dt>
              <dd className="spk-en flex-1 rounded-xl bg-[#FFE7F1] px-3 py-1.5 text-[14px] leading-relaxed text-[#B11D54]">
                {feedback.original}
              </dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="w-12 shrink-0 pt-0.5 text-[12px] font-bold text-[#a39ec0]">{T.feedbackSuggested}</dt>
            <dd className="spk-en flex-1 rounded-xl bg-[#D8FAF0] px-3 py-1.5 text-[14px] font-semibold leading-relaxed text-[#0C7C62]">
              {feedback.correction}
            </dd>
          </div>
          {feedback.explanationArabic && (
            <div className="flex items-start gap-2">
              <dt className="w-12 shrink-0 pt-0.5 text-[12px] font-bold text-[#a39ec0]">{T.feedbackWhy}</dt>
              <dd className="flex-1 text-[13px] leading-relaxed text-[#3a3550]">{feedback.explanationArabic}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
