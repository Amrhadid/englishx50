-- EnglishX50 — speaking-task submissions + AI feedback
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.x50_submissions (
  id                      uuid primary key default gen_random_uuid(),
  challenge_id            text,
  challenge_number        integer,
  student                 text,
  question                text,
  transcript              text,
  score                   integer,
  on_topic                boolean,
  complete_sentence_count integer,
  passed                  boolean,        -- true only when 3+ complete on-topic sentences
  feedback                jsonb,          -- full structured feedback from Claude
  created_at              timestamptz not null default now()
);

-- Table grants (avoids "permission denied for table").
grant select, insert on public.x50_submissions to anon, authenticated;

alter table public.x50_submissions enable row level security;

drop policy if exists "x50_submissions_select" on public.x50_submissions;
drop policy if exists "x50_submissions_insert" on public.x50_submissions;

-- Reads are allowed; inserts happen server-side from the Edge Function via the
-- service role (which bypasses RLS), but we allow anon insert too as a fallback.
create policy "x50_submissions_select" on public.x50_submissions for select using (true);
create policy "x50_submissions_insert" on public.x50_submissions for insert with check (true);
