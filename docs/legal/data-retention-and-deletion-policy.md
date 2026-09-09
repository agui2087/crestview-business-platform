# Data retention and deletion policy — DRAFT FOR ATTORNEY AND OPERATIONS REVIEW

## Principles

Collect the minimum needed, assign an owner and period, prevent indefinite defaults, keep deletion auditable without retaining deleted content, apply legal holds narrowly, and state the difference between active deletion and encrypted backup expiry.

## Proposed schedule

| Data | Active retention trigger/period | Deletion method | Owner / review |
| --- | --- | --- | --- |
| Account/profile | Account life; delete within 30 days of verified request unless exception applies | Auth/profile cascade plus vendor deletion | Privacy / annually |
| Listings and deal records | Account/deal life; 30-day customer recovery window after deletion | Hard-delete or de-identify related rows according to transaction/legal obligations | Product + Legal / annually |
| Vault and deal-room files | Until user deletion, workspace deletion, or configured `retention_until`; default must be approved | Revoke metadata access first, delete private object, record content-free result | Security / quarterly |
| Listing NDA files and acceptance records | Agreement/deal life plus [COUNSEL TO SET] | Delete file when no longer required; retain minimum acceptance evidence if legally necessary | Legal / annually |
| Stripe billing/event ledger | Seven years proposed, subject to tax/accounting advice | Delete or de-identify when period expires | Finance + Legal / annually |
| Security/upload events | 24 months proposed | Scheduled row deletion; retain no document bytes | Security / quarterly |
| Application/error logs | 30 days proposed; incident extracts up to 24 months | Provider expiration and controlled incident-record deletion | Security / quarterly |
| Pilot page events | 90 days | Scheduled row deletion | Product / pilot close |
| Pilot feedback | 180 days, then delete or de-identify | Delete text/identity or retain approved de-identified themes | Research / pilot close |
| Support records | Two years after resolution proposed | Delete ticket/attachments under provider controls | Support / annually |
| Encrypted backup artifacts | 30 days for workflow artifacts; managed Supabase schedule/PITR per approved plan | Automatic expiry/cryptographic erasure | Infrastructure / monthly |

Every period is provisional until counsel approves it and operations demonstrates the corresponding deletion job/vendor setting.

## Verified deletion request procedure

1. Record request ID/date/scope without copying sensitive content.
2. Verify the requester's identity and authority; avoid collecting unnecessary new identity documents.
3. Search account, profile, workspace, storage, pilot, support, billing, and approved vendor systems.
4. Identify legal hold, security, transaction, billing, or contractual exceptions; counsel approves any denial/extension.
5. Revoke access and sessions, delete active data and objects, and request vendor deletion.
6. Confirm object deletion and database cascades; do not treat metadata deletion alone as file deletion.
7. Explain that encrypted backups expire on their normal cycle and are isolated from ordinary use; if restored, the deletion ledger must be reapplied.
8. Respond within the legally applicable period and record only completion, exceptions, systems checked, operator, and date.

## Legal hold and restore behavior

Only authorized legal personnel may issue/release a hold. A hold must name scope, reason, authority, date, and reviewer. Restored environments must remain isolated, must not send email/webhooks, and must replay the deletion ledger before operational use.
