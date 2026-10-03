-- The 2026-09-17 project split rewrote x50_reviews.image_url to the new host
-- but not x50_challenges.file_url, so challenge PDFs uploaded before the split
-- still pointed at the old Locrativ project, whose x50-files bucket is gone.
-- The files themselves were copied; only the stored URLs needed the new host.
-- Applied to ewypdhyeickjdkcubsgd on 2026-10-03 (6 rows).

update public.x50_challenges
set file_url = replace(file_url,
  'https://hiqhbxxlbonlyemxuvad.supabase.co',
  'https://ewypdhyeickjdkcubsgd.supabase.co')
where file_url like 'https://hiqhbxxlbonlyemxuvad.supabase.co/%';
