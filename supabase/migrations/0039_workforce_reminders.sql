begin;
-- Live in-app reminders, not email delivery. Generated from current source state
-- so completing a task or revoking membership immediately changes the result.
create function public.workforce_reminders(p_owner uuid) returns table(
  source_id uuid,kind text,title text,employee_id uuid,employee_name text,due_on date,
  business_today date,business_timezone text,total_count bigint
) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare viewer_role text; zone text; today date;
begin
  viewer_role:=workforce_role(p_owner);
  if coalesce(viewer_role,'') not in ('owner','hr','manager','employee') then raise exception 'Not authorized'; end if;
  select timezone into zone from workforce_business_settings where owner_id=p_owner;
  zone:=coalesce(zone,'UTC'); today:=(now() at time zone zone)::date;
  return query with candidates as (
    select t.id source_id,case when t.due_on<today then 'overdue_task' else 'upcoming_task' end kind,t.title,e.id employee_id,e.full_name employee_name,t.due_on
    from workforce_tasks t join employees e on e.id=t.employee_id
    where t.owner_id=p_owner and e.archived_at is null and workforce_can_read(e.id)
      and t.assignee_id=auth.uid() and t.status='open' and t.due_on<=today+7
    union all
    select r.id,case when r.kind='leave' then 'review_leave' else 'review_profile' end,r.title,e.id,e.full_name,r.starts_on
    from workforce_requests r join employees e on e.id=r.employee_id
    where r.owner_id=p_owner and e.archived_at is null and workforce_can_manage(e.id)
      and r.status='pending' and r.created_by<>auth.uid()
      and (viewer_role in ('owner','hr') or (viewer_role='manager' and r.kind='leave' and r.approver_id=auth.uid()))
    union all
    select t.id,'verify_task',t.title,e.id,e.full_name,t.due_on
    from workforce_tasks t join employees e on e.id=t.employee_id
    where t.owner_id=p_owner and e.archived_at is null and workforce_can_manage(e.id)
      and t.status='completed' and t.verified_at is null and t.completed_by<>auth.uid()
    union all
    select r.id,'renewal',r.title,e.id,e.full_name,r.expires_on
    from employee_records r join employees e on e.id=r.employee_id
    where r.user_id=p_owner and e.archived_at is null and workforce_can_read(e.id)
      and r.record_type='certification' and r.expires_on<=today+30
  ) select c.source_id,c.kind,c.title,c.employee_id,c.employee_name,c.due_on,today,zone,count(*) over()
      from candidates c order by c.due_on nulls last,c.kind,c.source_id limit 100;
end $$;
revoke all on function public.workforce_reminders(uuid) from public,anon;
grant execute on function public.workforce_reminders(uuid) to authenticated;
commit;
