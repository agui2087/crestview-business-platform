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
