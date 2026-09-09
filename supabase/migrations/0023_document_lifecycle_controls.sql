create table if not exists public.document_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('vault','deal_room','listing_nda')),
  resource_id uuid null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  status text not null default 'reserved' check (status in ('reserved','committed','rejected')),
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists document_upload_events_user_created_idx
  on public.document_upload_events(user_id, created_at desc);

alter table public.document_upload_events enable row level security;
revoke all on public.document_upload_events from anon, authenticated;

alter table public.vault_documents
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists retention_until timestamptz null;

alter table public.deal_room_documents
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists retention_until timestamptz null;

create or replace function public.reserve_document_upload(
  p_user_id uuid,
  p_scope text,
  p_resource_id uuid,
  p_size_bytes bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_id uuid;
  recent_uploads integer;
  stored_files integer;
  stored_bytes bigint;
begin
  if p_user_id is null or (p_user_id <> auth.uid() and auth.role() <> 'service_role') then
    raise exception 'Unauthorized upload reservation';
  end if;
  if p_scope not in ('vault','deal_room','listing_nda') or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'Invalid upload reservation';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select count(*) into recent_uploads from public.document_upload_events
    where user_id = p_user_id and created_at > now() - interval '1 hour' and status <> 'rejected';
  if recent_uploads >= 20 then raise exception 'Hourly document upload limit reached'; end if;

  select
    (select count(*) from public.vault_documents where owner_id = p_user_id)
      + (select count(*) from public.deal_room_documents where uploaded_by = p_user_id and is_active),
    coalesce((select sum(size_bytes) from public.vault_documents where owner_id = p_user_id), 0)
      + coalesce((select sum(file_size_bytes) from public.deal_room_documents where uploaded_by = p_user_id and is_active), 0)
  into stored_files, stored_bytes;

  if stored_files >= 250 then raise exception 'Document count limit reached'; end if;
  if stored_bytes + p_size_bytes > 1073741824 then raise exception 'Document storage limit reached'; end if;

  insert into public.document_upload_events(user_id, scope, resource_id, size_bytes)
  values (p_user_id, p_scope, p_resource_id, p_size_bytes)
  returning id into reservation_id;
  return reservation_id;
end;
$$;

create or replace function public.finish_document_upload(p_reservation_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('committed','rejected') then raise exception 'Invalid upload status'; end if;
  update public.document_upload_events
    set status = p_status, finished_at = now()
    where id = p_reservation_id
      and (user_id = auth.uid() or auth.role() = 'service_role')
      and status = 'reserved';
  if not found then raise exception 'Upload reservation not found'; end if;
end;
$$;

revoke all on function public.reserve_document_upload(uuid,text,uuid,bigint) from public, anon;
revoke all on function public.finish_document_upload(uuid,text) from public, anon;
grant execute on function public.reserve_document_upload(uuid,text,uuid,bigint) to authenticated, service_role;
grant execute on function public.finish_document_upload(uuid,text) to authenticated, service_role;

comment on table public.document_upload_events is
  'Security ledger used for atomic per-user document throttling and quota enforcement. Retain for 24 months.';
comment on column public.document_upload_events.status is
  'Reserved uploads automatically stop affecting the hourly throttle after one hour. Rejected records remain as security evidence.';
comment on column public.vault_documents.retention_until is
  'Optional owner- or policy-selected deletion date. Null means retain until the owner deletes the document.';
comment on column public.deal_room_documents.retention_until is
  'Optional deal-room retention date. Null means retain while the deal record remains active.';
