-- EnglishX50 — sign-in emails for the admin student roster.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- x50_students has no email column and auth.users is not readable through the
-- API, so the admin search could never match an email. This RPC returns
-- (user_id, email) for every student, to the admin account only.

create or replace function public.x50_admin_student_emails()
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;
  return query
    select s.user_id, u.email::text
    from public.x50_students s
    join auth.users u on u.id = s.user_id;
end;
$$;

revoke all on function public.x50_admin_student_emails() from public, anon;
grant execute on function public.x50_admin_student_emails() to authenticated;
