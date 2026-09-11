-- Analysis is performed by a Crestview-controlled worker, not a hosted AI API.
alter table public.ai_analysis_usage alter column opportunity_id drop not null;
create table public.private_document_analysis_jobs (
  id uuid primary key references public.ai_analysis_usage(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.vault_documents(id) on delete cascade,
  document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  locale text not null check(locale in ('en','es')),
  status text not null default 'queued' check(status in ('queued','processing','completed','failed')),
  lease_token uuid,
  leased_until timestamptz,
  result jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index private_analysis_queue_idx on public.private_document_analysis_jobs(status,created_at);
alter table public.private_document_analysis_jobs enable row level security;
revoke all on public.private_document_analysis_jobs from public,anon,authenticated;
grant all on public.private_document_analysis_jobs to service_role;

create function public.queue_private_document_analysis(p_document_id uuid,p_locale text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); doc public.vault_documents; job_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_locale not in ('en','es') or p_locale is null then raise exception 'Invalid locale'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into doc from public.vault_documents where id=p_document_id and owner_id=uid for share;
  if not found then raise exception 'Document access denied'; end if;
  if doc.content_type<>'application/pdf' or doc.size_bytes not between 1 and 10485760
    or doc.security_status not in ('basic_validated','malware_scanned') or doc.scan_sha256 is null
    or doc.scan_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Checked PDF required'; end if;
  if not exists(select 1 from public.billing_entitlements where user_id=uid and product_code='crestview_pro'
    and active and (expires_at is null or expires_at>now())) then raise exception 'Pro entitlement required'; end if;
  -- Repeated clicks reuse the pending job. A replaced file receives a new job.
  select id into job_id from public.private_document_analysis_jobs where user_id=uid and document_id=p_document_id
    and document_sha256=doc.scan_sha256 and (status='queued' or (status='processing' and leased_until>now())) limit 1;
  if job_id is not null then return job_id; end if;
  if (select count(*) from public.ai_analysis_usage where user_id=uid and created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.ai_analysis_usage where user_id=uid and created_at>now()-interval '1 day')>=20 then raise exception 'Analysis rate limit reached'; end if;
  insert into public.ai_analysis_usage(user_id) values(uid) returning id into job_id;
  insert into public.private_document_analysis_jobs(id,user_id,document_id,document_sha256,locale)
    values(job_id,uid,p_document_id,doc.scan_sha256,p_locale);
  return job_id;
end; $$;

create function public.read_private_document_analysis(p_document_id uuid)
returns table(id uuid,status text,result jsonb,failure_code text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select j.id,case when j.status='processing' and j.leased_until<now() then 'failed' else j.status end,
    case when j.status='completed' then j.result else null end,
    case when j.status='processing' and j.leased_until<now() then 'worker_unavailable' else j.failure_code end,j.created_at
  from public.private_document_analysis_jobs j join public.vault_documents d on d.id=j.document_id
  where j.user_id=auth.uid() and d.owner_id=auth.uid() and d.id=p_document_id
    and d.scan_sha256=j.document_sha256 and d.security_status in ('basic_validated','malware_scanned')
  order by j.created_at desc limit 1;
$$;

create function public.claim_private_document_analysis()
returns table(id uuid,lease_token uuid,document_id uuid,user_id uuid,document_sha256 text,storage_key text,size_bytes bigint,locale text)
language plpgsql security definer set search_path='' as $$
declare picked uuid; token uuid:=gen_random_uuid();
begin
  -- No indefinite leases or automatic repeat disclosure to a model after a crash.
  update public.private_document_analysis_jobs set status='failed',failure_code='worker_unavailable',completed_at=now()
    where status='processing' and leased_until<now();
  update public.private_document_analysis_jobs j set status='failed',failure_code='source_unavailable',completed_at=now()
    where j.status='queued' and not exists (
      select 1 from public.vault_documents d join public.billing_entitlements e on e.user_id=j.user_id and e.product_code='crestview_pro'
      where d.id=j.document_id and d.owner_id=j.user_id and d.scan_sha256=j.document_sha256
      and d.security_status in ('basic_validated','malware_scanned') and e.active and (e.expires_at is null or e.expires_at>now())
    );
  update public.ai_analysis_usage u set status='failed',completed_at=j.completed_at
    from public.private_document_analysis_jobs j where u.id=j.id and j.status='failed' and u.status<>'failed';
  select j.id into picked from public.private_document_analysis_jobs j where j.status='queued'
    order by j.created_at for update skip locked limit 1;
  if picked is null then return; end if;
  update public.private_document_analysis_jobs j set status='processing',lease_token=token,leased_until=now()+interval '40 minutes' where j.id=picked;
  return query select j.id,j.lease_token,d.id,j.user_id,j.document_sha256,d.storage_key,d.size_bytes,j.locale
    from public.private_document_analysis_jobs j join public.vault_documents d on d.id=j.document_id
    join public.billing_entitlements e on e.user_id=j.user_id and e.product_code='crestview_pro'
    where j.id=picked and d.owner_id=j.user_id and d.scan_sha256=j.document_sha256
    and d.security_status in ('basic_validated','malware_scanned') and e.active and (e.expires_at is null or e.expires_at>now());
end; $$;

create function public.finish_private_document_analysis(p_id uuid,p_lease_token uuid,p_result jsonb,p_failure_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.private_document_analysis_jobs; valid_source boolean;
begin
  select * into j from public.private_document_analysis_jobs where id=p_id and lease_token=p_lease_token
    and status='processing' and leased_until>now() for update;
  if not found then return false; end if;
  select exists(select 1 from public.vault_documents d join public.billing_entitlements e on e.user_id=d.owner_id and e.product_code='crestview_pro'
    where d.id=j.document_id and d.owner_id=j.user_id and d.scan_sha256=j.document_sha256
    and d.security_status in ('basic_validated','malware_scanned') and e.active and (e.expires_at is null or e.expires_at>now())) into valid_source;
  if not valid_source then p_result:=null;p_failure_code:='source_unavailable'; end if;
  if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>250000) then raise exception 'Invalid analysis result'; end if;
  if p_result is null and coalesce(p_failure_code,'') not in ('source_unavailable','unreadable_pdf','page_limit','page_too_large','ocr_required','model_unavailable','invalid_result','worker_unavailable') then p_failure_code:='worker_unavailable'; end if;
  update public.private_document_analysis_jobs set status=case when p_result is null then 'failed' else 'completed' end,
    result=p_result,failure_code=case when p_result is null then p_failure_code else null end,completed_at=now(),lease_token=null,leased_until=null where id=p_id;
  update public.ai_analysis_usage set status=case when p_result is null then 'failed' else 'completed' end,completed_at=now() where id=p_id;
  return true;
end; $$;
revoke all on function public.queue_private_document_analysis(uuid,text),public.read_private_document_analysis(uuid),public.claim_private_document_analysis(),public.finish_private_document_analysis(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.queue_private_document_analysis(uuid,text),public.read_private_document_analysis(uuid) to authenticated;
grant execute on function public.claim_private_document_analysis(),public.finish_private_document_analysis(uuid,uuid,jsonb,text) to service_role;
