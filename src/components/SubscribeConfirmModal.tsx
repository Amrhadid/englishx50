import { BRAND_GRADIENT } from '../lib/theme'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Gate before the upgrade flow on the program page: makes sure the visitor
 * actually watched the intro video and understood the details first.
 *  - Yes → open the upgrade popup.
 *  - No  → send them back to the video + details.
 */
export default function SubscribeConfirmModal({
  onYes,
  onNo,
  onClose,
}: {
  onYes: () => void
  onNo: () => void
  onClose: () => void
}) {
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

        <div className="mb-4 text-5xl">🎬</div>
        <h2 className="mb-2 text-[22px] font-black leading-snug text-[#1b1730]">
          هل شاهدت الفيديو كامل وفهمت التفاصيل؟
        </h2>
        <p className="text-[14px] font-semibold leading-relaxed text-[#7a7596]">
          تأكد إنك راجعت الفيديو التعريفي وكل تفاصيل البرنامج قبل الاشتراك.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onYes}
            className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
            style={{ background: BRAND_GRADIENT }}
          >
            نعم، أكمل الاشتراك ←
          </button>
          <button
            onClick={onNo}
            className="flex-1 rounded-2xl border border-[#e7e3ff] bg-white py-3.5 text-sm font-bold text-[#7a7596] transition hover:bg-[#f4f2fc]"
          >
            لا، أراجع التفاصيل
          </button>
        </div>
      </div>
    </div>
  )
}
