begin;
-- Explicit, per-employee policy adoption. No default amount or legal entitlement.
create table public.workforce_leave_policies (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  owner_id uuid not null references auth.users(id),
  leave_type text not null check(length(trim(leave_type)) between 1 and 80),
  starts_on date not null,
  ends_on date,
  accrual_minutes integer not null check(accrual_minutes between 0 and 525600),
  accrual_cadence text not null check(accrual_cadence='manual_monthly'),
  version integer not null default 1,
  balance_cap_minutes integer check(balance_cap_minutes between 0 and 5256000),
  exclude_holidays boolean not null,
  holidays date[] not null,
  review_reference text not null check(length(trim(review_reference)) between 1 and 1000),
  adopted_by uuid not null,
  adopted_at timestamptz not null default now(),
  check(starts_on between date '1900-01-01' and date '2200-12-31'),
  check(ends_on is null or ends_on between starts_on and date '2200-12-31')
);
create table public.workforce_leave_ledger (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.workforce_leave_policies(id),
  employee_id uuid not null references public.employees(id),
  owner_id uuid not null references auth.users(id),
  effective_on date not null,
  kind text not null check(kind in ('opening','accrual','taken','adjustment','carryover')),
  minutes integer not null,
  reference text not null check(length(trim(reference)) between 1 and 200),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(policy_id,reference)
);
create unique index workforce_leave_one_opening on public.workforce_leave_ledger(policy_id) where kind='opening';
create unique index workforce_leave_one_monthly_accrual on public.workforce_leave_ledger(policy_id,(extract(year from effective_on)),(extract(month from effective_on))) where kind='accrual';
create table public.workforce_leave_policy_history (
  id bigint generated always as identity primary key,
  policy_id uuid not null references public.workforce_leave_policies(id),
  employee_id uuid not null references public.employees(id),
  actor_id uuid not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_policy_history enable row level security;
create policy workforce_leave_policy_history_read on public.workforce_leave_policy_history for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_policy_history from anon,authenticated;
grant select on public.workforce_leave_policy_history to authenticated;
alter table public.workforce_leave_policies enable row level security;
alter table public.workforce_leave_ledger enable row level security;
create policy workforce_leave_policies_read on public.workforce_leave_policies for select using(workforce_can_read(employee_id));
create policy workforce_leave_ledger_read on public.workforce_leave_ledger for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_policies,public.workforce_leave_ledger from anon,authenticated;
grant select on public.workforce_leave_policies,public.workforce_leave_ledger to authenticated;

create function public.workforce_adopt_leave_policy(p_employee uuid,p_type text,p_start date,p_end date,p_accrual integer,p_cap integer,p_exclude_holidays boolean,p_holidays date[],p_review text,p_cadence text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  if p_holidays is null or cardinality(p_holidays)>366 or exists(select 1 from unnest(p_holidays) h where h is null or h not between date '1900-01-01' and date '2200-12-31') then raise exception 'Explicit valid holiday calendar required'; end if;
  if exists(select 1 from workforce_leave_policies where employee_id=e.id and lower(trim(leave_type))=lower(trim(p_type)) and starts_on<=coalesce(p_end,date '2200-12-31') and coalesce(ends_on,date '2200-12-31')>=p_start) then raise exception 'Overlapping leave policy'; end if;
  insert into workforce_leave_policies(employee_id,owner_id,leave_type,starts_on,ends_on,accrual_minutes,balance_cap_minutes,exclude_holidays,holidays,review_reference,adopted_by,accrual_cadence)
    values(e.id,e.user_id,trim(p_type),p_start,p_end,p_accrual,p_cap,p_exclude_holidays,p_holidays,trim(p_review),auth.uid(),p_cadence) returning id into result;
  insert into workforce_leave_policy_history(policy_id,employee_id,actor_id,snapshot,reason) select id,employee_id,auth.uid(),to_jsonb(workforce_leave_policies),trim(p_review) from workforce_leave_policies where id=result;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_policies',result,'INSERT',array['policy_adopted']);
  return result;
end $$;

-- Closing a policy preserves both the adoption snapshot and its ledger. A new
-- policy can then be adopted for subsequent dates; balances never transfer silently.
create function public.workforce_close_leave_policy(p_policy uuid,p_version integer,p_end date,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies; e employees;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=p.employee_id for update;
  if coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  select * into p from workforce_leave_policies where id=p_policy for update;
  if p.version is distinct from p_version then raise exception 'Policy changed; refresh first'; end if;
  if p_end is null or p_end<p.starts_on or p_end>coalesce(p.ends_on,date '2200-12-31') then raise exception 'End must shorten the policy without removing its start'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Reason required'; end if;
  if exists(select 1 from workforce_leave_ledger where policy_id=p.id and effective_on>p_end) then raise exception 'Cannot exclude posted entries'; end if;
  update workforce_leave_policies set ends_on=p_end,version=version+1 where id=p.id;
  insert into workforce_leave_policy_history(policy_id,employee_id,actor_id,snapshot,reason) select id,employee_id,auth.uid(),to_jsonb(workforce_leave_policies),trim(p_reason) from workforce_leave_policies where id=p.id;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_policies',p.id,'UPDATE',array['ends_on','version']);
  return true;
end $$;

-- Aggregate inside PostgreSQL, not from a truncated page of journal entries.
create function public.workforce_leave_balance(p_policy uuid,p_as_of date) returns table(configured boolean,minutes bigint,entry_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found or not coalesce(workforce_can_read(p.employee_id),false) then raise exception 'Not authorized'; end if;
  if p_as_of is null or p_as_of not between date '1900-01-01' and current_date then raise exception 'Invalid as-of date'; end if;
  return query select count(*) filter(where kind='opening')=1,
    case when count(*) filter(where kind='opening')=1 then coalesce(sum(l.minutes),0)::bigint else null::bigint end,count(*)
    from workforce_leave_ledger l where l.policy_id=p.id and l.effective_on<=p_as_of;
end $$;

-- Manual reviewed postings only. No scheduled accrual job, automatic leave debit,
-- implicit carryover/reset, or real payroll integration is enabled by this routine.
create function public.workforce_post_leave_entry(p_policy uuid,p_date date,p_kind text,p_minutes integer,p_reference text,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies; e employees; existing workforce_leave_ledger; opening_date date; latest_date date; current_balance bigint; result uuid;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=p.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  -- Employee lock serializes all postings before checking references/balances.
  -- Refresh after acquiring the lock: a concurrent policy close may have won it.
  select * into p from workforce_leave_policies where id=p_policy;
  select * into existing from workforce_leave_ledger where policy_id=p.id and reference=trim(p_reference);
  if found then
    if existing.effective_on is not distinct from p_date and existing.kind is not distinct from p_kind and existing.minutes is not distinct from p_minutes and existing.reason is not distinct from trim(p_reason) then return existing.id; end if;
    raise exception 'Reference already used with different contents';
  end if;
  if p_date is null or p_date<p.starts_on or p_date>coalesce(p.ends_on,date '2200-12-31') or p_date>current_date then raise exception 'Posting date must be within policy dates and not future'; end if;
  if p_minutes is null or abs(p_minutes::bigint)>5256000 then raise exception 'Invalid minute amount'; end if;
  if p_kind='accrual' and (p_minutes<0 or p_minutes>p.accrual_minutes) then raise exception 'Accrual exceeds adopted amount'; end if;
  if p_kind='taken' and p_minutes>0 then raise exception 'Taken leave must be a debit'; end if;
  select effective_on into opening_date from workforce_leave_ledger where policy_id=p.id and kind='opening';
  select max(effective_on),coalesce(sum(minutes),0) into latest_date,current_balance from workforce_leave_ledger where policy_id=p.id;
  if p_kind='opening' then
    if opening_date is not null then raise exception 'Opening already configured'; end if;
  elsif opening_date is null then raise exception 'Configure opening balance first';
  end if;
  if latest_date is not null and p_date<latest_date then raise exception 'Backdated postings require a current-date correction'; end if;
  if p_kind='accrual' and p.balance_cap_minutes is not null and p_minutes>0 and current_balance+p_minutes>p.balance_cap_minutes then raise exception 'Accrual exceeds balance cap'; end if;
  insert into workforce_leave_ledger(policy_id,employee_id,owner_id,effective_on,kind,minutes,reference,reason,actor_id) values(p.id,e.id,e.user_id,p_date,p_kind,p_minutes,trim(p_reference),trim(p_reason),auth.uid()) returning id into result;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_ledger',result,'INSERT',array['leave_posting']);
  return result;
end $$;
revoke all on function public.workforce_adopt_leave_policy(uuid,text,date,date,integer,integer,boolean,date[],text,text),public.workforce_post_leave_entry(uuid,date,text,integer,text,text),public.workforce_close_leave_policy(uuid,integer,date,text),public.workforce_leave_balance(uuid,date) from public,anon;
grant execute on function public.workforce_adopt_leave_policy(uuid,text,date,date,integer,integer,boolean,date[],text,text),public.workforce_post_leave_entry(uuid,date,text,integer,text,text),public.workforce_close_leave_policy(uuid,integer,date,text),public.workforce_leave_balance(uuid,date) to authenticated;
commit;
