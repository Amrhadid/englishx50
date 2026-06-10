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
  setStoredTrials,
  serverTaskKey,
  fetchServerTrials,
  MAX_TRIALS,
} from '../lib/progress'
import { LiveSession, canLiveTranscribe } from '../lib/liveTranscribe'
import { uploadAudio } from '../lib/audio'
import { isAdminEmail } from '../lib/admin'
import { useAuth } from '../hooks/useAuth'
import FeedbackView from './FeedbackView'
import AnalysisLoader from './AnalysisLoader'
import type { SpeakingResult } from '../types'

interface SpeakingTaskProps {
  question: string
  challengeNumber?: number
  challengeId?: string
  student?: string
  /** Index of this speaking task within the challenge (for per-task storage). */
  taskIndex?: number
  /** Called after a successful grade (used to re-check challenge completion). */
  onSubmitted?: () => void
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function SpeakingTask({
  question,
  challengeNumber,
  challengeId,
  student,
  taskIndex = 0,
  onSubmitted,
}: SpeakingTaskProps) {
  // Every user gets MAX_TRIALS grading attempts per task; the admin is unlimited.
  // Saved attempts/trials are scoped to the account so they never leak between
  // accounts on the same browser.
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const taskId = challengeTaskId(user?.id, challengeId, challengeNumber, taskIndex)

  const [supported, setSupported] = useState(() => canLiveTranscribe())
  const [recording, setRecording] = useState(false)
  const [live, setLive] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  // Restore a previously completed attempt: show the saved transcript + feedback
  // instead of a fresh recording when this task is reopened.
  const [transcript, setTranscript] = useState(() => getAttempt(taskId)?.transcript ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeakingResult | null>(() => getAttempt(taskId)?.result ?? null)
  const sessionRef = useRef<LiveSession | null>(null)

  const [trials, setTrials] = useState(() => ({ taskId, used: getTrials(taskId) }))
  if (trials.taskId !== taskId) {
    // The signed-in account resolved after mount (storage scope moved from
    // "anon" to the account) — re-read this task's trials and saved attempt.
    setTrials({ taskId, used: getTrials(taskId) })
    const saved = getAttempt(taskId)
    setTranscript(saved?.transcript ?? '')
    setResult(saved?.result ?? null)
  }
  const trialsUsed = trials.used
  const canTry = isAdmin || trialsUsed < MAX_TRIALS

  useEffect(() => {
    return () => sessionRef.current?.cancel()
  }, [])

  // The attempt limit is enforced server-side (x50_trials) — clearing the
  // browser no longer resets it. Pull the authoritative count so the UI
  // matches what the server will allow.
  useEffect(() => {
    if (isAdmin || !user) return
    let active = true
    fetchServerTrials(serverTaskKey(challengeId, challengeNumber, taskIndex), user.id).then(
      (server) => {
        if (!active || server == null) return
        setStoredTrials(taskId, Math.max(server, getTrials(taskId)))
        setTrials((t) => (t.taskId === taskId && server > t.used ? { taskId, used: server } : t))
      },
    )
    return () => {
      active = false
    }
  }, [taskId, isAdmin, user, challengeId, challengeNumber, taskIndex])

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
    setTranscript(text)
    if (text.trim().length >= 2) {
      // Store the recording (R2) so the admin can play it; keep the analysis
      // loader up through the upload so it doesn't flash away.
      const audioKey = await uploadAudio(audio)
      setTranscribing(false)
      grade(text, audioKey)
    } else {
      setTranscribing(false)
      setError('لم نلتقط صوتاً واضحاً، حاول مرة أخرى')
    }
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
      taskIndex,
      audioKey,
    })
    setLoading(false)
    if (!outcome.ok) {
      if (outcome.trialLimit) {
        // The server's counter says this task is used up (regardless of what
        // this browser's cache thinks).
        setStoredTrials(taskId, MAX_TRIALS)
        setTrials({ taskId, used: MAX_TRIALS })
        setError('لقد استخدمت محاولتيك لهذه المهمة')
        return
      }
      setError(`تعذّر تقييم الإجابة، حاول مرة أخرى — ${outcome.detail}`)
      return
    }
    setResult(outcome.result)
    saveAttempt(taskId, {
      transcript: text,
      result: outcome.result,
      outcome: outcome.result.passed ? 'passed' : 'failed',
    })
    if (!isAdmin) {
      // Prefer the server's count; fall back to the local one if the function
      // didn't report it (e.g. not redeployed yet).
      const used = outcome.trialsUsed ?? incrementTrials(taskId)
      if (outcome.trialsUsed != null) setStoredTrials(taskId, used)
      setTrials({ taskId, used })
    }
    onSubmitted?.()
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

      {/* Recorder — hidden once a result is shown (retry brings it back) and
          while the recording is being transcribed/graded. */}
      {supported && !result && canTry && !transcribing && !loading && (
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

      {/* Active analysis animation — covers voice-to-text + AI grading. */}
      {(transcribing || (loading && !result)) && (
        <AnalysisLoader
          label={transcribing ? 'جارٍ تحويل الصوت إلى نص…' : 'جارٍ تحليل إجابتك بالذكاء الاصطناعي…'}
        />
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
