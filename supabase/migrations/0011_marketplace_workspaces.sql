alter table public.profiles
  add column if not exists account_roles text[] not null default array['buyer']::text[];

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, locale, account_roles)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end,
    case
      when new.raw_user_meta_data -> 'account_roles' is not null
        then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'account_roles'))
      else array['buyer']::text[]
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null,
  industry text not null,
  city text not null,
  state_code text not null,
  asking_price numeric,
  annual_revenue numeric,
  cash_flow numeric,
  financing_available boolean not null default false,
  public_highlights text[] not null default '{}'::text[],
  confidential_notes text,
  status text not null default 'draft'
    check (status in ('draft','published','paused','under_offer','sold','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  initial_message text not null,
  acquisition_experience text,
  funding_readiness text,
  requested_items text[] not null default array['NDA','Financial statements','Confidential information memorandum']::text[],
  status text not null default 'submitted'
    check (status in ('submitted','screening','approved','declined','nda_sent','nda_signed','document_review','meeting','offer','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table if not exists public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.deal_ndas (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null unique references public.deal_inquiries(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null,
  storage_path text,
  template_body text,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','signed','declined','superseded')),
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_ip_hash text,
  signature_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_room_documents (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  storage_path text,
  external_url text,
  access_level text not null default 'nda_signed'
    check (access_level in ('broker_only','approved','nda_signed')),
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inquiry_id uuid references public.deal_inquiries(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_status_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.deal_inquiries(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_listings_status_location_idx
  on public.marketplace_listings(status, state_code, city);
create index if not exists deal_inquiries_buyer_idx on public.deal_inquiries(buyer_id, updated_at desc);
create index if not exists deal_inquiries_broker_idx on public.deal_inquiries(broker_id, updated_at desc);
create index if not exists deal_messages_inquiry_idx on public.deal_messages(inquiry_id, created_at);
create index if not exists notifications_user_idx on public.marketplace_notifications(user_id, read_at, created_at desc);

alter table public.marketplace_listings enable row level security;
alter table public.deal_inquiries enable row level security;
alter table public.deal_messages enable row level security;
alter table public.deal_ndas enable row level security;
alter table public.deal_room_documents enable row level security;
alter table public.marketplace_notifications enable row level security;
alter table public.deal_status_events enable row level security;

create policy "published listings readable" on public.marketplace_listings
  for select using (status = 'published' or broker_id = auth.uid());
create policy "brokers manage own listings" on public.marketplace_listings
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

create policy "inquiry participants" on public.deal_inquiries
  for select using (buyer_id = auth.uid() or broker_id = auth.uid());
create policy "buyers create inquiries" on public.deal_inquiries
  for insert with check (buyer_id = auth.uid());
create policy "participants update inquiries" on public.deal_inquiries
  for update using (buyer_id = auth.uid() or broker_id = auth.uid());

create policy "message participants" on public.deal_messages
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );
create policy "participants send messages" on public.deal_messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

create policy "nda participants" on public.deal_ndas
  for select using (buyer_id = auth.uid() or broker_id = auth.uid());
create policy "brokers create ndas" on public.deal_ndas
  for insert with check (broker_id = auth.uid());
create policy "nda participants update" on public.deal_ndas
  for update using (buyer_id = auth.uid() or broker_id = auth.uid());

create policy "room participants" on public.deal_room_documents
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
        and (
          i.broker_id = auth.uid()
          or access_level = 'approved'
          or (access_level = 'nda_signed' and i.status in ('nda_signed','document_review','meeting','offer','closed'))
        )
    )
  );
create policy "brokers manage room documents" on public.deal_room_documents
  for all using (
    exists (select 1 from public.deal_inquiries i where i.id = inquiry_id and i.broker_id = auth.uid())
  ) with check (
    exists (select 1 from public.deal_inquiries i where i.id = inquiry_id and i.broker_id = auth.uid())
  );

create policy "notifications self" on public.marketplace_notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "status event participants" on public.deal_status_events
  for select using (
    exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );
create policy "participants create status events" on public.deal_status_events
  for insert with check (
    actor_id = auth.uid() and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

grant select, insert, update, delete on public.marketplace_listings to authenticated;
grant select, insert, update on public.deal_inquiries to authenticated;
grant select, insert, update on public.deal_messages to authenticated;
grant select, insert, update on public.deal_ndas to authenticated;
grant select, insert, update, delete on public.deal_room_documents to authenticated;
grant select, insert, update, delete on public.marketplace_notifications to authenticated;
grant select, insert on public.deal_status_events to authenticated;
