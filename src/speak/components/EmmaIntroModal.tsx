import EmmaAvatar from './EmmaAvatar'
import { T } from '../text'

/**
 * One-time "meet Emma" popup, shown to a paid learner the first time they
 * reach /speak (see emma_intro_seen_at gating in SpeakPage.tsx). Dismissing
 * it — the only way out, by design — both records "seen" and claims the
 * 20-day subscription gift in one atomic server call (claimEmmaIntro).
 */
export default function EmmaIntroModal({ onDismiss, dismissing }: { onDismiss: () => void; dismissing: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-[28px] border border-white bg-[#fdfcff] p-7 text-center shadow-2xl"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <div className="mx-auto mb-4 inline-flex">
          <EmmaAvatar size={72} />
        </div>
        <h2 className="mb-2 text-[19px] font-black leading-snug text-[#1b1730]">{T.introTitle}</h2>
        <p className="mb-3 text-[14px] font-bold text-[#534AB7]">{T.introIntro}</p>
        <ol className="space-y-2.5 text-right">
          {T.introPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f4f2fc] text-[12px] font-black text-[#534AB7]">
                {i + 1}
              </span>
              <span className="text-[13.5px] font-semibold leading-relaxed text-[#413c5c]">{point}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onDismiss}
          disabled={dismissing}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#534AB7] text-[15px] font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#46409c] disabled:opacity-70"
        >
          {T.introCta}
        </button>
      </div>
    </div>
  )
}
