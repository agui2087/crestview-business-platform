-- Deploy before exact-seat checkout. Preserve fulfillment permissions and existing data.
begin;
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.apply_stripe_subscription_event(text,text,bigint,uuid,text,text,text,text,text,integer,timestamptz,boolean)'::regprocedure) into definition;
  if position('p_quantity not in (10,25,50,100,200,300)' in definition)>0 then
    execute replace(definition,'p_quantity not in (10,25,50,100,200,300)','p_quantity > 99999');
  elsif position('p_quantity > 99999' in definition)=0 then
    raise exception 'Unexpected subscription validation definition; review before applying exact seats';
  end if;
end $migration$;
commit;
