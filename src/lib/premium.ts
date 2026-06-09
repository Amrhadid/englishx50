// Tracks whether the visitor has unlocked premium content by entering a valid
// subscription code. Stored client-side; the code itself is verified against
// Supabase (x50_codes) before this flag is set.

const KEY = 'x50_premium'
const KEY_SINCE = 'x50_premium_since'
const PROGRAM_DAYS = 100

export function isPremium(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

export function setPremium(value: boolean): void {
  try {
    if (value) localStorage.setItem(KEY, 'true')
    else {
      localStorage.removeItem(KEY)
      localStorage.removeItem(KEY_SINCE)
    }
  } catch {
    /* ignore storage errors */
  }
}

/** Record when premium was activated (start of the 100-day window). */
export function markPremiumActivated(date: Date = new Date()): void {
  try {
    localStorage.setItem(KEY_SINCE, date.toISOString())
  } catch {
    /* ignore storage errors */
  }
}

/** Days left in the 100-day window, or null if no local activation date. */
export function getPremiumDaysLeft(): number | null {
  try {
    const iso = localStorage.getItem(KEY_SINCE)
    if (!iso) return null
    const since = new Date(iso).getTime()
    if (Number.isNaN(since)) return null
    const elapsed = Math.floor((Date.now() - since) / 86_400_000)
    return Math.max(0, PROGRAM_DAYS - elapsed)
  } catch {
    return null
  }
}
