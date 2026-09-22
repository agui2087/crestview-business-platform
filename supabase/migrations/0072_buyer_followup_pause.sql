create table public.buyer_followup_preferences (
 inquiry_id uuid primary key references public.deal_inquiries(id) on delete cascade,
 buyer_id uuid not null references auth.users(id) on delete cascade,
 paused boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.buyer_followup_events (
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 paused boolean not null,
 created_at timestamptz not null default now()
);
alter table public.buyer_followup_preferences enable row level security;
alter table public.buyer_followup_events enable row level security;
revoke all on public.buyer_followup_preferences,public.buyer_followup_events from public,anon,authenticated;
grant select,insert,update on public.buyer_followup_preferences to authenticated;
grant select on public.buyer_followup_events to authenticated;
create policy "participants read followup preference" on public.buyer_followup_preferences for select to authenticated using(exists(select 1 from public.deal_inquiries i where i.id=inquiry_id and auth.uid() in(i.buyer_id,i.broker_id)));
create policy "buyer creates followup preference" on public.buyer_followup_preferences for insert to authenticated with check(buyer_id=auth.uid() and exists(select 1 from public.deal_inquiries i where i.id=inquiry_id and i.buyer_id=auth.uid()));
create policy "buyer updates followup preference" on public.buyer_followup_preferences for update to authenticated using(buyer_id=auth.uid()) with check(buyer_id=auth.uid() and exists(select 1 from public.deal_inquiries i where i.id=inquiry_id and i.buyer_id=auth.uid()));
create policy "participants read followup history" on public.buyer_followup_events for select to authenticated using(exists(select 1 from public.deal_inquiries i where i.id=inquiry_id and auth.uid() in(i.buyer_id,i.broker_id)));
create function public.guard_followup_preference() returns trigger language plpgsql set search_path=public as $$ begin
 if tg_op='UPDATE' and (new.inquiry_id<>old.inquiry_id or new.buyer_id<>old.buyer_id) then raise exception 'Followup ownership is immutable'; end if;
 new.updated_at:=now();return new;end;$$;
create trigger guard_followup_preference before insert or update on public.buyer_followup_preferences for each row execute function public.guard_followup_preference();
create function public.record_followup_preference() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if tg_op='INSERT' or new.paused is distinct from old.paused then insert into public.buyer_followup_events(inquiry_id,actor_id,paused) values(new.inquiry_id,auth.uid(),new.paused); end if;
 return new;end;$$;
create trigger record_followup_preference after insert or update on public.buyer_followup_preferences for each row execute function public.record_followup_preference();
revoke all on function public.guard_followup_preference(),public.record_followup_preference() from public,anon,authenticated;
create or replace function public.apply_buyer_notification_preferences() returns trigger language plpgsql security definer set search_path=public as $$
declare prefs public.buyer_notification_preferences;
begin
 if new.kind='message' and exists(select 1 from public.buyer_followup_preferences p where p.inquiry_id=new.inquiry_id and p.buyer_id=new.user_id and p.paused) then return null; end if;
 select * into prefs from public.buyer_notification_preferences where user_id=new.user_id;
 if found and ((new.kind='message' and not prefs.messages) or (new.kind in('document','document_request') and not prefs.documents) or (new.kind='status' and not prefs.deal_status)) then return null; end if;
 return new;
end;$$;
revoke all on function public.apply_buyer_notification_preferences() from public,anon,authenticated;
