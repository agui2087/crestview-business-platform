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
