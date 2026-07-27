create table if not exists public.buyer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  industries text[] not null default '{}',
  locations text[] not null default '{}',
  maximum_price numeric,
  minimum_cash_flow numeric,
  owner_involvement text not null default 'flexible'
    check (owner_involvement in ('owner_operator', 'semi_absentee', 'absentee', 'flexible')),
  seller_financing_preferred boolean not null default false,
  experience_level text not null default 'first_time'
    check (experience_level in ('first_time', 'experienced', 'professional')),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  stage text not null default 'saved'
    check (stage in ('saved', 'screening', 'evaluating', 'diligence', 'negotiation', 'closing', 'complete', 'passed')),
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_key)
);

create index if not exists saved_opportunities_user_stage_idx
  on public.saved_opportunities (user_id, stage, updated_at desc);

alter table public.buyer_preferences enable row level security;
alter table public.saved_opportunities enable row level security;

create policy "buyer_preferences_self_select" on public.buyer_preferences
  for select using (user_id = auth.uid());
create policy "buyer_preferences_self_insert" on public.buyer_preferences
  for insert with check (user_id = auth.uid());
create policy "buyer_preferences_self_update" on public.buyer_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "saved_opportunities_self_select" on public.saved_opportunities
  for select using (user_id = auth.uid());
create policy "saved_opportunities_self_insert" on public.saved_opportunities
  for insert with check (user_id = auth.uid());
create policy "saved_opportunities_self_update" on public.saved_opportunities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_opportunities_self_delete" on public.saved_opportunities
  for delete using (user_id = auth.uid());

grant select, insert, update on public.buyer_preferences to authenticated;
grant select, insert, update, delete on public.saved_opportunities to authenticated;
