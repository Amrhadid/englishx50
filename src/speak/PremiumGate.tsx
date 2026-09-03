import { Link } from 'react-router-dom'
import EmmaAvatar from './components/EmmaAvatar'
import { T } from './text'
import './speak.css'

/**
 * What a signed-in free account sees at /speak. No conversation is
 * initialised and no paid endpoint is called from this screen; the CTA goes
 * to the existing subscription page.
 */
export default function PremiumGate() {
  return (
    <div className="spk flex min-h-screen items-center justify-center px-5 py-10" dir="rtl">
      <div className="w-full max-w-sm rounded-[28px] border border-[#ece7fb] bg-white p-7 text-center shadow-[0_20px_50px_-30px_rgba(83,74,183,0.5)]">
        <div className="relative mx-auto mb-4 inline-flex">
          <EmmaAvatar size={84} />
          <span
            className="absolute -bottom-1 -left-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#534AB7] text-white"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
        </div>
        <h1 className="text-[22px] font-black leading-snug text-[#1b1730]">{T.gateTitle}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#7a7596]">{T.gateBody}</p>
        <Link
          to="/join"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#534AB7] text-[15px] font-bold text-white transition hover:bg-[#46409c]"
        >
          {T.gatePrimary}
          <span aria-hidden="true">←</span>
        </Link>
        <Link
          to="/challenge"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl border-2 border-[#ece7fb] text-[14px] font-bold text-[#534AB7] transition hover:bg-[#f4f2fc]"
        >
          {T.gateSecondary}
        </Link>
      </div>
    </div>
  )
}
