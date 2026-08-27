-- EnglishX50 — admin-granted cooldown skips.
--
-- A challenge normally unlocks 5 days after the previous one was completed
-- (see challenge_progress.sql). One row here lets a single account open one
-- specific challenge straight away, without waiting the gap out. It does not
-- skip the "finish the previous challenge first" rule — only the wait.
--
-- Run in Supabase: SQL Editor → paste → Run.

create table if not exists public.x50_cooldown_skips (
  user_id          uuid not null,
  challenge_number integer not null,
  created_at       timestamptz not null default now(),
  primary key (user_id, challenge_number)
);

grant select, insert, delete on public.x50_cooldown_skips to anon, authenticated;
revoke update on public.x50_cooldown_skips from anon, authenticated;

alter table public.x50_cooldown_skips enable row level security;

-- Only the admin account may grant or revoke a skip; a student may read their
-- own. Mirrors the policies on x50_challenge_unlocks. There is deliberately no
-- update policy: a grant is created or deleted, never edited, so the admin
-- panel inserts with ON CONFLICT DO NOTHING.
drop policy if exists "x50_cs_select" on public.x50_cooldown_skips;
drop policy if exists "x50_cs_insert" on public.x50_cooldown_skips;
drop policy if exists "x50_cs_delete" on public.x50_cooldown_skips;

create policy "x50_cs_select" on public.x50_cooldown_skips for select using (
  auth.uid() = user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
);
create policy "x50_cs_insert" on public.x50_cooldown_skips for insert with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
);
create policy "x50_cs_delete" on public.x50_cooldown_skips for delete using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
);
