import { useEffect, useRef } from 'react'
import EmmaAvatar from './EmmaAvatar'
import FeedbackCard from './FeedbackCard'
import { T } from '../text'
import type { ConversationTurn, SessionPhase } from '../types'

interface Props {
  turns: ConversationTurn[]
  phase: SessionPhase
  /** Show feedback under each learner turn (mobile) or leave it to the side column. */
  inlineFeedback: boolean
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1" aria-hidden="true">
      <span className="spk-dot h-2 w-2 rounded-full bg-[#7C6FF0]" />
      <span className="spk-dot h-2 w-2 rounded-full bg-[#7C6FF0]" />
      <span className="spk-dot h-2 w-2 rounded-full bg-[#7C6FF0]" />
    </span>
  )
}

/** The transcript: Emma's lines on the left (LTR), the learner's on the right. */
export default function ConversationLog({ turns, phase, inlineFeedback }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const count = turns.length
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [count, phase])

  const busyAi = phase === 'thinking' || phase === 'starting'
  const busyUser = phase === 'transcribing'

  return (
    <section
      role="log"
      aria-label={T.conversationLabel}
      aria-live="polite"
      aria-relevant="additions"
      className="spk-conversation-log"
    >
      {turns.length === 0 && !busyAi && (
        <p className="rounded-[20px] border border-dashed border-[#ece7fb] bg-white/60 p-5 text-center text-[14px] font-semibold text-[#7a7596]">
          {T.emptyConversation}
        </p>
      )}

      {turns.map((t) =>
        t.role === 'ai' ? (
          <article key={t.id} className="spk-turn spk-turn-emma" dir="ltr">
            <EmmaAvatar size={30} />
            <div className="spk-turn-bubble">
              <p className="spk-en spk-turn-name">{T.partnerName}</p>
              <p className="spk-en spk-turn-text">{t.text}</p>
            </div>
          </article>
        ) : (
          <article key={t.id} className="spk-turn spk-turn-user">
            <div className="spk-turn-bubble" dir="ltr">
              <p className="spk-en spk-turn-name">أنت</p>
              <p className="spk-en spk-turn-text">{t.text}</p>
            </div>
            {inlineFeedback && t.feedback && (
              <div className="w-full max-w-[92%] min-[900px]:hidden">
                <FeedbackCard feedback={t.feedback} compact />
              </div>
            )}
          </article>
        ),
      )}

      {busyUser && (
        <div className="flex justify-end">
          <div className="rounded-[20px] rounded-br-md bg-[#534AB7]/70 px-4 py-2.5 text-white" dir="ltr">
            <span className="sr-only">{T.transcribing}</span>
            <TypingDots />
          </div>
        </div>
      )}
      {busyAi && (
        <div className="flex items-end gap-2" dir="ltr">
          <EmmaAvatar size={30} />
          <div className="rounded-[20px] rounded-bl-md border border-[#ece7fb] bg-white px-4 py-2.5">
            <span className="sr-only">{phase === 'starting' ? T.starting : T.thinking}</span>
            <TypingDots />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </section>
  )
}
