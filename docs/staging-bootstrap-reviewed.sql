-- STAGING ONLY: bxtrkycetuoqooammgpp. Never execute on production.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $$
declare names text[];
begin
  select array_agg(c.relname::text order by c.relname) into names from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m');
  if names is distinct from array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events']::text[] then raise exception 'Not the reviewed billing-only staging state'; end if;
  if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal) then raise exception 'Existing auth trigger requires review'; end if;
  if exists(select 1 from storage.buckets) then raise exception 'Existing storage requires review'; end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname not in ('apply_stripe_billing_event','fulfill_stripe_checkout_payment')) then raise exception 'Existing application routines require review'; end if;
end $$;
create temporary table workforce_bootstrap_preservation(name text primary key, snapshot jsonb) on commit drop;
do $$
declare t text; contents jsonb;
begin
  foreach t in array array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',t) into contents;
    insert into workforce_bootstrap_preservation values(t,contents);
  end loop;
end $$;
insert into workforce_bootstrap_preservation
select 'routines',coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) order by oid),'[]'::jsonb) from pg_proc where pronamespace='public'::regnamespace;
insert into workforce_bootstrap_preservation select 'auth_count',to_jsonb(count(*)) from auth.users;
-- 0001_platform_foundation.sql
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
  -- Fresh-install shape used by 0004 and the current application. Existing
  -- installations must not rerun this foundation migration to change old data.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  stage text not null default 'saved'
    check (stage in ('saved','screening','evaluating','diligence','negotiation','closing','complete','passed')),
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_key)
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

-- 0002_acquisition_workflows.sql
create table public.acquisition_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'screening'
    check (status in ('screening', 'diligence', 'negotiation', 'closing', 'complete', 'withdrawn')),
  current_step text not null default 'initial_screening',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, opportunity_id, owner_user_id)
);

create table public.acquisition_steps (
  id uuid primary key default gen_random_uuid(),
  acquisition_project_id uuid not null references public.acquisition_projects(id) on delete cascade,
  step_key text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete', 'skipped')),
  notes text,
  skip_reason text,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (acquisition_project_id, step_key)
);

create table public.valuation_inputs (
  id uuid primary key default gen_random_uuid(),
  acquisition_project_id uuid not null references public.acquisition_projects(id) on delete cascade,
  asking_price numeric,
  normalized_sde numeric,
  normalized_ebitda numeric,
  annual_debt_service numeric,
  calculation_version text not null default 'v1',
  result jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index acquisition_projects_org_idx
  on public.acquisition_projects (organization_id, updated_at desc);
create index acquisition_steps_project_idx
  on public.acquisition_steps (acquisition_project_id);
create index valuation_inputs_project_idx
  on public.valuation_inputs (acquisition_project_id, created_at desc);

alter table public.acquisition_projects enable row level security;
alter table public.acquisition_steps enable row level security;
alter table public.valuation_inputs enable row level security;

create policy "acquisition_projects_member" on public.acquisition_projects
  for all
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = acquisition_projects.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = acquisition_projects.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy "acquisition_steps_member" on public.acquisition_steps
  for all
  using (
    exists (
      select 1
      from public.acquisition_projects p
      join public.organization_memberships m on m.organization_id = p.organization_id
      where p.id = acquisition_steps.acquisition_project_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.acquisition_projects p
      join public.organization_memberships m on m.organization_id = p.organization_id
      where p.id = acquisition_steps.acquisition_project_id
        and m.user_id = auth.uid()
    )
  );

create policy "valuation_inputs_member" on public.valuation_inputs
  for all
  using (
    exists (
      select 1
      from public.acquisition_projects p
      join public.organization_memberships m on m.organization_id = p.organization_id
      where p.id = valuation_inputs.acquisition_project_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.acquisition_projects p
      join public.organization_memberships m on m.organization_id = p.organization_id
      where p.id = valuation_inputs.acquisition_project_id
        and m.user_id = auth.uid()
    )
  );

-- 0003_account_profiles.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, locale)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 0004_buyer_workspace.sql
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

-- 0005_persistent_acquisition_workspace.sql
alter table public.saved_opportunities
  add column if not exists current_step integer not null default 0,
  add column if not exists checklist_progress jsonb not null default '{}'::jsonb,
  add column if not exists step_notes jsonb not null default '{}'::jsonb,
  add column if not exists valuation_inputs jsonb not null default '{}'::jsonb;

alter table public.saved_opportunities
  drop constraint if exists saved_opportunities_current_step_check;

alter table public.saved_opportunities
  add constraint saved_opportunities_current_step_check
  check (current_step between 0 and 7);

-- 0006_deal_operations.sql
create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  activity_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text,
  title text not null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diligence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  category text not null,
  title text not null,
  status text not null default 'open' check (status in ('open','requested','received','verified','flagged','not_applicable')),
  due_date date,
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_key, category, title)
);

create table if not exists public.broker_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  interaction_type text not null default 'note' check (interaction_type in ('email','call','meeting','note')),
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists deal_activities_user_opportunity_idx on public.deal_activities(user_id, opportunity_key, created_at desc);
create index if not exists deal_tasks_user_status_idx on public.deal_tasks(user_id, status, due_date);
create index if not exists diligence_items_user_opportunity_idx on public.diligence_items(user_id, opportunity_key, category);
create index if not exists broker_interactions_user_opportunity_idx on public.broker_interactions(user_id, opportunity_key, occurred_at desc);

alter table public.deal_activities enable row level security;
alter table public.deal_tasks enable row level security;
alter table public.diligence_items enable row level security;
alter table public.broker_interactions enable row level security;

create policy "deal_activities_self" on public.deal_activities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deal_tasks_self" on public.deal_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "diligence_items_self" on public.diligence_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "broker_interactions_self" on public.broker_interactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.deal_activities to authenticated;
grant select, insert, update, delete on public.deal_tasks to authenticated;
grant select, insert, update, delete on public.diligence_items to authenticated;
grant select, insert, update, delete on public.broker_interactions to authenticated;

-- 0007_saved_lists_and_notes.sql
create table if not exists public.opportunity_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.opportunity_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.opportunity_lists(id) on delete cascade,
  opportunity_key text not null,
  created_at timestamptz not null default now(),
  unique (list_id, opportunity_key)
);

create table if not exists public.opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunity_lists_user_idx on public.opportunity_lists(user_id, updated_at desc);
create index if not exists opportunity_list_items_user_idx on public.opportunity_list_items(user_id, list_id);
create index if not exists opportunity_notes_user_idx on public.opportunity_notes(user_id, opportunity_key, updated_at desc);

alter table public.opportunity_lists enable row level security;
alter table public.opportunity_list_items enable row level security;
alter table public.opportunity_notes enable row level security;

create policy "opportunity_lists_self" on public.opportunity_lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "opportunity_list_items_self" on public.opportunity_list_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "opportunity_notes_self" on public.opportunity_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.opportunity_lists to authenticated;
grant select, insert, update, delete on public.opportunity_list_items to authenticated;
grant select, insert, update, delete on public.opportunity_notes to authenticated;

-- 0008_workforce_and_organizations.sql
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists organization_name text default 'Crestview Holdings';

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  position text,
  department text,
  manager_name text,
  start_date date,
  employment_status text not null default 'active' check (employment_status in ('active','leave','terminated')),
  preferred_locale text not null default 'en' check (preferred_locale in ('en','es')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  record_type text not null check (record_type in ('certification','training','pto')),
  title text not null,
  status text not null default 'active',
  issued_on date,
  expires_on date,
  hours numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists employees_user_status_idx on public.employees(user_id, employment_status, full_name);
create index if not exists employee_records_user_employee_idx on public.employee_records(user_id, employee_id, record_type);

alter table public.employees enable row level security;
alter table public.employee_records enable row level security;
create policy "employees_self" on public.employees for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "employee_records_self" on public.employee_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_records to authenticated;

-- 0009_platform_admin.sql
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'agui2087@outlook.com';
$$;

create or replace function public.platform_admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'saved_opportunities', (select count(*) from public.saved_opportunities),
    'employees', (select count(*) from public.employees),
    'open_tasks', (select count(*) from public.deal_tasks where status = 'open'),
    'recent_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'confirmed', u.email_confirmed_at is not null,
        'display_name', p.display_name
      ) order by u.created_at desc), '[]'::jsonb)
      from (select * from auth.users order by created_at desc limit 50) u
      left join public.profiles p on p.user_id = u.id
    )
  );
end;
$$;

revoke all on function public.platform_admin_summary() from public;
grant execute on function public.platform_admin_summary() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- 0011_marketplace_workspaces.sql
alter table public.profiles
  add column if not exists account_roles text[] not null default array['buyer']::text[];

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, locale, account_roles)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end,
    case
      when new.raw_user_meta_data -> 'account_roles' is not null
        then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'account_roles'))
      else array['buyer']::text[]
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null,
  industry text not null,
  city text not null,
  state_code text not null,
  asking_price numeric,
  annual_revenue numeric,
  cash_flow numeric,
  financing_available boolean not null default false,
  public_highlights text[] not null default '{}'::text[],
  confidential_notes text,
  status text not null default 'draft'
    check (status in ('draft','published','paused','under_offer','sold','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  initial_message text not null,
  acquisition_experience text,
  funding_readiness text,
  requested_items text[] not null default array['NDA','Financial statements','Confidential information memorandum']::text[],
  status text not null default 'submitted'
    check (status in ('submitted','screening','approved','declined','nda_sent','nda_signed','document_review','meeting','offer','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table if not exists public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.deal_ndas (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null unique references public.deal_inquiries(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null,
  storage_path text,
  template_body text,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','signed','declined','superseded')),
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_ip_hash text,
  signature_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_room_documents (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  storage_path text,
  external_url text,
  access_level text not null default 'nda_signed'
    check (access_level in ('broker_only','approved','nda_signed')),
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_status_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_listings_status_location_idx
  on public.marketplace_listings(status, state_code, city);
create index if not exists deal_inquiries_buyer_idx on public.deal_inquiries(buyer_id, updated_at desc);
create index if not exists deal_inquiries_broker_idx on public.deal_inquiries(broker_id, updated_at desc);
create index if not exists deal_messages_inquiry_idx on public.deal_messages(inquiry_id, created_at);
create index if not exists notifications_user_idx on public.marketplace_notifications(user_id, read_at, created_at desc);

alter table public.marketplace_listings enable row level security;
alter table public.deal_inquiries enable row level security;
alter table public.deal_messages enable row level security;
alter table public.deal_ndas enable row level security;
alter table public.deal_room_documents enable row level security;
alter table public.marketplace_notifications enable row level security;
alter table public.deal_status_events enable row level security;

create policy "published listings readable" on public.marketplace_listings
  for select using (status = 'published' or broker_id = auth.uid());
create policy "brokers manage own listings" on public.marketplace_listings
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

create policy "inquiry participants" on public.deal_inquiries
  for select using (buyer_id = auth.uid() or broker_id = auth.uid());
create policy "buyers create inquiries" on public.deal_inquiries
  for insert with check (buyer_id = auth.uid());
create policy "participants update inquiries" on public.deal_inquiries
  for update using (buyer_id = auth.uid() or broker_id = auth.uid());

create policy "message participants" on public.deal_messages
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );
create policy "participants send messages" on public.deal_messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

create policy "nda participants" on public.deal_ndas
  for select using (buyer_id = auth.uid() or broker_id = auth.uid());
create policy "brokers create ndas" on public.deal_ndas
  for insert with check (broker_id = auth.uid());
create policy "nda participants update" on public.deal_ndas
  for update using (buyer_id = auth.uid() or broker_id = auth.uid());

create policy "room participants" on public.deal_room_documents
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (
          i.broker_id = auth.uid()
          or access_level = 'approved'
          or (access_level = 'nda_signed' and i.status in ('nda_signed','document_review','meeting','offer','closed'))
        )
    )
  );
create policy "brokers manage room documents" on public.deal_room_documents
  for all using (
    exists (select 1 from public.deal_inquiries i where i.id = inquiry_id and i.broker_id = auth.uid())
  ) with check (
    exists (select 1 from public.deal_inquiries i where i.id = inquiry_id and i.broker_id = auth.uid())
  );

create policy "notifications self" on public.marketplace_notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "status event participants" on public.deal_status_events
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );
create policy "participants create status events" on public.deal_status_events
  for insert with check (
    actor_id = auth.uid() and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

grant select, insert, update, delete on public.marketplace_listings to authenticated;
grant select, insert, update on public.deal_inquiries to authenticated;
grant select, insert, update on public.deal_messages to authenticated;
grant select, insert, update on public.deal_ndas to authenticated;
grant select, insert, update, delete on public.deal_room_documents to authenticated;
grant select, insert, update, delete on public.marketplace_notifications to authenticated;
grant select, insert on public.deal_status_events to authenticated;

-- 0012_automated_nda_and_financial_access.sql
create table if not exists public.listing_nda_templates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.marketplace_listings(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null default 'Confidentiality agreement',
  template_body text not null,
  storage_path text,
  version integer not null default 1,
  auto_send boolean not null default true,
  broker_attested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_inquiries
  add column if not exists financial_access_status text not null default 'not_requested'
    check (financial_access_status in ('not_requested','requested','more_information','approved','declined')),
  add column if not exists financial_request_message text,
  add column if not exists financial_request_timeline text,
  add column if not exists financial_request_capital text,
  add column if not exists financial_requested_at timestamptz,
  add column if not exists financial_decided_at timestamptz;

alter table public.deal_ndas
  add column if not exists template_version integer not null default 1,
  add column if not exists document_fingerprint text;

create index if not exists listing_nda_templates_listing_idx
  on public.listing_nda_templates(listing_id);
create index if not exists deal_inquiries_financial_access_idx
  on public.deal_inquiries(broker_id, financial_access_status, updated_at desc);

alter table public.listing_nda_templates enable row level security;

create policy "published nda templates readable" on public.listing_nda_templates
  for select using (
    broker_id = auth.uid()
    or exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id and l.status = 'published'
    )
    or exists (
      select 1 from public.deal_inquiries i
      where i.listing_id = listing_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

create policy "brokers manage listing nda templates" on public.listing_nda_templates
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

create policy "buyers create matching automated ndas" on public.deal_ndas
  for insert with check (
    buyer_id = auth.uid()
    and exists (
      select 1
      from public.deal_inquiries i
      join public.listing_nda_templates t on t.listing_id = i.listing_id
      where i.id = inquiry_id
        and i.buyer_id = auth.uid()
        and i.broker_id = deal_ndas.broker_id
        and t.auto_send = true
        and t.broker_attested = true
        and t.document_name = deal_ndas.document_name
        and t.template_body = deal_ndas.template_body
        and t.version = deal_ndas.template_version
    )
  );

drop policy if exists "room participants" on public.deal_room_documents;
create policy "room participants" on public.deal_room_documents
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (
          i.broker_id = auth.uid()
          or (access_level = 'approved' and i.financial_access_status = 'approved')
          or (
            access_level = 'nda_signed'
            and i.status in ('nda_signed','document_review','meeting','offer','closed')
          )
        )
    )
  );

grant select, insert, update, delete on public.listing_nda_templates to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-files', 'deal-files', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "brokers upload deal files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authorized participants read nda files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.listing_nda_templates t
      join public.marketplace_listings l on l.id = t.listing_id
      where t.storage_path = name
        and (
          t.broker_id = auth.uid()
          or l.status = 'published'
          or exists (
            select 1 from public.deal_inquiries i
            where i.listing_id = t.listing_id
              and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
          )
        )
    )
  );

create policy "brokers delete own deal files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 0013_marketplace_trust_and_profiles.sql
alter table public.profiles
  add column if not exists primary_role text not null default 'buyer'
    check (primary_role in ('buyer','broker','advisor')),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  add column if not exists verification_note text;

alter table public.buyer_preferences
  add column if not exists minimum_price numeric,
  add column if not exists acquisition_timeline text,
  add column if not exists funding_status text,
  add column if not exists proof_of_funds_status text not null default 'not_provided'
    check (proof_of_funds_status in ('not_provided','available','verified')),
  add column if not exists buyer_summary text;

alter table public.marketplace_listings
  add column if not exists quality_score integer not null default 0
    check (quality_score between 0 and 100);

alter table public.deal_room_documents
  add column if not exists permission_note text;

create table if not exists public.marketplace_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists marketplace_audit_inquiry_idx
  on public.marketplace_audit_events(inquiry_id, created_at desc);
create index if not exists marketplace_reports_status_idx
  on public.marketplace_reports(status, created_at desc);

alter table public.marketplace_audit_events enable row level security;
alter table public.marketplace_reports enable row level security;

create policy "audit participants read" on public.marketplace_audit_events
  for select using (
    actor_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
    or exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id and l.broker_id = auth.uid()
    )
  );

create policy "participants create audit events" on public.marketplace_audit_events
  for insert with check (
    actor_id = auth.uid()
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
  );

create policy "users create reports" on public.marketplace_reports
  for insert with check (reporter_id = auth.uid());
create policy "users read own reports" on public.marketplace_reports
  for select using (reporter_id = auth.uid());

drop policy if exists "notifications self" on public.marketplace_notifications;
create policy "notifications self read update delete" on public.marketplace_notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participants create notifications" on public.marketplace_notifications
  for insert with check (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (user_id = i.buyer_id or user_id = i.broker_id)
    )
  );

create policy "deal participants read counterpart profiles" on public.profiles
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where (i.buyer_id = auth.uid() and i.broker_id = profiles.user_id)
         or (i.broker_id = auth.uid() and i.buyer_id = profiles.user_id)
    )
  );

create policy "brokers read inquiry buyer preferences" on public.buyer_preferences
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where i.broker_id = auth.uid() and i.buyer_id = buyer_preferences.user_id
    )
  );

grant select, insert on public.marketplace_audit_events to authenticated;
grant select, insert on public.marketplace_reports to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  selected_role text;
begin
  selected_role := case
    when new.raw_user_meta_data ->> 'primary_role' in ('buyer','broker','advisor')
      then new.raw_user_meta_data ->> 'primary_role'
    else 'buyer'
  end;
  insert into public.profiles (
    user_id, display_name, locale, account_roles, primary_role, onboarding_completed
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end,
    case
      when selected_role = 'advisor' then array['advisor']::text[]
      else array[selected_role]::text[]
    end,
    selected_role,
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 0014_guided_acquisition_workspace.sql
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

-- 0015_deal_intelligence_passport.sql
create table if not exists public.deal_document_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  diligence_item_id uuid references public.diligence_items(id) on delete set null,
  source_document text not null,
  metric_name text not null,
  reported_value text not null,
  normalized_value numeric,
  period_label text,
  source_url text,
  confidence text not null default 'buyer_entered'
    check (confidence in ('buyer_entered','document_supported','professional_confirmed')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','reviewed','confirmed','conflict')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_document_findings_workspace_idx
  on public.deal_document_findings(user_id, opportunity_key, metric_name, created_at desc);

alter table public.deal_document_findings enable row level security;

create policy "deal_document_findings_self" on public.deal_document_findings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.deal_document_findings to authenticated;

-- 0016_buyer_command_center.sql
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

-- 0017_transaction_room_files.sql
alter table public.deal_room_documents
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

create table if not exists public.deal_document_requests (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  note text,
  status text not null default 'requested'
    check (status in ('requested','fulfilled','not_available')),
  document_id uuid references public.deal_room_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (inquiry_id, item_name)
);

create index if not exists deal_document_requests_inquiry_idx
  on public.deal_document_requests(inquiry_id, status, created_at);

alter table public.deal_document_requests enable row level security;

drop policy if exists "request participants read" on public.deal_document_requests;
create policy "request participants read" on public.deal_document_requests
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

drop policy if exists "buyers create document requests" on public.deal_document_requests;
create policy "buyers create document requests" on public.deal_document_requests
  for insert with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and i.buyer_id = auth.uid()
        and i.status in ('nda_signed','document_review','meeting','offer','closed')
    )
  );

drop policy if exists "brokers resolve document requests" on public.deal_document_requests;
create policy "brokers resolve document requests" on public.deal_document_requests
  for update using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  );

grant select, insert, update on public.deal_document_requests to authenticated;

update storage.buckets set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'deal-files';

drop policy if exists "authorized participants read room files" on storage.objects;
create policy "authorized participants read room files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.deal_room_documents d
      join public.deal_inquiries i on i.id = d.inquiry_id
      where d.storage_path = name
        and (
          i.broker_id = auth.uid()
          or (
            i.buyer_id = auth.uid()
            and (
              (d.access_level = 'approved' and i.financial_access_status = 'approved')
              or (d.access_level = 'nda_signed' and i.status in ('nda_signed','document_review','meeting','offer','closed'))
            )
          )
        )
    )
  );

-- 0018_private_document_vault.sql
create table if not exists public.vault_documents (
  id uuid primary key,
  owner_key text not null,
  opportunity_id uuid null,
  storage_key text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
  category text not null default 'Other',
  deal_name text null,
  fiscal_year text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vault_documents_owner_updated_idx on public.vault_documents (owner_key, updated_at desc);

create table if not exists public.vault_document_activity (
  id uuid primary key default gen_random_uuid(),
  document_id uuid null references public.vault_documents(id) on delete set null,
  owner_key text not null,
  action text not null,
  document_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists vault_document_activity_owner_created_idx on public.vault_document_activity (owner_key, created_at desc);

alter table public.vault_documents enable row level security;
alter table public.vault_document_activity enable row level security;
revoke all on public.vault_documents from anon, authenticated;
revoke all on public.vault_document_activity from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-files', 'vault-files', false, 10485760,
  array['application/pdf','text/csv','text/plain','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 0019_ai_analysis_controls.sql
create table if not exists public.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  provider_response_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_analysis_usage_user_created_idx
  on public.ai_analysis_usage(user_id, created_at desc);

alter table public.ai_analysis_usage enable row level security;
revoke all on public.ai_analysis_usage from public, anon, authenticated;

create or replace function public.reserve_ai_analysis(
  p_user_id uuid,
  p_opportunity_id uuid,
  p_hourly_limit integer default 5,
  p_daily_limit integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_id uuid;
begin
  if p_user_id is null or p_opportunity_id is null then
    raise exception 'Opportunity access denied';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if not exists (
    select 1 from public.saved_opportunities s
    where s.user_id = p_user_id and s.opportunity_id = p_opportunity_id
  ) then
    raise exception 'Opportunity access denied';
  end if;

  if not exists (
    select 1 from public.billing_entitlements e
    where e.user_id = p_user_id
      and e.product_code = 'crestview_pro'
      and e.active = true
      and (e.expires_at is null or e.expires_at > now())
  ) then
    raise exception 'Pro entitlement required';
  end if;

  if (select count(*) from public.ai_analysis_usage u where u.user_id = p_user_id and u.created_at > now() - interval '1 hour') >= p_hourly_limit
     or (select count(*) from public.ai_analysis_usage u where u.user_id = p_user_id and u.created_at > now() - interval '1 day') >= p_daily_limit then
    raise exception 'AI analysis rate limit reached';
  end if;

  insert into public.ai_analysis_usage(user_id, opportunity_id)
  values (p_user_id, p_opportunity_id)
  returning id into reservation_id;

  return reservation_id;
end;
$$;

revoke all on function public.reserve_ai_analysis(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_analysis(uuid, uuid, integer, integer) to service_role;


-- 0020_platform_admin_roles.sql
create table if not exists public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid null references auth.users(id) on delete set null,
  reason text null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.platform_administrators enable row level security;
revoke all on public.platform_administrators from public, anon, authenticated;

insert into public.platform_administrators (user_id, reason)
select id, 'Migrated from the original Crestview owner allowlist'
from auth.users
where lower(email) = 'agui2087@outlook.com'
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_administrators administrator
    where administrator.user_id = auth.uid()
      and administrator.revoked_at is null
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.grant_platform_administrator(target_user_id uuid, grant_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  insert into public.platform_administrators (user_id, granted_by, reason, revoked_at)
  values (target_user_id, auth.uid(), nullif(trim(grant_reason), ''), null)
  on conflict (user_id) do update
  set granted_by = auth.uid(), reason = excluded.reason, granted_at = now(), revoked_at = null;
end;
$$;

create or replace function public.revoke_platform_administrator(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if target_user_id = auth.uid() then raise exception 'Administrators cannot revoke their own access'; end if;
  update public.platform_administrators set revoked_at = now()
  where user_id = target_user_id and revoked_at is null;
end;
$$;

revoke all on function public.grant_platform_administrator(uuid, text) from public, anon;
revoke all on function public.revoke_platform_administrator(uuid) from public, anon;
grant execute on function public.grant_platform_administrator(uuid, text) to authenticated;
grant execute on function public.revoke_platform_administrator(uuid) to authenticated;

-- 0021_vault_uuid_ownership.sql
alter table public.vault_documents
  add column if not exists owner_id uuid null references auth.users(id) on delete cascade;

alter table public.vault_document_activity
  add column if not exists owner_id uuid null references auth.users(id) on delete cascade;

update public.vault_documents as document
set owner_id = auth_user.id
from auth.users as auth_user
where document.owner_id is null
  and auth_user.email is not null
  and lower(trim(document.owner_key)) = lower(trim(auth_user.email));

update public.vault_document_activity as activity
set owner_id = auth_user.id
from auth.users as auth_user
where activity.owner_id is null
  and auth_user.email is not null
  and lower(trim(activity.owner_key)) = lower(trim(auth_user.email));

create index if not exists vault_documents_owner_id_updated_idx
  on public.vault_documents (owner_id, updated_at desc);

create index if not exists vault_document_activity_owner_id_created_idx
  on public.vault_document_activity (owner_id, created_at desc);

comment on column public.vault_documents.owner_id is
  'Canonical Supabase user ID used for authorization. owner_key remains temporarily for migration compatibility only.';

comment on column public.vault_document_activity.owner_id is
  'Canonical Supabase user ID used for authorization. owner_key remains temporarily for migration compatibility only.';

-- 0022_database_authorization_hardening.sql
-- Defense-in-depth authorization for the buyer/broker transaction workspace.
-- RLS decides which rows a user may reach; these triggers also constrain which
-- fields each participant may change and keep all related IDs on the same deal.

create or replace function public.guard_deal_inquiry_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text := auth.role();
  buyer_changed boolean;
  status_changed boolean;
begin
  if actor_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if actor is null or new.buyer_id <> actor then
      raise exception 'Only the signed-in buyer may create an inquiry';
    end if;
    if not exists (
      select 1 from public.marketplace_listings l
      where l.id = new.listing_id
        and l.broker_id = new.broker_id
        and l.status = 'published'
        and l.broker_id <> actor
    ) then
      raise exception 'Inquiry listing and broker do not match an active listing';
    end if;
    if new.status not in ('submitted','nda_sent')
       or new.financial_access_status <> 'not_requested'
       or new.financial_decided_at is not null then
      raise exception 'A new inquiry must begin at the request or automated-NDA stage';
    end if;
    if new.status = 'nda_sent' and not exists (
      select 1
      from public.listing_nda_templates t
      where t.listing_id = new.listing_id
        and t.broker_id = new.broker_id
        and t.auto_send = true
        and t.broker_attested = true
    ) then
      raise exception 'Automated NDA delivery is not configured for this listing';
    end if;
    return new;
  end if;

  if new.id <> old.id
     or new.listing_id <> old.listing_id
     or new.buyer_id <> old.buyer_id
     or new.broker_id <> old.broker_id
     or new.created_at <> old.created_at then
    raise exception 'Deal ownership fields are immutable';
  end if;

  if actor = old.buyer_id then
    if (to_jsonb(new) - array[
          'status', 'requested_items', 'financial_access_status',
          'financial_request_message', 'financial_request_timeline',
          'financial_request_capital', 'financial_requested_at', 'updated_at'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'status', 'requested_items', 'financial_access_status',
          'financial_request_message', 'financial_request_timeline',
          'financial_request_capital', 'financial_requested_at', 'updated_at'
        ]) then
      raise exception 'Buyers may only update their request details';
    end if;

    status_changed := new.status is distinct from old.status;
    buyer_changed := new.financial_access_status is distinct from old.financial_access_status
      or new.requested_items is distinct from old.requested_items
      or new.financial_request_message is distinct from old.financial_request_message
      or new.financial_request_timeline is distinct from old.financial_request_timeline
      or new.financial_request_capital is distinct from old.financial_request_capital
      or new.financial_requested_at is distinct from old.financial_requested_at;

    if status_changed then
      if buyer_changed
         or old.status <> 'nda_sent'
         or new.status <> 'nda_signed'
         or not exists (
           select 1 from public.deal_ndas n
           where n.inquiry_id = old.id and n.buyer_id = actor and n.status = 'signed'
         ) then
        raise exception 'Buyer deal-stage transition is not allowed';
      end if;
    elsif buyer_changed then
      if new.financial_access_status <> 'requested'
         or new.status not in ('nda_signed','document_review','meeting','offer')
         or not exists (
           select 1 from public.deal_ndas n
           where n.inquiry_id = old.id and n.buyer_id = actor and n.status = 'signed'
         ) then
        raise exception 'Financial access requires a signed NDA';
      end if;
    end if;
  elsif actor = old.broker_id then
    if (to_jsonb(new) - array[
          'status', 'financial_access_status', 'financial_decided_at', 'updated_at'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'status', 'financial_access_status', 'financial_decided_at', 'updated_at'
        ]) then
      raise exception 'Brokers may only update deal decisions and stage';
    end if;
    if new.financial_access_status is distinct from old.financial_access_status
       and new.financial_access_status not in ('more_information','approved','declined') then
      raise exception 'Broker financial-access decision is not allowed';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'submitted' and new.status in ('screening','approved','declined'))
      or (old.status = 'screening' and new.status in ('approved','declined'))
      or (
        old.status in ('submitted','screening','approved')
        and new.status = 'nda_sent'
        and exists (
          select 1 from public.deal_ndas n
          where n.inquiry_id = old.id and n.broker_id = actor and n.status = 'sent'
        )
      )
      or (old.status = 'approved' and new.status = 'declined')
      or (old.status = 'declined' and new.status = 'screening')
      or (old.status = 'nda_sent' and new.status = 'declined')
      or (old.status = 'nda_signed' and new.status in ('document_review','meeting','declined'))
      or (old.status = 'document_review' and new.status in ('meeting','offer','declined'))
      or (old.status = 'meeting' and new.status in ('document_review','offer','declined'))
      or (old.status = 'offer' and new.status in ('document_review','closed','declined'))
    ) then
      raise exception 'Broker deal-stage transition is not allowed';
    end if;
  else
    raise exception 'Only deal participants may update an inquiry';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_deal_inquiry_write on public.deal_inquiries;
create trigger guard_deal_inquiry_write
before insert or update on public.deal_inquiries
for each row execute function public.guard_deal_inquiry_write();

drop policy if exists "buyers create inquiries" on public.deal_inquiries;
create policy "buyers create verified inquiries" on public.deal_inquiries
  for insert with check (
    buyer_id = auth.uid()
    and broker_id <> auth.uid()
    and exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id
        and l.broker_id = deal_inquiries.broker_id
        and l.status = 'published'
    )
  );

drop policy if exists "participants update inquiries" on public.deal_inquiries;
create policy "buyers update own inquiry requests" on public.deal_inquiries
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "brokers update own inquiry decisions" on public.deal_inquiries
  for update using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "participants send messages" on public.deal_messages;
create policy "participants send messages to counterpart" on public.deal_messages
  for insert with check (
    sender_id = auth.uid()
    and sender_id <> recipient_id
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (
          (i.buyer_id = auth.uid() and recipient_id = i.broker_id)
          or (i.broker_id = auth.uid() and recipient_id = i.buyer_id)
        )
    )
  );
revoke update on public.deal_messages from authenticated;

create or replace function public.guard_deal_nda_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if auth.role() = 'service_role' then return new; end if;

  if not exists (
    select 1 from public.deal_inquiries i
    where i.id = new.inquiry_id
      and i.buyer_id = new.buyer_id
      and i.broker_id = new.broker_id
  ) then
    raise exception 'NDA participants do not match the inquiry';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.inquiry_id <> old.inquiry_id
       or new.buyer_id <> old.buyer_id or new.broker_id <> old.broker_id
       or new.created_at <> old.created_at then
      raise exception 'NDA ownership fields are immutable';
    end if;

    if actor = old.buyer_id then
      if (to_jsonb(new) - array[
            'status', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         is distinct from
         (to_jsonb(old) - array[
            'status', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         or old.status not in ('sent','viewed')
         or new.status <> 'signed'
         or new.signed_at is null
         or nullif(trim(new.signer_name), '') is null then
        raise exception 'Buyer may only sign the delivered NDA';
      end if;
    elsif actor = old.broker_id then
      if (to_jsonb(new) - array[
            'document_name', 'storage_path', 'template_body', 'template_version',
            'status', 'sent_at', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         is distinct from
         (to_jsonb(old) - array[
            'document_name', 'storage_path', 'template_body', 'template_version',
            'status', 'sent_at', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ]) then
        raise exception 'Broker NDA update is not allowed';
      end if;
    else
      raise exception 'Only NDA participants may update it';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_nda_write on public.deal_ndas;
create trigger guard_deal_nda_write
before insert or update on public.deal_ndas
for each row execute function public.guard_deal_nda_write();

drop policy if exists "nda participants update" on public.deal_ndas;
create policy "buyers sign own nda" on public.deal_ndas
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "brokers update own nda" on public.deal_ndas
  for update using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "brokers manage room documents" on public.deal_room_documents;
create policy "brokers manage verified room documents" on public.deal_room_documents
  for all using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  ) with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  );

create or replace function public.guard_deal_room_document_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.inquiry_id <> old.inquiry_id
    or new.uploaded_by <> old.uploaded_by or new.created_at <> old.created_at
  ) then
    raise exception 'Deal-room document ownership fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_room_document_write on public.deal_room_documents;
create trigger guard_deal_room_document_write
before update on public.deal_room_documents
for each row execute function public.guard_deal_room_document_write();

create or replace function public.guard_document_request_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.id <> old.id or new.inquiry_id <> old.inquiry_id
     or new.requested_by <> old.requested_by or new.item_name <> old.item_name
     or new.note is distinct from old.note or new.created_at <> old.created_at then
    raise exception 'Document-request identity and buyer request are immutable';
  end if;
  if new.document_id is not null and not exists (
    select 1 from public.deal_room_documents d
    where d.id = new.document_id and d.inquiry_id = new.inquiry_id
  ) then
    raise exception 'Fulfillment document must belong to the same inquiry';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_document_request_update on public.deal_document_requests;
create trigger guard_document_request_update
before update on public.deal_document_requests
for each row execute function public.guard_document_request_update();

drop policy if exists "notifications self read update delete" on public.marketplace_notifications;
create policy "notifications self read" on public.marketplace_notifications
  for select using (user_id = auth.uid());
create policy "notifications self update" on public.marketplace_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications self delete" on public.marketplace_notifications
  for delete using (user_id = auth.uid());

drop policy if exists "participants create notifications" on public.marketplace_notifications;
create policy "participants notify counterpart" on public.marketplace_notifications
  for insert with check (
    user_id <> auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (
          (i.buyer_id = auth.uid() and user_id = i.broker_id)
          or (i.broker_id = auth.uid() and user_id = i.buyer_id)
        )
    )
  );

drop policy if exists "participants create status events" on public.deal_status_events;
create policy "participants create verified status events" on public.deal_status_events
  for insert with check (
    actor_id = auth.uid()
    and to_status in ('submitted','screening','approved','declined','nda_sent','nda_signed','document_review','meeting','offer','closed')
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

drop policy if exists "participants create audit events" on public.marketplace_audit_events;
create policy "participants create scoped audit events" on public.marketplace_audit_events
  for insert with check (
    actor_id = auth.uid()
    and (inquiry_id is not null or listing_id is not null)
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
    and (
      listing_id is null
      or exists (
        select 1 from public.marketplace_listings l
        where l.id = listing_id and l.broker_id = auth.uid()
      )
    )
  );

drop policy if exists "users create reports" on public.marketplace_reports;
create policy "users create scoped reports" on public.marketplace_reports
  for insert with check (
    reporter_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and (listing_id is not null or inquiry_id is not null)
    and (
      listing_id is null
      or exists (
        select 1 from public.marketplace_listings l
        where l.id = listing_id and (l.status = 'published' or l.broker_id = auth.uid())
      )
    )
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
  );

-- These server-only vault tables intentionally remain inaccessible to browser
-- roles. The application accesses them through the service role after verifying
-- the immutable Supabase user UUID.
revoke all on public.vault_documents from anon, authenticated;
revoke all on public.vault_document_activity from anon, authenticated;

-- 0023_document_lifecycle_controls.sql
create table if not exists public.document_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('vault','deal_room','listing_nda')),
  resource_id uuid null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  status text not null default 'reserved' check (status in ('reserved','committed','rejected')),
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists document_upload_events_user_created_idx
  on public.document_upload_events(user_id, created_at desc);

alter table public.document_upload_events enable row level security;
revoke all on public.document_upload_events from anon, authenticated;

alter table public.vault_documents
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists retention_until timestamptz null;

alter table public.deal_room_documents
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists retention_until timestamptz null;

create or replace function public.reserve_document_upload(
  p_user_id uuid,
  p_scope text,
  p_resource_id uuid,
  p_size_bytes bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_id uuid;
  recent_uploads integer;
  stored_files integer;
  stored_bytes bigint;
begin
  if p_user_id is null or (p_user_id <> auth.uid() and auth.role() <> 'service_role') then
    raise exception 'Unauthorized upload reservation';
  end if;
  if p_scope not in ('vault','deal_room','listing_nda') or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'Invalid upload reservation';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select count(*) into recent_uploads from public.document_upload_events
    where user_id = p_user_id and created_at > now() - interval '1 hour' and status <> 'rejected';
  if recent_uploads >= 20 then raise exception 'Hourly document upload limit reached'; end if;

  select
    (select count(*) from public.vault_documents where owner_id = p_user_id)
      + (select count(*) from public.deal_room_documents where uploaded_by = p_user_id and is_active),
    coalesce((select sum(size_bytes) from public.vault_documents where owner_id = p_user_id), 0)
      + coalesce((select sum(file_size_bytes) from public.deal_room_documents where uploaded_by = p_user_id and is_active), 0)
  into stored_files, stored_bytes;

  if stored_files >= 250 then raise exception 'Document count limit reached'; end if;
  if stored_bytes + p_size_bytes > 1073741824 then raise exception 'Document storage limit reached'; end if;

  insert into public.document_upload_events(user_id, scope, resource_id, size_bytes)
  values (p_user_id, p_scope, p_resource_id, p_size_bytes)
  returning id into reservation_id;
  return reservation_id;
end;
$$;

create or replace function public.finish_document_upload(p_reservation_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('committed','rejected') then raise exception 'Invalid upload status'; end if;
  update public.document_upload_events
    set status = p_status, finished_at = now()
    where id = p_reservation_id
      and (user_id = auth.uid() or auth.role() = 'service_role')
      and status = 'reserved';
  if not found then raise exception 'Upload reservation not found'; end if;
end;
$$;

revoke all on function public.reserve_document_upload(uuid,text,uuid,bigint) from public, anon;
revoke all on function public.finish_document_upload(uuid,text) from public, anon;
grant execute on function public.reserve_document_upload(uuid,text,uuid,bigint) to authenticated, service_role;
grant execute on function public.finish_document_upload(uuid,text) to authenticated, service_role;

comment on table public.document_upload_events is
  'Security ledger used for atomic per-user document throttling and quota enforcement. Retain for 24 months.';
comment on column public.document_upload_events.status is
  'Reserved uploads automatically stop affecting the hourly throttle after one hour. Rejected records remain as security evidence.';
comment on column public.vault_documents.retention_until is
  'Optional owner- or policy-selected deletion date. Null means retain until the owner deletes the document.';
comment on column public.deal_room_documents.retention_until is
  'Optional deal-room retention date. Null means retain while the deal record remains active.';

-- 0024_platform_admin_step_up_audit.sql
create table if not exists public.platform_administrator_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('granted', 'revoked')),
  reason text null,
  occurred_at timestamptz not null default now()
);

create index if not exists platform_administrator_events_target_idx
  on public.platform_administrator_events (target_user_id, occurred_at desc);

create index if not exists platform_administrator_events_actor_idx
  on public.platform_administrator_events (actor_user_id, occurred_at desc);

alter table public.platform_administrator_events enable row level security;
revoke all on public.platform_administrator_events from public, anon, authenticated;

create or replace function public.has_step_up_authentication()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() ->> 'aal') = 'aal2'
    and extract(epoch from now()) - coalesce((auth.jwt() ->> 'iat')::bigint, 0) <= 900,
    false
  );
$$;

revoke all on function public.has_step_up_authentication() from public, anon;
grant execute on function public.has_step_up_authentication() to authenticated;

create or replace function public.grant_platform_administrator(target_user_id uuid, grant_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if not public.has_step_up_authentication() then raise exception 'Recent two-factor verification required'; end if;
  if target_user_id is null then raise exception 'Target user is required'; end if;

  insert into public.platform_administrators (user_id, granted_by, reason, revoked_at)
  values (target_user_id, auth.uid(), nullif(trim(grant_reason), ''), null)
  on conflict (user_id) do update
  set granted_by = auth.uid(), reason = excluded.reason, granted_at = now(), revoked_at = null;

  insert into public.platform_administrator_events (target_user_id, actor_user_id, action, reason)
  values (target_user_id, auth.uid(), 'granted', nullif(trim(grant_reason), ''));
end;
$$;

create or replace function public.revoke_platform_administrator(target_user_id uuid, revoke_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if not public.has_step_up_authentication() then raise exception 'Recent two-factor verification required'; end if;
  if target_user_id is null then raise exception 'Target user is required'; end if;
  if target_user_id = auth.uid() then raise exception 'Administrators cannot revoke their own access'; end if;

  update public.platform_administrators
  set revoked_at = now()
  where user_id = target_user_id and revoked_at is null;

  if not found then raise exception 'Active administrator was not found'; end if;

  insert into public.platform_administrator_events (target_user_id, actor_user_id, action, reason)
  values (target_user_id, auth.uid(), 'revoked', nullif(trim(revoke_reason), ''));
end;
$$;

revoke all on function public.grant_platform_administrator(uuid, text) from public, anon;
revoke all on function public.revoke_platform_administrator(uuid) from public, anon, authenticated;
grant execute on function public.grant_platform_administrator(uuid, text) to authenticated;
grant execute on function public.revoke_platform_administrator(uuid, text) to authenticated;

drop function if exists public.revoke_platform_administrator(uuid);

comment on table public.platform_administrator_events is
  'Append-only audit history for platform administrator grants and revocations.';


-- 0025_managed_document_scanning.sql
create table if not exists public.document_security_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('vault','deal_room','listing_nda')),
  document_id uuid null,
  actor_id uuid null references auth.users(id) on delete set null,
  status text not null check (status in ('quarantined','basic_validated','malware_scanned','blocked','scan_error')),
  provider text not null,
  sha256 text not null check (length(sha256) = 64),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_security_events_document_created_idx
  on public.document_security_events(document_id, created_at desc);
create index if not exists document_security_events_actor_created_idx
  on public.document_security_events(actor_id, created_at desc);

alter table public.document_security_events enable row level security;
revoke all on public.document_security_events from public, anon, authenticated;

alter table public.vault_documents
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

alter table public.deal_room_documents
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

alter table public.listing_nda_templates
  add column if not exists security_status text not null default 'basic_validated'
    check (security_status in ('quarantined','basic_validated','malware_scanned','blocked')),
  add column if not exists scan_provider text null,
  add column if not exists scan_completed_at timestamptz null,
  add column if not exists scan_sha256 text null,
  add column if not exists scan_failure_reason text null;

comment on table public.document_security_events is
  'Immutable server-only audit trail for document security screening. Retain for 24 months.';
comment on column public.vault_documents.security_status is
  'Downloads are allowed only for basic_validated or malware_scanned documents.';

-- A browser session must never be able to self-assert that a file passed a
-- managed scan. Server actions use the service role after authenticating and
-- authorizing the broker; direct client inserts remain quarantined.
create or replace function public.guard_managed_document_scan_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.security_status := 'quarantined';
    new.scan_provider := null;
    new.scan_completed_at := null;
    new.scan_sha256 := null;
    new.scan_failure_reason := 'Awaiting server-side security screening';
    return new;
  end if;

  if new.security_status is distinct from old.security_status
     or new.scan_provider is distinct from old.scan_provider
     or new.scan_completed_at is distinct from old.scan_completed_at
     or new.scan_sha256 is distinct from old.scan_sha256
     or new.scan_failure_reason is distinct from old.scan_failure_reason then
    raise exception 'Document security fields may only be updated by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_room_scan_fields on public.deal_room_documents;
create trigger guard_deal_room_scan_fields
before insert or update on public.deal_room_documents
for each row execute function public.guard_managed_document_scan_fields();

drop trigger if exists guard_listing_nda_scan_fields on public.listing_nda_templates;
create trigger guard_listing_nda_scan_fields
before insert or update on public.listing_nda_templates
for each row execute function public.guard_managed_document_scan_fields();

drop policy if exists "authorized participants read nda files" on storage.objects;
create policy "authorized participants read nda files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.listing_nda_templates t
      join public.marketplace_listings l on l.id = t.listing_id
      where t.storage_path = name
        and t.security_status in ('basic_validated','malware_scanned')
        and (
          t.broker_id = auth.uid()
          or l.status = 'published'
          or exists (
            select 1 from public.deal_inquiries i
            where i.listing_id = t.listing_id
              and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
          )
        )
    )
  );

drop policy if exists "authorized participants read room files" on storage.objects;
create policy "authorized participants read room files" on storage.objects
  for select to authenticated using (
    bucket_id = 'deal-files'
    and exists (
      select 1
      from public.deal_room_documents d
      join public.deal_inquiries i on i.id = d.inquiry_id
      where d.storage_path = name
        and d.security_status in ('basic_validated','malware_scanned')
        and (
          i.broker_id = auth.uid()
          or (
            i.buyer_id = auth.uid()
            and (
              (d.access_level = 'approved' and i.financial_access_status = 'approved')
              or (d.access_level = 'nda_signed' and i.status in ('nda_signed','document_review','meeting','offer','closed'))
            )
          )
        )
    )
  );

-- 0026_private_pilot_feedback.sql
-- Private-pilot telemetry is intentionally first-party, minimal, and tied to
-- the authenticated user. Free-form feedback is never mixed with analytics.
create table if not exists public.pilot_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z0-9_.-]{1,80}$'),
  route text not null check (char_length(route) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pilot_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint pilot_events_metadata_size check (octet_length(metadata::text) <= 2048)
);

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null check (char_length(route) between 1 and 200),
  task_area text not null check (task_area in ('search','listing','nda','documents','dashboard','billing','other')),
  sentiment text not null check (sentiment in ('blocked','difficult','neutral','easy')),
  comments text not null check (char_length(comments) between 1 and 2000),
  contact_permission boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pilot_events_user_created_idx on public.pilot_events(user_id, created_at desc);
create index if not exists pilot_events_name_created_idx on public.pilot_events(event_name, created_at desc);
create index if not exists pilot_feedback_user_created_idx on public.pilot_feedback(user_id, created_at desc);

alter table public.pilot_events enable row level security;
alter table public.pilot_feedback enable row level security;

create or replace function public.enforce_pilot_write_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || tg_table_name));
  if tg_table_name = 'pilot_events' and (
    select count(*) from public.pilot_events
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'Pilot event rate limit reached';
  end if;
  if tg_table_name = 'pilot_feedback' and (
    select count(*) from public.pilot_feedback
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'Pilot feedback rate limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pilot_event_write_limits on public.pilot_events;
create trigger enforce_pilot_event_write_limits before insert on public.pilot_events
  for each row execute function public.enforce_pilot_write_limits();
drop trigger if exists enforce_pilot_feedback_write_limits on public.pilot_feedback;
create trigger enforce_pilot_feedback_write_limits before insert on public.pilot_feedback
  for each row execute function public.enforce_pilot_write_limits();

create policy "pilot_events_self_insert" on public.pilot_events
  for insert with check (user_id = auth.uid());
create policy "pilot_events_self_read" on public.pilot_events
  for select using (user_id = auth.uid());
create policy "pilot_feedback_self_insert" on public.pilot_feedback
  for insert with check (user_id = auth.uid());
create policy "pilot_feedback_self_read" on public.pilot_feedback
  for select using (user_id = auth.uid());

revoke update, delete on public.pilot_events from authenticated;
revoke update, delete on public.pilot_feedback from authenticated;
grant select, insert on public.pilot_events to authenticated;
grant select, insert on public.pilot_feedback to authenticated;
revoke all on function public.enforce_pilot_write_limits() from public, anon, authenticated;

comment on table public.pilot_events is 'Minimal first-party private-pilot journey telemetry. Purge after 90 days.';
comment on table public.pilot_feedback is 'Private-pilot participant feedback. Review at pilot close and purge or de-identify within 180 days.';

-- 0029_workforce_record_integrity.sql
-- Allow the document metadata type already offered by Workforce.
-- This does not change uploaded-document storage or security controls.

alter table public.employee_records drop constraint if exists employee_records_record_type_check;
alter table public.employee_records add constraint employee_records_record_type_check
  check (record_type in ('certification', 'training', 'pto', 'document'));

-- A record must belong to both the current user and one of their employees.
drop policy if exists employee_records_self on public.employee_records;
create policy employee_records_self on public.employee_records for all
  using (user_id = auth.uid() and exists (
    select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()
  ));

-- 0030_workforce_operations.sql
-- Workforce permissions intentionally do not inherit acquisition memberships.

alter table public.employees add column manager_user_id uuid references auth.users(id);
alter table public.employees add column version integer not null default 1;
alter table public.employees add column archived_at timestamptz;

create table public.workforce_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('hr','manager','employee')),
  employee_id uuid references public.employees(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,user_id),
  check(owner_id <> user_id)
);
create unique index workforce_member_employee on public.workforce_members(owner_id,employee_id) where revoked_at is null and employee_id is not null;

create function public.workforce_role(p_owner uuid) returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when auth.uid() = p_owner then 'owner' else
    (select role from workforce_members where owner_id=p_owner and user_id=auth.uid() and accepted_at is not null and revoked_at is null) end
$$;
create function public.workforce_can_manage(p_employee uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select workforce_role(e.user_id) in ('owner','hr') or
    (workforce_role(e.user_id)='manager' and e.manager_user_id=auth.uid()) from employees e where e.id=p_employee),false)
$$;
create function public.workforce_can_read(p_employee uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select workforce_can_manage(p_employee) or exists(select 1 from workforce_members m where m.employee_id=p_employee and m.user_id=auth.uid() and m.accepted_at is not null and m.revoked_at is null)
$$;

alter table public.workforce_members enable row level security;
create policy workforce_members_read on public.workforce_members for select using (user_id=auth.uid() or workforce_role(owner_id) in ('owner','hr') or (employee_id is not null and workforce_can_manage(employee_id)));
grant select on public.workforce_members to authenticated;

drop policy employees_self on public.employees;
create policy workforce_employee_read on public.employees for select using (workforce_role(user_id) in ('owner','hr') or workforce_can_read(id));
create policy workforce_employee_insert on public.employees for insert with check (workforce_role(user_id) in ('owner','hr'));
create policy workforce_employee_update on public.employees for update using (workforce_role(user_id) in ('owner','hr')) with check (workforce_role(user_id) in ('owner','hr'));
revoke delete on public.employees from authenticated;
-- Free-form internal notes are not exposed through the directory API.
revoke select on public.employees from authenticated;
grant select(id,user_id,full_name,email,phone,position,department,manager_name,start_date,employment_status,preferred_locale,created_at,updated_at,manager_user_id,version,archived_at) on public.employees to authenticated;

drop policy employee_records_self on public.employee_records;
create policy workforce_record_read on public.employee_records for select using (workforce_can_read(employee_id));
create policy workforce_record_insert on public.employee_records for insert with check (workforce_can_manage(employee_id) and exists(select 1 from employees e where e.id=employee_id and e.user_id=employee_records.user_id));
create policy workforce_record_update on public.employee_records for update using (workforce_can_manage(employee_id)) with check (workforce_can_manage(employee_id) and exists(select 1 from employees e where e.id=employee_id and e.user_id=employee_records.user_id));
revoke delete on public.employee_records from authenticated;

create table public.workforce_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  kind text not null check(kind in ('leave','profile')),
  title text not null check(length(title) between 1 and 200),
  starts_on date, ends_on date, leave_type text,
  changes jsonb not null default '{}',
  status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
  approver_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  decision_by uuid references auth.users(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check(kind <> 'leave' or (starts_on is not null and ends_on is not null and ends_on >= starts_on and leave_type is not null))
);
create table public.workforce_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  category text not null check(category in ('onboarding','offboarding','training','renewal','policy')),
  title text not null check(length(title) between 1 and 300),
  assignee_id uuid not null references auth.users(id),
  due_on date not null,
  status text not null default 'open' check(status in ('open','completed')),
  evidence text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.workforce_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  employee_id uuid not null,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  changed_fields text[] not null,
  created_at timestamptz not null default now()
);
create index workforce_requests_queue on public.workforce_requests(owner_id,status,starts_on);
create index workforce_tasks_queue on public.workforce_tasks(owner_id,status,due_on);
create index workforce_history_employee on public.workforce_history(employee_id,created_at desc);
alter table public.workforce_requests enable row level security;
alter table public.workforce_tasks enable row level security;
alter table public.workforce_history enable row level security;
create policy workforce_requests_read on public.workforce_requests for select using(workforce_can_read(employee_id));
create policy workforce_tasks_read on public.workforce_tasks for select using(workforce_can_read(employee_id));
create policy workforce_history_read on public.workforce_history for select using(workforce_can_manage(employee_id));
grant select on public.workforce_requests, public.workforce_tasks, public.workforce_history to authenticated;

create function public.workforce_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare n jsonb:=to_jsonb(new); o jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields)
  values(coalesce((n->>'owner_id')::uuid,(n->>'user_id')::uuid),case when tg_table_name='employees' then new.id else (n->>'employee_id')::uuid end,
    auth.uid(),tg_table_name,new.id,tg_op,array(select key from jsonb_each(n) where value is distinct from o->key));
  return new;
end $$;
create function public.workforce_employee_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id) then raise exception 'Workspace identity cannot change'; end if;
  if new.manager_user_id is not null and new.manager_user_id<>new.user_id and not exists(select 1 from workforce_members where owner_id=new.user_id and user_id=new.manager_user_id and role in ('hr','manager') and accepted_at is not null and revoked_at is null) then raise exception 'Invalid manager'; end if;
  if tg_op='UPDATE' then new.version:=old.version+1; new.updated_at:=now(); end if;
  return new;
end $$;
create trigger workforce_employee_guard before insert or update on public.employees for each row execute function public.workforce_employee_guard();
create trigger workforce_employee_audit after insert or update on public.employees for each row execute function public.workforce_audit();
create trigger workforce_record_audit after insert or update on public.employee_records for each row execute function public.workforce_audit();
create trigger workforce_request_audit after insert or update on public.workforce_requests for each row execute function public.workforce_audit();
create trigger workforce_task_audit after insert or update on public.workforce_tasks for each row execute function public.workforce_audit();

create function public.workforce_invite(p_owner uuid,p_email text,p_role text,p_employee uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; result uuid;
begin
  if auth.uid() is null or auth.uid()<>p_owner or p_role not in ('hr','manager','employee') then raise exception 'Not authorized'; end if;
  select id into target from auth.users where lower(email)=lower(trim(p_email));
  if target is null or target=p_owner then raise exception 'A different registered account is required'; end if;
  if p_employee is not null and not exists(select 1 from employees where id=p_employee and user_id=p_owner and archived_at is null) then raise exception 'Invalid employee'; end if;
  if p_role='employee' and p_employee is null then raise exception 'Employee profile required'; end if;
  insert into workforce_members(owner_id,user_id,role,employee_id) values(p_owner,target,p_role,p_employee)
  on conflict(owner_id,user_id) do update set role=excluded.role,employee_id=excluded.employee_id,accepted_at=null,revoked_at=null
  returning id into result;
  return result;
end $$;
create function public.workforce_membership_decision(p_id uuid,p_accept boolean) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_accept then
    update workforce_members set accepted_at=now() where id=p_id and user_id=auth.uid() and accepted_at is null and revoked_at is null;
  else
    update workforce_members set revoked_at=now() where id=p_id and (user_id=auth.uid() or owner_id=auth.uid()) and revoked_at is null;
  end if;
  if not found then raise exception 'Membership unavailable'; end if;
  return true;
end $$;

create function public.workforce_update_employee(p_id uuid,p_version integer,p_changes jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees;
begin
  select * into e from employees where id=p_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.version<>p_version then raise exception 'Record changed; refresh before saving'; end if;
  if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('full_name','email','phone','position','department','manager_name','manager_user_id','start_date','employment_status','preferred_locale','archived')) then raise exception 'Unsupported field'; end if;
  if p_changes ? 'full_name' and length(trim(p_changes->>'full_name')) not between 1 and 200 then raise exception 'Invalid name'; end if;
  if p_changes ? 'email' and coalesce(p_changes->>'email','')<>'' and (p_changes->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  if exists(select 1 from jsonb_each_text(p_changes) where length(value)>200) then raise exception 'Field too long'; end if;
  update employees set
    full_name=coalesce(nullif(trim(p_changes->>'full_name'),''),full_name),
    email=case when p_changes?'email' then nullif(p_changes->>'email','') else email end,
    phone=case when p_changes?'phone' then nullif(p_changes->>'phone','') else phone end,
    position=case when p_changes?'position' then nullif(p_changes->>'position','') else position end,
    department=case when p_changes?'department' then nullif(p_changes->>'department','') else department end,
    manager_name=case when p_changes?'manager_name' then nullif(p_changes->>'manager_name','') else manager_name end,
    manager_user_id=case when p_changes?'manager_user_id' then nullif(p_changes->>'manager_user_id','')::uuid else manager_user_id end,
    start_date=case when p_changes?'start_date' then nullif(p_changes->>'start_date','')::date else start_date end,
    employment_status=coalesce(p_changes->>'employment_status',employment_status),
    preferred_locale=coalesce(p_changes->>'preferred_locale',preferred_locale),
    archived_at=case when p_changes?'archived' then case when (p_changes->>'archived')::boolean then now() else null end else archived_at end
  where id=p_id;
  return true;
end $$;

create function public.workforce_submit_request(p_employee uuid,p_kind text,p_title text,p_start date default null,p_end date default null,p_leave_type text default null,p_changes jsonb default '{}') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid; approver uuid;
begin
  select * into e from employees where id=p_employee;
  if not found or not workforce_can_read(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  if p_kind not in ('leave','profile') or length(trim(p_title)) not between 1 and 200 then raise exception 'Invalid request'; end if;
  if p_kind='leave' and (p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 or length(trim(coalesce(p_leave_type,''))) not between 1 and 80) then raise exception 'Invalid leave dates/type'; end if;
  if p_kind='profile' and (p_changes='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('email','phone','preferred_locale'))) then raise exception 'Only contact details and language may be requested'; end if;
  if p_kind='profile' and ((p_changes?'preferred_locale' and coalesce(p_changes->>'preferred_locale','') not in ('en','es')) or exists(select 1 from jsonb_each_text(p_changes) where length(value)>200) or (coalesce(p_changes->>'email','')<>'' and (p_changes->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'Invalid contact details'; end if;
  approver:=case when e.manager_user_id is not null and e.manager_user_id<>auth.uid() and workforce_role(e.user_id) is not null then e.manager_user_id else e.user_id end;
  insert into workforce_requests(owner_id,employee_id,kind,title,starts_on,ends_on,leave_type,changes,approver_id,created_by)
  values(e.user_id,e.id,p_kind,trim(p_title),p_start,p_end,p_leave_type,p_changes,approver,auth.uid()) returning id into result;
  return result;
end $$;
create function public.workforce_decide_request(p_id uuid,p_status text,p_reason text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requests; e employees;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into r from workforce_requests where id=p_id for update;
  if not found or r.status<>'pending' then raise exception 'Request already handled or unavailable'; end if;
  if p_status='withdrawn' then
    if r.created_by<>auth.uid() then raise exception 'Not authorized'; end if;
  elsif p_status in ('approved','rejected') then
    if not workforce_can_manage(r.employee_id) or (r.approver_id<>auth.uid() and coalesce(workforce_role(r.owner_id),'') not in ('owner','hr')) then raise exception 'Not authorized'; end if;
    if r.created_by=auth.uid() then raise exception 'Another authorized reviewer must decide your request'; end if;
    if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Decision reason required'; end if;
  else raise exception 'Invalid decision'; end if;
  if p_status='approved' and r.kind='profile' then
    select * into e from employees where id=r.employee_id for update;
    -- Managers cannot approve changes to employee contact information.
    if coalesce(workforce_role(r.owner_id),'') not in ('owner','hr') then raise exception 'HR review required'; end if;
    perform workforce_update_employee(e.id,e.version,r.changes);
  end if;
  update workforce_requests set status=p_status,decision_by=auth.uid(),decision_reason=p_reason,decided_at=now() where id=p_id;
  return true;
end $$;

create function public.workforce_assign_task(p_employee uuid,p_category text,p_title text,p_assignee uuid,p_due date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid;
begin
  select * into e from employees where id=p_employee;
  if not found or not workforce_can_manage(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  if p_due is null or length(trim(p_title)) not between 1 and 300 then raise exception 'Title and due date required'; end if;
  if p_assignee<>e.user_id and not exists(select 1 from workforce_members m where m.owner_id=e.user_id and m.user_id=p_assignee and m.accepted_at is not null and m.revoked_at is null and (m.role='hr' or (m.role='manager' and e.manager_user_id=p_assignee) or m.employee_id=e.id)) then raise exception 'Assignee cannot access this employee'; end if;
  insert into workforce_tasks(owner_id,employee_id,category,title,assignee_id,due_on) values(e.user_id,e.id,p_category,trim(p_title),p_assignee,p_due) returning id into result;
  return result;
end $$;
create function public.workforce_finish_task(p_id uuid,p_evidence text,p_verify boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare t workforce_tasks;
begin
  select * into t from workforce_tasks where id=p_id for update;
  if not found or not workforce_can_read(t.employee_id) then raise exception 'Not authorized'; end if;
  if p_verify then
    if not workforce_can_manage(t.employee_id) or t.status<>'completed' or t.completed_by=auth.uid() then raise exception 'Independent manager verification required'; end if;
    update workforce_tasks set verified_at=now(),verified_by=auth.uid() where id=p_id;
  else
    if t.status<>'open' or (t.assignee_id<>auth.uid() and not workforce_can_manage(t.employee_id)) then raise exception 'Not authorized or already completed'; end if;
    if length(trim(coalesce(p_evidence,''))) not between 1 and 2000 then raise exception 'Completion evidence required'; end if;
    update workforce_tasks set status='completed',evidence=p_evidence,completed_at=now(),completed_by=auth.uid() where id=p_id;
  end if;
  return true;
end $$;

-- Explicitly limit all callable entry points; triggers are not public APIs.
create table public.workforce_access_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null, user_id uuid not null, actor_id uuid,
  role text not null, action text not null, created_at timestamptz not null default now()
);
alter table public.workforce_access_history enable row level security;
create policy workforce_access_history_read on public.workforce_access_history for select using(workforce_role(owner_id) in ('owner','hr'));
grant select on public.workforce_access_history to authenticated;
create function public.workforce_access_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into workforce_access_history(owner_id,user_id,actor_id,role,action)
  values(new.owner_id,new.user_id,auth.uid(),new.role,case when new.revoked_at is not null then 'revoked' when new.accepted_at is not null then 'accepted' else 'invited' end);
  return new;
end $$;
create trigger workforce_access_audit after insert or update on public.workforce_members for each row execute function public.workforce_access_audit();
revoke all on function public.workforce_access_audit() from public, anon;

create table public.workforce_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  position text not null check(length(trim(position)) between 1 and 200),
  title text not null check(length(trim(title)) between 1 and 300),
  renewal_days integer check(renewal_days between 1 and 3650),
  created_at timestamptz not null default now(),
  unique(owner_id,position,title)
);
alter table public.workforce_requirements enable row level security;
create policy workforce_requirements_read on public.workforce_requirements for select using(workforce_role(owner_id) is not null);
grant select on public.workforce_requirements to authenticated;
alter table public.workforce_tasks add column requirement_id uuid references public.workforce_requirements(id);
create unique index workforce_open_requirement on public.workforce_tasks(employee_id,requirement_id) where status='open' and requirement_id is not null;
create function public.workforce_add_requirement(p_owner uuid,p_position text,p_title text,p_days integer default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  insert into workforce_requirements(owner_id,position,title,renewal_days) values(p_owner,trim(p_position),trim(p_title),p_days) returning id into result;
  return result;
end $$;
create function public.workforce_assign_requirement(p_employee uuid,p_requirement uuid,p_due date,p_assignee uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requirements; e employees; result uuid;
begin
  select * into e from employees where id=p_employee;
  select * into r from workforce_requirements where id=p_requirement;
  if e.id is null or r.id is null or r.owner_id<>e.user_id or lower(r.position)<>lower(coalesce(e.position,'')) then raise exception 'Requirement does not match employee role'; end if;
  result:=workforce_assign_task(e.id,'training',r.title,p_assignee,p_due);
  update workforce_tasks set requirement_id=r.id where id=result;
  return result;
end $$;
create function public.workforce_start_checklist(p_employee uuid,p_category text,p_due date,p_assignee uuid) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare titles text[]; title text;
begin
  if not workforce_can_manage(p_employee) then raise exception 'Not authorized'; end if;
  perform id from employees where id=p_employee for update;
  if p_category='onboarding' then titles:=array['Confirm role and manager','Prepare equipment and approved accounts','Review company handbook and policies','Assign required role training','Schedule first-week check-in'];
  elsif p_category='offboarding' then titles:=array['Confirm handover owner and plan','Collect company equipment','Revoke external system access','Review final-pay steps with payroll provider','Review record retention with HR'];
  else raise exception 'Invalid checklist'; end if;
  if exists(select 1 from workforce_tasks where employee_id=p_employee and category=p_category and status='open') then raise exception 'An open checklist already exists'; end if;
  foreach title in array titles loop perform workforce_assign_task(p_employee,p_category,title,p_assignee,p_due); end loop;
  return cardinality(titles);
end $$;
revoke all on function public.workforce_add_requirement(uuid,text,text,integer),public.workforce_assign_requirement(uuid,uuid,date,uuid),public.workforce_start_checklist(uuid,text,date,uuid) from public, anon;
grant execute on function public.workforce_add_requirement(uuid,text,text,integer),public.workforce_assign_requirement(uuid,uuid,date,uuid),public.workforce_start_checklist(uuid,text,date,uuid) to authenticated;

revoke all on function public.workforce_audit(), public.workforce_employee_guard() from public, anon;
revoke all on function public.workforce_role(uuid),public.workforce_can_manage(uuid),public.workforce_can_read(uuid),public.workforce_invite(uuid,text,text,uuid),public.workforce_membership_decision(uuid,boolean),public.workforce_update_employee(uuid,integer,jsonb),public.workforce_submit_request(uuid,text,text,date,date,text,jsonb),public.workforce_decide_request(uuid,text,text),public.workforce_assign_task(uuid,text,text,uuid,date),public.workforce_finish_task(uuid,text,boolean) from public, anon;
grant execute on function public.workforce_role(uuid),public.workforce_can_manage(uuid),public.workforce_can_read(uuid),public.workforce_invite(uuid,text,text,uuid),public.workforce_membership_decision(uuid,boolean),public.workforce_update_employee(uuid,integer,jsonb),public.workforce_submit_request(uuid,text,text,date,date,text,jsonb),public.workforce_decide_request(uuid,text,text),public.workforce_assign_task(uuid,text,text,uuid,date),public.workforce_finish_task(uuid,text,boolean) to authenticated;

-- 0031_workforce_checklist_management.sql

create table public.workforce_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check(length(trim(title)) between 1 and 200),
  category text not null check(category in ('onboarding','offboarding','training','renewal','policy')),
  items text[] not null check(cardinality(items) between 1 and 30),
  version integer not null default 1,
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.workforce_templates enable row level security;
create policy workforce_templates_read on public.workforce_templates for select using(workforce_role(owner_id) in ('owner','hr','manager'));
grant select on public.workforce_templates to authenticated;

create table public.workforce_template_history (
  id bigint generated always as identity primary key,
  template_id uuid not null references public.workforce_templates(id),
  owner_id uuid not null,
  actor_id uuid,
  version integer not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_template_history enable row level security;
create policy workforce_template_history_read on public.workforce_template_history for select using(workforce_role(owner_id) in ('owner','hr'));
grant select on public.workforce_template_history to authenticated;

alter table public.workforce_tasks add column version integer not null default 1;
alter table public.workforce_tasks add column template_id uuid references public.workforce_templates(id);
alter table public.workforce_tasks add column change_reason text;
create function public.workforce_task_version() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.version:=old.version+1; return new; end $$;
create trigger workforce_task_version before update on public.workforce_tasks for each row execute function public.workforce_task_version();

create function public.workforce_save_template(p_owner uuid,p_id uuid,p_version integer,p_title text,p_category text,p_items text[],p_archived boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_templates; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 or p_items is null or cardinality(p_items) not between 1 and 30 or exists(select 1 from unnest(p_items) x where x is null or length(trim(x)) not between 1 and 300) then raise exception 'Provide a title and 1 to 30 nonempty tasks'; end if;
  if p_id is null then
    insert into workforce_templates(owner_id,title,category,items,archived) values(p_owner,trim(p_title),p_category,p_items,p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_templates where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if p_version is distinct from r.version then raise exception 'Template changed; refresh first'; end if;
    update workforce_templates set title=trim(p_title),category=p_category,items=p_items,archived=p_archived,version=version+1,updated_at=now() where id=p_id returning id,version into result,next_version;
  end if;
  insert into workforce_template_history(template_id,owner_id,actor_id,version) values(result,p_owner,auth.uid(),next_version);
  return result;
end $$;

create function public.workforce_assign_template(p_employee uuid,p_template uuid,p_version integer,p_due date,p_assignee uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; r workforce_templates; title text; task_id uuid;
begin
  select * into e from employees where id=p_employee for update;
  if not found or not workforce_can_manage(e.id) or e.archived_at is not null then raise exception 'Not authorized'; end if;
  select * into r from workforce_templates where id=p_template for share;
  if not found or r.owner_id<>e.user_id or r.archived then raise exception 'Template unavailable'; end if;
  if p_version is distinct from r.version then raise exception 'Template changed; refresh first'; end if;
  if exists(select 1 from workforce_tasks where employee_id=e.id and template_id=r.id and status='open') then raise exception 'An open checklist already exists'; end if;
  foreach title in array r.items loop
    task_id:=workforce_assign_task(e.id,r.category,title,p_assignee,p_due);
    update workforce_tasks set template_id=r.id where id=task_id;
  end loop;
  return cardinality(r.items);
end $$;

create function public.workforce_reschedule_task(p_id uuid,p_version integer,p_assignee uuid,p_due date,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_tasks; e employees;
begin
  select * into r from workforce_tasks where id=p_id for update;
  if not found or not workforce_can_manage(r.employee_id) then raise exception 'Not authorized'; end if;
  select * into e from employees where id=r.employee_id;
  if e.archived_at is not null or r.status<>'open' then raise exception 'Only active open tasks can change'; end if;
  if p_version is distinct from r.version then raise exception 'Task changed; refresh first'; end if;
  if p_due is null or p_assignee is null or length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Assignee, due date and reason required'; end if;
  if p_assignee<>e.user_id and not exists(select 1 from workforce_members m where m.owner_id=e.user_id and m.user_id=p_assignee and m.accepted_at is not null and m.revoked_at is null and (m.role='hr' or (m.role='manager' and e.manager_user_id=p_assignee) or (m.role='employee' and m.employee_id=e.id))) then raise exception 'Assignee cannot access this employee'; end if;
  update workforce_tasks set assignee_id=p_assignee,due_on=p_due,change_reason=trim(p_reason) where id=r.id;
  return true;
end $$;

revoke all on function public.workforce_task_version(),public.workforce_save_template(uuid,uuid,integer,text,text,text[],boolean),public.workforce_assign_template(uuid,uuid,integer,date,uuid),public.workforce_reschedule_task(uuid,integer,uuid,date,text) from public,anon;
grant execute on function public.workforce_save_template(uuid,uuid,integer,text,text,text[],boolean),public.workforce_assign_template(uuid,uuid,integer,date,uuid),public.workforce_reschedule_task(uuid,integer,uuid,date,text) to authenticated;

-- 0032_workforce_business_setup.sql

-- Configuration is per Workforce owner, not acquisition-organization membership.
create table public.workforce_business_settings (
  owner_id uuid primary key references auth.users(id),
  business_name text not null check(length(trim(business_name)) between 1 and 200),
  timezone text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.workforce_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check(length(trim(name)) between 1 and 200),
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  region text not null check(length(trim(region)) between 1 and 200),
  timezone text not null,
  archived boolean not null default false,
  version integer not null default 1,
  unique(owner_id,name)
);
create table public.workforce_departments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check(length(trim(name)) between 1 and 200),
  archived boolean not null default false,
  version integer not null default 1,
  unique(owner_id,name)
);
create table public.workforce_setup_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  actor_id uuid,
  entity text not null,
  entity_id uuid not null,
  version integer not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_business_settings enable row level security;
alter table public.workforce_locations enable row level security;
alter table public.workforce_departments enable row level security;
alter table public.workforce_setup_history enable row level security;
create policy workforce_business_settings_read on public.workforce_business_settings for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_locations_read on public.workforce_locations for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_departments_read on public.workforce_departments for select using(workforce_role(owner_id) in ('owner','hr','manager'));
create policy workforce_setup_history_read on public.workforce_setup_history for select using(workforce_role(owner_id) in ('owner','hr'));
revoke all on public.workforce_business_settings,public.workforce_locations,public.workforce_departments,public.workforce_setup_history from anon,authenticated;
grant select on public.workforce_business_settings,public.workforce_locations,public.workforce_departments,public.workforce_setup_history to authenticated;

create function public.workforce_save_business(p_owner uuid,p_version integer,p_name text,p_timezone text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_version integer; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  -- Serialize first creation as well as subsequent changes.
  perform id from auth.users where id=p_owner for update;
  select version into current_version from workforce_business_settings where owner_id=p_owner;
  if coalesce(current_version,0) is distinct from p_version then raise exception 'Settings changed; refresh first'; end if;
  next_version:=coalesce(current_version,0)+1;
  insert into workforce_business_settings(owner_id,business_name,timezone,version) values(p_owner,trim(p_name),p_timezone,next_version)
  on conflict(owner_id) do update set business_name=excluded.business_name,timezone=excluded.timezone,version=excluded.version,updated_at=now();
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'business',p_owner,next_version);
  return true;
end $$;

create function public.workforce_save_location(p_owner uuid,p_id uuid,p_version integer,p_name text,p_country text,p_region text,p_timezone text,p_archived boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_locations; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  if p_id is null then
    insert into workforce_locations(owner_id,name,country_code,region,timezone,archived) values(p_owner,trim(p_name),upper(trim(p_country)),trim(p_region),p_timezone,p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_locations where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if r.version is distinct from p_version then raise exception 'Location changed; refresh first'; end if;
    update workforce_locations set name=trim(p_name),country_code=upper(trim(p_country)),region=trim(p_region),timezone=p_timezone,archived=p_archived,version=version+1 where id=r.id returning id,version into result,next_version;
  end if;
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'location',result,next_version);
  return result;
end $$;

create function public.workforce_save_department(p_owner uuid,p_id uuid,p_version integer,p_name text,p_archived boolean default false) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_departments; result uuid; next_version integer;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_id is null then
    insert into workforce_departments(owner_id,name,archived) values(p_owner,trim(p_name),p_archived) returning id,version into result,next_version;
  else
    select * into r from workforce_departments where id=p_id for update;
    if not found or r.owner_id<>p_owner then raise exception 'Not authorized'; end if;
    if r.version is distinct from p_version then raise exception 'Department changed; refresh first'; end if;
    update workforce_departments set name=trim(p_name),archived=p_archived,version=version+1 where id=r.id returning id,version into result,next_version;
  end if;
  insert into workforce_setup_history(owner_id,actor_id,entity,entity_id,version) values(p_owner,auth.uid(),'department',result,next_version);
  return result;
end $$;

revoke all on function public.workforce_save_business(uuid,integer,text,text),public.workforce_save_location(uuid,uuid,integer,text,text,text,text,boolean),public.workforce_save_department(uuid,uuid,integer,text,boolean) from public,anon;
grant execute on function public.workforce_save_business(uuid,integer,text,text),public.workforce_save_location(uuid,uuid,integer,text,text,text,text,boolean),public.workforce_save_department(uuid,uuid,integer,text,boolean) to authenticated;

-- 0033_workforce_employee_placement.sql

-- Keep normalized placement separate from legacy, user-entered department labels.
create table public.workforce_employee_placements (
  employee_id uuid primary key references public.employees(id),
  owner_id uuid not null references auth.users(id),
  location_id uuid references public.workforce_locations(id),
  department_id uuid references public.workforce_departments(id),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.workforce_employee_placements enable row level security;
create policy workforce_placement_read on public.workforce_employee_placements for select using(public.workforce_can_read(employee_id));
revoke all on public.workforce_employee_placements from anon,authenticated;
grant select on public.workforce_employee_placements to authenticated;

create function public.workforce_set_placement(p_employee uuid,p_version integer,p_location uuid,p_department uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; prior_version integer; next_version integer;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee before changing placement'; end if;
  select version into prior_version from workforce_employee_placements where employee_id=p_employee;
  if coalesce(prior_version,0) is distinct from p_version then raise exception 'Placement changed; refresh first'; end if;
  -- Row locks prevent an archive racing a new assignment.
  if p_location is not null then
    perform id from workforce_locations where id=p_location and owner_id=e.user_id and not archived for share;
    if not found then raise exception 'Choose an active location in this workspace'; end if;
  end if;
  if p_department is not null then
    perform id from workforce_departments where id=p_department and owner_id=e.user_id and not archived for share;
    if not found then raise exception 'Choose an active department in this workspace'; end if;
  end if;
  next_version:=coalesce(prior_version,0)+1;
  insert into workforce_employee_placements(employee_id,owner_id,location_id,department_id,version)
    values(p_employee,e.user_id,p_location,p_department,next_version)
    on conflict(employee_id) do update set location_id=excluded.location_id,department_id=excluded.department_id,version=excluded.version,updated_at=now();
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields)
    values(e.user_id,e.id,auth.uid(),'workforce_employee_placements',e.id,'UPDATE',array['location_id','department_id']);
  return true;
end $$;
revoke all on function public.workforce_set_placement(uuid,integer,uuid,uuid) from public,anon;
grant execute on function public.workforce_set_placement(uuid,integer,uuid,uuid) to authenticated;

-- 0034_workforce_schedules.sql

create table public.workforce_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  starts_on date not null check(starts_on between date '1900-01-01' and date '2200-12-31'),
  ends_on date check(ends_on between starts_on and date '2200-12-31'),
  timezone text not null,
  -- Monday through Sunday; planned minutes, not time worked or payable hours.
  daily_minutes integer[] not null,
  version integer not null default 1,
  cancelled boolean not null default false,
  reason text not null check(length(trim(reason)) between 1 and 1000),
  updated_at timestamptz not null default now()
);
create table public.workforce_schedule_history (
  id bigint generated always as identity primary key,
  schedule_id uuid not null references public.workforce_schedules(id),
  employee_id uuid not null references public.employees(id),
  actor_id uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_schedules enable row level security;
alter table public.workforce_schedule_history enable row level security;
create policy workforce_schedules_read on public.workforce_schedules for select using(workforce_can_read(employee_id));
create policy workforce_schedule_history_read on public.workforce_schedule_history for select using(workforce_can_read(employee_id));
revoke all on public.workforce_schedules,public.workforce_schedule_history from anon,authenticated;
grant select on public.workforce_schedules,public.workforce_schedule_history to authenticated;

create function public.workforce_save_schedule(p_employee uuid,p_id uuid,p_version integer,p_start date,p_end date,p_timezone text,p_minutes integer[],p_reason text,p_cancelled boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; s workforce_schedules; result workforce_schedules;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee before changing schedules'; end if;
  if p_start is null or p_start not between date '1900-01-01' and date '2200-12-31' or (p_end is not null and (p_end<p_start or p_end>date '2200-12-31')) then raise exception 'Invalid effective dates'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  if p_minutes is null or array_ndims(p_minutes) is distinct from 1 or array_length(p_minutes,1) is distinct from 7 or array_lower(p_minutes,1) is distinct from 1 or exists(select 1 from unnest(p_minutes) m where m is null or m<0 or m>1440) then raise exception 'Specify seven daily minute values from 0 to 1440'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_cancelled is null then raise exception 'Change reason required'; end if;
  if p_id is not null then
    select * into s from workforce_schedules where id=p_id for update;
    if not found or s.employee_id<>e.id or s.owner_id<>e.user_id then raise exception 'Not authorized'; end if;
    if s.version is distinct from p_version then raise exception 'Schedule changed; refresh first'; end if;
  elsif p_version is distinct from 0 then raise exception 'Invalid initial version'; end if;
  if not p_cancelled and exists(select 1 from workforce_schedules where employee_id=e.id and not cancelled and id is distinct from p_id and starts_on<=coalesce(p_end,date '2200-12-31') and coalesce(ends_on,date '2200-12-31')>=p_start) then raise exception 'Schedule overlaps another effective period'; end if;
  if p_id is null then
    insert into workforce_schedules(owner_id,employee_id,starts_on,ends_on,timezone,daily_minutes,reason,cancelled) values(e.user_id,e.id,p_start,p_end,p_timezone,p_minutes,trim(p_reason),p_cancelled) returning * into result;
  else
    update workforce_schedules set starts_on=p_start,ends_on=p_end,timezone=p_timezone,daily_minutes=p_minutes,reason=trim(p_reason),cancelled=p_cancelled,version=version+1,updated_at=now() where id=p_id returning * into result;
  end if;
  insert into workforce_schedule_history(schedule_id,employee_id,actor_id,snapshot) values(result.id,e.id,auth.uid(),to_jsonb(result));
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_schedules',result.id,case when p_id is null then 'INSERT' else 'UPDATE' end,array['starts_on','ends_on','timezone','daily_minutes','cancelled','reason']);
  return result.id;
end $$;
revoke all on function public.workforce_save_schedule(uuid,uuid,integer,date,date,text,integer[],text,boolean) from public,anon;
grant execute on function public.workforce_save_schedule(uuid,uuid,integer,date,date,text,integer[],text,boolean) to authenticated;

-- 0035_workforce_leave_ledger.sql

-- Explicit, per-employee policy adoption. No default amount or legal entitlement.
create table public.workforce_leave_policies (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  owner_id uuid not null references auth.users(id),
  leave_type text not null check(length(trim(leave_type)) between 1 and 80),
  starts_on date not null,
  ends_on date,
  accrual_minutes integer not null check(accrual_minutes between 0 and 525600),
  accrual_cadence text not null check(accrual_cadence='manual_monthly'),
  version integer not null default 1,
  balance_cap_minutes integer check(balance_cap_minutes between 0 and 5256000),
  exclude_holidays boolean not null,
  holidays date[] not null,
  review_reference text not null check(length(trim(review_reference)) between 1 and 1000),
  adopted_by uuid not null,
  adopted_at timestamptz not null default now(),
  check(starts_on between date '1900-01-01' and date '2200-12-31'),
  check(ends_on is null or ends_on between starts_on and date '2200-12-31')
);
create table public.workforce_leave_ledger (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.workforce_leave_policies(id),
  employee_id uuid not null references public.employees(id),
  owner_id uuid not null references auth.users(id),
  effective_on date not null,
  kind text not null check(kind in ('opening','accrual','taken','adjustment','carryover')),
  minutes integer not null,
  reference text not null check(length(trim(reference)) between 1 and 200),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(policy_id,reference)
);
create unique index workforce_leave_one_opening on public.workforce_leave_ledger(policy_id) where kind='opening';
create unique index workforce_leave_one_monthly_accrual on public.workforce_leave_ledger(policy_id,(extract(year from effective_on)),(extract(month from effective_on))) where kind='accrual';
create table public.workforce_leave_policy_history (
  id bigint generated always as identity primary key,
  policy_id uuid not null references public.workforce_leave_policies(id),
  employee_id uuid not null references public.employees(id),
  actor_id uuid not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_policy_history enable row level security;
create policy workforce_leave_policy_history_read on public.workforce_leave_policy_history for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_policy_history from anon,authenticated;
grant select on public.workforce_leave_policy_history to authenticated;
alter table public.workforce_leave_policies enable row level security;
alter table public.workforce_leave_ledger enable row level security;
create policy workforce_leave_policies_read on public.workforce_leave_policies for select using(workforce_can_read(employee_id));
create policy workforce_leave_ledger_read on public.workforce_leave_ledger for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_policies,public.workforce_leave_ledger from anon,authenticated;
grant select on public.workforce_leave_policies,public.workforce_leave_ledger to authenticated;

create function public.workforce_adopt_leave_policy(p_employee uuid,p_type text,p_start date,p_end date,p_accrual integer,p_cap integer,p_exclude_holidays boolean,p_holidays date[],p_review text,p_cadence text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e employees; result uuid;
begin
  select * into e from employees where id=p_employee for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  if p_holidays is null or cardinality(p_holidays)>366 or exists(select 1 from unnest(p_holidays) h where h is null or h not between date '1900-01-01' and date '2200-12-31') then raise exception 'Explicit valid holiday calendar required'; end if;
  if exists(select 1 from workforce_leave_policies where employee_id=e.id and lower(trim(leave_type))=lower(trim(p_type)) and starts_on<=coalesce(p_end,date '2200-12-31') and coalesce(ends_on,date '2200-12-31')>=p_start) then raise exception 'Overlapping leave policy'; end if;
  insert into workforce_leave_policies(employee_id,owner_id,leave_type,starts_on,ends_on,accrual_minutes,balance_cap_minutes,exclude_holidays,holidays,review_reference,adopted_by,accrual_cadence)
    values(e.id,e.user_id,trim(p_type),p_start,p_end,p_accrual,p_cap,p_exclude_holidays,p_holidays,trim(p_review),auth.uid(),p_cadence) returning id into result;
  insert into workforce_leave_policy_history(policy_id,employee_id,actor_id,snapshot,reason) select id,employee_id,auth.uid(),to_jsonb(workforce_leave_policies),trim(p_review) from workforce_leave_policies where id=result;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_policies',result,'INSERT',array['policy_adopted']);
  return result;
end $$;

-- Closing a policy preserves both the adoption snapshot and its ledger. A new
-- policy can then be adopted for subsequent dates; balances never transfer silently.
create function public.workforce_close_leave_policy(p_policy uuid,p_version integer,p_end date,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies; e employees;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=p.employee_id for update;
  if coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  select * into p from workforce_leave_policies where id=p_policy for update;
  if p.version is distinct from p_version then raise exception 'Policy changed; refresh first'; end if;
  if p_end is null or p_end<p.starts_on or p_end>coalesce(p.ends_on,date '2200-12-31') then raise exception 'End must shorten the policy without removing its start'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Reason required'; end if;
  if exists(select 1 from workforce_leave_ledger where policy_id=p.id and effective_on>p_end) then raise exception 'Cannot exclude posted entries'; end if;
  update workforce_leave_policies set ends_on=p_end,version=version+1 where id=p.id;
  insert into workforce_leave_policy_history(policy_id,employee_id,actor_id,snapshot,reason) select id,employee_id,auth.uid(),to_jsonb(workforce_leave_policies),trim(p_reason) from workforce_leave_policies where id=p.id;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_policies',p.id,'UPDATE',array['ends_on','version']);
  return true;
end $$;

-- Aggregate inside PostgreSQL, not from a truncated page of journal entries.
create function public.workforce_leave_balance(p_policy uuid,p_as_of date) returns table(configured boolean,minutes bigint,entry_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found or not coalesce(workforce_can_read(p.employee_id),false) then raise exception 'Not authorized'; end if;
  if p_as_of is null or p_as_of not between date '1900-01-01' and current_date then raise exception 'Invalid as-of date'; end if;
  return query select count(*) filter(where kind='opening')=1,
    case when count(*) filter(where kind='opening')=1 then coalesce(sum(l.minutes),0)::bigint else null::bigint end,count(*)
    from workforce_leave_ledger l where l.policy_id=p.id and l.effective_on<=p_as_of;
end $$;

-- Manual reviewed postings only. No scheduled accrual job, automatic leave debit,
-- implicit carryover/reset, or real payroll integration is enabled by this routine.
create function public.workforce_post_leave_entry(p_policy uuid,p_date date,p_kind text,p_minutes integer,p_reference text,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare p workforce_leave_policies; e employees; existing workforce_leave_ledger; opening_date date; latest_date date; current_balance bigint; result uuid;
begin
  select * into p from workforce_leave_policies where id=p_policy;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=p.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  -- Employee lock serializes all postings before checking references/balances.
  -- Refresh after acquiring the lock: a concurrent policy close may have won it.
  select * into p from workforce_leave_policies where id=p_policy;
  select * into existing from workforce_leave_ledger where policy_id=p.id and reference=trim(p_reference);
  if found then
    if existing.effective_on is not distinct from p_date and existing.kind is not distinct from p_kind and existing.minutes is not distinct from p_minutes and existing.reason is not distinct from trim(p_reason) then return existing.id; end if;
    raise exception 'Reference already used with different contents';
  end if;
  if p_date is null or p_date<p.starts_on or p_date>coalesce(p.ends_on,date '2200-12-31') or p_date>current_date then raise exception 'Posting date must be within policy dates and not future'; end if;
  if p_minutes is null or abs(p_minutes::bigint)>5256000 then raise exception 'Invalid minute amount'; end if;
  if p_kind='accrual' and (p_minutes<0 or p_minutes>p.accrual_minutes) then raise exception 'Accrual exceeds adopted amount'; end if;
  if p_kind='taken' and p_minutes>0 then raise exception 'Taken leave must be a debit'; end if;
  select effective_on into opening_date from workforce_leave_ledger where policy_id=p.id and kind='opening';
  select max(effective_on),coalesce(sum(minutes),0) into latest_date,current_balance from workforce_leave_ledger where policy_id=p.id;
  if p_kind='opening' then
    if opening_date is not null then raise exception 'Opening already configured'; end if;
  elsif opening_date is null then raise exception 'Configure opening balance first';
  end if;
  if latest_date is not null and p_date<latest_date then raise exception 'Backdated postings require a current-date correction'; end if;
  if p_kind='accrual' and p.balance_cap_minutes is not null and p_minutes>0 and current_balance+p_minutes>p.balance_cap_minutes then raise exception 'Accrual exceeds balance cap'; end if;
  insert into workforce_leave_ledger(policy_id,employee_id,owner_id,effective_on,kind,minutes,reference,reason,actor_id) values(p.id,e.id,e.user_id,p_date,p_kind,p_minutes,trim(p_reference),trim(p_reason),auth.uid()) returning id into result;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_leave_ledger',result,'INSERT',array['leave_posting']);
  return result;
end $$;
revoke all on function public.workforce_adopt_leave_policy(uuid,text,date,date,integer,integer,boolean,date[],text,text),public.workforce_post_leave_entry(uuid,date,text,integer,text,text),public.workforce_close_leave_policy(uuid,integer,date,text),public.workforce_leave_balance(uuid,date) from public,anon;
grant execute on function public.workforce_adopt_leave_policy(uuid,text,date,date,integer,integer,boolean,date[],text,text),public.workforce_post_leave_entry(uuid,date,text,integer,text,text),public.workforce_close_leave_policy(uuid,integer,date,text),public.workforce_leave_balance(uuid,date) to authenticated;

-- 0036_workforce_leave_request_posting.sql

create table public.workforce_leave_request_postings (
  request_id uuid primary key references public.workforce_requests(id),
  employee_id uuid not null references public.employees(id),
  policy_id uuid not null references public.workforce_leave_policies(id),
  ledger_id uuid not null unique references public.workforce_leave_ledger(id),
  calculation jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_request_postings enable row level security;
create policy workforce_leave_request_postings_read on public.workforce_leave_request_postings for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_request_postings from anon,authenticated;
grant select on public.workforce_leave_request_postings to authenticated;

create function public.workforce_post_approved_leave(p_request uuid,p_policy uuid,p_policy_version integer,p_expected_minutes integer,p_posting_date date,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare r workforce_requests; e employees; p workforce_leave_policies; prior workforce_leave_request_postings; s workforce_schedules; d date; amount integer; total integer:=0; detail jsonb:='[]'; entry uuid; schedule_count integer;
begin
  select * into r from workforce_requests where id=p_request;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=r.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  select * into r from workforce_requests where id=p_request for update;
  select * into prior from workforce_leave_request_postings where request_id=r.id;
  if found then
    if prior.policy_id=p_policy and (prior.calculation->>'minutes')::integer=p_expected_minutes then return prior.ledger_id; end if;
    raise exception 'Request already posted with different calculation';
  end if;
  if e.archived_at is not null or r.kind<>'leave' or r.status<>'approved' then raise exception 'Active profile and approved leave required'; end if;
  if r.starts_on is null or r.ends_on is null or r.ends_on<r.starts_on or r.ends_on-r.starts_on>365 then raise exception 'Invalid leave dates'; end if;
  select * into p from workforce_leave_policies where id=p_policy;
  if not found or p.employee_id<>e.id or p.owner_id<>e.user_id or lower(trim(p.leave_type))<>lower(trim(r.leave_type)) then raise exception 'Matching employee and leave type policy required'; end if;
  if p.version is distinct from p_policy_version then raise exception 'Policy changed; refresh first'; end if;
  if p.starts_on>r.starts_on or coalesce(p.ends_on,date '2200-12-31')<r.ends_on then raise exception 'One policy must cover the entire request'; end if;
  if p_posting_date is null or p_posting_date<r.ends_on then raise exception 'Post completed leave only'; end if;
  d:=r.starts_on;
  while d<=r.ends_on loop
    select count(*) into schedule_count from workforce_schedules where employee_id=e.id and not cancelled and starts_on<=d and coalesce(ends_on,date '2200-12-31')>=d;
    if schedule_count<>1 then raise exception 'Exactly one schedule required for every leave date'; end if;
    select * into s from workforce_schedules where employee_id=e.id and not cancelled and starts_on<=d and coalesce(ends_on,date '2200-12-31')>=d;
    amount:=case when p.exclude_holidays and d=any(p.holidays) then 0 else s.daily_minutes[extract(isodow from d)::integer] end;
    if amount is null or amount<0 or amount>1440 then raise exception 'Invalid scheduled amount'; end if;
    total:=total+amount;
    detail:=detail||jsonb_build_array(jsonb_build_object('date',d,'minutes',amount,'schedule_id',s.id,'schedule_version',s.version,'timezone',s.timezone,'holiday_excluded',p.exclude_holidays and d=any(p.holidays)));
    d:=d+1;
  end loop;
  if total is distinct from p_expected_minutes then raise exception 'Calculated minutes differ from reviewed amount'; end if;
  entry:=workforce_post_leave_entry(p.id,p_posting_date,'taken',-total,'approved-request:'||r.id::text,p_reason);
  insert into workforce_leave_request_postings(request_id,employee_id,policy_id,ledger_id,calculation) values(r.id,e.id,p.id,entry,jsonb_build_object('minutes',total,'policy_id',p.id,'policy_version',p.version,'request_start',r.starts_on,'request_end',r.ends_on,'days',detail));
  return entry;
end $$;
revoke all on function public.workforce_post_approved_leave(uuid,uuid,integer,integer,date,text) from public,anon;
grant execute on function public.workforce_post_approved_leave(uuid,uuid,integer,integer,date,text) to authenticated;

-- 0037_workforce_payroll_analysis.sql

-- Analytical source records only: never payment instructions. Salary data is
-- intentionally restricted to owner/HR, unlike the general personnel directory.
create table public.workforce_payroll_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  reference text not null check(length(trim(reference)) between 1 and 200),
  payload jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  unique(owner_id,reference)
);
create table public.workforce_payroll_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.workforce_payroll_imports(id),
  owner_id uuid not null references auth.users(id),
  employee_id uuid not null references public.employees(id),
  period_start date not null check(period_start between date '1900-01-01' and date '2200-12-31'),
  period_end date not null check(period_end between date '1900-01-01' and date '2200-12-31'),
  currency text not null check(currency in ('USD','EUR','GBP','CAD','AUD','MXN')),
  gross_minor bigint not null check(gross_minor between 0 and 10000000000),
  employer_cost_minor bigint not null check(employer_cost_minor between gross_minor and 10000000000),
  paid_hours_hundredths integer not null,
  source_reference text not null check(length(trim(source_reference)) between 1 and 200 and source_reference !~ '^[=+@-]' and source_reference !~ '[[:cntrl:]]'),
  voided_at timestamptz,
  check(period_end-period_start between 0 and 365),
  check(paid_hours_hundredths between 0 and (period_end-period_start+1)*2400)
);
create unique index workforce_payroll_active_period on public.workforce_payroll_rows(employee_id,period_start,period_end) where voided_at is null;
create index workforce_payroll_import_rows on public.workforce_payroll_rows(import_id);
create table public.workforce_payroll_history (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id),
  import_id uuid not null references public.workforce_payroll_imports(id),
  actor_id uuid not null,
  action text not null check(action in ('IMPORT','VOID')),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.workforce_payroll_imports enable row level security;
alter table public.workforce_payroll_rows enable row level security;
alter table public.workforce_payroll_history enable row level security;
create policy payroll_import_read on public.workforce_payroll_imports for select using(workforce_role(owner_id) in ('owner','hr'));
create policy payroll_row_read on public.workforce_payroll_rows for select using(workforce_role(owner_id) in ('owner','hr'));
create policy payroll_history_read on public.workforce_payroll_history for select using(workforce_role(owner_id) in ('owner','hr'));
revoke all on public.workforce_payroll_imports,public.workforce_payroll_rows,public.workforce_payroll_history from anon,authenticated;
grant select on public.workforce_payroll_imports,public.workforce_payroll_rows,public.workforce_payroll_history to authenticated;

create function public.workforce_import_payroll(p_owner uuid,p_reference text,p_rows jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing workforce_payroll_imports; result uuid; r jsonb; e employees;
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_reference is null or length(trim(p_reference)) not between 1 and 200 then raise exception 'Import reference required'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or octet_length(p_rows::text)>1000000 then raise exception 'Invalid import'; end if;
  if jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Import needs 1 to 500 rows'; end if;
  -- Serialize retries/corrections in this owner workspace, including overlapping periods.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,37));
  select * into existing from workforce_payroll_imports where owner_id=p_owner and reference=trim(p_reference);
  if found then
    if existing.payload=p_rows and existing.voided_at is null then return existing.id; end if;
    raise exception 'Reference already used; refresh or use a new reviewed import reference';
  end if;
  insert into workforce_payroll_imports(owner_id,reference,payload,created_by) values(p_owner,trim(p_reference),p_rows,auth.uid()) returning id into result;
  for r in select value from jsonb_array_elements(p_rows) order by value->>'employeeId' loop
    if jsonb_typeof(r)<>'object' then raise exception 'Invalid payroll row'; end if;
    if (select count(*) from jsonb_object_keys(r))<>8 or not r ?& array['employeeId','periodStart','periodEnd','currency','grossMinor','employerCostMinor','paidHoursHundredths','sourceReference'] then raise exception 'Only analytical fields accepted'; end if;
    if exists(select 1 from jsonb_each(r) x where jsonb_typeof(x.value) is distinct from case when x.key in ('grossMinor','employerCostMinor','paidHoursHundredths') then 'number' else 'string' end) then raise exception 'Invalid field types'; end if;
    if r->>'grossMinor' !~ '^[0-9]+$' or r->>'employerCostMinor' !~ '^[0-9]+$' or r->>'paidHoursHundredths' !~ '^[0-9]+$' or r->>'periodStart' !~ '^\d{4}-\d{2}-\d{2}$' or r->>'periodEnd' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use integer minor units and ISO dates'; end if;
    select * into e from employees where id=(r->>'employeeId')::uuid for update;
    if not found or e.user_id<>p_owner or e.archived_at is not null then raise exception 'Employee is unavailable in this workspace'; end if;
    if exists(select 1 from workforce_payroll_rows where employee_id=e.id and voided_at is null and period_start<=(r->>'periodEnd')::date and period_end>=(r->>'periodStart')::date) then raise exception 'Employee has an overlapping imported period; review and void the old import first'; end if;
    insert into workforce_payroll_rows(import_id,owner_id,employee_id,period_start,period_end,currency,gross_minor,employer_cost_minor,paid_hours_hundredths,source_reference)
      values(result,p_owner,e.id,(r->>'periodStart')::date,(r->>'periodEnd')::date,r->>'currency',(r->>'grossMinor')::bigint,(r->>'employerCostMinor')::bigint,(r->>'paidHoursHundredths')::integer,trim(r->>'sourceReference'));
  end loop;
  insert into workforce_payroll_history(owner_id,import_id,actor_id,action,reason) values(p_owner,result,auth.uid(),'IMPORT','Reviewed analytical import');
  return result;
end $$;

-- Correction is explicit: void the whole batch, preserving source and history,
-- then submit the corrected batch under a new reference. No silent overwrites.
create function public.workforce_void_payroll(p_import uuid,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare b workforce_payroll_imports;
begin
  select * into b from workforce_payroll_imports where id=p_import;
  if not found or coalesce(workforce_role(b.owner_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Correction reason required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,37));
  select * into b from workforce_payroll_imports where id=p_import for update;
  if b.voided_at is not null then return false; end if;
  update workforce_payroll_imports set voided_at=now() where id=b.id;
  update workforce_payroll_rows set voided_at=now() where import_id=b.id;
  insert into workforce_payroll_history(owner_id,import_id,actor_id,action,reason) values(b.owner_id,b.id,auth.uid(),'VOID',trim(p_reason));
  return true;
end $$;

-- One bounded import at a time. PostgreSQL totals every row, not a REST page.
create function public.workforce_payroll_totals(p_import uuid) returns table(currency text,period_start date,period_end date,employees bigint,gross_minor numeric,employer_cost_minor numeric,paid_hours_hundredths bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare b workforce_payroll_imports;
begin
  select * into b from workforce_payroll_imports where id=p_import;
  if not found or coalesce(workforce_role(b.owner_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  return query select r.currency,r.period_start,r.period_end,count(*),sum(r.gross_minor),sum(r.employer_cost_minor),sum(r.paid_hours_hundredths) from workforce_payroll_rows r where r.import_id=b.id and r.voided_at is null group by r.currency,r.period_start,r.period_end order by r.period_start,r.currency;
end $$;
revoke all on function public.workforce_import_payroll(uuid,text,jsonb),public.workforce_void_payroll(uuid,text),public.workforce_payroll_totals(uuid) from public,anon;
grant execute on function public.workforce_import_payroll(uuid,text,jsonb),public.workforce_void_payroll(uuid,text),public.workforce_payroll_totals(uuid) to authenticated;

-- 0038_workforce_training_evidence.sql

-- Explicit training-only shares. Existing vault/storage permissions are unchanged.
-- A link pins the current storage object and digest; replacement never silently
-- substitutes a different certificate. Revocation retains metadata for audit.
create table public.workforce_training_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workforce_tasks(id),
  employee_id uuid not null references public.employees(id),
  owner_id uuid not null references auth.users(id),
  document_id uuid references public.vault_documents(id) on delete set null,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  storage_key text not null,
  scan_sha256 text not null check(scan_sha256 ~ '^[a-f0-9]{64}$'),
  shared_by uuid not null,
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  unique(task_id,document_id,storage_key)
);
create index workforce_evidence_task on public.workforce_training_evidence(task_id);
alter table public.workforce_training_evidence enable row level security;
create policy workforce_evidence_read on public.workforce_training_evidence for select using(workforce_can_read(employee_id));
revoke all on public.workforce_training_evidence from public,anon,authenticated;
-- Storage locators and file fingerprints are server-only.
grant select(id,task_id,employee_id,owner_id,document_id,original_name,content_type,size_bytes,shared_by,shared_at,revoked_at,revoked_by,revoke_reason) on public.workforce_training_evidence to authenticated;

create function public.workforce_share_training_evidence(p_task uuid,p_version integer,p_document uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare t workforce_tasks; e employees; d vault_documents; existing workforce_training_evidence; result uuid;
begin
  select * into t from workforce_tasks where id=p_task;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=t.employee_id for update;
  select * into t from workforce_tasks where id=p_task for update;
  if not coalesce(workforce_can_read(e.id),false) or not coalesce(workforce_can_manage(e.id) or t.assignee_id=auth.uid(),false) then raise exception 'Not authorized'; end if;
  if e.archived_at is not null or t.category<>'training' or t.status<>'open' or t.version is distinct from p_version then raise exception 'Use a current open training task'; end if;
  select * into d from vault_documents where id=p_document and owner_id=auth.uid() for share;
  if not found then raise exception 'Only your own uploaded document can be shared'; end if;
  if not coalesce(d.security_status in ('basic_validated','malware_scanned'),false) or d.scan_sha256 is null or d.scan_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'File must finish security screening'; end if;
  select * into existing from workforce_training_evidence where task_id=t.id and document_id=d.id and storage_key=d.storage_key;
  if found then
    if existing.revoked_at is null then return existing.id; end if;
    raise exception 'This share was revoked; upload a new reviewed version';
  end if;
  if (select count(*) from workforce_training_evidence where task_id=t.id and revoked_at is null)>=10 then raise exception 'At most 10 active attachments per task'; end if;
  insert into workforce_training_evidence(task_id,employee_id,owner_id,document_id,original_name,content_type,size_bytes,storage_key,scan_sha256,shared_by)
    values(t.id,e.id,e.user_id,d.id,d.original_name,d.content_type,d.size_bytes,d.storage_key,d.scan_sha256,auth.uid()) returning id into result;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(e.user_id,e.id,auth.uid(),'workforce_training_evidence',result,'INSERT',array['explicit_file_share']);
  return result;
end $$;

create function public.workforce_revoke_training_evidence(p_evidence uuid,p_reason text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare a workforce_training_evidence;
begin
  select * into a from workforce_training_evidence where id=p_evidence for update;
  if not found or not coalesce(workforce_can_read(a.employee_id),false) or not (a.shared_by=auth.uid() or coalesce(workforce_role(a.owner_id),'') in ('owner','hr')) then raise exception 'Not authorized'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Revocation reason required'; end if;
  if a.revoked_at is not null then return false; end if;
  update workforce_training_evidence set revoked_at=now(),revoked_by=auth.uid(),revoke_reason=trim(p_reason) where id=a.id;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(a.owner_id,a.employee_id,auth.uid(),'workforce_training_evidence',a.id,'UPDATE',array['share_revoked']);
  return true;
end $$;

-- Re-check at download time. No signed URL or storage policy is created here.
-- The serving route must also compare the actual object bytes to scan_sha256.
create function public.workforce_training_evidence_available(p_evidence uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from workforce_training_evidence a join vault_documents d on d.id=a.document_id
    join employees e on e.id=a.employee_id
    where a.id=p_evidence and a.revoked_at is null and e.archived_at is null
      and workforce_can_read(a.employee_id)
      and d.owner_id=a.shared_by and d.storage_key=a.storage_key and d.scan_sha256=a.scan_sha256
      and d.security_status in ('basic_validated','malware_scanned'))
$$;
create function public.workforce_record_evidence_download(p_evidence uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare a workforce_training_evidence;
begin
  if not workforce_training_evidence_available(p_evidence) then return false; end if;
  select * into a from workforce_training_evidence where id=p_evidence;
  insert into workforce_history(owner_id,employee_id,actor_id,entity,entity_id,action,changed_fields) values(a.owner_id,a.employee_id,auth.uid(),'workforce_training_evidence',a.id,'DOWNLOAD',array['file_downloaded']);
  return true;
end $$;
revoke all on function public.workforce_record_evidence_download(uuid) from public,anon;
grant execute on function public.workforce_record_evidence_download(uuid) to authenticated;
revoke all on function public.workforce_share_training_evidence(uuid,integer,uuid),public.workforce_revoke_training_evidence(uuid,text),public.workforce_training_evidence_available(uuid) from public,anon;
grant execute on function public.workforce_share_training_evidence(uuid,integer,uuid),public.workforce_revoke_training_evidence(uuid,text),public.workforce_training_evidence_available(uuid) to authenticated;

-- 0039_workforce_reminders.sql

-- Live in-app reminders, not email delivery. Generated from current source state
-- so completing a task or revoking membership immediately changes the result.
create function public.workforce_reminders(p_owner uuid) returns table(
  source_id uuid,kind text,title text,employee_id uuid,employee_name text,due_on date,
  business_today date,business_timezone text,total_count bigint
) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare viewer_role text; zone text; today date;
begin
  viewer_role:=workforce_role(p_owner);
  if coalesce(viewer_role,'') not in ('owner','hr','manager','employee') then raise exception 'Not authorized'; end if;
  select timezone into zone from workforce_business_settings where owner_id=p_owner;
  zone:=coalesce(zone,'UTC'); today:=(now() at time zone zone)::date;
  return query with candidates as (
    select t.id source_id,case when t.due_on<today then 'overdue_task' else 'upcoming_task' end kind,t.title,e.id employee_id,e.full_name employee_name,t.due_on
    from workforce_tasks t join employees e on e.id=t.employee_id
    where t.owner_id=p_owner and e.archived_at is null and workforce_can_read(e.id)
      and t.assignee_id=auth.uid() and t.status='open' and t.due_on<=today+7
    union all
    select r.id,case when r.kind='leave' then 'review_leave' else 'review_profile' end,r.title,e.id,e.full_name,r.starts_on
    from workforce_requests r join employees e on e.id=r.employee_id
    where r.owner_id=p_owner and e.archived_at is null and workforce_can_manage(e.id)
      and r.status='pending' and r.created_by<>auth.uid()
      and (viewer_role in ('owner','hr') or (viewer_role='manager' and r.kind='leave' and r.approver_id=auth.uid()))
    union all
    select t.id,'verify_task',t.title,e.id,e.full_name,t.due_on
    from workforce_tasks t join employees e on e.id=t.employee_id
    where t.owner_id=p_owner and e.archived_at is null and workforce_can_manage(e.id)
      and t.status='completed' and t.verified_at is null and t.completed_by<>auth.uid()
    union all
    select r.id,'renewal',r.title,e.id,e.full_name,r.expires_on
    from employee_records r join employees e on e.id=r.employee_id
    where r.user_id=p_owner and e.archived_at is null and workforce_can_read(e.id)
      and r.record_type='certification' and r.expires_on<=today+30
  ) select c.source_id,c.kind,c.title,c.employee_id,c.employee_name,c.due_on,today,zone,count(*) over()
      from candidates c order by c.due_on nulls last,c.kind,c.source_id limit 100;
end $$;
revoke all on function public.workforce_reminders(uuid) from public,anon;
grant execute on function public.workforce_reminders(uuid) to authenticated;

-- 0040_workforce_leave_carryover.sql

-- Reviewed transfers only. Never infer forfeiture, cash payout or legal limits.
create table public.workforce_leave_transfers (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  source_policy uuid not null references public.workforce_leave_policies(id),
  target_policy uuid not null unique references public.workforce_leave_policies(id),
  source_entry uuid not null unique references public.workforce_leave_ledger(id),
  target_entry uuid not null unique references public.workforce_leave_ledger(id),
  minutes integer not null check(minutes between 0 and 5256000),
  source_balance_before bigint not null,
  source_version integer not null,
  target_version integer not null,
  reason text not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.workforce_leave_transfers enable row level security;
create policy workforce_leave_transfer_read on public.workforce_leave_transfers for select using(workforce_can_read(employee_id));
revoke all on public.workforce_leave_transfers from public,anon,authenticated;
grant select on public.workforce_leave_transfers to authenticated;

create function public.workforce_transfer_leave(p_source uuid,p_target uuid,p_source_version integer,p_target_version integer,p_expected_balance bigint,p_minutes integer,p_reason text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare s workforce_leave_policies; d workforce_leave_policies; e employees; existing workforce_leave_transfers; b bigint; configured boolean; debit uuid; credit uuid; result uuid;
begin
  select * into s from workforce_leave_policies where id=p_source;
  if not found then raise exception 'Not authorized'; end if;
  select * into e from employees where id=s.employee_id for update;
  if not found or coalesce(workforce_role(e.user_id),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  if e.archived_at is not null then raise exception 'Restore employee first'; end if;
  select * into s from workforce_leave_policies where id=p_source;
  select * into d from workforce_leave_policies where id=p_target;
  if not found or d.employee_id<>e.id or d.owner_id<>s.owner_id or lower(trim(d.leave_type))<>lower(trim(s.leave_type)) or d.id=s.id then raise exception 'Choose the same employee and leave type'; end if;
  select * into existing from workforce_leave_transfers where target_policy=d.id;
  if found then
    if existing.source_policy=s.id and existing.minutes=p_minutes and existing.reason=trim(p_reason) then return existing.id; end if;
    raise exception 'Target already has a different transfer';
  end if;
  if s.version is distinct from p_source_version or d.version is distinct from p_target_version then raise exception 'Policy changed; refresh first'; end if;
  if s.ends_on is null or s.ends_on>=d.starts_on or d.starts_on>current_date then raise exception 'Close the earlier policy and wait until the new period begins'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_minutes is null or p_minutes not between 0 and 5256000 then raise exception 'Reviewed amount and reason required'; end if;
  select x.configured,x.minutes into configured,b from workforce_leave_balance(s.id,s.ends_on) x;
  if not configured or b is distinct from p_expected_balance then raise exception 'Source balance missing or changed; refresh first'; end if;
  if p_minutes>b or b<0 then raise exception 'Cannot transfer more than the nonnegative source balance'; end if;
  if d.balance_cap_minutes is not null and p_minutes>d.balance_cap_minutes then raise exception 'Transfer exceeds adopted target balance cap'; end if;
  if exists(select 1 from workforce_leave_ledger where policy_id=d.id) then raise exception 'Target must not already have an opening or postings'; end if;
  debit:=workforce_post_leave_entry(s.id,s.ends_on,'carryover',-p_minutes,'transfer-out:'||d.id,trim(p_reason));
  credit:=workforce_post_leave_entry(d.id,d.starts_on,'opening',p_minutes,'transfer-in:'||s.id,trim(p_reason));
  insert into workforce_leave_transfers(employee_id,source_policy,target_policy,source_entry,target_entry,minutes,source_balance_before,source_version,target_version,reason,actor_id)
    values(e.id,s.id,d.id,debit,credit,p_minutes,b,s.version,d.version,trim(p_reason),auth.uid()) returning id into result;
  return result;
end $$;
revoke all on function public.workforce_transfer_leave(uuid,uuid,integer,integer,bigint,integer,text) from public,anon;
grant execute on function public.workforce_transfer_leave(uuid,uuid,integer,integer,bigint,integer,text) to authenticated;

-- 0041_workforce_payroll_periods.sql

-- Aggregate in PostgreSQL before limiting displayed periods. Never sum a REST page.
create function public.workforce_payroll_periods(p_owner uuid)
returns table(currency text,period_start date,period_end date,employees bigint,imports bigint,gross_minor numeric,employer_cost_minor numeric,paid_hours_hundredths bigint,cost_per_paid_hour numeric,total_periods bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if coalesce(workforce_role(p_owner),'') not in ('owner','hr') then raise exception 'Not authorized'; end if;
  return query
    with grouped as (
      select r.currency,r.period_start,r.period_end,count(distinct r.employee_id) employees,count(distinct r.import_id) imports,
        sum(r.gross_minor) gross_minor,sum(r.employer_cost_minor) employer_cost_minor,sum(r.paid_hours_hundredths) paid_hours_hundredths
      from workforce_payroll_rows r join workforce_payroll_imports b on b.id=r.import_id and b.owner_id=r.owner_id
      where r.owner_id=p_owner and r.voided_at is null and b.voided_at is null
      group by r.currency,r.period_start,r.period_end
    )
    select g.currency,g.period_start,g.period_end,g.employees,g.imports,g.gross_minor,g.employer_cost_minor,g.paid_hours_hundredths,
      round(g.employer_cost_minor/nullif(g.paid_hours_hundredths,0),2),count(*) over()
    from grouped g order by g.period_end desc,g.period_start desc,g.currency limit 100;
end $$;
revoke all on function public.workforce_payroll_periods(uuid) from public,anon;
grant execute on function public.workforce_payroll_periods(uuid) to authenticated;

do $$
declare t text; contents jsonb; before_state jsonb;
begin
  foreach t in array array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',t) into contents;
    select snapshot into before_state from workforce_bootstrap_preservation where name=t;
    if contents is distinct from before_state then raise exception 'Billing preservation failed: %',t; end if;
  end loop;
  select snapshot into before_state from workforce_bootstrap_preservation where name='routines';
  select coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) order by oid),'[]'::jsonb) into contents from pg_proc where oid in (select (r->>'oid')::oid from jsonb_array_elements(before_state) r);
  if contents is distinct from before_state then raise exception 'Existing routine preservation failed'; end if;
  if (select to_jsonb(count(*)) from auth.users) is distinct from (select snapshot from workforce_bootstrap_preservation where name='auth_count') then raise exception 'Existing account count changed'; end if;
end $$;
commit;
