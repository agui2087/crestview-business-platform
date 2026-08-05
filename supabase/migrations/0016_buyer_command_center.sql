alter table public.buyer_preferences
  add column if not exists desired_owner_income numeric,
  add column if not exists risk_tolerance text not null default 'balanced'
    check (risk_tolerance in ('conservative','balanced','growth')),
  add column if not exists share_summary text not null default 'inquiry'
    check (share_summary in ('private','nda','inquiry')),
  add column if not exists share_experience text not null default 'inquiry'
    check (share_experience in ('private','nda','inquiry'));

create table if not exists public.buyer_financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_cash numeric,
  buyer_injection_percent numeric not null default 15 check (buyer_injection_percent between 5 and 50),
  illustrative_interest_rate numeric not null default 11 check (illustrative_interest_rate between 0 and 30),
  credit_readiness text not null default 'not_provided'
    check (credit_readiness in ('not_provided','building','fair','good','excellent')),
  share_financial text not null default 'nda'
    check (share_financial in ('private','nda','inquiry')),
  updated_at timestamptz not null default now()
);

alter table public.buyer_financial_profiles enable row level security;
create policy "buyer financial profile self select" on public.buyer_financial_profiles
  for select using (user_id = auth.uid());
create policy "buyer financial profile self insert" on public.buyer_financial_profiles
  for insert with check (user_id = auth.uid());
create policy "buyer financial profile self update" on public.buyer_financial_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.buyer_financial_profiles to authenticated;

drop policy if exists "brokers read inquiry buyer preferences" on public.buyer_preferences;

create or replace function public.get_broker_buyer_summary(target_inquiry uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry_row public.deal_inquiries;
  profile_row public.profiles;
  preference_row public.buyer_preferences;
  financial_row public.buyer_financial_profiles;
  nda_complete boolean := false;
  experience_visible boolean := false;
  summary_visible boolean := false;
  financial_visible boolean := false;
begin
  select * into inquiry_row from public.deal_inquiries where id = target_inquiry;
  if inquiry_row.id is null or inquiry_row.broker_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select * into profile_row from public.profiles where user_id = inquiry_row.buyer_id;
  select * into preference_row from public.buyer_preferences where user_id = inquiry_row.buyer_id;
  select * into financial_row from public.buyer_financial_profiles where user_id = inquiry_row.buyer_id;
  select exists(select 1 from public.deal_ndas where inquiry_id = target_inquiry and status = 'signed') into nda_complete;

  experience_visible := preference_row.share_experience = 'inquiry' or (preference_row.share_experience = 'nda' and nda_complete);
  summary_visible := preference_row.share_summary = 'inquiry' or (preference_row.share_summary = 'nda' and nda_complete);
  financial_visible := financial_row.share_financial = 'inquiry' or (financial_row.share_financial = 'nda' and nda_complete);

  return jsonb_build_object(
    'display_name', profile_row.display_name,
    'verification_status', coalesce(profile_row.verification_status, 'unverified'),
    'buyer_summary', case when summary_visible then preference_row.buyer_summary else null end,
    'experience_level', case when experience_visible then preference_row.experience_level else null end,
    'acquisition_timeline', case when experience_visible then preference_row.acquisition_timeline else null end,
    'funding_status', case when financial_visible then preference_row.funding_status else null end,
    'proof_of_funds_status', case when financial_visible then preference_row.proof_of_funds_status else null end,
    'available_cash', case when financial_visible then financial_row.available_cash else null end,
    'credit_readiness', case when financial_visible then financial_row.credit_readiness else null end,
    'financial_visibility', coalesce(financial_row.share_financial, 'private'),
    'nda_complete', nda_complete,
    'labels', jsonb_build_object(
      'profile', 'Buyer provided',
      'verification', 'Crestview account status',
      'financial', 'Buyer provided; not lender verified'
    )
  );
end;
$$;

grant execute on function public.get_broker_buyer_summary(uuid) to authenticated;
