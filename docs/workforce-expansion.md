# Workforce expansion — acceptance and release tracker

This work extends the existing owner-scoped Workforce data model. An owner account is currently the Workforce workspace boundary; acquisition organization membership does not grant access to personnel data. Multi-company portfolio administration is a later extension, not an implied capability.

## Eight workstreams

### Later releases (supersede the early remaining-scope notes below)

Through PR45, production includes per-business setup and employee placement, effective-dated planned schedules, reviewed leave policies/manual ledger with request-linked debits, reviewed payroll-analysis imports with audited voids, and explicit revision-bound training-evidence links. These do not imply automated legal entitlements, payroll processing, email delivery or complete multi-role browser acceptance.

The reminder follow-up adds a current in-app queue for personal assigned deadlines, permitted reviews, verification and certification expiry. It refreshes on navigation/reload, uses the configured business time zone (explicit UTC fallback), and displays the full matching count even when only 100 rows are shown. It is not an email/SMS/push service or a scheduled delivery job.

### End-to-end environment gap

PR47 adds reviewed atomic carryover between effective policy periods. Source balance and policy versions are checked; debit and opening credit commit together; a retry cannot duplicate the transfer. Untransferred minutes remain in the source ledger. It is not a scheduled annual reset, automatic forfeiture or payout.

The next integration layer, `lib/workforce-form-integration.test.ts`, executes the actual operations and leave Server Action handlers with FormData against isolated PostgreSQL migrations. It covers owner, HR, assigned/unassigned manager, employee and outsider identities: invitation acceptance, leave decisions, training completion/independent verification, carryover confirmation/replay, revoked access and signed-out redirects. Next navigation/session/Supabase transport are test substitutes; database authorization and application handler logic are real. These are **not** hosted browser E2E tests. Local environment inspection found no Supabase credentials configured; no production credentials or real records were used.

The existing Playwright configuration explicitly disables Supabase and uses local acquisition authentication. New Workforce routes require Supabase, so that suite cannot establish hosted multi-role Workforce correctness. The development machine currently has neither Docker nor the Supabase CLI available. Isolated PostgreSQL permission tests, mocked-storage route tests and rendered accessibility tests remain valuable but are not a substitute for real browser/server/database integration.

Before declaring end-to-end completion, provide an isolated Supabase test stack (or verified staging configuration) with synthetic owner, HR, assigned/unassigned manager, employee and outsider accounts. Run browser mutations for assignments, leave approvals/debits, payroll imports/voids, evidence sharing/revocation and permission changes. Keep production credentials and real employee records out of the test runner. No test-only authentication bypass should ship in the application.

1. Permissions: explicit owner/HR/manager/employee access, accepted invitations, scoped manager assignments, revocation, database authorization tests.
2. Employee lifecycle: edit profiles, archive rather than delete, change history, concurrency protection.
3. Time off: dates/type/reason, designated approver, decisions, in-app status, coverage view. Accrual/pay calculations require company policies and are excluded until configured and reviewed.
4. On/offboarding: reusable starter checklists, assigned responsibility, due dates, completion evidence. Tasks do not automatically revoke external accounts or certify legal compliance.
5. Manager dashboard: actionable pending requests, overdue tasks, certification renewals and direct links.
6. Self-service: accepted employee access, safe profile-change requests, leave requests, assigned tasks. No access to coworkers' records.
7. Training: assignments, expiry tracking, evidence references, explicit verification and renewal tasks. Existing secure document storage must not be weakened.
8. Payroll exchange: validated, documented CSV handoff and import preview; provider connections require chosen vendor, authorized account/API access, mapping and sandbox certification. No payroll processing, tax filing or claims of an active ADP/Workday/Paycom integration.

## Release gates

Database permission and transaction tests, validation tests, type checking, lint, production build, desktop/mobile UI checks and deployment verification. Existing billing work and the user's design preview must remain outside this release.

## Required external decisions

- Company leave policies: leave types, workweek, holidays, accrual, carryover and approval delegation.
- Named HR/manager/employee invitees: do not invent real people or grant existing users implicit access.
- Payroll provider, account access and import specification. Never transmit actual employee data to a vendor as a connectivity test.
- HR/legal review of handbook, retention, acknowledgments and jurisdiction-specific obligations.

Progress is tracked by verified acceptance criteria, not by files written. The eight workstreams are not complete merely because starter interfaces exist.

## Implementation delivered in migration 0030 and the command center

- Owner-scoped workspaces now have accepted/revocable HR, manager and linked employee memberships. Managers can access only explicitly assigned profiles. Internal employee notes are excluded from authenticated directory reads. Permission changes are logged in `workforce_access_history`.
- HR/owners can add/edit profiles, archive/restore them, assign managers and review field-change history. Version checks prevent stale form overwrites; audit failures roll back writes.
- Employees can submit dated leave requests or safe contact/language change requests. Designated reviewers or HR/owners decide requests once with a reason; self-approval is rejected. The monthly leave calendar distinguishes pending and approved absences; it is not a shift calendar or paid-leave calculation.
- Five-task onboarding/offboarding starter checklists are created atomically. Custom tasks have an assignee, due date and completion evidence. Verification requires a different authorized reviewer.
- The command center provides pending-request, overdue-task and expiry queues. These are in-app notifications, not email/SMS delivery.
- Position-based training requirements support renewal intervals, assignments, evidence summaries/references and independent verification. New attachment-sharing permissions have NOT been added to the private document vault. Do not paste confidential document contents into evidence summaries.
- CSV import preview and safe directory export provide a vendor-neutral handoff. Exports are owner/HR-only, exclude archived profiles, neutralize spreadsheet formulas, disable caching and refuse a partial export above 500 employees.

## Remaining scope — not claimed complete

- Provider-specific payroll connector, credentials, field mapping and vendor sandbox acceptance.
- Company-approved accrual, carryover, holidays and escalation/delegation rules; no leave entitlement is invented.
- HR/legal-approved policy text, retention periods and electronic acknowledgment requirements. Current policy tasks record evidence only.
- Shift scheduling, automatic email reminders and broader multi-company portfolio administration remain further enhancements. Custom checklist editing and task reassignment are implemented in migration 0031, subject to its release gates below.
- Secure employee/manager file-sharing for training evidence requires a separate document-access design and review; current vault controls are unchanged.
- Real multi-account user acceptance testing, beyond isolated database and presentation tests.

## Verification

## Follow-up release 0031: checklist management and owner analytics

- Custom, owner-scoped checklists with 1–30 tasks; owner/HR can edit or archive, authorized managers can assign. Changes never rewrite already assigned task titles. Stale edits/assignments and duplicate open assignments are rejected.
- Open tasks can be reassigned/rescheduled with a reason, record version and authorized assignee. Completed tasks remain immutable through this workflow. Existing task audit triggers record the changes.
- Descriptive analytics: current non-archived/non-terminated headcount, department counts, task completion, overdue work, separate verification status and pending leave. These are permission-scoped snapshots, not productivity scores, payroll costs or company-wide totals when the 500-record limit is reached.
- Customer policy setup is documented in `docs/workforce-owner-policy-setup.md`. Each business needs its own reviewed location-specific policy; no universal leave entitlement is imposed.
- No payroll provider was selected. The product direction is a people-management/analytics layer with payments and tax processing handled by a third party. Cost analytics still needs actual compensation/payroll source data.

Apply 0031 after 0030 before deploying the application that reads template/version fields. It is additive; retain its tables on application rollback. Do not include unrelated billing migrations.

The earlier live owner QA passed profile creation/edit/archive/restore, checklist creation/completion, leave submission/withdrawal and UI self-approval protections. Its synthetic employee, five tasks and one request were removed; 12 audit entries were retained. This is not live multi-role UAT of the 0031 features.

`lib/workforce-operations.test.ts` executes the migrations in isolated PostgreSQL with separate owner, HR, manager, employee and outsider identities. It covers acceptance, scope, stale writes, self-approval rejection, decisions, safe profile requests, task verification, checklist/requirement duplication, audit rollback, archive and revocation.

`scripts/check-workforce-ui.mjs` renders the actual command-center component with synthetic data and checks expanded forms in English/Spanish at 1440px and 390px with axe and overflow assertions. It is a presentation test, not a hosted end-to-end test, and never connects to production.

## Rollout and rollback

Apply migration 0030 transactionally before deploying the new application. Do not apply migration 0028 merely because its number is lower; it belongs to unreleased billing work and is not a dependency here. Existing Workforce data stays owner-scoped; no membership is inferred from acquisition access. Verify database routines and the deployed command-center route after release.

If the app needs rollback, redeploy the prior application while retaining the additive tables/history. Existing owner directory actions remain supported. Do not drop new tables or audit history to roll back a UI issue. Disable new membership invitations/revoke affected memberships if an access issue is discovered, and investigate before restoring them.
