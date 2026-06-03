import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_CHALLENGES } from '../lib/placeholders'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import IntroVideo from '../components/IntroVideo'
import Challenges from '../components/Challenges'
import ChallengeModal from '../components/ChallengeModal'
import Reviews from '../components/Reviews'
import BottomCTA from '../components/BottomCTA'

export default function Landing() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingChallenges, setLoadingChallenges] = useState(true)
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Challenge | null>(null)

  useEffect(() => {
    let active = true

    if (!supabase) {
      // Supabase not configured — render the static page without data.
      setLoadingChallenges(false)
      setLoadingReviews(false)
      return
    }

    supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setChallenges((data as Challenge[]) ?? [])
        setLoadingChallenges(false)
      })

    supabase
      .from('x50_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        setReviews((data as Review[]) ?? [])
        setLoadingReviews(false)
      })

    return () => {
      active = false
    }
  }, [])

  const start = () => {
    document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fall back to 10 placeholder challenges so the "٥٠ يوم، ١٠ تحديات" grid
  // always renders the full design, even before Supabase is wired up.
  const displayedChallenges = useMemo(
    () => (challenges.length > 0 ? challenges : PLACEHOLDER_CHALLENGES),
    [challenges],
  )

  return (
    <div className="min-h-screen bg-white">
      <Navbar onStart={start} />
      <Hero onStart={start} />

      {/* Intro video */}
      <IntroVideo />

      <Challenges
        challenges={displayedChallenges}
        loading={loadingChallenges}
        error={error}
        onSelect={setSelected}
      />
      <Reviews reviews={reviews} loading={loadingReviews} />
      <BottomCTA onStart={start} />

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

      {selected && <ChallengeModal challenge={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
