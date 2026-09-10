begin;
-- Reviewed transfers only. Never infer forfeiture, cash payout or legal limits.
create table public.workforce_leave_transfers (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  source_policy uuid not null references public.workforce_leave_policies(id),
  target_policy uuid not null unique references public.workforce_leave_policies(id),
  source_entry uuid not null unique references public.workforce_leave_ledger(id),
  target_entry uuid not null unique references public.workforce_leave_ledger(id),
  minutes integer not null check(minutes between 0 and 5256000),
  source_balance_before bigint not null,
  source_version integer not null,
  target_version integer not null,
  reason text not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_transfers enable row level security;
create policy workforce_leave_transfer_read on public.workforce_leave_transfers for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_transfers from public,anon,authenticated;
grant select on public.workforce_leave_transfers to authenticated;

create function public.workforce_transfer_leave(p_source uuid,p_target uuid,p_source_version integer,p_target_version integer,p_expected_balance bigint,p_minutes integer,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare s workforce_leave_policies; d workforce_leave_policies; e employees; existing workforce_leave_transfers; b bigint; configured boolean; debit uuid; credit uuid; result uuid;
begin
  select * into s from workforce_leave_policies where id=p_source;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=s.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  select * into s from workforce_leave_policies where id=p_source;
  select * into d from workforce_leave_policies where id=p_target;
  if not found or d.employee_id<>e.id or d.owner_id<>s.owner_id or lower(trim(d.leave_type))<>lower(trim(s.leave_type)) or d.id=s.id then raise exception 'Choose the same employee and leave type'; end if;
  select * into existing from workforce_leave_transfers where target_policy=d.id;
  if found then
    if existing.source_policy=s.id and existing.minutes=p_minutes and existing.reason=trim(p_reason) then return existing.id; end if;
    raise exception 'Target already has a different transfer';
  end if;
  if s.version is distinct from p_source_version or d.version is distinct from p_target_version then raise exception 'Policy changed; refresh first'; end if;
  if s.ends_on is null or s.ends_on>=d.starts_on or d.starts_on>current_date then raise exception 'Close the earlier policy and wait until the new period begins'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_minutes is null or p_minutes not between 0 and 5256000 then raise exception 'Reviewed amount and reason required'; end if;
  select x.configured,x.minutes into configured,b from workforce_leave_balance(s.id,s.ends_on) x;
  if not configured or b is distinct from p_expected_balance then raise exception 'Source balance missing or changed; refresh first'; end if;
  if p_minutes>b or b<0 then raise exception 'Cannot transfer more than the nonnegative source balance'; end if;
  if d.balance_cap_minutes is not null and p_minutes>d.balance_cap_minutes then raise exception 'Transfer exceeds adopted target balance cap'; end if;
  if exists(select 1 from workforce_leave_ledger where policy_id=d.id) then raise exception 'Target must not already have an opening or postings'; end if;
  debit:=workforce_post_leave_entry(s.id,s.ends_on,'carryover',-p_minutes,'transfer-out:'||d.id,trim(p_reason));
  credit:=workforce_post_leave_entry(d.id,d.starts_on,'opening',p_minutes,'transfer-in:'||s.id,trim(p_reason));
  insert into workforce_leave_transfers(employee_id,source_policy,target_policy,source_entry,target_entry,minutes,source_balance_before,source_version,target_version,reason,actor_id)
    values(e.id,s.id,d.id,debit,credit,p_minutes,b,s.version,d.version,trim(p_reason),auth.uid()) returning id into result;
  return result;
end $$;
revoke all on function public.workforce_transfer_leave(uuid,uuid,integer,integer,bigint,integer,text) from public,anon;
grant execute on function public.workforce_transfer_leave(uuid,uuid,integer,integer,bigint,integer,text) to authenticated;
commit;
