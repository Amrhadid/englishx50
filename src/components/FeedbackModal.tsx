import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toArabicDigits } from '../lib/theme'
import FeedbackView from './FeedbackView'
import type { SpeakingResult } from '../types'

interface FeedbackModalProps {
  challengeNumber?: number
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function FeedbackModal({ challengeNumber, onClose }: FeedbackModalProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<SpeakingResult | null>(null)

  useEffect(() => {
    let active = true
    let student: string | null = null
    try {
      student = localStorage.getItem('x50_user')
    } catch {
      student = null
    }

    if (!supabase || !student) {
      setLoading(false)
      return
    }

    let query = supabase
      .from('x50_submissions')
      .select('passed, feedback')
      .eq('student', student)
      .order('created_at', { ascending: false })
      .limit(1)
    if (challengeNumber != null) query = query.eq('challenge_number', challengeNumber)

    query.then(({ data }) => {
      if (!active) return
      const row = (data ?? [])[0] as { passed: boolean; feedback: SpeakingResult['feedback'] } | undefined
      if (row?.feedback) setResult({ passed: row.passed, feedback: row.feedback })
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [challengeNumber])

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
          {challengeNumber != null ? `تقييم التحدي ${toArabicDigits(challengeNumber)}` : 'تقييمك'} 📊
        </h2>

        {loading ? (
          <p className="py-8 text-center text-sm text-[#7a7596]">جارٍ التحميل…</p>
        ) : result ? (
          <FeedbackView result={result} />
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
