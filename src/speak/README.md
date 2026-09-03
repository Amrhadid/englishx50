# `/speak` — premium AI speaking partner (Emma)

Push-to-talk English conversation practice for paid EnglishX50 accounts.
Everything for the feature lives in this folder plus one Edge Function
(`supabase/functions/speak-turn`) and one SQL file (`supabase/speaking_turns.sql`).
The only touch points with the rest of the site are the route in
`src/main.tsx` and the function entry in `supabase/config.toml`.

## Access

| Visitor                        | Client (`SpeakPage.tsx`)                                | Server (`speak-turn`)                     |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------- |
| auth still resolving           | loading screen                                          | —                                         |
| signed out                     | redirected to `/challenge` (the existing sign-in gate)  | `401 unauthenticated`                     |
| signed in, subscription loading| loading screen                                          | —                                         |
| signed in, free                | `PremiumGate` — no session, no mic, no API call         | `403 not_premium`                         |
| signed in, premium or admin    | `SpeakScreen`                                           | allowed                                   |
| entitlement cannot be verified | —                                                       | `503 entitlement_unavailable` (fail closed)|

The client uses the same two signals as every other gated page
(`useAuth` and `useOnboardingContext().premiumActive`, plus `isAdminEmail`).
The server re-checks on **every** request in `access.ts`: the bearer token is
verified by Supabase Auth (`GET /auth/v1/user`), then the account's own
`x50_students` row must hold a code redeemed less than 100 days ago (or the
email is the admin's). Unlike `_shared/premium.ts`, this check never fails
open — if Supabase or the service role is unavailable the request is denied.

Signed-out redirect: the page writes `/speak` into `sessionStorage`
(`x50_post_signin`, the slot the existing `signInWithGoogle(next)` helper
uses) before navigating to `/challenge`. The homepage does not consume that
slot today, so the learner comes back to `/challenge` after Google sign-in and
opens `/speak` from there; consuming the slot would mean editing the homepage,
which is out of scope for this feature.

## Pipeline (one turn)

```
mic (MediaRecorder, ≤60 s)
  → POST speak-turn {action:"transcribe", audio: base64}      → Whisper (OpenAI)   → transcript
  → POST speak-turn {action:"respond", text, history, …}      → Claude (Anthropic) → reply + feedback (strict tool call, validated)
                                                              → OpenAI TTS         → mp3 (base64) — optional
  ← play audio, show transcript + reply + compact feedback
```

`{action:"start"}` returns the scenario's fixed English opener (and its audio)
without calling the language model.

Providers are behind small interfaces in `providers.ts` (`Transcriber`,
`ConversationModel`, `Synthesizer`). Whisper and Claude are the providers the
repository already uses (`transcribe`, `EnglishX50feedback`); OpenAI TTS is new
but reuses the existing `OPENAI_API_KEY`. `SPEAK_MOCK_MODE=true` swaps in
canned providers for local development; a missing provider in production is a
`503 provider_unavailable`, never a fake answer.

The response contract for a turn:

```ts
type SpeakingTurnResponse = {
  reply: string
  feedback: { positive: string; original?: string; correction?: string; explanationArabic?: string }
}
```

`validate.ts` rejects anything the model returns that does not fit (the
handler retries once, then answers `502 ai_malformed`). Pronunciation is never
mentioned: the model only sees a transcript, so the prompt forbids it.

## Limits

| Limit                          | Value            | Where                          |
| ------------------------------ | ---------------- | ------------------------------ |
| recording length               | 60 s (auto-stop) | client + server clamp          |
| audio payload                  | 6 MB             | server                         |
| transcript / typed text        | 1200 chars       | client + server                |
| history sent to the model      | last 12 messages | server                         |
| requests per user per minute   | 12               | server (in-memory per isolate) |
| turns per user per day         | 150              | server (persisted rows)        |
| provider timeouts              | 25 s / 35 s / 20 s | server (STT / model / TTS)   |
| round trip from the browser    | 60 s             | client                         |

## Data

`supabase/speaking_turns.sql` creates `public.x50_speaking_turns`: one row per
completed learner turn — `user_id, scenario, level, transcript, reply,
feedback (jsonb), speaking_seconds, created_at`. No audio is stored. Rows are
inserted only by the Edge Function (service role); RLS lets a learner `select`
their own rows and the admin all rows; there are no client write policies.
The row count also drives the daily rate limit and the "today" part of the
progress bar (`useDailyProgress.ts`). The conversation itself is kept in
component state — a reload starts a fresh chat.

## Environment

Client (Vite, `.env`):

- `VITE_SPEAK_MOCK=1` — dev only; runs `/speak` against `mockApi.ts` and
  enables `?mock=anon|free|premium|loading|auth-loading` and
  `?fail=start|transcribe|ai|malformed|rate|network|timeout|empty|not_premium`.
  Compiled out of production builds (`import.meta.env.DEV`).

Edge Function secrets (`supabase secrets set …`): see the header of
`supabase/functions/speak-turn/index.ts` and `.env.example`.

## Deploy

```
# once: create the table
#   Supabase → SQL Editor → run supabase/speaking_turns.sql
supabase functions deploy speak-turn --no-verify-jwt
```

## Tests

`npm test` (Vitest). `supabase/functions/speak-turn/__tests__` covers the
entitlement decision table, request/output validation, the handler (access,
each provider failure, malformed output, rate limits, persistence) with fake
`fetch` and providers. `src/speak/__tests__` covers the route gate, the
recorder state machine and cleanup, and the screen's push-to-talk flow,
error states, scenario selection, keyboard input and RTL/LTR rendering.
