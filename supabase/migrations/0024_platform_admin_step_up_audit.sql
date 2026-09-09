create table if not exists public.platform_administrator_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('granted', 'revoked')),
  reason text null,
  occurred_at timestamptz not null default now()
);

create index if not exists platform_administrator_events_target_idx
  on public.platform_administrator_events (target_user_id, occurred_at desc);

create index if not exists platform_administrator_events_actor_idx
  on public.platform_administrator_events (actor_user_id, occurred_at desc);

alter table public.platform_administrator_events enable row level security;
revoke all on public.platform_administrator_events from public, anon, authenticated;

create or replace function public.has_step_up_authentication()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() ->> 'aal') = 'aal2'
    and extract(epoch from now()) - coalesce((auth.jwt() ->> 'iat')::bigint, 0) <= 900,
    false
  );
$$;

revoke all on function public.has_step_up_authentication() from public, anon;
grant execute on function public.has_step_up_authentication() to authenticated;

create or replace function public.grant_platform_administrator(target_user_id uuid, grant_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if not public.has_step_up_authentication() then raise exception 'Recent two-factor verification required'; end if;
  if target_user_id is null then raise exception 'Target user is required'; end if;

  insert into public.platform_administrators (user_id, granted_by, reason, revoked_at)
  values (target_user_id, auth.uid(), nullif(trim(grant_reason), ''), null)
  on conflict (user_id) do update
  set granted_by = auth.uid(), reason = excluded.reason, granted_at = now(), revoked_at = null;

  insert into public.platform_administrator_events (target_user_id, actor_user_id, action, reason)
  values (target_user_id, auth.uid(), 'granted', nullif(trim(grant_reason), ''));
end;
$$;

drop function if exists public.revoke_platform_administrator(uuid);

create or replace function public.revoke_platform_administrator(target_user_id uuid, revoke_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if not public.has_step_up_authentication() then raise exception 'Recent two-factor verification required'; end if;
  if target_user_id is null then raise exception 'Target user is required'; end if;
  if target_user_id = auth.uid() then raise exception 'Administrators cannot revoke their own access'; end if;

  update public.platform_administrators
  set revoked_at = now()
  where user_id = target_user_id and revoked_at is null;

  if not found then raise exception 'Active administrator was not found'; end if;

  insert into public.platform_administrator_events (target_user_id, actor_user_id, action, reason)
  values (target_user_id, auth.uid(), 'revoked', nullif(trim(revoke_reason), ''));
end;
$$;

revoke all on function public.grant_platform_administrator(uuid, text) from public, anon;
revoke all on function public.revoke_platform_administrator(uuid, text) from public, anon;
grant execute on function public.grant_platform_administrator(uuid, text) to authenticated;
grant execute on function public.revoke_platform_administrator(uuid, text) to authenticated;

comment on table public.platform_administrator_events is
  'Append-only audit history for platform administrator grants and revocations.';
