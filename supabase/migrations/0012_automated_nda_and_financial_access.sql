create table if not exists public.listing_nda_templates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.marketplace_listings(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null default 'Confidentiality agreement',
  template_body text not null,
  storage_path text,
  version integer not null default 1,
  auto_send boolean not null default true,
  broker_attested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_inquiries
  add column if not exists financial_access_status text not null default 'not_requested'
    check (financial_access_status in ('not_requested','requested','more_information','approved','declined')),
  add column if not exists financial_request_message text,
  add column if not exists financial_request_timeline text,
  add column if not exists financial_request_capital text,
  add column if not exists financial_requested_at timestamptz,
  add column if not exists financial_decided_at timestamptz;

alter table public.deal_ndas
  add column if not exists template_version integer not null default 1,
  add column if not exists document_fingerprint text;

create index if not exists listing_nda_templates_listing_idx
  on public.listing_nda_templates(listing_id);
create index if not exists deal_inquiries_financial_access_idx
  on public.deal_inquiries(broker_id, financial_access_status, updated_at desc);

alter table public.listing_nda_templates enable row level security;

create policy "published nda templates readable" on public.listing_nda_templates
  for select using (
    broker_id = auth.uid()
    or exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id and l.status = 'published'
    )
    or exists (
      select 1 from public.deal_inquiries i
      where i.listing_id = listing_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

create policy "brokers manage listing nda templates" on public.listing_nda_templates
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

create policy "buyers create matching automated ndas" on public.deal_ndas
  for insert with check (
    buyer_id = auth.uid()
    and exists (
      select 1
      from public.deal_inquiries i
      join public.listing_nda_templates t on t.listing_id = i.listing_id
      where i.id = inquiry_id
        and i.buyer_id = auth.uid()
        and i.broker_id = deal_ndas.broker_id
        and t.auto_send = true
        and t.broker_attested = true
        and t.document_name = deal_ndas.document_name
        and t.template_body = deal_ndas.template_body
        and t.version = deal_ndas.template_version
    )
  );

drop policy if exists "room participants" on public.deal_room_documents;
create policy "room participants" on public.deal_room_documents
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (
          i.broker_id = auth.uid()
          or (access_level = 'approved' and i.financial_access_status = 'approved')
          or (
            access_level = 'nda_signed'
            and i.status in ('nda_signed','document_review','meeting','offer','closed')
          )
        )
    )
  );

grant select, insert, update, delete on public.listing_nda_templates to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-files', 'deal-files', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "brokers upload deal files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authorized participants read nda files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.listing_nda_templates t
      join public.marketplace_listings l on l.id = t.listing_id
      where t.storage_path = name
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

create policy "brokers delete own deal files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
