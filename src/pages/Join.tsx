import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UI } from '../lib/theme'
import IntroVideo from '../components/IntroVideo'
import ChallengeSystem from '../components/ChallengeSystem'
import Features from '../components/Features'
import JoinForm from '../components/JoinForm'
import SubscribeConfirmModal from '../components/SubscribeConfirmModal'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

/**
 * «انضم للتحدي» — the whole path for someone who wants to subscribe, in one
 * scroll:
 *
 *   intro video → details → «انضم الآن» → confirmation popup → features →
 *   form → WhatsApp
 *
 * There is deliberately no code box anywhere on this page: someone who already
 * has a code (or already redeemed) goes to «ابدأ التحدي» from the homepage.
 */
export default function Join() {
  const [showConfirm, setShowConfirm] = useState(false)

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader>
        <Link to="/" className="text-[14px] font-bold underline" style={{ color: UI.muted }}>
          الرئيسية
        </Link>
      </SiteHeader>

      {/* Title + intro video */}
      <section className="mx-auto max-w-3xl px-5 pt-14 text-center sm:px-8 sm:pt-20" dir="rtl">
        <h1
          className="text-[38px] font-black leading-[1.12] tracking-tight sm:text-[58px]"
          style={{ color: UI.ink }}
        >
          تحدي <span style={{ color: UI.pinkInk }}>جديد</span> كل ٥ أيام
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed sm:text-[19px]" style={{ color: UI.muted }}>
          شاهد الفيديو التعريفي وراجع كل تفاصيل التحدي قبل ما تشترك.
        </p>
      </section>

      <div id="intro-video" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <IntroVideo />
      </div>

      {/* Program details (steps + cadence) */}
      <ChallengeSystem />

      {/* The one crystal-clear CTA */}
      <section className="px-5 py-16 text-center sm:px-8" dir="rtl">
        <button
          onClick={() => setShowConfirm(true)}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-3 rounded-[16px] px-8 py-5 text-[22px] font-bold transition hover:brightness-95 sm:text-[26px]"
          style={{ backgroundColor: UI.pink, color: UI.ink }}
        >
          انضم الآن
          <span aria-hidden="true">←</span>
        </button>
        <p className="mt-4 text-[15px]" style={{ color: UI.muted }}>
          عندك كود بالفعل؟{' '}
          <Link to="/challenge" className="font-bold underline" style={{ color: UI.ink }}>
            ابدأ التحدي من هنا
          </Link>
        </p>
      </section>

      <Features />
      <JoinForm />

      <SiteFooter />

      {showConfirm && (
        <SubscribeConfirmModal
          onClose={() => setShowConfirm(false)}
          onYes={() => {
            setShowConfirm(false)
            scrollTo('features')
          }}
          onNo={() => {
            setShowConfirm(false)
            scrollTo('intro-video')
          }}
        />
      )}
    </div>
  )
}
