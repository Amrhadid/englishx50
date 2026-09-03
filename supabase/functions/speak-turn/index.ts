// EnglishX50 — /speak conversation Edge Function (Deno / Supabase).
//
// Push-to-talk speaking practice with "Emma": transcribe the learner's
// recording, generate a short reply plus one structured correction, and
// synthesise the reply as speech. See handler.ts for the request contract.
//
// Deploy:
//   supabase functions deploy speak-turn --no-verify-jwt
//
// Secrets (set with `supabase secrets set NAME=value`):
//   OPENAI_API_KEY           Whisper transcription + TTS (already set for `transcribe`)
//   ANTHROPIC_API_KEY        Claude conversation turn (already set for `EnglishX50feedback`)
//   SUPABASE_SERVICE_ROLE_KEY  entitlement check + persistence (auto-injected)
//   SUPABASE_URL / SUPABASE_ANON_KEY                              (auto-injected)
// Optional:
//   SPEAK_MODEL              Claude model id       (default: claude-opus-5)
//   SPEAK_MODEL_EFFORT       output_config.effort  (default: low; 'off' to omit)
//   SPEAK_STT_MODEL          OpenAI STT model      (default: whisper-1)
//   SPEAK_TTS_PROVIDER       'openai' | 'none'     (default: openai)
//   SPEAK_TTS_MODEL          OpenAI TTS model      (default: gpt-4o-mini-tts)
//   SPEAK_TTS_VOICE          OpenAI TTS voice      (default: nova)
//   SPEAK_MOCK_MODE          'true' → canned providers, no paid calls (dev only)
//
// Access: verified sign-in + active premium (or the admin), checked server-side
// on every request and failing closed — see access.ts.

import { createSpeakHandler } from './handler.ts'
import { anthropicModel, mockProviders, openAiSynthesizer, openAiTranscriber, type Providers } from './providers.ts'

const env = (name: string, fallback = '') => Deno.env.get(name) ?? fallback

const OPENAI_API_KEY = env('OPENAI_API_KEY')
const ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY')
const mockMode = env('SPEAK_MOCK_MODE') === 'true'

function realProviders(): Providers {
  const ttsProvider = env('SPEAK_TTS_PROVIDER', 'openai')
  return {
    transcriber: OPENAI_API_KEY ? openAiTranscriber(OPENAI_API_KEY, fetch, env('SPEAK_STT_MODEL', 'whisper-1')) : null,
    model: ANTHROPIC_API_KEY
      ? anthropicModel(ANTHROPIC_API_KEY, fetch, {
          model: env('SPEAK_MODEL', 'claude-opus-5'),
          effort: env('SPEAK_MODEL_EFFORT', 'low'),
        })
      : null,
    synthesizer:
      ttsProvider === 'openai' && OPENAI_API_KEY
        ? openAiSynthesizer(OPENAI_API_KEY, fetch, {
            model: env('SPEAK_TTS_MODEL', 'gpt-4o-mini-tts'),
            voice: env('SPEAK_TTS_VOICE', 'nova'),
          })
        : null,
  }
}

const handler = createSpeakHandler({
  env: {
    supabaseUrl: env('SUPABASE_URL'),
    anonKey: env('SUPABASE_ANON_KEY'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    adminEmail: 'siramrhadid@gmail.com',
    programDays: 100,
    mockMode,
  },
  fetch,
  providers: mockMode ? mockProviders() : realProviders(),
})

Deno.serve(handler)
