// EnglishX50 /speak — per-user request limits.
//
// Two layers: a sliding one-minute window kept in memory (per edge isolate —
// cheap, catches bursts and runaway loops) and a per-day ceiling counted from
// the persisted x50_speaking_turns rows (survives isolate restarts).

import type { FetchLike } from './access.ts'

export class MinuteLimiter {
  private hits = new Map<string, number[]>()
  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  /** Record one hit and report whether the caller is still within the limit. */
  allow(key: string, now: number): boolean {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    // Keep the map from growing without bound on a long-lived isolate.
    if (this.hits.size > 5_000) {
      for (const [k, v] of this.hits) if (!v.some((t) => t > cutoff)) this.hits.delete(k)
    }
    return true
  }
}

/** Start of the current UTC day as an ISO timestamp. */
export function utcDayStart(now: number): string {
  const d = new Date(now)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

/**
 * How many turns this user has persisted today, or null when the count is
 * unavailable (table missing, network error). Callers treat null as "unknown"
 * and rely on the in-memory limiter alone.
 */
export async function countTurnsToday(
  userId: string,
  env: { supabaseUrl: string; serviceRoleKey: string },
  fetchFn: FetchLike,
  now: number,
): Promise<number | null> {
  if (!env.supabaseUrl || !env.serviceRoleKey) return null
  try {
    const url =
      `${env.supabaseUrl}/rest/v1/x50_speaking_turns?user_id=eq.${encodeURIComponent(userId)}` +
      `&created_at=gte.${encodeURIComponent(utcDayStart(now))}&select=id`
    const resp = await fetchFn(url, {
      headers: {
        apikey: env.serviceRoleKey,
        authorization: `Bearer ${env.serviceRoleKey}`,
        prefer: 'count=exact',
        range: '0-0',
      },
    })
    if (!resp.ok && resp.status !== 206) return null
    const range = resp.headers.get('content-range') ?? ''
    const total = Number(range.split('/')[1])
    return Number.isFinite(total) ? total : null
  } catch {
    return null
  }
}
