-- EnglishX50 — server-side video progress + server-side challenge completion.
--
-- Every piece of a student's lesson state now lives in the database instead
-- of the browser:
--
--   x50_video_progress   one row per (account, video): the resume position,
--                        the furthest point genuinely played, the watched
--                        percent, and when the video counted as watched.
--                        Written by the player every few seconds and on
--                        pause / tab-hide / close, so a student who leaves a
--                        video at any minute continues from that moment on
--                        any device.
--
--   x50_challenge_progress  a challenge is COMPLETE the moment its last lesson
--                        video is watched. A trigger on x50_video_progress
--                        records completed_at (the start of the 5-day
--                        cooldown) server-side, so it cannot be missed if the
--                        client closes early. The next challenge opens as soon
--                        as the cooldown ends.
--
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (Also run video_views_user.sql first if it hasn't been applied — it adds
-- x50_video_views.user_id, used by the backfill below.)

create table if not exists public.x50_video_progress (
  user_id             uuid        not null references auth.users (id) on delete cascade,
  video_id            text        not null,
  challenge_id        uuid,
  challenge_number    integer,
  position_seconds    numeric     not null default 0,
  max_reached_seconds numeric     not null default 0,
  duration_seconds    numeric,
  watched_percent     integer     not null default 0,
  watched_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists x50_video_progress_challenge_idx
  on public.x50_video_progress (user_id, challenge_id);

alter table public.x50_video_progress enable row level security;

drop policy if exists "x50_video_progress_select" on public.x50_video_progress;
create policy "x50_video_progress_select" on public.x50_video_progress
  for select using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

drop policy if exists "x50_video_progress_insert" on public.x50_video_progress;
create policy "x50_video_progress_insert" on public.x50_video_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "x50_video_progress_update" on public.x50_video_progress;
create policy "x50_video_progress_update" on public.x50_video_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.x50_video_progress to authenticated;

-- Progress never goes backwards: the watched percent and furthest-reached
-- point only grow, and a video that counted as watched stays watched. The
-- resume position is the one field that moves freely.
create or replace function public.x50_video_progress_guard()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.watched_percent := least(100, greatest(0, coalesce(new.watched_percent, 0)));
  if tg_op = 'UPDATE' then
    new.watched_percent := greatest(new.watched_percent, old.watched_percent);
    new.max_reached_seconds := greatest(coalesce(new.max_reached_seconds, 0), old.max_reached_seconds);
    new.duration_seconds := coalesce(new.duration_seconds, old.duration_seconds);
    new.challenge_id := coalesce(new.challenge_id, old.challenge_id);
    new.challenge_number := coalesce(new.challenge_number, old.challenge_number);
    new.watched_at := coalesce(old.watched_at, new.watched_at);
    new.created_at := old.created_at;
  end if;
  -- The server, not the client, decides when a video counts as watched.
  if new.watched_at is null and new.watched_percent >= 90 then
    new.watched_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists x50_video_progress_guard on public.x50_video_progress;
create trigger x50_video_progress_guard
  before insert or update on public.x50_video_progress
  for each row execute function public.x50_video_progress_guard();

-- The lesson videos of a challenge (the `videos` JSON array, else the legacy
-- single video_url) — mirrors challengeVideos() in the client.
create or replace function public.x50_challenge_video_uids(videos jsonb, video_url text)
returns text[]
language sql
immutable
as $$
  select case
    when videos is not null
     and jsonb_typeof(videos) = 'array'
     and exists (
       select 1 from jsonb_array_elements(videos) e
       where trim(coalesce(e ->> 'uid', '')) <> ''
     )
    then (
      select array_agg(trim(e ->> 'uid'))
      from jsonb_array_elements(videos) e
      where trim(coalesce(e ->> 'uid', '')) <> ''
    )
    when trim(coalesce(video_url, '')) <> '' then array[trim(video_url)]
    else array[]::text[]
  end
$$;

-- Once a video is watched, mark every challenge whose videos are now all
-- watched as complete. completed_at is when the 5-day cooldown starts.
create or replace function public.x50_record_challenge_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  uids text[];
  missing integer;
begin
  if new.watched_at is null then
    return new;
  end if;
  for c in select id, number, videos, video_url from public.x50_challenges loop
    uids := public.x50_challenge_video_uids(c.videos, c.video_url);
    if uids is null or coalesce(array_length(uids, 1), 0) = 0 then
      continue;
    end if;
    if not (new.video_id = any (uids)) then
      continue;
    end if;
    select count(*) into missing
    from unnest(uids) as u(video_id)
    where not exists (
      select 1 from public.x50_video_progress p
      where p.user_id = new.user_id
        and p.video_id = u.video_id
        and p.watched_at is not null
    );
    if missing = 0 then
      insert into public.x50_challenge_progress (user_id, challenge_number, completed_at)
      values (new.user_id, c.number, now())
      on conflict (user_id, challenge_number) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists x50_record_challenge_completion on public.x50_video_progress;
create trigger x50_record_challenge_completion
  after insert or update of watched_at on public.x50_video_progress
  for each row execute function public.x50_record_challenge_completion();

-- Backfill from the view log so students who already watched parts of a
-- lesson keep that progress (the resume position was never stored
-- server-side before, so it starts at 0 for those). The completion trigger
-- is held off so the historical completion below keeps its real timestamp.
alter table public.x50_video_progress disable trigger x50_record_challenge_completion;

insert into public.x50_video_progress (user_id, video_id, watched_percent, watched_at, created_at, updated_at)
select
  v.user_id,
  v.video_id,
  max(v.watched_percent),
  case when max(v.watched_percent) >= 90 then max(v.updated_at) end,
  min(v.opened_at),
  max(v.updated_at)
from public.x50_video_views v
where v.user_id is not null and v.video_id is not null
group by v.user_id, v.video_id
on conflict (user_id, video_id) do nothing;

-- Completion is now "all videos watched": record it for accounts that already
-- got there, so their cooldown starts from the last watched video.
insert into public.x50_challenge_progress (user_id, challenge_number, completed_at)
select p.user_id, c.number, max(p.watched_at)
from public.x50_challenges c
join public.x50_video_progress p
  on p.video_id = any (public.x50_challenge_video_uids(c.videos, c.video_url))
 and p.watched_at is not null
where coalesce(array_length(public.x50_challenge_video_uids(c.videos, c.video_url), 1), 0) > 0
group by p.user_id, c.id, c.number
having count(distinct p.video_id) = array_length(public.x50_challenge_video_uids(c.videos, c.video_url), 1)
on conflict (user_id, challenge_number) do nothing;

alter table public.x50_video_progress enable trigger x50_record_challenge_completion;
