alter table public.diligence_items
  add column if not exists phase text not null default 'diligence',
  add column if not exists reason text,
  add column if not exists guidance_source text not null default 'crestview'
    check (guidance_source in ('crestview','broker','buyer','government','professional')),
  add column if not exists source_url text,
  add column if not exists risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high')),
  add column if not exists assigned_role text,
  add column if not exists is_dynamic boolean not null default false;

create table if not exists public.deal_guidance_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  industry_type text not null default 'general',
  purchase_structure text not null default 'asset'
    check (purchase_structure in ('asset','stock','undecided')),
  financing_type text not null default 'sba'
    check (financing_type in ('sba','conventional','seller','cash','undecided')),
  state_code text not null default 'OR',
  has_employees boolean not null default true,
  includes_real_estate boolean not null default false,
  includes_inventory boolean not null default false,
  first_acquisition boolean not null default true,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_key)
);

create table if not exists public.diligence_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  diligence_item_id uuid not null references public.diligence_items(id) on delete cascade,
  label text not null,
  evidence_type text not null default 'document'
    check (evidence_type in ('document','public_record','professional_note','buyer_note')),
  document_id uuid,
  source_url text,
  verification_status text not null default 'unreviewed'
    check (verification_status in ('unreviewed','reviewed','confirmed','conflict')),
  created_at timestamptz not null default now()
);

create table if not exists public.deal_professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  role text not null check (role in ('attorney','accountant','lender','insurance','broker','consultant')),
  display_name text not null,
  organization text,
  responsibility text,
  status text not null default 'planned'
    check (status in ('planned','invited','active','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_key, role, display_name)
);

create table if not exists public.sba_readiness_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  purchase_price numeric not null default 0,
  buyer_injection numeric not null default 0,
  seller_note numeric not null default 0,
  working_capital numeric not null default 0,
  annual_cash_flow numeric not null default 0,
  interest_rate numeric not null default 10.5,
  term_years integer not null default 10,
  lender_status text not null default 'not_started'
    check (lender_status in ('not_started','preparing','prequalified','submitted','approved')),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_key)
);

create table if not exists public.transition_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  horizon text not null check (horizon in ('before_close','day_1','day_30','day_60','day_90','year_1')),
  category text not null,
  title text not null,
  owner text,
  status text not null default 'open' check (status in ('open','in_progress','complete')),
  due_date date,
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_key, horizon, title)
);

create index if not exists diligence_evidence_item_idx on public.diligence_evidence(diligence_item_id, created_at desc);
create index if not exists deal_professionals_workspace_idx on public.deal_professionals(user_id, opportunity_key, role);
create index if not exists transition_items_workspace_idx on public.transition_items(user_id, opportunity_key, horizon);

alter table public.deal_guidance_profiles enable row level security;
alter table public.diligence_evidence enable row level security;
alter table public.deal_professionals enable row level security;
alter table public.sba_readiness_profiles enable row level security;
alter table public.transition_items enable row level security;

create policy "deal_guidance_profiles_self" on public.deal_guidance_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "diligence_evidence_self" on public.diligence_evidence for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deal_professionals_self" on public.deal_professionals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sba_readiness_profiles_self" on public.sba_readiness_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transition_items_self" on public.transition_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.deal_guidance_profiles to authenticated;
grant select, insert, update, delete on public.diligence_evidence to authenticated;
grant select, insert, update, delete on public.deal_professionals to authenticated;
grant select, insert, update, delete on public.sba_readiness_profiles to authenticated;
grant select, insert, update, delete on public.transition_items to authenticated;
