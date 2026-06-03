import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True only when both env vars are present and non-empty. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Don't crash the app — Supabase's createClient throws "supabaseUrl is
  // required" on empty values, so we skip client creation entirely and let
  // callers no-op gracefully.
  console.warn(
    '[EnglishX50] Supabase is not configured: VITE_SUPABASE_URL and/or ' +
      'VITE_SUPABASE_ANON_KEY are missing. Supabase calls will be skipped.',
  )
}

/**
 * The Supabase client, or `null` when env vars are missing. Callers must
 * guard against `null` (e.g. `if (!supabase) return`) before using it.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null

export const REVIEWS_BUCKET = 'x50-reviews'
export const WHATSAPP_URL = 'https://wa.me/201097965058'
