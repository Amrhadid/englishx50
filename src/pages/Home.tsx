import { Link } from 'react-router-dom'
import DaysLeftBadge from '../components/DaysLeftBadge'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'

/**
 * The homepage: two doors and nothing else, in the approved pastel-pink
 * redesign (mockup v2). Same copy, same destinations as before — only the
 * visual design changed.
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
    <div className="x50h" dir="rtl">
      <div className="blob b1" aria-hidden="true" />
      <div className="blob b2" aria-hidden="true" />
      <div className="blob b3" aria-hidden="true" />
      <div className="dots" aria-hidden="true" />

      <div className="page">
        <nav>
          <Link to="/" className="logo" aria-label="EnglishX50">
            English<b>X50</b> <span className="x50badge">50</span>
          </Link>
          <div className="nav-pill">
            <Link to="/challenge">ادخل التحدي</Link>
            <Link to="/speak">اتكلم مع Emma</Link>
            <Link to="/reviews">آراء الطلاب</Link>
          </div>
          <div className="nav-side">
            {student?.code && <DaysLeftBadge daysLeft={daysLeft} />}
            {isAdmin && (
              <Link to="/admin" className="admin-link">
                Admin
              </Link>
            )}
            {user && (
              <button onClick={signOut} className="signout">
                خروج
              </button>
            )}
            <Link to="/join" className="btn-sub">
              اشترك
            </Link>
          </div>
        </nav>

        <div className="hero">
          <div className="copy">
            <h1>
              {firstName ? (
                <>
                  أهلاً <span className="grad">{firstName}</span> 👋
                </>
              ) : (
                <>
                  تحدي{' '}
                  <span className="grad">
                    جديد
                    <svg className="stroke" viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden="true">
                      <path
                        d="M4 10 C 50 2, 90 13, 130 8 S 190 4, 216 9"
                        fill="none"
                        stroke="#ffb3d4"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>{' '}
                  كل ٥ أيام
                </>
              )}
            </h1>
            <p className="sub">
              تتكلّم إنجليزي فعليًا في كل تحدي — مصدر، مهمة، درس، تسجيل، وتقييم يقول لك تتحسن فين.
            </p>
            <div className="cards">
              <HomeCard
                to="/challenge"
                chip="لو انت مشترك بالفعل"
                title="ابدأ التحدي"
                desc="ادخل بحسابك وكمّل تحدياتك من حيث توقفت."
                cta="ابدأ التحدي"
                hot={subscribed}
              />
              <HomeCard
                to="/join"
                chip="لو حابب تشترك"
                title="انضم للتحدي"
                desc="شاهد الفيديو التعريفي واعرف كل تفاصيل التحدي قبل ما تشترك."
                cta="انضم الآن"
                hot={!subscribed}
              />
            </div>
          </div>

          <div className="stage" aria-hidden="true">
            <div className="ring-bg" />

            <div className="phone">
              <div className="screen">
                <div className="notch" />
                <div className="app">
                  <div className="app-top">
                    <span className="app-title">ابدأ التحدي</span>
                    <span className="app-chip">كل ٥ أيام</span>
                  </div>
                  <div className="ring-wrap">
                    <svg width="96" height="96" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="39" fill="none" stroke="#fbe3ef" strokeWidth="9" />
                      <circle
                        cx="48"
                        cy="48"
                        r="39"
                        fill="none"
                        stroke="url(#x50gPink)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray="245"
                        strokeDashoffset="147"
                        transform="rotate(-90 48 48)"
                      />
                      <text x="48" y="46" textAnchor="middle" fontSize="21" fontWeight="900" fill="#131017">
                        ٥
                      </text>
                      <text x="48" y="63" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#7a7280">
                        أيام
                      </text>
                    </svg>
                  </div>
                  <div className="mini">
                    <div className="mini-row">
                      <span className="mi">
                        <DocIcon />
                      </span>
                      <span className="mt">مصدر</span>
                      <span className="ok">
                        <CheckIcon />
                      </span>
                    </div>
                    <div className="mini-row">
                      <span className="mi">
                        <TaskIcon />
                      </span>
                      <span className="mt">مهمة</span>
                      <span className="ok">
                        <CheckIcon />
                      </span>
                    </div>
                    <div className="mini-row">
                      <span className="mi">
                        <VidIcon />
                      </span>
                      <span className="mt">درس</span>
                      <span className="ok">
                        <CheckIcon />
                      </span>
                    </div>
                    <div className="mini-row live">
                      <span className="mi">
                        <MicIcon />
                      </span>
                      <span className="mt">تسجيل</span>
                    </div>
                    <div className="mini-row dim">
                      <span className="mi">
                        <ChartIcon />
                      </span>
                      <span className="mt">تقييم</span>
                    </div>
                  </div>
                  <span className="rec">
                    <MicIcon /> ابدأ التحدي
                  </span>
                </div>
              </div>
            </div>

            <div className="fcard f-score">
              <div className="lab">تقييم</div>
              <div className="stars">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
              <svg width="86" height="26" viewBox="0 0 86 26">
                <path
                  d="M2 21 L16 17 L30 19 L44 11 L58 13 L72 6 L84 4"
                  fill="none"
                  stroke="url(#x50gPink)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="84" cy="4" r="3" fill="#e84393" />
              </svg>
            </div>

            <div className="fcard f-streak">
              <span className="fl">
                <FlameIcon />
              </span>
              <span className="n">كل ٥ أيام</span>
            </div>

            <div className="fcard f-emma">
              <span className="av">E</span>
              <span>
                <span className="nm">Emma</span>
                <span className="st">● Online</span>
              </span>
              <span className="wave">
                <i style={{ height: '8px' }} />
                <i style={{ height: '15px' }} />
                <i style={{ height: '20px' }} />
                <i style={{ height: '12px' }} />
                <i style={{ height: '17px' }} />
                <i style={{ height: '9px' }} />
                <i style={{ height: '14px' }} />
              </span>
            </div>

            <svg className="spark" style={{ top: '44px', right: '56px' }} width="26" height="26" viewBox="0 0 24 24">
              <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
            </svg>
            <svg
              className="spark"
              style={{ bottom: '80px', left: '130px', color: '#b06bff' }}
              width="18"
              height="18"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
            </svg>
          </div>
        </div>

        <footer>
          <span>© {new Date().getFullYear()} EnglishX50 — تحدي جديد كل ٥ أيام</span>
          <Link to="/terms">الشروط والأحكام</Link>
        </footer>
      </div>

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="x50gPink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e84393" />
            <stop offset="1" stopColor="#ff7ab8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function HomeCard({
  to,
  chip,
  title,
  desc,
  cta,
  hot,
}: {
  to: string
  chip: string
  title: string
  desc: string
  cta: string
  hot: boolean
}) {
  return (
    <div className={`card${hot ? ' hot' : ''}`}>
      <span className="chip">{chip}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
      <Link to={to} className={`go ${hot ? 'fill' : 'line'}`}>
        {cta}
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M10 12h5M10 16h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M8.5 12.5l2.5 2.5 4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function VidIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <rect x="3" y="6" width="13" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M16 10.5l5-3v9l-5-3z" fill="currentColor" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path d="M4 20V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="7" y="12" width="3.4" height="8" rx="1" fill="currentColor" />
      <rect x="12.3" y="8" width="3.4" height="12" rx="1" fill="currentColor" />
      <rect x="17.6" y="4" width="3.4" height="16" rx="1" fill="currentColor" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
        fill="currentColor"
      />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M12 2.5c.6 3.2 2 4.6 3.4 6.1 1.6 1.8 3.1 3.5 3.1 6.4a6.5 6.5 0 1 1-13 0c0-2 1-3.8 2-5.3.4 1.1 1 2 2 2.6-.3-3.2.8-7 2.5-9.8z"
        fill="currentColor"
      />
    </svg>
  )
}
