-- EnglishX50 — leads (join-form submissions) + paid marking on redemption.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- ⚠️ Run this AFTER redeem_lockdown.sql. It is self-contained: it creates the
-- x50_leads table and re-declares x50_redeem_code (create or replace) so the
-- redemption RPC also flips the matching lead to paid. Running this one file
-- wires up everything for the Leads admin section.

-- ---------------------------------------------------------------------------
-- 1. x50_leads — one row per "أكمل بياناتك للانضمام" submission. Created by the
--    public join form (anon, no sign-in), so INSERT is open; the rows hold PII
--    (name/phone), so SELECT/UPDATE/DELETE are admin-only via the API.
-- ---------------------------------------------------------------------------
create table if not exists public.x50_leads (
  id                 uuid primary key default gen_random_uuid(),
  name               text,
  phone              text,
  country_code       text,
  job                text,
  nationality        text,
  university         text,          -- 'yes' | 'no'
  youtube_subscribed text,          -- 'yes' | 'no'
  referral           text,          -- how they heard about the challenge
  paid               boolean not null default false,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

-- Speeds up the paid-marking phone match in x50_redeem_code (digits only).
create index if not exists x50_leads_phone_idx
  on public.x50_leads (regexp_replace(coalesce(phone, ''), '\D', '', 'g'));

-- Public form inserts with the anon key; only the admin account reads/manages.
grant insert on public.x50_leads to anon, authenticated;
grant select, update, delete on public.x50_leads to authenticated;

alter table public.x50_leads enable row level security;

drop policy if exists "x50_leads_insert"       on public.x50_leads;
drop policy if exists "x50_leads_admin_select"  on public.x50_leads;
drop policy if exists "x50_leads_admin_update"  on public.x50_leads;
drop policy if exists "x50_leads_admin_delete"  on public.x50_leads;

-- Anyone may submit a lead (the join form runs before sign-in).
create policy "x50_leads_insert" on public.x50_leads
  for insert
  with check (true);

-- Only the admin Google account may read / manage leads.
create policy "x50_leads_admin_select" on public.x50_leads
  for select
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

create policy "x50_leads_admin_update" on public.x50_leads
  for update
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

create policy "x50_leads_admin_delete" on public.x50_leads
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com');

-- ---------------------------------------------------------------------------
-- 2. Redemption RPC — same as redeem_lockdown.sql, but now takes the student's
--    phone and, as a final step, marks the most recent unpaid lead with a
--    matching phone as paid. Matching is on digits only (regexp_replace strips
--    '+', spaces, etc.) so formatting differences don't break it. SECURITY
--    DEFINER bypasses RLS so it can update x50_leads. Best-effort: if no lead
--    matches (student never filled the join form) redemption still succeeds.
--
--    Adds a parameter, so the old 3-arg version is dropped first (the client
--    now always calls the 4-arg signature).
-- ---------------------------------------------------------------------------
drop function if exists public.x50_redeem_code(text, text, text);

create or replace function public.x50_redeem_code(p_code text, p_name text, p_job text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  public.x50_codes%rowtype;
  v_now   timestamptz := now();
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
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
      phone = trim(p_phone),
      code = v_code.code,
      code_redeemed_at = v_now
  where user_id = v_uid;

  if not found then
    insert into public.x50_students (user_id, phone, name, job, code, code_redeemed_at)
    values (v_uid, trim(p_phone), trim(p_name), trim(p_job), v_code.code, v_now);
  end if;

  -- Mark the matching lead as paid (most recent unpaid one with this phone).
  if v_phone is not null then
    update public.x50_leads
    set paid = true, paid_at = v_now
    where id = (
      select id from public.x50_leads
      where not paid
        and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
      order by created_at desc
      limit 1
    );
  end if;

  return jsonb_build_object('ok', true, 'redeemed_at', v_now);
end;
$$;

revoke all on function public.x50_redeem_code(text, text, text, text) from public, anon;
grant execute on function public.x50_redeem_code(text, text, text, text) to authenticated;
