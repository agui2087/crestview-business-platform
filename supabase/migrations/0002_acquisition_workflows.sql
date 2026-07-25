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
