import { T } from '../text'
import EmmaAvatar from './EmmaAvatar'
import type { SpeakFeedback } from '../types'

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Feedback on one learner answer, shown once the conversation is reviewed. */
export default function FeedbackCard({ feedback, compact = false }: { feedback: SpeakFeedback; compact?: boolean }) {
  return (
    <section className={`spk-feedback ${compact ? 'is-compact' : ''}`} aria-label={T.feedbackTitle}>
      <header className="spk-feedback-header">
        <EmmaAvatar size={38} />
        <div>
          <strong>{T.feedbackTitle}</strong>
          <span>بعد إجابتك</span>
        </div>
        <span className="spk-feedback-check">
          <CheckIcon />
        </span>
      </header>
      <div className="spk-feedback-good">
        <p className="spk-feedback-label">{T.feedbackPositive}</p>
        <p>{feedback.positive}</p>
      </div>
      {feedback.correction && (
        <dl className="spk-feedback-sections">
          {feedback.original && (
            <div className="spk-feedback-original">
              <dt>{T.feedbackOriginal}</dt>
              <dd className="spk-en" dir="ltr">
                {feedback.original}
              </dd>
            </div>
          )}
          <div className="spk-feedback-correction">
            <dt>{T.feedbackSuggested}</dt>
            <dd className="spk-en" dir="ltr">
              {feedback.correction}
            </dd>
          </div>
          {feedback.explanationArabic && (
            <div className="spk-feedback-why">
              <dt>{T.feedbackWhy}</dt>
              <dd>{feedback.explanationArabic}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
