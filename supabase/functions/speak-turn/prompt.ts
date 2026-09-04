// EnglishX50 /speak — Emma's scenarios, levels, and the server-side system
// prompt. Lives only on the server: the client sends scenario/level ids and
// never sees the prompt text.

// Emma picks one of these at random for every new conversation (the learner
// gets exactly one reroll — see randomScenarioId() in src/speak/scenarios.ts).
// Kept in this fixed order so a client-side reroll excluding "the current id"
// and a server-side default fallback agree on the same 20-item universe.
export const SCENARIO_IDS = [
  'introduce',
  'daily',
  'weekend',
  'family',
  'hobbies',
  'cooking',
  'restaurant',
  'shopping',
  'airport',
  'hotel',
  'directions',
  'doctor',
  'past',
  'future',
  'vacation',
  'interview',
  'work',
  'meeting',
  'customer',
  'opinion',
] as const
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
  introduce: {
    opener: "Hi! I don't think we've met before — could you introduce yourself?",
    brief:
      "Getting to know each other for the first time. Ask about their name, where they're from, what they do, and one interesting thing about them.",
  },
  daily: {
    opener: 'Hi! Can you walk me through what a normal day looks like for you?',
    brief:
      'Their daily routine: when they wake up, morning habits, work or study schedule, evenings. Keep it grounded in ordinary weekday life.',
  },
  weekend: {
    opener: 'Hey! What do you usually do on weekends?',
    brief:
      'Weekend activities and plans: rest, family time, going out, hobbies. Ask what they did last weekend or plan to do this one.',
  },
  family: {
    opener: "I'd love to hear about the people close to you — do you have a big family?",
    brief:
      'Friends and family: siblings, parents, close friends, how they spend time together. Warm and personal, never intrusive.',
  },
  hobbies: {
    opener: 'What do you like to do in your free time?',
    brief:
      'Hobbies and free time: sports, reading, gaming, art, music. Ask what they enjoy, why, and how they got into it.',
  },
  cooking: {
    opener: "Do you enjoy cooking? What's your favorite dish to make?",
    brief:
      'Food and cooking: favorite dishes, cooking at home vs eating out, a recipe they know well.',
  },
  restaurant: {
    opener: 'Welcome! Table for how many today?',
    brief:
      'You are a waiter at a restaurant. Cover ordering food, recommendations, dietary preferences, and paying the bill.',
  },
  shopping: {
    opener: 'Hi there! Are you looking for anything special today?',
    brief:
      'You are a shop assistant in a clothing store. Cover sizes, colors, trying things on, prices, and making a decision.',
  },
  airport: {
    opener: 'Good morning! Where are you flying to today?',
    brief:
      'At the airport: you play check-in staff, security, or a fellow traveller. Cover tickets, luggage, gates, boarding, delays, and directions.',
  },
  hotel: {
    opener: 'Welcome! Do you have a reservation with us?',
    brief:
      'You are a hotel receptionist. Cover checking in, room preferences, breakfast times, and hotel amenities.',
  },
  directions: {
    opener: 'Excuse me — you look like you know the area. Could you help me find something?',
    brief:
      "You are a stranger asking the learner for directions to a nearby place (a pharmacy, a station, a cafe). Have them explain the route, and ask a follow-up if it's unclear.",
  },
  doctor: {
    opener: 'Good morning, what brings you in today?',
    brief:
      'You are a doctor at a routine check-up. Ask about symptoms, how long they have felt this way, and give simple, reassuring advice. This is only roleplay practice — never give real medical diagnoses.',
  },
  past: {
    opener: "What's something interesting that happened to you a few years ago?",
    brief:
      'Talking about the past: a memorable trip, a childhood memory, how something used to be different. Practice past-tense storytelling.',
  },
  future: {
    opener: 'What are your plans for the next few years?',
    brief: 'Future plans: career goals, learning new things, where they would like to be. Practice future tense and ambition.',
  },
  vacation: {
    opener: 'If you could go anywhere in the world, where would your dream vacation be?',
    brief:
      "Dream vacation: destination, what they'd do there, who they'd bring. Encourage vivid, descriptive answers.",
  },
  interview: {
    opener: 'Welcome! Could you tell me a little about yourself and the job you are applying for?',
    brief:
      'A friendly job interview. You are the interviewer: ask about experience, strengths, a challenge they solved, and why they want the role.',
  },
  work: {
    opener: 'What does a typical day at your job look like?',
    brief: 'A day at work: tasks, colleagues, challenges, what they enjoy or find difficult about their job.',
  },
  meeting: {
    opener: 'Thanks for joining. Could you give us a quick update on your project?',
    brief:
      'A short work meeting. You are a colleague or manager: ask for updates, deadlines, problems, and next steps. Keep it professional but relaxed.',
  },
  customer: {
    opener: "Hi, I'm calling because I have a problem with my order — can you help me?",
    brief:
      'You are a customer with a problem (a late delivery, a broken item, a billing error). The learner plays customer support solving it. Present a clear complaint, then react realistically to their proposed solution — ask for detail if it is vague, thank them if it is satisfying.',
  },
  opinion: {
    opener: 'Here is a question for you: do you think social media does more good than harm?',
    brief:
      'Expressing and defending an opinion: pick a mild, everyday debate topic (technology, city life vs countryside, remote work). Ask for their opinion, then respectfully push back once with a counterpoint so they practice defending their view. Never touch politics, religion, or anything sensitive.',
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

/** The system prompt for the one-shot vocabulary review generated after a conversation completes. */
export function buildVocabPrompt(scenario: ScenarioId, level: LevelId): string {
  return `You are Emma's vocabulary coach. You are given the full transcript of one completed English-speaking conversation between yourself (Emma) and an Arabic-speaking learner practising EnglishX50's "${SCENARIOS[scenario].brief}" scenario.

LEARNER LEVEL: ${LEVEL_GUIDE[level]}

From the transcript, produce a curated vocabulary list of exactly 20 English words or short phrases with their Arabic meaning, split into three groups:

1. "missing" — exactly 7 words. Words or phrases the learner clearly needed to express an idea but did not know or use: places where they hesitated, repeated themselves, used a very basic word, or described something in a roundabout way. Infer these from genuine gaps in what they actually said.
2. "contextual" — exactly 7 words. Useful, natural vocabulary for this scenario/topic that the learner never used but would strengthen future conversations on the same topic.
3. "upgrades" — exactly 6 words. A stronger, more natural or more precise synonym for a word the learner actually used verbatim. Put their original word in "from" and the stronger word in "en".

Rules:
- Each "en" entry is a single common word or a short 2-3 word phrase — never rare or academic vocabulary unless the learner's level is advanced.
- Each "ar" is the Arabic meaning in that exact sense: plain MSA, 1-4 words.
- "from" (upgrades only) must be a word or short phrase that genuinely appears in the learner's transcript, not something you invent.
- Never repeat the same word across the three groups.
- Always fill every group to its exact count. If the transcript alone does not give you 7 genuine gaps or 6 genuine upgrades, fill the remainder with the most useful general vocabulary for this scenario and level — but keep the "missing"/"contextual" split meaningful, and never invent a fake "from" word that is not in the transcript.

You MUST answer by calling the vocabulary_suggestions tool exactly once. Do not write anything outside the tool call.

CONVERSATION TRANSCRIPT:`
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

/** Tool schema for the post-conversation vocabulary review. Strict, fixed counts per group. */
export const VOCAB_TOOL = {
  name: 'vocabulary_suggestions',
  description: 'A curated 20-word vocabulary review for one completed learner conversation.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      missing: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        description: 'Words the learner needed but did not use — 7 items.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            en: { type: 'string', description: 'The English word or short phrase.' },
            ar: { type: 'string', description: 'Its Arabic meaning in this sense.' },
          },
          required: ['en', 'ar'],
        },
      },
      contextual: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        description: 'Useful vocabulary for this scenario the learner never used — 7 items.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            en: { type: 'string', description: 'The English word or short phrase.' },
            ar: { type: 'string', description: 'Its Arabic meaning in this sense.' },
          },
          required: ['en', 'ar'],
        },
      },
      upgrades: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        description: 'A stronger word than one the learner actually used — 6 items.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            en: { type: 'string', description: 'The stronger English word or short phrase.' },
            ar: { type: 'string', description: 'Its Arabic meaning in this sense.' },
            from: { type: 'string', description: "The learner's own word this upgrades, verbatim from the transcript." },
          },
          required: ['en', 'ar', 'from'],
        },
      },
    },
    required: ['missing', 'contextual', 'upgrades'],
  },
} as const
