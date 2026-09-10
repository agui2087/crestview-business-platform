# Reviewed monthly accrual

## Scope

This is a separate owner-only opt-in for fixed monthly credits. The existing manual monthly maximum is not interpreted as permission to grant credits. Owners enter an explicit amount, review a current-balance capped estimate, confirm the UTC schedule, and record their adopted-policy reference. HR/employee accounts cannot enable or pause this release's automation.

First eligibility is the first day of the following month in UTC. The hourly worker processes up to 100 due rules per run, on the actual execution date. It does not backdate entries or catch up a missed month. It pauses when policy versions change, employees become inactive/archived, ownership changes, an opening is missing, or eligibility dates are invalid. No proration, hours-worked formula, forfeiture, payments, or statutory entitlement is inferred. Customers whose policies require those methods must stay manual.

The worker uses the same employee locks and monthly unique index as manual posting. The current full ledger determines the cap; a zero credit consumes that month. Existing monthly accrual is preserved without a second credit. Posting, audit, run history and next-date advancement are one transaction; audit failure rolls the batch back. No customer or anonymous browser role can execute the worker or mutate its tables directly.

## Release procedure (not evidence of completion)

1. Apply migration 0042 to isolated staging. Verify permissions and synthetic owner preview/enable/pause, plus a real scheduler no-op run.
2. Verify production is the intended project, apply 0042, and deploy the scoped application files. No existing rules are automatically created.
3. Enable Supabase's pg_cron module only after inspecting existing jobs. As database administrator, create a dedicated job named `crestview-reviewed-accrual` with schedule `17 * * * *` and command `select public.workforce_run_accruals();`. Do not overwrite an unrelated existing job with that name.
4. Inspect the actual job history for successful execution. Confirm rule count remains zero in production; never opt a real customer in for testing.
5. Monitor failed jobs and due-rule backlog. The batch is transactional: one unexpected failure can block the batch and requires investigation. No claim of external email alert delivery is made.

To pause platform processing, deactivate only this named cron job. To pause one employee's rule, use its owner-facing pause control. Do not drop ledger records, disable document controls, or remove pg_cron (which could delete unrelated jobs).

## Verification

Local PostgreSQL tests cover opt-in, missing opening, stale version/balance, invalid amount, tenant isolation, denied direct writes/worker calls, cap clipping, zero-credit cap behavior, retry/no double posting, manual-credit preservation, pause, missed-month pause and audit rollback. TypeScript, lint and English/Spanish desktop/mobile accessibility/overflow checks also run. Hosted scheduling and deployment must be recorded separately; local checks are not production verification.

Scheduling references: https://supabase.com/docs/guides/cron/install and https://supabase.com/docs/guides/cron/quickstart.
