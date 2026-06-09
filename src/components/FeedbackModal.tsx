import { useMemo } from 'react'
import { toArabicDigits } from '../lib/theme'
import { challengeTaskId, getAttempt } from '../lib/progress'
import type { SavedAttempt } from '../lib/progress'
import { challengeSpeakingTasks } from '../lib/challenge'
import { useAuth } from '../hooks/useAuth'
import FeedbackView from './FeedbackView'
import type { Challenge } from '../types'

interface FeedbackModalProps {
  challenge: Challenge
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function FeedbackModal({ challenge, onClose }: FeedbackModalProps) {
  const { user } = useAuth()

  // One saved attempt per speaking task (scoped to this account), so all of the
  // challenge's tasks are reviewable here.
  const attempts = useMemo(() => {
    const tasks = challengeSpeakingTasks(challenge)
    const count = Math.max(tasks.length, 1)
    return Array.from({ length: count }, (_, i) => ({
      prompt: tasks[i] ?? '',
      attempt: getAttempt(challengeTaskId(user?.id, challenge.id, challenge.number, i)) as SavedAttempt | null,
    })).filter((x) => x.attempt)
  }, [user?.id, challenge])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-white bg-white p-5 shadow-2xl sm:p-6"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon />
        </button>

        <h2 className="mb-4 text-lg font-extrabold text-[#1b1730]">
          تقييم التحدي {toArabicDigits(challenge.number)} 📊
        </h2>

        {attempts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-3xl">🗒️</p>
            <p className="text-sm font-semibold text-[#3a3550]">لا يوجد تقييم بعد</p>
            <p className="mt-1 text-[13px] text-[#a39ec0]">
              أكمل مهمة التحدّث أولاً للحصول على تقييم وملاحظات.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {attempts.map(({ prompt, attempt }, i) => (
              <div key={i}>
                {attempts.length > 1 && (
                  <p className="mb-2 text-[13px] font-extrabold text-[#534AB7]">
                    مهمة {toArabicDigits(i + 1)}
                    {prompt ? <span className="font-semibold text-[#7a7596]"> — {prompt}</span> : null}
                  </p>
                )}
                {attempt!.transcript && (
                  <div className="mb-3 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-4" dir="ltr">
                    <p className="mb-1 text-right text-[12px] font-bold text-[#a39ec0]" dir="rtl">
                      النص المُسجّل
                    </p>
                    <p className="text-[15px] leading-relaxed text-[#3a3550]">{attempt!.transcript}</p>
                  </div>
                )}
                <FeedbackView result={attempt!.result} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
