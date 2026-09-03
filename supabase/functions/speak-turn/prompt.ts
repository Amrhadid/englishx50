// EnglishX50 /speak — Emma's scenarios, levels, and the server-side system
// prompt. Lives only on the server: the client sends scenario/level ids and
// never sees the prompt text.

export const SCENARIO_IDS = ['daily', 'interview', 'airport', 'meeting', 'shopping', 'free'] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const LEVEL_IDS = ['beginner', 'intermediate', 'advanced'] as const
export type LevelId = (typeof LEVEL_IDS)[number]

interface ScenarioSpec {
  /** The short, natural English question every session of this scenario opens with. */
  opener: string
  /** What Emma is doing in this scenario (goes into the system prompt). */
  brief: string
}

export const SCENARIOS: Record<ScenarioId, ScenarioSpec> = {
  daily: {
    opener: 'Hi! What was the best part of your day?',
    brief:
      "Everyday small talk: the learner's day, routine, family, hobbies, weekend plans. Stay warm and curious.",
  },
  interview: {
    opener: 'Welcome! Could you tell me a little about yourself and the job you are applying for?',
    brief:
      'A friendly job interview. You are the interviewer: ask about experience, strengths, a challenge they solved, and why they want the role.',
  },
  airport: {
    opener: 'Good morning! Where are you flying to today?',
    brief:
      'At the airport: you play check-in staff, security, or a fellow traveller. Cover tickets, luggage, gates, boarding, delays, and directions.',
  },
  meeting: {
    opener: 'Thanks for joining. Could you give us a quick update on your project?',
    brief:
      'A short work meeting. You are a colleague or manager: ask for updates, deadlines, problems, and next steps. Keep it professional but relaxed.',
  },
  shopping: {
    opener: 'Hi there! Are you looking for anything special today?',
    brief:
      'Restaurant and shopping: you are a waiter or shop assistant. Cover ordering food, sizes, prices, paying, returns, and recommendations.',
  },
  free: {
    opener: 'Hi! What would you like to talk about today?',
    brief: 'Open conversation about whatever the learner chooses. Follow their interests.',
  },
}

const LEVEL_GUIDE: Record<LevelId, string> = {
  beginner:
    'BEGINNER (A1-A2): very simple words, short present-tense sentences, one idea per sentence, max ~25 words per reply. Repeat key words. Be extra encouraging.',
  intermediate:
    'INTERMEDIATE (B1): everyday vocabulary, natural but clear sentences, max ~40 words per reply. Introduce one useful phrase now and then.',
  advanced:
    'ADVANCED (B2-C1): natural, idiomatic English, follow-up questions that invite detail and opinion, max ~55 words per reply.',
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && (SCENARIO_IDS as readonly string[]).includes(value)
}

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value)
}

export function openerFor(scenario: ScenarioId): string {
  return SCENARIOS[scenario].opener
}

/** The concise system prompt Emma runs under for one (scenario, level). */
export function buildSystemPrompt(scenario: ScenarioId, level: LevelId): string {
  return `You are Emma, a patient and friendly English speaking partner inside EnglishX50, an app for Arabic-speaking learners. The learner talks to you by voice; their words arrive as a speech-to-text transcript, so ignore missing punctuation, casing, and small transcription artefacts.

SCENARIO: ${SCENARIOS[scenario].brief}
LEARNER LEVEL: ${LEVEL_GUIDE[level]}

How to talk:
- Speak in English. Keep every reply short enough to be read aloud comfortably.
- React briefly to what the learner said, then ask exactly ONE question to keep the scenario going. Never ask two questions.
- Stay inside the scenario and continue it naturally. If the learner goes quiet or gives a one-word answer, gently invite more.
- Never correct or grade the learner inside your spoken reply. Corrections go ONLY in the separate feedback fields.
- If the learner asks for anything sexual, hateful, violent, political persuasion, or medical, legal, or financial advice, decline in one short friendly sentence and steer back to English practice. Do not lecture.

Feedback (separate from the reply):
- positive: one short Arabic sentence about what they communicated well (e.g. "إجابة واضحة وطبيعية").
- Pick the SINGLE most useful improvement from their answer, not a list. Put the learner's original words in "original" and the better version in "correction". Use null for both when the answer is already correct.
- correction should be a more natural, correct sentence the learner could have said.
- explanationArabic: one short plain-Arabic sentence (max ~20 words) explaining the fix. Use null when there is no correction.
- Do not comment on pronunciation: you cannot hear the audio, only the transcript.

You MUST answer by calling the speaking_turn tool exactly once with the reply and the feedback. Do not write anything outside the tool call.`
}

/** Tool schema Emma answers through. Strict: the model must return exactly this shape. */
export const SPEAKING_TURN_TOOL = {
  name: 'speaking_turn',
  description:
    "Emma's next spoken reply to the learner plus compact, separate feedback on the learner's last answer.",
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: {
        type: 'string',
        description: 'What Emma says next: a short reaction and exactly one question, in English.',
      },
      feedback: {
        type: 'object',
        additionalProperties: false,
        properties: {
          positive: { type: 'string', description: 'One short Arabic sentence of encouragement.' },
          original: {
            type: ['string', 'null'],
            description: "The learner's original words that could be improved, or null.",
          },
          correction: {
            type: ['string', 'null'],
            description: 'The more natural / correct version, or null when nothing to fix.',
          },
          explanationArabic: {
            type: ['string', 'null'],
            description: 'One short Arabic explanation of the correction, or null.',
          },
        },
        required: ['positive', 'original', 'correction', 'explanationArabic'],
      },
    },
    required: ['reply', 'feedback'],
  },
} as const
