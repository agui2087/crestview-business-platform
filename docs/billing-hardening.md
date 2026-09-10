# Billing hardening — local implementation, not deployed

## Completed locally on 2026-09-09

Added PostgreSQL tests using the actual billing migration, plus migration 0028
and its webhook integration. The new service-only function deduplicates paid
Checkout fulfillment by session ID, not merely event ID. A unique session row,
event receipt, customer write and entitlement increment share one transaction.
A failure rolls everything back, allowing a later delivery to retry safely.
Repeated sessions with a different owner/product are rejected. The webhook also
rejects multiple line items, pagination and unexpected one-time quantities.

Tests cover duplicate event delivery, independent payments, final-write rollback
and retry, invalid operations, browser-role denial, row isolation, duplicate
sessions with different event IDs, identity mismatches and quantity validation.
These run locally with auth scaffolding, not against real Stripe or customers.
They do not prove hosted concurrency or a complete signed-webhook workflow.
Validation: complete local suite 49 passed, changed-file ESLint passed, and
TypeScript `tsc --noEmit` passed. No production build or deployment was performed
for this billing change.

## Confirmed unresolved ordering defect

The diagnostic test `current limitation: a late active snapshot overwrites
cancellation` demonstrates that migration 0010 accepts an old active snapshot
after cancellation and restores access. This test intentionally asserts current
behavior to reproduce the defect; its passing result is NOT a security pass.
The webhook currently uses the event snapshot directly. The fix must reconcile
current Stripe state and prevent competing workers from committing stale reads.
Event timestamps alone are insufficient, including when two events share a second.
Also test multiple subscriptions for one product before changing entitlement
aggregation; one cancellation must not disable another valid subscription.

## Release gates — do not deploy the new caller yet

### Hosted staging evidence, 2026-09-09

User-created isolated project `bxtrkycetuoqooammgpp` was healthy and had zero
auth users and zero public tables before setup. Installed billing schema 0010
and fulfillment migration 0028 only, not the full application schema.
Verified both function bodies against repository code after normalizing whitespace
and SQL comments. Both deny anonymous/authenticated execution and permit service-role
execution with empty search paths.

Hosted SQL drills passed: initial fulfillment, duplicate event and distinct-event
same-session deduplication, browser-role denial, forced final-write failure with
no partial records, and successful retry. Synthetic auth/user/payment fixtures
existed only inside transactions that were rolled back. No real Stripe charges,
customer records or production database writes were involved.

These are hosted DATABASE tests, not signed Stripe webhook tests, simultaneous
two-connection concurrency tests, or a complete application checkout. A dedicated
staging application deployment and Stripe test webhook still need connecting.

1. Apply 0028 in an isolated test database and verify service-only execute grants.
2. Run signed test-mode webhooks: unpaid completion, later paid success, distinct
   events for one session, duplicate deliveries and database failure/retry.
3. Reconcile historical fulfilled Checkout session IDs from Stripe against existing
   event receipts BEFORE switching production to session-based deduplication.
   The old receipt table has no session ID. An older paid session replayed under a
   different event ID could otherwise receive another credit after cutover.
   Do not invent mappings or blindly replay historical payments.
4. Coordinate cutover so old webhook instances cannot bypass session deduplication.
   Verify real two-connection concurrent delivery, receipt counts and entitlements.
5. Install migration before releasing the caller. No fallback to the old increment
   path on RPC failure: return a retryable failure instead of granting twice.

0028 has not been installed in production. The website still uses its previous
billing handler. No API keys, prices, tax settings or Stripe API versions changed.
Tax registrations and collection settings require a separate account/business
review; these tests do not establish tax compliance.

## References

- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment):
  fulfill a session only once, including repeated/concurrent calls.
- [Stripe webhooks](https://docs.stripe.com/webhooks): signature verification,
  retries and unordered delivery.
