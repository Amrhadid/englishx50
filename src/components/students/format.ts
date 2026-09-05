// Formatting helpers, colours and class-name constants shared by the Students dashboard.

export const PURPLE = '#534AB7'
export const GREEN = '#23C4A0'
export const AMBER = '#F5A623'
export const RED = '#E5484D'

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Two-letter initials for the avatar disc (works for Arabic and Latin names). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] ?? '') + (parts[1][0] ?? '')
}

/** Deterministic pastel per name so avatars are distinguishable at a glance. */
export function avatarColor(name: string): string {
  const palette = ['#534AB7', '#0C7C62', '#A66A09', '#B11D54', '#1D5FB1', '#6B3FA0', '#2A7F62', '#C2410C']
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

export function progressColor(pct: number): string {
  if (pct >= 100) return GREEN
  if (pct >= 50) return PURPLE
  if (pct > 0) return AMBER
  return '#C9C6D8'
}

export const FIELD =
  'rounded-xl border border-[#e8e0f0] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#534AB7]'
export const BTN_PRIMARY =
  'rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60'
export const BTN_GHOST =
  'rounded-xl border border-[#e8e0f0] bg-white px-4 py-2 text-sm font-bold text-[#5b5670] hover:bg-[#f4f3f7] disabled:opacity-60'
export const BTN_DANGER = 'rounded-lg bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#DC2626] hover:bg-[#fecaca]'

/** WhatsApp deep link for a phone number (digits only; assumes an international or Egyptian number). */
export function whatsappLink(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 11) digits = `2${digits}`
  return `https://wa.me/${digits}`
}
