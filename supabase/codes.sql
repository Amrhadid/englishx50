-- EnglishX50 — subscription codes table
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.x50_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  used_by    text
);

alter table public.x50_codes enable row level security;

-- The app uses the anon key for the password-gated admin and the public code
-- box, so anon needs select/insert/update/delete. (Same security caveat as in
-- policies.sql — tighten with Supabase Auth later if needed.)
drop policy if exists "x50_codes_select" on public.x50_codes;
drop policy if exists "x50_codes_insert" on public.x50_codes;
drop policy if exists "x50_codes_update" on public.x50_codes;
drop policy if exists "x50_codes_delete" on public.x50_codes;

create policy "x50_codes_select" on public.x50_codes for select using (true);
create policy "x50_codes_insert" on public.x50_codes for insert with check (true);
create policy "x50_codes_update" on public.x50_codes for update using (true) with check (true);
create policy "x50_codes_delete" on public.x50_codes for delete using (true);
