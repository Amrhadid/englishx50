-- EnglishX50 — student activity: video engagement
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.x50_video_views (
  id               uuid primary key default gen_random_uuid(),
  student          text,                 -- "name - phone" from the join form, or null for guests
  video_id         text,
  opened_at        timestamptz not null default now(),
  watched_percent  integer not null default 0,
  updated_at       timestamptz not null default now()
);

grant select, insert, update on public.x50_video_views to anon, authenticated;

alter table public.x50_video_views enable row level security;

drop policy if exists "x50_video_views_select" on public.x50_video_views;
drop policy if exists "x50_video_views_insert" on public.x50_video_views;
drop policy if exists "x50_video_views_update" on public.x50_video_views;

create policy "x50_video_views_select" on public.x50_video_views for select using (true);
create policy "x50_video_views_insert" on public.x50_video_views for insert with check (true);
create policy "x50_video_views_update" on public.x50_video_views for update using (true) with check (true);
