create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'agui2087@outlook.com';
$$;

create or replace function public.platform_admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'saved_opportunities', (select count(*) from public.saved_opportunities),
    'employees', (select count(*) from public.employees),
    'open_tasks', (select count(*) from public.deal_tasks where status = 'open'),
    'recent_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'confirmed', u.email_confirmed_at is not null,
        'display_name', p.display_name
      ) order by u.created_at desc), '[]'::jsonb)
      from (select * from auth.users order by created_at desc limit 50) u
      left join public.profiles p on p.user_id = u.id
    )
  );
end;
$$;

revoke all on function public.platform_admin_summary() from public;
grant execute on function public.platform_admin_summary() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
