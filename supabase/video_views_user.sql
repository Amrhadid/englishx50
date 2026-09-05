-- EnglishX50 — make challenge completion durable across devices.
--
-- Completion (all videos watched + all speaking tasks submitted) used to be
-- detected only from this browser's localStorage, so a student who finished a
-- challenge on their phone, cleared the cache, or reinstalled the browser saw
-- "أكمل التحدي السابق" / "part 1 first" again on the next device. The client
-- now also reads its own x50_video_views and x50_submissions rows; this script
-- gives x50_video_views the account column and read policy that needs.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

alter table public.x50_video_views add column if not exists user_id uuid;

create index if not exists x50_video_views_user_id_idx
  on public.x50_video_views (user_id, video_id);

-- Best-effort backfill: earlier rows only carried the "name - job" label that
-- the client stored in localStorage (x50_user). Attribute them where that
-- label maps to exactly one account.
update public.x50_video_views v
set user_id = s.user_id
from (
  select trim(name || ' - ' || coalesce(job, '')) as label, min(user_id::text)::uuid as user_id
  from public.x50_students
  where user_id is not null
  group by 1
  having count(*) = 1
) s
where v.user_id is null
  and v.student is not null
  and trim(v.student) = s.label;

-- Students may read their OWN views (the admin keeps full read access).
drop policy if exists "x50_video_views_select" on public.x50_video_views;

create policy "x50_video_views_select" on public.x50_video_views
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );
