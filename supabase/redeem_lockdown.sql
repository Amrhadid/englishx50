-- EnglishX50 — launch lockdown for code redemption.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- ⚠️ MUST be run BEFORE deploying the client that calls x50_check_code /
-- x50_redeem_code (the app's redemption flow uses these RPCs).
--
-- What this fixes:
--  1. Codes were readable/writable by anyone holding the public anon key
--     (anyone could list unused codes, "un-use" a used code, or delete them).
--  2. x50_students was client-writable, so premium (code + code_redeemed_at)
--     could be self-granted without a code.
--  3. Redemption was two separate client writes — a failure after marking the
--     code used burned the code without granting premium.
-- Now: redemption happens in ONE server-side transaction (SECURITY DEFINER
-- RPC), codes are admin-only via the API, and students can only read their
-- own row.

-- The single Google account allowed to manage codes/students via the API.
-- Must match ADMIN_EMAIL in src/lib/admin.ts.
-- (Inlined below as 'siramrhadid@gmail.com' — update both places if it changes.)

-- ---------------------------------------------------------------------------
-- 1. x50_students — make sure the table exists (the app's premium gate and the
--    redemption RPC depend on it).
-- ---------------------------------------------------------------------------
create table if not exists public.x50_students (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  name             text,
  phone            text,
  job              text,
  university       text,
  code             text,
  code_redeemed_at timestamptz,
  created_at       timestamptz not null default now()
);

-- One row per account (safe if it already exists).
create unique index if not exists x50_students_user_id_key
  on public.x50_students (user_id);

-- ---------------------------------------------------------------------------
-- 2. Check a code without exposing the codes table.
--    Returns 'valid' | 'used' | 'invalid'.
-- ---------------------------------------------------------------------------
create or replace function public.x50_check_code(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case when c.used_at is null then 'valid' else 'used' end
      from public.x50_codes c
      where upper(c.code) = upper(trim(p_code))
      limit 1
    ),
    'invalid'
  )
$$;

revoke all on function public.x50_check_code(text) from public, anon;
grant execute on function public.x50_check_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Atomic redemption: lock the code row, mark it used, and bind premium to
--    the calling account — all in one transaction. A code can never be
--    redeemed twice (FOR UPDATE serialises concurrent attempts), and it is
--    never burned without the student row being written.
--    Returns jsonb: {ok:true, redeemed_at} | {ok:false, reason:'invalid'|'used'|'auth'}
-- ---------------------------------------------------------------------------
create or replace function public.x50_redeem_code(p_code text, p_name text, p_job text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code public.x50_codes%rowtype;
  v_now  timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  select * into v_code
  from public.x50_codes
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_code.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  update public.x50_codes
  set used_at = v_now,
      used_by = trim(p_name) || ' - ' || trim(p_job)
  where id = v_code.id;

  update public.x50_students
  set name = trim(p_name),
      job  = trim(p_job),
      code = v_code.code,
      code_redeemed_at = v_now
  where user_id = v_uid;

  if not found then
    insert into public.x50_students (user_id, phone, name, job, code, code_redeemed_at)
    values (v_uid, '', trim(p_name), trim(p_job), v_code.code, v_now);
  end if;

  return jsonb_build_object('ok', true, 'redeemed_at', v_now);
end;
$$;

-- NOTE: leads.sql re-declares this function (create or replace) with an extra
-- step that marks the matching x50_leads row as paid. Run leads.sql after this
-- file so redemptions update the Leads admin section.

revoke all on function public.x50_redeem_code(text, text, text) from public, anon;
grant execute on function public.x50_redeem_code(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lock down x50_codes: no anon access at all; via the API only the admin
--    Google account can read/generate/delete codes (the Admin panel signs in
--    with Supabase Auth). Redemption goes through the RPCs above.
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.x50_codes from anon;

alter table public.x50_codes enable row level security;

drop policy if exists "x50_codes_select" on public.x50_codes;
drop policy if exists "x50_codes_insert" on public.x50_codes;
drop policy if exists "x50_codes_update" on public.x50_codes;
drop policy if exists "x50_codes_delete" on public.x50_codes;
drop policy if exists "x50_codes_admin_all" on public.x50_codes;

create policy "x50_codes_admin_all" on public.x50_codes
  for all
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 5. Lock down x50_students: a signed-in user can read ONLY their own row;
--    the admin can read all. No direct client writes — the only way premium
--    fields change is through x50_redeem_code (SECURITY DEFINER bypasses RLS).
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.x50_students from anon;
revoke insert, update, delete on public.x50_students from authenticated;
grant select on public.x50_students to authenticated;

alter table public.x50_students enable row level security;

drop policy if exists "x50_students_select"     on public.x50_students;
drop policy if exists "x50_students_insert"     on public.x50_students;
drop policy if exists "x50_students_update"     on public.x50_students;
drop policy if exists "x50_students_delete"     on public.x50_students;
drop policy if exists "x50_students_select_own" on public.x50_students;

create policy "x50_students_select_own" on public.x50_students
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- 6. Tighten x50_challenge_progress: only the owner can read/write their own
--    completion rows (was fully open — anyone could bypass the 5-day cooldown
--    or fake completions for other accounts). Admin can read all.
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.x50_challenge_progress from anon;

drop policy if exists "x50_cp_select" on public.x50_challenge_progress;
drop policy if exists "x50_cp_insert" on public.x50_challenge_progress;
drop policy if exists "x50_cp_update" on public.x50_challenge_progress;

create policy "x50_cp_select" on public.x50_challenge_progress
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

create policy "x50_cp_insert" on public.x50_challenge_progress
  for insert
  with check (auth.uid() = user_id);

create policy "x50_cp_update" on public.x50_challenge_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. x50_settings — was fully open: anyone with the anon key could REWRITE the
--    AI grading rules (which are injected into the Claude system prompt!).
--    Now admin-only via the API; the grading Edge Function keeps reading them
--    with the service role.
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.x50_settings from anon;

drop policy if exists "x50_settings_select" on public.x50_settings;
drop policy if exists "x50_settings_insert" on public.x50_settings;
drop policy if exists "x50_settings_update" on public.x50_settings;
drop policy if exists "x50_settings_admin_all" on public.x50_settings;

create policy "x50_settings_admin_all" on public.x50_settings
  for all
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 8. x50_submissions — transcripts, scores, and AI feedback of every student
--    were publicly readable. Reads are now admin-only (only the admin panel
--    reads this table); inserts stay open for client-side best-effort logging.
-- ---------------------------------------------------------------------------
drop policy if exists "x50_submissions_select" on public.x50_submissions;

create policy "x50_submissions_select" on public.x50_submissions
  for select
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 9. x50_video_views — student names + viewing activity were publicly
--    readable. Reads are now admin-only; insert/update stay open (guests log
--    intro-video views before signing in).
-- ---------------------------------------------------------------------------
drop policy if exists "x50_video_views_select" on public.x50_video_views;

create policy "x50_video_views_select" on public.x50_video_views
  for select
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 10. x50_challenges — anyone could add/edit/delete the site's challenges
--     (defacement). Public read stays (the landing page needs it); writes are
--     now admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists "x50_challenges_insert" on public.x50_challenges;
drop policy if exists "x50_challenges_update" on public.x50_challenges;
drop policy if exists "x50_challenges_delete" on public.x50_challenges;

create policy "x50_challenges_insert" on public.x50_challenges
  for insert
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

create policy "x50_challenges_update" on public.x50_challenges
  for update
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

create policy "x50_challenges_delete" on public.x50_challenges
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 11. x50_reviews — anyone could insert/delete the review screenshots shown on
--     the landing page. Public read stays; writes are now admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists "x50_reviews_insert" on public.x50_reviews;
drop policy if exists "x50_reviews_delete" on public.x50_reviews;

create policy "x50_reviews_insert" on public.x50_reviews
  for insert
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

create policy "x50_reviews_delete" on public.x50_reviews
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 12. x50-reviews storage bucket — same hole as 11 for the image files
--     themselves. Public read stays (the site shows them via public URLs);
--     upload/delete are now admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists "x50_reviews_obj_insert" on storage.objects;
drop policy if exists "x50_reviews_obj_delete" on storage.objects;

create policy "x50_reviews_obj_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'x50-reviews'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

create policy "x50_reviews_obj_delete"
  on storage.objects for delete
  using (
    bucket_id = 'x50-reviews'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- 13. Server-side speaking-trial enforcement. The 2-attempt limit per speaking
--     task used to live only in localStorage (clearing the browser reset it).
--     The grading Edge Function now consumes a trial here, atomically, before
--     each AI grading call — see supabase/functions/EnglishX50feedback.
--     task_id examples: 'level_test', 'challenge_<uuid>', 'challenge_<uuid>#1'.
-- ---------------------------------------------------------------------------
create table if not exists public.x50_trials (
  user_id    uuid not null,
  task_id    text not null,
  used       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- Clients may only READ their own counts (to display attempts left); all
-- writes happen via x50_consume_trial with the service role.
revoke select, insert, update, delete on public.x50_trials from anon;
revoke insert, update, delete on public.x50_trials from authenticated;
grant select on public.x50_trials to authenticated;

alter table public.x50_trials enable row level security;

drop policy if exists "x50_trials_select_own" on public.x50_trials;

create policy "x50_trials_select_own" on public.x50_trials
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- Atomically use up one attempt. Returns the new used count, or -1 when the
-- limit was already reached (nothing is consumed in that case).
create or replace function public.x50_consume_trial(p_user uuid, p_task text, p_max integer default 2)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.x50_trials as t (user_id, task_id, used)
  values (p_user, p_task, 1)
  on conflict (user_id, task_id) do update
    set used = t.used + 1, updated_at = now()
    where t.used < p_max
  returning t.used into v_used;

  if v_used is null then
    return -1;
  end if;
  return v_used;
end;
$$;

-- Only the service role (Edge Functions) may consume trials.
revoke all on function public.x50_consume_trial(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.x50_consume_trial(uuid, text, integer) to service_role;
