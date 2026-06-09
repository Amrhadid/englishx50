-- EnglishX50 — allow multiple videos + speaking tasks per challenge.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- videos:         [{ "title": "...", "uid": "<cloudflare stream id>" }, ...]
-- speaking_tasks: ["prompt 1", "prompt 2", ...]
-- The legacy video_url / speaking_task columns stay as a fallback.

alter table public.x50_challenges add column if not exists videos jsonb not null default '[]'::jsonb;
alter table public.x50_challenges add column if not exists speaking_tasks jsonb not null default '[]'::jsonb;
