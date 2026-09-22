-- Save both halves atomically; caller identity is never accepted from the payload.
create or replace function public.save_my_buyer_profile(payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  p public.buyer_preferences;
  f public.buyer_financial_profiles;
  key text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid profile'; end if;
  for key in select jsonb_object_keys(payload) loop
    if key <> all(array['industries','locations','minimum_price','maximum_price','minimum_cash_flow','desired_owner_income','owner_involvement','seller_financing_preferred','experience_level','acquisition_timeline','funding_status','proof_of_funds_status','buyer_summary','risk_tolerance','share_summary','share_experience','available_cash','buyer_injection_percent','illustrative_interest_rate','credit_readiness','share_financial']) then raise exception 'Unexpected field'; end if;
  end loop;
  if not (payload ?& array['industries','locations','minimum_price','maximum_price','minimum_cash_flow','desired_owner_income','owner_involvement','seller_financing_preferred','experience_level','acquisition_timeline','funding_status','proof_of_funds_status','buyer_summary','risk_tolerance','share_summary','share_experience','available_cash','buyer_injection_percent','illustrative_interest_rate','credit_readiness','share_financial']) then raise exception 'Incomplete profile'; end if;
  p := jsonb_populate_record(null::public.buyer_preferences,payload);
  f := jsonb_populate_record(null::public.buyer_financial_profiles,payload);
  if p.proof_of_funds_status is null or p.proof_of_funds_status not in ('available','not_provided')
    or p.acquisition_timeline is null or p.acquisition_timeline not in ('within_90_days','within_6_months','within_12_months','exploring')
    or p.funding_status is null or p.funding_status not in ('cash_ready','prequalified','exploring','seller_financing')
    or length(p.buyer_summary)>3000
    or cardinality(p.industries)>30 or cardinality(p.locations)>30
    or exists(select 1 from unnest(p.industries || p.locations) item where length(item)>100)
    or (p.minimum_price is not null and p.maximum_price is not null and p.minimum_price>p.maximum_price)
  then raise exception 'Invalid buyer preferences'; end if;
  if exists(select 1 from unnest(array[p.minimum_price,p.maximum_price,p.minimum_cash_flow,p.desired_owner_income,f.available_cash]) amount
    where amount < 0 or amount > 1000000000000 or amount <> round(amount,2))
  then raise exception 'Invalid amount'; end if;
  insert into public.buyer_preferences(user_id,industries,locations,minimum_price,maximum_price,minimum_cash_flow,desired_owner_income,owner_involvement,seller_financing_preferred,experience_level,acquisition_timeline,funding_status,proof_of_funds_status,buyer_summary,risk_tolerance,share_summary,share_experience,updated_at)
  values(actor,p.industries,p.locations,p.minimum_price,p.maximum_price,p.minimum_cash_flow,p.desired_owner_income,p.owner_involvement,p.seller_financing_preferred,p.experience_level,p.acquisition_timeline,p.funding_status,p.proof_of_funds_status,p.buyer_summary,p.risk_tolerance,p.share_summary,p.share_experience,now())
  on conflict(user_id) do update set industries=excluded.industries,locations=excluded.locations,minimum_price=excluded.minimum_price,maximum_price=excluded.maximum_price,minimum_cash_flow=excluded.minimum_cash_flow,desired_owner_income=excluded.desired_owner_income,owner_involvement=excluded.owner_involvement,seller_financing_preferred=excluded.seller_financing_preferred,experience_level=excluded.experience_level,acquisition_timeline=excluded.acquisition_timeline,funding_status=excluded.funding_status,proof_of_funds_status=excluded.proof_of_funds_status,buyer_summary=excluded.buyer_summary,risk_tolerance=excluded.risk_tolerance,share_summary=excluded.share_summary,share_experience=excluded.share_experience,updated_at=now();
  insert into public.buyer_financial_profiles(user_id,available_cash,buyer_injection_percent,illustrative_interest_rate,credit_readiness,share_financial,updated_at)
  values(actor,f.available_cash,f.buyer_injection_percent,f.illustrative_interest_rate,f.credit_readiness,f.share_financial,now())
  on conflict(user_id) do update set available_cash=excluded.available_cash,buyer_injection_percent=excluded.buyer_injection_percent,illustrative_interest_rate=excluded.illustrative_interest_rate,credit_readiness=excluded.credit_readiness,share_financial=excluded.share_financial,updated_at=now();
end;
$$;
revoke all on function public.save_my_buyer_profile(jsonb) from public,anon;
grant execute on function public.save_my_buyer_profile(jsonb) to authenticated;

