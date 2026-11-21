-- EnglishX50 — time-limited, single-use-per-account promo codes (e.g. youtube44).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- A promo code can only be activated by a signed-in user. The first activation
-- stamps activated_at; the discount is valid for 6 hours from then and the
-- (user, code) pair can never be activated again — re-applying returns the
-- original activation, so after expiry it stays expired for that account.

create table if not exists public.x50_promo_activations (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, code)
);

alter table public.x50_promo_activations enable row level security;

-- Students may read their own activations (to restore the countdown on reload);
-- all writes go through x50_activate_promo below.
drop policy if exists "x50_promo_activations_select_own" on public.x50_promo_activations;
create policy "x50_promo_activations_select_own" on public.x50_promo_activations
  for select to authenticated using (user_id = auth.uid());

grant select on public.x50_promo_activations to authenticated;

create or replace function public.x50_activate_promo(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := lower(trim(coalesce(p_code, '')));
  v_duration interval;
  v_row public.x50_promo_activations;
begin
  if v_user is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  v_duration := case v_code
    when 'youtube44' then interval '6 hours'
    else null
  end;
  if v_duration is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.x50_promo_activations (user_id, code, activated_at, expires_at)
  values (v_user, v_code, now(), now() + v_duration)
  on conflict (user_id, code) do nothing;

  select * into v_row from public.x50_promo_activations
  where user_id = v_user and code = v_code;

  return jsonb_build_object(
    'status', case when v_row.expires_at > now() then 'active' else 'expired' end,
    'code', v_row.code,
    'activatedAt', v_row.activated_at,
    'expiresAt', v_row.expires_at
  );
end;
$$;

revoke all on function public.x50_activate_promo(text) from public, anon;
grant execute on function public.x50_activate_promo(text) to authenticated;
