# Safe unsigned NDA correction and reissue

Scope: existing account-based buyer/broker agreements. This does not implement outside signers, multi-document packets or certificate-authority signatures.

## Safety rules

- Broker-only server action, with database participant checks and expected agreement/template versions.
- A single recorded signature, completed PDF, signed status, progressed deal or approved financial access blocks replacement.
- Old agreement, controls, events, original-file hash and correction reason are archived in one transaction with replacement and the in-app notification.
- Revision history is participant-readable but not client-writable. Updates are rejected even for the privileged service role.
- The active agreement version increases and its placed-field revision changes, so stale forms cannot sign it.
- Old receipt, expiry, withdrawal and decline controls are reset for the fresh request; their previous values remain in history.
- Both parties can download the unsigned historical record. Prior PDF downloads verify their recorded hash and are never publicly cached.
- Authenticated storage deletion/update policies protect archived originals. Administrative recovery and retention remain controlled operations.
- Maximum 50 corrections per agreement. Reissue does not cancel a signed contract.

## Deployment gates

Migration 0060 must precede the application release. It asserts and preserves existing guards, accepting their known whitespace variants; unexpected definitions abort rather than overwrite them. Applied successfully to isolated test project bxtrkycetuoqooammgpp. Production application remains a release gate until recorded in the PR.

The still-disabled 0057 email migration now binds jobs to an agreement version, cancels obsolete queued work and creates distinct invitations for replacements. 0057 has not been installed in production; do not enable email without the approved provider, verified sender, scheduling and delivery rehearsal.

## Verification

Database checks cover broker/buyer/outsider authorization, expected versions, original hashes, stale signatures, immutable history, notification-failure rollback and partially signed rejection. The connected synthetic browser rehearsal passed decline, correction/reissue, archived PDF download and outsider denial. A final distinct-file-path rehearsal and hosted release checks remain pre-merge gates.

No paid account, trial-only service, external email or customer agreement was created or modified for this work.
