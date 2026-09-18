-- Preserve signed agreements and make signing/access changes transactional.
create or replace function public.preserve_signed_deal_nda()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'signed' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Signed agreements cannot be edited; retain the original record';
  end if;
  return new;
end;
$$;
drop trigger if exists preserve_signed_deal_nda on public.deal_ndas;
create trigger preserve_signed_deal_nda before update on public.deal_ndas
  for each row execute function public.preserve_signed_deal_nda();

create or replace function public.complete_deal_nda(
  target_inquiry uuid, expected_nda uuid, expected_version integer,
  legal_name text, fingerprint text, file_sha256 text,
  ip_hash text, locale text default 'en'
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  inquiry public.deal_inquiries%rowtype;
  agreement public.deal_ndas%rowtype;
  signed_time timestamptz := clock_timestamp();
begin
  select * into inquiry from public.deal_inquiries where id = target_inquiry for update;
  if not found or actor is null or actor <> inquiry.buyer_id then
    raise exception 'Only the buyer may sign' using errcode = '42501';
  end if;
  select * into agreement from public.deal_ndas where inquiry_id = target_inquiry for update;
  if not found or agreement.id <> expected_nda or expected_nda is null
     or agreement.template_version is distinct from expected_version
     or agreement.status not in ('sent','viewed')
     or inquiry.status in ('closed','declined') then
    -- Business conflicts must not use 40001: PostgREST retries that SQLSTATE.
    raise exception 'Agreement changed or is no longer available' using errcode = 'P0001';
  end if;
  if legal_name is null or length(trim(legal_name)) not between 2 and 100
     or fingerprint is null or fingerprint !~ '^[a-f0-9]{64}$'
     or (agreement.storage_path is not null and (file_sha256 is null or file_sha256 !~ '^[a-f0-9]{64}$'))
     or locale is null or locale not in ('en','es') then
    raise exception 'Invalid signature details' using errcode = '22023';
  end if;
  update public.deal_ndas set status='signed',signed_at=signed_time,
    signer_name=trim(legal_name),signer_ip_hash=ip_hash,document_fingerprint=fingerprint,
    signature_record=jsonb_build_object('accepted',true,'method','typed_signature',
      'timestamp',signed_time,'signer_user_id',actor,'document_version',agreement.template_version,
      'document_fingerprint',fingerprint,'file_sha256',file_sha256,
      'consent','I have reviewed the complete agreement and agree to sign it electronically.',
      'record_version',2)
    where id=agreement.id;
  if inquiry.status='nda_sent' then
    update public.deal_inquiries set status='nda_signed',updated_at=signed_time where id=target_inquiry;
  end if;
  insert into public.marketplace_audit_events(actor_id,inquiry_id,event_type,details)
    values(actor,target_inquiry,'nda_signed',jsonb_build_object('nda_id',agreement.id,'fingerprint',fingerprint));
  insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)
    values(inquiry.broker_id,target_inquiry,'nda_signed','NDA signed',
      'The buyer signed the agreement. Review the signing record in your workspace.',
      '/'||locale||'/dashboard/deals/'||target_inquiry::text);
end;
$$;
revoke all on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) from public,anon;
grant execute on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) to authenticated;

create or replace function public.change_deal_document_access(
  target_document uuid, expected_access text, new_access text
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  document public.deal_room_documents%rowtype;
begin
  select * into document from public.deal_room_documents where id=target_document for update;
  if not found or actor is null or actor <> document.uploaded_by
     or not exists(select 1 from public.deal_inquiries i where i.id=document.inquiry_id and i.broker_id=actor) then
    raise exception 'Only the owning broker may change sharing' using errcode='42501';
  end if;
  if expected_access is null or document.access_level <> expected_access or not document.is_active then
    raise exception 'Document changed; refresh before retrying' using errcode='P0001';
  end if;
  if new_access is null or new_access not in ('broker_only','approved','nda_signed') then
    raise exception 'Invalid access level' using errcode='22023';
  end if;
  if new_access=expected_access then return; end if;
  update public.deal_room_documents set access_level=new_access,
    permission_note=case new_access when 'broker_only' then 'Broker only'
      when 'approved' then 'Buyer access requires broker approval' else 'Available after NDA' end
    where id=target_document;
  insert into public.marketplace_audit_events(actor_id,inquiry_id,event_type,details)
    values(actor,document.inquiry_id,'document_access_changed',
      jsonb_build_object('document_id',target_document,'previous',expected_access,'access',new_access));
end;
$$;
revoke all on function public.change_deal_document_access(uuid,text,text) from public,anon;
grant execute on function public.change_deal_document_access(uuid,text,text) to authenticated;
