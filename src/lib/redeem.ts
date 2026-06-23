import { supabase } from './supabase'

export type RedeemResult =
  | { ok: true; redeemedAt: string }
  | { ok: false; reason: 'invalid' | 'used' | 'error' }

export type CodeStatus = 'valid' | 'used' | 'invalid' | 'error'

/**
 * Check a code's status without exposing the codes table to the client.
 * Runs through the x50_check_code SECURITY DEFINER RPC (see
 * supabase/redeem_lockdown.sql), so unused codes can't be listed via the API.
 */
export async function checkCode(code: string): Promise<CodeStatus> {
  if (!supabase) return 'error'
  const { data, error } = await supabase.rpc('x50_check_code', { p_code: code.trim() })
  if (error) return 'error'
  return data === 'valid' ? 'valid' : data === 'used' ? 'used' : 'invalid'
}

/**
 * Redeem a subscription code and bind it to the signed-in account.
 *
 * Runs entirely server-side in ONE transaction (x50_redeem_code RPC): the code
 * row is locked, marked used, and written onto the caller's x50_students row
 * with code_redeemed_at — the durable, DB-side anchor for the 100-day window.
 * A code can never be redeemed twice (concurrent attempts are serialised) and
 * is never burned without premium being granted. Because premium is keyed off
 * the account's own row, a used code can't grant access to any other account.
 */
export async function redeemCode(opts: {
  code: string
  name: string
  job: string
  /** Full phone incl. dial code — used to mark the matching lead paid. */
  phone: string
}): Promise<RedeemResult> {
  if (!supabase) return { ok: false, reason: 'error' }
  const db = supabase

  // Preferred path: the 4-arg RPC (leads.sql) also marks the matching lead paid.
  let { data, error } = await db.rpc('x50_redeem_code', {
    p_code: opts.code.trim(),
    p_name: opts.name,
    p_job: opts.job,
    p_phone: opts.phone,
  })

  // If the DB only has the older 3-arg signature (redeem_lockdown.sql applied
  // but the 4-arg leads.sql not yet run), PostgREST can't resolve the call and
  // returns PGRST202 ("Could not find the function … in the schema cache").
  // Fall back to the 3-arg version so redemption still works — lead paid-marking
  // is simply skipped until leads.sql is run. Without this, a perfectly valid
  // code (shown valid in admin) errors out for every user.
  if (isMissingFunction(error)) {
    ;({ data, error } = await db.rpc('x50_redeem_code', {
      p_code: opts.code.trim(),
      p_name: opts.name,
      p_job: opts.job,
    }))
  }

  if (error || !data) return { ok: false, reason: 'error' }

  const res = data as { ok: boolean; reason?: string; redeemed_at?: string }
  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason === 'used' ? 'used' : res.reason === 'invalid' ? 'invalid' : 'error',
    }
  }
  return { ok: true, redeemedAt: res.redeemed_at ?? new Date().toISOString() }
}

/**
 * True when a Supabase RPC error means the function signature isn't present in
 * the schema cache (PostgREST code PGRST202). Used to fall back to an older RPC
 * signature when a newer one hasn't been deployed yet.
 */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST202') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('could not find the function') || msg.includes('schema cache')
}
