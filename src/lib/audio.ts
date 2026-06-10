// Client helpers for the `audio` Edge Function (Cloudflare R2 storage).

import { supabase } from './supabase'
import { withTimeout } from './async'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Upload a recorded answer to R2; returns the stored object key (or null). */
export async function uploadAudio(blob: Blob): Promise<string | null> {
  if (!supabase || !blob || blob.size === 0) return null
  try {
    const form = new FormData()
    form.append('file', blob, 'answer.webm')
    // Time-boxed: a hung upload must not block grading (the recording is a
    // nice-to-have for the admin, not part of the student's flow).
    const { data, error } = await withTimeout(
      supabase.functions.invoke('audio', { body: form }),
      45_000,
      { data: null, error: new Error('timeout') },
    )
    if (error || !data) return null
    return (data as { key?: string }).key ?? null
  } catch {
    return null
  }
}

/** URL that streams a stored recording (inline playback, or download). */
export function audioUrl(key: string, opts?: { download?: boolean }): string {
  if (!SUPABASE_URL || !ANON_KEY) return ''
  const params = new URLSearchParams({ key, apikey: ANON_KEY })
  if (opts?.download) params.set('download', '1')
  return `${SUPABASE_URL}/functions/v1/audio?${params.toString()}`
}
