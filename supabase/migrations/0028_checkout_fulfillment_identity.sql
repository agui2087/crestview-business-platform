-- Additive; deploy before the matching webhook caller. Historical fulfilled
-- sessions must be reconciled before cutover (see billing-hardening.md).
create table public.stripe_checkout_fulfillments (
  checkout_session_id text primary key,
  first_event_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  fulfilled_at timestamptz not null default now()
);
alter table public.stripe_checkout_fulfillments enable row level security;
revoke all on public.stripe_checkout_fulfillments from public, anon, authenticated;

create function public.fulfill_stripe_checkout_payment(
  p_session_id text, p_event_id text, p_event_type text,
  p_user_id uuid, p_customer_id text, p_product_code text,
  p_price_id text, p_quantity integer, p_expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  existing public.stripe_checkout_fulfillments%rowtype;
begin
  if p_session_id is null or p_session_id not like 'cs_%'
    or p_event_id is null or p_event_id not like 'evt_%'
    or p_event_type is null or p_event_type not in
      ('checkout.session.completed','checkout.session.async_payment_succeeded')
    or p_user_id is null or p_customer_id is null or p_price_id is null
    or p_product_code is null or p_product_code not in
      ('single_listing','enhanced_visibility','highest_visibility')
    or p_quantity is null or p_quantity <> 1 then
    raise exception 'Invalid paid Checkout fulfillment' using errcode = '22023';
  end if;

  -- The unique session key serializes competing deliveries in PostgreSQL.
  -- Receipt, event record and entitlement all commit or all roll back.
  insert into public.stripe_checkout_fulfillments
    (checkout_session_id,first_event_id,user_id,product_code)
    values (p_session_id,p_event_id,p_user_id,p_product_code)
    on conflict (checkout_session_id) do nothing;
  if not found then
    select * into existing from public.stripe_checkout_fulfillments
      where checkout_session_id=p_session_id;
    if existing.user_id <> p_user_id or existing.product_code <> p_product_code then
      raise exception 'Checkout fulfillment identity mismatch' using errcode = '22023';
    end if;
    perform public.apply_stripe_billing_event(p_event_id,p_event_type);
    return false;
  end if;

  return public.apply_stripe_billing_event(
    p_event_id => p_event_id, p_event_type => p_event_type,
    p_user_id => p_user_id, p_customer_id => p_customer_id,
    p_product_code => p_product_code, p_price_id => p_price_id,
    p_quantity => p_quantity, p_entitlement_active => true,
    p_entitlement_operation => 'increment', p_entitlement_expires_at => p_expires_at
  );
end;
$$;
revoke all on function public.fulfill_stripe_checkout_payment(
  text,text,text,uuid,text,text,text,integer,timestamptz
) from public, anon, authenticated;
grant execute on function public.fulfill_stripe_checkout_payment(
  text,text,text,uuid,text,text,text,integer,timestamptz
) to service_role;
