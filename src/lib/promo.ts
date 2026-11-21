import { supabase } from './supabase'

export type PromoActivation = { code: string; activatedAt: string; expiresAt: string }

export type PromoResult =
  | ({ status: 'active' | 'expired' } & PromoActivation)
  | { status: 'invalid' | 'unauthenticated' | 'error' }

/**
 * Activate a promo code for the signed-in account (x50_activate_promo RPC,
 * supabase/promo_codes.sql). The first activation starts a 6-hour window;
 * re-applying returns the original activation, so once it expires the code
 * can never be used again by this account.
 */
export async function activatePromo(code: string): Promise<PromoResult> {
  if (!supabase) return { status: 'error' }
  const { data, error } = await supabase.rpc('x50_activate_promo', { p_code: code.trim() })
  if (error || !data) return { status: 'error' }
  return data as PromoResult
}

/** The account's still-running promo activation, if any (to restore the countdown). */
export async function fetchActivePromo(): Promise<PromoActivation | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('x50_promo_activations')
    .select('code, activated_at, expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return { code: data.code, activatedAt: data.activated_at, expiresAt: data.expires_at }
}

/** "05:59:12" style countdown for the remaining milliseconds. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
