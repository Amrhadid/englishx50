// EnglishX50 /speak — request and model-output validation. Pure functions,
// no Deno globals, so they run under the Vitest suite as well as on the edge.

import { isLevelId, isScenarioId, type LevelId, type ScenarioId } from './prompt.ts'

export const LIMITS = {
  /** Longest recording the client may send (seconds). Client auto-stops here too. */
  maxRecordingSeconds: 60,
  /** Largest decoded audio payload (bytes) — ~60 s of Opus is well under this. */
  maxAudioBytes: 6 * 1024 * 1024,
  /** Longest learner transcript kept and sent to the model (characters). */
  maxTranscriptChars: 1200,
  /** Longest reply we accept from the model (characters). */
  maxReplyChars: 700,
  /** Longest single feedback field (characters). */
  maxFeedbackChars: 400,
  /** Most prior messages passed to the model (assistant + user, most recent kept). */
  maxHistoryMessages: 12,
  /** Per-user request ceiling per minute (all actions). */
  perMinute: 12,
  /** Per-user conversation turns per day (persisted rows). */
  perDay: 150,
  /** Provider timeouts (ms). */
  transcribeTimeoutMs: 25_000,
  modelTimeoutMs: 35_000,
  ttsTimeoutMs: 20_000,
} as const

export type SpeakAction = 'start' | 'transcribe' | 'respond'

export interface HistoryMessage {
  role: 'assistant' | 'user'
  text: string
}

export interface SpeakRequest {
  action: SpeakAction
  scenario: ScenarioId
  level: LevelId
  /** Learner's typed or transcribed words (respond). */
  text?: string
  /** Base64 audio (transcribe). */
  audio?: string
  mime?: string
  history: HistoryMessage[]
  /** Seconds the learner spoke for this turn, as measured by the client. */
  speakingSeconds: number
  wantAudio: boolean
}

export type ParseResult = { ok: true; value: SpeakRequest } | { ok: false; error: string }

// Control characters (except tab / newline) that STT or the model may emit.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', 'g')

/** Collapse whitespace and strip control characters. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') return ''
  const stripped = input.replace(CONTROL_CHARS, '')
  const collapsed = stripped.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return collapsed.length > max ? collapsed.slice(0, max).trim() : collapsed
}

function parseHistory(raw: unknown): HistoryMessage[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw)) return null
  const out: HistoryMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const role = (item as { role?: unknown }).role
    if (role !== 'assistant' && role !== 'user') return null
    const text = cleanText((item as { text?: unknown }).text, LIMITS.maxTranscriptChars)
    if (!text) continue
    out.push({ role, text })
  }
  // Keep the most recent messages so the model always sees the latest turns.
  return out.length > LIMITS.maxHistoryMessages ? out.slice(-LIMITS.maxHistoryMessages) : out
}

export function parseSpeakRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' }
  const b = body as Record<string, unknown>

  const action = b.action
  if (action !== 'start' && action !== 'transcribe' && action !== 'respond') {
    return { ok: false, error: 'Unknown action' }
  }
  if (!isScenarioId(b.scenario)) return { ok: false, error: 'Unknown scenario' }
  if (!isLevelId(b.level)) return { ok: false, error: 'Unknown level' }

  const history = parseHistory(b.history)
  if (history === null) return { ok: false, error: 'Malformed history' }

  const rawSeconds =
    typeof b.speakingSeconds === 'number' && Number.isFinite(b.speakingSeconds) ? b.speakingSeconds : 0
  const speakingSeconds = Math.min(Math.max(rawSeconds, 0), LIMITS.maxRecordingSeconds)

  const req: SpeakRequest = {
    action,
    scenario: b.scenario,
    level: b.level,
    history,
    speakingSeconds,
    wantAudio: b.wantAudio !== false,
  }

  if (action === 'transcribe') {
    if (typeof b.audio !== 'string' || !b.audio) return { ok: false, error: 'Missing audio' }
    // 4 base64 chars ≈ 3 bytes; reject oversize payloads before decoding.
    if (b.audio.length > (LIMITS.maxAudioBytes / 3) * 4 + 4) return { ok: false, error: 'Audio too large' }
    req.audio = b.audio
    req.mime = typeof b.mime === 'string' && b.mime ? b.mime.slice(0, 60) : 'audio/webm'
  }

  if (action === 'respond') {
    const text = cleanText(b.text, LIMITS.maxTranscriptChars)
    if (text.length < 2) return { ok: false, error: 'Missing text' }
    req.text = text
  }

  return { ok: true, value: req }
}

/** The structured shape returned to the client for one conversation turn. */
export interface SpeakingTurnResponse {
  reply: string
  feedback: {
    positive: string
    original?: string
    correction?: string
    explanationArabic?: string
  }
}

/**
 * Validate the raw tool input the model produced. Returns null for anything
 * that does not carry a usable reply and feedback, so a malformed model answer
 * never reaches the learner.
 */
export function validateModelOutput(raw: unknown): SpeakingTurnResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const reply = cleanText(r.reply, LIMITS.maxReplyChars)
  if (reply.length < 2) return null

  const fb = r.feedback
  if (!fb || typeof fb !== 'object') return null
  const f = fb as Record<string, unknown>
  const positive = cleanText(f.positive, LIMITS.maxFeedbackChars)
  if (!positive) return null

  const original = cleanText(f.original, LIMITS.maxFeedbackChars)
  const correction = cleanText(f.correction, LIMITS.maxFeedbackChars)
  const explanationArabic = cleanText(f.explanationArabic, LIMITS.maxFeedbackChars)

  const feedback: SpeakingTurnResponse['feedback'] = { positive }
  // A correction is only meaningful as a pair; a lone original or a
  // correction identical to the original is dropped rather than shown.
  if (original && correction && original.toLowerCase() !== correction.toLowerCase()) {
    feedback.original = original
    feedback.correction = correction
    if (explanationArabic) feedback.explanationArabic = explanationArabic
  } else if (correction && !original) {
    feedback.correction = correction
    if (explanationArabic) feedback.explanationArabic = explanationArabic
  }

  return { reply, feedback }
}
