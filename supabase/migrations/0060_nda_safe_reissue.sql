-- One active agreement per deal is retained. Previous unsigned revisions are
-- archived atomically; a recorded signature makes correction/reissue forbidden.
create table public.deal_nda_revisions (
 id uuid primary key default gen_random_uuid(),
 nda_id uuid not null references public.deal_ndas(id) on delete cascade,
 inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
 buyer_id uuid not null references auth.users(id),
 broker_id uuid not null references auth.users(id),
 revision integer not null,
 archived_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(trim(reason)) between 10 and 1000),
 agreement jsonb not null,
 controls jsonb,
 events jsonb not null default '[]'::jsonb,
 original_sha256 text check(original_sha256 is null or original_sha256~'^[a-f0-9]{64}$'),
 unique(nda_id,revision)
);
alter table public.deal_nda_revisions enable row level security;
revoke all on public.deal_nda_revisions from public,anon,authenticated;
grant select on public.deal_nda_revisions to authenticated;
grant select,insert,delete on public.deal_nda_revisions to service_role;
create policy "participants read nda revision history" on public.deal_nda_revisions for select to authenticated
 using(auth.uid() in(buyer_id,broker_id));
create function public.prevent_nda_revision_update() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Archived NDA revisions are immutable'; end; $$;
create trigger immutable_nda_revision before update on public.deal_nda_revisions for each row execute function public.prevent_nda_revision_update();

-- Preserve both existing guards in full, adding a narrowly scoped server-only
-- exception used by the atomic reissue function below.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.require_verified_nda_transition()'::regprocedure) into definition;
 definition:=replace(definition,'if TG_OP=''UPDATE'' and old.status','if TG_OP = ''UPDATE'' and old.status');
 if strpos(definition,'if TG_OP = ''UPDATE'' and old.status')=0 then raise exception 'Unexpected NDA transition guard'; end if;
 definition:=replace(definition,'if TG_OP = ''UPDATE'' and old.status',
  'if not (auth.role() is not distinct from ''service_role'' and coalesce(current_setting(''crestview.nda_reissue'',true),'''')=new.id::text) and TG_OP = ''UPDATE'' and old.status');
 execute definition;
 select pg_get_functiondef('public.guard_nda_layout()'::regprocedure) into definition;
 if strpos(definition,'elsif new.signing_layout is distinct from old.signing_layout then')=0 then raise exception 'Unexpected NDA layout guard'; end if;
 definition:=replace(definition,'elsif new.signing_layout is distinct from old.signing_layout then',
  'elsif new.signing_layout is distinct from old.signing_layout and not (auth.role() is not distinct from ''service_role'' and coalesce(current_setting(''crestview.nda_reissue'',true),'''')=new.id::text) then');
 execute definition;
end; $migration$;

create function public.reissue_nda_request(actor uuid,target_nda uuid,expected_version integer,expected_template_version integer,reason text,old_sha256 text,new_sha256 text,locale text)
returns integer language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype;i public.deal_inquiries%rowtype;t public.listing_nda_templates%rowtype;c jsonb;next_version integer;next_layout jsonb;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 if reason is null or length(trim(reason)) not between 10 and 1000 or locale is null or locale not in('en','es') then raise exception 'Reason required'; end if;
 select * into n from public.deal_ndas where id=target_nda;
 if not found or n.broker_id<>actor then raise exception 'Broker only'; end if;
 select * into i from public.deal_inquiries where id=n.inquiry_id for update;
 if not found or i.status not in('submitted','nda_sent') or i.financial_access_status='approved' then raise exception 'Deal has already progressed'; end if;
 select * into n from public.deal_ndas where id=target_nda for update;
 if n.template_version is distinct from expected_version or n.status not in('sent','viewed','declined') then raise exception 'Request changed or unavailable'; end if;
 if n.signed_at is not null or n.signer_name is not null or n.signature_record<>'{}'::jsonb
  or exists(select 1 from public.deal_nda_signatures where nda_id=n.id)
  or exists(select 1 from public.deal_nda_pdf_records where nda_id=n.id) then raise exception 'A signed request cannot be reissued'; end if;
 if n.storage_path is not null and (old_sha256 is null or old_sha256!~'^[a-f0-9]{64}$' or (n.signing_layout is not null and n.signing_layout->>'sha256' is distinct from old_sha256)) then raise exception 'Original integrity required'; end if;
 select * into t from public.listing_nda_templates where listing_id=i.listing_id for update;
 if not found or t.broker_id<>actor or t.version is distinct from expected_template_version or not t.broker_attested
  or t.security_status not in('basic_validated','malware_scanned') then raise exception 'Reviewed template required'; end if;
 if t.storage_path is not null and (new_sha256 is null or new_sha256!~'^[a-f0-9]{64}$' or (t.signing_layout is not null and t.signing_layout->>'sha256' is distinct from new_sha256)) then raise exception 'Replacement integrity required'; end if;
 if t.storage_path is null and nullif(trim(t.template_body),'') is null then raise exception 'Empty replacement'; end if;
 if (select count(*) from public.deal_nda_revisions where nda_id=n.id)>=50 then raise exception 'Revision limit reached'; end if;
 select to_jsonb(x) into c from public.deal_nda_controls x where nda_id=n.id;
 insert into public.deal_nda_revisions(nda_id,inquiry_id,buyer_id,broker_id,revision,reason,agreement,controls,events,original_sha256)
 values(n.id,n.inquiry_id,n.buyer_id,n.broker_id,n.template_version,trim(reason),to_jsonb(n),c,
  coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at,e.id) from public.deal_nda_events e where e.nda_id=n.id),'[]'::jsonb),old_sha256);
 next_version:=greatest(n.template_version+1,t.version);
 next_layout:=case when t.signing_layout is null then null else jsonb_set(t.signing_layout,'{revision}',to_jsonb(gen_random_uuid()::text)) end;
 perform set_config('crestview.nda_reissue',n.id::text,true);
 update public.deal_ndas set document_name=t.document_name,template_body=t.template_body,storage_path=t.storage_path,
  template_version=next_version,signing_layout=next_layout,status='sent',sent_at=clock_timestamp() where id=n.id;
 perform set_config('crestview.nda_reissue','',true);
 delete from public.deal_nda_controls where nda_id=n.id;
 insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)
 values(n.buyer_id,n.inquiry_id,'nda_reissued','Updated agreement requires review','An unsigned request was replaced. Review the new version and correction reason in your secure workspace.','/'||locale||'/dashboard/deals/'||n.inquiry_id);
 return next_version;
end; $$;
revoke all on function public.reissue_nda_request(uuid,uuid,integer,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reissue_nda_request(uuid,uuid,integer,integer,text,text,text,text) to service_role;

-- REVISION_FILE_PROTECTION: archived originals remain private and retained.
create policy "retain archived nda originals" on storage.objects as restrictive for delete to authenticated using(
 bucket_id<>'deal-files' or not exists(select 1 from public.deal_nda_revisions r where r.agreement->>'storage_path'=name));
create policy "do not replace archived nda originals" on storage.objects as restrictive for update to authenticated using(
 bucket_id<>'deal-files' or not exists(select 1 from public.deal_nda_revisions r where r.agreement->>'storage_path'=name));
