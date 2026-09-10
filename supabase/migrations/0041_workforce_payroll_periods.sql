begin;
-- Aggregate in PostgreSQL before limiting displayed periods. Never sum a REST page.
create function public.workforce_payroll_periods(p_owner uuid)
returns table(currency text,period_start date,period_end date,employees bigint,imports bigint,gross_minor numeric,employer_cost_minor numeric,paid_hours_hundredths bigint,cost_per_paid_hour numeric,total_periods bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  return query
    with grouped as (
      select r.currency,r.period_start,r.period_end,count(distinct r.employee_id) employees,count(distinct r.import_id) imports,
        sum(r.gross_minor) gross_minor,sum(r.employer_cost_minor) employer_cost_minor,sum(r.paid_hours_hundredths) paid_hours_hundredths
      from workforce_payroll_rows r join workforce_payroll_imports b on b.id=r.import_id and b.owner_id=r.owner_id
      where r.owner_id=p_owner and r.voided_at is null and b.voided_at is null
      group by r.currency,r.period_start,r.period_end
    )
    select g.currency,g.period_start,g.period_end,g.employees,g.imports,g.gross_minor,g.employer_cost_minor,g.paid_hours_hundredths,
      round(g.employer_cost_minor/nullif(g.paid_hours_hundredths,0),2),count(*) over()
    from grouped g order by g.period_end desc,g.period_start desc,g.currency limit 100;
end $$;
revoke all on function public.workforce_payroll_periods(uuid) from public,anon;
grant execute on function public.workforce_payroll_periods(uuid) to authenticated;
commit;
