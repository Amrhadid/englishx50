import { supabase } from './supabase'
import { reportFunctionError } from './functionError'
import type { SpeakingResult, Mistake, VocabItem } from '../types'

interface GradeParams {
  question: string
  transcript: string
  student?: string
  challengeId?: string
  challengeNumber?: number
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
  | { ok: true; result: SpeakingResult }
  | { ok: false; detail: string }

/**
 * Grades a spoken answer using the `EnglishX50feedback` Edge Function, maps the
 * result into the app's SpeakingResult shape, and saves the attempt (including
 * the structured feedback as JSON) to x50_submissions.
 */
export async function gradeSpeaking(params: GradeParams): Promise<GradeOutcome> {
  if (!supabase) return { ok: false, detail: 'Supabase not configured' }

  const { data, error } = await supabase.functions.invoke('EnglishX50feedback', {
    body: { question: params.question, transcript: params.transcript },
  })
  if (error || !data) {
    const detail = await reportFunctionError('speaking task', error)
    return { ok: false, detail }
  }

  const g = data as {
    score?: number
    passed?: boolean
    feedback?: string
    mistakes?: Mistake[]
    corrected_sentences?: string[]
    vocabulary?: VocabItem[]
    strengths?: string[]
    weaknesses?: string[]
  }

  const result: SpeakingResult = {
    score: Math.max(0, Math.min(100, Math.round(g.score ?? 0))),
    passed: g.passed ?? false,
    feedback: g.feedback ?? '',
    mistakes: g.mistakes ?? [],
    corrected_sentences: g.corrected_sentences ?? [],
    vocabulary: g.vocabulary ?? [],
    strengths: g.strengths ?? [],
    weaknesses: g.weaknesses ?? [],
  }

  // Persist (best-effort; anon insert allowed by RLS).
  supabase
    .from('x50_submissions')
    .insert({
      challenge_id: params.challengeId ?? null,
      challenge_number: params.challengeNumber ?? null,
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
    })
    .then(
      () => {},
      () => {},
    )

  return { ok: true, result }
}
