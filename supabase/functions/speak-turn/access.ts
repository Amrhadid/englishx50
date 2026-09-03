// EnglishX50 /speak — strict, fail-closed entitlement check.
//
// Same product rule and same source of truth as _shared/premium.ts (a signed-in
// account whose x50_students row holds a code redeemed within the last 100
// days, or the admin account) — but with two differences the speaking feature
// needs because every turn spends money on three paid APIs:
//
//   1. The access token is verified by Supabase Auth (GET /auth/v1/user)
//      instead of being decoded without a signature check.
//   2. Any failure to *verify* (no service role, Supabase unreachable) denies
//      with 503 instead of letting the request through.
//
// No Deno globals: `fetch` and the env are injected so the decision table is
// unit-tested in __tests__/access.test.ts.

export interface AccessEnv {
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
  adminEmail: string
  programDays: number
}

export type AccessResult =
  | { ok: true; userId: string; email: string; isAdmin: boolean }
  | { ok: false; reason: 'unauthenticated' | 'not_premium' | 'unavailable' }

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Bearer token from the Authorization header ('' when absent). */
export function bearerToken(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

interface AuthUser {
  id?: string
  email?: string
  role?: string
}

export async function resolveAccess(
  token: string,
  env: AccessEnv,
  fetchFn: FetchLike,
  now: () => number = Date.now,
): Promise<AccessResult> {
  if (!token) return { ok: false, reason: 'unauthenticated' }
  // The public anon key is what supabase-js sends for a signed-out visitor.
  if (env.anonKey && token === env.anonKey) return { ok: false, reason: 'unauthenticated' }
  if (env.serviceRoleKey && token === env.serviceRoleKey) return { ok: false, reason: 'unauthenticated' }
  if (!env.supabaseUrl) return { ok: false, reason: 'unavailable' }

  // 1. Verify the token with Supabase Auth — a forged or expired JWT stops here.
  let user: AuthUser
  try {
    const resp = await fetchFn(`${env.supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.anonKey || env.serviceRoleKey,
      },
    })
    if (resp.status === 401 || resp.status === 403) return { ok: false, reason: 'unauthenticated' }
    if (!resp.ok) return { ok: false, reason: 'unavailable' }
    user = (await resp.json()) as AuthUser
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (!user?.id || (user.role && user.role !== 'authenticated')) {
    return { ok: false, reason: 'unauthenticated' }
  }
  const email = (user.email ?? '').toLowerCase()
  if (email && email === env.adminEmail.toLowerCase()) {
    return { ok: true, userId: user.id, email, isAdmin: true }
  }

  // 2. Premium window from the account's own x50_students row (service role
  //    bypasses RLS). Without the service role we cannot verify — deny.
  if (!env.serviceRoleKey) return { ok: false, reason: 'unavailable' }
  try {
    const resp = await fetchFn(
      `${env.supabaseUrl}/rest/v1/x50_students?user_id=eq.${encodeURIComponent(user.id)}&select=code,code_redeemed_at&limit=1`,
      { headers: { apikey: env.serviceRoleKey, authorization: `Bearer ${env.serviceRoleKey}` } },
    )
    if (!resp.ok) return { ok: false, reason: 'unavailable' }
    const rows = (await resp.json()) as { code: string | null; code_redeemed_at: string | null }[]
    const row = Array.isArray(rows) ? rows[0] : undefined
    if (!row?.code || !row.code_redeemed_at) return { ok: false, reason: 'not_premium' }
    const redeemedAt = new Date(row.code_redeemed_at).getTime()
    if (!Number.isFinite(redeemedAt)) return { ok: false, reason: 'not_premium' }
    const elapsedDays = (now() - redeemedAt) / 86_400_000
    if (elapsedDays < 0 || elapsedDays >= env.programDays) return { ok: false, reason: 'not_premium' }
    return { ok: true, userId: user.id, email, isAdmin: false }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
