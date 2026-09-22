-- Public-facing information is deliberately separate from private account data.
create table public.broker_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 2 and 100),
 brokerage text not null default '' check(length(brokerage)<=160),
 biography text not null default '' check(length(biography)<=2000),
 service_areas text not null default '' check(length(service_areas)<=500),
 specialties text not null default '' check(length(specialties)<=500),
 languages text not null default '' check(length(languages)<=200),
 buyer_approach text not null default '' check(length(buyer_approach)<=1000),
 welcomes_preparing_buyers boolean not null default true,
 published boolean not null default false,
 updated_at timestamptz not null default now(),
 check(not published or length(trim(biography))>=40)
);
alter table public.broker_profiles enable row level security;
revoke all on public.broker_profiles from public,anon,authenticated;
grant select on public.broker_profiles to anon,authenticated;
grant insert,update,delete on public.broker_profiles to authenticated;
-- Role checks run with a fixed search path so public reads do not expose profiles.
create function public.is_broker_profile_owner(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=target and 'broker'=any(p.account_roles));
$$;
revoke all on function public.is_broker_profile_owner(uuid) from public;
grant execute on function public.is_broker_profile_owner(uuid) to anon,authenticated;
create policy "broker profiles public or owner read" on public.broker_profiles for select
 using(auth.uid()=user_id or (published and public.is_broker_profile_owner(user_id)));
create policy "brokers insert own profile" on public.broker_profiles for insert to authenticated
 with check(auth.uid()=user_id and public.is_broker_profile_owner(user_id));
create policy "brokers update own profile" on public.broker_profiles for update to authenticated
 using(auth.uid()=user_id and public.is_broker_profile_owner(user_id)) with check(auth.uid()=user_id and public.is_broker_profile_owner(user_id));
create policy "owners delete own profile" on public.broker_profiles for delete to authenticated using(auth.uid()=user_id);
create function public.timestamp_broker_profile() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
create trigger broker_profile_timestamp before insert or update on public.broker_profiles for each row execute function public.timestamp_broker_profile();
