begin;
create function public.workforce_subscription_active(p_owner uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from billing_entitlements where user_id=p_owner and product_code='workforce'
   and active and quantity>0 and (expires_at is null or expires_at>now()))
$$;
revoke all on function public.workforce_subscription_active(uuid) from public,anon,authenticated;

create function public.workforce_billing_status(p_owner uuid) returns table(active boolean,capacity integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if coalesce(workforce_role(p_owner),'') not in ('owner','hr','manager','employee') then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 return query select public.workforce_subscription_active(p_owner),coalesce((select quantity from billing_entitlements
   where user_id=p_owner and product_code='workforce' and public.workforce_subscription_active(p_owner)),0);
end $$;
revoke all on function public.workforce_billing_status(uuid) from public,anon;
grant execute on function public.workforce_billing_status(uuid) to authenticated;

create function public.enforce_workforce_subscription_write() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare n jsonb:=to_jsonb(NEW); o jsonb; business uuid;
begin
 business:=coalesce(n->>'owner_id',n->>'user_id')::uuid;
 if business is null and n->>'employee_id' is not null then
   select user_id into business from employees where id=(n->>'employee_id')::uuid;
 end if;
 if TG_OP='UPDATE' then
   o:=to_jsonb(OLD);
   if (coalesce(o->>'owner_id',o->>'user_id') is not null and coalesce(o->>'owner_id',o->>'user_id') is distinct from business::text)
      or (n->>'employee_id' is distinct from o->>'employee_id') then
     raise exception 'Business cannot change' using errcode='42501';
   end if;
   -- Security revocations must never be held behind a subscription paywall.
   if TG_TABLE_NAME='workforce_members' and o->>'revoked_at' is null and n->>'revoked_at' is not null
      and n-'revoked_at'=o-'revoked_at' then return NEW; end if;
   if TG_TABLE_NAME='workforce_training_evidence' and o->>'revoked_at' is null and n->>'revoked_at' is not null
      and n-array['revoked_at','revoked_by','revoke_reason']=o-array['revoked_at','revoked_by','revoke_reason'] then return NEW; end if;
   -- Preserve vault deletion's ON DELETE SET NULL, without allowing a replacement.
   if TG_TABLE_NAME='workforce_training_evidence' and n->>'document_id' is null
      and n-'document_id'=o-'document_id' then return NEW; end if;
   if TG_TABLE_NAME='workforce_accrual_rules' and n->>'enabled'='false'
      and n-array['enabled','version','updated_at']=o-array['enabled','version','updated_at'] then return NEW; end if;
 end if;
 if not public.workforce_subscription_active(business) then
   raise exception 'Workforce is read-only. Renew the business subscription to save changes' using errcode='P0001';
 end if;
 return NEW;
end $$;
revoke all on function public.enforce_workforce_subscription_write() from public,anon,authenticated;
do $$ declare tab text; begin
 foreach tab in array array['employees','employee_records','workforce_members','workforce_requests','workforce_tasks',
 'workforce_requirements','workforce_templates','workforce_business_settings','workforce_locations','workforce_departments',
 'workforce_employee_placements','workforce_schedules','workforce_leave_policies','workforce_leave_ledger',
 'workforce_leave_request_postings','workforce_leave_transfers','workforce_payroll_imports','workforce_payroll_rows',
 'workforce_training_evidence','workforce_accrual_rules'] loop
   execute format('create trigger subscription_write_access before insert or update on public.%I for each row execute function public.enforce_workforce_subscription_write()',tab);
 end loop;
end $$;

create function public.enforce_pro_finding_write() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from billing_entitlements where user_id=NEW.user_id and product_code='crestview_pro'
   and active and (expires_at is null or expires_at>now())) then
   raise exception 'An active Pro subscription is required' using errcode='P0001';
 end if;
 if auth.uid() is not null and (NEW.review_status='confirmed' or NEW.confidence='professional_confirmed') then
   raise exception 'Buyer review is not independent professional confirmation' using errcode='42501';
 end if;
 return NEW;
end $$;
revoke all on function public.enforce_pro_finding_write() from public,anon,authenticated;
create trigger subscription_write_access before insert or update on public.deal_document_findings
 for each row execute function public.enforce_pro_finding_write();
commit;
