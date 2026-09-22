create table public.buyer_preparation (
 user_id uuid primary key references auth.users(id) on delete cascade,
 path text not null default 'preparing' check(path in('preparing','searching')),
 completed_steps text[] not null default '{}',
 updated_at timestamptz not null default now(),
 check(completed_steps<@array['goals','role','budget','reserves','financing','advisors','financials','confidentiality']::text[] and cardinality(completed_steps)<=8)
);
alter table public.buyer_preparation enable row level security;
revoke all on public.buyer_preparation from public,anon,authenticated;
grant select,insert,update,delete on public.buyer_preparation to authenticated;
create policy "buyer preparation private" on public.buyer_preparation for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create trigger buyer_preparation_timestamp before insert or update on public.buyer_preparation for each row execute function public.timestamp_broker_profile();

-- A self-editable profile must never grant a verified badge.
create function public.guard_self_verification_claims() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then
  if TG_TABLE_NAME='profiles' then
   if TG_OP='INSERT' then
    if new.verification_status<>'unverified' or new.verification_note is not null then raise exception 'Verification requires independent review';end if;
   elsif (new.verification_status,new.verification_note) is distinct from (old.verification_status,old.verification_note) then raise exception 'Verification requires independent review';end if;
  elsif TG_OP='INSERT' then
   if new.proof_of_funds_status='verified' then raise exception 'Funds cannot be self-verified';end if;
  elsif new.proof_of_funds_status='verified' and new.proof_of_funds_status is distinct from old.proof_of_funds_status then raise exception 'Funds cannot be self-verified';end if;
 end if;
 return new;
end;$$;
create trigger protect_account_verification before insert or update on public.profiles for each row execute function public.guard_self_verification_claims();
create trigger protect_funds_verification before insert or update on public.buyer_preferences for each row execute function public.guard_self_verification_claims();
