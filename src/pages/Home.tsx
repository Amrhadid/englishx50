import { Link } from 'react-router-dom'
import { UI } from '../lib/theme'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import DaysLeftBadge from '../components/DaysLeftBadge'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'

/**
 * The homepage: two doors and nothing else.
 *
 *   ابدأ التحدي   → /challenge  (for someone who already subscribed)
 *   انضم للتحدي   → /join       (for someone who wants to subscribe)
 *
 * Whichever one applies to the visitor leads, but both stay
 * visible — the code box is gone from the join flow entirely, so an existing
 * subscriber has to be able to find their way in from here.
 *
 * Assumes an <OnboardingProvider> ancestor.
 */
export default function Home() {
  const { premiumActive, student, daysLeft } = useOnboardingContext()
  const { user, signOut } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const subscribed = premiumActive || isAdmin

  const firstName = (student?.name ?? '').trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader>
        {student?.code && <DaysLeftBadge daysLeft={daysLeft} />}
        {isAdmin && (
          <Link
            to="/admin"
            className="rounded-xl px-4 py-2 text-[14px] font-bold text-white"
            style={{ backgroundColor: UI.ink }}
          >
            Admin
          </Link>
        )}
        {user && (
          <button onClick={signOut} className="text-[14px] font-bold underline" style={{ color: UI.muted }}>
            خروج
          </button>
        )}
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20" dir="rtl">
        {/* Headline */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h1
            className="text-[38px] font-black leading-[1.12] tracking-tight sm:text-[58px]"
            style={{ color: UI.ink }}
          >
            {firstName ? (
              <>
                أهلاً <span style={{ color: UI.pinkInk }}>{firstName}</span> 👋
              </>
            ) : (
              <>
                تحدي <span style={{ color: UI.pinkInk }}>جديد</span> كل ٥ أيام
              </>
            )}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed sm:text-[19px]" style={{ color: UI.muted }}>
            تتكلّم إنجليزي فعليًا في كل تحدي — مصدر، مهمة، درس، تسجيل، وتقييم يقول لك تتحسن فين.
          </p>
        </div>

        {/* The two doors */}
        <div className="grid gap-5 md:grid-cols-2">
          <HomeCard
            to="/challenge"
            title="ابدأ التحدي"
            subtitle="لو انت مشترك بالفعل"
            desc="ادخل بحسابك وكمّل تحدياتك من حيث توقفت."
            cta="ابدأ التحدي"
            primary={subscribed}
          />
          <HomeCard
            to="/join"
            title="انضم للتحدي"
            subtitle="لو حابب تشترك"
            desc="شاهد الفيديو التعريفي واعرف كل تفاصيل التحدي قبل ما تشترك."
            cta="انضم الآن"
            primary={!subscribed}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function HomeCard({
  to,
  title,
  subtitle,
  desc,
  cta,
  primary,
}: {
  to: string
  title: string
  subtitle: string
  desc: string
  cta: string
  primary: boolean
}) {
  return (
    <div
      className="flex flex-col rounded-[20px] border p-7 sm:p-9"
      style={{ borderColor: primary ? UI.ink : UI.line, backgroundColor: primary ? UI.sand : '#fff' }}
    >
      <span
        className="mb-4 inline-flex w-fit rounded-full px-3 py-1 text-[12.5px] font-bold"
        style={{ backgroundColor: primary ? UI.pinkSoft : '#F1EFEC', color: primary ? UI.pinkInk : UI.muted }}
      >
        {subtitle}
      </span>
      <h2 className="text-[30px] font-black leading-tight tracking-tight sm:text-[34px]" style={{ color: UI.ink }}>
        {title}
      </h2>
      <p className="mt-3 flex-1 text-[16px] leading-relaxed" style={{ color: UI.muted }}>
        {desc}
      </p>
      <Link
        to={to}
        className="mt-7 flex items-center justify-center gap-2 rounded-[14px] px-6 py-4 text-[17px] font-bold transition hover:brightness-95"
        style={
          primary
            ? { backgroundColor: UI.pink, color: UI.ink }
            : { backgroundColor: '#fff', color: UI.ink, boxShadow: `inset 0 0 0 2px ${UI.ink}` }
        }
      >
        {cta}
        <span aria-hidden="true">←</span>
      </Link>
    </div>
  )
}
