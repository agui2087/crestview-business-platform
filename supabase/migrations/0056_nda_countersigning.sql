create table public.deal_nda_signatures (
 nda_id uuid not null references public.deal_ndas(id) on delete cascade,
 role text not null check(role in ('buyer','broker')),
 signer_id uuid not null references auth.users(id),
 legal_name text not null check(length(legal_name) between 2 and 100),
 field_values jsonb not null,
 appearance jsonb not null,
 signed_at timestamptz not null,
 primary key(nda_id,role)
);
alter table public.deal_nda_signatures enable row level security;
create policy "agreement participants read signatures" on public.deal_nda_signatures for select to authenticated using(exists(select 1 from public.deal_ndas n where n.id=nda_id and auth.uid() in(n.buyer_id,n.broker_id)));
revoke all on public.deal_nda_signatures from public,anon,authenticated;
grant select on public.deal_nda_signatures to authenticated;
grant all on public.deal_nda_signatures to service_role;

create table public.nda_layout_presets (
 id uuid primary key default gen_random_uuid(), broker_id uuid not null references auth.users(id),
 name text not null check(length(name) between 2 and 80), layout jsonb not null,
 created_at timestamptz not null default now(), unique(broker_id,name)
);
alter table public.nda_layout_presets enable row level security;
create policy "brokers read own presets" on public.nda_layout_presets for select to authenticated using(broker_id=auth.uid());
revoke all on public.nda_layout_presets from public,anon,authenticated;
grant select on public.nda_layout_presets to authenticated;
grant all on public.nda_layout_presets to service_role;

create function public.save_nda_preset(actor uuid,preset_name text,preset_layout jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or actor is null or preset_name is null or length(trim(preset_name)) not between 2 and 80 or jsonb_typeof(preset_layout) is distinct from 'object' then raise exception 'Invalid preset'; end if;
 perform 1 from auth.users where id=actor for update;
 if not found then raise exception 'Account unavailable'; end if;
 if not exists(select 1 from public.nda_layout_presets where broker_id=actor and name=trim(preset_name)) and (select count(*) from public.nda_layout_presets where broker_id=actor)>=20 then raise exception 'Preset limit reached'; end if;
 insert into public.nda_layout_presets(broker_id,name,layout) values(actor,trim(preset_name),preset_layout) on conflict(broker_id,name) do update set layout=excluded.layout;
end; $$;
revoke all on function public.save_nda_preset(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_nda_preset(uuid,text,jsonb) to service_role;

-- Enrich evidence during the original transition, never edit a signed record.
create function public.record_nda_participant_method() returns trigger language plpgsql set search_path='' as $$
declare participants integer;
begin
 if old.status<>'signed' and new.status='signed' then
  select count(*) into participants from public.deal_nda_signatures where nda_id=new.id;
  if participants>0 then new.signature_record:=new.signature_record||jsonb_build_object('method','account_based_electronic_signature','participant_count',participants,'record_version',3); end if;
 end if;
 return new;
end; $$;
create trigger record_nda_participant_method before update on public.deal_ndas for each row execute function public.record_nda_participant_method();

alter table public.deal_nda_events drop constraint deal_nda_events_event_type_check;
alter table public.deal_nda_events add constraint deal_nda_events_event_type_check check(event_type in('receipt_acknowledged','reminder_sent','expiration_changed','withdrawn','signed','participant_signed'));

-- Retain old buyer-only behavior while making its service entry point reject
-- countersigned layouts. The new transaction alone assembles both signatures.
alter function public.complete_visual_nda(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) rename to complete_visual_nda_single;
revoke all on function public.complete_visual_nda_single(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) from public,anon,authenticated,service_role;
create function public.complete_visual_nda(actor uuid,target_nda uuid,expected_layout jsonb,legal_name text,fingerprint text,output_path text,output_sha256 text,field_values jsonb,completed_at timestamptz,locale text) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(expected_layout->'fields') f where f->>'role'='broker') then raise exception 'Use the participant signing workflow'; end if;
 perform public.complete_visual_nda_single(actor,target_nda,expected_layout,legal_name,fingerprint,output_path,output_sha256,field_values,completed_at,locale);
end; $$;
revoke all on function public.complete_visual_nda(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.complete_visual_nda(uuid,uuid,jsonb,text,text,text,text,jsonb,timestamptz,text) to service_role;

create function public.record_nda_signature(actor uuid,target_nda uuid,expected_layout jsonb,expected_count integer,legal_name text,own_values jsonb,appearance jsonb,completed_at timestamptz,output_path text,output_sha256 text,fingerprint text,locale text) returns void language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where coalesce(f->>'role','buyer')=role_name and (jsonb_typeof(own_values->(f->>'id')) is distinct from 'string' or length(trim(own_values->>(f->>'id'))) not between 1 and 100)) or exists(select 1 from jsonb_object_keys(own_values) k where not exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where f->>'id'=k and coalesce(f->>'role','buyer')=role_name)) then raise exception 'Invalid assigned fields'; end if;
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
revoke all on function public.record_nda_signature(uuid,uuid,jsonb,integer,text,jsonb,jsonb,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_nda_signature(uuid,uuid,jsonb,integer,text,jsonb,jsonb,timestamptz,text,text,text,text) to service_role;
