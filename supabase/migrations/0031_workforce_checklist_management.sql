begin;

create table public.workforce_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check(length(trim(title)) between 1 and 200),
  category text not null check(category in ('onboarding','offboarding','training','renewal','policy')),
  items text[] not null check(cardinality(items) between 1 and 30),
  version integer not null default 1,
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.workforce_templates enable row level security;
create policy workforce_templates_read on public.workforce_templates for select using(workforce_role(owner_id) in ('owner','hr','manager'));
grant select on public.workforce_templates to authenticated;

create table public.workforce_template_history (
  id bigint generated always as identity primary key,
  template_id uuid not null references public.workforce_templates(id),
  owner_id uuid not null,
  actor_id uuid,
  version integer not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_template_history enable row level security;
create policy workforce_template_history_read on public.workforce_template_history for select using(workforce_role(owner_id) in ('owner','hr'));
grant select on public.workforce_template_history to authenticated;

alter table public.workforce_tasks add column version integer not null default 1;
alter table public.workforce_tasks add column template_id uuid references public.workforce_templates(id);
alter table public.workforce_tasks add column change_reason text;
create function public.workforce_task_version() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.version:=old.version+1; return new; end $$;
create trigger workforce_task_version before update on public.workforce_tasks for each row execute function public.workforce_task_version();

create function public.workforce_save_template(p_owner uuid,p_id uuid,p_version integer,p_title text,p_category text,p_items text[],p_archived boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_templates; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 or p_items is null or cardinality(p_items) not between 1 and 30 or exists(select 1 from unnest(p_items) x where x is null or length(trim(x)) not between 1 and 300) then raise exception 'Provide a title and 1 to 30 nonempty tasks'; end if;
  if p_id is null then
    insert into workforce_templates(owner_id,title,category,items,archived) values(p_owner,trim(p_title),p_category,p_items,p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_templates where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if p_version is distinct from r.version then raise exception 'Template changed; refresh first'; end if;
    update workforce_templates set title=trim(p_title),category=p_category,items=p_items,archived=p_archived,version=version+1,updated_at=now() where id=p_id returning id,version into result,next_version;
  end if;
  insert into workforce_template_history(template_id,owner_id,actor_id,version) values(result,p_owner,auth.uid(),next_version);
  return result;
end $$;

create function public.workforce_assign_template(p_employee uuid,p_template uuid,p_version integer,p_due date,p_assignee uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; r workforce_templates; title text; task_id uuid;
begin
  select * into e from employees where id=p_employee for update;
  if not found or not workforce_can_manage(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  select * into r from workforce_templates where id=p_template for share;
  if not found or r.owner_id<>e.user_id or r.archived then raise exception 'Template unavailable'; end if;
  if p_version is distinct from r.version then raise exception 'Template changed; refresh first'; end if;
  if exists(select 1 from workforce_tasks where employee_id=e.id and template_id=r.id and status='open') then raise exception 'An open checklist already exists'; end if;
  foreach title in array r.items loop
    task_id:=workforce_assign_task(e.id,r.category,title,p_assignee,p_due);
    update workforce_tasks set template_id=r.id where id=task_id;
  end loop;
  return cardinality(r.items);
end $$;

create function public.workforce_reschedule_task(p_id uuid,p_version integer,p_assignee uuid,p_due date,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_tasks; e employees;
begin
  select * into r from workforce_tasks where id=p_id for update;
  if not found or not workforce_can_manage(r.employee_id) then raise exception 'Not authorized'; end if;
  select * into e from employees where id=r.employee_id;
  if e.archived_at is not null or r.status<>'open' then raise exception 'Only active open tasks can change'; end if;
  if p_version is distinct from r.version then raise exception 'Task changed; refresh first'; end if;
  if p_due is null or p_assignee is null or length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Assignee, due date and reason required'; end if;
  if p_assignee<>e.user_id and not exists(select 1 from workforce_members m where m.owner_id=e.user_id and m.user_id=p_assignee and m.accepted_at is not null and m.revoked_at is null and (m.role='hr' or (m.role='manager' and e.manager_user_id=p_assignee) or (m.role='employee' and m.employee_id=e.id))) then raise exception 'Assignee cannot access this employee'; end if;
  update workforce_tasks set assignee_id=p_assignee,due_on=p_due,change_reason=trim(p_reason) where id=r.id;
  return true;
end $$;

revoke all on function public.workforce_task_version(),public.workforce_save_template(uuid,uuid,integer,text,text,text[],boolean),public.workforce_assign_template(uuid,uuid,integer,date,uuid),public.workforce_reschedule_task(uuid,integer,uuid,date,text) from public,anon;
grant execute on function public.workforce_save_template(uuid,uuid,integer,text,text,text[],boolean),public.workforce_assign_template(uuid,uuid,integer,date,uuid),public.workforce_reschedule_task(uuid,integer,uuid,date,text) to authenticated;
commit;
