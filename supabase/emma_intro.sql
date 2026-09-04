-- EnglishX50 — one-time "meet Emma" popup + its 20-day subscription gift.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- The popup (src/speak/components/EmmaIntroModal.tsx) is shown to a paid
-- learner the first time they land on /speak and never again. Dismissing it
-- calls x50_claim_emma_intro(), which — in one atomic update, guarded by
-- emma_intro_seen_at being null — marks it seen AND grants the one-time 20
-- extra days by pushing code_redeemed_at back. Every premium check in the app
-- already reads code_redeemed_at (see useOnboarding.ts / access.ts), so this
-- is the only place that needs to change for the gift to take effect
-- everywhere, and it can never be claimed twice.

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
  v_row public.x50_students%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  update public.x50_students
  set emma_intro_seen_at = now(),
      code_redeemed_at = case
        when code_redeemed_at is not null then code_redeemed_at - interval '20 days'
        else code_redeemed_at
      end
  where user_id = v_uid
    and emma_intro_seen_at is null
  returning * into v_row;

  if found then
    return jsonb_build_object('ok', true, 'alreadyClaimed', false, 'codeRedeemedAt', v_row.code_redeemed_at);
  end if;

  -- Already claimed earlier, or no student row yet: report current state
  -- rather than erroring, so a stray double-call is harmless.
  select * into v_row from public.x50_students where user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_student');
  end if;
  return jsonb_build_object('ok', true, 'alreadyClaimed', true, 'codeRedeemedAt', v_row.code_redeemed_at);
end;
$$;

revoke all on function public.x50_claim_emma_intro() from public, anon;
grant execute on function public.x50_claim_emma_intro() to authenticated;
