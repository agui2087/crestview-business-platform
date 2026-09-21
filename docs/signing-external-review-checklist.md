# Signing: independent review and broker rehearsal

Status: prepared for review, not independently reviewed or broker-validated.

## Independent assessor

Use only an authorized isolated environment with synthetic documents. Do not probe third-party infrastructure or real customer agreements. Agree on scope and reporting before access is granted. No paid engagement has been commissioned.

Review these trust boundaries:

1. Buyer, broker, outsider and anonymous sessions cannot exchange roles by changing IDs, form fields, cookies or links.
2. A first signature never releases documents when another signature is required. Reordered, repeated and concurrent submissions preserve one immutable outcome.
3. Decline, expiry, withdrawal and signing races resolve atomically. A recorded signature is not erased by decline. No signed contract is represented as cancelled by a workflow action.
4. Optional blank fields are explicitly recorded; required signatures and identity fields cannot become optional. Dropdowns accept only listed choices. Changes to a template do not alter outstanding requests.
5. Original and completed file hashes detect changed content; stored PDFs are private and authorized downloads are not cached publicly.
6. Forged, stale, duplicate and reordered delivery callbacks cannot create false delivery evidence. Email bodies contain no confidential documents. Recipient verification and provider free-tier caps are enforced.
7. Queue leases recover after worker interruption without duplicate submissions; uncertain outcomes beyond the provider idempotency window require reconciliation.
8. Future external-signer links must be scoped to one request, expire, be revocable, and require verified mailbox access. Email verification must not be described as government-ID verification.
9. Future multi-document packets must bind the exact ordered document hashes, all recipient roles and signing order to each signature. No post-signature substitution.
10. Future digital seals need protected private keys, published verification instructions, rotation and recovery. A platform-generated seal must not be described as an independent certificate-authority signature.

## Broker rehearsal

Use 3–5 willing brokers and synthetic agreements before a broader invitation. This is a plan, not evidence that participants have tested it.

- Prepare an NDA without coaching; record time, misclicks and confusing labels.
- Test both buyer-first and broker-first, desktop and phone, English and Spanish.
- Leave an optional field blank; reject an invalid email; select a dropdown option.
- Preview as each signer and confirm the preview creates no signature.
- Decline with a reason, verify the other party can read it, and confirm signing stops.
- Download both original and completed documents; verify values, placements and evidence.
- Test email delivery only after the provider and verified sending domain are active. Record inbox/spam outcome, latency and bounce visibility; provider acceptance alone is not delivery.
- Record completion rate without assistance, median time, failures, accessibility barriers and severity. Block wider release for any authorization leak, missing signature, false completion, lost document or critical accessibility failure.

## Evidence to retain privately

Release SHA, environment, synthetic account roles, run timestamps, screenshots, expected/actual results, assessor findings, corrective commits and retest results. Do not put private recipient data or exploit details into the public repository.
