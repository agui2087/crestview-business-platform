alter table public.saved_opportunities
  add column if not exists current_step integer not null default 0,
  add column if not exists checklist_progress jsonb not null default '{}'::jsonb,
  add column if not exists step_notes jsonb not null default '{}'::jsonb,
  add column if not exists valuation_inputs jsonb not null default '{}'::jsonb;

alter table public.saved_opportunities
  drop constraint if exists saved_opportunities_current_step_check;

alter table public.saved_opportunities
  add constraint saved_opportunities_current_step_check
  check (current_step between 0 and 7);
