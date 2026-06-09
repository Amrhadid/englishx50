import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_REVIEWS, mergeWithPlaceholders, isPlaceholderChallenge } from '../lib/placeholders'
import { challengeVideos } from '../lib/challenge'
import { challengeLockState, type LockState } from '../lib/completion'
import ChallengeLockedModal from '../components/ChallengeLockedModal'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import IntroVideo from '../components/IntroVideo'
import Challenges from '../components/Challenges'
import Countdown from '../components/Countdown'
import PremiumModal from '../components/PremiumModal'
import ComingSoonModal from '../components/ComingSoonModal'
import FeedbackModal from '../components/FeedbackModal'
import SpeakingModal from '../components/SpeakingModal'
import LessonModal from '../components/LessonModal'
import Reviews from '../components/Reviews'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { useAuth } from '../hooks/useAuth'
import { isAdminEmail } from '../lib/admin'
import { toArabicDigits } from '../lib/theme'

export default function Landing() {
  return (
    <OnboardingProvider>
      <LandingInner />
    </OnboardingProvider>
  )
}

function LandingInner() {
  const { premiumActive, progress } = useOnboardingContext()
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [showPremium, setShowPremium] = useState(false)
  const [feedbackFor, setFeedbackFor] = useState<Challenge | null>(null)
  const [speakingFor, setSpeakingFor] = useState<Challenge | null>(null)
  const [lessonFor, setLessonFor] = useState<Challenge | null>(null)
  const [comingSoonFor, setComingSoonFor] = useState<Challenge | null>(null)
  const [lockedFor, setLockedFor] = useState<{
    challenge: Challenge
    lock: Extract<LockState, { locked: true }>
  } | null>(null)

  // Real (added) challenge numbers in order — used for the sequential cooldown.
  const realNumbers = useMemo(
    () => challenges.map((c) => c.number).sort((a, b) => a - b),
    [challenges],
  )

  // Premium is DB-driven and tied to the signed-in account (redeemed code within
  // its 100-day window).
  const premium = premiumActive

  useEffect(() => {
    let active = true

    if (!supabase) return

    supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        // On error (e.g. RLS/permissions), fall back silently to the
        // placeholder challenges instead of surfacing an error in the UI.
        if (!error) setChallenges((data as Challenge[]) ?? [])
      })

    supabase
      .from('x50_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setReviews((data as Review[]) ?? [])
      })

    return () => {
      active = false
    }
  }, [])

  // Gate for locked actions (clicking a challenge or the level test) and the
  // "ابدأ التحدي" CTAs. Opens the premium popup, which handles Google sign-in +
  // account-bound code activation. Only ever opens on an explicit click.
  const requireAccess = () => setShowPremium(true)
  const start = requireAccess

  // Single gate for every challenge action:
  //  - free user            → upgrade / onboarding popup
  //  - premium, not-yet-added challenge → "Next Week" coming-soon popup
  //  - premium, real challenge          → run the action (watch/source/speak/…)
  const gateChallenge = (c: Challenge, run: () => void) => {
    // Admin previews everything: no premium gate, no cooldown.
    if (isAdmin) {
      if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
      return run()
    }
    if (!premium) return requireAccess()
    if (isPlaceholderChallenge(c)) return setComingSoonFor(c)
    // Sequential 5-day cooldown: must finish the previous challenge + wait.
    const lock = challengeLockState(c, realNumbers, progress)
    if (lock.locked) return setLockedFor({ challenge: c, lock })
    run()
  }

  // Label shown on a locked challenge card (premium, non-admin users only).
  const lockLabelFor = (c: Challenge): string | null => {
    if (isAdmin || !premium || isPlaceholderChallenge(c)) return null
    const lock = challengeLockState(c, realNumbers, progress)
    if (!lock.locked) return null
    return lock.reason === 'cooldown'
      ? `🔒 متاح بعد ${toArabicDigits(lock.daysLeft)} يوم`
      : '🔒 أكمل التحدي السابق'
  }

  // Always render the full set of slots: real challenges by number, locked
  // placeholders for the rest. Adding one real challenge no longer hides the
  // others.
  const displayedChallenges = useMemo(() => mergeWithPlaceholders(challenges), [challenges])

  // Show real uploaded reviews when present, otherwise placeholder frames so
  // the carousel design is visible before any screenshots are added.
  const displayedReviews = useMemo(
    () => (reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS),
    [reviews],
  )

  return (
      <div className="min-h-screen bg-white">
        <Navbar onStart={start} />
      <Hero onStart={start} />

      {/* Intro video */}
      <IntroVideo />

      <Challenges
        challenges={displayedChallenges}
        onSelect={() => requireAccess()}
        onFeedback={(c) => gateChallenge(c, () => setFeedbackFor(c))}
        onSpeak={(c) => gateChallenge(c, () => setSpeakingFor(c))}
        onWatch={(c) =>
          gateChallenge(c, () =>
            challengeVideos(c).length ? setLessonFor(c) : setComingSoonFor(c),
          )
        }
        onSource={(c) =>
          gateChallenge(c, () =>
            c.pdf_url ? window.open(c.pdf_url, '_blank', 'noopener') : setComingSoonFor(c),
          )
        }
        onUpgrade={() => requireAccess()}
        lockLabelFor={lockLabelFor}
      />
      <Countdown onStart={start} />
      <Reviews reviews={displayedReviews} />

      <footer className="border-t border-[#f0ecf8] bg-white py-10 text-center" dir="rtl">
        <div className="mx-auto mb-3 flex items-center justify-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #7C6FF0 0%, #A964F0 45%, #F25C8A 100%)' }}
          >
            50
          </span>
          <span className="text-base font-extrabold text-[#1b1730]">
            English<span className="text-[#7C6FF0]">X50</span>
          </span>
        </div>
        <p className="text-sm text-[#9a9aa2]">
          © {new Date().getFullYear()} EnglishX50 — تحدي ٥٠ يوم لتتحدّث الإنجليزية
        </p>
      </footer>

      {showPremium && <PremiumModal onClose={() => setShowPremium(false)} />}
      {comingSoonFor && (
        <ComingSoonModal challenge={comingSoonFor} onClose={() => setComingSoonFor(null)} />
      )}
      {lockedFor && (
        <ChallengeLockedModal
          challenge={lockedFor.challenge}
          lock={lockedFor.lock}
          onClose={() => setLockedFor(null)}
        />
      )}
      {feedbackFor && (
        <FeedbackModal challenge={feedbackFor} onClose={() => setFeedbackFor(null)} />
      )}
      {speakingFor && (
        <SpeakingModal challenge={speakingFor} onClose={() => setSpeakingFor(null)} />
      )}
      {lessonFor && <LessonModal challenge={lessonFor} onClose={() => setLessonFor(null)} />}
      </div>
  )
}
