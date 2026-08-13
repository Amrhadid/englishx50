import { Link, useSearchParams } from 'react-router-dom'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import Splash from '../components/Splash'
import Home from './Home'
import StudentHome from './StudentHome'
import RedeemPanel from '../components/RedeemPanel'

/**
 * PREVIEW-ONLY route (`/rehearsal`).
 *
 * Renders the shipped UI, not a separate copy of it — the homepage hub, the
 * subscriber's challenges, and the code gate — with a toggle so the site owner
 * (who is an admin, and therefore always counts as subscribed) can look at any
 * of them on demand:
 *
 *   /rehearsal            → auto (the homepage hub, exactly like `/`)
 *   /rehearsal?view=student
 *   /rehearsal?view=redeem
 */
export default function Rehearsal() {
  return (
    <OnboardingProvider>
      <RehearsalInner />
    </OnboardingProvider>
  )
}

function RehearsalInner() {
  const { premiumActive, loading } = useOnboardingContext()
  const { user } = useAuth()
  const isPaid = premiumActive || isAdminEmail(user?.email)
  const [params] = useSearchParams()

  const forced = params.get('view') // 'student' | 'redeem' | null

  // Only wait on `loading` when we're auto-deciding — a forced view can render
  // immediately.
  if (!forced && loading) {
    return (
      <>
        <Splash />
        <RehearsalToggle current="auto" isPaid={isPaid} />
      </>
    )
  }

  return (
    <>
      {forced === 'student' ? <StudentHome /> : forced === 'redeem' ? <RedeemPanel /> : <Home />}
      <RehearsalToggle current={forced === 'student' ? 'student' : forced === 'redeem' ? 'redeem' : 'auto'} isPaid={isPaid} />
    </>
  )
}

function RehearsalToggle({
  current,
  isPaid,
}: {
  current: 'auto' | 'student' | 'redeem'
  isPaid: boolean
}) {
  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[12px] font-extrabold transition ${
      active ? 'bg-[#1b1730] text-white' : 'text-[#6b6685] hover:bg-[#f1edff]'
    }`

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
      dir="rtl"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-[#ece7fb] bg-white/95 p-1.5 shadow-2xl backdrop-blur">
        <span className="px-2.5 text-[11px] font-black text-[#8B5CF6]">👀 معاينة</span>
        <Link to="/rehearsal" className={pill(current === 'auto')}>
          الرئيسية{isPaid ? ' (مشترك)' : ' (زائر)'}
        </Link>
        <Link to="/rehearsal?view=student" className={pill(current === 'student')}>
          التحديات
        </Link>
        <Link to="/rehearsal?view=redeem" className={pill(current === 'redeem')}>
          تفعيل الكود
        </Link>
      </div>
    </div>
  )
}
