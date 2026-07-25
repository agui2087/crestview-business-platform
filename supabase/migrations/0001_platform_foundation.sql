create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('en', 'es')),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text,
  location text,
  asking_price numeric,
  annual_revenue numeric,
  cash_flow numeric,
  currency_code char(3) default 'USD',
  source_label text not null,
  source_url text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.saved_opportunities (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id, user_id)
);

create table public.listing_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criteria jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.listing_alerts enable row level security;

create policy "profiles_self" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "memberships_self_read" on public.organization_memberships for select using (user_id = auth.uid());
create policy "organizations_member_read" on public.organizations for select using (
  exists (select 1 from public.organization_memberships m where m.organization_id = id and m.user_id = auth.uid())
);
create policy "opportunities_member_read" on public.opportunities for select using (
  exists (select 1 from public.organization_memberships m where m.organization_id = organization_id and m.user_id = auth.uid())
);
create policy "saved_self" on public.saved_opportunities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alerts_self" on public.listing_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
