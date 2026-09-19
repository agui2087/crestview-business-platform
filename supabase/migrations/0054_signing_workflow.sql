create table public.deal_nda_controls (
  nda_id uuid primary key references public.deal_ndas(id) on delete cascade,
  received_at timestamptz,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  last_reminded_at timestamptz
);
create table public.deal_nda_events (
  id uuid primary key default gen_random_uuid(),
  nda_id uuid not null references public.deal_ndas(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null check(event_type in ('receipt_acknowledged','reminder_sent','expiration_changed','withdrawn','signed')),
  occurred_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'::jsonb
);
create index deal_nda_events_order on public.deal_nda_events(nda_id,occurred_at);
alter table public.deal_nda_controls enable row level security;
alter table public.deal_nda_events enable row level security;
create policy "nda controls participants read" on public.deal_nda_controls for select to authenticated
 using(exists(select 1 from public.deal_ndas n where n.id=nda_id and auth.uid() in (n.buyer_id,n.broker_id)));
create policy "nda events participants read" on public.deal_nda_events for select to authenticated
 using(exists(select 1 from public.deal_ndas n where n.id=nda_id and auth.uid() in (n.buyer_id,n.broker_id)));
revoke all on public.deal_nda_controls,public.deal_nda_events from public,anon,authenticated;
grant select on public.deal_nda_controls,public.deal_nda_events to authenticated;
grant all on public.deal_nda_controls,public.deal_nda_events to service_role;

create function public.manage_deal_nda(target_nda uuid, expected_version integer, operation text, expiry_days integer default null, reason text default null, locale text default 'en')
returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype; c public.deal_nda_controls%rowtype; actor uuid:=auth.uid(); stamp timestamptz:=clock_timestamp(); event_name text;
begin
 select * into n from public.deal_ndas where id=target_nda for update;
 if not found or actor is null or actor not in (n.buyer_id,n.broker_id) then raise exception 'Not a participant' using errcode='42501'; end if;
 if expected_version is distinct from n.template_version or n.status not in ('sent','viewed') then raise exception 'Agreement unavailable or changed' using errcode='P0001'; end if;
 if locale is null or locale not in ('en','es') or operation is null or operation not in ('receipt','remind','expire','withdraw') then raise exception 'Invalid operation' using errcode='22023'; end if;
 if (operation='receipt' and actor<>n.buyer_id) or (operation<>'receipt' and actor<>n.broker_id) then raise exception 'Wrong participant role' using errcode='42501'; end if;
 insert into public.deal_nda_controls(nda_id) values(n.id) on conflict do nothing;
 select * into c from public.deal_nda_controls where nda_id=n.id for update;
 if c.withdrawn_at is not null then raise exception 'Request withdrawn' using errcode='P0001'; end if;
 if exists(select 1 from public.deal_inquiries where id=n.inquiry_id and status in ('closed','declined')) then raise exception 'Deal no longer accepting signatures' using errcode='P0001'; end if;
 if operation='receipt' then
   if c.expires_at<=stamp then raise exception 'Request expired' using errcode='P0001'; end if;
   if c.received_at is not null then return; end if;
   update public.deal_nda_controls set received_at=stamp where nda_id=n.id; event_name:='receipt_acknowledged';
 elsif operation='remind' then
   if c.expires_at<=stamp or c.last_reminded_at>stamp-interval '24 hours' then raise exception 'Reminder unavailable or already sent in last 24 hours' using errcode='P0001'; end if;
   update public.deal_nda_controls set last_reminded_at=stamp where nda_id=n.id; event_name:='reminder_sent';
   insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)
    values(n.buyer_id,n.inquiry_id,'nda_reminder','Agreement awaiting your review','Your broker sent an in-app reminder to review the pending agreement.','/'||locale||'/dashboard/deals/'||n.inquiry_id::text||'#deal-conversation');
 elsif operation='expire' then
   if expiry_days is null or expiry_days not in (0,1,7,14,30) then raise exception 'Invalid expiration' using errcode='22023'; end if;
   update public.deal_nda_controls set expires_at=case when expiry_days=0 then null else stamp+expiry_days*interval '1 day' end where nda_id=n.id; event_name:='expiration_changed';
 else
   if reason is null or length(trim(reason)) not between 10 and 1000 then raise exception 'Withdrawal requires a reason' using errcode='22023'; end if;
   update public.deal_nda_controls set withdrawn_at=stamp,withdrawal_reason=trim(reason) where nda_id=n.id; event_name:='withdrawn';
   insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)
    values(n.buyer_id,n.inquiry_id,'nda_withdrawn','Signature request withdrawn','The broker withdrew this unsigned request. Review the reason in your deal workspace.','/'||locale||'/dashboard/deals/'||n.inquiry_id::text||'#deal-conversation');
 end if;
 insert into public.deal_nda_events(nda_id,actor_id,event_type,occurred_at,details) values(n.id,actor,event_name,stamp,
  case when operation='withdraw' then jsonb_build_object('reason',trim(reason)) when operation='expire' then jsonb_build_object('expires_at',case when expiry_days=0 then null else stamp+expiry_days*interval '1 day' end) else '{}'::jsonb end);
end; $$;
revoke all on function public.manage_deal_nda(uuid,integer,text,integer,text,text) from public,anon;
grant execute on function public.manage_deal_nda(uuid,integer,text,integer,text,text) to authenticated;

-- Keep the existing atomic signing implementation, only callable by the owner.
alter function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) rename to complete_deal_nda_core;
revoke all on function public.complete_deal_nda_core(uuid,uuid,integer,text,text,text,text,text) from public,anon,authenticated;
create function public.complete_deal_nda(target_inquiry uuid, expected_nda uuid, expected_version integer, legal_name text, fingerprint text, file_sha256 text, ip_hash text, locale text default 'en')
returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype; c public.deal_nda_controls%rowtype;
begin
 select * into n from public.deal_ndas where inquiry_id=target_inquiry for update;
 if not found or auth.uid() is null or auth.uid()<>n.buyer_id then raise exception 'Only buyer may sign' using errcode='42501'; end if;
 select * into c from public.deal_nda_controls where nda_id=n.id;
 if c.withdrawn_at is not null or c.expires_at<=clock_timestamp() then raise exception 'Request withdrawn or expired' using errcode='P0001'; end if;
 perform public.complete_deal_nda_core(target_inquiry,expected_nda,expected_version,legal_name,fingerprint,file_sha256,ip_hash,locale);
 insert into public.deal_nda_events(nda_id,actor_id,event_type,details) values(n.id,auth.uid(),'signed',jsonb_build_object('version',expected_version,'fingerprint',fingerprint));
end; $$;
revoke all on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) from public,anon;
grant execute on function public.complete_deal_nda(uuid,uuid,integer,text,text,text,text,text) to authenticated;

-- DELIVERED_FILE_PROTECTION: storage administrators retain controlled recovery
-- and retention access, but ordinary broker credentials cannot erase a delivered
-- original while its agreement record still exists.
create policy "retain delivered nda originals" on storage.objects
 as restrictive for delete to authenticated using (
  bucket_id<>'deal-files' or not exists (
   select 1 from public.deal_ndas n where n.storage_path=name
    and n.status in ('sent','viewed','signed','declined','superseded')
  )
 );
