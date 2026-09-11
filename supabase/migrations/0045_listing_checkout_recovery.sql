-- Close only an old, still-unbound reservation after the server has checked
-- Stripe for a matching session. No browser role may call this operation.
create function public.expire_unbound_listing_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.listing_product_orders set status='expired'
  where id=p_order_id and status='pending' and checkout_session_id is null
    and checkout_expires_at < now()-interval '1 minute';
  return found;
end; $$;
revoke all on function public.expire_unbound_listing_order(uuid) from public,anon,authenticated;
grant execute on function public.expire_unbound_listing_order(uuid) to service_role;

-- Active rights are independent of the paginated purchase history. JSON avoids
-- the API row limit hiding older single-listing licenses for large accounts.
create function public.my_current_listing_orders() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'listing_id',o.listing_id,
    'product_code',o.product_code,'status',o.status,'ends_at',o.ends_at,'created_at',o.created_at)
    order by o.created_at desc),'[]'::jsonb)
  from public.listing_product_orders o where o.user_id=auth.uid()
    and (o.status='pending' or (o.status='paid' and (o.ends_at is null or o.ends_at>now())))
$$;
revoke all on function public.my_current_listing_orders() from public,anon,authenticated;
grant execute on function public.my_current_listing_orders() to authenticated;

create function public.fail_listing_product_checkout(p_order_id uuid,p_session_id text,p_user_id uuid,
  p_listing_id uuid,p_customer_id text,p_product_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.listing_product_orders%rowtype;
begin
  select * into o from public.listing_product_orders where id=p_order_id for update;
  if not found or o.user_id is distinct from p_user_id or o.listing_id is distinct from p_listing_id
    or o.customer_id is distinct from p_customer_id or o.product_code is distinct from p_product_code
    or p_session_id is null or p_session_id not like 'cs_%'
    or (o.checkout_session_id is not null and o.checkout_session_id<>p_session_id) then
    raise exception 'Failed checkout identity mismatch';
  end if;
  update public.listing_product_orders set status='expired',checkout_session_id=p_session_id
    where id=o.id and status='pending';
  return found;
end; $$;
revoke all on function public.fail_listing_product_checkout(uuid,text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.fail_listing_product_checkout(uuid,text,uuid,uuid,text,text) to service_role;

create function public.clear_my_listing_promotion_activity() returns void
language sql security definer set search_path='' as $$
  delete from public.listing_promotion_engagement where viewer_id=auth.uid()
$$;
revoke all on function public.clear_my_listing_promotion_activity() from public,anon,authenticated;
grant execute on function public.clear_my_listing_promotion_activity() to authenticated;

-- Opportunistic cleanup runs whenever an owner loads promotion reporting.
-- Schedule the same deletion separately for a strict wall-clock retention SLA.
create or replace function public.my_listing_promotion_metrics()
returns table(order_id uuid,day date,views bigint,engagements bigint)
language plpgsql security definer set search_path='' as $$
begin
  delete from public.listing_promotion_engagement e where e.day < (now() at time zone 'UTC')::date-90;
  return query select e.order_id,e.day,count(*) filter(where e.kind='view'),count(*) filter(where e.kind='engagement')
    from public.listing_promotion_engagement e join public.listing_product_orders o on o.id=e.order_id
    where o.user_id=auth.uid() group by e.order_id,e.day order by e.day desc;
end; $$;
