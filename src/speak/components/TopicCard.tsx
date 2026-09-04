import { SCENARIOS } from '../scenarios'
import { T } from '../text'
import type { ScenarioId } from '../types'

interface Props {
  scenario: ScenarioId
  onSkip: () => void
  skipUsed: boolean
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 6h3.5L14 17.5H20M4 18h3.5L10 14M17 6h3v3M14 9l6-6M17 18h3v-3M14 15l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Emma's randomly-assigned topic for today, with the learner's one allowed reroll. */
export default function TopicCard({ scenario, onSkip, skipUsed }: Props) {
  const topic = SCENARIOS.find((s) => s.id === scenario)
  return (
    <section className="rounded-[24px] border border-[#ece7fb] bg-white p-4" aria-label={T.topicLabel}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#7a7596]">{T.topicLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[16px] font-black text-[#1b1730]">
            <span aria-hidden="true">{topic?.emoji}</span>
            {topic?.label}
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          disabled={skipUsed}
          title={skipUsed ? T.topicSkipUsed : T.topicSkip}
          className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ece7fb] bg-white px-4 text-[13px] font-bold text-[#534AB7] transition hover:border-[#7C6FF0] hover:bg-[#f4f2fc] disabled:opacity-40"
        >
          <ShuffleIcon />
          {T.topicSkip}
        </button>
      </div>
    </section>
  )
}
