-- EnglishX50 — durable, cross-device "level test done" record.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- Why this exists
-- ----------------
-- The "level test done" gate (src/pages/Landing.tsx) used to know a student had
-- taken the test only from (a) THIS browser's localStorage, or (b) an x50_trials
-- row written by the grading Edge Function's trial counter. So a student who:
--   * passed before the server-side counter existed (2026-06-10), or
--   * whose counter write fell open (consumeTrial returned null), or
--   * simply moved to a new device / browser / cleared their cache
-- had NO durable, account-scoped record — and was wrongly asked to retake the
-- level test even after passing. x50_submissions already proves they did it, but
-- it had no user_id and its reads were admin-only, so the client gate could not
-- use it. This migration ties submissions to the account, lets a user read their
-- own, and backfills existing data so affected students are unblocked.

-- ---------------------------------------------------------------------------
-- 1. Tie each submission to the account that produced it.
-- ---------------------------------------------------------------------------
alter table public.x50_submissions
  add column if not exists user_id uuid;

create index if not exists x50_submissions_user_id_idx
  on public.x50_submissions (user_id);

-- ---------------------------------------------------------------------------
-- 2. Backfill user_id on historical rows by matching the stored student label
--    (the x50_user value, `name - job`) back to the account in x50_students.
--    Best-effort: rows whose label doesn't match a student stay NULL.
-- ---------------------------------------------------------------------------
update public.x50_submissions s
set user_id = st.user_id
from public.x50_students st
where s.user_id is null
  and s.student is not null
  and btrim(s.student) = btrim(coalesce(st.name, '') || ' - ' || coalesce(st.job, ''));

-- ---------------------------------------------------------------------------
-- 3. Let a signed-in user read their OWN submissions (the gate needs this);
--    the admin keeps full read access. Inserts stay open (the client does a
--    best-effort insert and the Edge Function inserts via the service role).
-- ---------------------------------------------------------------------------
drop policy if exists "x50_submissions_select" on public.x50_submissions;

create policy "x50_submissions_select" on public.x50_submissions
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- 4. Belt-and-suspenders: recover the x50_trials level-test counter for any
--    account that has a level-test submission (challenge_number/id NULL) but no
--    trial row, so the existing gate path (fetchServerTrials) also passes right
--    away — even before the affected student reloads with the new client.
-- ---------------------------------------------------------------------------
insert into public.x50_trials (user_id, task_id, used)
select s.user_id, 'level_test', least(count(*), 2)
from public.x50_submissions s
where s.user_id is not null
  and s.challenge_number is null
  and s.challenge_id is null
group by s.user_id
on conflict (user_id, task_id) do update
  set used = greatest(public.x50_trials.used, excluded.used),
      updated_at = now();
