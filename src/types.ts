export interface Challenge {
  id: string
  number: number
  title: string
  video_url: string | null
  pdf_url: string | null
  speaking_task: string | null
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

export interface SpeakingFeedback {
  on_topic: boolean
  complete_sentence_count: number
  score: number
  overall: string
  strengths: string[]
  mistakes: { error: string; correction: string }[]
  vocabulary: { word: string; meaning: string; example: string }[]
}

export interface SpeakingResult {
  passed: boolean
  feedback: SpeakingFeedback
}
