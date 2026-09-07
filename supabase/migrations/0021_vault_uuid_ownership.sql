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
