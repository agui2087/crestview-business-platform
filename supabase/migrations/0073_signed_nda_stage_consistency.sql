-- Repair legacy stages, not signatures or financial/document permissions.
-- Keep a system-owned receipt rather than attributing this repair to a user.
create table public.deal_stage_reconciliations (
  inquiry_id uuid primary key references public.deal_inquiries(id) on delete cascade,
  nda_id uuid not null references public.deal_ndas(id) on delete cascade,
  from_status text not null check (from_status = 'nda_sent'),
  to_status text not null check (to_status = 'nda_signed'),
  reconciled_at timestamptz not null default clock_timestamp(),
  reason text not null default 'System repair from an existing signed agreement; no new signature or access approval.'
);
alter table public.deal_stage_reconciliations enable row level security;
revoke all on public.deal_stage_reconciliations from public, anon, authenticated;
grant select on public.deal_stage_reconciliations to service_role;

do $$
declare previous_role text := current_setting('request.jwt.claim.role', true);
begin
  -- Only migration execution uses this claim; no callable privilege bypass.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  with repaired as (
    update public.deal_inquiries i set status = 'nda_signed', updated_at = clock_timestamp()
    from public.deal_ndas n
    where i.id = n.inquiry_id and i.buyer_id = n.buyer_id and i.broker_id = n.broker_id
      and i.status = 'nda_sent' and n.status = 'signed'
    returning i.id, n.id as nda_id
  )
  insert into public.deal_stage_reconciliations(inquiry_id, nda_id, from_status, to_status)
    select id, nda_id, 'nda_sent', 'nda_signed' from repaired;
  perform set_config('request.jwt.claim.role', coalesce(previous_role, ''), true);
end $$;

-- Signing updates the agreement and stage in one transaction. Check at commit,
-- not between those writes. Both typed and multi-party signing keep working.
create function public.check_signed_nda_stage_consistency() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'deal_ndas' then target := new.inquiry_id;
  else target := new.id;
  end if;
  perform 1 from public.deal_inquiries where id = target for update;
  if exists (
    select 1 from public.deal_inquiries i join public.deal_ndas n on n.inquiry_id = i.id
    where i.id = target and i.status = 'nda_sent' and n.status = 'signed'
      and n.buyer_id = i.buyer_id and n.broker_id = i.broker_id
  ) then
    raise exception 'Signed agreement and deal stage must be saved together' using errcode = '23514';
  end if;
  return null;
end $$;
revoke all on function public.check_signed_nda_stage_consistency() from public, anon, authenticated;
create constraint trigger signed_nda_stage_consistency
after insert or update on public.deal_ndas deferrable initially deferred
for each row execute function public.check_signed_nda_stage_consistency();
create constraint trigger inquiry_signed_nda_stage_consistency
after insert or update on public.deal_inquiries deferrable initially deferred
for each row execute function public.check_signed_nda_stage_consistency();
