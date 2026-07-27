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
