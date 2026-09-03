-- EnglishX50 — /speak conversation turns (premium AI speaking partner).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- One row per completed learner turn: what they said (transcript), what Emma
-- replied, the compact structured correction, and how long they spoke. No raw
-- audio is stored. Rows are written ONLY by the `speak-turn` Edge Function via
-- the service role; a signed-in learner can read their own rows (the daily
-- progress bar) and the admin can read every row. Nothing here touches any
-- existing table.

create table if not exists public.x50_speaking_turns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  scenario          text not null,
  level             text not null,
  transcript        text not null,
  reply             text not null,
  feedback          jsonb,                      -- { positive, original?, correction?, explanationArabic? }
  speaking_seconds  numeric(6,1) not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists x50_speaking_turns_user_created_idx
  on public.x50_speaking_turns (user_id, created_at desc);

-- policies.sql sets default privileges that grant every role full DML on new
-- tables; narrow this table back down to "signed-in users may read".
revoke all on public.x50_speaking_turns from anon, authenticated;
grant select on public.x50_speaking_turns to authenticated;

alter table public.x50_speaking_turns enable row level security;

drop policy if exists "x50_speaking_turns_select" on public.x50_speaking_turns;

-- A learner reads only their own turns; the admin reads all. There is
-- deliberately no insert/update/delete policy: clients cannot write rows.
create policy "x50_speaking_turns_select" on public.x50_speaking_turns
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );
