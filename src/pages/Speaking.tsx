import { useSearchParams, Link } from 'react-router-dom'
import SpeakingTask from '../components/SpeakingTask'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'

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
  const { user } = useAuth()
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
