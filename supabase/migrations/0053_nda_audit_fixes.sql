-- The signing RPC already validates the current buyer and locks the agreement.
-- Execute its atomic writes as the owner so ordinary API writes cannot forge
-- signature evidence or omit the audit and notification records.
alter function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) security definer;

create or replace function public.require_verified_nda_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if new.status = 'signed' or new.signed_at is not null
       or new.signer_name is not null or new.signer_ip_hash is not null
       or new.document_fingerprint is not null
       or coalesce(new.signature_record, '{}'::jsonb) <> '{}'::jsonb then
      raise exception 'Use the verified buyer signing workflow' using errcode='42501';
    end if;
  end if;
  if TG_OP = 'UPDATE' and old.status in ('sent','viewed','signed') and
    (new.document_name,new.template_body,new.storage_path,new.template_version)
      is distinct from
    (old.document_name,old.template_body,old.storage_path,old.template_version) then
    raise exception 'Delivered agreement terms cannot be replaced' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger require_verified_nda_transition before insert or update on public.deal_ndas
  for each row execute function public.require_verified_nda_transition();

-- Historical document-added events can contain private draft titles. Keep them
-- available to their author, but require current document visibility for others.
create policy "document audit respects document visibility" on public.marketplace_audit_events
  as restrictive for select to authenticated using (
    event_type <> 'document_added' or actor_id=auth.uid()
    or exists(select 1 from public.deal_room_documents d
      where d.id::text=details->>'document_id' and d.inquiry_id=marketplace_audit_events.inquiry_id)
  );

-- NDA_FILE_POLICY: participants retain access when a listing is paused/sold.
-- Keep the same screened-file requirement; do not depend on their ability to
-- SELECT an unpublished marketplace listing through listing RLS.
drop policy if exists "authorized participants read nda files" on storage.objects;
create policy "authorized participants read nda files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files' and exists (
      select 1 from public.listing_nda_templates t
      where t.storage_path = name
        and t.security_status in ('basic_validated','malware_scanned')
        and (t.broker_id = auth.uid()
          or exists (select 1 from public.marketplace_listings l where l.id=t.listing_id and l.status='published')
          or exists (select 1 from public.deal_inquiries i where i.listing_id=t.listing_id
            and (i.buyer_id=auth.uid() or i.broker_id=auth.uid())))
    )
  );
