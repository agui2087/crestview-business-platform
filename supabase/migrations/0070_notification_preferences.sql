create table public.buyer_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 messages boolean not null default true,
 documents boolean not null default true,
 deal_status boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.buyer_notification_preferences enable row level security;
revoke all on public.buyer_notification_preferences from public,anon,authenticated;
grant select,insert,update on public.buyer_notification_preferences to authenticated;
create policy "notification preferences self" on public.buyer_notification_preferences
 for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.apply_buyer_notification_preferences() returns trigger
language plpgsql security definer set search_path=public as $$
declare prefs public.buyer_notification_preferences;
begin
 select * into prefs from public.buyer_notification_preferences where user_id=new.user_id;
 if found and ((new.kind='message' and not prefs.messages)
   or (new.kind in('document','document_request') and not prefs.documents)
   or (new.kind='status' and not prefs.deal_status)) then return null; end if;
 -- NDA, security, financial-access decisions and other essential notices remain.
 return new;
end;$$;
revoke all on function public.apply_buyer_notification_preferences() from public,anon,authenticated;
create trigger notification_preferences_before_insert before insert on public.marketplace_notifications
for each row execute function public.apply_buyer_notification_preferences();
