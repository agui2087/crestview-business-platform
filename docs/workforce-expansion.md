# Workforce expansion — acceptance and release tracker

This work extends the existing owner-scoped Workforce data model. An owner account is currently the Workforce workspace boundary; acquisition organization membership does not grant access to personnel data. Multi-company portfolio administration is a later extension, not an implied capability.

## Eight workstreams

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
- Shift scheduling, automatic email reminders, custom reusable checklist editing, task reassignment and broader multi-company portfolio administration are further enhancements beyond this initial release.
- Secure employee/manager file-sharing for training evidence requires a separate document-access design and review; current vault controls are unchanged.
- Real multi-account user acceptance testing, beyond isolated database and presentation tests.

## Verification

`lib/workforce-operations.test.ts` executes the migrations in isolated PostgreSQL with separate owner, HR, manager, employee and outsider identities. It covers acceptance, scope, stale writes, self-approval rejection, decisions, safe profile requests, task verification, checklist/requirement duplication, audit rollback, archive and revocation.

`scripts/check-workforce-ui.mjs` renders the actual command-center component with synthetic data and checks expanded forms in English/Spanish at 1440px and 390px with axe and overflow assertions. It is a presentation test, not a hosted end-to-end test, and never connects to production.

## Rollout and rollback

Apply migration 0030 transactionally before deploying the new application. Do not apply migration 0028 merely because its number is lower; it belongs to unreleased billing work and is not a dependency here. Existing Workforce data stays owner-scoped; no membership is inferred from acquisition access. Verify database routines and the deployed command-center route after release.

If the app needs rollback, redeploy the prior application while retaining the additive tables/history. Existing owner directory actions remain supported. Do not drop new tables or audit history to roll back a UI issue. Disable new membership invitations/revoke affected memberships if an access issue is discovered, and investigate before restoring them.
