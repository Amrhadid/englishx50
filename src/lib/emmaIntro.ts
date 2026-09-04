import { supabase } from './supabase'

export type ClaimEmmaIntroResult = { ok: true; alreadyClaimed: boolean } | { ok: false }

/**
 * Mark the one-time "meet Emma" popup as seen and, on the first call only,
 * grant the 20-day subscription gift — atomically, server-side, via
 * x50_claim_emma_intro (see supabase/emma_intro.sql). Safe to call more than
 * once: a repeat call is a no-op that still reports ok.
 */
export async function claimEmmaIntro(): Promise<ClaimEmmaIntroResult> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase.rpc('x50_claim_emma_intro')
  if (error || !data) return { ok: false }
  const res = data as { ok: boolean; alreadyClaimed?: boolean }
  return res.ok ? { ok: true, alreadyClaimed: res.alreadyClaimed === true } : { ok: false }
}
