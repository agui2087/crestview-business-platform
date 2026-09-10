begin;
-- Analytical source records only: never payment instructions. Salary data is
-- intentionally restricted to owner/HR, unlike the general personnel directory.
create table public.workforce_payroll_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  reference text not null check(length(trim(reference)) between 1 and 200),
  payload jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  unique(owner_id,reference)
);
create table public.workforce_payroll_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.workforce_payroll_imports(id),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  period_start date not null check(period_start between date '1900-01-01' and date '2200-12-31'),
  period_end date not null check(period_end between date '1900-01-01' and date '2200-12-31'),
  currency text not null check(currency in ('USD','EUR','GBP','CAD','AUD','MXN')),
  gross_minor bigint not null check(gross_minor between 0 and 10000000000),
  employer_cost_minor bigint not null check(employer_cost_minor between gross_minor and 10000000000),
  paid_hours_hundredths integer not null,
  source_reference text not null check(length(trim(source_reference)) between 1 and 200 and source_reference !~ '^[=+@-]' and source_reference !~ '[[:cntrl:]]'),
  voided_at timestamptz,
  check(period_end-period_start between 0 and 365),
  check(paid_hours_hundredths between 0 and (period_end-period_start+1)*2400)
);
create unique index workforce_payroll_active_period on public.workforce_payroll_rows(employee_id,period_start,period_end) where voided_at is null;
create index workforce_payroll_import_rows on public.workforce_payroll_rows(import_id);
create table public.workforce_payroll_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id),
  import_id uuid not null references public.workforce_payroll_imports(id),
  actor_id uuid not null,
  action text not null check(action in ('IMPORT','VOID')),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.workforce_payroll_imports enable row level security;
alter table public.workforce_payroll_rows enable row level security;
alter table public.workforce_payroll_history enable row level security;
create policy payroll_import_read on public.workforce_payroll_imports for select using(workforce_role(owner_id) in ('owner','hr'));
create policy payroll_row_read on public.workforce_payroll_rows for select using(workforce_role(owner_id) in ('owner','hr'));
create policy payroll_history_read on public.workforce_payroll_history for select using(workforce_role(owner_id) in ('owner','hr'));
revoke all on public.workforce_payroll_imports,public.workforce_payroll_rows,public.workforce_payroll_history from anon,authenticated;
grant select on public.workforce_payroll_imports,public.workforce_payroll_rows,public.workforce_payroll_history to authenticated;

create function public.workforce_import_payroll(p_owner uuid,p_reference text,p_rows jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing workforce_payroll_imports; result uuid; r jsonb; e employees;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_reference is null or length(trim(p_reference)) not between 1 and 200 then raise exception 'Import reference required'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or octet_length(p_rows::text)>1000000 then raise exception 'Invalid import'; end if;
  if jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Import needs 1 to 500 rows'; end if;
  -- Serialize retries/corrections in this owner workspace, including overlapping periods.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,37));
  select * into existing from workforce_payroll_imports where owner_id=p_owner and reference=trim(p_reference);
  if found then
    if existing.payload=p_rows and existing.voided_at is null then return existing.id; end if;
    raise exception 'Reference already used; refresh or use a new reviewed import reference';
  end if;
  insert into workforce_payroll_imports(owner_id,reference,payload,created_by) values(p_owner,trim(p_reference),p_rows,auth.uid()) returning id into result;
  for r in select value from jsonb_array_elements(p_rows) order by value->>'employeeId' loop
    if jsonb_typeof(r)<>'object' then raise exception 'Invalid payroll row'; end if;
    if (select count(*) from jsonb_object_keys(r))<>8 or not r ?& array['employeeId','periodStart','periodEnd','currency','grossMinor','employerCostMinor','paidHoursHundredths','sourceReference'] then raise exception 'Only analytical fields accepted'; end if;
    if exists(select 1 from jsonb_each(r) x where jsonb_typeof(x.value) is distinct from case when x.key in ('grossMinor','employerCostMinor','paidHoursHundredths') then 'number' else 'string' end) then raise exception 'Invalid field types'; end if;
    if r->>'grossMinor' !~ '^[0-9]+$' or r->>'employerCostMinor' !~ '^[0-9]+$' or r->>'paidHoursHundredths' !~ '^[0-9]+$' or r->>'periodStart' !~ '^\d{4}-\d{2}-\d{2}$' or r->>'periodEnd' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use integer minor units and ISO dates'; end if;
    select * into e from employees where id=(r->>'employeeId')::uuid for update;
    if not found or e.user_id<>p_owner or e.archived_at is not null then raise exception 'Employee is unavailable in this workspace'; end if;
    if exists(select 1 from workforce_payroll_rows where employee_id=e.id and voided_at is null and period_start<=(r->>'periodEnd')::date and period_end>=(r->>'periodStart')::date) then raise exception 'Employee has an overlapping imported period; review and void the old import first'; end if;
    insert into workforce_payroll_rows(import_id,owner_id,employee_id,period_start,period_end,currency,gross_minor,employer_cost_minor,paid_hours_hundredths,source_reference)
      values(result,p_owner,e.id,(r->>'periodStart')::date,(r->>'periodEnd')::date,r->>'currency',(r->>'grossMinor')::bigint,(r->>'employerCostMinor')::bigint,(r->>'paidHoursHundredths')::integer,trim(r->>'sourceReference'));
  end loop;
  insert into workforce_payroll_history(owner_id,import_id,actor_id,action,reason) values(p_owner,result,auth.uid(),'IMPORT','Reviewed analytical import');
  return result;
end $$;

-- Correction is explicit: void the whole batch, preserving source and history,
-- then submit the corrected batch under a new reference. No silent overwrites.
create function public.workforce_void_payroll(p_import uuid,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare b workforce_payroll_imports;
begin
  select * into b from workforce_payroll_imports where id=p_import;
  if not found or coalesce(workforce_role(b.owner_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Correction reason required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,37));
  select * into b from workforce_payroll_imports where id=p_import for update;
  if b.voided_at is not null then return false; end if;
  update workforce_payroll_imports set voided_at=now() where id=b.id;
  update workforce_payroll_rows set voided_at=now() where import_id=b.id;
  insert into workforce_payroll_history(owner_id,import_id,actor_id,action,reason) values(b.owner_id,b.id,auth.uid(),'VOID',trim(p_reason));
  return true;
end $$;

-- One bounded import at a time. PostgreSQL totals every row, not a REST page.
create function public.workforce_payroll_totals(p_import uuid) returns table(currency text,period_start date,period_end date,employees bigint,gross_minor numeric,employer_cost_minor numeric,paid_hours_hundredths bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare b workforce_payroll_imports;
begin
  select * into b from workforce_payroll_imports where id=p_import;
  if not found or coalesce(workforce_role(b.owner_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  return query select r.currency,r.period_start,r.period_end,count(*),sum(r.gross_minor),sum(r.employer_cost_minor),sum(r.paid_hours_hundredths) from workforce_payroll_rows r where r.import_id=b.id and r.voided_at is null group by r.currency,r.period_start,r.period_end order by r.period_start,r.currency;
end $$;
revoke all on function public.workforce_import_payroll(uuid,text,jsonb),public.workforce_void_payroll(uuid,text),public.workforce_payroll_totals(uuid) from public,anon;
grant execute on function public.workforce_import_payroll(uuid,text,jsonb),public.workforce_void_payroll(uuid,text),public.workforce_payroll_totals(uuid) to authenticated;
commit;
