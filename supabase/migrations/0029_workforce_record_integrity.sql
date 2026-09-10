-- Allow the document metadata type already offered by Workforce.
-- This does not change uploaded-document storage or security controls.
begin;
alter table public.employee_records drop constraint if exists employee_records_record_type_check;
alter table public.employee_records add constraint employee_records_record_type_check
  check (record_type in ('certification', 'training', 'pto', 'document'));

-- A record must belong to both the current user and one of their employees.
drop policy if exists employee_records_self on public.employee_records;
create policy employee_records_self on public.employee_records for all
  using (user_id = auth.uid() and exists (
    select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()
  ));
commit;
