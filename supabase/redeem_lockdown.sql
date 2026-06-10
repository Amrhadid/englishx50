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
