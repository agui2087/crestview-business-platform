begin;
create table public.workforce_leave_request_postings (
  request_id uuid primary key references public.workforce_requests(id),
  employee_id uuid not null references public.employees(id),
  policy_id uuid not null references public.workforce_leave_policies(id),
  ledger_id uuid not null unique references public.workforce_leave_ledger(id),
  calculation jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_request_postings enable row level security;
create policy workforce_leave_request_postings_read on public.workforce_leave_request_postings for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_request_postings from anon,authenticated;
grant select on public.workforce_leave_request_postings to authenticated;

create function public.workforce_post_approved_leave(p_request uuid,p_policy uuid,p_policy_version integer,p_expected_minutes integer,p_posting_date date,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requests; e employees; p workforce_leave_policies; prior workforce_leave_request_postings; s workforce_schedules; d date; amount integer; total integer:=0; detail jsonb:='[]'; entry uuid; schedule_count integer;
begin
  select * into r from workforce_requests where id=p_request;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=r.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  select * into r from workforce_requests where id=p_request for update;
  select * into prior from workforce_leave_request_postings where request_id=r.id;
  if found then
    if prior.policy_id=p_policy and (prior.calculation->>'minutes')::integer=p_expected_minutes then return prior.ledger_id; end if;
    raise exception 'Request already posted with different calculation';
  end if;
  if e.archived_at is not null or r.kind<>'leave' or r.status<>'approved' then raise exception 'Active profile and approved leave required'; end if;
  if r.starts_on is null or r.ends_on is null or r.ends_on<r.starts_on or r.ends_on-r.starts_on>365 then raise exception 'Invalid leave dates'; end if;
  select * into p from workforce_leave_policies where id=p_policy;
  if not found or p.employee_id<>e.id or p.owner_id<>e.user_id or lower(trim(p.leave_type))<>lower(trim(r.leave_type)) then raise exception 'Matching employee and leave type policy required'; end if;
  if p.version is distinct from p_policy_version then raise exception 'Policy changed; refresh first'; end if;
  if p.starts_on>r.starts_on or coalesce(p.ends_on,date '2200-12-31')<r.ends_on then raise exception 'One policy must cover the entire request'; end if;
  if p_posting_date is null or p_posting_date<r.ends_on then raise exception 'Post completed leave only'; end if;
  d:=r.starts_on;
  while d<=r.ends_on loop
    select count(*) into schedule_count from workforce_schedules where employee_id=e.id and not cancelled and starts_on<=d and coalesce(ends_on,date '2200-12-31')>=d;
    if schedule_count<>1 then raise exception 'Exactly one schedule required for every leave date'; end if;
    select * into s from workforce_schedules where employee_id=e.id and not cancelled and starts_on<=d and coalesce(ends_on,date '2200-12-31')>=d;
    amount:=case when p.exclude_holidays and d=any(p.holidays) then 0 else s.daily_minutes[extract(isodow from d)::integer] end;
    if amount is null or amount<0 or amount>1440 then raise exception 'Invalid scheduled amount'; end if;
    total:=total+amount;
    detail:=detail||jsonb_build_array(jsonb_build_object('date',d,'minutes',amount,'schedule_id',s.id,'schedule_version',s.version,'timezone',s.timezone,'holiday_excluded',p.exclude_holidays and d=any(p.holidays)));
    d:=d+1;
  end loop;
  if total is distinct from p_expected_minutes then raise exception 'Calculated minutes differ from reviewed amount'; end if;
  entry:=workforce_post_leave_entry(p.id,p_posting_date,'taken',-total,'approved-request:'||r.id::text,p_reason);
  insert into workforce_leave_request_postings(request_id,employee_id,policy_id,ledger_id,calculation) values(r.id,e.id,p.id,entry,jsonb_build_object('minutes',total,'policy_id',p.id,'policy_version',p.version,'request_start',r.starts_on,'request_end',r.ends_on,'days',detail));
  return entry;
end $$;
revoke all on function public.workforce_post_approved_leave(uuid,uuid,integer,integer,date,text) from public,anon;
grant execute on function public.workforce_post_approved_leave(uuid,uuid,integer,integer,date,text) to authenticated;
commit;
