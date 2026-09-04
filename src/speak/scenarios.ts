import type { LevelId, ScenarioId } from './types'

export interface ScenarioChip {
  id: ScenarioId
  label: string
  emoji: string
}

/** The 20 topics Emma picks from at random. Ids match the server's table. */
export const SCENARIOS: ScenarioChip[] = [
  { id: 'introduce', label: 'قدّم نفسك', emoji: '🙋' },
  { id: 'daily', label: 'روتيني اليومي', emoji: '⏰' },
  { id: 'weekend', label: 'عطلة نهاية الأسبوع', emoji: '🌴' },
  { id: 'family', label: 'الأصدقاء والعائلة', emoji: '👨‍👩‍👧' },
  { id: 'hobbies', label: 'الهوايات ووقت الفراغ', emoji: '🎨' },
  { id: 'cooking', label: 'الطعام والطبخ', emoji: '🍳' },
  { id: 'restaurant', label: 'في المطعم', emoji: '🍽️' },
  { id: 'shopping', label: 'شراء الملابس', emoji: '👗' },
  { id: 'airport', label: 'في المطار', emoji: '✈️' },
  { id: 'hotel', label: 'تسجيل الدخول للفندق', emoji: '🏨' },
  { id: 'directions', label: 'السؤال عن الاتجاهات', emoji: '🧭' },
  { id: 'doctor', label: 'زيارة الطبيب', emoji: '🩺' },
  { id: 'past', label: 'الحديث عن الماضي', emoji: '🕰️' },
  { id: 'future', label: 'خطط المستقبل', emoji: '🔭' },
  { id: 'vacation', label: 'إجازة أحلامك', emoji: '🏖️' },
  { id: 'interview', label: 'مقابلة عمل', emoji: '💼' },
  { id: 'work', label: 'يوم في العمل', emoji: '🧑‍💻' },
  { id: 'meeting', label: 'اجتماع', emoji: '📊' },
  { id: 'customer', label: 'حل مشكلة عميل', emoji: '🎧' },
  { id: 'opinion', label: 'التعبير عن رأيك والدفاع عنه', emoji: '🗣️' },
]

export function isScenarioId(value: unknown): value is ScenarioId {
  return SCENARIOS.some((s) => s.id === value)
}

/** Emma's random topic pick — optionally excluding the current one (the learner's one skip). */
export function randomScenarioId(exclude?: ScenarioId): ScenarioId {
  const pool = exclude ? SCENARIOS.filter((s) => s.id !== exclude) : SCENARIOS
  return pool[Math.floor(Math.random() * pool.length)].id
}

export const LEVELS: { id: LevelId; label: string; hint: string }[] = [
  { id: 'beginner', label: 'مبتدئ', hint: 'جمل قصيرة وكلمات بسيطة' },
  { id: 'intermediate', label: 'متوسط', hint: 'محادثة طبيعية بكلمات يومية' },
  { id: 'advanced', label: 'متقدم', hint: 'أسئلة أعمق وتعبيرات طبيعية' },
]

export const DEFAULT_LEVEL: LevelId = 'intermediate'

export function isLevelId(value: unknown): value is LevelId {
  return LEVELS.some((l) => l.id === value)
}

export function levelLabel(id: LevelId): string {
  return LEVELS.find((l) => l.id === id)?.label ?? ''
}
