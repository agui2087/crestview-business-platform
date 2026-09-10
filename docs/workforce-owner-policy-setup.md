# Workforce policy setup for business owners

Status: draft setup guide, not an adopted employee policy or legal advice. No leave entitlements are activated by this document. Each customer is a separate employer; Crestview must not apply one customer's rules to another workspace.

## Before configuration

The owner records the employer's legal name, each employee's actual work location (including remote work), employee classifications and schedules, applicable collective agreements, and the effective date. Buying a business does not imply that existing accrued balances or contractual commitments can be reset. Reconcile opening balances with the seller's records and the payroll provider before importing them.

An authorized HR reviewer and employment counsel must approve location-specific rules. US federal vacation-pay rules alone are not a complete leave policy: state/local rules and agreements may add obligations. FMLA eligibility and job protection are separate from whether time is paid. Sources: [US DOL vacation leave](https://www.dol.gov/general/topic/workhours/vacation_leave), [US DOL FMLA](https://www.dol.gov/agencies/whd/fmla). International employers need their own jurisdictional review.

## Draft employee-facing wording

Your employer provides leave under its approved policy and applicable law. Submit planned leave through Workforce where practical. For emergencies or protected leave, notify the designated HR contact as soon as practicable; inability to use the software must not prevent a protected request.

Do not include diagnoses, medical documents or other sensitive details in request titles or task evidence. HR will provide a separate confidential process when supporting information is necessary. Requests must be reviewed fairly and without retaliation. A software error or missing balance does not by itself determine eligibility or justify refusing protected leave.

Your manager reviews ordinary scheduling requests. HR handles protected leave, exceptions, conflicts and appeals. The requester must not approve their own request; an alternate authorized reviewer handles conflicts. Employees can ask HR to correct inaccurate records without losing the original audit trail.

Payment, deductions, tax handling and legally required notices remain the employer's and payroll provider's responsibility. Workforce's current calendar records dates, not paid hours or a guaranteed leave balance.

## Owner decisions required before a balance engine can be enabled

| Setting | Owner/reviewer must supply |
| --- | --- |
| Policy coverage | Work locations, classifications, collective agreements, effective dates |
| Leave types | Vacation, statutory sick leave and protected leave kept distinct where required |
| Earning method | Front-loaded or earned; exact rate, eligible hours and proration |
| Service changes | Waiting periods, anniversary tiers, rehires and transfers |
| Usage | Allowed increments, schedules, holidays, partial days and negative balances |
| Carryover | Permitted rollover, caps and expiry, reviewed per jurisdiction; no default forfeiture |
| Separation | Payout and final-pay treatment as approved by counsel/provider |
| Opening balances | Verified source, as-of date, approver and reconciliation evidence |
| Approval routing | Manager, HR fallback, delegated reviewer and conflicts |
| Privacy/retention | Access roles, legal holds, retention periods and deletion process |

Recommended software defaults are **unconfigured**, not zero entitlement. An employer may choose a discretionary vacation benefit, but Crestview must not label it statutory or activate it for another business. The setup wizard should require location and policy approval before publication, keep immutable policy versions, and preview changes against synthetic examples before applying them to employees.

## Implementation acceptance gates (not yet delivered)

- Per-owner, effective-dated policy versions and employee assignments; no global preset activation.
- Integer-minute ledger with idempotent accrual runs, reversals rather than silent edits, and concurrency tests.
- Reviewed work schedules/holidays; calendar days must not become paid hours implicitly.
- Approved opening balances, reconciliation and employee-visible adjustment history.
- No automatic statutory eligibility or final-pay determination without a reviewed ruleset.
- Payroll exports identify period, units, source and reconciliation state; no live payment initiation.

This document provides a usable review starting point, not an assertion that the balance engine exists or that every jurisdiction has been covered.
