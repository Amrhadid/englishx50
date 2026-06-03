// EnglishX50 — speaking-task feedback Edge Function (Deno / Supabase).
//
// Receives a transcribed spoken answer, grades it with Claude against a rubric,
// saves the result to public.x50_submissions, and returns structured feedback.
//
// Deploy:
//   supabase functions deploy speaking-feedback --no-verify-jwt
// Secrets (set once):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MODEL = 'claude-opus-4-8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Stable grading rubric — cached as a prompt prefix.
const SYSTEM_PROMPT = `You are an encouraging but precise English-speaking coach for Arabic-speaking learners in the "EnglishX50" 50-day challenge.

You receive a TRANSCRIPT of a student's spoken answer (captured by speech-to-text, so ignore minor transcription artefacts like missing punctuation or casing) and the QUESTION/task they were answering.

Grade the answer and return structured feedback. Apply this rubric:

- complete_sentence_count: count only COMPLETE, grammatical English sentences that are clearly ON-TOPIC for the question (have a subject + verb and express a full idea). Fragments, filler, or off-topic lines do not count.
- on_topic: true only if the answer actually addresses the question.
- mistakes: list concrete grammar/vocabulary/word-order mistakes, each with the original "error" snippet and a corrected "correction". If there are no real mistakes, return an empty array.
- vocabulary: suggest 3-6 useful higher-level words or phrases the student could have used, each with a short Arabic "meaning" and a short English "example" sentence.
- strengths: 1-3 short, specific positives (in Arabic) about what the student did well.
- score: integer 0-100 reflecting fluency, accuracy, and relevance.
- overall: 1-2 sentence summary in Arabic, warm and motivating.

Be fair and consistent. Do not award a passing performance to an answer that is off-topic or has fewer than 3 complete sentences.`

const SCHEMA = {
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
        properties: {
          error: { type: 'string' },
          correction: { type: 'string' },
        },
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
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

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

  // --- Ask Claude to grade the answer (structured output) ---
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
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
          {
            role: 'user',
            content: `QUESTION / TASK:\n${question || '(general speaking practice)'}\n\nSTUDENT TRANSCRIPT:\n${transcript}`,
          },
        ],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      return json({ error: `Claude API error (${aiRes.status})`, detail }, 502)
    }

    const data = await aiRes.json()
    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return json({ error: 'No feedback returned' }, 502)
    feedback = JSON.parse(textBlock.text)
  } catch (e) {
    return json({ error: 'Failed to grade answer', detail: String(e) }, 502)
  }

  // --- Decide pass/fail: 3+ complete, on-topic sentences ---
  const passed = Boolean(feedback.on_topic) && Number(feedback.complete_sentence_count) >= 3

  // --- Persist to Supabase (service role bypasses RLS) ---
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
      // Saving is best-effort; still return feedback to the student.
    }
  }

  return json({ passed, feedback })
})
