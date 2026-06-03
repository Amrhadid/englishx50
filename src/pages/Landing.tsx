import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_CHALLENGES, PLACEHOLDER_REVIEWS } from '../lib/placeholders'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import IntroVideo from '../components/IntroVideo'
import Challenges from '../components/Challenges'
import Countdown from '../components/Countdown'
import PremiumModal from '../components/PremiumModal'
import FeedbackModal from '../components/FeedbackModal'
import SpeakingModal from '../components/SpeakingModal'
import LessonModal from '../components/LessonModal'
import Reviews from '../components/Reviews'

export default function Landing() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [showPremium, setShowPremium] = useState(false)
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null)
  const [speakingFor, setSpeakingFor] = useState<Challenge | null>(null)
  const [lessonFor, setLessonFor] = useState<Challenge | null>(null)

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

  // "ابدأ التحدي" CTAs open the premium-features popup.
  const start = () => setShowPremium(true)

  // Fall back to 10 placeholder challenges so the "٥٠ يوم، ١٠ تحديات" grid
  // always renders the full design, even before Supabase is wired up.
  const displayedChallenges = useMemo(
    () => (challenges.length > 0 ? challenges : PLACEHOLDER_CHALLENGES),
    [challenges],
  )

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
        onSelect={() => setShowPremium(true)}
        onFeedback={(c) => setFeedbackFor(c.number)}
        onSpeak={(c) => setSpeakingFor(c)}
        onWatch={(c) => (c.video_url ? setLessonFor(c) : setShowPremium(true))}
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
      {feedbackFor != null && (
        <FeedbackModal challengeNumber={feedbackFor} onClose={() => setFeedbackFor(null)} />
      )}
      {speakingFor && (
        <SpeakingModal challenge={speakingFor} onClose={() => setSpeakingFor(null)} />
      )}
      {lessonFor && <LessonModal challenge={lessonFor} onClose={() => setLessonFor(null)} />}
    </div>
  )
}
