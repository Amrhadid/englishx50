import { Link } from 'react-router-dom'
import { BRAND_GRADIENT } from '../lib/theme'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Shown when a visitor without an active subscription clicks any premium
 * feature (a challenge, the level test, or a "start" CTA). Instead of opening
 * the full upgrade flow directly, it nudges them to the program page first.
 */
export default function ProgramGateModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] border border-white bg-[#fdfcff] p-8 text-center shadow-2xl"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <div className="mb-4 text-5xl">🔒</div>
        <h2 className="mb-2 text-2xl font-black text-[#1b1730]">مزايا البرنامج</h2>
        <p className="text-[15px] font-semibold leading-relaxed text-[#7a7596]">
          يمكنك الاستفادة بجميع مزايا البرنامج بعد شراء الكود
        </p>

        <Link
          to="/program"
          onClick={onClose}
          className="mt-6 block w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          style={{ background: BRAND_GRADIENT }}
        >
          تعرف على البرنامج من هنا ←
        </Link>
      </div>
    </div>
  )
}
