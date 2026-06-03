import { useRef } from 'react'
import type { Review } from '../types'
import { BRAND_GRADIENT } from '../lib/theme'

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
    <section id="reviews" className="relative overflow-hidden py-16" dir="rtl">
      {/* Soft pastel backdrop */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fdfcff] via-[#F7F3FF] to-[#fdfcff]" />
      <div className="absolute right-0 top-10 -z-10 h-72 w-72 rounded-full bg-[#A964F0]/15 blur-3xl" />
      <div className="absolute left-0 bottom-10 -z-10 h-72 w-72 rounded-full bg-[#23C4A0]/12 blur-3xl" />

      <div className="mx-auto mb-8 max-w-5xl px-5 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="mb-3 inline-block rounded-full bg-[#D8FAF0] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#0C7C62]">
              آراء حقيقية
            </span>
            <h2 className="text-[28px] font-black text-[#1b1730] sm:text-[34px]">قالوا عنّا 💬</h2>
            <p className="mt-2 text-[15px] text-[#7a7596]">لقطات من رسائل وتقييمات الطلاب</p>
          </div>

          {/* Arrows (hidden on small screens — swipe instead) */}
          <div className="hidden gap-2 sm:flex">
            <button
              onClick={() => scroll('right')}
              aria-label="السابق"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ece7fb] bg-white text-[#7C6FF0] shadow-sm transition hover:bg-[#f1edff]"
            >
              <ChevronIcon dir="right" />
            </button>
            <button
              onClick={() => scroll('left')}
              aria-label="التالي"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ece7fb] bg-white text-[#7C6FF0] shadow-sm transition hover:bg-[#f1edff]"
            >
              <ChevronIcon dir="left" />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
      >
        {reviews.map((r) => (
          <div
            key={r.id}
            className="w-[260px] shrink-0 snap-center rounded-[30px] p-[3px] shadow-[0_18px_45px_-20px_rgba(124,111,240,0.55)] sm:w-[300px]"
            style={{ background: BRAND_GRADIENT }}
          >
            <div className="h-[440px] overflow-hidden rounded-[27px] bg-white sm:h-[500px]">
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt="مراجعة طالب"
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#F3F0FF] to-[#FFE1EC] text-center">
                  <InstagramIcon className="h-12 w-12 text-[#A964F0]" />
                  <p className="text-sm font-bold text-[#7C6FF0]">لقطة شاشة Instagram</p>
                  <p className="px-6 text-[12px] text-[#a39ec0]">
                    تُضاف آراء الطلاب من لوحة التحكم
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
