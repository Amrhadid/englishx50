-- EnglishX50 — admin-granted extra speaking trials.
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Run AFTER redeem_lockdown.sql (which creates x50_trials + x50_consume_trial).
-- Idempotent. Lets the admin grant a student extra attempts on any speaking
-- task (level test included) on top of the default 2 — so the grant only
-- matters once the student has burned their initial attempts.

-- ---------------------------------------------------------------------------
-- 1. Per-(student, task) bonus attempts, on top of the default MAX (2).
-- ---------------------------------------------------------------------------
alter table public.x50_trials
  add column if not exists bonus integer not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Consume one attempt, now allowing default max + any admin-granted bonus.
--    (Same as redeem_lockdown.sql, with "+ coalesce(t.bonus, 0)" in the gate.)
-- ---------------------------------------------------------------------------
create or replace function public.x50_consume_trial(p_user uuid, p_task text, p_max integer default 2)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.x50_trials as t (user_id, task_id, used)
  values (p_user, p_task, 1)
  on conflict (user_id, task_id) do update
    set used = t.used + 1, updated_at = now()
    where t.used < p_max + coalesce(t.bonus, 0)
  returning t.used into v_used;

  if v_used is null then
    return -1;
  end if;
  return v_used;
end;
$$;

revoke all on function public.x50_consume_trial(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.x50_consume_trial(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Admin RPC: set the bonus attempts for a student on a given task. SET
--    semantics — pass 0 to revoke. The bonus is added on top of the default 2,
--    so granting N makes the student's next N attempts (after the first 2)
--    succeed. Admin-only (checks the JWT email); SECURITY DEFINER so it can
--    write x50_trials (clients otherwise can't).
--    Task keys: 'level_test' or 'challenge_<id>' / 'challenge_<id>#<index>'.
-- ---------------------------------------------------------------------------
create or replace function public.x50_grant_trials(p_user uuid, p_task text, p_bonus integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus integer := greatest(coalesce(p_bonus, 0), 0);
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;

  insert into public.x50_trials as t (user_id, task_id, used, bonus)
  values (p_user, p_task, 0, v_bonus)
  on conflict (user_id, task_id) do update
    set bonus = v_bonus, updated_at = now();

  return v_bonus;
end;
$$;

revoke all on function public.x50_grant_trials(uuid, text, integer) from public, anon;
grant execute on function public.x50_grant_trials(uuid, text, integer) to authenticated;
