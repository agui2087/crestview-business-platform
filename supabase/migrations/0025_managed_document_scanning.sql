create table if not exists public.document_security_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('vault','deal_room','listing_nda')),
  document_id uuid null,
  actor_id uuid null references auth.users(id) on delete set null,
  status text not null check (status in ('quarantined','basic_validated','malware_scanned','blocked','scan_error')),
  provider text not null,
  sha256 text not null check (length(sha256) = 64),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_security_events_document_created_idx
  on public.document_security_events(document_id, created_at desc);
create index if not exists document_security_events_actor_created_idx
  on public.document_security_events(actor_id, created_at desc);

alter table public.document_security_events enable row level security;
revoke all on public.document_security_events from public, anon, authenticated;

alter table public.vault_documents
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

alter table public.deal_room_documents
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

alter table public.listing_nda_templates
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

comment on table public.document_security_events is
  'Immutable server-only audit trail for document security screening. Retain for 24 months.';
comment on column public.vault_documents.security_status is
  'Downloads are allowed only for basic_validated or malware_scanned documents.';

-- A browser session must never be able to self-assert that a file passed a
-- managed scan. Server actions use the service role after authenticating and
-- authorizing the broker; direct client inserts remain quarantined.
create or replace function public.guard_managed_document_scan_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.security_status := 'quarantined';
    new.scan_provider := null;
    new.scan_completed_at := null;
    new.scan_sha256 := null;
    new.scan_failure_reason := 'Awaiting server-side security screening';
    return new;
  end if;

  if new.security_status is distinct from old.security_status
     or new.scan_provider is distinct from old.scan_provider
     or new.scan_completed_at is distinct from old.scan_completed_at
     or new.scan_sha256 is distinct from old.scan_sha256
     or new.scan_failure_reason is distinct from old.scan_failure_reason then
    raise exception 'Document security fields may only be updated by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_room_scan_fields on public.deal_room_documents;
create trigger guard_deal_room_scan_fields
before insert or update on public.deal_room_documents
for each row execute function public.guard_managed_document_scan_fields();

drop trigger if exists guard_listing_nda_scan_fields on public.listing_nda_templates;
create trigger guard_listing_nda_scan_fields
before insert or update on public.listing_nda_templates
for each row execute function public.guard_managed_document_scan_fields();

drop policy if exists "authorized participants read nda files" on storage.objects;
create policy "authorized participants read nda files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.listing_nda_templates t
      join public.marketplace_listings l on l.id = t.listing_id
      where t.storage_path = name
        and t.security_status in ('basic_validated','malware_scanned')
        and (
          t.broker_id = auth.uid()
          or l.status = 'published'
          or exists (
            select 1 from public.deal_inquiries i
            where i.listing_id = t.listing_id
              and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
          )
        )
    )
  );

drop policy if exists "authorized participants read room files" on storage.objects;
create policy "authorized participants read room files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.deal_room_documents d
      join public.deal_inquiries i on i.id = d.inquiry_id
      where d.storage_path = name
        and d.security_status in ('basic_validated','malware_scanned')
        and (
          i.broker_id = auth.uid()
          or (
            i.buyer_id = auth.uid()
            and (
              (d.access_level = 'approved' and i.financial_access_status = 'approved')
              or (d.access_level = 'nda_signed' and i.status in ('nda_signed','document_review','meeting','offer','closed'))
            )
          )
        )
    )
  );
