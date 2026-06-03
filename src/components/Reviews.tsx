import type { Review } from '../types'

interface ReviewsProps {
  reviews: Review[]
  loading: boolean
}

export default function Reviews({ reviews, loading }: ReviewsProps) {
  if (!loading && reviews.length === 0) return null

  return (
    <section id="reviews" className="mx-auto max-w-5xl px-5 py-14">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold text-[#111]">آراء المشاركين</h2>
        <p className="mt-2 text-[#7a7689]">Reviews</p>
      </div>

      {loading ? (
        <p className="text-center text-[#7a7689]">جارٍ التحميل…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {reviews.map((r) => (
            <img
              key={r.id}
              src={r.image_url}
              alt="مراجعة مشارك"
              loading="lazy"
              className="w-full rounded-2xl border border-[#f0ecf8] object-cover"
            />
          ))}
        </div>
      )}
    </section>
  )
}
