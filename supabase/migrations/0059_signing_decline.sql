alter table public.deal_nda_controls add column declined_at timestamptz,add column declined_by uuid references auth.users(id),add column decline_reason text;
alter table public.deal_nda_events drop constraint deal_nda_events_event_type_check;
alter table public.deal_nda_events add constraint deal_nda_events_event_type_check check(event_type in('receipt_acknowledged','reminder_sent','expiration_changed','withdrawn','signed','participant_signed','declined'));
create function public.decline_nda_request(actor uuid,target_nda uuid,expected_version integer,reason text,locale text)
returns void language plpgsql security definer set search_path='' as $$
declare n public.deal_ndas%rowtype;c public.deal_nda_controls%rowtype;stamp timestamptz:=clock_timestamp();other_actor uuid;
begin
 if auth.role() is distinct from 'service_role' or actor is null then raise exception 'Server only'; end if;
 if reason is null or length(trim(reason)) not between 10 and 1000 or locale is null or locale not in ('en','es') then raise exception 'Reason required'; end if;
 select * into n from public.deal_ndas where id=target_nda;
 if not found or actor not in(n.buyer_id,n.broker_id) then raise exception 'Not a participant'; end if;
 perform 1 from public.deal_inquiries where id=n.inquiry_id and status not in('closed','declined') for update;
 if not found then raise exception 'Deal unavailable'; end if;
 select * into n from public.deal_ndas where id=target_nda for update;
 if n.status not in('sent','viewed') or n.template_version is distinct from expected_version then raise exception 'Request unavailable'; end if;
 if actor=n.broker_id and (n.signing_layout is null or not exists(select 1 from jsonb_array_elements(n.signing_layout->'fields') f where f->>'role'='broker')) then raise exception 'Not an assigned signer'; end if;
 if exists(select 1 from public.deal_nda_signatures where nda_id=n.id and signer_id=actor) then raise exception 'A recorded signature cannot be declined'; end if;
 select * into c from public.deal_nda_controls where nda_id=n.id;
 if c.withdrawn_at is not null or c.expires_at<=stamp then raise exception 'Request withdrawn or expired'; end if;
 insert into public.deal_nda_controls(nda_id,declined_at,declined_by,decline_reason)values(n.id,stamp,actor,trim(reason))
 on conflict(nda_id) do update set declined_at=excluded.declined_at,declined_by=excluded.declined_by,decline_reason=excluded.decline_reason;
 update public.deal_ndas set status='declined' where id=n.id;
 insert into public.deal_nda_events(nda_id,actor_id,event_type,occurred_at,details)values(n.id,actor,'declined',stamp,jsonb_build_object('reason',trim(reason)));
 other_actor:=case when actor=n.buyer_id then n.broker_id else n.buyer_id end;
 insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)values(other_actor,n.inquiry_id,'nda_declined','Signature request declined','The assigned signer declined. Review the reason in the secure workspace.','/'||locale||'/dashboard/deals/'||n.inquiry_id);
end; $$;
revoke all on function public.decline_nda_request(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.decline_nda_request(uuid,uuid,integer,text,text) to service_role;
