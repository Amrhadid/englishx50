import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isPremium } from '../lib/premium'
import { reportFunctionError } from '../lib/functionError'
import { invokeFeedback, normalizeFeedback } from '../lib/grading'
import {
  LEVEL_TEST_TASK_ID,
  getAttempt,
  saveAttempt,
  getTrials,
  incrementTrials,
  MAX_TRIALS,
} from '../lib/progress'
import { canRecordAudio, recorderOptions, transcribeAudio } from '../lib/transcribe'
import { isAdminEmail } from '../lib/admin'
import { useAuth } from '../hooks/useAuth'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { toArabicDigits } from '../lib/theme'
import FeedbackView from './FeedbackView'
import { MicIcon, CloseIcon } from './icons'
import type { SpeakingResult } from '../types'

/* Design-system colours requested for this feature. */
const PURPLE = '#534AB7'
const TEAL = '#0F6E56'
const CORAL = '#993C1D'

const TEST_SECONDS = 60

type Step = 'speak' | 'feedback'
type Outcome = 'passed' | 'failed' | 'rejected'

/** Rough complete-sentence count from a (often unpunctuated) transcript. */
function countSentences(text: string): number {
  const byPunct = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byPunct.length >= 2) return byPunct.length
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(byPunct.length, Math.round(words / 7))
}

export default function LevelTest({ onUpgrade }: { onUpgrade?: () => void }) {
  const [open, setOpen] = useState(false)
  const { student } = useOnboardingContext()

  // The level test (Pre task) is premium-only. A visitor counts as premium if
  // they unlocked in this browser (isPremium) OR they're a signed-in user whose
  // account already has a redeemed code — otherwise returning premium users on
  // a fresh browser would wrongly see the upgrade popup. Non-premium visitors
  // still see the card, but tapping it opens the upgrade popup instead.
  const premium = isPremium() || !!student?.code

  const handleStart = () => {
    if (premium) setOpen(true)
    else onUpgrade?.()
  }

  return (
    <>
      {/* Card — matches the challenge card size/style, sits before Challenge 1 */}
      <div className="group grid min-h-[180px] grid-cols-[120px_1fr] overflow-hidden rounded-[24px] border-[1.5px] border-[#ede8ff] bg-white transition duration-300 hover:border-[#c4b8ff] hover:shadow-[0_8px_32px_rgba(83,74,183,0.14)] sm:grid-cols-[280px_1fr]">
        <button
          onClick={handleStart}
          className="relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, #EDEBFF 0%, #ffffff 100%)` }}
          aria-label="اختبار المستوى"
        >
          <span
            className="pointer-events-none absolute -bottom-2 left-2 text-[64px] font-black leading-none"
            style={{ color: PURPLE, opacity: 0.12 }}
          >
            ★
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-white transition group-hover:scale-110"
              style={{ backgroundColor: PURPLE, boxShadow: `0 8px 24px ${PURPLE}66` }}
            >
              <MicIcon className="h-6 w-6" />
            </span>
          </span>
        </button>

        <div
          className="flex flex-col justify-center gap-3 px-7 py-6"
          dir="rtl"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-bold" style={{ color: PURPLE }}>
              ابدأ من هنا
            </p>
            <h3 className="flex items-center gap-2 text-[22px] font-black leading-tight text-[#1b1730]">
              اختبار المستوى
              {!premium && <LockBadge />}
            </h3>
            <p className="text-[13px] font-semibold leading-relaxed text-[#7a7596]">
              قيّم مستواك في التحدّث قبل ما تبدأ التحدي الأول
            </p>
          </div>

          <div>
            <button
              onClick={handleStart}
              className="rounded-[30px] px-[20px] py-2.5 text-[13px] font-bold text-white transition hover:brightness-95"
              style={{ backgroundColor: PURPLE }}
            >
              ابدأ الاختبار
            </button>
          </div>
        </div>
      </div>

      {open && <LevelTestModal onClose={() => setOpen(false)} />}
    </>
  )
}

/** Small lock pill shown next to the title for non-premium visitors. */
function LockBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
      style={{ backgroundColor: PURPLE }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="2" />
      </svg>
      مميّز
    </span>
  )
}

function LevelTestModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('speak')

  // Recording
  const [supported, setSupported] = useState(true)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS)
  const [recError, setRecError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  // Feedback
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [rejectMsg, setRejectMsg] = useState<string | null>(null)

  // Every user gets MAX_TRIALS grading attempts; the admin is unlimited.
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const [trialsUsed, setTrialsUsed] = useState(() => getTrials(LEVEL_TEST_TASK_ID))
  const canTry = isAdmin || trialsUsed < MAX_TRIALS

  useEffect(() => {
    if (!canRecordAudio()) setSupported(false)
    return () => {
      try {
        recorderRef.current?.stop()
      } catch {
        /* recorder already inactive */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Restore a previously completed attempt: reopening the pre task shows the
  // saved transcript + the same feedback instead of the recording UI.
  useEffect(() => {
    const saved = getAttempt(LEVEL_TEST_TASK_ID)
    if (saved && (saved.outcome === 'passed' || saved.outcome === 'failed')) {
      setTranscript(saved.transcript)
      setResult(saved.result)
      setOutcome(saved.outcome)
      setStep('feedback')
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopRecording = () => {
    try {
      recorderRef.current?.stop()
    } catch {
      /* recorder already inactive */
    }
    setRecording(false)
    stopTimer()
  }

  // Record the answer, then send the audio to the `whisper` Edge Function and
  // use the returned transcript (replaces the browser Web Speech API).
  const startRecording = async () => {
    setRecError(null)
    setResult(null)
    setOutcome(null)
    setRejectMsg(null)
    if (!canTry) {
      setRecError('لقد استخدمت محاولتيك لهذه المهمة')
      return
    }
    if (!canRecordAudio()) {
      setSupported(false)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setRecError('لم يتم السماح باستخدام الميكروفون')
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
        setRecError(`تعذّر تحويل الصوت إلى نص، حاول مرة أخرى — ${res.detail}`)
        return
      }
      setTranscript(res.transcript)
    }
    recorderRef.current = rec
    rec.start()
    setRecording(true)
    setSecondsLeft(TEST_SECONDS)

    stopTimer()
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopRecording()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const getFeedback = async () => {
    if (!canTry) {
      setRecError('لقد استخدمت محاولتيك لهذه المهمة')
      return
    }
    if (!supabase) {
      setRecError('الخدمة غير متاحة حالياً')
      return
    }
    setStep('feedback')
    setLoading(true)
    setRejectMsg(null)
    setOutcome(null)
    setResult(null)

    const { data, error } = await invokeFeedback({
      question: 'Introduce yourself in English',
      transcript,
      mode: 'level_test',
    })

    setLoading(false)

    if (error || !data) {
      const detail = await reportFunctionError('level test', error)
      setRecError(`تعذّر تقييم الإجابة، حاول مرة أخرى — ${detail}`)
      setStep('speak')
      return
    }

    const mapped = normalizeFeedback(data)

    // Client-side rejection rules.
    const sentences = countSentences(transcript)
    if (sentences < 4) {
      setRejectMsg('يجب أن تتكلم على الأقل 4 جمل كاملة، حاول مرة أخرى')
      setOutcome('rejected')
      return
    }
    if (mapped.passed === false && mapped.score < 30) {
      setRejectMsg('الموضوع يجب أن يكون عن تقديم نفسك بالإنجليزية، حاول مرة أخرى')
      setOutcome('rejected')
      return
    }

    const finalOutcome: Outcome = mapped.passed ? 'passed' : 'failed'
    setResult(mapped)
    setOutcome(finalOutcome)
    saveAttempt(LEVEL_TEST_TASK_ID, { transcript, result: mapped, outcome: finalOutcome })
    if (!isAdmin) setTrialsUsed(incrementTrials(LEVEL_TEST_TASK_ID))
  }

  const retry = () => {
    setTranscript('')
    setResult(null)
    setOutcome(null)
    setRejectMsg(null)
    setRecError(null)
    setSecondsLeft(TEST_SECONDS)
    setStep('speak')
  }

  const goToChallengeOne = () => {
    onClose()
    // Defer so the modal is unmounted before scrolling.
    setTimeout(() => {
      document.getElementById('challenge-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  // Countdown ring geometry.
  const R = 54
  const C = 2 * Math.PI * R
  const offset = C * (1 - secondsLeft / TEST_SECONDS)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-6 w-full max-w-2xl rounded-[28px] border border-white bg-[#fdfcff] shadow-2xl"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f2fc] text-[#8a85a0] transition hover:bg-[#ece8f8]"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="px-5 py-8 sm:px-8">
          <div className="mb-6 text-center">
            <span
              className="mb-2 inline-block rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
              style={{ backgroundColor: PURPLE }}
            >
              اختبار المستوى
            </span>
          </div>

          {step === 'speak' ? (
            /* Speaking task */
            <div className="mx-auto flex max-w-md flex-col items-center">
              <p className="mb-1 text-[13px] font-bold" style={{ color: PURPLE }}>
                🎤 مهمة التحدّث
              </p>
              <h2 className="mb-6 text-center text-2xl font-black leading-snug text-[#1b1730]">
                تكلم عن نفسك بالإنجليزية لمدة دقيقة
              </h2>

              {!supported && (
                <p className="mb-4 rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
                  متصفحك لا يدعم التسجيل الصوتي. استخدم Google Chrome على الكمبيوتر أو الأندرويد.
                </p>
              )}

              {supported && (
                <>
                  {/* Countdown ring with the mic in the centre */}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={transcribing}
                    className="relative flex h-[140px] w-[140px] items-center justify-center disabled:opacity-60"
                    aria-label={recording ? 'إيقاف التسجيل' : 'ابدأ التسجيل'}
                  >
                    <svg width="140" height="140" viewBox="0 0 120 120" className="absolute inset-0">
                      <circle cx="60" cy="60" r={R} fill="none" stroke="#ECEAFF" strokeWidth="8" />
                      <circle
                        cx="60"
                        cy="60"
                        r={R}
                        fill="none"
                        stroke={recording ? CORAL : PURPLE}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={offset}
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <span
                      className={`flex h-20 w-20 flex-col items-center justify-center rounded-full text-white ${
                        recording ? 'animate-pulse' : ''
                      }`}
                      style={{ backgroundColor: recording ? CORAL : PURPLE }}
                    >
                      {recording ? (
                        <span className="text-2xl font-black tabular-nums">
                          {toArabicDigits(secondsLeft)}
                        </span>
                      ) : (
                        <MicIcon className="h-8 w-8" />
                      )}
                    </span>
                  </button>

                  <p className="mt-4 text-[13px] font-semibold text-[#7a7596]">
                    {transcribing
                      ? 'جارٍ تحويل الصوت إلى نص…'
                      : recording
                        ? 'جارٍ التسجيل… اضغط للإيقاف'
                        : 'اضغط لبدء التسجيل (دقيقة واحدة)'}
                  </p>
                  {!isAdmin && (
                    <p className="mt-1 text-[12px] font-semibold text-[#a39ec0]">
                      المحاولات المتبقية: {toArabicDigits(Math.max(0, MAX_TRIALS - trialsUsed))}
                    </p>
                  )}
                </>
              )}

              {transcript && (
                <div className="mt-5 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-4" dir="ltr">
                  <p className="mb-1 text-right text-[12px] font-bold text-[#a39ec0]" dir="rtl">
                    النص المُسجّل
                  </p>
                  <p className="text-[15px] leading-relaxed text-[#3a3550]">{transcript}</p>
                </div>
              )}

              {recError && (
                <p className="mt-3 text-center text-[13px] font-semibold" style={{ color: CORAL }}>
                  {recError}
                </p>
              )}

              {transcript && !recording && canTry && (
                <button
                  onClick={getFeedback}
                  className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                  style={{ backgroundColor: TEAL }}
                >
                  احصل على التقييم
                </button>
              )}

              {!canTry && (
                <p className="mt-5 rounded-2xl bg-[#FEEFD2] p-4 text-center text-sm font-semibold text-[#A66A09]">
                  لقد استخدمت محاولتيك لهذه المهمة.
                </p>
              )}
            </div>
          ) : (
            /* Feedback */
            <div className="mx-auto max-w-md">
              {!loading && transcript && (outcome === 'passed' || outcome === 'failed') && (
                <div className="mb-4 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] p-4" dir="ltr">
                  <p className="mb-1 text-right text-[12px] font-bold text-[#a39ec0]" dir="rtl">
                    النص المُسجّل
                  </p>
                  <p className="text-[15px] leading-relaxed text-[#3a3550]">{transcript}</p>
                </div>
              )}
              {loading ? (
                <p className="py-10 text-center text-sm font-semibold text-[#7a7596]">
                  جارٍ تقييم إجابتك…
                </p>
              ) : outcome === 'rejected' ? (
                <div className="py-6 text-center">
                  <p className="mb-3 text-4xl">🚫</p>
                  <p className="mb-5 text-[15px] font-bold leading-relaxed" style={{ color: CORAL }}>
                    {rejectMsg}
                  </p>
                  <button
                    onClick={retry}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                    style={{ backgroundColor: PURPLE }}
                  >
                    حاول مرة أخرى
                  </button>
                </div>
              ) : outcome === 'failed' && result ? (
                <div className="py-4 text-center">
                  <div
                    className="mx-auto mb-4 flex h-28 w-28 flex-col items-center justify-center rounded-full text-white shadow-lg"
                    style={{ backgroundColor: CORAL }}
                  >
                    <span className="text-4xl font-black leading-none">{result.score}</span>
                    <span className="mt-1 text-xs font-bold opacity-90">من ١٠٠</span>
                  </div>
                  <p className="mb-1 text-lg font-extrabold" style={{ color: CORAL }}>
                    لسه محتاج شوية مجهود 💪
                  </p>
                  <p className="mb-5 text-[14px] leading-relaxed text-[#3a3550]">
                    مستواك كويس وفيه أساس تبني عليه — كمّل التحديات وهتتطور بسرعة إن شاء الله.
                  </p>
                  {canTry ? (
                    <button
                      onClick={retry}
                      className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                      style={{ backgroundColor: PURPLE }}
                    >
                      حاول مرة أخرى
                    </button>
                  ) : (
                    <p className="text-[13px] font-semibold text-[#a39ec0]">
                      لقد استخدمت محاولتيك لهذه المهمة.
                    </p>
                  )}
                </div>
              ) : outcome === 'passed' && result ? (
                <div>
                  <FeedbackView result={result} />
                  <button
                    onClick={goToChallengeOne}
                    className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                    style={{ backgroundColor: TEAL }}
                  >
                    ابدأ التحدي ←
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
