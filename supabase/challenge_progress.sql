-- EnglishX50 — per-account challenge completion (drives the 5-day cooldown to
-- unlock the next challenge). Run in Supabase: SQL Editor → paste → Run.

create table if not exists public.x50_challenge_progress (
  user_id          uuid not null,
  challenge_number integer not null,
  completed_at     timestamptz not null default now(),
  primary key (user_id, challenge_number)
);

grant select, insert, update, delete on public.x50_challenge_progress to anon, authenticated;

alter table public.x50_challenge_progress enable row level security;

drop policy if exists "x50_cp_select" on public.x50_challenge_progress;
drop policy if exists "x50_cp_insert" on public.x50_challenge_progress;
drop policy if exists "x50_cp_update" on public.x50_challenge_progress;

create policy "x50_cp_select" on public.x50_challenge_progress for select using (true);
create policy "x50_cp_insert" on public.x50_challenge_progress for insert with check (true);
create policy "x50_cp_update" on public.x50_challenge_progress for update using (true) with check (true);
