-- EnglishX50 — /speak: hard 5:00 cap on Emma speaking tasks.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
-- Requires speaking_conversations.sql to have been run first.
--
-- A conversation's goal is always 300 seconds and its speaking time can never
-- exceed it. speak-turn credits the final turn only with the time remaining;
-- these constraints make the database refuse anything past 5:00 regardless.

-- Clamp anything already over the line.
update public.x50_speaking_conversations
   set goal_seconds = 300
 where goal_seconds <> 300;

update public.x50_speaking_conversations
   set speaking_seconds = goal_seconds,
       status = 'completed',
       completed_at = coalesce(completed_at, updated_at, now())
 where speaking_seconds > goal_seconds;

alter table public.x50_speaking_conversations
  alter column goal_seconds set default 300;

alter table public.x50_speaking_conversations
  drop constraint if exists x50_speaking_conversations_goal_seconds_check;
alter table public.x50_speaking_conversations
  add constraint x50_speaking_conversations_goal_seconds_check
  check (goal_seconds > 0 and goal_seconds <= 300);

alter table public.x50_speaking_conversations
  drop constraint if exists x50_speaking_conversations_speaking_cap_check;
alter table public.x50_speaking_conversations
  add constraint x50_speaking_conversations_speaking_cap_check
  check (speaking_seconds >= 0 and speaking_seconds <= goal_seconds);

-- No single turn can be longer than the whole task.
alter table public.x50_speaking_turns
  drop constraint if exists x50_speaking_turns_speaking_cap_check;
alter table public.x50_speaking_turns
  add constraint x50_speaking_turns_speaking_cap_check
  check (speaking_seconds >= 0 and speaking_seconds <= 300);
