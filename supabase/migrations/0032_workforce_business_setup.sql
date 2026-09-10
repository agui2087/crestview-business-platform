begin;

-- Configuration is per Workforce owner, not acquisition-organization membership.
create table public.workforce_business_settings (
  owner_id uuid primary key references auth.users(id),
  business_name text not null check(length(trim(business_name)) between 1 and 200),
  timezone text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.workforce_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check(length(trim(name)) between 1 and 200),
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  region text not null check(length(trim(region)) between 1 and 200),
  timezone text not null,
  archived boolean not null default false,
  version integer not null default 1,
  unique(owner_id,name)
);
create table public.workforce_departments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check(length(trim(name)) between 1 and 200),
  archived boolean not null default false,
  version integer not null default 1,
  unique(owner_id,name)
);
create table public.workforce_setup_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  version integer not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_business_settings enable row level security;
alter table public.workforce_locations enable row level security;
alter table public.workforce_departments enable row level security;
alter table public.workforce_setup_history enable row level security;
create policy workforce_business_settings_read on public.workforce_business_settings for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_locations_read on public.workforce_locations for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_departments_read on public.workforce_departments for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_setup_history_read on public.workforce_setup_history for select using(workforce_role(owner_id) in ('owner','hr'));
revoke all on public.workforce_business_settings,public.workforce_locations,public.workforce_departments,public.workforce_setup_history from anon,authenticated;
grant select on public.workforce_business_settings,public.workforce_locations,public.workforce_departments,public.workforce_setup_history to authenticated;

create function public.workforce_save_business(p_owner uuid,p_version integer,p_name text,p_timezone text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_version integer; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  -- Serialize first creation as well as subsequent changes.
  perform id from auth.users where id=p_owner for update;
  select version into current_version from workforce_business_settings where owner_id=p_owner;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'Settings changed; refresh first'; end if;
  next_version:=coalesce(current_version,0)+1;
  insert into workforce_business_settings(owner_id,business_name,timezone,version) values(p_owner,trim(p_name),p_timezone,next_version)
  on conflict(owner_id) do update set business_name=excluded.business_name,timezone=excluded.timezone,version=excluded.version,updated_at=now();
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'business',p_owner,next_version);
  return true;
end $$;

create function public.workforce_save_location(p_owner uuid,p_id uuid,p_version integer,p_name text,p_country text,p_region text,p_timezone text,p_archived boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_locations; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  if p_id is null then
    insert into workforce_locations(owner_id,name,country_code,region,timezone,archived) values(p_owner,trim(p_name),upper(trim(p_country)),trim(p_region),p_timezone,p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_locations where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if r.version is distinct from p_version then raise exception 'Location changed; refresh first'; end if;
    update workforce_locations set name=trim(p_name),country_code=upper(trim(p_country)),region=trim(p_region),timezone=p_timezone,archived=p_archived,version=version+1 where id=r.id returning id,version into result,next_version;
  end if;
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'location',result,next_version);
  return result;
end $$;

create function public.workforce_save_department(p_owner uuid,p_id uuid,p_version integer,p_name text,p_archived boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_departments; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_id is null then
    insert into workforce_departments(owner_id,name,archived) values(p_owner,trim(p_name),p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_departments where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if r.version is distinct from p_version then raise exception 'Department changed; refresh first'; end if;
    update workforce_departments set name=trim(p_name),archived=p_archived,version=version+1 where id=r.id returning id,version into result,next_version;
  end if;
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'department',result,next_version);
  return result;
end $$;

revoke all on function public.workforce_save_business(uuid,integer,text,text),public.workforce_save_location(uuid,uuid,integer,text,text,text,text,boolean),public.workforce_save_department(uuid,uuid,integer,text,boolean) from public,anon;
grant execute on function public.workforce_save_business(uuid,integer,text,text),public.workforce_save_location(uuid,uuid,integer,text,text,text,text,boolean),public.workforce_save_department(uuid,uuid,integer,text,boolean) to authenticated;
commit;
