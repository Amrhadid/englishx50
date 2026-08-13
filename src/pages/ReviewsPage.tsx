import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLACEHOLDER_REVIEWS } from '../lib/placeholders'
import { UI } from '../lib/theme'
import type { Review } from '../types'
import Reviews from '../components/Reviews'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

/**
 * `/reviews` — the social proof, on its own page now that the homepage is just
 * the two doors. Reached from the header's آراء الطلاب link.
 */
export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
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

  const displayedReviews = useMemo(() => (reviews.length > 0 ? reviews : PLACEHOLDER_REVIEWS), [reviews])

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div style={{ backgroundColor: UI.sand }}>
        <Reviews reviews={displayedReviews} />
      </div>
      <SiteFooter />
    </div>
  )
}
