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

/** Extract the bearer token from the Authorization header (may be the anon key). */
export function bearerToken(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

/** True when `token` belongs to a signed-in user with active premium (or the admin). */
export async function tokenHasPremium(token: string): Promise<boolean> {
  try {
    if (!token || !SUPABASE_URL || !ANON_KEY) return false
    // The anon key itself is not a user — reject it outright.
    if (token === ANON_KEY) return false

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
    })
    if (!userResp.ok) return false
    const user = (await userResp.json()) as { id?: string; email?: string }
    if (!user.id) return false
    if ((user.email ?? '').toLowerCase() === ADMIN_EMAIL) return true

    if (!SERVICE_ROLE_KEY) return false
    const rowResp = await fetch(
      `${SUPABASE_URL}/rest/v1/x50_students?user_id=eq.${user.id}&select=code,code_redeemed_at`,
      { headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    )
    if (!rowResp.ok) return false
    const rows = (await rowResp.json()) as { code: string | null; code_redeemed_at: string | null }[]
    const row = rows[0]
    if (!row?.code || !row.code_redeemed_at) return false
    const elapsedDays = (Date.now() - new Date(row.code_redeemed_at).getTime()) / 86_400_000
    return elapsedDays < PROGRAM_DAYS
  } catch {
    return false
  }
}

/** True when the request's Authorization bearer is a premium user (or admin). */
export function callerHasPremium(req: Request): Promise<boolean> {
  return tokenHasPremium(bearerToken(req))
}
