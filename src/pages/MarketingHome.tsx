import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_REVIEWS, mergeWithPlaceholders } from '../lib/placeholders'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Challenges from '../components/Challenges'
import Countdown from '../components/Countdown'
import Reviews from '../components/Reviews'
import PremiumModal from '../components/PremiumModal'
import ProgramGateModal from '../components/ProgramGateModal'
import { useOnboardingContext } from '../hooks/useOnboardingContext'
import { BRAND_GRADIENT } from '../lib/theme'

/**
 * The homepage a NEW / not-yet-subscribed visitor sees: pure marketing +
 * conversion. Hero, "learn about the program" CTA, a locked teaser of the
 * challenges (every action nudges toward the program / upgrade flow), the
 * countdown, and social-proof reviews. No product machinery (lessons,
 * speaking, notes, level test) is wired here — those live on StudentHome and
 * only unlock after purchase.
 *
 * Assumes an <OnboardingProvider> ancestor (Navbar reads it).
 */
export default function MarketingHome() {
  const { premiumActive } = useOnboardingContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [showPremium, setShowPremium] = useState(false)
  const [premiumInitialCode, setPremiumInitialCode] = useState<string | undefined>()
  const [premiumFocusCode, setPremiumFocusCode] = useState(false)
  const [showProgramGate, setShowProgramGate] = useState(false)

  // Auto-open the PremiumModal when ?code= is present, or when a redeem intent
  // survives a sign-in redirect (?redeem=1 / stashed post-sign-in intent). Kept
  // identical to the live Landing so the redeem flow behaves the same in
  // rehearsal.
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setPremiumInitialCode(code)
      setShowPremium(true)
      setSearchParams({}, { replace: true })
      return
    }
    let postSignin: string | null = null
    try {
      postSignin = sessionStorage.getItem('x50_post_signin')
      if (postSignin) sessionStorage.removeItem('x50_post_signin')
    } catch {
      /* ignore */
    }
    if (searchParams.get('redeem') === '1' || postSignin === '?redeem=1') {
      setPremiumFocusCode(true)
      setShowPremium(true)
      if (searchParams.get('redeem') === '1') setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    if (!supabase) return
    supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
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

  // Single gate for every CTA on this page: a not-yet-subscribed visitor is
  // nudged to the program page (SubscribeConfirm / upgrade flow) rather than
  // into any product feature.
  const requireAccess = () => setShowProgramGate(true)

  const displayedChallenges = useMemo(() => mergeWithPlaceholders(challenges), [challenges])
  const displayedReviews = useMemo(
    () => (reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS),
    [reviews],
  )

  return (
    <div className="min-h-screen bg-white">
      <Navbar onStart={requireAccess} onRedeem={premiumActive ? undefined : () => setShowPremium(true)} />
      <Hero onStart={requireAccess} />

      {/* Learn about the program → dedicated page (video + details + reviews) */}
      <section className="bg-[#ECEAFF] px-5 pb-14 pt-2 text-center" dir="rtl">
        <Link
          to="/program"
          className="mx-auto block w-full max-w-2xl rounded-[28px] py-5 text-lg font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 sm:text-xl"
          style={{ background: BRAND_GRADIENT }}
        >
          تعرف على البرنامج - اضغط هنا 👈
        </Link>
      </section>

      {/* Locked teaser: shows the value, every action routes to the upgrade flow. */}
      <Challenges
        challenges={displayedChallenges}
        onSelect={requireAccess}
        onFeedback={requireAccess}
        onSpeak={requireAccess}
        onWatch={requireAccess}
        onSource={requireAccess}
        onFile={requireAccess}
        onUpgrade={requireAccess}
        levelTestDone={false}
      />
      <Countdown onStart={requireAccess} />
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

      {showProgramGate && (
        <ProgramGateModal
          onClose={() => setShowProgramGate(false)}
          onRedeemCode={(code) => {
            setShowProgramGate(false)
            setPremiumInitialCode(code)
            setShowPremium(true)
          }}
        />
      )}
      {showPremium && (
        <PremiumModal
          onClose={() => {
            setShowPremium(false)
            setPremiumInitialCode(undefined)
            setPremiumFocusCode(false)
          }}
          initialCode={premiumInitialCode}
          focusCode={premiumFocusCode}
        />
      )}
    </div>
  )
}
