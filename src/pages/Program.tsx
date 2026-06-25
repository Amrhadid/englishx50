import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_REVIEWS } from '../lib/placeholders'
import { BRAND_GRADIENT } from '../lib/theme'
import type { Review } from '../types'
import Navbar from '../components/Navbar'
import IntroVideo from '../components/IntroVideo'
import ChallengeSystem from '../components/ChallengeSystem'
import Reviews from '../components/Reviews'
import PremiumModal from '../components/PremiumModal'
import SubscribeConfirmModal from '../components/SubscribeConfirmModal'
import { OnboardingProvider } from '../context/OnboardingContext'
import { useOnboardingContext } from '../hooks/useOnboardingContext'

export default function Program() {
  return (
    <OnboardingProvider>
      <ProgramInner />
    </OnboardingProvider>
  )
}

function ProgramInner() {
  const { premiumActive } = useOnboardingContext()
  const [reviews, setReviews] = useState<Review[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [showPremium, setShowPremium] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabase) return
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

  const displayedReviews = useMemo(
    () => (reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS),
    [reviews],
  )

  const scrollToVideo = () => {
    document.getElementById('program-video')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar onStart={() => setShowConfirm(true)} onRedeem={premiumActive ? undefined : () => setShowPremium(true)} />

      {/* Title */}
      <section className="bg-[#ECEAFF] py-12 text-center sm:py-14" dir="rtl">
        <span className="mb-3 inline-block rounded-full bg-white px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#8B5CF6]">
          تحدي ٥٠ يوم للإنجليزية
        </span>
        <h1 className="px-5 text-[32px] font-black leading-tight text-[#1b1730] sm:text-[44px]">
          تعرف على البرنامج
        </h1>
        <p className="mx-auto mt-3 max-w-xl px-5 text-[15px] font-semibold leading-relaxed text-[#6b6685]">
          شاهد الفيديو التعريفي وراجع كل تفاصيل التحدي قبل ما تشترك.
        </p>
      </section>

      {/* Hero video */}
      <div id="program-video" className="bg-[#ECEAFF] pb-10 pt-2">
        <IntroVideo />
      </div>

      {/* Program details (steps + stats) */}
      <ChallengeSystem />

      {/* Feedbacks */}
      <Reviews reviews={displayedReviews} />

      {/* Subscribe CTA */}
      <section id="subscribe" className="bg-white px-5 pb-20 pt-6 text-center" dir="rtl">
        <h2 className="mb-3 text-[26px] font-black text-[#1b1730] sm:text-[32px]">جاهز تبدأ التحدي؟</h2>
        <p className="mx-auto mb-7 max-w-md text-[15px] font-semibold text-[#6b6685]">
          اشترك الآن واحصل على كودك لفتح كل مزايا البرنامج.
        </p>
        <button
          onClick={() => setShowConfirm(true)}
          className="mx-auto block w-full max-w-md rounded-2xl py-4 text-base font-extrabold text-white shadow-xl transition hover:-translate-y-0.5"
          style={{ background: BRAND_GRADIENT }}
        >
          اشترك من هنا ←
        </button>
      </section>

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

      {showConfirm && (
        <SubscribeConfirmModal
          onClose={() => setShowConfirm(false)}
          onYes={() => {
            setShowConfirm(false)
            setShowPremium(true)
          }}
          onNo={() => {
            setShowConfirm(false)
            scrollToVideo()
          }}
        />
      )}
      {showPremium && <PremiumModal onClose={() => setShowPremium(false)} />}
    </div>
  )
}
