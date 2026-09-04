import { describe, expect, it, vi } from 'vitest'
import { createSpeakHandler, nextAvailableAt, toModelMessages, type SpeakDeps } from '../handler.ts'
import { MinuteLimiter } from '../ratelimit.ts'
import { MOCK_TURN, MOCK_VOCAB, ProviderError, type Providers } from '../providers.ts'
import type { ConversationRow, Store, TurnRow } from '../store.ts'

const NOW = Date.UTC(2026, 8, 3, 12)
const HOUR = 3_600_000

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

/** Supabase stub for auth, the students table and the daily turn count. */
function supabaseFetch(opts: { turnsToday?: number } = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
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
      return new Response('[]', { status: 206, headers: { 'content-range': `0-0/${opts.turnsToday ?? 0}` } })
    }
    return new Response('not found', { status: 404 })
  })
}

/** In-memory Store with the same semantics as the PostgREST one. */
function memoryStore(seed: { conversations?: ConversationRow[]; turns?: Record<string, TurnRow[]> } = {}) {
  const conversations: ConversationRow[] = [...(seed.conversations ?? [])]
  const turns: Record<string, TurnRow[]> = { ...(seed.turns ?? {}) }
  const giftClaimed = new Set<string>()
  let n = 0
  const store: Store = {
    async latestConversation(userId) {
      return conversations.filter((c) => c.user_id === userId).sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
    },
    async conversation(id, userId) {
      return conversations.find((c) => c.id === id && c.user_id === userId) ?? null
    },
    async listConversations(userId, limit) {
      return conversations.filter((c) => c.user_id === userId).slice(0, limit)
    },
    async createConversation({ userId, scenario, level, goalSeconds }) {
      const row: ConversationRow = {
        id: `conv-${++n}`,
        user_id: userId,
        scenario,
        level,
        status: 'active',
        speaking_seconds: 0,
        goal_seconds: goalSeconds,
        started_at: new Date(NOW).toISOString(),
        completed_at: null,
        vocab_json: null,
      }
      conversations.push(row)
      return row
    },
    async updateConversation(id, patch) {
      const row = conversations.find((c) => c.id === id)
      if (!row) return null
      Object.assign(row, patch)
      return row
    },
    async turns(conversationId) {
      return turns[conversationId] ?? []
    },
    async insertTurn(input) {
      const row: TurnRow = {
        id: `turn-${++n}`,
        transcript: input.transcript,
        reply: input.reply,
        feedback: input.feedback,
        speaking_seconds: input.speakingSeconds,
        created_at: new Date(NOW).toISOString(),
        audio_path: input.audioPath,
      }
      turns[input.conversationId] = [...(turns[input.conversationId] ?? []), row]
      return row.id
    },
    async uploadAudio({ userId }) {
      return `${userId}/${++n}.webm`
    },
    async maybeGrantEmmaGift(userId) {
      if (giftClaimed.has(userId)) return false
      const qualifying = conversations.filter(
        (c) => c.user_id === userId && c.status === 'completed' && c.speaking_seconds >= 60,
      ).length
      if (qualifying < 5) return false
      giftClaimed.add(userId)
      return true
    },
  }
  return { store, conversations, turns, giftClaimed }
}

function providers(over: Partial<Providers> = {}): Providers {
  return {
    transcriber: { transcribe: vi.fn(async () => 'I had a great day today.') },
    model: { turn: vi.fn(async () => MOCK_TURN), vocabulary: vi.fn(async () => MOCK_VOCAB) },
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

const start = { action: 'start', scenario: 'interview', level: 'beginner' }
const respond = (conversationId: string, extra: Record<string, unknown> = {}) => ({
  action: 'respond',
  conversationId,
  level: 'beginner',
  text: 'I work as a teacher for five years.',
  speakingSeconds: 6.2,
  ...extra,
})

function makeHandler(
  p = providers(),
  store = memoryStore().store,
  extra: Partial<SpeakDeps> = {},
  fetch = supabaseFetch(),
) {
  return createSpeakHandler({ env, fetch, providers: p, store, now: () => NOW, ...extra })
}

const activeRow = (over: Partial<ConversationRow> = {}): ConversationRow => ({
  id: 'conv-active',
  user_id: 'paid-1',
  scenario: 'airport',
  level: 'intermediate',
  status: 'active',
  speaking_seconds: 120,
  goal_seconds: 300,
  started_at: new Date(NOW - 2 * HOUR).toISOString(),
  completed_at: null,
  vocab_json: null,
  ...over,
})

describe('speak-turn handler — access control', () => {
  it('answers CORS preflight', async () => {
    const res = await makeHandler()(new Request('https://x/speak-turn', { method: 'OPTIONS' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('rejects an unauthenticated caller before touching any provider', async () => {
    const p = providers()
    const res = await makeHandler(p)(post('anon', respond('conv-1')))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('unauthenticated')
    expect(p.model!.turn).not.toHaveBeenCalled()
    expect(p.transcriber!.transcribe).not.toHaveBeenCalled()
  })

  it('rejects a signed-in free user before touching any provider or the store', async () => {
    const p = providers()
    const { store } = memoryStore()
    const spy = vi.spyOn(store, 'createConversation')
    for (const body of [{ action: 'session' }, start, respond('conv-1'), { action: 'transcribe', audio: 'QUJD' }]) {
      const res = await makeHandler(p, store)(post('free', body))
      expect(res.status).toBe(403)
      expect((await res.json()).code).toBe('not_premium')
    }
    expect(p.model!.turn).not.toHaveBeenCalled()
    expect(p.transcriber!.transcribe).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  it('denies with 503 when the entitlement cannot be verified', async () => {
    const sb = supabaseFetch()
    const broken = vi.fn(async (url: string, init?: RequestInit) =>
      url.includes('x50_students') ? new Response('down', { status: 500 }) : sb(url, init),
    )
    const res = await makeHandler(providers(), memoryStore().store, {}, broken)(post('paid', start))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('entitlement_unavailable')
  })
})

describe('speak-turn handler — conversations', () => {
  it('session: nothing yet → no current conversation, may start now', async () => {
    const res = await makeHandler()(post('paid', { action: 'session' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, current: null, nextAvailableAt: null, history: [] })
  })

  it('start creates a conversation with the chosen scenario and returns its opener', async () => {
    const { store, conversations } = memoryStore()
    const res = await makeHandler(providers(), store)(post('paid', start))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resumed).toBe(false)
    expect(body.reply).toBe('Welcome! Could you tell me a little about yourself and the job you are applying for?')
    expect(body.audio).toEqual({ base64: 'QUJD', mime: 'audio/mpeg' })
    expect(body.conversation).toMatchObject({ scenario: 'interview', status: 'active', speakingSeconds: 0, goalSeconds: 300, turns: [] })
    expect(conversations).toHaveLength(1)
    expect(conversations[0].user_id).toBe('paid-1')
  })

  it('start resumes an active conversation (with its turns) instead of opening a second one', async () => {
    const seeded = memoryStore({
      conversations: [activeRow()],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi! Where to?', feedback: { positive: 'x' }, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const res = await makeHandler(providers(), seeded.store)(post('paid', start))
    const body = await res.json()
    expect(body.resumed).toBe(true)
    expect(body.conversation.id).toBe('conv-active')
    // The stored scenario wins over the one in the request.
    expect(body.conversation.scenario).toBe('airport')
    expect(body.reply).toBe('Good morning! Where are you flying to today?')
    expect(body.conversation.turns).toHaveLength(1)
    expect(seeded.conversations).toHaveLength(1)
  })

  it('session returns the active conversation so the learner can continue', async () => {
    const seeded = memoryStore({ conversations: [activeRow()] })
    const body = await (await makeHandler(providers(), seeded.store)(post('paid', { action: 'session' }))).json()
    expect(body.current).toMatchObject({ id: 'conv-active', status: 'active', speakingSeconds: 120 })
    expect(body.nextAvailableAt).toBeNull()
  })

  it('enforces one conversation per 24 hours after completion', async () => {
    const completed = activeRow({
      id: 'conv-done',
      status: 'completed',
      speaking_seconds: 305,
      completed_at: new Date(NOW - 5 * HOUR).toISOString(),
    })
    const seeded = memoryStore({ conversations: [completed] })
    const h = makeHandler(providers(), seeded.store)

    const session = await (await h(post('paid', { action: 'session' }))).json()
    expect(session.current.status).toBe('completed')
    expect(session.nextAvailableAt).toBe(new Date(NOW + 19 * HOUR).toISOString())

    const res = await h(post('paid', start))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('daily_limit')
    expect(body.nextAvailableAt).toBe(new Date(NOW + 19 * HOUR).toISOString())
    expect(seeded.conversations).toHaveLength(1)
  })

  it('allows a new conversation once the window has passed, and lists the old one in history', async () => {
    const completed = activeRow({
      id: 'conv-old',
      status: 'completed',
      completed_at: new Date(NOW - 25 * HOUR).toISOString(),
      started_at: new Date(NOW - 26 * HOUR).toISOString(),
    })
    const seeded = memoryStore({ conversations: [completed] })
    const h = makeHandler(providers(), seeded.store)
    const session = await (await h(post('paid', { action: 'session' }))).json()
    expect(session.current).toBeNull()
    expect(session.history.map((c: { id: string }) => c.id)).toEqual(['conv-old'])
    expect((await h(post('paid', start))).status).toBe(200)
    expect(seeded.conversations).toHaveLength(2)
  })

  it('the admin is exempt from the 24 hour rule', async () => {
    const completed = activeRow({ user_id: 'admin-1', status: 'completed', completed_at: new Date(NOW - HOUR).toISOString() })
    const seeded = memoryStore({ conversations: [completed] })
    expect((await makeHandler(providers(), seeded.store)(post('admin', start))).status).toBe(200)
  })

  it('conversation returns one past conversation with its turns, only to its owner', async () => {
    const seeded = memoryStore({
      conversations: [activeRow({ id: 'conv-c1', status: 'completed', completed_at: new Date(NOW - 2 * 86_400_000).toISOString() })],
      turns: { 'conv-c1': [{ id: 't', transcript: 'a', reply: 'b', feedback: null, speaking_seconds: 3, created_at: '', audio_path: null }] },
    })
    const h = makeHandler(providers(), seeded.store)
    const ok = await (await h(post('paid', { action: 'conversation', conversationId: 'conv-c1' }))).json()
    expect(ok.conversation.turns).toHaveLength(1)
    const other = await h(post('admin', { action: 'conversation', conversationId: 'conv-c1' }))
    expect(other.status).toBe(404)
    expect((await h(post('paid', { action: 'conversation' }))).status).toBe(400)
  })

  it('reports storage as unavailable instead of guessing', async () => {
    const { store } = memoryStore()
    store.latestConversation = async () => undefined
    const res = await makeHandler(providers(), store)(post('paid', { action: 'session' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('storage_unavailable')
  })

  it('end completes an active conversation early, below its speaking goal, and opens the 24 h window', async () => {
    const row = activeRow({ speaking_seconds: 40 })
    const seeded = memoryStore({ conversations: [row] })
    const h = makeHandler(providers(), seeded.store)
    const res = await h(post('paid', { action: 'end', conversationId: row.id }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversation.status).toBe('completed')
    expect(body.conversation.speakingSeconds).toBe(40)
    expect(body.nextAvailableAt).not.toBeNull()
    expect(seeded.conversations[0].status).toBe('completed')
    expect(seeded.conversations[0].completed_at).not.toBeNull()
  })

  it('end is idempotent: ending an already-completed conversation just returns it', async () => {
    const row = activeRow({ status: 'completed', completed_at: new Date(NOW - HOUR).toISOString() })
    const seeded = memoryStore({ conversations: [row] })
    const h = makeHandler(providers(), seeded.store)
    const res = await h(post('paid', { action: 'end', conversationId: row.id }))
    expect(res.status).toBe(200)
    expect((await res.json()).conversation.status).toBe('completed')
  })

  it('end never lets one learner end another\'s conversation', async () => {
    const row = activeRow()
    const seeded = memoryStore({ conversations: [row] })
    const h = makeHandler(providers(), seeded.store)
    const res = await h(post('admin', { action: 'end', conversationId: row.id }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('conversation_not_found')
  })

  it('end exempts the admin from the 24 hour rule', async () => {
    const row = activeRow({ user_id: 'admin-1', speaking_seconds: 10 })
    const seeded = memoryStore({ conversations: [row] })
    const h = makeHandler(providers(), seeded.store)
    const res = await h(post('admin', { action: 'end', conversationId: row.id }))
    expect((await res.json()).nextAvailableAt).toBeNull()
  })
})

describe('speak-turn handler — turns', () => {
  it('validates the request body', async () => {
    const h = makeHandler()
    expect((await h(post('paid', { action: 'respond', conversationId: 'conv-1' }))).status).toBe(400)
    expect((await h(post('paid', { action: 'respond', text: 'hi' }))).status).toBe(400)
    expect((await h(post('paid', { ...start, scenario: 'x' }))).status).toBe(400)
    expect((await h(post('paid', { action: 'delete' }))).status).toBe(400)
    const bad = new Request('https://x/speak-turn', { method: 'POST', headers: { authorization: 'Bearer paid' }, body: '{not json' })
    expect((await h(bad)).status).toBe(400)
  })

  it('transcribes audio, uploads it, and reports an empty recording clearly', async () => {
    const ok = await makeHandler()(post('paid', { action: 'transcribe', audio: 'QUJD', mime: 'audio/webm' }))
    const body = await ok.json()
    expect(body.ok).toBe(true)
    expect(body.transcript).toBe('I had a great day today.')
    expect(body.audioPath).toBe('paid-1/1.webm')

    const silent = providers({ transcriber: { transcribe: async () => '   ' } })
    const empty = await makeHandler(silent)(post('paid', { action: 'transcribe', audio: 'QUJD' }))
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
    const res = await makeHandler(p)(post('paid', { action: 'transcribe', audio: 'QUJD' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('transcription_failed')
  })

  it('completes a turn: reply, feedback, audio, persisted turn, accumulated speaking time', async () => {
    const p = providers()
    const seeded = memoryStore({
      conversations: [activeRow()],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi! Where to?', feedback: null, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const res = await makeHandler(p, seeded.store)(post('paid', respond('conv-active')))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toBe(MOCK_TURN.reply)
    expect(body.feedback).toEqual(MOCK_TURN.feedback)
    expect(body.audio.mime).toBe('audio/mpeg')
    expect(body.completed).toBe(false)
    expect(body.speakingSeconds).toBeCloseTo(126.2)
    expect(body.goalSeconds).toBe(300)

    // The stored scenario and the requested level shape the prompt; the
    // server builds the history from the stored turns.
    const turn = p.model!.turn as ReturnType<typeof vi.fn>
    const input = turn.mock.calls[0][0] as { system: string; messages: { role: string; content: string }[] }
    expect(input.system).toContain('airport')
    expect(input.system).toContain('BEGINNER')
    expect(input.messages[0].role).toBe('user')
    expect(input.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
    expect(input.messages[1].content).toBe('Good morning! Where are you flying to today?')
    expect(input.messages[2].content).toBe('Hello')
    expect(input.messages[4].content).toBe('I work as a teacher for five years.')

    expect(seeded.turns['conv-active']).toHaveLength(2)
    expect(seeded.turns['conv-active'][1]).toMatchObject({ transcript: 'I work as a teacher for five years.', speaking_seconds: 6.2 })
    expect(seeded.conversations[0].speaking_seconds).toBeCloseTo(126.2)
  })

  it('carries the recording from transcribe through to the persisted turn', async () => {
    const seeded = memoryStore({ conversations: [activeRow()] })
    const h = makeHandler(providers(), seeded.store)
    const transcribed = await (await h(post('paid', { action: 'transcribe', audio: 'QUJD', mime: 'audio/webm' }))).json()
    expect(transcribed.audioPath).toBe('paid-1/1.webm')

    await h(post('paid', respond('conv-active', { audioPath: transcribed.audioPath })))
    expect(seeded.turns['conv-active'][0].audio_path).toBe('paid-1/1.webm')
  })

  it('never blocks a turn on a failed audio upload, and rejects a forged audio path', async () => {
    const seeded = memoryStore({ conversations: [activeRow()] })
    seeded.store.uploadAudio = async () => null
    const h = makeHandler(providers(), seeded.store)

    const transcribed = await (await h(post('paid', { action: 'transcribe', audio: 'QUJD', mime: 'audio/webm' }))).json()
    expect(transcribed.ok).toBe(true)
    expect(transcribed.audioPath).toBeNull()

    await h(post('paid', respond('conv-active', { audioPath: '../../etc/passwd' })))
    expect(seeded.turns['conv-active'][0].audio_path).toBeNull()
  })

  it('marks the conversation complete once speaking time reaches the goal', async () => {
    const seeded = memoryStore({ conversations: [activeRow({ speaking_seconds: 296 })] })
    const res = await makeHandler(providers(), seeded.store)(post('paid', respond('conv-active')))
    const body = await res.json()
    expect(body.completed).toBe(true)
    expect(body.completedAt).toBe(new Date(NOW).toISOString())
    expect(body.nextAvailableAt).toBe(new Date(NOW + 24 * HOUR).toISOString())
    expect(seeded.conversations[0].status).toBe('completed')

    // A completed conversation accepts no more turns.
    const again = await makeHandler(providers(), seeded.store)(post('paid', respond('conv-active')))
    expect(again.status).toBe(409)
    expect((await again.json()).code).toBe('conversation_completed')
  })

  it('credits a typed answer with an estimated speaking time', async () => {
    const seeded = memoryStore({ conversations: [activeRow({ speaking_seconds: 0 })] })
    const text = Array.from({ length: 25 }, () => 'word').join(' ')
    const body = await (await makeHandler(providers(), seeded.store)(post('paid', respond('conv-active', { text, speakingSeconds: 0 })))).json()
    expect(body.speakingSeconds).toBe(10)
  })

  it('rejects a turn for a conversation the caller does not own', async () => {
    const seeded = memoryStore({ conversations: [activeRow({ user_id: 'someone-else' })] })
    const res = await makeHandler(providers(), seeded.store)(post('paid', respond('conv-active')))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('conversation_not_found')
  })

  it('still answers when speech synthesis fails', async () => {
    const p = providers({
      synthesizer: {
        synthesize: async () => {
          throw new ProviderError('upstream', 'tts down')
        },
      },
    })
    const seeded = memoryStore({ conversations: [activeRow()] })
    const body = await (await makeHandler(p, seeded.store)(post('paid', respond('conv-active')))).json()
    expect(body.reply).toBe(MOCK_TURN.reply)
    expect(body.audio).toBeNull()
  })

  it('rejects malformed model output (after one retry) and persists nothing', async () => {
    const turn = vi.fn(async () => ({ reply: '', feedback: 'nope' }))
    const seeded = memoryStore({ conversations: [activeRow()] })
    const res = await makeHandler(providers({ model: { turn } }), seeded.store)(post('paid', respond('conv-active')))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('ai_malformed')
    expect(turn).toHaveBeenCalledTimes(2)
    expect(seeded.turns['conv-active'] ?? []).toHaveLength(0)
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
      const seeded = memoryStore({ conversations: [activeRow()] })
      const res = await makeHandler(providers({ model: { turn } }), seeded.store)(post('paid', respond('conv-active')))
      expect(res.status).toBe(status)
      expect((await res.json()).code).toBe(code)
      expect(turn).toHaveBeenCalledTimes(1)
    }
  })

  it('returns 503 when a provider is not configured (never a fake answer)', async () => {
    const seeded = memoryStore({ conversations: [activeRow()] })
    const res = await makeHandler(providers({ model: null }), seeded.store)(post('paid', respond('conv-active')))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('provider_unavailable')
  })

  it('rate limits bursts per user and the daily turn count', async () => {
    const h = makeHandler(providers(), memoryStore().store, { limiter: new MinuteLimiter(2) })
    expect((await h(post('paid', { action: 'session' }))).status).toBe(200)
    expect((await h(post('paid', { action: 'session' }))).status).toBe(200)
    const third = await h(post('paid', { action: 'session' }))
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBeTruthy()
    expect((await h(post('admin', { action: 'session' }))).status).toBe(200)

    const seeded = memoryStore({ conversations: [activeRow()] })
    const daily = await makeHandler(providers(), seeded.store, {}, supabaseFetch({ turnsToday: 150 }))(post('paid', respond('conv-active')))
    expect(daily.status).toBe(429)
    expect((await daily.json()).code).toBe('rate_limited')
  })
})

describe('speak-turn handler — vocabulary', () => {
  it('generates the vocabulary review from the transcript and caches it on the row', async () => {
    const p = providers()
    const seeded = memoryStore({
      conversations: [activeRow({ status: 'completed', completed_at: new Date(NOW - HOUR).toISOString() })],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi! Where to?', feedback: null, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const h = makeHandler(p, seeded.store)
    const res = await h(post('paid', { action: 'vocabulary', conversationId: 'conv-active' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.vocabulary).toEqual(MOCK_VOCAB)
    expect(p.model!.vocabulary).toHaveBeenCalledTimes(1)
    expect(seeded.conversations[0].vocab_json).toEqual(MOCK_VOCAB)

    // A second request must not call the model again — it reads the cached row.
    const again = await h(post('paid', { action: 'vocabulary', conversationId: 'conv-active' }))
    expect((await again.json()).vocabulary).toEqual(MOCK_VOCAB)
    expect(p.model!.vocabulary).toHaveBeenCalledTimes(1)
  })

  it('returns an empty list rather than calling the model when there are no turns yet', async () => {
    const p = providers()
    const seeded = memoryStore({ conversations: [activeRow()] })
    const res = await makeHandler(p, seeded.store)(post('paid', { action: 'vocabulary', conversationId: 'conv-active' }))
    const body = await res.json()
    expect(body.vocabulary).toEqual({ missing: [], contextual: [], upgrades: [] })
    expect(p.model!.vocabulary).not.toHaveBeenCalled()
  })

  it('never lets one learner fetch another\'s vocabulary review', async () => {
    const seeded = memoryStore({ conversations: [activeRow()] })
    const res = await makeHandler(providers(), seeded.store)(post('admin', { action: 'vocabulary', conversationId: 'conv-active' }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('conversation_not_found')
  })

  it('returns 503 when the model is not configured', async () => {
    const seeded = memoryStore({
      conversations: [activeRow()],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi!', feedback: null, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const res = await makeHandler(providers({ model: null }), seeded.store)(post('paid', { action: 'vocabulary', conversationId: 'conv-active' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('provider_unavailable')
  })

  it('reports a malformed model answer instead of guessing', async () => {
    const seeded = memoryStore({
      conversations: [activeRow()],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi!', feedback: null, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const vocabulary = vi.fn(async () => ({ missing: [], contextual: [], upgrades: [] }))
    const res = await makeHandler(providers({ model: { turn: vi.fn(async () => MOCK_TURN), vocabulary } }), seeded.store)(
      post('paid', { action: 'vocabulary', conversationId: 'conv-active' }),
    )
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('ai_malformed')
    expect(vocabulary).toHaveBeenCalledTimes(2)
  })

  it('retries once and succeeds when the first vocabulary answer is malformed', async () => {
    const seeded = memoryStore({
      conversations: [activeRow()],
      turns: { 'conv-active': [{ id: 't1', transcript: 'Hello', reply: 'Hi!', feedback: null, speaking_seconds: 5, created_at: '', audio_path: null }] },
    })
    const vocabulary = vi
      .fn()
      .mockResolvedValueOnce({ missing: [], contextual: [], upgrades: [] })
      .mockResolvedValueOnce(MOCK_VOCAB)
    const res = await makeHandler(providers({ model: { turn: vi.fn(async () => MOCK_TURN), vocabulary } }), seeded.store)(
      post('paid', { action: 'vocabulary', conversationId: 'conv-active' }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).vocabulary).toEqual(MOCK_VOCAB)
    expect(vocabulary).toHaveBeenCalledTimes(2)
  })
})

describe('speak-turn handler — emma gift', () => {
  /** 4 already-completed, qualifying (>=60s) conversations for another one to complete the 5th. */
  const fourQualifying = (userId: string) =>
    Array.from({ length: 4 }, (_, i) =>
      activeRow({
        id: `conv-old-${i}`,
        user_id: userId,
        status: 'completed',
        speaking_seconds: 90,
        completed_at: new Date(NOW - (i + 2) * HOUR).toISOString(),
      }),
    )

  it('grants the gift when ending the 5th qualifying conversation', async () => {
    const row = activeRow({ speaking_seconds: 65 })
    const seeded = memoryStore({ conversations: [...fourQualifying('paid-1'), row] })
    const h = makeHandler(providers(), seeded.store)
    await h(post('paid', { action: 'end', conversationId: row.id }))
    expect(seeded.giftClaimed.has('paid-1')).toBe(true)
  })

  it('grants the gift when a turn completes the 5th qualifying conversation', async () => {
    // Requests are capped at LIMITS.maxRecordingSeconds (60s); +60 reaches the 300s goal.
    const row = activeRow({ speaking_seconds: 240 })
    const seeded = memoryStore({ conversations: [...fourQualifying('paid-1'), row] })
    const h = makeHandler(providers(), seeded.store)
    await h(post('paid', respond('conv-active', { speakingSeconds: 60 })))
    expect(seeded.giftClaimed.has('paid-1')).toBe(true)
  })

  it('does not grant the gift below 5 qualifying conversations', async () => {
    const row = activeRow({ speaking_seconds: 65 })
    const seeded = memoryStore({ conversations: [...fourQualifying('paid-1').slice(0, 3), row] })
    const h = makeHandler(providers(), seeded.store)
    await h(post('paid', { action: 'end', conversationId: row.id }))
    expect(seeded.giftClaimed.has('paid-1')).toBe(false)
  })

  it('does not count a completed conversation under a minute toward the gift', async () => {
    const short = activeRow({ id: 'conv-short', speaking_seconds: 65 })
    const seeded = memoryStore({
      conversations: [
        ...fourQualifying('paid-1').map((c) => ({ ...c, speaking_seconds: 30 })), // completed, but too short
        short,
      ],
    })
    const h = makeHandler(providers(), seeded.store)
    await h(post('paid', { action: 'end', conversationId: short.id }))
    expect(seeded.giftClaimed.has('paid-1')).toBe(false)
  })

  it('is never granted twice, even across repeated completions past the threshold', async () => {
    const rows = [
      ...fourQualifying('paid-1'),
      activeRow({ id: 'conv-5th', speaking_seconds: 65, status: 'completed', completed_at: new Date(NOW - HOUR).toISOString() }),
      activeRow({ id: 'conv-6th', speaking_seconds: 65 }),
    ]
    const seeded = memoryStore({ conversations: rows })
    const spy = vi.spyOn(seeded.store, 'maybeGrantEmmaGift')
    const h = makeHandler(providers(), seeded.store)
    await h(post('paid', { action: 'end', conversationId: 'conv-6th' }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(seeded.giftClaimed.has('paid-1')).toBe(true)
    // A second completion after the gift is already claimed changes nothing.
    const seventh = activeRow({ id: 'conv-7th', speaking_seconds: 65 })
    seeded.conversations.push(seventh)
    await h(post('paid', { action: 'end', conversationId: 'conv-7th' }))
    expect(seeded.giftClaimed.has('paid-1')).toBe(true)
  })
})

describe('helpers', () => {
  it('toModelMessages alternates roles and keeps only the most recent pairs', () => {
    const turns: TurnRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      transcript: `u${i}`,
      reply: `a${i}`,
      feedback: null,
      speaking_seconds: 1,
      created_at: '',
    }))
    const msgs = toModelMessages('Hi!', turns, 'latest')
    expect(msgs[0].role).toBe('user')
    expect(msgs[1]).toEqual({ role: 'assistant', content: 'Hi!' })
    expect(msgs[2].content).toBe('u4')
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'latest' })
    for (let i = 1; i < msgs.length; i++) expect(msgs[i].role).not.toBe(msgs[i - 1].role)
  })

  it('nextAvailableAt is 24 h after completion, or null', () => {
    expect(nextAvailableAt(null, NOW)).toBeNull()
    expect(nextAvailableAt(activeRow(), NOW)).toBeNull()
    const done = activeRow({ status: 'completed', completed_at: new Date(NOW - HOUR).toISOString() })
    expect(nextAvailableAt(done, NOW)).toBe(new Date(NOW + 23 * HOUR).toISOString())
    const old = activeRow({ status: 'completed', completed_at: new Date(NOW - 30 * HOUR).toISOString() })
    expect(nextAvailableAt(old, NOW)).toBeNull()
  })
})
