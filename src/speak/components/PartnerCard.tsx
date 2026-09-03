import EmmaAvatar from './EmmaAvatar'
import { levelLabel } from '../scenarios'
import { T } from '../text'
import type { LevelId } from '../types'

export default function PartnerCard({ level, speaking }: { level: LevelId; speaking: boolean }) {
  return (
    <section
      className="flex items-center gap-4 rounded-[24px] border border-[#ece7fb] bg-white p-4 shadow-[0_10px_30px_-22px_rgba(83,74,183,0.5)]"
      aria-label={`${T.partnerName} — ${T.partnerRole}`}
    >
      <EmmaAvatar size={64} speaking={speaking} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="spk-en text-[18px] font-black text-[#1b1730]">{T.partnerName}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D8FAF0] px-2.5 py-0.5 text-[11px] font-bold text-[#0C7C62]">
            <span className="h-2 w-2 rounded-full bg-[#23C4A0]" aria-hidden="true" />
            <span className="spk-en">{T.partnerStatus}</span>
          </span>
        </div>
        <p className="mt-0.5 text-[14px] font-semibold text-[#7a7596]">{T.partnerRole}</p>
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#f4f2fc] px-2.5 py-0.5 text-[12px] font-bold text-[#534AB7]">
          {T.levelPrefix} {levelLabel(level)}
        </p>
      </div>
    </section>
  )
}
