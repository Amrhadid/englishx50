import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import SpeakingTask from '../components/SpeakingTask'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import { checkCode } from '../lib/redeem'

const DEFAULT_QUESTION =
  'Talk about your daily routine and how you stay healthy. Form at least 3 complete sentences.'

export default function Speaking() {
  return (
    <OnboardingProvider>
      <SpeakingInner />
    </OnboardingProvider>
  )
}

// The standalone speaking page drives the same paid AI pipeline as the
// challenge tasks (realtime transcription + Claude grading), so it carries the
// same premium gate — it must not be reachable by direct URL without a
// subscription.
function SpeakingInner() {
  const [params] = useSearchParams()
  const { premiumActive, loading } = useOnboardingContext()
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [codeInput, setCodeInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const handleCodeSubmit = async () => {
    const value = codeInput.trim()
    if (!value) { setCodeError('أدخل الكود أولاً'); return }
    setChecking(true)
    setCodeError(null)
    const status = await checkCode(value)
    setChecking(false)
    if (status === 'used') { setCodeError('هذا الكود مستخدم بالفعل'); return }
    if (status === 'error') { setCodeError('تعذّر التحقق الآن، حاول لاحقاً'); return }
    if (status === 'invalid') { setCodeError('كود غير صحيح'); return }
    navigate(`/?code=${encodeURIComponent(value)}`)
  }
  const question = params.get('q') || DEFAULT_QUESTION
  const num = params.get('n')

  let student: string | undefined
  try {
    student = localStorage.getItem('x50_user') ?? undefined
  } catch {
    student = undefined
  }

  const premium = premiumActive || isAdminEmail(user?.email)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdfcff]">
        <p className="text-sm font-semibold text-[#7a7596]" dir="rtl">
          جارٍ التحميل…
        </p>
      </div>
    )
  }

  if (!premium) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdfcff] px-5" dir="rtl">
        <div className="w-full max-w-sm rounded-[28px] border border-[#ece7fb] bg-white p-8 text-center shadow-sm">
          <p className="mb-3 text-4xl">🔒</p>
          <h1 className="mb-2 text-lg font-extrabold text-[#1b1730]">مهمة التحدّث للمشتركين فقط</h1>
          <p className="mb-6 text-[13px] leading-relaxed text-[#7a7596]">
            سجّل الدخول وفعّل كود الاشتراك من الصفحة الرئيسية للتدرّب مع AI Coach.
          </p>
          <Link
            to="/"
            className="block w-full rounded-2xl bg-[#534AB7] py-3.5 text-sm font-bold text-white transition hover:bg-[#46409c]"
          >
            الرجوع للصفحة الرئيسية
          </Link>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t border-[#ece7fb]" />
            <span className="text-xs text-[#9a95b0]">أو</span>
            <div className="flex-1 border-t border-[#ece7fb]" />
          </div>

          <p className="mb-2 text-right text-[13px] font-bold text-[#1b1730]">عندك كود؟</p>
          {/* Redemption binds the code to a Google account and the code check is
              authenticated-only, so a signed-out visitor signs in first. After
              the redirect they land back signed in on the home page, where
              ?redeem=1 reopens the premium modal with the code box focused. */}
          {user ? (
            <>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                placeholder="أدخل كود الاشتراك"
                className="mb-2 w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-right text-[13px] outline-none transition focus:border-[#7C6FF0] focus:bg-white"
                dir="rtl"
              />
              {codeError && (
                <p className="mb-2 text-right text-[12px] font-semibold text-red-500">{codeError}</p>
              )}
              <button
                onClick={handleCodeSubmit}
                disabled={checking}
                className="w-full rounded-2xl border-2 border-[#7C6FF0] py-3 text-sm font-bold text-[#7C6FF0] transition hover:bg-[#f4f2fc] disabled:opacity-50"
              >
                {checking ? 'جارٍ التحقق…' : 'تفعيل الكود ←'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => signInWithGoogle('?redeem=1')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#7C6FF0] py-3 text-sm font-bold text-[#7C6FF0] transition hover:bg-[#f4f2fc]"
              >
                <span className="text-base">🔑</span>
                الدخول بـ Google لتفعيل الكود
              </button>
              <p className="mt-2 text-[12px] text-[#9a95b0]">
                اشتراكك مرتبط بحسابك ويعمل على أي جهاز بعد تسجيل الدخول.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdfcff]">
      <SpeakingTask
        question={question}
        challengeNumber={num ? Number(num) : undefined}
        student={student}
      />
    </div>
  )
}
