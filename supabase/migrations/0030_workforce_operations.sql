-- Workforce permissions intentionally do not inherit acquisition memberships.
begin;
alter table public.employees add column manager_user_id uuid references auth.users(id);
alter table public.employees add column version integer not null default 1;
alter table public.employees add column archived_at timestamptz;

create table public.workforce_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('hr','manager','employee')),
  employee_id uuid references public.employees(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,user_id),
  check(owner_id <> user_id)
);
create unique index workforce_member_employee on public.workforce_members(owner_id,employee_id) where revoked_at is null and employee_id is not null;

create function public.workforce_role(p_owner uuid) returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when auth.uid() = p_owner then 'owner' else
    (select role from workforce_members where owner_id=p_owner and user_id=auth.uid() and accepted_at is not null and revoked_at is null) end
$$;
create function public.workforce_can_manage(p_employee uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select workforce_role(e.user_id) in ('owner','hr') or
    (workforce_role(e.user_id)='manager' and e.manager_user_id=auth.uid()) from employees e where e.id=p_employee),false)
$$;
create function public.workforce_can_read(p_employee uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select workforce_can_manage(p_employee) or exists(select 1 from workforce_members m where m.employee_id=p_employee and m.user_id=auth.uid() and m.accepted_at is not null and m.revoked_at is null)
$$;

alter table public.workforce_members enable row level security;
create policy workforce_members_read on public.workforce_members for select using (user_id=auth.uid() or workforce_role(owner_id) in ('owner','hr') or (employee_id is not null and workforce_can_manage(employee_id)));
grant select on public.workforce_members to authenticated;

drop policy employees_self on public.employees;
create policy workforce_employee_read on public.employees for select using (workforce_role(user_id) in ('owner','hr') or workforce_can_read(id));
create policy workforce_employee_insert on public.employees for insert with check (workforce_role(user_id) in ('owner','hr'));
create policy workforce_employee_update on public.employees for update using (workforce_role(user_id) in ('owner','hr')) with check (workforce_role(user_id) in ('owner','hr'));
revoke delete on public.employees from authenticated;
-- Free-form internal notes are not exposed through the directory API.
revoke select on public.employees from authenticated;
grant select(id,user_id,full_name,email,phone,position,department,manager_name,start_date,employment_status,preferred_locale,created_at,updated_at,manager_user_id,version,archived_at) on public.employees to authenticated;

drop policy employee_records_self on public.employee_records;
create policy workforce_record_read on public.employee_records for select using (workforce_can_read(employee_id));
create policy workforce_record_insert on public.employee_records for insert with check (workforce_can_manage(employee_id) and exists(select 1 from employees e where e.id=employee_id and e.user_id=employee_records.user_id));
create policy workforce_record_update on public.employee_records for update using (workforce_can_manage(employee_id)) with check (workforce_can_manage(employee_id) and exists(select 1 from employees e where e.id=employee_id and e.user_id=employee_records.user_id));
revoke delete on public.employee_records from authenticated;

create table public.workforce_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  kind text not null check(kind in ('leave','profile')),
  title text not null check(length(title) between 1 and 200),
  starts_on date, ends_on date, leave_type text,
  changes jsonb not null default '{}',
  status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
  approver_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  decision_by uuid references auth.users(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check(kind <> 'leave' or (starts_on is not null and ends_on is not null and ends_on >= starts_on and leave_type is not null))
);
create table public.workforce_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  category text not null check(category in ('onboarding','offboarding','training','renewal','policy')),
  title text not null check(length(title) between 1 and 300),
  assignee_id uuid not null references auth.users(id),
  due_on date not null,
  status text not null default 'open' check(status in ('open','completed')),
  evidence text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.workforce_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  employee_id uuid not null,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  changed_fields text[] not null,
  created_at timestamptz not null default now()
);
create index workforce_requests_queue on public.workforce_requests(owner_id,status,starts_on);
create index workforce_tasks_queue on public.workforce_tasks(owner_id,status,due_on);
create index workforce_history_employee on public.workforce_history(employee_id,created_at desc);
alter table public.workforce_requests enable row level security;
alter table public.workforce_tasks enable row level security;
alter table public.workforce_history enable row level security;
create policy workforce_requests_read on public.workforce_requests for select using(workforce_can_read(employee_id));
create policy workforce_tasks_read on public.workforce_tasks for select using(workforce_can_read(employee_id));
create policy workforce_history_read on public.workforce_history for select using(workforce_can_manage(employee_id));
grant select on public.workforce_requests, public.workforce_tasks, public.workforce_history to authenticated;

create function public.workforce_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare n jsonb:=to_jsonb(new); o jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields)
  values(coalesce((n->>'owner_id')::uuid,(n->>'user_id')::uuid),case when tg_table_name='employees' then new.id else (n->>'employee_id')::uuid end,
    auth.uid(),tg_table_name,new.id,tg_op,array(select key from jsonb_each(n) where value is distinct from o->key));
  return new;
end $$;
create function public.workforce_employee_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id) then raise exception 'Workspace identity cannot change'; end if;
  if new.manager_user_id is not null and new.manager_user_id<>new.user_id and not exists(select 1 from workforce_members where owner_id=new.user_id and user_id=new.manager_user_id and role in ('hr','manager') and accepted_at is not null and revoked_at is null) then raise exception 'Invalid manager'; end if;
  if tg_op='UPDATE' then new.version:=old.version+1; new.updated_at:=now(); end if;
  return new;
end $$;
create trigger workforce_employee_guard before insert or update on public.employees for each row execute function public.workforce_employee_guard();
create trigger workforce_employee_audit after insert or update on public.employees for each row execute function public.workforce_audit();
create trigger workforce_record_audit after insert or update on public.employee_records for each row execute function public.workforce_audit();
create trigger workforce_request_audit after insert or update on public.workforce_requests for each row execute function public.workforce_audit();
create trigger workforce_task_audit after insert or update on public.workforce_tasks for each row execute function public.workforce_audit();

create function public.workforce_invite(p_owner uuid,p_email text,p_role text,p_employee uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; result uuid;
begin
  if auth.uid() is null or auth.uid()<>p_owner or p_role not in ('hr','manager','employee') then raise exception 'Not authorized'; end if;
  select id into target from auth.users where lower(email)=lower(trim(p_email));
  if target is null or target=p_owner then raise exception 'A different registered account is required'; end if;
  if p_employee is not null and not exists(select 1 from employees where id=p_employee and user_id=p_owner and archived_at is null) then raise exception 'Invalid employee'; end if;
  if p_role='employee' and p_employee is null then raise exception 'Employee profile required'; end if;
  insert into workforce_members(owner_id,user_id,role,employee_id) values(p_owner,target,p_role,p_employee)
  on conflict(owner_id,user_id) do update set role=excluded.role,employee_id=excluded.employee_id,accepted_at=null,revoked_at=null
  returning id into result;
  return result;
end $$;
create function public.workforce_membership_decision(p_id uuid,p_accept boolean) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_accept then
    update workforce_members set accepted_at=now() where id=p_id and user_id=auth.uid() and accepted_at is null and revoked_at is null;
  else
    update workforce_members set revoked_at=now() where id=p_id and (user_id=auth.uid() or owner_id=auth.uid()) and revoked_at is null;
  end if;
  if not found then raise exception 'Membership unavailable'; end if;
  return true;
end $$;

create function public.workforce_update_employee(p_id uuid,p_version integer,p_changes jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees;
begin
  select * into e from employees where id=p_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.version<>p_version then raise exception 'Record changed; refresh before saving'; end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('full_name','email','phone','position','department','manager_name','manager_user_id','start_date','employment_status','preferred_locale','archived')) then raise exception 'Unsupported field'; end if;
  if p_changes ? 'full_name' and length(trim(p_changes->>'full_name')) not between 1 and 200 then raise exception 'Invalid name'; end if;
  if p_changes ? 'email' and coalesce(p_changes->>'email','')<>'' and (p_changes->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  if exists(select 1 from jsonb_each_text(p_changes) where length(value)>200) then raise exception 'Field too long'; end if;
  update employees set
    full_name=coalesce(nullif(trim(p_changes->>'full_name'),''),full_name),
    email=case when p_changes?'email' then nullif(p_changes->>'email','') else email end,
    phone=case when p_changes?'phone' then nullif(p_changes->>'phone','') else phone end,
    position=case when p_changes?'position' then nullif(p_changes->>'position','') else position end,
    department=case when p_changes?'department' then nullif(p_changes->>'department','') else department end,
    manager_name=case when p_changes?'manager_name' then nullif(p_changes->>'manager_name','') else manager_name end,
    manager_user_id=case when p_changes?'manager_user_id' then nullif(p_changes->>'manager_user_id','')::uuid else manager_user_id end,
    start_date=case when p_changes?'start_date' then nullif(p_changes->>'start_date','')::date else start_date end,
    employment_status=coalesce(p_changes->>'employment_status',employment_status),
    preferred_locale=coalesce(p_changes->>'preferred_locale',preferred_locale),
    archived_at=case when p_changes?'archived' then case when (p_changes->>'archived')::boolean then now() else null end else archived_at end
  where id=p_id;
  return true;
end $$;

create function public.workforce_submit_request(p_employee uuid,p_kind text,p_title text,p_start date default null,p_end date default null,p_leave_type text default null,p_changes jsonb default '{}') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid; approver uuid;
begin
  select * into e from employees where id=p_employee;
  if not found or not workforce_can_read(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  if p_kind not in ('leave','profile') or length(trim(p_title)) not between 1 and 200 then raise exception 'Invalid request'; end if;
  if p_kind='leave' and (p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 or length(trim(coalesce(p_leave_type,''))) not between 1 and 80) then raise exception 'Invalid leave dates/type'; end if;
  if p_kind='profile' and (p_changes='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('email','phone','preferred_locale'))) then raise exception 'Only contact details and language may be requested'; end if;
  if p_kind='profile' and ((p_changes?'preferred_locale' and coalesce(p_changes->>'preferred_locale','') not in ('en','es')) or exists(select 1 from jsonb_each_text(p_changes) where length(value)>200) or (coalesce(p_changes->>'email','')<>'' and (p_changes->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'Invalid contact details'; end if;
  approver:=case when e.manager_user_id is not null and e.manager_user_id<>auth.uid() and workforce_role(e.user_id) is not null then e.manager_user_id else e.user_id end;
  insert into workforce_requests(owner_id,employee_id,kind,title,starts_on,ends_on,leave_type,changes,approver_id,created_by)
  values(e.user_id,e.id,p_kind,trim(p_title),p_start,p_end,p_leave_type,p_changes,approver,auth.uid()) returning id into result;
  return result;
end $$;
create function public.workforce_decide_request(p_id uuid,p_status text,p_reason text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requests; e employees;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into r from workforce_requests where id=p_id for update;
  if not found or r.status<>'pending' then raise exception 'Request already handled or unavailable'; end if;
  if p_status='withdrawn' then
    if r.created_by<>auth.uid() then raise exception 'Not authorized'; end if;
  elsif p_status in ('approved','rejected') then
    if not workforce_can_manage(r.employee_id) or (r.approver_id<>auth.uid() and coalesce(workforce_role(r.owner_id),'') not in ('owner','hr')) then raise exception 'Not authorized'; end if;
    if r.created_by=auth.uid() then raise exception 'Another authorized reviewer must decide your request'; end if;
    if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Decision reason required'; end if;
  else raise exception 'Invalid decision'; end if;
  if p_status='approved' and r.kind='profile' then
    select * into e from employees where id=r.employee_id for update;
    -- Managers cannot approve changes to employee contact information.
    if coalesce(workforce_role(r.owner_id),'') not in ('owner','hr') then raise exception 'HR review required'; end if;
    perform workforce_update_employee(e.id,e.version,r.changes);
  end if;
  update workforce_requests set status=p_status,decision_by=auth.uid(),decision_reason=p_reason,decided_at=now() where id=p_id;
  return true;
end $$;

create function public.workforce_assign_task(p_employee uuid,p_category text,p_title text,p_assignee uuid,p_due date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid;
begin
  select * into e from employees where id=p_employee;
  if not found or not workforce_can_manage(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  if p_due is null or length(trim(p_title)) not between 1 and 300 then raise exception 'Title and due date required'; end if;
  if p_assignee<>e.user_id and not exists(select 1 from workforce_members m where m.owner_id=e.user_id and m.user_id=p_assignee and m.accepted_at is not null and m.revoked_at is null and (m.role='hr' or (m.role='manager' and e.manager_user_id=p_assignee) or m.employee_id=e.id)) then raise exception 'Assignee cannot access this employee'; end if;
  insert into workforce_tasks(owner_id,employee_id,category,title,assignee_id,due_on) values(e.user_id,e.id,p_category,trim(p_title),p_assignee,p_due) returning id into result;
  return result;
end $$;
create function public.workforce_finish_task(p_id uuid,p_evidence text,p_verify boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare t workforce_tasks;
begin
  select * into t from workforce_tasks where id=p_id for update;
  if not found or not workforce_can_read(t.employee_id) then raise exception 'Not authorized'; end if;
  if p_verify then
    if not workforce_can_manage(t.employee_id) or t.status<>'completed' or t.completed_by=auth.uid() then raise exception 'Independent manager verification required'; end if;
    update workforce_tasks set verified_at=now(),verified_by=auth.uid() where id=p_id;
  else
    if t.status<>'open' or (t.assignee_id<>auth.uid() and not workforce_can_manage(t.employee_id)) then raise exception 'Not authorized or already completed'; end if;
    if length(trim(coalesce(p_evidence,''))) not between 1 and 2000 then raise exception 'Completion evidence required'; end if;
    update workforce_tasks set status='completed',evidence=p_evidence,completed_at=now(),completed_by=auth.uid() where id=p_id;
  end if;
  return true;
end $$;

-- Explicitly limit all callable entry points; triggers are not public APIs.
create table public.workforce_access_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null, user_id uuid not null, actor_id uuid,
  role text not null, action text not null, created_at timestamptz not null default now()
);
alter table public.workforce_access_history enable row level security;
create policy workforce_access_history_read on public.workforce_access_history for select using(workforce_role(owner_id) in ('owner','hr'));
grant select on public.workforce_access_history to authenticated;
create function public.workforce_access_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into workforce_access_history(owner_id,user_id,actor_id,role,action)
  values(new.owner_id,new.user_id,auth.uid(),new.role,case when new.revoked_at is not null then 'revoked' when new.accepted_at is not null then 'accepted' else 'invited' end);
  return new;
end $$;
create trigger workforce_access_audit after insert or update on public.workforce_members for each row execute function public.workforce_access_audit();
revoke all on function public.workforce_access_audit() from public, anon;

create table public.workforce_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  position text not null check(length(trim(position)) between 1 and 200),
  title text not null check(length(trim(title)) between 1 and 300),
  renewal_days integer check(renewal_days between 1 and 3650),
  created_at timestamptz not null default now(),
  unique(owner_id,position,title)
);
alter table public.workforce_requirements enable row level security;
create policy workforce_requirements_read on public.workforce_requirements for select using(workforce_role(owner_id) is not null);
grant select on public.workforce_requirements to authenticated;
alter table public.workforce_tasks add column requirement_id uuid references public.workforce_requirements(id);
create unique index workforce_open_requirement on public.workforce_tasks(employee_id,requirement_id) where status='open' and requirement_id is not null;
create function public.workforce_add_requirement(p_owner uuid,p_position text,p_title text,p_days integer default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  insert into workforce_requirements(owner_id,position,title,renewal_days) values(p_owner,trim(p_position),trim(p_title),p_days) returning id into result;
  return result;
end $$;
create function public.workforce_assign_requirement(p_employee uuid,p_requirement uuid,p_due date,p_assignee uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requirements; e employees; result uuid;
begin
  select * into e from employees where id=p_employee;
  select * into r from workforce_requirements where id=p_requirement;
  if e.id is null or r.id is null or r.owner_id<>e.user_id or lower(r.position)<>lower(coalesce(e.position,'')) then raise exception 'Requirement does not match employee role'; end if;
  result:=workforce_assign_task(e.id,'training',r.title,p_assignee,p_due);
  update workforce_tasks set requirement_id=r.id where id=result;
  return result;
end $$;
create function public.workforce_start_checklist(p_employee uuid,p_category text,p_due date,p_assignee uuid) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare titles text[]; title text;
begin
  if not workforce_can_manage(p_employee) then raise exception 'Not authorized'; end if;
  perform id from employees where id=p_employee for update;
  if p_category='onboarding' then titles:=array['Confirm role and manager','Prepare equipment and approved accounts','Review company handbook and policies','Assign required role training','Schedule first-week check-in'];
  elsif p_category='offboarding' then titles:=array['Confirm handover owner and plan','Collect company equipment','Revoke external system access','Review final-pay steps with payroll provider','Review record retention with HR'];
  else raise exception 'Invalid checklist'; end if;
  if exists(select 1 from workforce_tasks where employee_id=p_employee and category=p_category and status='open') then raise exception 'An open checklist already exists'; end if;
  foreach title in array titles loop perform workforce_assign_task(p_employee,p_category,title,p_assignee,p_due); end loop;
  return cardinality(titles);
end $$;
revoke all on function public.workforce_add_requirement(uuid,text,text,integer),public.workforce_assign_requirement(uuid,uuid,date,uuid),public.workforce_start_checklist(uuid,text,date,uuid) from public, anon;
grant execute on function public.workforce_add_requirement(uuid,text,text,integer),public.workforce_assign_requirement(uuid,uuid,date,uuid),public.workforce_start_checklist(uuid,text,date,uuid) to authenticated;

revoke all on function public.workforce_audit(), public.workforce_employee_guard() from public, anon;
revoke all on function public.workforce_role(uuid),public.workforce_can_manage(uuid),public.workforce_can_read(uuid),public.workforce_invite(uuid,text,text,uuid),public.workforce_membership_decision(uuid,boolean),public.workforce_update_employee(uuid,integer,jsonb),public.workforce_submit_request(uuid,text,text,date,date,text,jsonb),public.workforce_decide_request(uuid,text,text),public.workforce_assign_task(uuid,text,text,uuid,date),public.workforce_finish_task(uuid,text,boolean) from public, anon;
grant execute on function public.workforce_role(uuid),public.workforce_can_manage(uuid),public.workforce_can_read(uuid),public.workforce_invite(uuid,text,text,uuid),public.workforce_membership_decision(uuid,boolean),public.workforce_update_employee(uuid,integer,jsonb),public.workforce_submit_request(uuid,text,text,date,date,text,jsonb),public.workforce_decide_request(uuid,text,text),public.workforce_assign_task(uuid,text,text,uuid,date),public.workforce_finish_task(uuid,text,boolean) to authenticated;
commit;
