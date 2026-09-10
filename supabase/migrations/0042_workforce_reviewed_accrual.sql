begin;
-- Separate opt-in from the manual policy maximum. No existing policy is enabled.
create table public.workforce_accrual_rules (
  policy_id uuid primary key references public.workforce_leave_policies(id),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  amount_minutes integer not null check(amount_minutes between 1 and 525600),
  policy_version integer not null,
  version integer not null default 1,
  enabled boolean not null,
  next_on date not null check(extract(day from next_on)=1),
  review_reference text not null check(length(trim(review_reference)) between 1 and 1000),
  approved_by uuid not null,
  updated_at timestamptz not null default now()
);
create table public.workforce_accrual_history (
  id bigint generated always as identity primary key,
  policy_id uuid not null references public.workforce_leave_policies(id),
  owner_id uuid not null,
  actor_id uuid not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table public.workforce_accrual_runs (
  id bigint generated always as identity primary key,
  policy_id uuid not null references public.workforce_leave_policies(id),
  owner_id uuid not null,
  period_on date not null,
  rule_version integer not null,
  status text not null check(status in ('posted','already_posted','review_required')),
  detail text not null,
  ledger_id uuid references public.workforce_leave_ledger(id),
  minutes integer,
  created_at timestamptz not null default now(),
  unique(policy_id,period_on)
);
alter table public.workforce_accrual_rules enable row level security;
alter table public.workforce_accrual_history enable row level security;
alter table public.workforce_accrual_runs enable row level security;
create policy accrual_rules_read on public.workforce_accrual_rules for select using(auth.uid()=owner_id);
create policy accrual_history_read on public.workforce_accrual_history for select using(auth.uid()=owner_id);
create policy accrual_runs_read on public.workforce_accrual_runs for select using(auth.uid()=owner_id);
revoke all on public.workforce_accrual_rules,public.workforce_accrual_history,public.workforce_accrual_runs from public,anon,authenticated;
grant select on public.workforce_accrual_rules,public.workforce_accrual_history,public.workforce_accrual_runs to authenticated;
create index workforce_accrual_due on public.workforce_accrual_rules(next_on) where enabled;

create function public.workforce_configure_accrual(p_policy uuid,p_policy_version integer,p_rule_version integer,p_amount integer,p_expected_balance bigint,p_review text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies; e employees; r workforce_accrual_rules; b bigint; openings bigint;
  first_on date := (date_trunc('month',now() at time zone 'UTC')+interval '1 month')::date;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found or p.owner_id is distinct from auth.uid() then raise exception 'Owner authorization required'; end if;
  select * into e from employees where id=p.employee_id for update;
  if e.archived_at is not null or e.employment_status<>'active' then raise exception 'Active employee required'; end if;
  select * into p from workforce_leave_policies where id=p_policy;
  select * into r from workforce_accrual_rules where policy_id=p.id for update;
  if p.version is distinct from p_policy_version or coalesce(r.version,0) is distinct from p_rule_version then raise exception 'Changed; preview again'; end if;
  if p_amount is null or p_amount<1 or p_amount>p.accrual_minutes then raise exception 'Amount exceeds reviewed manual maximum'; end if;
  if p_review is null or length(trim(p_review)) not between 1 and 1000 then raise exception 'Review reference required'; end if;
  if first_on<p.starts_on or first_on>coalesce(p.ends_on,date '2200-12-31') then raise exception 'Policy must cover next month'; end if;
  select coalesce(sum(minutes),0),count(*) filter(where kind='opening') into b,openings from workforce_leave_ledger where policy_id=p.id;
  if openings<>1 or b is distinct from p_expected_balance then raise exception 'Balance changed or unconfigured; preview again'; end if;
  insert into workforce_accrual_rules(policy_id,owner_id,employee_id,amount_minutes,policy_version,enabled,next_on,review_reference,approved_by)
  values(p.id,p.owner_id,p.employee_id,p_amount,p.version,true,first_on,trim(p_review),auth.uid())
  on conflict(policy_id) do update set amount_minutes=excluded.amount_minutes,policy_version=excluded.policy_version,enabled=true,next_on=excluded.next_on,review_reference=excluded.review_reference,approved_by=excluded.approved_by,version=workforce_accrual_rules.version+1,updated_at=now();
  insert into workforce_accrual_history(policy_id,owner_id,actor_id,snapshot,reason)
  select policy_id,owner_id,auth.uid(),to_jsonb(workforce_accrual_rules),'Owner enabled reviewed monthly automation' from workforce_accrual_rules where policy_id=p.id;
  return true;
end $$;

create function public.workforce_pause_accrual(p_policy uuid,p_version integer,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_accrual_rules;
begin
  select * into r from workforce_accrual_rules where policy_id=p_policy;
  if not found or r.owner_id is distinct from auth.uid() then raise exception 'Owner authorization required'; end if;
  perform 1 from employees where id=r.employee_id for update;
  select * into r from workforce_accrual_rules where policy_id=p_policy for update;
  if r.version is distinct from p_version then raise exception 'Changed; refresh first'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Reason required'; end if;
  update workforce_accrual_rules set enabled=false,version=version+1,updated_at=now() where policy_id=p_policy;
  insert into workforce_accrual_history(policy_id,owner_id,actor_id,snapshot,reason)
  select policy_id,owner_id,auth.uid(),to_jsonb(workforce_accrual_rules),trim(p_reason) from workforce_accrual_rules where policy_id=p_policy;
  return true;
end $$;

-- Internal database scheduler only. No caller-supplied date, tenant or amount.
-- Employee locks serialize with all existing leave writes; each policy is atomic.
create function public.workforce_run_accruals() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; r workforce_accrual_rules; p workforce_leave_policies; e employees;
  today date := (now() at time zone 'UTC')::date; month_on date := date_trunc('month',now() at time zone 'UTC')::date;
  balance bigint; openings bigint; latest date; credit integer; entry uuid; problem text; processed integer:=0;
begin
  for candidate in select policy_id,employee_id from workforce_accrual_rules where enabled and next_on<=today order by next_on,policy_id limit 100 loop
    perform 1 from employees where id=candidate.employee_id for update;
    select * into r from workforce_accrual_rules where policy_id=candidate.policy_id for update;
    if not r.enabled or r.next_on>today then continue; end if;
    select * into p from workforce_leave_policies where id=r.policy_id;
    select * into e from employees where id=r.employee_id;
    select coalesce(sum(minutes),0),count(*) filter(where kind='opening'),max(effective_on) into balance,openings,latest from workforce_leave_ledger where policy_id=p.id;
    problem:=null;
    if r.next_on<month_on then problem:='Missed month; no automatic backfill';
    elsif p.version<>r.policy_version then problem:='Policy changed; owner review required';
    elsif e.archived_at is not null or e.employment_status<>'active' then problem:='Employee not active';
    elsif p.owner_id<>r.owner_id or e.user_id<>r.owner_id or r.approved_by<>r.owner_id then problem:='Ownership changed';
    elsif today<p.starts_on or today>coalesce(p.ends_on,date '2200-12-31') then problem:='Outside policy period';
    elsif openings<>1 or latest>today then problem:='Opening balance missing or future posting';
    elsif r.amount_minutes>p.accrual_minutes then problem:='Approved amount exceeds policy maximum';
    end if;
    if problem is not null then
      insert into workforce_accrual_runs(policy_id,owner_id,period_on,rule_version,status,detail) values(p.id,r.owner_id,r.next_on,r.version,'review_required',problem) on conflict(policy_id,period_on) do nothing;
      update workforce_accrual_rules set enabled=false,version=version+1,updated_at=now() where policy_id=p.id;
      insert into workforce_accrual_history(policy_id,owner_id,actor_id,snapshot,reason) select policy_id,owner_id,approved_by,to_jsonb(workforce_accrual_rules),'Scheduler paused: '||problem from workforce_accrual_rules where policy_id=p.id;
    else
      select id into entry from workforce_leave_ledger where policy_id=p.id and kind='accrual' and effective_on>=month_on and effective_on<(month_on+interval '1 month')::date;
      if found then
        insert into workforce_accrual_runs(policy_id,owner_id,period_on,rule_version,status,detail,ledger_id) values(p.id,r.owner_id,r.next_on,r.version,'already_posted','Existing monthly accrual preserved',entry);
      else
        credit:=least(r.amount_minutes::bigint,case when p.balance_cap_minutes is null then r.amount_minutes::bigint else greatest(0,p.balance_cap_minutes::bigint-balance) end)::integer;
        insert into workforce_leave_ledger(policy_id,employee_id,owner_id,effective_on,kind,minutes,reference,reason,actor_id)
        values(p.id,p.employee_id,p.owner_id,today,'accrual',credit,'scheduled-accrual:'||month_on::text,'Scheduled monthly accrual under owner-reviewed rule version '||r.version,r.approved_by) returning id into entry;
        insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(p.owner_id,p.employee_id,r.approved_by,'workforce_leave_ledger',entry,'INSERT',array['scheduled_accrual']);
        insert into workforce_accrual_runs(policy_id,owner_id,period_on,rule_version,status,detail,ledger_id,minutes) values(p.id,r.owner_id,r.next_on,r.version,'posted','Current balance cap applied; zero credit consumes the monthly posting',entry,credit);
      end if;
      update workforce_accrual_rules set next_on=(month_on+interval '1 month')::date,updated_at=now() where policy_id=p.id;
    end if;
    processed:=processed+1;
  end loop;
  return processed;
end $$;
revoke all on function public.workforce_configure_accrual(uuid,integer,integer,integer,bigint,text),public.workforce_pause_accrual(uuid,integer,text),public.workforce_run_accruals() from public,anon,authenticated;
grant execute on function public.workforce_configure_accrual(uuid,integer,integer,integer,bigint,text),public.workforce_pause_accrual(uuid,integer,text) to authenticated;
-- The postgres-owned pg_cron job is installed separately after hosted verification.
commit;
