# Performance and load-test plan

## Acceptance budgets

Budgets are versioned in `config/performance-budgets.json`. Under the defined concurrency, every scenario must have an HTTP error rate no greater than 1% and remain within its p95 threshold:

- Health: 750 ms
- Homepage: 1,200 ms
- Public listings and listing search: 1,500 ms
- Authenticated dashboard, marketplace, and document vault: 1,800 ms
- Staging document upload, scan, metadata save, and cleanup: 3,500 ms with zero errors

These are server-response budgets, not Core Web Vitals. Production browser telemetry should separately monitor LCP (good at or below 2.5 s), INP (good at or below 200 ms), and CLS (good at or below 0.1) at the 75th percentile by device class.

## Safe execution

1. Run public scenarios from a stable runner against production after notifying the operator.
2. Run authenticated reads and uploads only against an isolated staging database and storage buckets.
3. Create a dedicated test buyer and broker; do not reuse a real participant session.
4. The upload scenario requires `CRESTVIEW_LOAD_ALLOW_WRITES=staging`, rejects known production hostnames, and deletes every successfully created test document.
5. Capture the JSON artifact, release SHA, region, runner, database size, and date.
6. Investigate before increasing budgets. A threshold change requires a decision-log entry.

## Capacity sequence

Start at the committed concurrency, then increase 2× and 4× on staging while watching database connections, function duration, storage/scanner latency, 429s, and error alerts. Stop on sustained errors above 1%, p95 above twice the budget, provider throttling, or any evidence that cleanup failed.

## Current evidence

Local functional and accessibility browser tests passed before this plan was added. Public read-only baseline and credentialed staging scenarios must be recorded in a dated test artifact before production capacity is considered verified.
