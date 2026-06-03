import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Challenge, Review } from '../types'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
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

  return (
    <div className="min-h-screen bg-white">
      <Navbar onStart={start} />
      <Hero onStart={start} />

      {/* Intro video placeholder */}
      <div className="mx-6 my-8 flex h-[150px] items-center justify-center rounded-[20px] bg-[#111] sm:mx-8">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#534AB7]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5 text-white" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          </div>
          <p className="text-[13px] text-[#aaa]">شاهد الفيديو التعريفي</p>
        </div>
      </div>

      <Challenges
        challenges={challenges}
        loading={loadingChallenges}
        error={error}
        onSelect={setSelected}
      />
      <Reviews reviews={reviews} loading={loadingReviews} />
      <BottomCTA onStart={start} />

      <footer className="border-t border-[#f0ecf8] py-8 text-center text-sm text-[#9a9aa2]">
        © {new Date().getFullYear()} EnglishX50 — تحدي ٥٠ يوم
      </footer>

      {selected && <ChallengeModal challenge={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
