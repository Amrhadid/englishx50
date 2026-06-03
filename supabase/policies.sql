-- EnglishX50 — Supabase access policies
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
--
-- Context: the app uses the public anon key for both the public site and the
-- password-gated /admin page, so these policies allow the anon role to read
-- the site data and manage reviews. (The admin password only gates the UI; it
-- is not a real auth boundary — see the note at the bottom.)

-- ---------------------------------------------------------------------------
-- 1. Reviews storage bucket — must exist and be PUBLIC so uploaded
--    Instagram screenshots are viewable on the site via their public URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('x50-reviews', 'x50-reviews', true)
on conflict (id) do update set public = true;

-- Storage object policies for that bucket (upload / read / delete).
drop policy if exists "x50_reviews_obj_select" on storage.objects;
drop policy if exists "x50_reviews_obj_insert" on storage.objects;
drop policy if exists "x50_reviews_obj_delete" on storage.objects;

create policy "x50_reviews_obj_select"
  on storage.objects for select
  using (bucket_id = 'x50-reviews');

create policy "x50_reviews_obj_insert"
  on storage.objects for insert
  with check (bucket_id = 'x50-reviews');

create policy "x50_reviews_obj_delete"
  on storage.objects for delete
  using (bucket_id = 'x50-reviews');

-- ---------------------------------------------------------------------------
-- 2. x50_reviews table — read on the site, insert/delete from admin.
-- ---------------------------------------------------------------------------
alter table public.x50_reviews enable row level security;

drop policy if exists "x50_reviews_select" on public.x50_reviews;
drop policy if exists "x50_reviews_insert" on public.x50_reviews;
drop policy if exists "x50_reviews_delete" on public.x50_reviews;

create policy "x50_reviews_select" on public.x50_reviews for select using (true);
create policy "x50_reviews_insert" on public.x50_reviews for insert with check (true);
create policy "x50_reviews_delete" on public.x50_reviews for delete using (true);

-- ---------------------------------------------------------------------------
-- 3. x50_challenges table — read on the site (also used for code lookup),
--    full management from admin.
-- ---------------------------------------------------------------------------
alter table public.x50_challenges enable row level security;

drop policy if exists "x50_challenges_select" on public.x50_challenges;
drop policy if exists "x50_challenges_insert" on public.x50_challenges;
drop policy if exists "x50_challenges_update" on public.x50_challenges;
drop policy if exists "x50_challenges_delete" on public.x50_challenges;

create policy "x50_challenges_select" on public.x50_challenges for select using (true);
create policy "x50_challenges_insert" on public.x50_challenges for insert with check (true);
create policy "x50_challenges_update" on public.x50_challenges for update using (true) with check (true);
create policy "x50_challenges_delete" on public.x50_challenges for delete using (true);

-- ---------------------------------------------------------------------------
-- SECURITY NOTE
-- These policies make the anon key able to write reviews/challenges, because
-- the admin page authenticates only in the browser. Anyone who inspects the
-- site's JavaScript could do the same. For a hobby/landing site this is
-- usually acceptable. To lock it down later, move writes behind Supabase Auth
-- (or an Edge Function / service-role backend) and restrict these policies to
-- authenticated users.
--
-- Also note: with public SELECT on x50_challenges, the access_code column is
-- readable by anyone via the API, so codes are not truly secret. If codes must
-- stay private, verify them through a SECURITY DEFINER RPC instead of a
-- client-side select.
