// A one-time preparation tool for the verified billing-only staging project.
// Never import this into an application request path.
export function buildWorkforceStagingBootstrap(project: string, migrations: {name: string; sql: string}[]) {
  if (project !== 'bxtrkycetuoqooammgpp') throw new Error('Only the isolated staging project is allowed');
  const selected = migrations.filter(m => /^\d{4}_.*\.sql$/.test(m.name) && Number(m.name.slice(0,4)) <= 41 && ![10,27,28].includes(Number(m.name.slice(0,4)))).sort((a,b)=>a.name.localeCompare(b.name));
  const expected = Array.from({length:41},(_,i)=>i+1).filter(n=>![10,27,28].includes(n));
  if (JSON.stringify(selected.map(m=>Number(m.name.slice(0,4)))) !== JSON.stringify(expected)) throw new Error('Released migration manifest is incomplete or duplicated');
  const body = selected.map(m => {
    // Released Workforce migrations have their own transaction wrappers. Keep one
    // outer transaction so a later failure cannot leave a partially initialized DB.
    const sql = m.sql.replace(/^(?:begin|commit);\s*$/gim,'');
    return `-- ${m.name}\n${sql}`;
  }).join('\n');
  return `-- STAGING ONLY: bxtrkycetuoqooammgpp. Never execute on production.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $$
declare names text[];
begin
  select array_agg(c.relname::text order by c.relname) into names from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m');
  if names is distinct from array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events']::text[] then raise exception 'Not the reviewed billing-only staging state'; end if;
  if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal) then raise exception 'Existing auth trigger requires review'; end if;
  if exists(select 1 from storage.buckets) then raise exception 'Existing storage requires review'; end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname not in ('apply_stripe_billing_event','fulfill_stripe_checkout_payment')) then raise exception 'Existing application routines require review'; end if;
end $$;
create temporary table workforce_bootstrap_preservation(name text primary key, snapshot jsonb) on commit drop;
do $$
declare t text; contents jsonb;
begin
  foreach t in array array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',t) into contents;
    insert into workforce_bootstrap_preservation values(t,contents);
  end loop;
end $$;
insert into workforce_bootstrap_preservation
select 'routines',coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) order by oid),'[]'::jsonb) from pg_proc where pronamespace='public'::regnamespace;
insert into workforce_bootstrap_preservation select 'auth_count',to_jsonb(count(*)) from auth.users;
${body}
do $$
declare t text; contents jsonb; before_state jsonb;
begin
  foreach t in array array['billing_customers','billing_entitlements','billing_subscriptions','stripe_checkout_fulfillments','stripe_webhook_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',t) into contents;
    select snapshot into before_state from workforce_bootstrap_preservation where name=t;
    if contents is distinct from before_state then raise exception 'Billing preservation failed: %',t; end if;
  end loop;
  select snapshot into before_state from workforce_bootstrap_preservation where name='routines';
  select coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) order by oid),'[]'::jsonb) into contents from pg_proc where oid in (select (r->>'oid')::oid from jsonb_array_elements(before_state) r);
  if contents is distinct from before_state then raise exception 'Existing routine preservation failed'; end if;
  if (select to_jsonb(count(*)) from auth.users) is distinct from (select snapshot from workforce_bootstrap_preservation where name='auth_count') then raise exception 'Existing account count changed'; end if;
end $$;
commit;
`;
}
