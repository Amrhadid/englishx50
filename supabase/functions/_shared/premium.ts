// EnglishX50 — shared caller check for the Edge Functions.
//
// The AI endpoints (Claude grading, Whisper transcription, the realtime relay,
// audio uploads) cost money per call, and they are deployed with
// verify_jwt = false (the platform-level check would accept the public anon
// key anyway). This helper enforces the real product rule server-side: the
// caller must be a signed-in user whose account has an active premium window
// (a redeemed code within its 100 days), or the admin account.
//
// supabase-js functions.invoke() automatically sends the signed-in user's
// access token as the Authorization bearer, so no client change is needed for
// the HTTP functions. The WebSocket relay passes the token as a ?token= query
// parameter instead (browsers can't set WS headers).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export const ADMIN_EMAIL = 'siramrhadid@gmail.com'
const PROGRAM_DAYS = 100

/** Max AI-grading attempts per speaking task (server-enforced; admin unlimited). */
export const MAX_TRIALS = 2

export interface CallerInfo {
  userId: string
  email: string
  isAdmin: boolean
  premium: boolean
}

/** Extract the bearer token from the Authorization header (may be the anon key). */
export function bearerToken(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

/** Resolve `token` to a signed-in user and their premium status (null = not a user). */
export async function callerFromToken(token: string): Promise<CallerInfo | null> {
  try {
    if (!token || !SUPABASE_URL || !ANON_KEY) return null
    // The anon key itself is not a user — reject it outright.
    if (token === ANON_KEY) return null

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
    })
    if (!userResp.ok) return null
    const user = (await userResp.json()) as { id?: string; email?: string }
    if (!user.id) return null
    const email = (user.email ?? '').toLowerCase()
    if (email === ADMIN_EMAIL) {
      return { userId: user.id, email, isAdmin: true, premium: true }
    }

    if (!SERVICE_ROLE_KEY) return { userId: user.id, email, isAdmin: false, premium: false }
    const rowResp = await fetch(
      `${SUPABASE_URL}/rest/v1/x50_students?user_id=eq.${user.id}&select=code,code_redeemed_at`,
      { headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    )
    let premium = false
    if (rowResp.ok) {
      const rows = (await rowResp.json()) as { code: string | null; code_redeemed_at: string | null }[]
      const row = rows[0]
      if (row?.code && row.code_redeemed_at) {
        const elapsedDays = (Date.now() - new Date(row.code_redeemed_at).getTime()) / 86_400_000
        premium = elapsedDays < PROGRAM_DAYS
      }
    }
    return { userId: user.id, email, isAdmin: false, premium }
  } catch {
    return null
  }
}

/** Resolve the request's Authorization bearer to a caller (null = not a user). */
export function callerInfo(req: Request): Promise<CallerInfo | null> {
  return callerFromToken(bearerToken(req))
}

/** True when `token` belongs to a signed-in user with active premium (or the admin). */
export async function tokenHasPremium(token: string): Promise<boolean> {
  return (await callerFromToken(token))?.premium ?? false
}

/** True when the request's Authorization bearer is a premium user (or admin). */
export async function callerHasPremium(req: Request): Promise<boolean> {
  return (await callerInfo(req))?.premium ?? false
}

/**
 * Atomically consume one grading attempt for (user, task) via the
 * x50_consume_trial RPC. Returns the new used count, -1 when the limit is
 * already reached, or null when the counter is unavailable (e.g. the SQL
 * hasn't been run yet) — callers fail open on null so grading keeps working.
 */
export async function consumeTrial(userId: string, taskKey: string): Promise<number | null> {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/x50_consume_trial`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_user: userId, p_task: taskKey, p_max: MAX_TRIALS }),
    })
    if (!resp.ok) return null
    const n = await resp.json()
    return typeof n === 'number' ? n : null
  } catch {
    return null
  }
}
