-- EnglishX50 — admin-granted outright challenge unlocks.
--
-- Stronger than a cooldown skip (cooldown_skips.sql): a row here opens one
-- challenge for one account regardless of the sequential gates — the student
-- does not have to have finished the previous challenge, and there is no wait.
-- The level test is a separate gate and is not affected.
--
-- Run in Supabase: SQL Editor → paste → Run.

create table if not exists public.x50_challenge_unlocks (
  user_id          uuid not null,
  challenge_number integer not null,
  unlocked_at      timestamptz not null default now(),
  primary key (user_id, challenge_number)
);

grant select, insert, update, delete on public.x50_challenge_unlocks to anon, authenticated;

alter table public.x50_challenge_unlocks enable row level security;

drop policy if exists "x50_cu_select" on public.x50_challenge_unlocks;
drop policy if exists "x50_cu_insert" on public.x50_challenge_unlocks;
drop policy if exists "x50_cu_delete" on public.x50_challenge_unlocks;

create policy "x50_cu_select" on public.x50_challenge_unlocks for select using (true);
create policy "x50_cu_insert" on public.x50_challenge_unlocks for insert with check (true);
create policy "x50_cu_delete" on public.x50_challenge_unlocks for delete using (true);
