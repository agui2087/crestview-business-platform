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
