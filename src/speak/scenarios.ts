import type { LevelId, ScenarioId } from './types'

export interface ScenarioChip {
  id: ScenarioId
  label: string
  emoji: string
}

/** Order matches the chip row. Ids match the server's scenario table. */
export const SCENARIOS: ScenarioChip[] = [
  { id: 'daily', label: 'محادثة يومية', emoji: '☕' },
  { id: 'interview', label: 'مقابلة عمل', emoji: '💼' },
  { id: 'airport', label: 'في المطار', emoji: '✈️' },
  { id: 'meeting', label: 'اجتماع', emoji: '📊' },
  { id: 'shopping', label: 'مطعم وتسوق', emoji: '🛍️' },
  { id: 'free', label: 'محادثة حرة', emoji: '💬' },
]

export const DEFAULT_SCENARIO: ScenarioId = 'daily'

export function isScenarioId(value: unknown): value is ScenarioId {
  return SCENARIOS.some((s) => s.id === value)
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
