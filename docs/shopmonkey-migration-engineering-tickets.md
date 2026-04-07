# Shopmonkey Migration Engineering Tickets

This document turns Shopmonkey data migration into concrete engineering tickets.

Companion docs:

- [architecture.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/architecture.md)
- [customer-sms-provider-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-provider-engineering-tickets.md)
- [Shopmonkey Overview](https://shopmonkey.dev/overview)
- [Shopmonkey Customer API](https://shopmonkey.dev/resources/customer)
- [Shopmonkey Export API](https://shopmonkey.dev/resources/export)
- [Shopmonkey Webhooks](https://shopmonkey.dev/webhooks)

These tickets are intentionally scoped around the current codebase.

They are written to bring Shopmonkey data into the existing internal records instead of turning Shopmonkey into a permanent runtime dependency.

## Scope of this ticket pack

Included:

- company-scoped Shopmonkey connection and verification
- one-time historical import
- resumable import runs with checkpoints and idempotent external mappings
- customer, address, vehicle, visit or job, estimate, and invoice coverage
- inspection and attachment import where source artifacts are available
- optional short-term webhook delta sync during cutover
- onboarding UI, run visibility, release documentation, and operational checks

Not included yet:

- permanent bi-directional sync
- writes back into Shopmonkey
- guaranteed parity for every Shopmonkey custom field or automation
- imported message inbox or SMS history
- automatic merge of ambiguous duplicates without review
- vendor-neutral migration support for every shop management system on day one

## Product boundary

- After import, internal tables remain the system of record.
- Shopmonkey is a migration source, not a live transactional dependency for normal office workflows.
- Imported rows must not enqueue customer communications, reminders, or automation side effects.
- Historical provenance should be stored through external mapping tables and import metadata rather than overloading customer-facing fields.
- If the export endpoint yields usable historical snapshots, prefer export for bulk history and use resource APIs plus webhooks for verification and deltas.

## Proposed entity mapping

- Shopmonkey `customer` -> `customers` + `customer_addresses`
- Shopmonkey `vehicle` -> `vehicles`
- Shopmonkey `order` -> `jobs`
- Shopmonkey `inspection` -> `inspections` + `inspection_items`
- Shopmonkey file and blob artifacts -> `attachments`
- Shopmonkey estimate-like order state and line items -> `estimates` + `estimate_line_items`
- Shopmonkey invoice or posted financial state -> `invoices` + `invoice_line_items`
- Shopmonkey payment history -> phase decision required because the current `payments` table is Stripe-shaped

## Working assumptions

1. Existing core schema stays in place:
   - `customers`
   - `customer_addresses`
   - `vehicles`
   - `jobs`
   - `estimates`
   - `invoices`
   - `payments`
   - `inspections`
   - `attachments`
2. `packages/api-client` remains the preferred data write boundary unless an import-specific repository is required to bypass interactive workflow guards safely.
3. Service-role processing is allowed for resumable imports and attachment backfills.
4. A company admin starts the import, but imported historical creator or technician names may need to live in provenance metadata instead of internal user rows.
5. Ambiguous matches create review items instead of silently duplicating or overwriting records.
6. Webhook delta sync is temporary cutover assistance, not an indefinite architecture commitment.
7. Default customer messaging and automation readiness stay unchanged by imported history.

## Recommended delivery order

1. connection model and encrypted credential storage
2. import run, checkpoint, conflict, and external mapping tables
3. Shopmonkey client and verification action
4. resumable processor and internal process route
5. import-safe write paths for historical terminal states
6. customer and vehicle import
7. visit or job import
8. estimate and invoice import with a payment boundary decision
9. inspection and attachment import
10. webhook delta sync
11. onboarding UI, observability, testing, and release docs

## Ticket 1: Add a company migration-source account model for Shopmonkey

### Goal

Create a secure, company-scoped place to store Shopmonkey credentials and connection state.

### User outcome

An owner or admin can connect the company Shopmonkey account once and reuse it for verification, imports, and temporary delta sync.

### Current implementation surface

- account-model precedents:
  - `supabase/migrations/0079_procurement_provider_core.sql`
  - `supabase/migrations/0098_sms_provider_accounts.sql`
- encrypted credential precedents:
  - `apps/web/lib/procurement/providers/credentials.ts`
  - `apps/web/lib/communications/sms-providers/service.ts`

### Required changes

- Add `migration_source_provider` enum with:
  - `shopmonkey`
- Add `migration_source_account_status` enum with:
  - `connected`
  - `action_required`
  - `error`
  - `disconnected`
- Add `migration_source_accounts` table with:
  - `id`
  - `company_id`
  - `provider`
  - `status`
  - `display_name`
  - `credential_ciphertext`
  - `credential_hint`
  - `settings_json`
  - `capabilities_json`
  - `webhook_secret`
  - `last_verified_at`
  - `last_error_message`
  - `created_at`
  - `updated_at`
- Add uniqueness and safety constraints:
  - one row per `company_id + provider`
  - credentials never stored in plaintext
  - webhook secret optional until delta sync is enabled
- Add RLS policies and an updated-at trigger matching current multi-tenant patterns.
- Add repository helpers in `packages/api-client` for:
  - upsert account
  - fetch account by provider
  - list company accounts
  - update verification state
  - disconnect account
- Add a new credential helper such as `apps/web/lib/migrations/credentials.ts` backed by a dedicated server secret like `MIGRATION_SOURCE_CREDENTIAL_SECRET`.

### Recommended implementation

- Make the table generic to migration sources even if `shopmonkey` is the only supported provider at first.
- Store only the long-lived Shopmonkey API key for this phase rather than building an email-password login dependency.
- Keep provider credentials and webhook secrets in the web app server layer, not in client-readable settings.

### Acceptance criteria

- A company can save one Shopmonkey account record.
- Credentials are encrypted at rest.
- Office-only users can manage their own company record without crossing tenant boundaries.

## Ticket 2: Add import-run, checkpoint, conflict, and external-mapping tables

### Goal

Make imports resumable, idempotent, and reviewable.

### User outcome

If an import is interrupted, the team can resume it without creating duplicate customers, vehicles, or visits.

### Current implementation surface

- processing precedent:
  - `apps/web/lib/communications/processor.ts`
  - `apps/web/app/api/internal/communications/process/route.ts`
- service-role precedent:
  - `apps/web/lib/supabase/service-role.ts`
- shared repository export surface:
  - `packages/api-client/src/index.ts`

### Required changes

- Add `data_import_run_status` enum with:
  - `queued`
  - `processing`
  - `paused`
  - `completed`
  - `failed`
  - `canceled`
- Add `data_import_runs` table with:
  - `id`
  - `company_id`
  - `source_account_id`
  - `provider`
  - `status`
  - `started_by_user_id`
  - `options_json`
  - `summary_json`
  - `started_at`
  - `finished_at`
  - `last_heartbeat_at`
  - `created_at`
  - `updated_at`
- Add `data_import_checkpoints` table keyed by run and entity stage with:
  - `entity_type`
  - `cursor`
  - `last_external_updated_at`
  - `processed_count`
  - `failed_count`
  - `status`
  - `last_error_message`
- Add `external_record_mappings` table with:
  - `company_id`
  - `provider`
  - `entity_type`
  - `external_id`
  - `internal_table`
  - `internal_id`
  - `payload_hash`
  - `source_updated_at`
  - `last_import_run_id`
  - `created_at`
  - `updated_at`
- Add `data_import_conflicts` table for ambiguous matches and merge-review outcomes.
- Add repository helpers for:
  - run creation and locking
  - checkpoint upsert
  - conflict creation and resolution
  - external mapping lookup and upsert

### Recommended implementation

- Treat `external_record_mappings` as the durable idempotency key for every imported object.
- Keep conflicts separate from mappings so manual review does not pollute the canonical mapping table.
- Use run-level `summary_json` for operator-friendly counts and stage-level checkpoints for resume logic.

### Acceptance criteria

- An interrupted import can resume from the last completed checkpoint.
- The same Shopmonkey record does not create duplicate internal rows across reruns.
- Ambiguous matches are visible as explicit conflicts.

## Ticket 3: Add a Shopmonkey client, normalization layer, and verification action

### Goal

Isolate Shopmonkey API transport and source-shape handling from the rest of the app.

### User outcome

The system can verify the supplied API key and fetch source records without leaking provider details into every import step.

### Current implementation surface

- provider transport precedent:
  - `apps/web/lib/carfax/provider.ts`
- adapter verification precedents:
  - `apps/web/lib/procurement/providers/types.ts`
  - `apps/web/lib/procurement/providers/service.ts`
  - `apps/web/lib/communications/sms-providers/types.ts`
  - `apps/web/lib/communications/sms-providers/service.ts`

### Required changes

- Create `apps/web/lib/migrations/shopmonkey/client.ts`.
- Create companion files such as:
  - `apps/web/lib/migrations/shopmonkey/types.ts`
  - `apps/web/lib/migrations/shopmonkey/normalization.ts`
  - `apps/web/lib/migrations/shopmonkey/webhooks.ts`
- Implement authenticated helpers for:
  - connection verification
  - customer retrieval
  - vehicle retrieval
  - order retrieval
  - inspection retrieval
  - export request and download flow
- Normalize source timestamps, IDs, and nested line-item shapes into import-friendly internal DTOs.
- Add rate-limit handling and bounded retry behavior.
- Add a company-scoped verification action that updates the saved account status and capabilities.

### Recommended implementation

- Keep raw HTTP payload handling in the Shopmonkey client layer only.
- Prefer export-backed bulk retrieval if the payload is good enough for historical imports; keep per-resource fetches for targeted reruns and delta reconciliation.
- Record which entity groups are actually accessible to the supplied API key so the UI can surface partial coverage honestly.

### Acceptance criteria

- A saved Shopmonkey account can be verified from the server.
- The client can fetch paginated or exported source records for the supported entity groups.
- Import orchestration code consumes normalized DTOs instead of raw provider payloads.

## Ticket 4: Add a resumable import processor and internal processing route

### Goal

Run imports asynchronously in bounded batches instead of tying them to the initiating web request.

### User outcome

An owner can start an import and leave the page while progress continues safely in the background.

### Current implementation surface

- processing precedent:
  - `apps/web/lib/communications/processor.ts`
  - `apps/web/app/api/internal/communications/process/route.ts`
- service-role client:
  - `apps/web/lib/supabase/service-role.ts`

### Required changes

- Create `apps/web/lib/migrations/processor.ts`.
- Create an authenticated internal route such as:
  - `apps/web/app/api/internal/imports/process/route.ts`
- Add processor behaviors for:
  - run claiming and locking
  - heartbeat updates
  - per-entity stage execution
  - pause, cancel, and resume
  - bounded concurrency
  - error capture per checkpoint
- Add an env secret such as `IMPORTS_PROCESS_SECRET`.
- Split attachment backfills from core record import so large files do not stall customer and vehicle creation.

### Recommended implementation

- Process one company run at a time.
- Use small, predictable chunks so rate limits and partial failures are easier to recover from.
- Keep attachment download and upload work lower priority than core structured data.

### Acceptance criteria

- An import run can be started, resumed, paused, and canceled.
- Failures stay localized to the run or checkpoint instead of corrupting unrelated company data.
- Progress survives page reloads and does not depend on an open browser tab.

## Ticket 5: Add import-safe write paths for historical terminal states

### Goal

Create historical records without weakening the normal workflow guards that protect live office editing.

### User outcome

Imported accepted estimates, paid invoices, and completed inspections appear correctly without breaking day-to-day workflow protections.

### Current implementation surface

- repository layers:
  - `packages/api-client/src/repositories/jobs.ts`
  - `packages/api-client/src/repositories/estimates.ts`
  - `packages/api-client/src/repositories/invoices.ts`
  - `packages/api-client/src/repositories/inspections.ts`
  - `packages/api-client/src/repositories/attachments.ts`
- workflow guard migrations:
  - `supabase/migrations/0019_inspections.sql`
  - `supabase/migrations/0025_estimates.sql`
  - `supabase/migrations/0032_invoices.sql`
  - `supabase/migrations/0037_payments.sql`

### Required changes

- Add import-specific repository or service functions that can:
  - create rows directly in historical end states
  - preserve source timestamps
  - write line items before final lock state is applied
  - suppress communication and automation side effects
- Define how required actor fields are populated when Shopmonkey users do not map to internal users:
  - use the initiating admin
  - or use a dedicated company-scoped import actor
- Preserve external staff names and source audit details in import provenance metadata instead of forcing user-row creation.

### Recommended implementation

- Do not relax end-user mutation guards globally.
- Keep historical-import exceptions inside dedicated import write paths or scoped database settings.
- Prefer an explicit import actor and provenance metadata over trying to create a fake employee directory from day one.

### Acceptance criteria

- Imported terminal artifacts can be created successfully.
- Existing office workflows keep their current guardrails.
- Imports do not queue customer communications or reminders.

## Ticket 6: Add customer and address matching plus import

### Goal

Bring Shopmonkey customers into the existing customer model with safe dedupe behavior.

### User outcome

Customer records come across without flooding the workspace with obvious duplicates.

### Current implementation surface

- schema:
  - `supabase/migrations/0006_customers.sql`
  - `supabase/migrations/0007_customer_addresses.sql`
- repositories:
  - `packages/api-client/src/repositories/customers.ts`
  - `packages/api-client/src/repositories/customer-addresses.ts`
- validation:
  - `packages/validation/src/customer.ts`

### Required changes

- Normalize names, phones, emails, and addresses before matching.
- Define customer match precedence:
  - existing external mapping
  - exact normalized email
  - exact normalized phone
  - manual conflict
- Import customer core fields and addresses.
- Avoid overwriting stronger internal values with blanks or weaker source values.
- Create conflict records when a source customer could match multiple internal rows.

### Recommended implementation

- Keep raw Shopmonkey payloads out of customer-facing notes.
- Store source payload snapshots only in import metadata where needed for debugging.
- Favor additive import plus conflict review over aggressive auto-merge heuristics.

### Acceptance criteria

- Customers and addresses import successfully into the current schema.
- Known duplicates can be matched instead of duplicated.
- Ambiguous customers are held for review rather than imported blindly.

## Ticket 7: Add vehicle import and ownership alignment

### Goal

Bring Shopmonkey vehicles into the current customer-owned vehicle model while respecting uniqueness constraints.

### User outcome

Vehicles appear on the right customer records with VIN and plate collisions handled safely.

### Current implementation surface

- schema:
  - `supabase/migrations/0008_vehicles.sql`
- repositories:
  - `packages/api-client/src/repositories/vehicles.ts`
  - `packages/api-client/src/repositories/service-history.ts`
- validation:
  - `packages/validation/src/vehicle.ts`

### Required changes

- Define vehicle match precedence:
  - existing external mapping
  - exact VIN
  - exact license plate plus state
  - manual conflict
- Import supported fields:
  - year
  - make
  - model
  - trim
  - engine
  - VIN
  - plate
  - color
  - odometer
  - notes
- Link vehicles to imported or matched customers.
- Create conflicts when ownership is ambiguous or uniqueness constraints collide.

### Recommended implementation

- Treat VIN as the strongest key.
- Use plate matching only when state is present and normalized.
- Do not move an already-established internal vehicle between customers without a confident mapping rule.

### Acceptance criteria

- Vehicles import without violating the current VIN and plate uniqueness constraints.
- Customer ownership links stay consistent.
- Odometer and descriptive vehicle context survive import when present.

## Ticket 8: Add Shopmonkey order to internal visit or job import

### Goal

Map Shopmonkey repair orders into the current internal `jobs` data model while the office product continues its transition toward `Visits`.

### User outcome

Historical work history, scheduled visits, and active jobs land in the current office workflow without a second parallel record type.

### Current implementation surface

- schema:
  - `supabase/migrations/0013_job_status_and_jobs.sql`
- repositories:
  - `packages/api-client/src/repositories/jobs.ts`
  - `packages/api-client/src/repositories/dispatch.ts`
  - `packages/api-client/src/repositories/service-history.ts`
- workflow logic:
  - `apps/web/lib/jobs/workflow.ts`

### Required changes

- Define Shopmonkey order-state to `job_status` mapping.
- Map source fields into:
  - `title`
  - `description`
  - `customer_concern`
  - `internal_summary`
  - `scheduled_start_at`
  - `scheduled_end_at`
  - `arrival_window_start_at`
  - `arrival_window_end_at`
  - `started_at`
  - `completed_at`
  - `canceled_at`
- Decide how to handle technician assignment:
  - no assignment when staff mapping is not configured
  - provenance note when source technician names exist
- Preserve active versus archived state safely.

### Recommended implementation

- Keep internal `jobs` as the persisted model for now even if office-facing copy says `Visits`.
- Do not guess internal technician IDs from free-text names.
- Capture unsupported sub-objects as provenance notes or metadata instead of inventing new schema on the first pass.

### Acceptance criteria

- Imported orders appear in the current jobs or visits surfaces.
- Scheduling and lifecycle timestamps are preserved where available.
- Unmapped staff references do not break import or produce incorrect assignments.

## Ticket 9: Add estimate and invoice import, and make an explicit payment-history boundary decision

### Goal

Bring historical commercial artifacts into the current pricing and billing model without pretending Shopmonkey payments are Stripe payments.

### User outcome

Imported estimates and invoices show the right line items, totals, and statuses, and paid invoices do not carry fake Stripe identifiers.

### Current implementation surface

- schema:
  - `supabase/migrations/0025_estimates.sql`
  - `supabase/migrations/0032_invoices.sql`
  - `supabase/migrations/0037_payments.sql`
- repositories:
  - `packages/api-client/src/repositories/estimates.ts`
  - `packages/api-client/src/repositories/invoices.ts`
  - `packages/api-client/src/repositories/payments.ts`
  - `packages/api-client/src/repositories/signatures.ts`

### Required changes

- Map source commercial line items into internal `labor`, `part`, and `fee` rows.
- Preserve estimate and invoice lifecycle timestamps:
  - sent
  - accepted
  - declined
  - issued
  - paid
  - voided
- Define how one Shopmonkey order maps to one internal estimate and one internal invoice under current uniqueness constraints.
- Decide how to handle source revision history because the current schema enforces:
  - one estimate per job
  - one invoice per job
- Make an explicit payment-history decision:
  - phase 1: import invoice paid and balance state only
  - phase 2: widen the payments model for non-Stripe historical rows
- Do not synthesize fake Stripe checkout session IDs, event IDs, or payment intents.
- Do not synthesize internal signature rows from source approval artifacts unless the data actually matches the internal signature model.
- Import signed PDFs or other finalized artifacts as attachments when available.

### Recommended implementation

- Phase 1 should prioritize correct estimate and invoice state, totals, and audit timestamps over full imported payment-ledger parity.
- If Shopmonkey exposes multiple estimate or invoice revisions per order, phase 1 should collapse them to the latest authoritative customer-facing artifact unless you intentionally widen the schema.
- Keep approval and payment provenance in import metadata if the raw source shape does not map cleanly to the current tables.
- Revisit a provider-agnostic `payments` model only when historical payment rows are a real cutover requirement.

### Acceptance criteria

- Imported estimates and invoices display correct totals and lifecycle states.
- Paid invoices do not rely on fake Stripe data.
- The team has an explicit documented decision on whether detailed Shopmonkey payment rows are in scope for phase 1.

## Ticket 10: Add inspection and attachment import

### Goal

Carry over inspection findings and attached source artifacts without making file backfills a blocker for core record import.

### User outcome

Shops can see historical inspection outcomes and supporting photos or documents in the current visit history.

### Current implementation surface

- schema:
  - `supabase/migrations/0019_inspections.sql`
  - `supabase/migrations/0022_attachments.sql`
- repositories:
  - `packages/api-client/src/repositories/inspections.ts`
  - `packages/api-client/src/repositories/attachments.ts`

### Required changes

- Map Shopmonkey inspection states and findings into:
  - `inspections`
  - `inspection_items`
- Decide how to handle multiple source inspections for one order because the current schema allows only one inspection per job.
- Define source-to-internal item status mapping.
- Import attachments or blobs into storage using a stable import path convention.
- Link files to:
  - job
  - inspection
  - inspection item
  where source linkage is available.
- Record retryable metadata for failed file transfers without rolling back the whole run.

### Recommended implementation

- Import structured inspection data first and backfill files asynchronously afterward.
- If the source contains multiple inspections for one order, phase 1 should import the latest or most authoritative inspection unless the internal model is widened first.
- Default attachment category to `general` unless the source semantics clearly map to `before`, `after`, `issue`, or `inspection`.
- Preserve source file names and mime types when possible.

### Acceptance criteria

- Historical inspections can be viewed from the current job or visit context.
- Attachment backfills can fail and retry without corrupting core structured records.
- Imported files have stable storage paths and provenance links.

## Ticket 11: Add webhook delta sync and drift reconciliation for cutover windows

### Goal

Keep imported data reasonably current while a shop is still transitioning off Shopmonkey.

### User outcome

A company can run the initial import, continue operating during the transition, and then cut over with less manual re-entry.

### Current implementation surface

- webhook precedents:
  - `apps/web/app/api/webhooks/communications/resend/route.ts`
  - `apps/web/app/api/webhooks/communications/twilio/[providerAccountId]/route.ts`
  - `apps/web/lib/communications/delivery-webhooks.ts`
- webhook URL construction precedent:
  - `apps/web/lib/communications/sms-providers/service.ts`

### Required changes

- Add a Shopmonkey webhook route such as:
  - `apps/web/app/api/webhooks/imports/shopmonkey/[accountId]/route.ts`
- Store and manage a webhook secret on the migration-source account.
- Verify signatures according to the Shopmonkey webhook scheme.
- Process `INSERT`, `UPDATE`, and `DELETE` events for supported tables.
- Update checkpoints and `external_record_mappings` based on delta activity.
- Add a periodic reconciliation path for missed webhooks using changed-since or entity-change style pull logic.
- Add a way to disable delta sync when cutover is complete or the account is disconnected.

### Recommended implementation

- Keep webhook scope narrow to the entities already supported by the importer.
- Treat webhooks as temporary cutover support rather than a permanent sync architecture.
- Periodic reconciliation should close gaps from delivery failures or disabled endpoints.

### Acceptance criteria

- Supported records can update after the initial import during the cutover window.
- Missed webhook deliveries can be repaired by reconciliation.
- Delta sync can be turned off cleanly once the shop is live in the internal system.

## Ticket 12: Add settings UI, run controls, and cutover UX

### Goal

Give admins one office-only place to connect Shopmonkey, run imports, review conflicts, and finish cutover.

### User outcome

An owner can manage migration without using raw database tools or hidden internal routes.

### Current implementation surface

- settings and integration precedents:
  - `apps/web/app/dashboard/settings/page.tsx`
  - `apps/web/app/dashboard/settings/communications/page.tsx`
  - `apps/web/app/dashboard/settings/communications/twilio/page.tsx`
  - `apps/web/app/dashboard/parts/integrations/page.tsx`
  - `apps/web/app/dashboard/parts/integrations/repairlink/page.tsx`
- company context:
  - `apps/web/lib/company-context.ts`

### Required changes

- Add a `Settings > Data imports` summary page.
- Add a Shopmonkey settings page for:
  - credential entry
  - verification
  - import start
  - pause or cancel
  - rerun failed stage
  - conflict review entry
  - cutover complete
- Show run progress:
  - status
  - counts by entity
  - last heartbeat
  - last webhook received
  - open conflicts
- Restrict management to company owners and admins.
- Add explicit warnings that imports are additive and may require duplicate review.

### Recommended implementation

- Keep migration UX in settings or onboarding, not the primary operational nav.
- Reuse the existing settings-page interaction model with server actions and `revalidatePath`.
- Surface partial coverage honestly if the API key lacks access to some entity groups.

### Acceptance criteria

- An owner or admin can connect and verify Shopmonkey from the UI.
- An import run can be started and monitored from the UI.
- Conflict review and cutover completion are visible operational steps, not hidden assumptions.

## Ticket 13: Add observability, fixtures, testing, and release documentation

### Goal

Make migration behavior diagnosable before it touches production customer data.

### User outcome

The team can trust import counts, retry behavior, and post-import validation before telling a shop to switch.

### Current implementation surface

- test precedents:
  - `apps/web/lib/communications/delivery-webhooks.test.ts`
  - `apps/web/lib/communications/sms-providers/service.test.ts`
  - `apps/web/lib/labor-guide/mapping.test.ts`
  - `packages/api-client/src/repositories/jobs.test.ts`
- documentation:
  - `docs/architecture.md`
  - `docs/environment.md`
  - `.env.example`

### Required changes

- Add unit tests for:
  - source normalization
  - customer and vehicle matching
  - status mapping
  - invoice and estimate line-item conversion
- Add processor tests for:
  - resumability
  - idempotency
  - stale-lock recovery
  - conflict creation
- Add anonymized Shopmonkey fixture payloads for supported entities.
- Add required env vars to `.env.example` and `docs/environment.md`.
- Add an operator runbook covering:
  - pre-import checklist
  - import execution
  - conflict review
  - post-import spot checks
  - cutover completion

### Recommended implementation

- Include pre-import and post-import entity counts in the run summary so operators can compare expectations quickly.
- Add a small release checklist for internal staff before the feature is used with real customer data.
- Document unsupported or partial-coverage cases clearly so sales and onboarding do not over-promise.

### Acceptance criteria

- The mapping and processor layers have focused automated tests.
- Required env vars and operating steps are documented.
- The team has a repeatable checklist for validating a real customer migration.

## Rough effort scale

- `S`: 2 to 4 engineer-days
- `M`: 1 to 1.5 engineer-weeks
- `L`: 2 to 3 engineer-weeks
- `XL`: 3 to 4 engineer-weeks

Assumptions behind the estimates:

- one engineer-week means one experienced full-stack engineer working mostly on this stream
- estimates include implementation plus focused test coverage, not broad polish or support load
- Shopmonkey source-shape surprises can push any API-facing ticket up by one size
- attachment and financial-history fidelity are the highest variance areas

## Ticket sizing and dependencies

| Ticket | Size | Depends on | Notes |
| --- | --- | --- | --- |
| 1. migration-source account model | `M` | none | Straightforward because procurement and SMS account precedents already exist. |
| 2. import runs, checkpoints, mappings, conflicts | `L` | 1 | This is the backbone for idempotency, resume, and operator visibility. |
| 3. Shopmonkey client and verification | `L` | 1 | API and export handling are likely to need iteration against real payloads. |
| 4. resumable processor and process route | `M` | 2, 3 | Similar to communications processing, but with stage orchestration and heartbeats. |
| 5. import-safe historical write paths | `L` | 2, 4 | Touches core workflow guards and side-effect suppression. |
| 6. customer and address import | `M` | 2, 3, 4, 5 | Matching rules are moderate complexity but well-bounded. |
| 7. vehicle import | `M` | 2, 3, 4, 5, 6 | Depends on customer import because ownership links must already exist. |
| 8. order to job import | `L` | 2, 3, 4, 5, 6, 7 | Core historical utility depends on stable customer and vehicle mapping. |
| 9. estimate and invoice import | `L` | 2, 3, 4, 5, 8 | Financial-state mapping is constrained by one-estimate and one-invoice-per-job rules. |
| 10. inspection and attachment import | `L` | 2, 3, 4, 5, 8 | Files and blobs add retry and storage variance. |
| 11. webhook delta sync and reconciliation | `L` | 1, 2, 3, 4, 6, 7, 8 | Do not start until the supported entity import paths are stable. |
| 12. settings UI, run controls, cutover UX | `M` | 1, 2, 3, 4 | Can start once connection, runs, and verification exist, then expand as later tickets land. |
| 13. observability, fixtures, tests, release docs | `M` | parallel across all phases | Should start early and finish last; not a true end-only ticket. |

## Critical path

The highest-confidence critical path is:

1. Ticket 1
2. Ticket 2
3. Ticket 3
4. Ticket 4
5. Ticket 5
6. Ticket 6
7. Ticket 7
8. Ticket 8
9. Ticket 9
10. Ticket 10
11. Ticket 11
12. Ticket 12
13. Ticket 13 completion and release hardening

Parallelization notes:

- Ticket 12 can start after Tickets 1 through 4, then deepen in each later phase.
- Ticket 13 should run in parallel from phase 1 onward.
- Ticket 9 and Ticket 10 can run in parallel after Ticket 8 if the team splits financial import and inspection or attachment import cleanly.
- Ticket 11 should stay off the critical path until the imported entity write paths are stable enough to trust in delta mode.

## Suggested phase boundaries

### Phase 1: Foundation and proof of connection

Tickets:

- Ticket 1
- Ticket 2
- Ticket 3
- Ticket 4
- Ticket 13 partial

Primary outcome:

- the company can save and verify a Shopmonkey account
- an import run can be created, claimed, resumed, and observed
- the system can fetch and normalize source data without touching core customer records yet

Rough effort:

- single engineer: 5 to 7 weeks
- two engineers after kickoff alignment: 3 to 4.5 weeks

Exit criteria:

- verified Shopmonkey connection works from the UI or an internal action
- resumable run and checkpoint records exist
- import processor can run a no-op or dry-run stage successfully
- fixture-backed normalization tests exist for at least customer, vehicle, and order payloads

### Phase 2: Core historical operational import

Tickets:

- Ticket 5
- Ticket 6
- Ticket 7
- Ticket 8
- Ticket 13 partial

Primary outcome:

- historical customers, addresses, vehicles, and jobs or visits import into the current internal system
- dedupe and conflict handling are usable
- imports no longer need manual SQL or ad hoc scripts for the core operational records

Rough effort:

- single engineer: 6 to 8 weeks
- two engineers: 3.5 to 5 weeks

Exit criteria:

- rerunning the same import does not duplicate customers, vehicles, or jobs
- conflicts are reviewable
- imported jobs appear correctly in current office history and queue surfaces
- imports do not enqueue customer communications or trip office automation side effects

### Phase 3: Financial and artifact completion

Tickets:

- Ticket 9
- Ticket 10
- Ticket 13 partial

Primary outcome:

- estimates, invoices, inspections, and attachments are available with acceptable historical fidelity
- the team has an explicit phase-1 decision on payment-history depth

Rough effort:

- single engineer: 4 to 6 weeks
- two engineers: 2.5 to 4 weeks

Exit criteria:

- imported estimate and invoice totals reconcile against source spot checks
- the team has signed off on the payment-history boundary
- imported inspections can be opened from the job or visit context
- attachment retries and backfills work without rerunning the entire import

### Phase 4: Cutover support and operator UX

Tickets:

- Ticket 11
- Ticket 12
- Ticket 13 completion

Primary outcome:

- admins can manage real migrations from the product
- delta sync covers the cutover window
- support and onboarding have a runbook instead of tribal knowledge

Rough effort:

- single engineer: 4 to 5.5 weeks
- two engineers: 2 to 3 weeks

Exit criteria:

- an owner or admin can connect, import, review conflicts, and complete cutover from the UI
- supported entities can reconcile source changes during the cutover window
- release checklist and support runbook exist for a first real customer migration

## Total program estimate

For a first production-capable version of Shopmonkey migration:

- single engineer, sequential delivery: roughly 19 to 26 weeks
- two engineers after phase-1 foundation: roughly 11 to 16.5 weeks

What moves the estimate most:

- whether Shopmonkey export payloads are clean enough for bulk history
- whether source estimate or invoice revision history needs more than the current one-per-job schema
- whether attachment and inspection artifacts are consistently retrievable
- whether detailed non-Stripe payment history becomes a hard requirement for phase 1

## Recommended first production slice

If you want the earliest version that is valuable enough to pilot with one real shop, ship:

- Ticket 1
- Ticket 2
- Ticket 3
- Ticket 4
- Ticket 5
- Ticket 6
- Ticket 7
- Ticket 8
- Ticket 12 minimum viable UI
- Ticket 13 minimum runbook and tests

That slice gives you:

- verified connection
- resumable import runs
- customer, vehicle, and visit history
- conflict review
- no dependence on finishing financial or attachment fidelity first

The fastest credible pilot path is to defer Ticket 11 and keep Ticket 9 and Ticket 10 to a narrower phase-2 pilot backlog unless a launch customer explicitly requires invoice history or inspection media on day one.
