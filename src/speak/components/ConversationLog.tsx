import { useEffect, useRef } from 'react'
import EmmaAvatar from './EmmaAvatar'
import { T } from '../text'
import type { ConversationTurn, SessionPhase } from '../types'

interface Props {
  turns: ConversationTurn[]
  phase: SessionPhase
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

/** The transcript: Emma's lines on the left (LTR), the learner's on the right.
 *  Feedback is deliberately not shown here — it comes after the learner ends
 *  the conversation (see ConversationReview). */
export default function ConversationLog({ turns, phase }: Props) {
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
      className="flex flex-col gap-3"
    >
      {turns.length === 0 && !busyAi && (
        <p className="rounded-[20px] border border-dashed border-[#ece7fb] bg-white/60 p-5 text-center text-[14px] font-semibold text-[#7a7596]">
          {T.emptyConversation}
        </p>
      )}

      {turns.map((t) =>
        t.role === 'ai' ? (
          <div key={t.id} className="flex items-end gap-2" dir="ltr">
            <EmmaAvatar size={30} />
            <div className="max-w-[85%] rounded-[20px] rounded-bl-md border border-[#ece7fb] bg-white px-4 py-2.5 shadow-[0_6px_20px_-16px_rgba(83,74,183,0.5)]">
              <p className="spk-en text-[11px] font-extrabold text-[#7C6FF0]">{T.partnerName}</p>
              <p className="spk-en text-[15px] leading-relaxed text-[#1b1730]">{t.text}</p>
            </div>
          </div>
        ) : (
          <div key={t.id} className="flex flex-col items-end gap-2">
            <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-[#534AB7] px-4 py-2.5 text-white" dir="ltr">
              <p className="spk-en text-[15px] leading-relaxed">{t.text}</p>
            </div>
          </div>
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
