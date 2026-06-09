import { useEffect, useState } from 'react'
import { toArabicDigits } from '../lib/theme'
import { challengeTaskId, getAttempt } from '../lib/progress'
import { useAuth } from '../hooks/useAuth'
import FeedbackView from './FeedbackView'
import type { Challenge, SpeakingResult } from '../types'

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
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    // Show only THIS account's saved attempt for this task (scoped per user, so
    // feedback never leaks between accounts on the same browser).
    const saved = getAttempt(challengeTaskId(user?.id, challenge.id, challenge.number))
    if (saved) {
      setResult(saved.result)
      setTranscript(saved.transcript)
    }
    setLoading(false)
  }, [user?.id, challenge.id, challenge.number])

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

        {loading ? (
          <p className="py-8 text-center text-sm text-[#7a7596]">جارٍ التحميل…</p>
        ) : result ? (
          <>
            {transcript && (
              <div className="mb-4 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-4" dir="ltr">
                <p className="mb-1 text-right text-[12px] font-bold text-[#a39ec0]" dir="rtl">
                  النص المُسجّل
                </p>
                <p className="text-[15px] leading-relaxed text-[#3a3550]">{transcript}</p>
              </div>
            )}
            <FeedbackView result={result} />
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="mb-2 text-3xl">🗒️</p>
            <p className="text-sm font-semibold text-[#3a3550]">لا يوجد تقييم بعد</p>
            <p className="mt-1 text-[13px] text-[#a39ec0]">
              أكمل مهمة التحدّث أولاً للحصول على تقييم وملاحظات.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
