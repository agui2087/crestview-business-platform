alter table public.listing_nda_templates add column signing_layout jsonb;
alter table public.deal_ndas add column signing_layout jsonb;

create or replace function public.guard_nda_layout() returns trigger language plpgsql security definer set search_path='' as $$
declare template public.listing_nda_templates%rowtype;
begin
 if TG_TABLE_NAME='listing_nda_templates' then
  if auth.role() is distinct from 'service_role' and ((TG_OP='INSERT' and new.signing_layout is not null) or (TG_OP='UPDATE' and new.signing_layout is distinct from old.signing_layout)) then raise exception 'Use the verified PDF preparation workflow'; end if;
 elsif TG_OP='INSERT' then
  if auth.role() is distinct from 'service_role' and auth.uid()=new.buyer_id and not exists(select 1 from public.listing_nda_templates t join public.deal_inquiries i on i.listing_id=t.listing_id where i.id=new.inquiry_id and t.storage_path is not distinct from new.storage_path and t.version=new.template_version and t.document_name=new.document_name and t.template_body=new.template_body) then raise exception 'Buyer must use the exact delivered template'; end if;
  select t.* into template from public.listing_nda_templates t join public.deal_inquiries i on i.listing_id=t.listing_id where i.id=new.inquiry_id and t.storage_path=new.storage_path and t.version=new.template_version;
  new.signing_layout:=case when found then template.signing_layout else null end;
 elsif new.signing_layout is distinct from old.signing_layout then raise exception 'Delivered signing fields cannot change';
 end if;
 return new;
end; $$;
create trigger guard_nda_template_layout before insert or update on public.listing_nda_templates for each row execute function public.guard_nda_layout();
create trigger snapshot_nda_layout before insert or update on public.deal_ndas for each row execute function public.guard_nda_layout();

create function public.save_nda_layout(actor uuid,target_listing uuid,expected_version integer,layout jsonb) returns void language plpgsql security definer set search_path='' as $$
declare t public.listing_nda_templates%rowtype;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 select * into t from public.listing_nda_templates where listing_id=target_listing for update;
 if not found or t.broker_id<>actor or t.version<>expected_version or t.storage_path is null then raise exception 'Template unavailable or changed'; end if;
 if jsonb_typeof(layout->'fields')<>'array' or jsonb_array_length(layout->'fields') not between 1 and 50 or (layout->>'sha256')!~'^[a-f0-9]{64}$' then raise exception 'Invalid layout'; end if;
 update public.listing_nda_templates set signing_layout=layout,version=version+1,updated_at=clock_timestamp() where id=t.id;
end; $$;
revoke all on function public.save_nda_layout(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_nda_layout(uuid,uuid,integer,jsonb) to service_role;

create table public.deal_nda_pdf_records (
 nda_id uuid primary key references public.deal_ndas(id) on delete cascade,
 storage_path text not null unique,
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 original_sha256 text not null check(original_sha256~'^[a-f0-9]{64}$'),
 field_values jsonb not null,
 completed_at timestamptz not null,
 layout jsonb not null
);
alter table public.deal_nda_pdf_records enable row level security;
create policy "participants read completed pdf evidence" on public.deal_nda_pdf_records for select to authenticated using(exists(select 1 from public.deal_ndas n where n.id=nda_id and auth.uid() in (n.buyer_id,n.broker_id)));
revoke all on public.deal_nda_pdf_records from public,anon,authenticated;
grant select on public.deal_nda_pdf_records to authenticated;
grant all on public.deal_nda_pdf_records to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('signed-agreements','signed-agreements',false,10000000,array['application/pdf']);

-- Require the server-produced completed PDF for prepared agreements. Keep the
-- legacy account-based workflow for agreements delivered without placed fields.
alter function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) rename to complete_deal_nda_workflow;
revoke all on function public.complete_deal_nda_workflow(uuid,uuid,integer,text,text,text,text,text) from public,anon,authenticated;
create function public.complete_deal_nda(target_inquiry uuid,expected_nda uuid,expected_version integer,legal_name text,fingerprint text,file_sha256 text,ip_hash text,locale text default 'en') returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.deal_ndas where inquiry_id=target_inquiry and signing_layout is not null) and auth.role() is distinct from 'service_role' then raise exception 'Complete the placed fields in the PDF signing workflow'; end if;
 perform public.complete_deal_nda_workflow(target_inquiry,expected_nda,expected_version,legal_name,fingerprint,file_sha256,ip_hash,locale);
end; $$;
revoke all on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) from public,anon;
grant execute on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) to authenticated,service_role;

create function public.complete_visual_nda(actor uuid,target_nda uuid,expected_layout jsonb,legal_name text,fingerprint text,output_path text,output_sha256 text,field_values jsonb,completed_at timestamptz,locale text) returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 select * into n from public.deal_ndas where id=target_nda for update;
 if not found or n.buyer_id<>actor or n.signing_layout is null or n.signing_layout is distinct from expected_layout then raise exception 'Agreement changed or unavailable'; end if;
 if output_path not like n.id::text||'/%' or output_sha256!~'^[a-f0-9]{64}$' or completed_at is null or abs(extract(epoch from clock_timestamp()-completed_at))>300 then raise exception 'Invalid completed evidence'; end if;
 if exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where not field_values ? (f->>'id') or length(field_values->>(f->>'id')) not between 1 and 100) then raise exception 'Missing field values'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.complete_deal_nda(n.inquiry_id,n.id,n.template_version,legal_name,fingerprint,n.signing_layout->>'sha256',null,locale);
 insert into public.deal_nda_pdf_records values(n.id,output_path,output_sha256,n.signing_layout->>'sha256',field_values,completed_at,n.signing_layout);
end; $$;
revoke all on function public.complete_visual_nda(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.complete_visual_nda(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) to service_role;
