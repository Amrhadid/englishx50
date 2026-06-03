import type { Challenge } from '../types'

/**
 * 10 placeholder challenges used to render the full "٥٠ يوم، ١٠ تحديات"
 * design when Supabase has no data (or isn't configured). These mirror the
 * v3 redesign mockup: 10 cards, every challenge locked behind a code/join
 * flow until real content is wired up.
 */
const PLACEHOLDER_TITLES = [
  'الرياضة والصحة',
  'الأموال',
  'السفر والثقافات',
  'الحياة اليومية',
  'العمل والوظائف',
  'التكنولوجيا',
  'التسوق عبر الإنترنت',
  'الصفات الشخصية والمشاعر',
  'المحادثات اليومية (١)',
  'المحادثات اليومية (٢)',
]

export const PLACEHOLDER_CHALLENGES: Challenge[] = Array.from({ length: 10 }, (_, i) => {
  const number = i + 1
  return {
    id: `placeholder-${number}`,
    number,
    title: PLACEHOLDER_TITLES[i],
    video_url: null,
    pdf_url: null,
    speaking_task: null,
    is_locked: true,
    access_code: null,
  }
})
