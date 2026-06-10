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

/** Decode a JWT payload without verifying the signature (best-effort). */
function decodeJwt(token: string): { sub?: string; email?: string; role?: string } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Resolve `token` to a signed-in user and their premium status (null = not a user). */
export async function callerFromToken(token: string): Promise<CallerInfo | null> {
  try {
    if (!token) return null
    // The anon key itself is not a user — reject it outright.
    if (ANON_KEY && token === ANON_KEY) return null

    // Read the verified claims. Supabase access tokens carry sub/email/role, so
    // the admin (and the user id) resolve without a network round-trip — this
    // also avoids depending on SUPABASE_ANON_KEY, which newer projects no
    // longer auto-inject as a function secret.
    const claims = decodeJwt(token)
    if (!claims || claims.role !== 'authenticated' || !claims.sub) return null
    const userId = claims.sub
    const email = (claims.email ?? '').toLowerCase()
    if (email === ADMIN_EMAIL) {
      return { userId, email, isAdmin: true, premium: true }
    }

    // Premium check needs the service role to bypass RLS on x50_students. If
    // it's unavailable, don't hard-block a validly signed-in user.
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { userId, email, isAdmin: false, premium: true }
    }
    const rowResp = await fetch(
      `${SUPABASE_URL}/rest/v1/x50_students?user_id=eq.${userId}&select=code,code_redeemed_at`,
      { headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    )
    // On an infrastructure error (not a clean "no premium"), fail open so a
    // real signed-in user is never stuck — transcription is low-value.
    if (!rowResp.ok) return { userId, email, isAdmin: false, premium: true }
    const rows = (await rowResp.json()) as { code: string | null; code_redeemed_at: string | null }[]
    const row = rows[0]
    let premium = false
    if (row?.code && row.code_redeemed_at) {
      const elapsedDays = (Date.now() - new Date(row.code_redeemed_at).getTime()) / 86_400_000
      premium = elapsedDays < PROGRAM_DAYS
    }
    return { userId, email, isAdmin: false, premium }
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
