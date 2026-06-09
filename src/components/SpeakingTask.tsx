import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRAND_GRADIENT, toArabicDigits } from '../lib/theme'
import { gradeSpeaking } from '../lib/grading'
import {
  challengeTaskId,
  getAttempt,
  saveAttempt,
  getTrials,
  incrementTrials,
  MAX_TRIALS,
} from '../lib/progress'
import { LiveSession, canLiveTranscribe } from '../lib/liveTranscribe'
import { uploadAudio } from '../lib/audio'
import { isAdminEmail } from '../lib/admin'
import { useAuth } from '../hooks/useAuth'
import FeedbackView from './FeedbackView'
import type { SpeakingResult } from '../types'

interface SpeakingTaskProps {
  question: string
  challengeNumber?: number
  challengeId?: string
  student?: string
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function SpeakingTask({ question, challengeNumber, challengeId, student }: SpeakingTaskProps) {
  const [supported, setSupported] = useState(true)
  const [recording, setRecording] = useState(false)
  const [live, setLive] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const sessionRef = useRef<LiveSession | null>(null)
  const taskId = challengeTaskId(challengeId, challengeNumber)

  // Every user gets MAX_TRIALS grading attempts per task; the admin is unlimited.
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const [trialsUsed, setTrialsUsed] = useState(() => getTrials(taskId))
  const canTry = isAdmin || trialsUsed < MAX_TRIALS

  useEffect(() => {
    if (!canLiveTranscribe()) setSupported(false)
    return () => sessionRef.current?.cancel()
  }, [])

  // Restore a previously completed attempt: show the saved transcript + feedback
  // instead of a fresh recording when this task is reopened.
  useEffect(() => {
    const saved = getAttempt(taskId)
    if (saved) {
      setTranscript(saved.transcript)
      setResult(saved.result)
    }
  }, [taskId])

  // Live transcription (OpenAI Realtime) with a batch fallback; the transcript
  // streams in word-by-word while recording, then grades automatically on stop.
  const start = async () => {
    setError(null)
    setResult(null)
    if (!canLiveTranscribe()) {
      setSupported(false)
      return
    }
    setLive(false)
    const session = new LiveSession({ onPartial: (t) => setTranscript(t), onLive: () => setLive(true) })
    sessionRef.current = session
    setTranscript('')
    try {
      await session.start()
    } catch {
      sessionRef.current = null
      setError('لم يتم السماح باستخدام الميكروفون')
      return
    }
    setRecording(true)
  }

  const stop = async () => {
    const session = sessionRef.current
    if (!session) return
    sessionRef.current = null
    setRecording(false)
    setLive(false)
    setTranscribing(true)
    const { transcript: text, audio } = await session.stop()
    setTranscribing(false)
    setTranscript(text)
    if (text.trim().length >= 2) {
      // Store the recording (R2) so the admin can play it; grade in parallel.
      const audioKey = await uploadAudio(audio)
      grade(text, audioKey)
    } else setError('لم نلتقط صوتاً واضحاً، حاول مرة أخرى')
  }

  const grade = async (text: string, audioKey: string | null = null) => {
    if (text.trim().length < 2) {
      setError('سجّل إجابتك أولاً')
      return
    }
    if (!canTry) {
      setError('لقد استخدمت محاولتيك لهذه المهمة')
      return
    }
    if (!supabase) {
      setError('الخدمة غير متاحة حالياً')
      return
    }
    setLoading(true)
    setError(null)
    const outcome = await gradeSpeaking({
      question,
      transcript: text,
      student,
      challengeId,
      challengeNumber,
      audioKey,
    })
    setLoading(false)
    if (!outcome.ok) {
      setError(`تعذّر تقييم الإجابة، حاول مرة أخرى — ${outcome.detail}`)
      return
    }
    setResult(outcome.result)
    saveAttempt(taskId, {
      transcript: text,
      result: outcome.result,
      outcome: outcome.result.passed ? 'passed' : 'failed',
    })
    if (!isAdmin) setTrialsUsed(incrementTrials(taskId))
  }

  const reset = () => {
    setTranscript('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8" dir="rtl">
      {/* Question */}
      <div className="rounded-[28px] border border-[#efeafc] bg-white p-6 shadow-[0_10px_36px_-18px_rgba(124,111,240,0.35)]">
        {challengeNumber != null && (
          <span
            className="mb-3 inline-block rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            التحدي {toArabicDigits(challengeNumber)}
          </span>
        )}
        <p className="mb-1 text-[13px] font-bold text-[#7C6FF0]">🎤 مهمة التحدّث</p>
        <h2 className="text-xl font-extrabold text-[#1b1730]">{question}</h2>
        <p className="mt-2 text-[13px] text-[#7a7596]">
          سجّل إجابتك بالصوت — تحتاج ٣ جمل كاملة على الأقل مرتبطة بالسؤال لإكمال المهمة.
        </p>
      </div>

      {!supported && (
        <p className="mt-4 rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
          متصفحك لا يدعم التسجيل الصوتي. استخدم Google Chrome على الكمبيوتر أو الأندرويد.
        </p>
      )}

      {/* No attempts left */}
      {supported && !result && !canTry && (
        <p className="mt-5 rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
          لقد استخدمت محاولتيك لهذه المهمة.
        </p>
      )}

      {/* Recorder — hidden once a result is shown (retry brings it back). */}
      {supported && !result && canTry && (
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={recording ? stop : start}
            disabled={transcribing}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition disabled:opacity-60 ${
              recording ? 'animate-pulse bg-[#F25C8A]' : ''
            }`}
            style={recording ? undefined : { background: BRAND_GRADIENT }}
            aria-label={recording ? 'إيقاف التسجيل' : 'ابدأ التسجيل'}
          >
            <MicIcon />
          </button>
          <p className="mt-3 text-[13px] font-semibold text-[#7a7596]">
            {transcribing
              ? 'جارٍ تحويل الصوت إلى نص…'
              : recording
                ? 'جارٍ التسجيل… اضغط للإيقاف'
                : 'اضغط لبدء التسجيل'}
          </p>
          {recording && live && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#DC2626]" />
              مباشر
            </span>
          )}
          {!isAdmin && (
            <p className="mt-1 text-[12px] font-semibold text-[#a39ec0]">
              المحاولات المتبقية: {toArabicDigits(Math.max(0, MAX_TRIALS - trialsUsed))}
            </p>
          )}
        </div>
      )}

      {/* Transcript */}
      {transcript && (
        <div className="mt-5 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-4 text-right" dir="ltr">
          <p className="mb-1 text-right text-[12px] font-bold text-[#a39ec0]" dir="rtl">
            النص المُسجّل
          </p>
          <p className="text-[15px] leading-relaxed text-[#3a3550]">{transcript}</p>
        </div>
      )}

      {error && <p className="mt-3 text-center text-[13px] font-semibold text-[#C2410C]">{error}</p>}

      {/* Grading runs automatically after transcription */}
      {loading && !result && (
        <p className="mt-5 text-center text-sm font-semibold text-[#7a7596]">جارٍ التقييم…</p>
      )}

      {/* Feedback */}
      {result && (
        <div className="mt-6">
          <FeedbackView result={result} onRetry={canTry ? reset : undefined} />
          {!canTry && (
            <p className="mt-3 text-center text-[12px] font-semibold text-[#a39ec0]">
              لقد استخدمت محاولتيك لهذه المهمة.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
