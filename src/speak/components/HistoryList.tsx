import { formatDuration } from '../format'
import { SCENARIOS } from '../scenarios'
import { T } from '../text'
import type { Conversation } from '../types'

interface Props {
  history: Conversation[]
  onOpen: (conversation: Conversation) => void
  loadingId: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' }) : ''
}

/** Past completed conversations, newest first. */
export default function HistoryList({ history, onOpen, loadingId }: Props) {
  return (
    <section aria-labelledby="spk-history-title" className="flex flex-col gap-2">
      <h2 id="spk-history-title" className="text-[15px] font-extrabold text-[#1b1730]">
        {T.historyTitle}
      </h2>
      {history.length === 0 ? (
        <p className="text-[13px] text-[#7a7596]">{T.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((c) => {
            const s = SCENARIOS.find((x) => x.id === c.scenario)
            const loading = loadingId === c.id
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#ece7fb] bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[#1b1730]">
                    <span aria-hidden="true">{s?.emoji}</span> {s?.label}
                  </p>
                  <p className="text-[12px] text-[#7a7596]">
                    {formatDate(c.completedAt ?? c.startedAt)} · <span className="spk-en">{formatDuration(c.speakingSeconds)}</span> {T.minutesSpoken}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(c)}
                  disabled={loading}
                  className="h-11 shrink-0 rounded-full border border-[#ece7fb] px-4 text-[13px] font-bold text-[#534AB7] transition hover:bg-[#f4f2fc] disabled:opacity-60"
                >
                  {loading ? T.historyLoading : T.historyOpen}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
