export interface ChallengeVideo {
  title: string
  uid: string
}

export interface Challenge {
  id: string
  number: number
  title: string
  video_url: string | null
  pdf_url: string | null
  speaking_task: string | null
  /** Multiple lesson videos (managed in admin). Falls back to video_url. */
  videos?: ChallengeVideo[] | null
  /** Multiple speaking prompts (managed in admin). Falls back to speaking_task. */
  speaking_tasks?: string[] | null
  is_locked: boolean
  access_code?: string | null
  created_at?: string
}

export interface Review {
  id: string
  image_url: string
  created_at?: string
}

export interface Code {
  id: string
  code: string
  created_at?: string
  used_at?: string | null
  /** Identity of whoever redeemed the code (name + phone), if known. */
  used_by?: string | null
}

export interface Student {
  id: string
  user_id: string
  name: string | null
  phone: string | null
  job: string | null
  university: string | null
  code: string | null
  code_redeemed_at: string | null
  created_at?: string
}

export interface Mistake {
  original: string
  correction: string
  explanation: string
}

export interface VocabItem {
  word: string
  meaning: string
  example: string
}

export interface SpeakingResult {
  score: number
  passed: boolean
  feedback: string
  mistakes: Mistake[]
  corrected_sentences: string[]
  vocabulary: VocabItem[]
  strengths: string[]
  weaknesses: string[]
}
