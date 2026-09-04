-- EnglishX50 — one-time "meet Emma" popup.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- The popup (src/speak/components/EmmaIntroModal.tsx) is shown to a paid
-- learner the first time they land on /speak and never again. Dismissing it
-- calls x50_claim_emma_intro(), which marks it seen — guarded by
-- emma_intro_seen_at being null, so a repeat call is a harmless no-op.
--
-- The 20-day subscription gift the popup mentions is NOT granted here: it
-- only unlocks once the learner finishes 5 Emma conversations of at least a
-- minute each — see emma_gift.sql.

alter table public.x50_students
  add column if not exists emma_intro_seen_at timestamptz;

create or replace function public.x50_claim_emma_intro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  update public.x50_students
  set emma_intro_seen_at = now()
  where user_id = v_uid
    and emma_intro_seen_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.x50_claim_emma_intro() from public, anon;
grant execute on function public.x50_claim_emma_intro() to authenticated;
