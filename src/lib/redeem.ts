import { supabase } from './supabase'

export type RedeemResult =
  | { ok: true; redeemedAt: string }
  | { ok: false; reason: 'invalid' | 'used' | 'error' }

/**
 * Redeem a subscription code and bind it to the signed-in account.
 *
 * The code is marked used (single-use) and written onto the user's x50_students
 * row with code_redeemed_at — the durable, DB-side anchor for the 100-day
 * window. Because premium is keyed off the account's own row, a used code can't
 * grant access to any other account.
 */
export async function redeemCode(opts: {
  userId: string
  code: string
  name: string
  job: string
}): Promise<RedeemResult> {
  if (!supabase) return { ok: false, reason: 'error' }
  const value = opts.code.trim()

  const { data, error } = await supabase.from('x50_codes').select('id, used_at').eq('code', value)
  const found = ((data as { id: string; used_at: string | null }[] | null) ?? [])[0]
  if (error || !found) return { ok: false, reason: 'invalid' }
  if (found.used_at) return { ok: false, reason: 'used' }

  const now = new Date().toISOString()

  // Mark used only if still unused (guards against two people racing on a code).
  const { data: upd, error: e2 } = await supabase
    .from('x50_codes')
    .update({ used_at: now, used_by: `${opts.name} - ${opts.job}` })
    .eq('id', found.id)
    .is('used_at', null)
    .select()
  if (e2 || !upd || upd.length === 0) return { ok: false, reason: 'used' }

  // Bind to the user's student row (update if it exists, otherwise insert).
  const existing = await supabase
    .from('x50_students')
    .select('id')
    .eq('user_id', opts.userId)
    .maybeSingle()

  const payload = { name: opts.name, job: opts.job, code: value, code_redeemed_at: now }
  const { error: e3 } = existing.data
    ? await supabase.from('x50_students').update(payload).eq('user_id', opts.userId)
    : // `phone` is included empty in case the column is NOT NULL (the original
      // onboarding always set it).
      await supabase.from('x50_students').insert({ user_id: opts.userId, phone: '', ...payload })

  if (e3) return { ok: false, reason: 'error' }
  return { ok: true, redeemedAt: now }
}
