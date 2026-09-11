-- Additive: deploy and verify before the webhook caller. No keys or test data.
alter table public.billing_subscriptions add column if not exists last_event_created bigint not null default 0;

create table if not exists public.billing_complimentary_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  expires_at timestamptz not null,
  primary key (user_id, product_code)
);
alter table public.billing_complimentary_grants enable row level security;
revoke all on public.billing_complimentary_grants from public, anon, authenticated;

create or replace function public.apply_stripe_subscription_event(
  p_event_id text, p_event_type text, p_event_created bigint,
  p_user_id uuid, p_customer_id text, p_subscription_id text,
  p_product_code text, p_price_id text, p_status text, p_quantity integer,
  p_current_period_end timestamptz, p_cancel_at_period_end boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  previous public.billing_subscriptions%rowtype;
  current_customer text;
  granted_quantity integer;
  granted_until timestamptz;
  complimentary_until timestamptz;
begin
  if p_event_id is null or p_event_id not like 'evt_%'
    or p_event_type is null or p_event_type not in ('customer.subscription.created','customer.subscription.updated','customer.subscription.deleted')
    or p_event_created is null or p_event_created <= 0 or p_user_id is null
    or p_customer_id is null or p_customer_id not like 'cus_%'
    or p_subscription_id is null or p_subscription_id not like 'sub_%'
    or p_product_code is null or p_product_code not in ('broker_plan','crestview_pro','workforce')
    or p_price_id is null or p_price_id not like 'price_%'
    or p_status is null or p_status not in ('active','trialing','past_due','unpaid','paused','incomplete','incomplete_expired','canceled')
    or p_quantity is null or p_quantity <= 0
    or (p_product_code <> 'workforce' and p_quantity <> 1)
    or (p_product_code = 'workforce' and p_quantity not in (10,25,50,100,200,300))
    or (p_status in ('active','trialing','past_due') and p_current_period_end is null) then
    raise exception 'Invalid subscription event' using errcode = '22023';
  end if;

  -- Serialize all subscriptions for one account before computing its access.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 43));
  select stripe_customer_id into current_customer from public.billing_customers where user_id=p_user_id;
  if current_customer is not null and current_customer <> p_customer_id then
    raise exception 'Billing customer identity mismatch' using errcode = '22023';
  end if;
  select * into previous from public.billing_subscriptions where stripe_subscription_id=p_subscription_id for update;
  if found and (previous.user_id <> p_user_id or previous.stripe_customer_id <> p_customer_id or previous.product_code <> p_product_code) then
    raise exception 'Subscription identity mismatch' using errcode = '22023';
  end if;

  -- Stripe event timestamps have second precision. At equal times only a
  -- terminal state may supersede an existing snapshot. Canceled subscriptions
  -- cannot be revived; resubscription has a different Stripe subscription ID.
  if previous.stripe_subscription_id is not null and (
    previous.status in ('canceled','incomplete_expired')
    or p_event_created < previous.last_event_created
    or (p_event_created = previous.last_event_created and p_status not in ('canceled','incomplete_expired'))
  ) then
    perform public.apply_stripe_billing_event(p_event_id,p_event_type);
    return false;
  end if;

  -- Preserve a separately granted, unexpired broker trial when paid billing
  -- later updates the shared entitlement projection.
  insert into public.billing_complimentary_grants(user_id,product_code,expires_at)
    select user_id,product_code,expires_at from public.billing_entitlements
    where user_id=p_user_id and product_code=p_product_code and active
      and source_event_id like 'broker-trial-code-v2:%' and expires_at > now()
    on conflict (user_id,product_code) do update set expires_at=greatest(public.billing_complimentary_grants.expires_at,excluded.expires_at);

  if not public.apply_stripe_billing_event(
    p_event_id=>p_event_id,p_event_type=>p_event_type,p_user_id=>p_user_id,
    p_customer_id=>p_customer_id,p_subscription_id=>p_subscription_id,
    p_product_code=>p_product_code,p_price_id=>p_price_id,p_status=>p_status,
    p_quantity=>p_quantity,p_current_period_end=>p_current_period_end,
    p_cancel_at_period_end=>p_cancel_at_period_end,p_entitlement_operation=>'none'
  ) then return false; end if;
  update public.billing_subscriptions set last_event_created=p_event_created where stripe_subscription_id=p_subscription_id;

  -- One canceled subscription must not remove another active subscription.
  -- Pick one valid grant rather than combining a quantity from one period with
  -- an unrelated expiry. Larger active Workforce tiers win until their expiry.
  select quantity,current_period_end into granted_quantity,granted_until
    from public.billing_subscriptions
    where user_id=p_user_id and product_code=p_product_code
      and status in ('active','trialing','past_due') and current_period_end>now()
    order by quantity desc,current_period_end desc limit 1;
  select expires_at into complimentary_until from public.billing_complimentary_grants
    where user_id=p_user_id and product_code=p_product_code and expires_at>now();
  if complimentary_until is not null then
    granted_quantity:=greatest(coalesce(granted_quantity,0),1);
    granted_until:=greatest(granted_until,complimentary_until);
  end if;
  insert into public.billing_entitlements(user_id,product_code,active,quantity,expires_at,source_event_id,updated_at)
    values(p_user_id,p_product_code,coalesce(granted_quantity,0)>0,coalesce(granted_quantity,0),granted_until,p_event_id,now())
    on conflict(user_id,product_code) do update set active=excluded.active,quantity=excluded.quantity,
      expires_at=excluded.expires_at,source_event_id=excluded.source_event_id,updated_at=now();
  return true;
end;
$$;
revoke all on function public.apply_stripe_subscription_event(text,text,bigint,uuid,text,text,text,text,text,integer,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.apply_stripe_subscription_event(text,text,bigint,uuid,text,text,text,text,text,integer,timestamptz,boolean) to service_role;
