-- EnglishX50 /speak — store each turn's recorded audio so the admin can
-- listen to it, not just read the transcript.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- Private bucket: only the admin account can generate a listen link (a
-- short-lived signed URL, created client-side from the admin session via
-- supabase.storage.from('x50-speaking-audio').createSignedUrl(...)). The
-- speak-turn Edge Function writes objects via the service role, which
-- already has full privileges on storage.objects/buckets by default (no
-- extra grant needed, unlike new tables in the public schema).

insert into storage.buckets (id, name, public)
values ('x50-speaking-audio', 'x50-speaking-audio', false)
on conflict (id) do update set public = false;

drop policy if exists "x50_speaking_audio_obj_select" on storage.objects;

create policy "x50_speaking_audio_obj_select"
  on storage.objects for select
  using (
    bucket_id = 'x50-speaking-audio'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

-- The object path for a turn's recording, e.g. "<user_id>/<turn timestamp>.webm".
-- Null for turns recorded before this feature, or when the upload failed
-- (a failed audio upload never blocks the turn itself — the transcript and
-- reply still go out).
alter table public.x50_speaking_turns
  add column if not exists audio_path text;
