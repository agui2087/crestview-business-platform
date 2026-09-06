create table if not exists public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid null references auth.users(id) on delete set null,
  reason text null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.platform_administrators enable row level security;
revoke all on public.platform_administrators from public, anon, authenticated;

insert into public.platform_administrators (user_id, reason)
select id, 'Migrated from the original Crestview owner allowlist'
from auth.users
where lower(email) = 'agui2087@outlook.com'
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_administrators administrator
    where administrator.user_id = auth.uid()
      and administrator.revoked_at is null
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.grant_platform_administrator(target_user_id uuid, grant_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  insert into public.platform_administrators (user_id, granted_by, reason, revoked_at)
  values (target_user_id, auth.uid(), nullif(trim(grant_reason), ''), null)
  on conflict (user_id) do update
  set granted_by = auth.uid(), reason = excluded.reason, granted_at = now(), revoked_at = null;
end;
$$;

create or replace function public.revoke_platform_administrator(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if target_user_id = auth.uid() then raise exception 'Administrators cannot revoke their own access'; end if;
  update public.platform_administrators set revoked_at = now()
  where user_id = target_user_id and revoked_at is null;
end;
$$;

revoke all on function public.grant_platform_administrator(uuid, text) from public, anon;
revoke all on function public.revoke_platform_administrator(uuid) from public, anon;
grant execute on function public.grant_platform_administrator(uuid, text) to authenticated;
grant execute on function public.revoke_platform_administrator(uuid) to authenticated;
