// Tracks whether the visitor has unlocked premium content by entering a valid
// subscription code. Stored client-side; the code itself is verified against
// Supabase (x50_codes) before this flag is set.

const KEY = 'x50_premium'

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
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage errors */
  }
}
