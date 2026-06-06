import { useRef } from 'react'
import type { Review } from '../types'
import onlineReview from '../assets/Online Review-amico.svg'

interface ReviewsProps {
  reviews: Review[]
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
    </svg>
  )
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Reviews({ reviews }: ReviewsProps) {
  const scroller = useRef<HTMLDivElement>(null)

  if (reviews.length === 0) return null

  const scroll = (dir: 'left' | 'right') => {
    const el = scroller.current
    if (!el) return
    const amount = el.clientWidth * 0.85
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section id="reviews" className="bg-white py-16" dir="rtl">
      <div className="mx-auto mb-8 max-w-5xl px-5 sm:px-8">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          {/* Illustration — left */}
          <div className="flex items-center justify-center md:order-1">
            <img src={onlineReview} alt="" className="w-full max-w-[320px]" />
          </div>

          {/* Header — right */}
          <div className="md:order-2">
            <span className="mb-3 inline-block rounded-full bg-[#D8FAF0] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#0C7C62]">
              آراء حقيقية
            </span>
            <h2 className="text-[28px] font-black text-[#1b1730] sm:text-[34px]">قالوا عنّا 💬</h2>
            <p className="mt-2 text-[15px] text-[#7a7596]">لقطات من رسائل وتقييمات الطلاب</p>

            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ECEAFF] px-4 py-2 text-[13px] font-extrabold text-[#8B5CF6]">
              +2,000 طالب
              <span className="text-[#F59E0B]">★★★★★</span>
            </span>

            {/* Arrows (hidden on small screens — swipe instead) */}
            <div className="mt-6 hidden gap-2 sm:flex">
              <button
                onClick={() => scroll('right')}
                aria-label="السابق"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#ede8ff] bg-white text-[#8B5CF6] transition hover:border-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white"
              >
                <ChevronIcon dir="right" />
              </button>
              <button
                onClick={() => scroll('left')}
                aria-label="التالي"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#ede8ff] bg-white text-[#8B5CF6] transition hover:border-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white"
              >
                <ChevronIcon dir="left" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory items-start gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
      >
        {reviews.map((r) => (
          <div
            key={r.id}
            className="w-[300px] shrink-0 snap-center rounded-[26px] border-2 border-[#ede8ff] bg-white p-2.5 shadow-[0_18px_45px_-26px_rgba(139,92,246,0.4)] sm:w-[340px]"
          >
            {r.image_url ? (
              <img
                src={r.image_url}
                alt="مراجعة طالب"
                loading="lazy"
                className="max-h-[560px] w-full rounded-[16px] bg-[#f7f5fc] object-contain"
              />
            ) : (
              <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-[16px] bg-[#ECEAFF] text-center">
                <InstagramIcon className="h-12 w-12 text-[#8B5CF6]" />
                <p className="text-sm font-bold text-[#8B5CF6]">لقطة شاشة Instagram</p>
                <p className="px-6 text-[12px] text-[#a39ec0]">
                  تُضاف آراء الطلاب من لوحة التحكم
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
