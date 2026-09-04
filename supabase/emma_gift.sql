-- EnglishX50 — the 20-day subscription gift the Emma intro popup promises.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- Not granted on seeing the popup: it only unlocks once the learner has
-- FINISHED 5 Emma conversations, each at least a minute of speaking time.
-- Called from the speak-turn Edge Function (store.ts, service role) right
-- after a conversation transitions to 'completed' — never reachable from the
-- client. Re-counts the qualifying conversations itself rather than trusting
-- the caller, and is guarded by emma_gift_claimed_at, so it can only ever
-- fire once per account no matter how many times it's called.

alter table public.x50_students
  add column if not exists emma_gift_claimed_at timestamptz;

create or replace function public.x50_maybe_grant_emma_gift(
  p_user uuid,
  p_min_seconds numeric default 60,
  p_required integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already timestamptz;
  v_count integer;
begin
  select emma_gift_claimed_at into v_already from public.x50_students where user_id = p_user;
  if v_already is not null then
    return jsonb_build_object('granted', false, 'alreadyClaimed', true);
  end if;

  select count(*) into v_count
  from public.x50_speaking_conversations
  where user_id = p_user
    and status = 'completed'
    and speaking_seconds >= p_min_seconds;

  if v_count < p_required then
    return jsonb_build_object('granted', false, 'alreadyClaimed', false, 'count', v_count);
  end if;

  update public.x50_students
  set emma_gift_claimed_at = now(),
      code_redeemed_at = case
        when code_redeemed_at is not null then code_redeemed_at - interval '20 days'
        else code_redeemed_at
      end
  where user_id = p_user
    and emma_gift_claimed_at is null;

  return jsonb_build_object('granted', true, 'alreadyClaimed', false, 'count', v_count);
end;
$$;

-- Only the service role (the speak-turn Edge Function) may call this —
-- students can never trigger it, let alone pick the count or threshold.
revoke all on function public.x50_maybe_grant_emma_gift(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.x50_maybe_grant_emma_gift(uuid, numeric, integer) to service_role;
