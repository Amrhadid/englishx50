-- EnglishX50 — admin-editable AI grading/feedback rules
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.x50_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- The admin panel reads/writes with the anon key (same model as the other
-- tables); the grading Edge Function reads with the service role.
grant select, insert, update, delete on public.x50_settings to anon, authenticated;

alter table public.x50_settings enable row level security;

drop policy if exists "x50_settings_select" on public.x50_settings;
drop policy if exists "x50_settings_insert" on public.x50_settings;
drop policy if exists "x50_settings_update" on public.x50_settings;

create policy "x50_settings_select" on public.x50_settings for select using (true);
create policy "x50_settings_insert" on public.x50_settings for insert with check (true);
create policy "x50_settings_update" on public.x50_settings for update using (true) with check (true);

-- Seed empty rows so the admin panel has something to edit.
insert into public.x50_settings (key, value) values
  ('grading_rules', ''),
  ('feedback_rules', '')
on conflict (key) do nothing;
