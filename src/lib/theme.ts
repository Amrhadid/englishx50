/**
 * Playful-pastel colour system for the redesign.
 *
 * Each challenge is colour-coded with its own pastel theme (rotating through
 * the palette below), while the three action types (Source / Speaking /
 * Feedback) keep a consistent colour everywhere so they stay learnable.
 */

export interface PastelTheme {
  /** Vivid accent — play button, badge, title. */
  accent: string
  /** Soft tint — card thumbnail wash. */
  soft: string
  /** Deep shade — readable text on light. */
  deep: string
}

export const CHALLENGE_THEMES: PastelTheme[] = [
  { accent: '#7C6FF0', soft: '#EDEBFF', deep: '#473BBE' }, // lavender
  { accent: '#23C4A0', soft: '#D8FAF0', deep: '#0C7C62' }, // mint
  { accent: '#FF8A5B', soft: '#FFE7DB', deep: '#C2410C' }, // peach
  { accent: '#37AEF0', soft: '#DAF1FE', deep: '#0B6FA8' }, // sky
  { accent: '#F25C8A', soft: '#FFE1EC', deep: '#B11D54' }, // rose
  { accent: '#86C32B', soft: '#ECF8D4', deep: '#4D7A12' }, // lime
  { accent: '#F5B23C', soft: '#FEEFD2', deep: '#A66A09' }, // amber
  { accent: '#A964F0', soft: '#F2E6FE', deep: '#6B27A8' }, // violet
  { accent: '#18B7C4', soft: '#D4F5F9', deep: '#0A6F78' }, // teal
  { accent: '#5C7CF0', soft: '#E2E9FF', deep: '#2C42B0' }, // periwinkle
]

export function themeFor(index: number): PastelTheme {
  return CHALLENGE_THEMES[index % CHALLENGE_THEMES.length]
}

/** Signature brand gradient used on primary CTAs and highlights. */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #7C6FF0 0%, #A964F0 45%, #F25C8A 100%)'

/** Consistent colours for the three action types on every card. */
export const ACTION_THEMES = {
  source: { accent: '#7C6FF0', soft: '#EDEBFF', deep: '#473BBE' },
  speaking: { accent: '#23C4A0', soft: '#D8FAF0', deep: '#0C7C62' },
  feedback: { accent: '#F5B23C', soft: '#FEEFD2', deep: '#A66A09' },
} as const

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Convert a Latin number to Arabic-Indic numerals (e.g. 7 -> ٧, 12 -> ١٢). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => AR_DIGITS[Number(d)])
}
