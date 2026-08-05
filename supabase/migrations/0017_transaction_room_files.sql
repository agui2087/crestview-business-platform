alter table public.deal_room_documents
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

create table if not exists public.deal_document_requests (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  note text,
  status text not null default 'requested'
    check (status in ('requested','fulfilled','not_available')),
  document_id uuid references public.deal_room_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (inquiry_id, item_name)
);

create index if not exists deal_document_requests_inquiry_idx
  on public.deal_document_requests(inquiry_id, status, created_at);

alter table public.deal_document_requests enable row level security;

drop policy if exists "request participants read" on public.deal_document_requests;
create policy "request participants read" on public.deal_document_requests
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

drop policy if exists "buyers create document requests" on public.deal_document_requests;
create policy "buyers create document requests" on public.deal_document_requests
  for insert with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and i.buyer_id = auth.uid()
        and i.status in ('nda_signed','document_review','meeting','offer','closed')
    )
  );

drop policy if exists "brokers resolve document requests" on public.deal_document_requests;
create policy "brokers resolve document requests" on public.deal_document_requests
  for update using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  );

grant select, insert, update on public.deal_document_requests to authenticated;

update storage.buckets set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'deal-files';

drop policy if exists "authorized participants read room files" on storage.objects;
create policy "authorized participants read room files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.deal_room_documents d
      join public.deal_inquiries i on i.id = d.inquiry_id
      where d.storage_path = name
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
