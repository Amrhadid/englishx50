-- ---------------------------------------------------------------------------
-- Admin: reset the speaking-trial counter for one student + task.
--
-- Speaking attempts are enforced server-side in public.x50_trials (see
-- redeem_lockdown.sql §13). A student gets MAX_TRIALS (2) graded attempts per
-- task — the level test ('level_test') and each challenge speaking task
-- ('challenge_<uuid>' / 'challenge_<uuid>#<index>'). Once exhausted there is no
-- way back without this. The Admin → Students panel calls this RPC to clear a
-- single (user, task) counter so the student gets a fresh set of trials.
--
-- Deleting the row resets the count: the next x50_consume_trial re-inserts it
-- starting at 1.
--
-- SECURITY DEFINER so it can write the otherwise write-locked table, but it
-- self-checks the caller's email against the single admin account first — the
-- same gate every other admin write in this project uses.
-- ---------------------------------------------------------------------------
create or replace function public.x50_reset_trial(p_user uuid, p_task text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;

  delete from public.x50_trials
  where user_id = p_user
    and task_id = p_task;
end;
$$;

-- Only signed-in accounts may call it; the body still enforces admin-only.
revoke all on function public.x50_reset_trial(uuid, text) from public, anon;
grant execute on function public.x50_reset_trial(uuid, text) to authenticated;
