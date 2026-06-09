import type { Challenge } from '../types'
import type { LockState } from '../lib/completion'
import { toArabicDigits } from '../lib/theme'

const PURPLE = '#534AB7'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Shown when a premium user opens a challenge that's still locked: either the
 * previous challenge isn't finished, or the 5-day cooldown hasn't elapsed.
 */
export default function ChallengeLockedModal({
  challenge,
  lock,
  onClose,
}: {
  challenge: Challenge
  lock: Extract<LockState, { locked: true }>
  onClose: () => void
}) {
  const cooldown = lock.reason === 'cooldown'
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

        <div className="mb-4 text-5xl">{cooldown ? '⏳' : '🔒'}</div>
        <span
          className="mb-3 inline-block rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
          style={{ backgroundColor: PURPLE }}
        >
          التحدي {toArabicDigits(challenge.number)}
        </span>

        {cooldown ? (
          <>
            <h2 className="mb-2 text-2xl font-black text-[#1b1730]">
              متاح بعد {toArabicDigits(lock.daysLeft)} يوم
            </h2>
            <p className="text-[14px] font-semibold leading-relaxed text-[#7a7596]">
              فيه فترة انتظار ٥ أيام بين كل تحدي والتحدي اللي بعده — راجع معلوماتك كويس خلال الفترة دي
              وارجع كمّل.
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-black text-[#1b1730]">أكمل التحدي السابق أولاً</h2>
            <p className="text-[14px] font-semibold leading-relaxed text-[#7a7596]">
              لازم تخلّص التحدي اللي قبله — شاهد كل الفيديوهات وسجّل مهام التحدّث — قبل ما تفتح التحدي
              ده.
            </p>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          style={{ backgroundColor: PURPLE }}
        >
          تمام
        </button>
      </div>
    </div>
  )
}
