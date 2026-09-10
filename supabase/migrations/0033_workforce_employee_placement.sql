begin;

-- Keep normalized placement separate from legacy, user-entered department labels.
create table public.workforce_employee_placements (
  employee_id uuid primary key references public.employees(id),
  owner_id uuid not null references auth.users(id),
  location_id uuid references public.workforce_locations(id),
  department_id uuid references public.workforce_departments(id),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.workforce_employee_placements enable row level security;
create policy workforce_placement_read on public.workforce_employee_placements for select using(public.workforce_can_read(employee_id));
revoke all on public.workforce_employee_placements from anon,authenticated;
grant select on public.workforce_employee_placements to authenticated;

create function public.workforce_set_placement(p_employee uuid,p_version integer,p_location uuid,p_department uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; prior_version integer; next_version integer;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee before changing placement'; end if;
  select version into prior_version from workforce_employee_placements where employee_id=p_employee;
  if coalesce(prior_version,0) is distinct from p_version then raise exception 'Placement changed; refresh first'; end if;
  -- Row locks prevent an archive racing a new assignment.
  if p_location is not null then
    perform id from workforce_locations where id=p_location and owner_id=e.user_id and not archived for share;
    if not found then raise exception 'Choose an active location in this workspace'; end if;
  end if;
  if p_department is not null then
    perform id from workforce_departments where id=p_department and owner_id=e.user_id and not archived for share;
    if not found then raise exception 'Choose an active department in this workspace'; end if;
  end if;
  next_version:=coalesce(prior_version,0)+1;
  insert into workforce_employee_placements(employee_id,owner_id,location_id,department_id,version)
    values(p_employee,e.user_id,p_location,p_department,next_version)
    on conflict(employee_id) do update set location_id=excluded.location_id,department_id=excluded.department_id,version=excluded.version,updated_at=now();
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields)
    values(e.user_id,e.id,auth.uid(),'workforce_employee_placements',e.id,'UPDATE',array['location_id','department_id']);
  return true;
end $$;
revoke all on function public.workforce_set_placement(uuid,integer,uuid,uuid) from public,anon;
grant execute on function public.workforce_set_placement(uuid,integer,uuid,uuid) to authenticated;
commit;
