-- EnglishX50 — student vocabulary notes per challenge.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Before watching the lesson video, a student must collect at least 10
-- vocabulary words from the source and write them here. The entries unlock the
-- session video / PDF, are reviewable in the admin Students view, and are
-- stored as a JSON array of strings.

create table if not exists public.x50_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  student text,
  challenge_id uuid,
  challenge_number int,
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One notes row per (account, challenge) so saving upserts.
create unique index if not exists x50_notes_user_challenge
  on public.x50_notes (user_id, challenge_id);

alter table public.x50_notes enable row level security;

drop policy if exists x50_notes_select_own on public.x50_notes;
drop policy if exists x50_notes_insert_own on public.x50_notes;
drop policy if exists x50_notes_update_own on public.x50_notes;

-- The owner (and the admin) can read; only the owner can write their own rows.
create policy x50_notes_select_own on public.x50_notes
  for select using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

create policy x50_notes_insert_own on public.x50_notes
  for insert with check (auth.uid() = user_id);

create policy x50_notes_update_own on public.x50_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
