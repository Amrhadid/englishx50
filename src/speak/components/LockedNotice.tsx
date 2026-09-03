import { useEffect, useState } from 'react'
import { T } from '../text'

/** "Today's conversation is done": countdown to the next one. */
export default function LockedNotice({ nextAvailableAt }: { nextAvailableAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const at = nextAvailableAt ? new Date(nextAvailableAt).getTime() : 0
  const remaining = Math.max(0, at - now)
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000)
  return (
    <div className="rounded-[24px] border border-[#ece7fb] bg-[#f4f2fc] p-5" role="status">
      <p className="text-[16px] font-black text-[#1b1730]">{T.lockedTitle}</p>
      {remaining > 0 ? (
        <>
          <p className="mt-1 text-[13px] leading-relaxed text-[#7a7596]">{T.lockedBody}</p>
          <p className="spk-en mt-2 text-[24px] font-black tabular-nums text-[#534AB7]" dir="ltr">
            {hours}
            <span className="text-[14px] font-bold text-[#7a7596]"> {T.hour} </span>
            {String(minutes).padStart(2, '0')}
            <span className="text-[14px] font-bold text-[#7a7596]"> {T.minute}</span>
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] leading-relaxed text-[#7a7596]">{T.lockedNow}</p>
      )}
    </div>
  )
}
