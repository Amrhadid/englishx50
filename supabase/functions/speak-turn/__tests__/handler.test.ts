import { describe, expect, it, vi } from 'vitest'
import { createSpeakHandler, toModelMessages, type SpeakDeps } from '../handler.ts'
import { MinuteLimiter } from '../ratelimit.ts'
import { MOCK_TURN, ProviderError, type Providers } from '../providers.ts'

const NOW = Date.UTC(2026, 8, 3, 12)

const env: SpeakDeps['env'] = {
  supabaseUrl: 'https://proj.supabase.co',
  anonKey: 'anon-key',
  serviceRoleKey: 'service-key',
  adminEmail: 'siramrhadid@gmail.com',
  programDays: 100,
  mockMode: false,
}

const jsonResp = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

type Account = 'anon' | 'free' | 'paid' | 'admin'

/** Supabase stub: auth + students + speaking_turns, driven by the bearer token. */
function supabaseFetch(opts: { turnsToday?: number; persistFails?: boolean } = {}) {
  const inserted: unknown[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const auth = String((init?.headers as Record<string, string>)?.authorization ?? '')
    const token = auth.replace('Bearer ', '') as Account | 'service-key'
    if (url.includes('/auth/v1/user')) {
      if (token === 'free') return jsonResp({ id: 'free-1', email: 'free@example.com', role: 'authenticated' })
      if (token === 'paid') return jsonResp({ id: 'paid-1', email: 'paid@example.com', role: 'authenticated' })
      if (token === 'admin') return jsonResp({ id: 'admin-1', email: 'siramrhadid@gmail.com', role: 'authenticated' })
      return jsonResp({ msg: 'invalid' }, 401)
    }
    if (url.includes('/rest/v1/x50_students')) {
      if (url.includes('paid-1')) {
        return jsonResp([{ code: 'X50-1', code_redeemed_at: new Date(NOW - 5 * 86_400_000).toISOString() }])
      }
      return jsonResp([{ code: null, code_redeemed_at: null }])
    }
    if (url.includes('/rest/v1/x50_speaking_turns')) {
      if (init?.method === 'POST') {
        if (opts.persistFails) return new Response('nope', { status: 500 })
        inserted.push(JSON.parse(String(init.body)))
        return jsonResp([{ id: 'turn-1' }], 201)
      }
      return new Response('[]', { status: 206, headers: { 'content-range': `0-0/${opts.turnsToday ?? 0}` } })
    }
    return new Response('not found', { status: 404 })
  })
  return { fetch, inserted }
}

function providers(over: Partial<Providers> = {}): Providers {
  return {
    transcriber: { transcribe: vi.fn(async () => 'I had a great day today.') },
    model: { turn: vi.fn(async () => MOCK_TURN) },
    synthesizer: { synthesize: vi.fn(async () => ({ base64: 'QUJD', mime: 'audio/mpeg' })) },
    ...over,
  }
}

function post(account: Account, body: unknown) {
  return new Request('https://proj.supabase.co/functions/v1/speak-turn', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${account === 'anon' ? 'anon-key' : account}`,
    },
    body: JSON.stringify(body),
  })
}

const start = { action: 'start', scenario: 'daily', level: 'intermediate' }
const respond = {
  action: 'respond',
  scenario: 'interview',
  level: 'beginner',
  text: 'I work as a teacher for five years.',
  history: [{ role: 'assistant', text: 'Welcome! Tell me about yourself.' }],
  speakingSeconds: 6.2,
}

function makeHandler(p = providers(), sb = supabaseFetch(), extra: Partial<SpeakDeps> = {}) {
  return createSpeakHandler({ env, fetch: sb.fetch, providers: p, now: () => NOW, ...extra })
}

describe('speak-turn handler — access control', () => {
  it('answers CORS preflight', async () => {
    const res = await makeHandler()(new Request('https://x/speak-turn', { method: 'OPTIONS' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('rejects an unauthenticated caller before touching any provider', async () => {
    const p = providers()
    const res = await makeHandler(p)(post('anon', respond))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('unauthenticated')
    expect(p.model!.turn).not.toHaveBeenCalled()
    expect(p.transcriber!.transcribe).not.toHaveBeenCalled()
  })

  it('rejects a signed-in free user before touching any provider', async () => {
    const p = providers()
    for (const body of [start, respond, { ...start, action: 'transcribe', audio: 'QUJD' }]) {
      const res = await makeHandler(p)(post('free', body))
      expect(res.status).toBe(403)
      expect((await res.json()).code).toBe('not_premium')
    }
    expect(p.model!.turn).not.toHaveBeenCalled()
    expect(p.transcriber!.transcribe).not.toHaveBeenCalled()
    expect(p.synthesizer!.synthesize).not.toHaveBeenCalled()
  })

  it('lets a paid user initialise a session with the scenario opener and audio', async () => {
    const res = await makeHandler()(post('paid', start))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.reply).toBe('Hi! What was the best part of your day?')
    expect(body.audio).toEqual({ base64: 'QUJD', mime: 'audio/mpeg' })
    expect(body.limits.maxRecordingSeconds).toBe(60)
  })

  it('lets the admin through without a students row', async () => {
    const res = await makeHandler()(post('admin', start))
    expect(res.status).toBe(200)
  })

  it('denies with 503 when the entitlement cannot be verified', async () => {
    const sb = supabaseFetch()
    const broken = vi.fn(async (url: string, init?: RequestInit) =>
      url.includes('x50_students') ? new Response('down', { status: 500 }) : sb.fetch(url, init),
    )
    const res = await makeHandler(providers(), { fetch: broken, inserted: [] })(post('paid', start))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('entitlement_unavailable')
  })
})

describe('speak-turn handler — turns', () => {
  it('validates the request body', async () => {
    const h = makeHandler()
    expect((await h(post('paid', { action: 'respond', scenario: 'daily', level: 'beginner' }))).status).toBe(400)
    expect((await h(post('paid', { ...start, scenario: 'x' }))).status).toBe(400)
    const bad = new Request('https://x/speak-turn', {
      method: 'POST',
      headers: { authorization: 'Bearer paid' },
      body: '{not json',
    })
    expect((await h(bad)).status).toBe(400)
  })

  it('transcribes audio and reports an empty recording clearly', async () => {
    const p = providers()
    const h = makeHandler(p)
    const ok = await h(post('paid', { ...start, action: 'transcribe', audio: 'QUJD', mime: 'audio/webm' }))
    expect(await ok.json()).toEqual({ ok: true, transcript: 'I had a great day today.' })

    const silent = providers({ transcriber: { transcribe: async () => '   ' } })
    const empty = await makeHandler(silent)(post('paid', { ...start, action: 'transcribe', audio: 'QUJD' }))
    expect(empty.status).toBe(422)
    expect((await empty.json()).code).toBe('empty_transcript')
  })

  it('maps a failed transcription provider to transcription_failed', async () => {
    const p = providers({
      transcriber: {
        transcribe: async () => {
          throw new ProviderError('upstream', 'whisper 500', 500)
        },
      },
    })
    const res = await makeHandler(p)(post('paid', { ...start, action: 'transcribe', audio: 'QUJD' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('transcription_failed')
  })

  it('completes a conversation turn: reply, feedback, audio, persisted row', async () => {
    const p = providers()
    const sb = supabaseFetch()
    const res = await makeHandler(p, sb)(post('paid', respond))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toBe(MOCK_TURN.reply)
    expect(body.feedback).toEqual(MOCK_TURN.feedback)
    expect(body.audio.mime).toBe('audio/mpeg')
    expect(body.turnId).toBe('turn-1')

    // The scenario and level reached the model through the system prompt.
    const turn = p.model!.turn as ReturnType<typeof vi.fn>
    const input = turn.mock.calls[0][0] as { system: string; messages: { role: string; content: string }[] }
    expect(input.system).toContain('job interview')
    expect(input.system).toContain('BEGINNER')
    expect(input.messages[0].role).toBe('user')
    expect(input.messages[input.messages.length - 1].content).toContain('I work as a teacher')

    // Persisted: only the fields the feature needs, nothing about the account.
    expect(sb.inserted).toHaveLength(1)
    expect(sb.inserted[0]).toEqual({
      user_id: 'paid-1',
      scenario: 'interview',
      level: 'beginner',
      transcript: 'I work as a teacher for five years.',
      reply: MOCK_TURN.reply,
      feedback: MOCK_TURN.feedback,
      speaking_seconds: 6.2,
    })
  })

  it('still answers when persistence or speech synthesis fail', async () => {
    const p = providers({
      synthesizer: {
        synthesize: async () => {
          throw new ProviderError('upstream', 'tts down')
        },
      },
    })
    const res = await makeHandler(p, supabaseFetch({ persistFails: true }))(post('paid', respond))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toBe(MOCK_TURN.reply)
    expect(body.audio).toBeNull()
    expect(body.turnId).toBeNull()
  })

  it('rejects malformed model output (after one retry) instead of passing it on', async () => {
    const turn = vi.fn(async () => ({ reply: '', feedback: 'nope' }))
    const res = await makeHandler(providers({ model: { turn } }))(post('paid', respond))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('ai_malformed')
    expect(turn).toHaveBeenCalledTimes(2)
  })

  it('recovers when the first model answer is malformed and the retry is fine', async () => {
    let n = 0
    const turn = vi.fn(async () => (n++ === 0 ? { reply: 'text only' } : MOCK_TURN))
    const res = await makeHandler(providers({ model: { turn } }))(post('paid', respond))
    expect(res.status).toBe(200)
    expect(turn).toHaveBeenCalledTimes(2)
  })

  it('maps model failures: upstream, timeout, rate limited, refusal', async () => {
    const cases: [ProviderError, number, string][] = [
      [new ProviderError('upstream', '500', 500), 502, 'ai_failed'],
      [new ProviderError('timeout', 'slow'), 504, 'timeout'],
      [new ProviderError('rate_limited', '429', 429), 429, 'rate_limited'],
      [new ProviderError('refused', 'no'), 502, 'ai_refused'],
    ]
    for (const [err, status, code] of cases) {
      const turn = vi.fn(async () => {
        throw err
      })
      const res = await makeHandler(providers({ model: { turn } }))(post('paid', respond))
      expect(res.status).toBe(status)
      expect((await res.json()).code).toBe(code)
      expect(turn).toHaveBeenCalledTimes(1)
    }
  })

  it('returns 503 when a provider is not configured (never a fake answer)', async () => {
    const res = await makeHandler(providers({ model: null }))(post('paid', respond))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('provider_unavailable')
  })

  it('rate limits bursts per user and the daily turn count', async () => {
    const h = makeHandler(providers(), supabaseFetch(), { limiter: new MinuteLimiter(2) })
    expect((await h(post('paid', start))).status).toBe(200)
    expect((await h(post('paid', start))).status).toBe(200)
    const third = await h(post('paid', start))
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBeTruthy()
    // A different user is not affected by the first user's window.
    expect((await h(post('admin', start))).status).toBe(200)

    const daily = await makeHandler(providers(), supabaseFetch({ turnsToday: 150 }))(post('paid', respond))
    expect(daily.status).toBe(429)
    expect((await daily.json()).code).toBe('rate_limited')
  })
})

describe('toModelMessages', () => {
  it('always starts with a user message and ends with the latest learner text', () => {
    const msgs = toModelMessages(
      [
        { role: 'assistant', text: 'Hi! How are you?' },
        { role: 'user', text: 'Fine.' },
        { role: 'assistant', text: 'Great! What did you do?' },
      ],
      'I played football.',
    )
    expect(msgs[0].role).toBe('user')
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'I played football.' })
    // Roles alternate strictly.
    for (let i = 1; i < msgs.length; i++) expect(msgs[i].role).not.toBe(msgs[i - 1].role)
  })

  it('merges consecutive same-role messages', () => {
    const msgs = toModelMessages(
      [
        { role: 'user', text: 'a' },
        { role: 'user', text: 'b' },
      ],
      'c',
    )
    expect(msgs).toEqual([{ role: 'user', content: 'a\nb\nc' }])
  })
})
