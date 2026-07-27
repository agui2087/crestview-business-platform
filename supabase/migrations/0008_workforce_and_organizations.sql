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
