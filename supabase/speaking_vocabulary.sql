-- EnglishX50 /speak — cache the post-conversation vocabulary review (20
-- words with Arabic meanings: missing / contextual / upgrades) on the
-- conversation row itself, so the PDF's `vocabulary` action only ever calls
-- the model once per conversation, however many times the learner downloads
-- the PDF afterwards.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.

alter table public.x50_speaking_conversations
  add column if not exists vocab_json jsonb;
