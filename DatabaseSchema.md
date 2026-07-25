# Database Schema

## 1. Design Principles

- PostgreSQL in Supabase is the system of record.
- UUID primary keys are generated server-side.
- Tenant-owned tables include a non-null `organization_id`.
- Money uses `numeric` plus an ISO 4217 `currency_code`; never floating point.
- Timestamps use `timestamptz` and are stored in UTC.
- Unknown values are `null`, never zero or empty text.
- Source, normalized, user, AI-generated, and AI-inferred data remain distinct.
- Important records use lifecycle statuses rather than routine hard deletion.
- All schema changes are version-controlled SQL migrations.
- RLS is enabled and tested for every tenant-owned table.

Common columns are omitted below for readability: `id`, `created_at`, `updated_at`, and, where applicable, `organization_id`, `created_by`, and `updated_by`.

## 2. Schema Names

Use logical PostgreSQL schemas to clarify ownership:

- `public`: Supabase-facing application tables and RPC functions;
- `audit`: append-only security and change records;
- `internal`: server-only operational tables where appropriate.

If tooling friction makes multiple schemas costly initially, retain the same boundaries through naming and privileges, then separate physically later.

## 3. Shared Platform Tables

### `profiles`

Application profile paired one-to-one with `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK/FK | References `auth.users(id)` |
| `display_name` | text | |
| `avatar_path` | text nullable | Storage path, not public URL |
| `locale` | text | `en` or `es` initially |
| `time_zone` | text | IANA time-zone name |
| `status` | text | `active`, `suspended`, `deleted` |

### `organizations`

| Column | Type | Notes |
|---|---|---|
| `name` | text | |
| `slug` | citext unique | URL-safe |
| `status` | text | `trial`, `active`, `suspended`, `closed` |
| `default_locale` | text | |
| `default_currency` | char(3) | |
| `time_zone` | text | |

### `organization_memberships`

| Column | Type | Notes |
|---|---|---|
| `organization_id` | uuid FK | |
| `user_id` | uuid FK | |
| `role` | text | Initial role enum/check constraint |
| `status` | text | `invited`, `active`, `suspended`, `removed` |
| `invited_by` | uuid nullable | |
| `joined_at` | timestamptz nullable | |

Unique: `(organization_id, user_id)`.

### `organization_invites`

Stores hashed invite tokens, intended email, role, expiration, accepted/revoked timestamps, and inviter. Raw tokens are never stored.

### `user_preferences`

Per-user/per-organization preferences such as product landing page, notification settings, and accessibility preferences. Use typed columns for policy-relevant settings; use constrained `jsonb` only for low-risk display preferences.

### `files`

Metadata for objects held in private Supabase Storage buckets.

| Column | Type | Notes |
|---|---|---|
| `storage_bucket` | text | |
| `storage_path` | text | Unique within bucket |
| `original_name` | text | Display only |
| `mime_type` | text | Verified server-side |
| `byte_size` | bigint | |
| `sha256` | text | Integrity/deduplication |
| `scan_status` | text | `pending`, `clean`, `rejected`, `failed` |
| `classification` | text | e.g. `general`, `deal_confidential`, `workforce_sensitive` |

Access is granted through domain-specific link tables, not merely possession of a file ID.

### `notifications`

Recipient, type, localized template key, safe parameter payload, read timestamp, delivery status, and related resource reference.

### `subscriptions` and `usage_events`

Reserve provider-neutral billing identifiers and entitlements. Provider webhooks are the source of truth for subscription state. `usage_events` uses an idempotency key and records metered events without embedding provider behavior into product tables.

### `job_runs`

| Column | Type | Notes |
|---|---|---|
| `job_type` | text | |
| `status` | text | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `idempotency_key` | text | Unique within job type/scope |
| `attempt_count` | integer | |
| `input_ref` | jsonb | IDs/references, not large raw payloads |
| `result_ref` | jsonb nullable | |
| `error_code` | text nullable | Safe error taxonomy |
| `available_at` | timestamptz | |
| `started_at` / `finished_at` | timestamptz nullable | |

### `audit.events`

Append-only records containing actor, organization, action, resource type/ID, request/correlation ID, safe before/after summaries, IP metadata where legally appropriate, and timestamp. Audit events must not store secrets or unnecessary full documents.

## 4. DealFlow Source and Normalization

### `opportunity_sources`

Catalog of approved providers/import types with terms metadata, connector status, and last successful sync. Credentials remain in the environment/secret manager, not this table.

### `source_opportunity_records`

Immutable or append-only snapshots of external evidence.

| Column | Type | Notes |
|---|---|---|
| `source_id` | uuid FK | |
| `external_id` | text | Provider identifier |
| `source_url` | text nullable | |
| `fetched_at` | timestamptz | |
| `content_hash` | text | |
| `raw_payload` | jsonb | Access restricted; retention policy required |
| `parse_status` | text | |
| `supersedes_id` | uuid nullable | Previous snapshot |

Unique: `(source_id, external_id, content_hash)`.

### `opportunities`

The canonical normalized opportunity.

| Column | Type | Notes |
|---|---|---|
| `title` | text | |
| `industry_code` | text nullable | Versioned taxonomy |
| `location_country` | char(2) nullable | |
| `location_region` | text nullable | |
| `location_city` | text nullable | |
| `asking_price` | numeric nullable | |
| `currency_code` | char(3) nullable | |
| `annual_revenue` | numeric nullable | |
| `cash_flow` | numeric nullable | Define measure/source |
| `ebitda` | numeric nullable | |
| `employee_count` | integer nullable | |
| `founded_year` | integer nullable | |
| `seller_financing` | boolean nullable | Null means unknown |
| `status` | text | `active`, `under_offer`, `sold`, `withdrawn`, `unknown` |
| `normalization_version` | text | |

### `opportunity_source_links`

Many-to-many relationship between canonical opportunities and source snapshots. Includes match method, confidence, matched-by user/job, and timestamps.

### `opportunity_field_provenance`

Tracks where each normalized field came from.

| Column | Type | Notes |
|---|---|---|
| `opportunity_id` | uuid FK | |
| `field_name` | text | Allowlisted |
| `source_record_id` | uuid FK nullable | |
| `source_path` | text nullable | Field path in source |
| `normalization_method` | text | `direct`, `converted`, `parsed`, `user_corrected` |
| `original_value` | jsonb nullable | |
| `normalized_value` | jsonb nullable | |
| `confidence` | numeric nullable | 0–1 with check constraint |

### `deduplication_candidates`

Pair of opportunity/source records, matching signals, confidence, algorithm version, disposition, and reviewer. A unique ordered pair prevents duplicate candidate rows.

## 5. DealFlow User Workflow

### `saved_searches`

Name, typed filter JSON validated by application schema, natural-language query (optional), notification cadence, and active status.

### `saved_opportunities`

Organization/user relationship to an opportunity with saved timestamp, owner, and optional list. Unique `(organization_id, opportunity_id)`.

### `deal_pipelines` and `pipeline_stages`

Organization-configurable pipeline. Stages have stable IDs, labels, order, terminal-state flag, and optional probability. Do not encode business logic only in display names.

### `deals`

| Column | Type | Notes |
|---|---|---|
| `opportunity_id` | uuid FK | |
| `pipeline_id` | uuid FK | |
| `stage_id` | uuid FK | Must belong to pipeline |
| `owner_user_id` | uuid nullable | Active member |
| `status` | text | |
| `target_close_date` | date nullable | |
| `last_activity_at` | timestamptz nullable | |

### `deal_stage_history`

Append-only stage changes with actor, old/new stage, timestamp, and optional reason.

### `deal_notes`, `deal_tasks`, and `deal_files`

Tenant-scoped collaboration records. Notes support explicit visibility; files reference `files`. Tasks include assignee, status, priority, and due date.

### `comparisons`

Saved comparison container and ordered `comparison_items`. Computed comparison values should reference the exact opportunity snapshot/analysis version used.

## 6. AI and Scoring Tables

### `ai_prompt_versions`

Immutable prompt template metadata: key, semantic version, purpose, schema version, status, template hash, approved-by, and effective date. Store prompt content in a server-restricted location or table.

### `ai_runs`

| Column | Type | Notes |
|---|---|---|
| `purpose` | text | e.g. `opportunity_analysis` |
| `subject_type` / `subject_id` | text/uuid | Allowlisted polymorphic reference |
| `prompt_version_id` | uuid FK | |
| `provider` / `model` | text | |
| `input_snapshot_hash` | text | |
| `status` | text | |
| `output_schema_version` | text | |
| `token_input` / `token_output` | integer nullable | |
| `estimated_cost` | numeric nullable | |
| `started_at` / `completed_at` | timestamptz nullable | |
| `error_code` | text nullable | No sensitive raw error |

### `ai_analysis_results`

One result per successful analysis run, containing structured fields for executive summary, strengths, weaknesses, risks, growth opportunities, acquisition considerations, next steps, missing information, confidence, and citations. Store lists as constrained `jsonb` with runtime schema validation.

### `scoring_methodology_versions`

Immutable versions with name, version, factor definitions, weights, thresholds, missing-data policy, approval status, approver, and effective date. Weights must have validation and a documented interpretation.

### `opportunity_scores`

| Column | Type | Notes |
|---|---|---|
| `opportunity_id` | uuid FK | |
| `methodology_version_id` | uuid FK | |
| `input_snapshot_hash` | text | |
| `score` | numeric | 0–100 |
| `confidence` | numeric | 0–1 |
| `positive_factors` | jsonb | Structured and validated |
| `negative_factors` | jsonb | |
| `missing_information` | jsonb | |
| `calculated_at` | timestamptz | |
| `explanation_ai_run_id` | uuid nullable | Explanation is separate from calculation |

### `opportunity_score_factors`

Factor name/version, raw value, normalized value, weight, contribution, evidence references, missing flag, and reason. This makes the overall score reproducible and explainable.

### `ai_feedback`

Authorized user's rating/correction for an AI result; never mutates the original result. Used for evaluation only under an approved privacy policy.

## 7. Workforce Tables (Phase 4)

### `employees`

Stable employee record: employee number, preferred/legal names, contact details, preferred locale, status, and linked `profile_user_id` when self-service access exists.

### `employment_records`

Position, department, manager, start/end date, employment type, status, work location, and effective dates. History is preserved rather than overwritten.

### `compensation_records`

Amount, currency, cadence, effective dates, and change reason. Apply stricter RLS and audit rules. Do not combine this access policy with general employee profiles.

### `departments`

Name, parent department, leader, and active status. Prevent cycles in the hierarchy.

### `employee_documents`

Employee-to-file relationship with document type, effective/expiration dates, acknowledgment status, and visibility classification.

### `certifications` and `employee_certifications`

Certification definition plus employee issue/expiry status and evidence file.

### `training_courses` and `employee_training`

Course definition, assignment/completion state, completion date, expiry, and evidence.

### `pto_policies`, `pto_balances`, `pto_requests`

Policy rules, auditable balance ledger, and request workflow. The ledger is the source of truth; displayed balance is derived or transactionally maintained. Payroll synchronization is out of scope.

### `announcements` and `announcement_receipts`

Localized announcement variants, audience rules, publish/expiry times, and read acknowledgments.

## 8. RLS Policy Model

Representative policy concepts:

- Profiles: a user reads/updates permitted self fields; organization admins see only appropriate member fields.
- Organization data: active membership plus an explicit permission.
- DealFlow data: active member with DealFlow permission and matching `organization_id`.
- Workforce general data: workforce administrator, permitted manager scope, or limited employee self-service.
- Compensation: workforce admin/owner only unless a narrowly defined self-view policy is approved.
- Files: access requires both tenant membership and permission on the linked domain record.
- AI results: same access as the subject record.
- Audit logs: tenant owner/admin read-only; server append only.

Service-role access bypasses RLS and must be confined to audited server jobs. Ordinary server requests should use the user's scoped Supabase client whenever possible.

## 9. Integrity and Indexing

Required constraints:

- check constraints for score/confidence ranges;
- non-negative constraints for financial and employee-count fields where appropriate;
- currency required whenever a monetary amount is present;
- valid stage/pipeline relationship enforced through composite keys or a trigger;
- unique active membership and saved-opportunity relationships;
- immutable methodology and prompt versions after activation;
- foreign keys with deliberate delete behavior—avoid broad cascading deletion.

Initial indexes:

- tenant scope plus common ordering: `(organization_id, created_at desc)`;
- membership lookup: `(user_id, status)`;
- opportunity filters for status, industry, location, asking price, revenue, and cash flow;
- deals by `(organization_id, stage_id, updated_at desc)`;
- jobs by `(status, available_at)`;
- AI runs by subject and completion time;
- employee status/department/manager within organization.

Use full-text or external search only after validating search quality and scale. Do not add a separate search system for the first small dataset.

## 10. Migration and Data Lifecycle

- Migrations are additive and backward compatible when possible.
- Seed data includes only synthetic/demo records.
- Production data never moves into preview environments.
- Soft deletion is used where recovery, audit, or legal retention requires it.
- User-facing deletion triggers a documented purge/anonymization workflow across database rows, files, logs, and AI artifacts.
- Source-data retention follows provider terms.
- Workforce retention follows applicable law and company policy.
- Backups must be encrypted, access-controlled, and periodically restore-tested.

