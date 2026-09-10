begin;
create table public.workforce_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  starts_on date not null check(starts_on between date '1900-01-01' and date '2200-12-31'),
  ends_on date check(ends_on between starts_on and date '2200-12-31'),
  timezone text not null,
  -- Monday through Sunday; planned minutes, not time worked or payable hours.
  daily_minutes integer[] not null,
  version integer not null default 1,
  cancelled boolean not null default false,
  reason text not null check(length(trim(reason)) between 1 and 1000),
  updated_at timestamptz not null default now()
);
create table public.workforce_schedule_history (
  id bigint generated always as identity primary key,
  schedule_id uuid not null references public.workforce_schedules(id),
  employee_id uuid not null references public.employees(id),
  actor_id uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_schedules enable row level security;
alter table public.workforce_schedule_history enable row level security;
create policy workforce_schedules_read on public.workforce_schedules for select using(workforce_can_read(employee_id));
create policy workforce_schedule_history_read on public.workforce_schedule_history for select using(workforce_can_read(employee_id));
revoke all on public.workforce_schedules,public.workforce_schedule_history from anon,authenticated;
grant select on public.workforce_schedules,public.workforce_schedule_history to authenticated;

create function public.workforce_save_schedule(p_employee uuid,p_id uuid,p_version integer,p_start date,p_end date,p_timezone text,p_minutes integer[],p_reason text,p_cancelled boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; s workforce_schedules; result workforce_schedules;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee before changing schedules'; end if;
  if p_start is null or p_start not between date '1900-01-01' and date '2200-12-31' or (p_end is not null and (p_end<p_start or p_end>date '2200-12-31')) then raise exception 'Invalid effective dates'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  if p_minutes is null or array_ndims(p_minutes) is distinct from 1 or array_length(p_minutes,1) is distinct from 7 or array_lower(p_minutes,1) is distinct from 1 or exists(select 1 from unnest(p_minutes) m where m is null or m<0 or m>1440) then raise exception 'Specify seven daily minute values from 0 to 1440'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_cancelled is null then raise exception 'Change reason required'; end if;
  if p_id is not null then
    select * into s from workforce_schedules where id=p_id for update;
    if not found or s.employee_id<>e.id or s.owner_id<>e.user_id then raise exception 'Not authorized'; end if;
    if s.version is distinct from p_version then raise exception 'Schedule changed; refresh first'; end if;
  elsif p_version is distinct from 0 then raise exception 'Invalid initial version'; end if;
  if not p_cancelled and exists(select 1 from workforce_schedules where employee_id=e.id and not cancelled and id is distinct from p_id and starts_on<=coalesce(p_end,date '2200-12-31') and coalesce(ends_on,date '2200-12-31')>=p_start) then raise exception 'Schedule overlaps another effective period'; end if;
  if p_id is null then
    insert into workforce_schedules(owner_id,employee_id,starts_on,ends_on,timezone,daily_minutes,reason,cancelled) values(e.user_id,e.id,p_start,p_end,p_timezone,p_minutes,trim(p_reason),p_cancelled) returning * into result;
  else
    update workforce_schedules set starts_on=p_start,ends_on=p_end,timezone=p_timezone,daily_minutes=p_minutes,reason=trim(p_reason),cancelled=p_cancelled,version=version+1,updated_at=now() where id=p_id returning * into result;
  end if;
  insert into workforce_schedule_history(schedule_id,employee_id,actor_id,snapshot) values(result.id,e.id,auth.uid(),to_jsonb(result));
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_schedules',result.id,case when p_id is null then 'INSERT' else 'UPDATE' end,array['starts_on','ends_on','timezone','daily_minutes','cancelled','reason']);
  return result.id;
end $$;
revoke all on function public.workforce_save_schedule(uuid,uuid,integer,date,date,text,integer[],text,boolean) from public,anon;
grant execute on function public.workforce_save_schedule(uuid,uuid,integer,date,date,text,integer[],text,boolean) to authenticated;
commit;
