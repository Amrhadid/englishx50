import type { Challenge } from '../types'
import { toArabicDigits } from '../lib/theme'
import { challengeSpeakingTasks } from '../lib/challenge'
import { ACTION_THEMES } from '../lib/theme'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * «المهمة» — the read-only brief for a challenge.
 *
 * Deliberately separate from SpeakingModal: this just shows what the student is
 * being asked to talk about (so they can read and prepare it), while the
 * Speaking action is the recorder + grading pipeline.
 */
export default function TaskModal({
  challenge,
  onClose,
  onStartSpeaking,
}: {
  challenge: Challenge
  onClose: () => void
  onStartSpeaking: () => void
}) {
  const tasks = challengeSpeakingTasks(challenge)
  const theme = ACTION_THEMES.task

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white bg-[#fdfcff] p-7 shadow-2xl"
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

        <p className="mb-1 text-[12px] font-bold" style={{ color: theme.deep }}>
          التحدي {toArabicDigits(challenge.number)}
        </p>
        <h2 className="mb-5 text-2xl font-black text-[#1b1730]">مهمة التحدي</h2>

        {tasks.length ? (
          <>
            <ol className="mb-6 flex flex-col gap-3">
              {tasks.map((task, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-[#ece7fb] bg-white p-4">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
                    style={{ backgroundColor: theme.accent }}
                  >
                    {toArabicDigits(i + 1)}
                  </span>
                  <span dir="ltr" className="flex-1 text-left text-[15px] font-semibold leading-relaxed text-[#3a3550]">
                    {task}
                  </span>
                </li>
              ))}
            </ol>
            <button
              onClick={onStartSpeaking}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ backgroundColor: theme.accent }}
            >
              ابدأ التسجيل 🎤
            </button>
          </>
        ) : (
          <p className="rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
            لم تتم إضافة مهمة لهذا التحدي بعد.
          </p>
        )}
      </div>
    </div>
  )
}
