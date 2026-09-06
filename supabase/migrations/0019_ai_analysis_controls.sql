create table if not exists public.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  provider_response_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_analysis_usage_user_created_idx
  on public.ai_analysis_usage(user_id, created_at desc);

alter table public.ai_analysis_usage enable row level security;
revoke all on public.ai_analysis_usage from public, anon, authenticated;

create or replace function public.reserve_ai_analysis(
  p_user_id uuid,
  p_opportunity_id uuid,
  p_hourly_limit integer default 5,
  p_daily_limit integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_id uuid;
begin
  if p_user_id is null or p_opportunity_id is null then
    raise exception 'Opportunity access denied';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if not exists (
    select 1 from public.saved_opportunities s
    where s.user_id = p_user_id and s.opportunity_id = p_opportunity_id
  ) then
    raise exception 'Opportunity access denied';
  end if;

  if not exists (
    select 1 from public.billing_entitlements e
    where e.user_id = p_user_id
      and e.product_code = 'crestview_pro'
      and e.active = true
      and (e.expires_at is null or e.expires_at > now())
  ) then
    raise exception 'Pro entitlement required';
  end if;

  if (select count(*) from public.ai_analysis_usage u where u.user_id = p_user_id and u.created_at > now() - interval '1 hour') >= p_hourly_limit
     or (select count(*) from public.ai_analysis_usage u where u.user_id = p_user_id and u.created_at > now() - interval '1 day') >= p_daily_limit then
    raise exception 'AI analysis rate limit reached';
  end if;

  insert into public.ai_analysis_usage(user_id, opportunity_id)
  values (p_user_id, p_opportunity_id)
  returning id into reservation_id;

  return reservation_id;
end;
$$;

revoke all on function public.reserve_ai_analysis(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid, uuid, integer, integer) to service_role;

