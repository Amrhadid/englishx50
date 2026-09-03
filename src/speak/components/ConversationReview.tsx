import FeedbackCard from './FeedbackCard'
import { T } from '../text'
import type { ConversationTurn } from '../types'

interface Props {
  turns: ConversationTurn[]
  onNewChat: () => void
}

/** Shown once the learner ends the conversation: every answer with Emma's note. */
export default function ConversationReview({ turns, onNewChat }: Props) {
  const answers = turns.filter((t) => t.role === 'user')
  return (
    <section className="flex flex-col gap-4" aria-labelledby="spk-review-title">
      <div>
        <h2 id="spk-review-title" className="text-[20px] font-black text-[#1b1730]">
          {T.reviewTitle}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[#7a7596]">
          {answers.length ? T.reviewIntro : T.reviewEmpty}
        </p>
      </div>
      {answers.map((t, i) => (
        <div key={t.id} className="flex flex-col gap-2">
          <p className="text-[12px] font-bold text-[#a39ec0]">
            {T.reviewTurn} {i + 1}
          </p>
          <p className="spk-en rounded-[16px] bg-[#f4f2fc] px-4 py-2.5 text-[15px] leading-relaxed text-[#1b1730]">
            {t.text}
          </p>
          {t.feedback && <FeedbackCard feedback={t.feedback} />}
        </div>
      ))}
      <button
        type="button"
        onClick={onNewChat}
        className="mt-2 h-12 rounded-2xl bg-[#534AB7] text-[15px] font-bold text-white transition hover:bg-[#46409c]"
      >
        {T.settingsNewChat}
      </button>
    </section>
  )
}
