-- Listing rows are readable by prospective buyers. Broker notes must not live there.
create table public.listing_private_notes (
 listing_id uuid primary key references public.marketplace_listings(id) on delete cascade deferrable initially deferred,
 broker_id uuid not null references auth.users(id) on delete cascade,
 notes text not null,
 updated_at timestamptz not null default now()
);
alter table public.listing_private_notes enable row level security;
revoke all on public.listing_private_notes from public,anon,authenticated;
grant select on public.listing_private_notes to authenticated;
create policy "listing notes owner only" on public.listing_private_notes for select to authenticated
 using(broker_id=auth.uid() and exists(select 1 from public.marketplace_listings l where l.id=listing_id and l.broker_id=auth.uid()));

-- Preserve existing values without returning their contents or changing listing freshness.
insert into public.listing_private_notes(listing_id,broker_id,notes)
 select id,broker_id,confidential_notes from public.marketplace_listings where confidential_notes is not null;
update public.marketplace_listings set confidential_notes=null where confidential_notes is not null;

create function public.protect_listing_private_notes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.confidential_notes is not null then
  if length(new.confidential_notes)>10000 then raise exception 'Private notes must be at most 10000 characters'; end if;
  insert into public.listing_private_notes(listing_id,broker_id,notes)
   values(new.id,new.broker_id,new.confidential_notes)
   on conflict(listing_id) do update set notes=excluded.notes,updated_at=now();
 end if;
 new.confidential_notes := null;
 return new;
end; $$;
revoke all on function public.protect_listing_private_notes() from public,anon,authenticated;
create trigger protect_listing_private_notes before insert or update on public.marketplace_listings
 for each row execute function public.protect_listing_private_notes();
