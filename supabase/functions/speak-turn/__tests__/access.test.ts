import { describe, expect, it } from 'vitest'
import { resolveAccess, type AccessEnv } from '../access.ts'

const env: AccessEnv = {
  supabaseUrl: 'https://proj.supabase.co',
  anonKey: 'anon-key',
  serviceRoleKey: 'service-key',
  adminEmail: 'siramrhadid@gmail.com',
  programDays: 100,
}

const NOW = Date.UTC(2026, 8, 3)
const now = () => NOW

type Route = (init?: RequestInit) => Response | Promise<Response>

/** A fetch stub keyed by URL substring. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const fn = async (url: string, init?: RequestInit) => {
    calls.push(url)
    for (const [key, route] of Object.entries(routes)) {
      if (url.includes(key)) return route(init)
    }
    return new Response('not found', { status: 404 })
  }
  return Object.assign(fn, { calls })
}

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const authOk = () => jsonResp({ id: 'user-1', email: 'learner@example.com', role: 'authenticated' })
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString()

describe('resolveAccess', () => {
  it('rejects a missing token without any network call', async () => {
    const fetch = fakeFetch({})
    expect(await resolveAccess('', env, fetch, now)).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(fetch.calls).toHaveLength(0)
  })

  it('rejects the public anon key (signed-out visitor) without any network call', async () => {
    const fetch = fakeFetch({})
    expect(await resolveAccess('anon-key', env, fetch, now)).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(fetch.calls).toHaveLength(0)
  })

  it('rejects a token Supabase Auth does not accept', async () => {
    const fetch = fakeFetch({ '/auth/v1/user': () => jsonResp({ msg: 'bad jwt' }, 401) })
    expect(await resolveAccess('forged.jwt.here', env, fetch, now)).toEqual({
      ok: false,
      reason: 'unauthenticated',
    })
    // Never reached the students table.
    expect(fetch.calls.some((u) => u.includes('x50_students'))).toBe(false)
  })

  it('denies a signed-in free user (no redeemed code)', async () => {
    const fetch = fakeFetch({
      '/auth/v1/user': authOk,
      '/rest/v1/x50_students': () => jsonResp([{ code: null, code_redeemed_at: null }]),
    })
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({ ok: false, reason: 'not_premium' })
  })

  it('denies a signed-in user with no students row at all', async () => {
    const fetch = fakeFetch({ '/auth/v1/user': authOk, '/rest/v1/x50_students': () => jsonResp([]) })
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({ ok: false, reason: 'not_premium' })
  })

  it('denies once the 100-day window has closed', async () => {
    const fetch = fakeFetch({
      '/auth/v1/user': authOk,
      '/rest/v1/x50_students': () => jsonResp([{ code: 'X50-1', code_redeemed_at: iso(100) }]),
    })
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({ ok: false, reason: 'not_premium' })
  })

  it('allows a paid user inside the window', async () => {
    const fetch = fakeFetch({
      '/auth/v1/user': authOk,
      '/rest/v1/x50_students': () => jsonResp([{ code: 'X50-1', code_redeemed_at: iso(30) }]),
    })
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({
      ok: true,
      userId: 'user-1',
      email: 'learner@example.com',
      isAdmin: false,
    })
  })

  it('allows the admin account without consulting the students table', async () => {
    const fetch = fakeFetch({
      '/auth/v1/user': () => jsonResp({ id: 'admin-1', email: 'SirAmrHadid@gmail.com', role: 'authenticated' }),
    })
    const res = await resolveAccess('valid.jwt', env, fetch, now)
    expect(res).toEqual({ ok: true, userId: 'admin-1', email: 'siramrhadid@gmail.com', isAdmin: true })
    expect(fetch.calls.some((u) => u.includes('x50_students'))).toBe(false)
  })

  it('fails closed when the service role key is missing', async () => {
    const fetch = fakeFetch({ '/auth/v1/user': authOk })
    expect(await resolveAccess('valid.jwt', { ...env, serviceRoleKey: '' }, fetch, now)).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('fails closed when Supabase Auth is unreachable', async () => {
    const fetch = async () => {
      throw new Error('network down')
    }
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('fails closed when the students lookup errors (never fails open)', async () => {
    const fetch = fakeFetch({
      '/auth/v1/user': authOk,
      '/rest/v1/x50_students': () => new Response('boom', { status: 500 }),
    })
    expect(await resolveAccess('valid.jwt', env, fetch, now)).toEqual({ ok: false, reason: 'unavailable' })
  })
})
