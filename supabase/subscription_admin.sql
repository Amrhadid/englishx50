-- EnglishX50 — admin-adjusted subscription length.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- The client derives the subscription from x50_students.code_redeemed_at
-- (daysLeft = 100 - days since redemption, see useOnboarding) and the admin
-- cannot write that table through the API (redeem_lockdown.sql). This RPC lets
-- the admin account add or remove days for one student by shifting
-- code_redeemed_at — the same trick the Emma gift uses — without opening the
-- table to client writes. A student who never redeemed a code gets a synthetic
-- 'ADMIN' code so premium turns on for them too.
--
-- p_delta_days > 0 extends, < 0 shortens. Returns the new days-left figure.

create or replace function public.x50_adjust_subscription(p_user uuid, p_delta_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer := coalesce(p_delta_days, 0);
  v_redeemed timestamptz;
  v_code text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;
  if v_delta = 0 then
    raise exception 'delta must be non-zero';
  end if;
  if abs(v_delta) > 3650 then
    raise exception 'delta out of range';
  end if;

  select code_redeemed_at, code into v_redeemed, v_code
  from public.x50_students where user_id = p_user;

  if not found then
    raise exception 'student not found';
  end if;

  -- No subscription yet: start one whose remaining days equal the delta.
  if v_redeemed is null then
    if v_delta < 0 then
      raise exception 'student has no subscription to shorten';
    end if;
    v_redeemed := now() - make_interval(days => 100 - v_delta);
  else
    v_redeemed := v_redeemed + make_interval(days => v_delta);
  end if;

  update public.x50_students
  set code_redeemed_at = v_redeemed,
      code = coalesce(code, 'ADMIN')
  where user_id = p_user;

  return 100 - floor(extract(epoch from (now() - v_redeemed)) / 86400)::integer;
end;
$$;

revoke all on function public.x50_adjust_subscription(uuid, integer) from public, anon;
grant execute on function public.x50_adjust_subscription(uuid, integer) to authenticated;
