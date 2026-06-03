import { supabase } from './supabase'
import type { SpeakingResult } from '../types'

/** Rough sentence count from a (often unpunctuated) speech transcript. */
function countSentences(text: string): number {
  const byPunct = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byPunct.length >= 2) return byPunct.length
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(byPunct.length, Math.round(words / 7))
}

interface GradeParams {
  question: string
  transcript: string
  student?: string
  challengeId?: string
  challengeNumber?: number
}

/**
 * Grades a spoken answer using the shared project's existing `grade-explanation`
 * Edge Function, maps the result into the app's feedback shape, and saves the
 * attempt to x50_submissions. The 3-complete-sentence pass rule is enforced
 * client-side (grade-explanation does not count sentences).
 */
export async function gradeSpeaking(params: GradeParams): Promise<SpeakingResult | null> {
  if (!supabase) return null

  const { data, error } = await supabase.functions.invoke('grade-explanation', {
    body: { originalText: params.question, transcript: params.transcript },
  })
  if (error || !data) return null

  const g = data as { score?: number; result?: string; feedback?: string; key_idea?: string }
  const score = Math.max(0, Math.min(100, Math.round(g.score ?? 0)))
  const sentences = countSentences(params.transcript)
  const on_topic = g.result !== 'incorrect'
  const passed = on_topic && sentences >= 3

  const overall = [g.feedback, g.key_idea ? `النقطة الأساسية: ${g.key_idea}` : '']
    .filter(Boolean)
    .join(' — ')

  const feedback = {
    on_topic,
    complete_sentence_count: sentences,
    score,
    overall,
    strengths: on_topic && g.feedback ? [g.feedback] : [],
    mistakes: [] as { error: string; correction: string }[],
    vocabulary: [] as { word: string; meaning: string; example: string }[],
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
      score,
      on_topic,
      complete_sentence_count: sentences,
      passed,
      feedback,
    })
    .then(
      () => {},
      () => {},
    )

  return { passed, feedback }
}
