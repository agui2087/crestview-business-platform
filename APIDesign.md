# API Design

## 1. Purpose

This document defines API conventions and the planned interface surface. It does not commit the MVP to building every listed endpoint. Internal first-party screens should prefer server-side data access and Server Actions; HTTP endpoints are used where a stable network boundary is valuable.

## 2. Interface Types

### Server Actions

Use for first-party UI mutations such as saving an opportunity or moving a deal when:

- the action is tightly coupled to a Next.js form;
- no third-party client requires it;
- authorization, validation, and cache revalidation occur server-side.

### Route Handlers

Use for:

- versioned external/integration APIs;
- provider webhooks;
- file upload/download authorization;
- streaming responses;
- health checks;
- asynchronous job callbacks.

### Data-access functions

Server-only typed functions encapsulate queries and domain policies. UI components must not issue privileged raw database queries. The data-access layer accepts authenticated context, not arbitrary user IDs supplied by the browser.

## 3. General Conventions

Base path for versioned HTTP APIs: `/api/v1`.

- JSON requests/responses use UTF-8.
- Resource names are plural nouns.
- IDs are UUIDs; organization routing may use a slug in the UI but authorization resolves an immutable UUID.
- Dates use `YYYY-MM-DD`; timestamps use ISO 8601 UTC.
- Monetary values are serialized as decimal strings plus `currencyCode`.
- Unknown fields are `null` or omitted according to the response schema, never converted to zero.
- Enum values are stable machine-readable strings.
- Breaking changes require a new API version.
- API specifications should be generated/checked from shared runtime schemas where practical.

## 4. Authentication and Tenant Context

Browser requests use the secure Supabase session. External APIs, if later offered, use scoped tokens stored as hashes and shown once.

Every protected request:

1. verifies authentication;
2. resolves the active organization;
3. checks active membership;
4. checks a named permission;
5. scopes database access by organization;
6. relies on RLS as a second boundary.

Do not accept `userId`, `role`, or ownership claims from request bodies. An `organizationId` in a route is a requested scope, not proof of access.

## 5. Request Validation

Validate at runtime:

- path and query parameters;
- JSON body shape and size;
- file MIME type, extension, size, and content;
- enums, currency, numeric ranges, and dates;
- natural-language query length;
- webhook signature, timestamp, and replay ID.

Reject unknown properties on security-sensitive commands. Normalize strings carefully without changing legally or financially meaningful source content.

## 6. Response Envelope

Single resource:

```json
{
  "data": {
    "id": "7cb60670-d512-4cab-98ee-d4ebf9190308",
    "type": "opportunity"
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

Collection:

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "hasMore": false
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some information needs attention.",
    "fields": {
      "askingPrice": ["Must be greater than or equal to zero."]
    }
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

Production responses never include stack traces, SQL text, secrets, provider payloads, or internal authorization details.

## 7. Status Codes and Error Taxonomy

| Status | Use |
|---|---|
| `200` | Successful read/update |
| `201` | Resource created |
| `202` | Asynchronous job accepted |
| `204` | Successful action with no body |
| `400` | Malformed request |
| `401` | Authentication required/invalid |
| `403` | Authenticated but not permitted |
| `404` | Missing or intentionally concealed resource |
| `409` | Conflict, duplicate, stale version, or invalid transition |
| `413` | Payload too large |
| `415` | Unsupported media type |
| `422` | Well-formed but semantically invalid |
| `429` | Rate limited |
| `500` | Unexpected internal failure |
| `502/503` | Dependency unavailable or service temporarily unavailable |

Stable codes include `VALIDATION_FAILED`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, `RATE_LIMITED`, `JOB_FAILED`, and `DEPENDENCY_UNAVAILABLE`.

## 8. Pagination, Filtering, and Concurrency

- Use cursor/keyset pagination for growing collections.
- Allowlist sortable fields.
- Encode filters as explicit typed query parameters.
- Natural-language search produces an interpreted filter object that the user can review.
- Responses may include `version` or `updatedAt`; updates require the last-seen version to prevent silent overwrites.
- Exports are asynchronous and return a job ID.

Example:

```text
GET /api/v1/organizations/{organizationId}/opportunities
  ?industryCode=238220
  &region=CA
  &maxAskingPrice=2000000
  &sellerFinancing=true
  &sort=-updatedAt
  &cursor=opaque-value
```

## 9. Planned Endpoint Surface

### Identity and organizations

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/me` | Current profile and memberships |
| `PATCH` | `/api/v1/me/preferences` | Locale/time-zone/preferences |
| `POST` | `/api/v1/organizations` | Create organization |
| `GET` | `/api/v1/organizations/{id}` | Read authorized organization |
| `GET` | `/api/v1/organizations/{id}/members` | List members |
| `POST` | `/api/v1/organizations/{id}/invites` | Invite member |
| `PATCH` | `/api/v1/organizations/{id}/members/{membershipId}` | Change permitted role/status |

Auth sign-in/callback routes should follow the supported Supabase/Next.js integration rather than a custom credential API.

### Opportunities

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/organizations/{id}/opportunities` | Search/filter opportunities |
| `POST` | `/api/v1/organizations/{id}/opportunities` | Manual creation |
| `GET` | `/api/v1/organizations/{id}/opportunities/{opportunityId}` | Detail, provenance, latest results |
| `PATCH` | `/api/v1/organizations/{id}/opportunities/{opportunityId}` | User-correctable fields only |
| `POST` | `/api/v1/organizations/{id}/opportunity-imports` | Start approved import |
| `POST` | `/api/v1/organizations/{id}/opportunities/{opportunityId}/save` | Save |
| `DELETE` | `/api/v1/organizations/{id}/opportunities/{opportunityId}/save` | Unsave |

Raw source records are not exposed wholesale by default. Return only authorized evidence fields required by the product.

### AI analysis and scoring

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/organizations/{id}/opportunities/{opportunityId}/analyses` | Queue analysis |
| `GET` | `/api/v1/organizations/{id}/analyses/{analysisId}` | Status/result |
| `POST` | `/api/v1/organizations/{id}/opportunities/{opportunityId}/scores` | Calculate versioned score |
| `GET` | `/api/v1/organizations/{id}/opportunities/{opportunityId}/scores` | Score history |
| `POST` | `/api/v1/organizations/{id}/analyses/{analysisId}/feedback` | Human feedback/correction |

Creating analysis returns `202 Accepted`:

```json
{
  "data": {
    "jobId": "f4874181-12ca-43fd-8243-132b3689f401",
    "analysisId": "8802ce78-c9aa-448b-a6e3-83f7a7b5fe6d",
    "status": "queued"
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

AI result contracts explicitly include:

- `dataCategory: "ai_generated"`;
- source citations;
- inference labels;
- missing information;
- confidence;
- model/prompt/output-schema versions;
- generation timestamp.

### Pipeline

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/organizations/{id}/pipelines` | List pipelines/stages |
| `POST` | `/api/v1/organizations/{id}/deals` | Add opportunity to pipeline |
| `GET` | `/api/v1/organizations/{id}/deals` | List/filter deals |
| `GET` | `/api/v1/organizations/{id}/deals/{dealId}` | Deal workspace |
| `PATCH` | `/api/v1/organizations/{id}/deals/{dealId}` | Owner/status/metadata |
| `POST` | `/api/v1/organizations/{id}/deals/{dealId}/stage-transitions` | Audited stage change |
| `POST` | `/api/v1/organizations/{id}/deals/{dealId}/notes` | Add note |
| `POST` | `/api/v1/organizations/{id}/deals/{dealId}/tasks` | Add task |

### Files

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/organizations/{id}/file-uploads` | Authorize/start upload |
| `POST` | `/api/v1/organizations/{id}/file-uploads/{uploadId}/complete` | Verify and queue scan |
| `GET` | `/api/v1/organizations/{id}/files/{fileId}/download` | Short-lived authorized download |

Files remain unavailable until verification/scanning succeeds.

### Workforce (Phase 4)

Planned resources include `/employees`, `/employment-records`, `/departments`, `/employee-documents`, `/certifications`, `/training`, `/pto-requests`, and `/announcements`. Compensation endpoints require a distinct permission and audit policy. The exact surface is deferred until the Workforce requirements and legal review are complete.

## 10. Idempotency

Require an `Idempotency-Key` header for:

- imports;
- AI analysis requests;
- exports;
- invitation creation;
- webhook-triggered mutations;
- later billing operations.

Keys are scoped to caller, organization, route, and normalized request hash. Reuse with a different payload returns `409`. Store the result long enough to cover provider retries.

## 11. Rate Limiting and Abuse Controls

Rate limits vary by identity, organization, IP risk, endpoint, and subscription entitlement.

Stricter limits apply to:

- authentication and invites;
- natural-language search;
- file uploads;
- AI generation;
- imports and exports;
- feedback endpoints susceptible to spam.

Return `429` with a safe retry hint. Limits must not reveal whether an unauthorized resource exists.

## 12. Webhooks

Provider routes live under `/api/webhooks/{provider}` and must:

- read the raw body when required for signature verification;
- verify signature and timestamp before parsing/processing;
- reject replayed event IDs;
- store a minimal receipt;
- respond quickly and enqueue processing;
- handle duplicate and out-of-order events;
- avoid logging raw sensitive payloads.

Candidate providers include Supabase, billing, background jobs, and approved data sources.

## 13. AI Tool/API Safety

- Model-accessible tools are allowlisted and narrowly scoped.
- Tool arguments are validated just like public requests.
- Source content cannot select tools or permissions.
- Read tools return the minimum authorized fields.
- Write or external-communication tools require explicit user confirmation.
- AI calls have time, token, and cost limits.
- Provider errors are mapped to stable application errors.
- Model and prompt upgrades run through evaluation and versioning.

## 14. Observability and Audit

Each request receives a correlation ID propagated to database operations, jobs, AI runs, and webhooks. Log:

- route/action name;
- outcome and latency;
- organization and actor identifiers where appropriate;
- safe error code;
- job/AI identifiers;
- rate-limit decisions.

Do not log tokens, cookies, passwords, raw employee documents, compensation values, full provider payloads, or unnecessary PII.

Audit events are required for:

- membership/role changes;
- sensitive workforce access or modification where policy requires;
- exports and downloads;
- source merge decisions;
- scoring-methodology activation;
- AI-triggered consequential actions;
- deal stage changes;
- deletion/retention actions.

## 15. API Evolution

- Additive optional fields do not require a new major version.
- Removing/renaming fields or changing semantics requires a versioned migration.
- Prompt, analysis schema, normalization, and scoring methodology have their own explicit versions.
- Deprecations include an announced timeline and usage monitoring.
- API clients must ignore unknown response fields.
- Contract tests protect both route schemas and server-action inputs.

