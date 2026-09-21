-- Optional fields store an explicit empty string; required legacy fields stay required.
create or replace function public.record_nda_signature(actor uuid,target_nda uuid,expected_layout jsonb,expected_count integer,legal_name text,own_values jsonb,appearance jsonb,completed_at timestamptz,output_path text,output_sha256 text,fingerprint text,locale text) returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype; c public.deal_nda_controls%rowtype; role_name text; first_role text; total integer; needed integer; merged jsonb; buyer_name text; other_actor uuid;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 select * into n from public.deal_ndas where id=target_nda;
 if not found then raise exception 'Agreement unavailable'; end if;
 perform 1 from public.deal_inquiries where id=n.inquiry_id and status not in('closed','declined') for update;
 if not found then raise exception 'Deal unavailable'; end if;
 select * into n from public.deal_ndas where id=target_nda for update;
 if n.status not in('sent','viewed') or n.signing_layout is null or n.signing_layout is distinct from expected_layout then raise exception 'Agreement changed or unavailable'; end if;
 select * into c from public.deal_nda_controls where nda_id=n.id;
 if c.withdrawn_at is not null or c.expires_at<=clock_timestamp() then raise exception 'Request expired or withdrawn'; end if;
 role_name:=case when actor=n.buyer_id then 'buyer' when actor=n.broker_id then 'broker' else null end;
 if role_name is null or n.buyer_id=n.broker_id or not exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where coalesce(f->>'role','buyer')=role_name and f->>'type'='signature') then raise exception 'Not an assigned signer'; end if;
 select count(*) into total from public.deal_nda_signatures where nda_id=n.id;
 if total is distinct from expected_count or exists(select 1 from public.deal_nda_signatures where nda_id=n.id and role=role_name) then raise exception 'Signature state changed; refresh'; end if;
 first_role:=case when n.signing_layout->>'order'='broker_first' then 'broker' else 'buyer' end;
 if coalesce(n.signing_layout->>'order','buyer_first')<>'any' and role_name<>first_role and exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where coalesce(f->>'role','buyer')=first_role) and not exists(select 1 from public.deal_nda_signatures where nda_id=n.id and role=first_role) then raise exception 'Wait for the preceding signer'; end if;
 if legal_name is null or length(trim(legal_name)) not between 2 and 100 or jsonb_typeof(own_values) is distinct from 'object' or jsonb_typeof(appearance) is distinct from 'object' or coalesce(appearance->>'mode','') not in('typed','drawn','uploaded') or length(appearance::text)>250000 or completed_at is null or abs(extract(epoch from clock_timestamp()-completed_at))>300 or locale is null or locale not in('en','es') then raise exception 'Invalid signature'; end if;
 if exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where coalesce(f->>'role','buyer')=role_name and (jsonb_typeof(own_values->(f->>'id')) is distinct from 'string' or length(trim(own_values->>(f->>'id'))) not between case when f->>'required'='false' then 0 else 1 end and 100)) or exists(select 1 from jsonb_object_keys(own_values) k where not exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where f->>'id'=k and coalesce(f->>'role','buyer')=role_name)) then raise exception 'Invalid assigned fields'; end if;
 insert into public.deal_nda_signatures values(n.id,role_name,actor,trim(legal_name),own_values,appearance,completed_at);
 insert into public.deal_nda_events(nda_id,actor_id,event_type,details) values(n.id,actor,'participant_signed',jsonb_build_object('role',role_name,'method',appearance->>'mode'));
 select count(distinct coalesce(f->>'role','buyer')) into needed from jsonb_array_elements(n.signing_layout->'fields') f;
 if total+1=needed then
  if output_path is null or output_sha256 is null or fingerprint is null then raise exception 'Completed PDF required'; end if;
  select jsonb_object_agg(v.key,v.value) into merged from public.deal_nda_signatures s cross join lateral jsonb_each(s.field_values) v where s.nda_id=n.id;
  select s.legal_name into buyer_name from public.deal_nda_signatures s where s.nda_id=n.id and s.role='buyer';
  perform public.complete_visual_nda_single(n.buyer_id,n.id,n.signing_layout,buyer_name,fingerprint,output_path,output_sha256,merged,completed_at,locale);
 else
  if output_path is not null then raise exception 'Do not finalize an incomplete agreement'; end if;
  other_actor:=case when role_name='buyer' then n.broker_id else n.buyer_id end;
  insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href) values(other_actor,n.inquiry_id,'nda_reminder','Your signature is requested','The other party signed. Review the agreement and complete your assigned fields.','/'||locale||'/dashboard/deals/'||n.inquiry_id||'/sign');
 end if;
end; $$;

create or replace function public.complete_visual_nda_single(actor uuid,target_nda uuid,expected_layout jsonb,legal_name text,fingerprint text,output_path text,output_sha256 text,field_values jsonb,completed_at timestamptz,locale text) returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 select * into n from public.deal_ndas where id=target_nda for update;
 if not found or n.buyer_id<>actor or n.signing_layout is null or n.signing_layout is distinct from expected_layout then raise exception 'Agreement changed or unavailable'; end if;
 if output_path not like n.id::text||'/%' or output_sha256!~'^[a-f0-9]{64}$' or completed_at is null or abs(extract(epoch from clock_timestamp()-completed_at))>300 then raise exception 'Invalid completed evidence'; end if;
 if exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where not field_values ? (f->>'id') or length(field_values->>(f->>'id')) not between case when f->>'required'='false' then 0 else 1 end and 100) then raise exception 'Missing field values'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.complete_deal_nda(n.inquiry_id,n.id,n.template_version,legal_name,fingerprint,n.signing_layout->>'sha256',null,locale);
 insert into public.deal_nda_pdf_records values(n.id,output_path,output_sha256,n.signing_layout->>'sha256',field_values,completed_at,n.signing_layout);
end; $$;

