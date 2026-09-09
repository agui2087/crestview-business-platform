-- Private-pilot telemetry is intentionally first-party, minimal, and tied to
-- the authenticated user. Free-form feedback is never mixed with analytics.
create table if not exists public.pilot_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z0-9_.-]{1,80}$'),
  route text not null check (char_length(route) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pilot_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint pilot_events_metadata_size check (octet_length(metadata::text) <= 2048)
);

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null check (char_length(route) between 1 and 200),
  task_area text not null check (task_area in ('search','listing','nda','documents','dashboard','billing','other')),
  sentiment text not null check (sentiment in ('blocked','difficult','neutral','easy')),
  comments text not null check (char_length(comments) between 1 and 2000),
  contact_permission boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pilot_events_user_created_idx on public.pilot_events(user_id, created_at desc);
create index if not exists pilot_events_name_created_idx on public.pilot_events(event_name, created_at desc);
create index if not exists pilot_feedback_user_created_idx on public.pilot_feedback(user_id, created_at desc);

alter table public.pilot_events enable row level security;
alter table public.pilot_feedback enable row level security;

create or replace function public.enforce_pilot_write_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || tg_table_name));
  if tg_table_name = 'pilot_events' and (
    select count(*) from public.pilot_events
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'Pilot event rate limit reached';
  end if;
  if tg_table_name = 'pilot_feedback' and (
    select count(*) from public.pilot_feedback
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'Pilot feedback rate limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pilot_event_write_limits on public.pilot_events;
create trigger enforce_pilot_event_write_limits before insert on public.pilot_events
  for each row execute function public.enforce_pilot_write_limits();
drop trigger if exists enforce_pilot_feedback_write_limits on public.pilot_feedback;
create trigger enforce_pilot_feedback_write_limits before insert on public.pilot_feedback
  for each row execute function public.enforce_pilot_write_limits();

create policy "pilot_events_self_insert" on public.pilot_events
  for insert with check (user_id = auth.uid());
create policy "pilot_events_self_read" on public.pilot_events
  for select using (user_id = auth.uid());
create policy "pilot_feedback_self_insert" on public.pilot_feedback
  for insert with check (user_id = auth.uid());
create policy "pilot_feedback_self_read" on public.pilot_feedback
  for select using (user_id = auth.uid());

revoke update, delete on public.pilot_events from authenticated;
revoke update, delete on public.pilot_feedback from authenticated;
grant select, insert on public.pilot_events to authenticated;
grant select, insert on public.pilot_feedback to authenticated;
revoke all on function public.enforce_pilot_write_limits() from public, anon, authenticated;

comment on table public.pilot_events is 'Minimal first-party private-pilot journey telemetry. Purge after 90 days.';
comment on table public.pilot_feedback is 'Private-pilot participant feedback. Review at pilot close and purge or de-identify within 180 days.';
