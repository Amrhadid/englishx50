-- EnglishX50 — /speak conversations (one per learner per 24 hours).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
-- Requires speaking_turns.sql to have been run first (it creates
-- x50_speaking_turns); running both in one go, in order, is fine.
--
-- A conversation groups the turns of one practice session. It stays `active`
-- until the learner's speaking time reaches `goal_seconds` (5 minutes), then
-- becomes `completed`; a learner who leaves mid-way resumes the active one on
-- return. A new conversation may start only when none is active and the last
-- completed one finished more than 24 hours ago (enforced by the Edge
-- Function). Rows are written only by `speak-turn` via the service role.

create table if not exists public.x50_speaking_conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  scenario          text not null,
  level             text not null,
  status            text not null default 'active' check (status in ('active', 'completed')),
  speaking_seconds  numeric(7,1) not null default 0,
  goal_seconds      integer not null default 300,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  updated_at        timestamptz not null default now()
);

create index if not exists x50_speaking_conversations_user_started_idx
  on public.x50_speaking_conversations (user_id, started_at desc);

revoke all on public.x50_speaking_conversations from anon, authenticated;
grant select on public.x50_speaking_conversations to authenticated;

alter table public.x50_speaking_conversations enable row level security;

drop policy if exists "x50_speaking_conversations_select" on public.x50_speaking_conversations;

create policy "x50_speaking_conversations_select" on public.x50_speaking_conversations
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- Each turn belongs to a conversation.
alter table public.x50_speaking_turns
  add column if not exists conversation_id uuid references public.x50_speaking_conversations (id) on delete cascade;

create index if not exists x50_speaking_turns_conversation_idx
  on public.x50_speaking_turns (conversation_id, created_at);

-- speak-turn writes through the service role, not anon/authenticated — and
-- policies.sql's default-privilege grant only covers anon/authenticated, so
-- new tables (and this ALTER on the pre-existing turns table) need an
-- explicit grant or every request fails with "permission denied for table"
-- (surfaced to the learner as "storage_unavailable").
grant select, insert, update, delete on public.x50_speaking_conversations to service_role;
grant select, insert, update, delete on public.x50_speaking_turns to service_role;
