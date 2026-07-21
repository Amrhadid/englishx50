import { Link, useSearchParams } from 'react-router-dom'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import Splash from '../components/Splash'
import MarketingHome from './MarketingHome'
import StudentHome from './StudentHome'

/**
 * PREVIEW-ONLY route (`/rehearsal`).
 *
 * A staging surface for the "separate the homepage for new vs. paid users"
 * work. Real users only ever hit `/` (the untouched Landing), so nothing here
 * is visible to them. This route renders exactly the split we intend to ship
 * on `/`:
 *
 *   - loading                → <Splash/>        (no wrong-page flash)
 *   - premiumActive || admin → <StudentHome/>   (paid dashboard)
 *   - otherwise              → <MarketingHome/> (new-user marketing)
 *
 * Because the site owner is an admin (auto-treated as premium), a `?view=`
 * override lets them preview either side on demand:
 *   /rehearsal              → auto (by real status)
 *   /rehearsal?view=marketing
 *   /rehearsal?view=student
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
  const isAdmin = isAdminEmail(user?.email)
  const [params] = useSearchParams()

  const forced = params.get('view') // 'marketing' | 'student' | null
  const isPaid = premiumActive || isAdmin

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

  const showStudent = forced ? forced === 'student' : isPaid

  return (
    <>
      {showStudent ? <StudentHome /> : <MarketingHome />}
      <RehearsalToggle current={forced ? (showStudent ? 'student' : 'marketing') : 'auto'} isPaid={isPaid} />
    </>
  )
}

function RehearsalToggle({
  current,
  isPaid,
}: {
  current: 'auto' | 'marketing' | 'student'
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
          تلقائي{isPaid ? ' (مشترك)' : ' (زائر)'}
        </Link>
        <Link to="/rehearsal?view=marketing" className={pill(current === 'marketing')}>
          زائر جديد
        </Link>
        <Link to="/rehearsal?view=student" className={pill(current === 'student')}>
          مشترك
        </Link>
      </div>
    </div>
  )
}
