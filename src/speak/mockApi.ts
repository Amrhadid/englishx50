// A canned SpeakApi for local development and screenshots. Selected only by
// devMock.ts (never in production) or explicitly by tests.

import type { ScenarioId, SpeakApi, SpeakAudio, SpeakFeedback } from './types'

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

export function createMockSpeakApi(opts: { fail?: MockFailure | string | null; delayMs?: number } = {}): SpeakApi {
  const delay = opts.delayMs ?? 700
  const fail = opts.fail ?? null
  let turn = 0
  return {
    async start({ scenario, wantAudio }) {
      await wait(delay)
      if (fail === 'start') return { ok: false, code: 'server' }
      if (fail === 'not_premium') return { ok: false, code: 'not_premium', status: 403 }
      return { ok: true, reply: OPENERS[scenario], audio: wantAudio ? silentWav() : null }
    },
    async transcribe() {
      await wait(delay)
      if (fail === 'transcribe') return { ok: false, code: 'transcription_failed', status: 502 }
      if (fail === 'empty') return { ok: false, code: 'empty_transcript', status: 422 }
      if (fail === 'network') return { ok: false, code: 'network' }
      if (fail === 'timeout') return { ok: false, code: 'timeout' }
      return { ok: true, transcript: 'The best part of my day is teaching my class.' }
    },
    async respond({ wantAudio }) {
      await wait(delay)
      if (fail === 'ai') return { ok: false, code: 'ai_failed', status: 502 }
      if (fail === 'malformed') return { ok: false, code: 'ai_malformed', status: 502 }
      if (fail === 'rate') return { ok: false, code: 'rate_limited', status: 429 }
      if (fail === 'network') return { ok: false, code: 'network' }
      if (fail === 'timeout') return { ok: false, code: 'timeout' }
      const i = turn++ % REPLIES.length
      return { ok: true, reply: REPLIES[i], feedback: FEEDBACKS[i], audio: wantAudio ? silentWav() : null }
    },
  }
}
