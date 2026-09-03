import { useState } from 'react'
import FeedbackCard from './FeedbackCard'
import { formatDuration } from '../format'
import { levelLabel, SCENARIOS } from '../scenarios'
import { T } from '../text'
import type { Conversation } from '../types'

interface Props {
  conversation: Conversation
  title: string
  intro: string
  /** Build the PDF bytes; injected so tests can stub the canvas work. */
  makePdf: (c: Conversation) => Promise<Uint8Array>
  download: (bytes: Uint8Array, fileName: string) => void
  fileName: (c: Conversation) => string
  onBack?: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}

/** Every answer of a completed conversation with Emma's note, plus the PDF download. */
export default function ConversationReview({ conversation, title, intro, makePdf, download, fileName, onBack }: Props) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const answers = (conversation.turns ?? []).filter((t) => t.transcript)
  const scenario = SCENARIOS.find((s) => s.id === conversation.scenario)

  const onDownload = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      download(await makePdf(conversation), fileName(conversation))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="spk-review-title">
      <div className="rounded-[24px] border border-[#ece7fb] bg-white p-5">
        <h2 id="spk-review-title" className="text-[20px] font-black text-[#1b1730]">
          {title}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[#7a7596]">{intro}</p>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-bold text-[#534AB7]">
          <span>
            {scenario?.emoji} {scenario?.label}
          </span>
          <span>· {T.levelPrefix} {levelLabel(conversation.level)}</span>
          <span className="spk-en">· {formatDuration(conversation.speakingSeconds)}</span>
          <span>· {formatDate(conversation.completedAt ?? conversation.startedAt)}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="flex h-12 items-center gap-2 rounded-2xl bg-[#534AB7] px-5 text-[14px] font-bold text-white transition hover:bg-[#46409c] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {busy ? T.downloading : T.download}
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-12 rounded-2xl border-2 border-[#ece7fb] px-5 text-[14px] font-bold text-[#534AB7] transition hover:bg-[#f4f2fc]"
            >
              {T.backToToday}
            </button>
          )}
        </div>
        {failed && (
          <p role="alert" className="mt-2 text-[13px] font-semibold text-[#C2410C]">
            {T.downloadFailed}
          </p>
        )}
      </div>

      {answers.length === 0 && <p className="text-[14px] text-[#7a7596]">{T.reviewEmpty}</p>}
      {answers.map((t, i) => (
        <div key={t.id} className="flex flex-col gap-2">
          <p className="text-[12px] font-bold text-[#a39ec0]">
            {T.reviewTurn} {i + 1}
          </p>
          <p className="spk-en rounded-[16px] bg-[#f4f2fc] px-4 py-2.5 text-[15px] leading-relaxed text-[#1b1730]">{t.transcript}</p>
          {t.feedback && <FeedbackCard feedback={t.feedback} />}
        </div>
      ))}
    </section>
  )
}
