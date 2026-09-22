-- A replacement is a newly screened private upload, never an overwrite of bytes.
alter table public.deal_room_documents
  add column if not exists replaces_document_id uuid references public.deal_room_documents(id),
  add column if not exists replacement_note text,
  add column if not exists superseded_at timestamptz;
create unique index if not exists deal_document_single_replacement
  on public.deal_room_documents(replaces_document_id) where replaces_document_id is not null;

create or replace function public.guard_deal_document_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      if new.replaces_document_id is not null or new.version<>1 or new.superseded_at is not null then
        raise exception 'Use the verified replacement workflow' using errcode='42501';
      end if;
    elsif (new.storage_path,new.external_url,new.mime_type,new.original_filename,new.file_size_bytes,
           new.version,new.replaces_document_id,new.replacement_note,new.superseded_at,new.is_active)
       is distinct from
          (old.storage_path,old.external_url,old.mime_type,old.original_filename,old.file_size_bytes,
           old.version,old.replaces_document_id,old.replacement_note,old.superseded_at,old.is_active) then
      raise exception 'Document file and revision fields require the verified replacement workflow' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_deal_document_revision before insert or update on public.deal_room_documents
  for each row execute function public.guard_deal_document_revision();

create or replace function public.replace_deal_document(
  p_original uuid,p_candidate uuid,p_version integer,p_access text,p_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  original public.deal_room_documents%rowtype;
  candidate public.deal_room_documents%rowtype;
  actor uuid:=auth.uid();
begin
  if actor is null or p_original=p_candidate then raise exception 'Invalid replacement' using errcode='42501'; end if;
  -- Deterministic locking makes simultaneous replacement attempts serialize.
  perform id from public.deal_room_documents where id in (p_original,p_candidate) order by id for update;
  select * into original from public.deal_room_documents where id=p_original;
  select * into candidate from public.deal_room_documents where id=p_candidate;
  if original.id is null or candidate.id is null or original.uploaded_by<>actor or candidate.uploaded_by<>actor
    or original.inquiry_id<>candidate.inquiry_id
    or not exists(select 1 from public.deal_inquiries where id=original.inquiry_id and broker_id=actor) then
    raise exception 'Only the owning broker can replace a document in this deal' using errcode='42501';
  end if;
  if not original.is_active or original.version is distinct from p_version or original.access_level is distinct from p_access
    or not candidate.is_active or candidate.access_level<>'broker_only' or candidate.version<>1
    or candidate.replaces_document_id is not null or candidate.superseded_at is not null then
    raise exception 'Document changed; refresh before replacing it' using errcode='P0001';
  end if;
  if candidate.storage_path is null or candidate.storage_path is not distinct from original.storage_path
    or candidate.external_url is not null or candidate.security_status not in ('basic_validated','malware_scanned') then
    raise exception 'A separately screened uploaded file is required' using errcode='22023';
  end if;
  if length(trim(coalesce(p_note,''))) not between 3 and 500 then
    raise exception 'Describe what changed in 3 to 500 characters' using errcode='22023';
  end if;
  update public.deal_room_documents set is_active=false,superseded_at=now() where id=p_original;
  update public.deal_room_documents set replaces_document_id=p_original,version=original.version+1,
    replacement_note=trim(p_note),title=original.title,category=original.category,
    access_level=original.access_level,permission_note=original.permission_note where id=p_candidate;
  update public.deal_document_requests set document_id=p_candidate
    where inquiry_id=original.inquiry_id and document_id=p_original;
  insert into public.marketplace_audit_events(actor_id,inquiry_id,event_type,details)
    values(actor,original.inquiry_id,'document_replaced',jsonb_build_object('document_id',p_candidate,
      'previous_document_id',p_original,'version',original.version+1));
end;
$$;
revoke all on function public.replace_deal_document(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.replace_deal_document(uuid,uuid,integer,text,text) to authenticated;

-- Archived originals stay private to the broker. Buyers cannot bypass the UI
-- by asking the database or storage API for a superseded record.
create policy "active buyer document revisions" on public.deal_room_documents
  as restrictive for select to authenticated using (
    is_active or exists(select 1 from public.deal_inquiries where id=inquiry_id and broker_id=auth.uid())
  );
create policy "retain document revision records" on public.deal_room_documents
  as restrictive for delete to authenticated using (false);
create policy "retain referenced room files" on storage.objects
  as restrictive for delete to authenticated using (
    bucket_id<>'deal-files' or not exists(select 1 from public.deal_room_documents d where d.storage_path=name)
  );
create policy "active room file revisions" on storage.objects
  as restrictive for select to authenticated using (
    bucket_id<>'deal-files' or not exists(select 1 from public.deal_room_documents d where d.storage_path=name)
    or exists(select 1 from public.deal_room_documents d join public.deal_inquiries i on i.id=d.inquiry_id
      where d.storage_path=name and (d.is_active or i.broker_id=auth.uid()))
  );
create policy "replacement audit follows current visibility" on public.marketplace_audit_events
  as restrictive for select to authenticated using (
    event_type<>'document_replaced' or actor_id=auth.uid()
    or exists(select 1 from public.deal_room_documents d where d.id::text=details->>'document_id' and d.inquiry_id=marketplace_audit_events.inquiry_id)
  );
