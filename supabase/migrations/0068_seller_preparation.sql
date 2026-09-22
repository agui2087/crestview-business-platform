create table public.seller_preparation (
 listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
 completed_steps text[] not null default '{}',
 updated_at timestamptz not null default now(),
 check(completed_steps <@ array['authority','periods','reconciliation','adjustments','assets','transfer','confidentiality','questions']::text[] and cardinality(completed_steps)<=8)
);
alter table public.seller_preparation enable row level security;
revoke all on public.seller_preparation from public,anon,authenticated;
grant select,insert,update on public.seller_preparation to authenticated;
create policy "seller preparation owner only" on public.seller_preparation for all to authenticated
 using(exists(select 1 from public.marketplace_listings l where l.id=listing_id and l.broker_id=auth.uid()))
 with check(exists(select 1 from public.marketplace_listings l where l.id=listing_id and l.broker_id=auth.uid()));
