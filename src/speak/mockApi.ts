// A canned SpeakApi for local development and screenshots. Selected only by
// devMock.ts (never in production) or explicitly by tests. Conversations live
// in memory for the page's lifetime; `?mock=…` in devMock.ts picks the gate.

import type { Conversation, ScenarioId, SpeakApi, SpeakAudio, SpeakFeedback, StoredTurn } from './types'

export type MockFailure =
  | 'start'
  | 'transcribe'
  | 'ai'
  | 'malformed'
  | 'rate'
  | 'network'
  | 'timeout'
  | 'empty'
  | 'not_premium'
  | 'locked'
  | 'resume'
  | 'complete'

const OPENERS: Record<ScenarioId, string> = {
  daily: 'Hi! What was the best part of your day?',
  interview: 'Welcome! Could you tell me a little about yourself and the job you are applying for?',
  airport: 'Good morning! Where are you flying to today?',
  meeting: 'Thanks for joining. Could you give us a quick update on your project?',
  shopping: 'Hi there! Are you looking for anything special today?',
  free: 'Hi! What would you like to talk about today?',
}

const REPLIES = [
  'That sounds lovely! What do you teach, and what do you enjoy most about your students?',
  'Nice! How long have you been doing that?',
  'Interesting. What would you like to change about it next year?',
]

const FEEDBACKS: SpeakFeedback[] = [
  {
    positive: 'إجابة واضحة وطبيعية',
    original: 'The best part of my day is teaching my class.',
    correction: 'The best part of my day was teaching my class.',
    explanationArabic: 'نستخدم was لأن اليوم انتهى، فالحدث في الماضي.',
  },
  { positive: 'جملة صحيحة ومرتبة، أحسنت' },
  {
    positive: 'وصلت الفكرة كويس جداً',
    original: 'I am working there since three years.',
    correction: 'I have been working there for three years.',
    explanationArabic: 'مع المدة نستخدم for، والزمن هنا المضارع التام المستمر.',
  },
]

/** A short silent WAV so the "Emma is speaking" state can be exercised offline. */
export function silentWav(seconds = 1.2, sampleRate = 8000): SpeakAudio {
  const samples = Math.floor(seconds * sampleRate)
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples * 2, true)
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { base64: btoa(bin), mime: 'audio/wav' }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const iso = (ms: number) => new Date(ms).toISOString()

function sampleTurns(n: number, startMs: number): StoredTurn[] {
  const texts = [
    'The best part of my day is teaching my class.',
    'I teach English to teenagers, and I like their energy.',
    'I am working there since three years.',
  ]
  return Array.from({ length: n }, (_, i) => ({
    id: `mock-turn-${i + 1}`,
    transcript: texts[i % texts.length],
    reply: REPLIES[i % REPLIES.length],
    feedback: FEEDBACKS[i % FEEDBACKS.length],
    speakingSeconds: 8,
    createdAt: iso(startMs + i * 60_000),
  }))
}

export function createMockSpeakApi(opts: { fail?: MockFailure | string | null; delayMs?: number } = {}): SpeakApi {
  const delay = opts.delayMs ?? 700
  const fail = opts.fail ?? null
  const now = Date.now()
  let turn = 0

  // In-memory state: one current conversation plus a couple of finished ones.
  const history: Conversation[] = [
    {
      id: 'mock-conv-old-1',
      scenario: 'interview',
      level: 'intermediate',
      status: 'completed',
      speakingSeconds: 312,
      goalSeconds: 300,
      startedAt: iso(now - 3 * 86_400_000),
      completedAt: iso(now - 3 * 86_400_000 + 900_000),
      opener: OPENERS.interview,
    },
    {
      id: 'mock-conv-old-2',
      scenario: 'airport',
      level: 'beginner',
      status: 'completed',
      speakingSeconds: 305,
      goalSeconds: 300,
      startedAt: iso(now - 2 * 86_400_000),
      completedAt: iso(now - 2 * 86_400_000 + 700_000),
      opener: OPENERS.airport,
    },
  ]
  let current: Conversation | null = null
  if (fail === 'resume') {
    current = {
      id: 'mock-conv-active',
      scenario: 'daily',
      level: 'intermediate',
      status: 'active',
      speakingSeconds: 96,
      goalSeconds: 300,
      startedAt: iso(now - 3_600_000),
      completedAt: null,
      opener: OPENERS.daily,
      turns: sampleTurns(2, now - 3_600_000),
    }
  } else if (fail === 'locked') {
    current = {
      id: 'mock-conv-done',
      scenario: 'daily',
      level: 'intermediate',
      status: 'completed',
      speakingSeconds: 304,
      goalSeconds: 300,
      startedAt: iso(now - 2 * 3_600_000),
      completedAt: iso(now - 3_600_000),
      opener: OPENERS.daily,
      turns: sampleTurns(3, now - 2 * 3_600_000),
    }
  }
  const goal = fail === 'complete' ? 20 : 300

  return {
    async session() {
      await wait(delay)
      if (fail === 'network') return { ok: false, code: 'network' }
      const next = current?.status === 'completed' ? iso(new Date(current.completedAt!).getTime() + 86_400_000) : null
      return { ok: true, current, nextAvailableAt: next, history }
    },
    async conversation({ conversationId }) {
      await wait(delay)
      const c = [current, ...history].find((x) => x?.id === conversationId)
      if (!c) return { ok: false, code: 'conversation_not_found', status: 404 }
      return { ok: true, conversation: { ...c, turns: c.turns ?? sampleTurns(3, new Date(c.startedAt).getTime()) } }
    },
    async start({ scenario, level, wantAudio }) {
      await wait(delay)
      if (fail === 'start') return { ok: false, code: 'server' }
      if (fail === 'not_premium') return { ok: false, code: 'not_premium', status: 403 }
      if (current?.status === 'active') {
        return { ok: true, conversation: current, reply: current.opener, audio: wantAudio ? silentWav() : null, resumed: true }
      }
      if (current?.status === 'completed') {
        return {
          ok: false,
          code: 'daily_limit',
          status: 409,
          nextAvailableAt: iso(new Date(current.completedAt!).getTime() + 86_400_000),
        }
      }
      current = {
        id: `mock-conv-${Date.now().toString(36)}`,
        scenario,
        level,
        status: 'active',
        speakingSeconds: 0,
        goalSeconds: goal,
        startedAt: iso(Date.now()),
        completedAt: null,
        opener: OPENERS[scenario],
        turns: [],
      }
      return { ok: true, conversation: current, reply: OPENERS[scenario], audio: wantAudio ? silentWav() : null, resumed: false }
    },
    async transcribe() {
      await wait(delay)
      if (fail === 'transcribe') return { ok: false, code: 'transcription_failed', status: 502 }
      if (fail === 'empty') return { ok: false, code: 'empty_transcript', status: 422 }
      if (fail === 'network') return { ok: false, code: 'network' }
      if (fail === 'timeout') return { ok: false, code: 'timeout' }
      return { ok: true, transcript: 'The best part of my day is teaching my class.' }
    },
    async respond({ text, speakingSeconds, wantAudio }) {
      await wait(delay)
      if (fail === 'ai') return { ok: false, code: 'ai_failed', status: 502 }
      if (fail === 'malformed') return { ok: false, code: 'ai_malformed', status: 502 }
      if (fail === 'rate') return { ok: false, code: 'rate_limited', status: 429 }
      if (fail === 'network') return { ok: false, code: 'network' }
      if (fail === 'timeout') return { ok: false, code: 'timeout' }
      if (!current || current.status !== 'active') return { ok: false, code: 'conversation_completed', status: 409 }
      const i = turn++ % REPLIES.length
      const seconds = speakingSeconds > 0 ? speakingSeconds : Math.min(60, text.split(/\s+/).length / 2.5)
      current.speakingSeconds = Math.round((current.speakingSeconds + seconds) * 10) / 10
      current.turns = [
        ...(current.turns ?? []),
        { id: `mock-turn-${Date.now().toString(36)}`, transcript: text, reply: REPLIES[i], feedback: FEEDBACKS[i], speakingSeconds: seconds, createdAt: iso(Date.now()) },
      ]
      const completed = current.speakingSeconds >= current.goalSeconds
      if (completed) {
        current.status = 'completed'
        current.completedAt = iso(Date.now())
        history.unshift(current)
      }
      return {
        ok: true,
        reply: REPLIES[i],
        feedback: FEEDBACKS[i],
        audio: wantAudio ? silentWav() : null,
        speakingSeconds: current.speakingSeconds,
        goalSeconds: current.goalSeconds,
        completed,
        completedAt: current.completedAt,
        nextAvailableAt: completed ? iso(Date.now() + 86_400_000) : null,
      }
    },
  }
}
