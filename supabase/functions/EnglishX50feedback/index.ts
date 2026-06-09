// EnglishX50 — speaking-task feedback Edge Function (Deno / Supabase).
//
// Grades a transcribed spoken answer with Claude (tool_use pattern, matching
// the other functions in this project), saves the result to x50_submissions,
// and returns structured feedback.
//
// Deploy (project already has ANTHROPIC_API_KEY set):
//   supabase functions deploy EnglishX50feedback --no-verify-jwt

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MODEL = 'claude-sonnet-4-6'

// CORS must cover the preflight (OPTIONS) AND every real response — otherwise
// the browser blocks the call before any status is read, which surfaces in the
// app as "Failed to send a request to the Edge Function".
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const SYSTEM_PROMPT = `You are an encouraging but precise English-speaking coach for Arabic-speaking learners in the "EnglishX50" 50-day challenge.

You receive a TRANSCRIPT of a student's spoken answer (captured by speech-to-text, so ignore minor transcription artefacts like missing punctuation or casing) and the QUESTION/task they were answering. Grade it by calling the speaking_feedback tool. Apply this rubric:

- complete_sentence_count: count only COMPLETE, grammatical English sentences that are clearly ON-TOPIC for the question (subject + verb, full idea). Fragments, filler, or off-topic lines do not count.
- on_topic: true only if the answer actually addresses the question.
- mistakes: concrete grammar/vocabulary/word-order mistakes, each with the original "error" snippet and a "correction". Empty array if none.
- vocabulary: 3-6 useful higher-level words/phrases they could have used, each with a short Arabic "meaning" and a short English "example".
- strengths: 1-3 short specific positives in Arabic.
- score: integer 0-100 for fluency, accuracy, and relevance. Use the FULL range and differentiate honestly: 0-40 weak/very short/off-topic, 41-60 basic with clear errors, 61-75 decent, 76-89 strong, 90-100 excellent. Do NOT default to a middle score like ~70 for every answer; a mediocre or short answer must score low.
- overall: 1-2 warm, motivating sentences in Arabic.

Be fair and consistent. Never treat an off-topic answer, or one with fewer than 3 complete sentences, as a strong performance.`

const TOOL = {
  name: 'speaking_feedback',
  description: "Return structured feedback for the student's spoken answer.",
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      on_topic: { type: 'boolean' },
      complete_sentence_count: { type: 'integer' },
      score: { type: 'integer' },
      overall: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      mistakes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { error: { type: 'string' }, correction: { type: 'string' } },
          required: ['error', 'correction'],
        },
      },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            word: { type: 'string' },
            meaning: { type: 'string' },
            example: { type: 'string' },
          },
          required: ['word', 'meaning', 'example'],
        },
      },
    },
    required: [
      'on_topic',
      'complete_sentence_count',
      'score',
      'overall',
      'strengths',
      'mistakes',
      'vocabulary',
    ],
  },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Load admin-configured grading/feedback rules from x50_settings (service role
// bypasses RLS). Returns empty strings if unavailable so grading still works.
async function loadRules(): Promise<{ grading: string; feedback: string }> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return { grading: '', feedback: '' }
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/x50_settings?key=in.(grading_rules,feedback_rules)&select=key,value`,
      { headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    )
    if (!resp.ok) return { grading: '', feedback: '' }
    const rows = (await resp.json()) as { key: string; value: string }[]
    const map = new Map(rows.map((r) => [r.key, r.value]))
    return { grading: (map.get('grading_rules') ?? '').trim(), feedback: (map.get('feedback_rules') ?? '').trim() }
  } catch {
    return { grading: '', feedback: '' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

  let payload: {
    question?: string
    transcript?: string
    student?: string
    challengeId?: string
    challengeNumber?: number
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const question = (payload.question ?? '').trim()
  const transcript = (payload.transcript ?? '').trim()
  if (transcript.length < 2) return json({ error: 'Empty transcript' }, 400)

  // --- Admin-configurable rules (set in the admin panel → Grading) ---
  const rules = await loadRules()
  const systemPrompt =
    SYSTEM_PROMPT +
    (rules.grading
      ? `\n\nADMIN GRADING RULES (these take priority — follow strictly):\n${rules.grading}`
      : '') +
    (rules.feedback ? `\n\nADMIN FEEDBACK GUIDELINES:\n${rules.feedback}` : '')

  // --- Grade with Claude ---
  let feedback: {
    on_topic: boolean
    complete_sentence_count: number
    score: number
    overall: string
    strengths: string[]
    mistakes: { error: string; correction: string }[]
    vocabulary: { word: string; meaning: string; example: string }[]
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `QUESTION / TASK:\n${question || '(general speaking practice)'}\n\nSTUDENT TRANSCRIPT:\n${transcript}`,
          },
        ],
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'speaking_feedback' },
      }),
    })

    if (!resp.ok) {
      if (resp.status === 429) return json({ error: 'Rate limit exceeded, try again later.' }, 429)
      const detail = await resp.text()
      return json({ error: `Claude error (${resp.status})`, detail }, 502)
    }

    const data = await resp.json()
    // deno-lint-ignore no-explicit-any
    const block = (data?.content ?? []).find((b: any) => b.type === 'tool_use')
    if (!block?.input) return json({ error: 'No feedback returned' }, 502)
    feedback = block.input
  } catch (e) {
    return json({ error: 'Failed to grade answer', detail: String(e) }, 502)
  }

  // --- Pass only with 3+ complete, on-topic sentences ---
  const passed = Boolean(feedback.on_topic) && Number(feedback.complete_sentence_count) >= 3

  // --- Persist (service role bypasses RLS) ---
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/x50_submissions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          prefer: 'return=minimal',
        },
        body: JSON.stringify({
          challenge_id: payload.challengeId ?? null,
          challenge_number: payload.challengeNumber ?? null,
          student: payload.student ?? null,
          question,
          transcript,
          score: feedback.score,
          on_topic: feedback.on_topic,
          complete_sentence_count: feedback.complete_sentence_count,
          passed,
          feedback,
        }),
      })
    } catch (_) {
      // best-effort; still return feedback
    }
  }

  return json({ passed, feedback })
})
