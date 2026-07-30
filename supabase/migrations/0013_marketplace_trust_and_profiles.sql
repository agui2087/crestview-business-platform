alter table public.profiles
  add column if not exists primary_role text not null default 'buyer'
    check (primary_role in ('buyer','broker','advisor')),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  add column if not exists verification_note text;

alter table public.buyer_preferences
  add column if not exists minimum_price numeric,
  add column if not exists acquisition_timeline text,
  add column if not exists funding_status text,
  add column if not exists proof_of_funds_status text not null default 'not_provided'
    check (proof_of_funds_status in ('not_provided','available','verified')),
  add column if not exists buyer_summary text;

alter table public.marketplace_listings
  add column if not exists quality_score integer not null default 0
    check (quality_score between 0 and 100);

alter table public.deal_room_documents
  add column if not exists permission_note text;

create table if not exists public.marketplace_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists marketplace_audit_inquiry_idx
  on public.marketplace_audit_events(inquiry_id, created_at desc);
create index if not exists marketplace_reports_status_idx
  on public.marketplace_reports(status, created_at desc);

alter table public.marketplace_audit_events enable row level security;
alter table public.marketplace_reports enable row level security;

create policy "audit participants read" on public.marketplace_audit_events
  for select using (
    actor_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
    or exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id and l.broker_id = auth.uid()
    )
  );

create policy "participants create audit events" on public.marketplace_audit_events
  for insert with check (
    actor_id = auth.uid()
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
  );

create policy "users create reports" on public.marketplace_reports
  for insert with check (reporter_id = auth.uid());
create policy "users read own reports" on public.marketplace_reports
  for select using (reporter_id = auth.uid());

drop policy if exists "notifications self" on public.marketplace_notifications;
create policy "notifications self read update delete" on public.marketplace_notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participants create notifications" on public.marketplace_notifications
  for insert with check (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (user_id = i.buyer_id or user_id = i.broker_id)
    )
  );

create policy "deal participants read counterpart profiles" on public.profiles
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where (i.buyer_id = auth.uid() and i.broker_id = profiles.user_id)
         or (i.broker_id = auth.uid() and i.buyer_id = profiles.user_id)
    )
  );

create policy "brokers read inquiry buyer preferences" on public.buyer_preferences
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.deal_inquiries i
      where i.broker_id = auth.uid() and i.buyer_id = buyer_preferences.user_id
    )
  );

grant select, insert on public.marketplace_audit_events to authenticated;
grant select, insert on public.marketplace_reports to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  selected_role text;
begin
  selected_role := case
    when new.raw_user_meta_data ->> 'primary_role' in ('buyer','broker','advisor')
      then new.raw_user_meta_data ->> 'primary_role'
    else 'buyer'
  end;
  insert into public.profiles (
    user_id, display_name, locale, account_roles, primary_role, onboarding_completed
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end,
    case
      when selected_role = 'advisor' then array['advisor']::text[]
      else array[selected_role]::text[]
    end,
    selected_role,
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
