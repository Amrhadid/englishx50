import type { Review } from '../types'

interface ReviewsProps {
  reviews: Review[]
  loading: boolean
}

export default function Reviews({ reviews, loading }: ReviewsProps) {
  if (!loading && reviews.length === 0) return null

  return (
    <section id="reviews" className="mx-auto max-w-5xl px-5 py-16 sm:px-8" dir="rtl">
      <div className="mb-10 text-center">
        <span className="mb-3 inline-block rounded-full bg-[#D8FAF0] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#0C7C62]">
          آراء حقيقية
        </span>
        <h2 className="text-[28px] font-black text-[#1b1730] sm:text-[34px]">قالوا عنّا 💬</h2>
        <p className="mt-2 text-[15px] text-[#7a7596]">تجارب المشاركين في التحدي</p>
      </div>

      {loading ? (
        <p className="text-center text-[#7a7689]">جارٍ التحميل…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {reviews.map((r) => (
            <img
              key={r.id}
              src={r.image_url}
              alt="مراجعة مشارك"
              loading="lazy"
              className="w-full rounded-3xl border border-[#efeafc] object-cover shadow-[0_8px_30px_-14px_rgba(124,111,240,0.3)]"
            />
          ))}
        </div>
      )}
    </section>
  )
}
