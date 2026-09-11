-- Listing-scoped delivery. Additive and independent of the staging-only 0028
-- credit routine. Keep the checkout feature gate off until hosted verification.
create table public.listing_product_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  listing_id uuid not null references public.marketplace_listings(id),
  product_code text not null check(product_code in ('single_listing','enhanced_visibility','highest_visibility')),
  price_id text not null check(price_id like 'price_%'),
  customer_id text not null check(customer_id like 'cus_%'),
  status text not null default 'pending' check(status in ('pending','paid','expired','revoked')),
  checkout_session_id text unique,
  payment_intent_id text unique,
  created_at timestamptz not null default now(),
  checkout_expires_at timestamptz not null default date_trunc('second',now())+interval '35 minutes',
  paid_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  revoked_at timestamptz,
  first_event_id text unique
);
create index listing_product_owner_idx on public.listing_product_orders(user_id,created_at desc);
create index listing_product_delivery_idx on public.listing_product_orders(listing_id,status,ends_at);
create unique index listing_product_pending_idx on public.listing_product_orders(listing_id,
  (case when product_code='single_listing' then 'license' else 'promotion' end)) where status='pending';
alter table public.listing_product_orders enable row level security;
revoke all on public.listing_product_orders from public,anon,authenticated;
grant select on public.listing_product_orders to authenticated;
create policy "owners read listing purchases" on public.listing_product_orders for select to authenticated using(user_id=auth.uid());

create function public.listing_publication_days(p_listing_id uuid) returns integer language sql stable security definer set search_path='' as $$
  select case when exists(select 1 from public.listing_product_orders o join public.marketplace_listings l on l.id=o.listing_id and l.broker_id=o.user_id
    where o.listing_id=p_listing_id and o.product_code='single_listing' and o.status='paid' and o.ends_at is null) then 60 else 30 end
$$;
create function public.listing_publication_windows() returns table(listing_id uuid,days integer) language sql stable security definer set search_path='' as $$
  select l.id,public.listing_publication_days(l.id) from public.marketplace_listings l where l.status='published' or l.broker_id=auth.uid()
$$;
revoke all on function public.listing_publication_days(uuid),public.listing_publication_windows() from public,anon,authenticated;
grant execute on function public.listing_publication_windows() to anon,authenticated,service_role;

-- A refund can arrive before the payment event. Preserve the revocation so a
-- later successful-delivery retry cannot re-enable a refunded purchase.
create table public.listing_payment_revocations (
  payment_intent_id text primary key check(payment_intent_id like 'pi_%'),
  event_id text not null,
  reason text not null check(reason in ('refunded','disputed')),
  created_at timestamptz not null default now()
);
alter table public.listing_payment_revocations enable row level security;
revoke all on public.listing_payment_revocations from public,anon,authenticated;

create function public.prepare_listing_product_order(p_user_id uuid,p_listing_id uuid,p_product_code text,p_price_id text,p_customer_id text)
returns public.listing_product_orders language plpgsql security definer set search_path='' as $$
declare l public.marketplace_listings%rowtype; o public.listing_product_orders%rowtype;
begin
  if p_product_code is null or p_product_code not in ('single_listing','enhanced_visibility','highest_visibility')
    or p_price_id is null or p_price_id not like 'price_%' or p_customer_id is null or p_customer_id not like 'cus_%' then
    raise exception 'Invalid listing purchase' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_listing_id::text,44));
  select * into l from public.marketplace_listings where id=p_listing_id and broker_id=p_user_id for update;
  if not found or l.status in ('sold','withdrawn') then raise exception 'Listing unavailable' using errcode='22023'; end if;
  if not exists(select 1 from public.billing_customers where user_id=p_user_id and stripe_customer_id=p_customer_id) then
    raise exception 'Billing identity mismatch' using errcode='22023';
  end if;
  if p_product_code='single_listing' then
    if l.status <> 'draft' or exists(select 1 from public.listing_product_orders where listing_id=l.id and product_code='single_listing' and status='paid')
      or exists(select 1 from public.billing_entitlements where user_id=p_user_id and product_code='broker_plan' and active and (expires_at is null or expires_at>now())) then
      raise exception 'Listing already covered or not a draft' using errcode='22023';
    end if;
    if not exists(select 1 from public.listing_nda_templates where listing_id=l.id and broker_id=p_user_id and broker_attested and auto_send
      and storage_path is not null and security_status in ('basic_validated','malware_scanned')) then
      raise exception 'Reviewed screened NDA required before purchase' using errcode='22023';
    end if;
  else
    if l.status <> 'published' or l.updated_at < now()-public.listing_publication_days(l.id)*interval '1 day' then
      raise exception 'Publish and confirm availability before promotion' using errcode='22023';
    end if;
    if exists(select 1 from public.listing_product_orders where listing_id=l.id and product_code<>'single_listing' and status='paid' and ends_at>now()) then
      raise exception 'Listing already has an active promotion' using errcode='22023';
    end if;
  end if;
  select * into o from public.listing_product_orders where listing_id=l.id and status='pending'
    and (product_code='single_listing')=(p_product_code='single_listing');
  if found then
    if o.product_code<>p_product_code or o.price_id<>p_price_id or o.customer_id<>p_customer_id then
      raise exception 'Finish or expire the existing checkout first' using errcode='22023';
    end if;
    return o;
  end if;
  insert into public.listing_product_orders(user_id,listing_id,product_code,price_id,customer_id)
    values(p_user_id,l.id,p_product_code,p_price_id,p_customer_id) returning * into o;
  return o;
end; $$;

create function public.bind_listing_product_checkout(p_order_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_session_id is null or p_session_id not like 'cs_%' then raise exception 'Invalid checkout'; end if;
  update public.listing_product_orders set checkout_session_id=p_session_id where id=p_order_id
    and (checkout_session_id is null or checkout_session_id=p_session_id);
  if not found then raise exception 'Checkout binding mismatch'; end if;
  return true;
end; $$;

create function public.deliver_listing_product(p_order_id uuid,p_session_id text,p_payment_intent_id text,p_event_id text,
  p_user_id uuid,p_listing_id uuid,p_customer_id text,p_product_code text,p_price_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.listing_product_orders%rowtype; is_revoked boolean;
begin
  if p_session_id is null or p_session_id not like 'cs_%' or p_payment_intent_id is null or p_payment_intent_id not like 'pi_%'
    or p_event_id is null or p_event_id not like 'evt_%' then raise exception 'Invalid payment identity'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_payment_intent_id,45));
  select * into o from public.listing_product_orders where id=p_order_id for update;
  if not found or o.user_id is distinct from p_user_id or o.listing_id is distinct from p_listing_id
    or o.customer_id is distinct from p_customer_id or o.product_code is distinct from p_product_code or o.price_id is distinct from p_price_id
    or (o.checkout_session_id is not null and o.checkout_session_id<>p_session_id)
    or (o.payment_intent_id is not null and o.payment_intent_id<>p_payment_intent_id) then
    raise exception 'Paid listing purchase identity mismatch' using errcode='22023';
  end if;
  if o.status in ('paid','revoked') then return false; end if;
  if o.status='expired' then raise exception 'Payment for expired checkout requires review'; end if;
  if not exists(select 1 from public.marketplace_listings where id=o.listing_id and broker_id=o.user_id) then
    raise exception 'Listing ownership changed';
  end if;
  select exists(select 1 from public.listing_payment_revocations where payment_intent_id=p_payment_intent_id) into is_revoked;
  update public.listing_product_orders set checkout_session_id=p_session_id,payment_intent_id=p_payment_intent_id,first_event_id=p_event_id,
    status=case when is_revoked then 'revoked' else 'paid' end,paid_at=now(),
    starts_at=now(),ends_at=case when product_code='single_listing' then null else now()+interval '30 days' end,
    revoked_at=case when is_revoked then now() else null end where id=o.id;
  return true;
end; $$;

create function public.expire_listing_product_checkout(p_order_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.listing_product_orders set status='expired' where id=p_order_id and status='pending' and checkout_session_id=p_session_id;
  return found;
end; $$;

create function public.revoke_listing_product_payment(p_payment_intent_id text,p_event_id text,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_payment_intent_id is null or p_payment_intent_id not like 'pi_%' or p_event_id is null or p_event_id not like 'evt_%'
    or p_reason is null or p_reason not in ('refunded','disputed') then raise exception 'Invalid revocation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_payment_intent_id,45));
  insert into public.listing_payment_revocations(payment_intent_id,event_id,reason) values(p_payment_intent_id,p_event_id,p_reason)
    on conflict(payment_intent_id) do nothing;
  update public.listing_product_orders set status='revoked',revoked_at=now() where payment_intent_id=p_payment_intent_id and status='paid';
  update public.marketplace_listings l set status='paused' where l.status in ('published','under_offer')
    and exists(select 1 from public.listing_product_orders o where o.listing_id=l.id and o.payment_intent_id=p_payment_intent_id and o.product_code='single_listing')
    and not exists(select 1 from public.billing_entitlements e where e.user_id=l.broker_id and e.product_code='broker_plan' and e.active and (e.expires_at is null or e.expires_at>now()))
    and not exists(select 1 from public.listing_product_orders o where o.listing_id=l.id and o.product_code='single_listing' and o.status='paid' and o.ends_at is null);
  return found;
end; $$;

-- Public reads expose only placement information, never purchase/customer IDs.
create function public.active_listing_promotions()
returns table(listing_id uuid,tier text,ends_at timestamptz) language sql stable security definer set search_path='' as $$
  select o.listing_id,o.product_code,o.ends_at from public.listing_product_orders o
  join public.marketplace_listings l on l.id=o.listing_id and l.broker_id=o.user_id
  where o.status='paid' and o.product_code in ('enhanced_visibility','highest_visibility')
    and o.starts_at<=now() and o.ends_at>now() and l.status='published' and l.updated_at>=now()-public.listing_publication_days(l.id)*interval '1 day'
$$;

create function public.enforce_listing_product_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare covered boolean;
begin
  if TG_OP='UPDATE' and NEW.broker_id<>OLD.broker_id then raise exception 'Listing ownership is immutable'; end if;
  if TG_OP='UPDATE' and NEW.status<>OLD.status and exists(select 1 from public.listing_product_orders where listing_id=NEW.id and status='pending')
    and not (NEW.status='paused' and exists(select 1 from public.listing_product_orders where listing_id=NEW.id and product_code='single_listing' and status='revoked')) then
    raise exception 'Finish or cancel the pending listing checkout before changing status' using errcode='22023';
  end if;
  -- A sold/withdrawn listing permanently consumes its one-listing license.
  if TG_OP='UPDATE' and NEW.status in ('sold','withdrawn') and NEW.status<>OLD.status then
    update public.listing_product_orders set ends_at=coalesce(ends_at,now()) where listing_id=NEW.id and status='paid' and product_code='single_listing';
  end if;
  if NEW.status not in ('published','under_offer') then return NEW; end if;
  if TG_OP='UPDATE' and OLD.status in ('published','under_offer') then return NEW; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.broker_id::text,46));
  select exists(select 1 from public.billing_entitlements where user_id=NEW.broker_id and product_code='broker_plan' and active
    and (expires_at is null or expires_at>now())) or exists(select 1 from public.listing_product_orders
    where user_id=NEW.broker_id and listing_id=NEW.id and product_code='single_listing' and status='paid' and ends_at is null) into covered;
  if not covered then raise exception 'Publishing access is required' using errcode='42501'; end if;
  if not exists(select 1 from public.listing_nda_templates where listing_id=NEW.id and broker_id=NEW.broker_id and broker_attested and auto_send
    and storage_path is not null and security_status in ('basic_validated','malware_scanned')) then
    raise exception 'Reviewed screened NDA required to publish' using errcode='42501';
  end if;
  if (select count(*) from public.marketplace_listings where broker_id=NEW.broker_id and status in ('published','under_offer') and id<>NEW.id)>=100 then
    raise exception 'Active listing limit reached' using errcode='22023';
  end if;
  return NEW;
end; $$;
create trigger listing_product_publication before insert or update on public.marketplace_listings
  for each row execute function public.enforce_listing_product_publication();

revoke all on function public.prepare_listing_product_order(uuid,uuid,text,text,text),
  public.bind_listing_product_checkout(uuid,text), public.deliver_listing_product(uuid,text,text,text,uuid,uuid,text,text,text),
  public.expire_listing_product_checkout(uuid,text), public.revoke_listing_product_payment(text,text,text),
  public.active_listing_promotions(), public.enforce_listing_product_publication() from public,anon,authenticated;
grant execute on function public.prepare_listing_product_order(uuid,uuid,text,text,text),
  public.bind_listing_product_checkout(uuid,text), public.deliver_listing_product(uuid,text,text,text,uuid,uuid,text,text,text),
  public.expire_listing_product_checkout(uuid,text), public.revoke_listing_product_payment(text,text,text) to service_role;
grant execute on function public.active_listing_promotions() to anon,authenticated,service_role;

create table public.listing_promotion_engagement (
  order_id uuid not null references public.listing_product_orders(id),
  viewer_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'UTC')::date,
  kind text not null check(kind in ('view','engagement')),
  primary key(order_id,viewer_id,day,kind)
);
alter table public.listing_promotion_engagement enable row level security;
revoke all on public.listing_promotion_engagement from public,anon,authenticated;
create function public.record_listing_promotion_engagement(p_listing_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); order_key uuid;
begin
  if viewer is null or p_kind is null or p_kind not in ('view','engagement') then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text,47));
  if (select count(*) from public.listing_promotion_engagement where viewer_id=viewer and day=(now() at time zone 'UTC')::date)>=200 then return false; end if;
  select o.id into order_key from public.listing_product_orders o join public.marketplace_listings l on l.id=o.listing_id
    where o.listing_id=p_listing_id and o.user_id<>viewer and o.user_id=l.broker_id and l.status='published'
      and l.updated_at>=now()-public.listing_publication_days(l.id)*interval '1 day' and o.product_code<>'single_listing' and o.status='paid' and o.starts_at<=now() and o.ends_at>now()
    order by o.ends_at desc limit 1;
  if order_key is null then return false; end if;
  insert into public.listing_promotion_engagement(order_id,viewer_id,kind) values(order_key,viewer,p_kind) on conflict do nothing;
  return found;
end; $$;
create function public.my_listing_promotion_metrics()
returns table(order_id uuid,day date,views bigint,engagements bigint) language sql stable security definer set search_path='' as $$
  select e.order_id,e.day,count(*) filter(where e.kind='view'),count(*) filter(where e.kind='engagement')
  from public.listing_promotion_engagement e join public.listing_product_orders o on o.id=e.order_id
  where o.user_id=auth.uid() group by e.order_id,e.day order by e.day desc
$$;
revoke all on function public.record_listing_promotion_engagement(uuid,text),public.my_listing_promotion_metrics() from public,anon,authenticated;
grant execute on function public.record_listing_promotion_engagement(uuid,text),public.my_listing_promotion_metrics() to authenticated;
