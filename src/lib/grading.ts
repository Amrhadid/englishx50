import { supabase } from './supabase'
import { reportFunctionError } from './functionError'
import { serverTaskKey } from './progress'
import { withTimeout } from './async'
import type { SpeakingResult, Mistake, VocabItem } from '../types'

interface GradeParams {
  question: string
  transcript: string
  student?: string
  /** Signed-in account id, so the saved row can be read back by its owner. */
  userId?: string | null
  challengeId?: string
  challengeNumber?: number
  taskIndex?: number
  audioKey?: string | null
}

/** Coerce a value that may be an array, a JSON string, or null into an array. */
function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

/** Reconstructs a SpeakingResult from a stored x50_submissions row. */
export function parseSubmission(row: Record<string, unknown>): SpeakingResult {
  return {
    score: Math.round(Number(row.score ?? 0)),
    passed: !!row.passed,
    feedback: typeof row.feedback === 'string' ? row.feedback : '',
    mistakes: toArray<Mistake>(row.mistakes_json),
    corrected_sentences: toArray<string>(row.corrected_sentences_json),
    vocabulary: toArray<VocabItem>(row.vocabulary_json),
    strengths: toArray<string>(row.strengths_json),
    weaknesses: toArray<string>(row.weaknesses_json),
  }
}

/** Result of a grading attempt — either feedback, or the reason it failed. */
export type GradeOutcome =
  | { ok: true; result: SpeakingResult; trialsUsed?: number | null }
  | { ok: false; detail: string; trialLimit?: boolean }

/** True when the feedback function refused the call because the server-side
 * attempt limit for this task is already used up (HTTP 403, code trial_limit). */
export async function isTrialLimitError(error: unknown): Promise<boolean> {
  const ctx = (error as { context?: Response } | null)?.context
  if (!ctx || typeof ctx !== 'object' || !('status' in ctx)) return false
  if (ctx.status !== 403) return false
  try {
    const body = (await ctx.clone().json()) as { code?: string }
    return body?.code === 'trial_limit'
  } catch {
    return false
  }
}

/** The server's attempts-used count, when the function response includes it. */
export function trialsUsedFrom(data: unknown): number | null {
  const v = (data as { trialsUsed?: unknown } | null)?.trialsUsed
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// The feedback Edge Function is invoked by its SLUG (the URL path), not its
// display name. In this project the function shows as "EnglishX50feedback" in
// the dashboard but its real slug is "smart-action"
// (…/functions/v1/smart-action) — invoking the display name hits a
// non-existent endpoint and fails with "Failed to send a request to the Edge
// Function". Try the real slug first, then known fallbacks.
const FUNCTION_NAMES = ['smart-action', 'EnglishX50feedback', 'speaking-feedback'] as const

/** Invoke the feedback function, falling back across known names. */
export async function invokeFeedback(
  body: Record<string, unknown>,
): Promise<{ data: unknown | null; error: unknown }> {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  let bestError: unknown = null
  for (const name of FUNCTION_NAMES) {
    // Time-boxed: a hung call must surface as an error, not freeze the UI.
    const { data, error } = await withTimeout(
      supabase.functions.invoke(name, { body }),
      120_000,
      { data: null, error: new Error('timeout') },
    )
    if (!error && data) return { data, error: null }
    // Prefer an HTTP error (carries a Response on .context) over a network/
    // fetch error, so the surfaced message is the most informative one.
    if (!bestError || (error as { context?: unknown })?.context) bestError = error
  }
  return { data: null, error: bestError }
}

/**
 * Normalize a feedback response into SpeakingResult, accepting both the flat
 * shape ({ score, feedback, mistakes, ... }) and the nested shape returned by
 * the speaking-feedback function ({ passed, feedback: { score, overall,
 * mistakes: [{ error, correction }], ... } }).
 */
export function normalizeFeedback(raw: unknown): SpeakingResult {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const nested =
    d.feedback && typeof d.feedback === 'object' ? (d.feedback as Record<string, unknown>) : null
  const f = nested ?? d

  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const clampScore = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v ?? 0))))

  const rawMistakes = Array.isArray(f.mistakes)
    ? f.mistakes
    : Array.isArray(d.mistakes)
      ? d.mistakes
      : []
  const mistakes: Mistake[] = rawMistakes.map((m) => {
    const o = (m ?? {}) as Record<string, unknown>
    return {
      original: str(o.original) || str(o.error),
      correction: str(o.correction),
      explanation: str(o.explanation),
    }
  })

  const rawVocab = Array.isArray(f.vocabulary)
    ? f.vocabulary
    : Array.isArray(d.vocabulary)
      ? d.vocabulary
      : []
  const vocabulary: VocabItem[] = rawVocab.map((v) => {
    const o = (v ?? {}) as Record<string, unknown>
    return { word: str(o.word), meaning: str(o.meaning), example: str(o.example) }
  })

  return {
    score: clampScore(f.score ?? d.score),
    passed: typeof d.passed === 'boolean' ? d.passed : typeof f.passed === 'boolean' ? f.passed : false,
    // Flat shape uses a `feedback` string; nested uses `overall`.
    feedback: typeof d.feedback === 'string' ? d.feedback : str(f.overall) || str(d.overall),
    mistakes,
    corrected_sentences: toArray<string>(f.corrected_sentences ?? d.corrected_sentences),
    vocabulary,
    strengths: toArray<string>(f.strengths ?? d.strengths),
    weaknesses: toArray<string>(f.weaknesses ?? d.weaknesses),
  }
}

/**
 * Grades a spoken answer using the feedback Edge Function, maps the result into
 * the app's SpeakingResult shape, and saves the attempt (including the
 * structured feedback as JSON) to x50_submissions.
 */
export async function gradeSpeaking(params: GradeParams): Promise<GradeOutcome> {
  if (!supabase) return { ok: false, detail: 'Supabase not configured' }

  const { data, error } = await invokeFeedback({
    question: params.question,
    transcript: params.transcript,
    // Server-side attempt counter key (account scope comes from the JWT).
    taskKey: serverTaskKey(params.challengeId, params.challengeNumber, params.taskIndex ?? 0),
  })
  if (error || !data) {
    if (await isTrialLimitError(error)) {
      return { ok: false, detail: 'trial limit reached', trialLimit: true }
    }
    const detail = await reportFunctionError('speaking task', error)
    return { ok: false, detail }
  }

  const result = normalizeFeedback(data)
  const trialsUsed = trialsUsedFrom(data)

  // Persist (best-effort; anon insert allowed by RLS).
  supabase
    .from('x50_submissions')
    .insert({
      challenge_id: params.challengeId ?? null,
      challenge_number: params.challengeNumber ?? null,
      user_id: params.userId ?? null,
      student: params.student ?? null,
      question: params.question,
      transcript: params.transcript,
      score: result.score,
      passed: result.passed,
      feedback: result.feedback,
      mistakes_json: JSON.stringify(result.mistakes ?? []),
      vocabulary_json: JSON.stringify(result.vocabulary ?? []),
      strengths_json: JSON.stringify(result.strengths ?? []),
      weaknesses_json: JSON.stringify(result.weaknesses ?? []),
      corrected_sentences_json: JSON.stringify(result.corrected_sentences ?? []),
      audio_key: params.audioKey ?? null,
    })
    .then(
      () => {},
      () => {},
    )

  return { ok: true, result, trialsUsed }
}
