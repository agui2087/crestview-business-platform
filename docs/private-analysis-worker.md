# Private document processor — release checklist

Current implementation is not activated in production. Keep `CRESTVIEW_PRIVATE_ANALYSIS_ENABLED` unset until every release check below passes.

The worker pulls checked, owner-requested PDFs from the existing private vault. It calls only the loopback model endpoint, processes one document at a time, and does not update saved financial figures. Queue entries survive the computer sleeping. Interrupted processing requires a new request after the lease expires. Deleting or replacing the source makes its previous analysis inaccessible.

Customer wording: “Document analysis may take additional time. You can continue using Crestview while your document is queued.” Do not describe this as a pilot. Do not promise instant completion or guaranteed availability.

## Required before activation

- Install and verify an official local Ollama runtime and local model on the designated Mac. Benchmark synthetic PDFs on the actual hardware. Do not download customer documents for benchmarking.
- Start the model daemon with `OLLAMA_NO_CLOUD=1`, loopback-only binding, and one parallel request. The worker's environment alone does not configure an already-running daemon.
- Use a private environment file, never a tracked file, for the database service credential. This credential is privileged: restrict local file access and never share it with the browser or include it in logs.
- Apply migration 0049 to the isolated test database first. Verify ownership denial, revoked access, source replacement, deletion, queue persistence, expired leases, usage limits, and result validation.
- Run `node --experimental-strip-types --env-file=<private-environment-file> scripts/private-analysis-worker.mts --once` for an isolated synthetic test. Without `--once`, it polls every 15 seconds.
- Required worker settings: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_NO_CLOUD=1`, `CRESTVIEW_PRIVATE_MODEL` (an installed local model tag; no cloud tag).
- Complete the customer consent/status/results interface and verify English and Spanish, keyboard access, and mobile layout before enabling requests.
- Verify unattended start/stop, no sensitive logging, document cleanup, disk capacity, and queued behavior while the Mac is offline. Keep the computer powered when processing is expected.
- Retire the separate hosted-AI analysis route before advertising exclusively local document analysis. There must be no hosted fallback.
- Only then apply the production migration, deploy the tested interface and enable the feature. Verify a synthetic production request without real private data.

## Current limits

Owner-only Pro vault PDFs, 10 MB, 30 pages, 12,000 extracted characters per page; 5 requests/hour and 20/day shared with existing analysis usage. Image-only pages require attention; OCR is not implemented. Extraction is not accounting verification. Human review remains necessary even when citations match.

## Rollback

Disable `CRESTVIEW_PRIVATE_ANALYSIS_ENABLED` and stop the worker. Existing vault uploads/downloads remain unchanged. Do not delete document storage or usage history as part of rollback.
