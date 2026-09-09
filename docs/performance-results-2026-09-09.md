# Public production load result — 2026-09-09

Target: `https://www.crestviewplatform.com`

Runner: bounded read-only Node runner

Authentication: none

Total requests: 260
Maximum concurrency: 16

| Scenario | Requests | Concurrency | p95 | Error rate | Budget | Result |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Homepage | 60 | 12 | 999 ms | 0% | ≤ 1,200 ms / ≤ 1% | Pass |
| Public listings | 80 | 16 | 494 ms | 0% | ≤ 1,500 ms / ≤ 1% | Pass |
| Listing search | 80 | 16 | 238 ms | 0% | ≤ 1,500 ms / ≤ 1% | Pass |
| Health/database probe | 40 | 8 | 1,945 ms | 0% | ≤ 750 ms / ≤ 1% | **Fail** |

The health endpoint remained available but was too slow for its release budget. The implementation was changed from an exact row-count probe to a one-row connectivity query; production must be redeployed and this scenario rerun before the health performance gate can pass.

Authenticated dashboard/marketplace/document-vault reads and the temporary upload-and-delete scenario were not run because no isolated staging origin or test-user session was available. They remain a Geo/staging-credential action and must not be redirected to production.

Machine-readable evidence: `work/load-test-production-public-2026-09-09.json` in the task workspace; copy it to the private release record before cleaning the workspace.
