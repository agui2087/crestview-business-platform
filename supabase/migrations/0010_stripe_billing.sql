create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  product_code text not null,
  stripe_price_id text not null,
  status text not null,
  quantity integer not null default 1 check (quantity > 0),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  active boolean not null default false,
  quantity integer not null default 0 check (quantity >= 0),
  expires_at timestamptz,
  source_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_code)
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id, status, updated_at desc);
create index if not exists billing_entitlements_user_idx
  on public.billing_entitlements (user_id, active);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy "billing_customers_self_read" on public.billing_customers
  for select using (user_id = auth.uid());
create policy "billing_subscriptions_self_read" on public.billing_subscriptions
  for select using (user_id = auth.uid());
create policy "billing_entitlements_self_read" on public.billing_entitlements
  for select using (user_id = auth.uid());

grant select on public.billing_customers to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_entitlements to authenticated;

revoke all on public.stripe_webhook_events from anon, authenticated;

create or replace function public.apply_stripe_billing_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid default null,
  p_customer_id text default null,
  p_subscription_id text default null,
  p_product_code text default null,
  p_price_id text default null,
  p_status text default null,
  p_quantity integer default 1,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_entitlement_active boolean default false,
  p_entitlement_operation text default 'none',
  p_entitlement_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_id is null or p_event_type is null then
    raise exception 'Stripe event identity is required';
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (stripe_event_id) do nothing;

  if not found then
    return false;
  end if;

  if p_user_id is null then
    return true;
  end if;

  if p_customer_id is not null then
    insert into public.billing_customers (
      user_id,
      stripe_customer_id,
      updated_at
    )
    values (
      p_user_id,
      p_customer_id,
      now()
    )
    on conflict (user_id) do update
      set stripe_customer_id = excluded.stripe_customer_id,
          updated_at = now();
  end if;

  if p_subscription_id is not null then
    if p_product_code is null or p_price_id is null or p_status is null then
      raise exception 'Subscription billing details are incomplete';
    end if;

    insert into public.billing_subscriptions (
      stripe_subscription_id,
      user_id,
      stripe_customer_id,
      product_code,
      stripe_price_id,
      status,
      quantity,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    values (
      p_subscription_id,
      p_user_id,
      p_customer_id,
      p_product_code,
      p_price_id,
      p_status,
      greatest(p_quantity, 1),
      p_current_period_end,
      p_cancel_at_period_end,
      now()
    )
    on conflict (stripe_subscription_id) do update
      set stripe_customer_id = excluded.stripe_customer_id,
          product_code = excluded.product_code,
          stripe_price_id = excluded.stripe_price_id,
          status = excluded.status,
          quantity = excluded.quantity,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end,
          updated_at = now();
  end if;

  if p_entitlement_operation = 'set' then
    if p_product_code is null then
      raise exception 'Entitlement product code is required';
    end if;

    insert into public.billing_entitlements (
      user_id,
      product_code,
      active,
      quantity,
      expires_at,
      source_event_id,
      updated_at
    )
    values (
      p_user_id,
      p_product_code,
      p_entitlement_active,
      case when p_entitlement_active then greatest(p_quantity, 1) else 0 end,
      p_entitlement_expires_at,
      p_event_id,
      now()
    )
    on conflict (user_id, product_code) do update
      set active = excluded.active,
          quantity = excluded.quantity,
          expires_at = excluded.expires_at,
          source_event_id = excluded.source_event_id,
          updated_at = now();
  elsif p_entitlement_operation = 'increment' then
    if p_product_code is null or not p_entitlement_active then
      raise exception 'A paid entitlement is required for increment';
    end if;

    insert into public.billing_entitlements (
      user_id,
      product_code,
      active,
      quantity,
      expires_at,
      source_event_id,
      updated_at
    )
    values (
      p_user_id,
      p_product_code,
      true,
      greatest(p_quantity, 1),
      p_entitlement_expires_at,
      p_event_id,
      now()
    )
    on conflict (user_id, product_code) do update
      set active = true,
          quantity = public.billing_entitlements.quantity + excluded.quantity,
          expires_at = case
            when excluded.expires_at is null then public.billing_entitlements.expires_at
            when public.billing_entitlements.expires_at is null then excluded.expires_at
            else greatest(public.billing_entitlements.expires_at, excluded.expires_at)
          end,
          source_event_id = excluded.source_event_id,
          updated_at = now();
  elsif p_entitlement_operation <> 'none' then
    raise exception 'Unsupported entitlement operation';
  end if;

  return true;
end;
$$;

revoke all on function public.apply_stripe_billing_event(
  text, text, uuid, text, text, text, text, text, integer,
  timestamptz, boolean, boolean, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_stripe_billing_event(
  text, text, uuid, text, text, text, text, text, integer,
  timestamptz, boolean, boolean, text, timestamptz
) to service_role;
