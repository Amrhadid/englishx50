import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRAND_GRADIENT, toArabicDigits } from '../lib/theme'
import { gradeSpeaking } from '../lib/grading'
import { challengeTaskId, getAttempt, saveAttempt } from '../lib/progress'
import { canRecordAudio, recorderOptions, transcribeAudio } from '../lib/transcribe'
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
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const taskId = challengeTaskId(challengeId, challengeNumber)

  useEffect(() => {
    if (!canRecordAudio()) setSupported(false)
    return () => {
      try {
        recorderRef.current?.stop()
      } catch {
        /* recorder already inactive */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
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

  // Record the answer, then send the audio to the `whisper` Edge Function and
  // use the returned transcript (replaces the browser Web Speech API).
  const start = async () => {
    setError(null)
    setResult(null)
    if (!canRecordAudio()) {
      setSupported(false)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('لم يتم السماح باستخدام الميكروفون')
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const rec = new MediaRecorder(stream, recorderOptions())
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
      if (blob.size === 0) return
      setTranscribing(true)
      const res = await transcribeAudio(blob)
      setTranscribing(false)
      if (!res.ok) {
        setError(`تعذّر تحويل الصوت إلى نص، حاول مرة أخرى — ${res.detail}`)
        return
      }
      setTranscript(res.transcript)
    }
    recorderRef.current = rec
    rec.start()
    setRecording(true)
  }

  const stop = () => {
    try {
      recorderRef.current?.stop()
    } catch {
      /* recorder already inactive */
    }
    setRecording(false)
  }

  const submit = async () => {
    if (transcript.trim().length < 2) {
      setError('سجّل إجابتك أولاً')
      return
    }
    if (!supabase) {
      setError('الخدمة غير متاحة حالياً')
      return
    }
    setLoading(true)
    setError(null)
    const outcome = await gradeSpeaking({ question, transcript, student, challengeId, challengeNumber })
    setLoading(false)
    if (!outcome.ok) {
      setError(`تعذّر تقييم الإجابة، حاول مرة أخرى — ${outcome.detail}`)
      return
    }
    setResult(outcome.result)
    saveAttempt(taskId, {
      transcript,
      result: outcome.result,
      outcome: outcome.result.passed ? 'passed' : 'failed',
    })
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

      {/* Recorder — hidden once a result is shown (retry brings it back). */}
      {supported && !result && (
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

      {/* Actions */}
      {transcript && !result && (
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: BRAND_GRADIENT }}
          >
            {loading ? 'جارٍ التقييم…' : 'احصل على التقييم'}
          </button>
          <button
            onClick={reset}
            className="rounded-2xl border border-[#ece7fb] px-5 py-3.5 text-sm font-bold text-[#7a7596] hover:bg-[#f4f3f7]"
          >
            إعادة
          </button>
        </div>
      )}

      {/* Feedback */}
      {result && (
        <div className="mt-6">
          <FeedbackView result={result} onRetry={reset} />
        </div>
      )}
    </div>
  )
}
