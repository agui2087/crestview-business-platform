-- Transactional outbox. No historical backfill and no automatic external
-- delivery until a verified free-tier sender and worker are configured.
create table public.signing_email_outbox (
 id uuid primary key default gen_random_uuid(),
 nda_id uuid not null references public.deal_ndas(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('invitation','reminder','completed')),
 event_key text not null unique,
 locale text not null default 'en' check(locale in ('en','es')),
 state text not null default 'queued' check(state in ('queued','sending','retry','sent','delivered','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 created_at timestamptz not null default clock_timestamp(),
 available_at timestamptz not null default clock_timestamp(),
 first_attempt_at timestamptz,
 lease_until timestamptz,
 lease_id uuid,
 provider_id text,
 last_error text,
 sent_at timestamptz,
 delivered_at timestamptz
);
create index signing_email_due on public.signing_email_outbox(available_at) where state in ('queued','retry','sending');
create unique index signing_email_provider_id on public.signing_email_outbox(provider_id) where provider_id is not null;
alter table public.signing_email_outbox enable row level security;
revoke all on public.signing_email_outbox from public,anon,authenticated;
grant all on public.signing_email_outbox to service_role;

create function public.enqueue_signing_email() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; kind text; key text;
begin
 if tg_table_name='deal_ndas' then
  if new.status='sent' and (tg_op='INSERT' or old.status is distinct from 'sent') then
   recipient:=case when new.signing_layout->>'order'='broker_first' then new.broker_id else new.buyer_id end;
   insert into public.signing_email_outbox(nda_id,recipient_id,kind,event_key)
   values(new.id,recipient,'invitation','invitation:'||new.id||':'||recipient) on conflict(event_key) do nothing;
  elsif tg_op='UPDATE' and new.status='signed' and old.status is distinct from 'signed' then
   foreach recipient in array array[new.buyer_id,new.broker_id] loop
    insert into public.signing_email_outbox(nda_id,recipient_id,kind,event_key)
    values(new.id,recipient,'completed','completed:'||new.id||':'||recipient) on conflict(event_key) do nothing;
   end loop;
  end if;
 else
  if new.kind not in ('nda_reminder','nda_signature_needed') then return new; end if;
  kind:=case when new.kind='nda_reminder' then 'reminder' else 'invitation' end;
  key:='notification:'||new.id;
  insert into public.signing_email_outbox(nda_id,recipient_id,kind,event_key,locale)
   select n.id,new.user_id,kind,key,case when new.href like '/es/%' then 'es' else 'en' end
   from public.deal_ndas n where n.inquiry_id=new.inquiry_id and n.status in ('sent','viewed')
    and new.user_id in (n.buyer_id,n.broker_id)
   on conflict(event_key) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.enqueue_signing_email() from public,anon,authenticated;
create trigger signing_email_completion after insert or update of status on public.deal_ndas for each row execute function public.enqueue_signing_email();
create trigger signing_email_notification after insert on public.marketplace_notifications for each row execute function public.enqueue_signing_email();

create function public.claim_signing_emails(batch_size integer default 5)
returns setof public.signing_email_outbox language plpgsql security definer set search_path='' as $$
declare used_today integer; used_month integer; quota integer;
begin
 if batch_size is null or batch_size not between 1 and 10 then raise exception 'Invalid batch'; end if;
 -- Serializes quota reservation, not just row claiming. These conservative
 -- caps leave headroom beneath the provider's free tier (100/day, 3000/month).
 perform pg_advisory_xact_lock(57570001);
 update public.signing_email_outbox set state='failed',last_error='reconciliation_required',lease_until=null,lease_id=null
 where state in ('queued','retry','sending') and (attempts>=8 or first_attempt_at<clock_timestamp()-interval '23 hours');
 update public.signing_email_outbox o set state='cancelled',last_error='agreement_unavailable',lease_until=null,lease_id=null
 where o.state in ('queued','retry','sending') and exists(select 1 from public.deal_ndas n left join public.deal_nda_controls c on c.nda_id=n.id
  where n.id=o.nda_id and ((o.kind<>'completed' and (n.status not in ('sent','viewed') or c.withdrawn_at is not null or c.expires_at<=clock_timestamp())) or (o.kind='completed' and n.status<>'signed')));
 select count(*) into used_today from public.signing_email_outbox where first_attempt_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 select count(*) into used_month from public.signing_email_outbox where first_attempt_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 quota:=greatest(0,least(90-used_today,2700-used_month,batch_size));
 return query with candidates as (
  select id from public.signing_email_outbox where state in ('queued','retry','sending') and available_at<=clock_timestamp()
   and (lease_until is null or lease_until<clock_timestamp())
  order by available_at,id for update skip locked limit quota
 ) update public.signing_email_outbox o set state='sending',attempts=o.attempts+1,
  first_attempt_at=coalesce(o.first_attempt_at,clock_timestamp()),lease_until=clock_timestamp()+interval '2 minutes',lease_id=gen_random_uuid()
 from candidates c where o.id=c.id returning o.*;
end; $$;
revoke all on function public.claim_signing_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_signing_emails(integer) to service_role;

create table public.signing_email_delivery_events (
 event_id text primary key,
 outbox_id uuid not null references public.signing_email_outbox(id) on delete cascade,
 occurred_at timestamptz not null,
 code text not null
);
alter table public.signing_email_delivery_events enable row level security;
revoke all on public.signing_email_delivery_events from public,anon,authenticated;
grant all on public.signing_email_delivery_events to service_role;
create function public.record_signing_delivery(event_id text,email_id text,delivery_state text,event_time timestamptz,event_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.signing_email_outbox%rowtype;
begin
 if delivery_state not in ('delivered','failed') or delivery_state is null or event_id is null or length(event_id) not between 1 and 200 or event_time is null or event_code not in ('email.delivered','email.bounced','email.complained','email.failed','email.suppressed') then raise exception 'Invalid delivery event'; end if;
 select * into job from public.signing_email_outbox o where o.provider_id=email_id for update;
 if not found then return false; end if;
 insert into public.signing_email_delivery_events values(event_id,job.id,event_time,event_code) on conflict do nothing;
 if not found then return true; end if;
 -- A late delivered event must never clear a bounce/complaint/suppression.
 if delivery_state='failed' or job.state='sent' then
  update public.signing_email_outbox set state=delivery_state,
   delivered_at=case when delivery_state='delivered' then event_time else delivered_at end,
   last_error=case when delivery_state='failed' then event_code else null end where id=job.id;
 end if;
 return true;
end; $$;
revoke all on function public.record_signing_delivery(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_signing_delivery(text,text,text,timestamptz,text) to service_role;
