import { useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Review } from '../types'
import onlineReview from '../assets/Online Review-amico.svg'
import { UI } from '../lib/theme'

interface ReviewsProps {
  reviews: Review[]
}

function InstagramIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
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
    <section id="reviews" className="py-20" dir="rtl">
      <div className="mx-auto mb-8 max-w-5xl px-5 sm:px-8">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          {/* Illustration — left */}
          <div className="flex items-center justify-center md:order-1">
            <img src={onlineReview} alt="" className="w-full max-w-[320px]" />
          </div>

          {/* Header — right */}
          <div className="md:order-2">
            <h2
              className="text-[32px] font-black leading-tight tracking-tight sm:text-[42px]"
              style={{ color: UI.ink }}
            >
              قالوا <span style={{ color: UI.pinkInk }}>عنّا</span> 💬
            </h2>
            <p className="mt-3 text-[17px]" style={{ color: UI.muted }}>
              لقطات من رسائل وتقييمات الطلاب
            </p>

            <span
              className="mt-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[14px] font-bold"
              style={{ borderColor: UI.line, color: UI.ink }}
            >
              +2,000 طالب
              <span style={{ color: UI.pinkInk }}>★★★★★</span>
            </span>

            {/* Arrows (hidden on small screens — swipe instead) */}
            <div className="mt-6 hidden gap-2 sm:flex">
              <button
                onClick={() => scroll('right')}
                aria-label="السابق"
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-white transition hover:brightness-95"
                style={{ borderColor: UI.line, color: UI.ink }}
              >
                <ChevronIcon dir="right" />
              </button>
              <button
                onClick={() => scroll('left')}
                aria-label="التالي"
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-white transition hover:brightness-95"
                style={{ borderColor: UI.line, color: UI.ink }}
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
            className="w-[300px] shrink-0 snap-center rounded-[20px] border bg-white p-2.5 sm:w-[340px]"
            style={{ borderColor: UI.line }}
          >
            {r.image_url ? (
              <img
                src={r.image_url}
                alt="مراجعة طالب"
                loading="lazy"
                className="max-h-[560px] w-full rounded-[16px] bg-[#f7f5fc] object-contain"
              />
            ) : (
              <div
                className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-[16px] text-center"
                style={{ backgroundColor: UI.sand }}
              >
                <InstagramIcon className="h-12 w-12" style={{ color: UI.pinkInk }} />
                <p className="text-sm font-bold" style={{ color: UI.ink }}>لقطة شاشة Instagram</p>
                <p className="px-6 text-[13px]" style={{ color: UI.muted }}>
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
