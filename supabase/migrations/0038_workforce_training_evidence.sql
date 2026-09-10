begin;
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
commit;
