-- EnglishX50 — store the R2 object key of each speaking-task recording.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.x50_submissions add column if not exists audio_key text;
