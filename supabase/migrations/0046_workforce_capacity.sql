begin;
-- Preserve records and existing workflows; additions/reactivations require seats.
create function public.enforce_workforce_capacity() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare capacity integer; used integer; growing boolean;
begin
  if TG_OP='UPDATE' and NEW.user_id is distinct from OLD.user_id then
    raise exception 'Employee business cannot be changed' using errcode='42501';
  end if;
  growing := NEW.archived_at is null and NEW.employment_status in ('active','leave');
  if TG_OP='UPDATE' then
    if not growing or (OLD.archived_at is null and OLD.employment_status in ('active','leave')) then return NEW; end if;
  end if;
  -- Serialize all creation/import/restore paths for the business, including HR.
  perform id from auth.users where id=NEW.user_id for update;
  select quantity into capacity from public.billing_entitlements
    where user_id=NEW.user_id and product_code='workforce' and active
    and (expires_at is null or expires_at>now());
  if coalesce(capacity,0)<=0 then
    raise exception 'An active Workforce subscription is required to add or restore employees' using errcode='P0001';
  end if;
  if growing then
    select count(*) into used from public.employees where user_id=NEW.user_id
      and archived_at is null and employment_status in ('active','leave') and id<>NEW.id;
    if used>=capacity then
      raise exception 'Workforce employee capacity reached. Upgrade or archive an inactive employee' using errcode='P0001';
    end if;
  end if;
  return NEW;
end $$;
revoke all on function public.enforce_workforce_capacity() from public,anon,authenticated;
create trigger enforce_workforce_capacity before insert or update on public.employees
  for each row execute function public.enforce_workforce_capacity();
commit;
