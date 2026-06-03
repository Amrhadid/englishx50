import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRAND_GRADIENT, toArabicDigits } from '../lib/theme'
import type { SpeakingResult } from '../types'

interface SpeakingTaskProps {
  question: string
  challengeNumber?: number
  challengeId?: string
  student?: string
}

// Minimal typing for the browser SpeechRecognition API (not in lib.dom yet).
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
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
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeakingResult | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    if (!getRecognition()) setSupported(false)
    return () => recognitionRef.current?.stop()
  }, [])

  const start = () => {
    setError(null)
    setResult(null)
    const rec = getRecognition()
    if (!rec) {
      setSupported(false)
      return
    }
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) finalText += text + ' '
        else interim += text
      }
      setTranscript((finalText + interim).trim())
    }
    rec.onerror = (ev) => {
      setError(ev.error === 'not-allowed' ? 'لم يتم السماح باستخدام الميكروفون' : 'تعذّر التسجيل، حاول مرة أخرى')
      setRecording(false)
    }
    rec.onend = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
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
    const { data, error: fnErr } = await supabase.functions.invoke('speaking-feedback', {
      body: { question, transcript, student, challengeId, challengeNumber },
    })
    setLoading(false)
    if (fnErr || !data) {
      setError('تعذّر تقييم الإجابة، حاول مرة أخرى')
      return
    }
    setResult(data as SpeakingResult)
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

      {/* Recorder */}
      {supported && (
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={recording ? stop : start}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition ${
              recording ? 'animate-pulse bg-[#F25C8A]' : ''
            }`}
            style={recording ? undefined : { background: BRAND_GRADIENT }}
            aria-label={recording ? 'إيقاف التسجيل' : 'ابدأ التسجيل'}
          >
            <MicIcon />
          </button>
          <p className="mt-3 text-[13px] font-semibold text-[#7a7596]">
            {recording ? 'جارٍ التسجيل… اضغط للإيقاف' : 'اضغط لبدء التسجيل'}
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
      {result && <Feedback result={result} onRetry={reset} />}
    </div>
  )
}

function Feedback({ result, onRetry }: { result: SpeakingResult; onRetry: () => void }) {
  const f = result.feedback
  return (
    <div className="mt-6 space-y-4">
      {/* Status + score */}
      <div
        className={`rounded-[24px] p-5 text-center text-white ${result.passed ? '' : 'bg-[#C2410C]'}`}
        style={result.passed ? { background: 'linear-gradient(135deg,#23C4A0,#0F6E56)' } : undefined}
      >
        <p className="text-3xl font-black">{toArabicDigits(f.score)}٪</p>
        <p className="mt-1 text-sm font-bold">
          {result.passed ? 'أحسنت! اكتملت المهمة ✓' : 'لم تكتمل بعد — تحتاج ٣ جمل كاملة مرتبطة بالسؤال'}
        </p>
        <p className="mt-1 text-[12px] text-white/90">
          عدد الجمل الكاملة: {toArabicDigits(f.complete_sentence_count)}
        </p>
      </div>

      {f.overall && (
        <div className="rounded-2xl border border-[#efeafc] bg-white p-4">
          <p className="text-[14px] leading-relaxed text-[#3a3550]">{f.overall}</p>
        </div>
      )}

      {f.strengths.length > 0 && (
        <Card title="✅ نقاط القوة" tint="#E1F5EE" color="#0C7C62">
          <ul className="list-disc space-y-1 pr-5 text-[14px] text-[#3a3550]">
            {f.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      {f.mistakes.length > 0 && (
        <Card title="✏️ أخطاء وتصحيحات" tint="#FFE7DB" color="#C2410C">
          <ul className="space-y-2">
            {f.mistakes.map((m, i) => (
              <li key={i} className="text-[14px]" dir="ltr">
                <span className="text-[#C2410C] line-through">{m.error}</span>
                <span className="mx-2 text-[#a39ec0]">→</span>
                <span className="font-semibold text-[#0C7C62]">{m.correction}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {f.vocabulary.length > 0 && (
        <Card title="📚 كلمات مقترحة" tint="#EDEBFF" color="#473BBE">
          <ul className="space-y-2">
            {f.vocabulary.map((v, i) => (
              <li key={i} className="text-[14px]">
                <span className="font-bold text-[#473BBE]" dir="ltr">
                  {v.word}
                </span>
                <span className="mx-1.5 text-[#7a7596]">— {v.meaning}</span>
                <span className="block text-[12px] text-[#a39ec0]" dir="ltr">
                  {v.example}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button
        onClick={onRetry}
        className="w-full rounded-2xl border border-[#ece7fb] py-3 text-sm font-bold text-[#7C6FF0] hover:bg-[#f1edff]"
      >
        حاول مرة أخرى
      </button>
    </div>
  )
}

function Card({
  title,
  tint,
  color,
  children,
}: {
  title: string
  tint: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#efeafc] bg-white p-4">
      <p className="mb-2 inline-block rounded-full px-3 py-1 text-[12px] font-bold" style={{ backgroundColor: tint, color }}>
        {title}
      </p>
      {children}
    </div>
  )
}
