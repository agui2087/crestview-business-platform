create or replace function public.workforce_run_accruals() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; r workforce_accrual_rules; p workforce_leave_policies; e employees;
  today date := (now() at time zone 'UTC')::date; month_on date := date_trunc('month',now() at time zone 'UTC')::date;
  balance bigint; openings bigint; latest date; credit integer; entry uuid; problem text; processed integer:=0;
begin
  for candidate in select policy_id,employee_id from workforce_accrual_rules where enabled and next_on<=today and public.workforce_subscription_active(owner_id) order by next_on,policy_id limit 100 loop
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
