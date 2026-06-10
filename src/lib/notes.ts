// Student vocabulary notes per challenge (stored in x50_notes). A student must
// record at least REQUIRED_NOTES words before the session video / PDF unlock.

import { supabase } from './supabase'

/** Minimum vocabulary entries required to unlock a challenge's lesson. */
export const REQUIRED_NOTES = 10

/** Maximum entries a student can add. */
export const MAX_NOTES = 50

/** Keep only English letters, spaces and basic word punctuation. */
export function sanitizeEnglish(value: string): string {
  return value.replace(/[^A-Za-z\s'-]/g, '')
}

/** Count the non-empty entries. */
export function countNotes(entries: string[]): number {
  return entries.filter((e) => e.trim().length > 0).length
}

/** Load the signed-in user's notes as challenge_id → entries. */
export async function loadUserNotes(userId: string): Promise<Record<string, string[]>> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('x50_notes')
    .select('challenge_id, entries')
    .eq('user_id', userId)
  if (error || !data) return {}
  const map: Record<string, string[]> = {}
  for (const r of data as { challenge_id: string | null; entries: string[] | null }[]) {
    if (r.challenge_id) map[r.challenge_id] = Array.isArray(r.entries) ? r.entries : []
  }
  return map
}

/** Upsert the user's notes for a challenge. Returns true on success. */
export async function saveNotes(params: {
  userId: string
  student: string | null
  challengeId: string
  challengeNumber: number
  entries: string[]
}): Promise<boolean> {
  if (!supabase) return false
  const entries = params.entries.map((e) => e.trim()).filter(Boolean)
  const { error } = await supabase.from('x50_notes').upsert(
    {
      user_id: params.userId,
      student: params.student,
      challenge_id: params.challengeId,
      challenge_number: params.challengeNumber,
      entries,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,challenge_id' },
  )
  return !error
}
