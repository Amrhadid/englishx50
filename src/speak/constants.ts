// Client-side limits for /speak. The server enforces its own copies
// (supabase/functions/speak-turn/validate.ts); these keep the UI honest.

/** Recording auto-stops here. Matches LIMITS.maxRecordingSeconds on the server. */
export const MAX_RECORDING_SECONDS = 60
/** Below this a recording is treated as empty rather than sent for transcription. */
export const MIN_RECORDING_SECONDS = 0.6
/** Longest typed message (characters). */
export const MAX_TEXT_CHARS = 1200
/** Client-side ceiling on one round trip to the Edge Function. */
export const REQUEST_TIMEOUT_MS = 60_000
/** Daily speaking goal shown in the progress card. */
export const DAILY_GOAL_SECONDS = 5 * 60
/** Storage key prefix for the learner's chosen level (scoped per account). */
export const LEVEL_STORAGE_PREFIX = 'x50_speak_level:'
/** Storage key prefix for the "play Emma's voice" preference. */
export const VOICE_STORAGE_PREFIX = 'x50_speak_voice:'
/** The existing auth flow's return-URL slot (see src/hooks/useAuth.ts). */
export const POST_SIGNIN_KEY = 'x50_post_signin'
