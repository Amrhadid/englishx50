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
