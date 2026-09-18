# EnglishX50 ↔ Locrativ split: status handover (2026-09-18)

## Why

Locrativ and EnglishX50 shared one Supabase project (`hiqhbxxlbonlyemxuvad`,
named "Locrativ"). Every Google sign-in on englishx50.com created a Locrativ
`profiles` row with no username, which made ~170 EnglishX50 accounts look like
Locrativ users stuck at the onboarding username step. The username step itself
was never broken. EnglishX50 now has its own project.

## Projects

| | Old (shared) | New (EnglishX50 only) |
|---|---|---|
| Name | Locrativ | englishx50 |
| Ref | `hiqhbxxlbonlyemxuvad` | `ewypdhyeickjdkcubsgd` |
| URL | https://hiqhbxxlbonlyemxuvad.supabase.co | https://ewypdhyeickjdkcubsgd.supabase.co |
| Region | eu-west-1 | eu-west-1 |

## Completed (all verified)

- Schema: `supabase/migrations/20260917000001_x50_schema.sql` applied to the
  new project. 16 tables, 10 functions, 2 triggers, 48 row policies, 7 storage
  policies, 3 buckets. Counts match the old project exactly.
- Auth: 73 users + 77 identities copied with **original ids and password
  hashes** (via `dblink`), so no `user_id` remap was needed. Google sign-in
  re-attaches to the existing identity rows. Admin account included.
- Data: all 16 `x50_*` tables copied row for row (4,218 rows).
  `x50_reviews.image_url` rewritten to the new host.
- Storage: 298 objects across `x50-files` (6), `x50-reviews` (112),
  `x50-speaking-audio` (180). Byte totals match the source.
- Edge functions redeployed on the new project: `EnglishX50feedback`,
  `transcribe`, `realtime-transcribe`, `audio`, `speak-turn`. The shared
  `_shared/premium.ts` is bundled into each as `premium.ts`. All keep
  `verify_jwt = false` as before (they do their own auth).
- Google OAuth provider and redirect URLs configured on the new project (done
  by the owner).
- Repo: `supabase/config.toml` points at the new ref. Migration notes in
  `supabase/migrations/20260917000002_migration_notes.md`.
- A temporary edge function `migrate-storage` exists on the new project. It
  did the file copy and is guarded by the service role key.

Nothing on the old project was modified or deleted. It is the rollback.

## Remaining

1. **Edge function secrets** on the new project (Edge Functions → Secrets),
   copy values from the old project:
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_R2_ENDPOINT`,
   `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
   `CLOUDFLARE_R2_SECRET_ACCESS_KEY`.
2. **Switch hosting** (Cloudflare Pages, englishx50.com) and redeploy:
   ```
   VITE_SUPABASE_URL=https://ewypdhyeickjdkcubsgd.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key of ewypdhyeickjdkcubsgd, Project Settings → API>
   ```
3. **Test**: sign in as admin, check students/leads/reviews/codes load; sign
   in as (or ask) one redeemed student to confirm days-left and progress.
4. **Final delta copy** right after the switch: re-run the same `dblink`
   copy for rows created/updated in the old project after 2026-09-17 22:30 UTC
   (video progress, speaking turns, submissions, notes, trials, students,
   leads, codes). Use `on conflict do update` keyed on each table's primary key.
   Storage delta: call `migrate-storage` once more; it only copies files that
   are missing on the new side.
5. **After ~2 weeks stable**: rotate the Locrativ service role key and
   database password (both were shared during this migration); delete the
   `migrate-storage` function; drop the `x50_*` tables, functions and buckets
   from the Locrativ project; remove `x50_codes` references from Locrativ's
   `20260902000001` and `20260916000001` migrations.
6. **Locrativ admin panel** (separate, optional): its Students/Analytics tabs
   still count every `profiles` row. Once the old `x50` users stop signing in
   there, the "no username" count will reflect real Locrativ drop-off only
   (currently ~5 of 45 Apple users, 1 of 13 native Google users).

## How the copy was done (for the delta)

From the new project's SQL editor, with `dblink` (already enabled):

```sql
select extensions.dblink_connect('src',
  'host=db.hiqhbxxlbonlyemxuvad.supabase.co port=5432 dbname=postgres user=postgres password=<locrativ db password> sslmode=require');
-- then: insert into public.<table> select * from extensions.dblink('src', 'select ... from <table> where updated_at > ...') as t(...)
--       on conflict (...) do update set ...;
select extensions.dblink_disconnect('src');
```

`pg_net` is also enabled on the new project; the storage function is invoked
with `net.http_post('https://ewypdhyeickjdkcubsgd.supabase.co/functions/v1/migrate-storage', body := {token: <new service role key>, srcKey: <old service role key>, limit: 200})`.
