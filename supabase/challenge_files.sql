-- EnglishX50 — challenge PDF file uploaded from the admin panel.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- file_url: public URL of the PDF in the x50-files storage bucket, shown
-- behind the "ملف التحدي" button on each challenge card.

alter table public.x50_challenges add column if not exists file_url text;

-- Public bucket so students can open the PDF via its public URL.
insert into storage.buckets (id, name, public)
values ('x50-files', 'x50-files', true)
on conflict (id) do nothing;

drop policy if exists "x50_files_obj_select" on storage.objects;
drop policy if exists "x50_files_obj_insert" on storage.objects;
drop policy if exists "x50_files_obj_delete" on storage.objects;

create policy "x50_files_obj_select"
  on storage.objects for select
  using (bucket_id = 'x50-files');

-- Upload/delete are admin-only, same as the reviews bucket lockdown.
create policy "x50_files_obj_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'x50-files'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );

create policy "x50_files_obj_delete"
  on storage.objects for delete
  using (
    bucket_id = 'x50-files'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'siramrhadid@gmail.com'
  );
