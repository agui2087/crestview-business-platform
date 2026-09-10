-- Structural gate only. A pass does not prove data parity, role grants, or app recovery.
do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'public.profiles','public.marketplace_listings','public.deal_inquiries',
    'public.vault_documents','public.billing_entitlements','public.stripe_webhook_events',
    'public.employees','public.workforce_members','public.workforce_leave_policies',
    'public.workforce_leave_ledger','public.workforce_training_evidence',
    'public.workforce_accrual_rules','public.workforce_accrual_history','public.workforce_accrual_runs'
  ] loop
    if to_regclass(relation_name) is null then
      raise exception 'Restore is incomplete: missing required relation %',relation_name;
    end if;
  end loop;
  foreach relation_name in array array[
    'public.workforce_leave_policies','public.workforce_leave_ledger',
    'public.workforce_training_evidence','public.workforce_accrual_rules',
    'public.workforce_accrual_history','public.workforce_accrual_runs'
  ] loop
    if not (select relrowsecurity from pg_class where oid=to_regclass(relation_name)) then
      raise exception 'Restore is incomplete: RLS disabled on %',relation_name;
    end if;
  end loop;
end $$;
