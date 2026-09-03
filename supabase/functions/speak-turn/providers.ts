// EnglishX50 /speak — provider adapters behind small interfaces.
//
//   Transcriber        speech → text     OpenAI Whisper (already used by `transcribe`)
//   ConversationModel  turn → reply/fb   Anthropic Claude (already used by `EnglishX50feedback`)
//   Synthesizer        text → speech     OpenAI TTS (new; reuses the existing OPENAI_API_KEY)
//
// Every adapter takes `fetch` and its key as arguments so the handler can be
// exercised with fakes. Mock adapters exist for local development only and are
// selected exclusively by SPEAK_MOCK_MODE=true — production never falls back
// to them (a missing provider is a 503, not a fake answer).

import { SPEAKING_TURN_TOOL } from './prompt.ts'
import type { FetchLike } from './access.ts'

export type ProviderErrorKind = 'rate_limited' | 'timeout' | 'upstream' | 'malformed' | 'refused'

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export interface CallOptions {
  signal: AbortSignal
}

export interface Transcriber {
  transcribe(audio: Blob, opts: CallOptions): Promise<string>
}

export interface ModelMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnInput {
  system: string
  messages: ModelMessage[]
}

export interface ConversationModel {
  /** Returns the raw tool input the model produced (validated by the caller). */
  turn(input: TurnInput, opts: CallOptions): Promise<unknown>
}

export interface SpeechAudio {
  base64: string
  mime: string
}

export interface Synthesizer {
  synthesize(text: string, opts: CallOptions): Promise<SpeechAudio>
}

export interface Providers {
  transcriber: Transcriber | null
  model: ConversationModel | null
  synthesizer: Synthesizer | null
}

function extOf(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

// ---------------------------------------------------------------------------
// OpenAI Whisper (speech → text)
// ---------------------------------------------------------------------------

export function openAiTranscriber(apiKey: string, fetchFn: FetchLike, model = 'whisper-1'): Transcriber {
  return {
    async transcribe(audio, { signal }) {
      const form = new FormData()
      form.append('file', audio, `audio.${extOf(audio.type || 'audio/webm')}`)
      form.append('model', model)
      // Learners answer in English; without this Whisper may auto-detect
      // accented English as Arabic.
      form.append('language', 'en')
      form.append('response_format', 'json')
      const resp = await fetchFn('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal,
      })
      if (resp.status === 429) throw new ProviderError('rate_limited', 'Transcription rate limited', 429)
      if (!resp.ok) throw new ProviderError('upstream', `Transcription failed (${resp.status})`, resp.status)
      const data = (await resp.json()) as { text?: unknown }
      return typeof data.text === 'string' ? data.text : ''
    },
  }
}

// ---------------------------------------------------------------------------
// Anthropic Claude (conversation turn + feedback via one strict tool call)
// ---------------------------------------------------------------------------

export interface AnthropicOptions {
  model: string
  /** `output_config.effort`; pass 'off' to omit the field for models without it. */
  effort: string
}

export function anthropicModel(apiKey: string, fetchFn: FetchLike, options: AnthropicOptions): ConversationModel {
  return {
    async turn({ system, messages }, { signal }) {
      const body: Record<string, unknown> = {
        model: options.model,
        max_tokens: 2048,
        system,
        messages,
        tools: [SPEAKING_TURN_TOOL],
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      }
      if (options.effort && options.effort !== 'off') body.output_config = { effort: options.effort }

      const resp = await fetchFn('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      })
      if (resp.status === 429) throw new ProviderError('rate_limited', 'Model rate limited', 429)
      if (resp.status === 529) throw new ProviderError('upstream', 'Model overloaded', 529)
      if (!resp.ok) throw new ProviderError('upstream', `Model error (${resp.status})`, resp.status)

      const data = (await resp.json()) as {
        stop_reason?: string
        content?: { type: string; name?: string; input?: unknown }[]
      }
      if (data.stop_reason === 'refusal') throw new ProviderError('refused', 'Model refused the turn')
      const block = (data.content ?? []).find(
        (b) => b.type === 'tool_use' && b.name === SPEAKING_TURN_TOOL.name,
      )
      if (!block || block.input == null) throw new ProviderError('malformed', 'Model returned no tool call')
      return block.input
    },
  }
}

// ---------------------------------------------------------------------------
// OpenAI TTS (text → speech)
// ---------------------------------------------------------------------------

export interface OpenAiTtsOptions {
  model: string
  voice: string
}

export function openAiSynthesizer(apiKey: string, fetchFn: FetchLike, options: OpenAiTtsOptions): Synthesizer {
  return {
    async synthesize(text, { signal }) {
      const resp = await fetchFn('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          voice: options.voice,
          input: text,
          response_format: 'mp3',
          instructions: 'Warm, friendly and clear. Slightly slower than normal, for an English learner.',
        }),
        signal,
      })
      if (resp.status === 429) throw new ProviderError('rate_limited', 'Speech rate limited', 429)
      if (!resp.ok) throw new ProviderError('upstream', `Speech failed (${resp.status})`, resp.status)
      const bytes = new Uint8Array(await resp.arrayBuffer())
      if (bytes.length === 0) throw new ProviderError('upstream', 'Empty speech response')
      return { base64: bytesToBase64(bytes), mime: 'audio/mpeg' }
    },
  }
}

// ---------------------------------------------------------------------------
// Development mock — deterministic, no network, no audio
// ---------------------------------------------------------------------------

export const MOCK_TRANSCRIPT = 'The best part of my day is teaching my class.'

export const MOCK_TURN = {
  reply: "That sounds lovely! What do you teach, and what do you enjoy most about your students?",
  feedback: {
    positive: 'إجابة واضحة وطبيعية',
    original: 'The best part of my day is teaching my class.',
    correction: 'The best part of my day was teaching my class.',
    explanationArabic: 'نستخدم was لأن اليوم انتهى، فالحدث في الماضي.',
  },
}

export function mockProviders(): Providers {
  return {
    transcriber: { transcribe: async () => MOCK_TRANSCRIPT },
    model: { turn: async () => MOCK_TURN },
    synthesizer: null,
  }
}
