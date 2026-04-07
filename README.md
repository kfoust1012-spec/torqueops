# Mobile Mechanic Software

Monorepo for a mobile mechanic platform with a Next.js office web app, an Expo mobile app, shared TypeScript packages, and a local Supabase stack.

## Workspace layout

- `apps/web`: office/admin web application
- `apps/mobile`: technician-facing mobile application
- `packages/api-client`: shared data-access layer and repository functions
- `packages/core`: shared business logic
- `packages/types`: shared domain and generated database types
- `packages/validation`: shared validation schemas
- `supabase`: SQL migrations and local Supabase configuration
- `tooling`: integration notes and developer scripts
- `docs`: living project documentation to reduce drift

## Core commands

- `pnpm dev`: run workspace dev processes through Turbo
- `pnpm build`: build all packages and apps
- `pnpm typecheck`: run TypeScript checks across the workspace
- `pnpm test`: run test tasks across the workspace
- `pnpm bootstrap:dev-users`: seed local development users
- `pnpm bootstrap:demo-data`: seed local demo data
- `pnpm test:e2e:verify-seed`: verify required e2e seed storage, service, communication, operator, and dispatch fixtures before browser tests
- `pnpm test:e2e:prepare`: rebuild local e2e seed state behind a local bootstrap lock so concurrent prepare/reset calls queue instead of colliding on Supabase reset
- `pnpm test:e2e:ci`: run the full local CI-style e2e path behind a local run lock, write bootstrap output to `.artifacts/e2e/e2e-ci-setup.log`, write the Playwright log to `.artifacts/e2e/e2e-ci.log`, fail on blocked setup regressions, and fail on blocked startup/auth log regressions
- `pnpm test:e2e:web:ci`: run the local CI-style web e2e path behind the same local run lock, write setup output to `.artifacts/e2e/web-e2e-ci-setup.log`, guard the setup log, and enforce the clean-log guard on `.artifacts/e2e/web-e2e-ci.log`
- `pnpm test:e2e:mobile:ci`: run the local CI-style mobile e2e path behind the same local run lock, write setup output to `.artifacts/e2e/mobile-e2e-ci-setup.log`, guard the setup log, and enforce the clean-log guard on `.artifacts/e2e/mobile-e2e-ci.log`
- Local lock waits now fail with owner diagnostics instead of waiting forever. Override the defaults with `MM_LOCAL_LOCK_TIMEOUT_MS`, `MM_E2E_BOOTSTRAP_LOCK_TIMEOUT_MS`, or `MM_E2E_RUN_LOCK_TIMEOUT_MS` when you need a longer wait window.
- Local e2e CI runs now fail before bootstrap if the required `E2E_WEB_BASE_URL` or `E2E_MOBILE_BASE_URL` port is already occupied, so stale Next or Expo servers are reported immediately instead of surfacing later as Playwright startup flake.
- Local e2e CI runs also verify that occupied local Supabase ports belong to the expected project stack. If they do not, the wrapper stops before bootstrap and tells you to clear the conflicting services or run `pnpm db:stop`.
- Local `test:e2e:prepare` now saves and restores a versioned DB+storage snapshot under `.artifacts/e2e/local-snapshot` when the migrations and seed inputs still match, using the named Docker volumes directly so restored runs skip the full reset-and-seed cycle without paying an extra `supabase start -> stop -> start` restart. If restore verification fails, the bad snapshot is discarded automatically and the harness rebuilds fresh state before saving a replacement. Set `MM_E2E_SNAPSHOT_DISABLED=1` to turn it off or `MM_E2E_SNAPSHOT_REBUILD=1` to force a fresh rebuild and snapshot refresh.
- Local `test:e2e:bootstrap` now records a verified prepared-state stamp in `.artifacts/e2e/prepared-state.json` and skips `test:e2e:prepare` on repeat local runs when the snapshot fingerprint, local env files, and mutation-sensitive DB fingerprint still match. Set `MM_E2E_PREPARED_STATE_DISABLED=1` to turn that skip path off.
- Local Playwright browser setup now caches the required Chromium install locations in `.artifacts/e2e/playwright-browser-install.json` and skips `playwright install chromium` entirely when the current Playwright version and browser paths are already present.
- Local bootstrap/setup runs now emit explicit outcome and timing summaries to the captured setup logs and machine-readable artifacts in `.artifacts/e2e/bootstrap-last-run.json`, `.artifacts/e2e/prepare-last-run.json`, and `.artifacts/e2e/playwright-browser-install-last-run.json`, so you can see whether a run hit `prepared_state_skip`, `snapshot_restore`, or `full_rebuild` without digging through raw command output.
- The setup-log guard now requires those bootstrap/prepare summary blocks and matching JSON summary artifacts, and it also fails on timing regressions like slow `prepared_state_skip`, slow snapshot restore/full rebuild paths, or unexpected Playwright browser installs during a prepared-state skip. Override the default timing budgets with `MM_E2E_PREPARED_STATE_SKIP_BUDGET_MS`, `MM_E2E_PREPARED_STATE_CHECK_BUDGET_MS`, `MM_E2E_SNAPSHOT_TOTAL_BUDGET_MS`, `MM_E2E_SNAPSHOT_RESTORE_BUDGET_MS`, `MM_E2E_FULL_REBUILD_BUDGET_MS`, `MM_E2E_FULL_PREPARE_BUDGET_MS`, `MM_E2E_BROWSER_SKIP_BUDGET_MS`, `MM_E2E_BROWSER_REFRESH_BUDGET_MS`, or `MM_E2E_BROWSER_INSTALL_BUDGET_MS` when you intentionally need a wider window.
- Local and CI-style target runs now also emit a per-target run summary in `.artifacts/e2e/<target>-e2e-ci-summary.json`, and CI publishes a Markdown timing table with baseline deltas into the GitHub job summary for `web` and `mobile`.
- PR timing summaries now prefer the latest successful `push` run on `main` for the same target as the baseline source, and fall back to the checked-in timing baseline only when no main-branch artifact is available yet.
- CI also downloads a short history of recent successful `main` timing artifacts into `.artifacts/e2e/main-history/<target>/...`, so the summary can show `vs last run` and `vs 7-run median` trend direction instead of only a one-point baseline delta.
- On pull requests, CI now enforces those timing deltas only when a latest successful `main` artifact exists for the same target. The checked-in fallback baseline remains reporting-only and does not block PRs by itself.
- The PR timing gate now uses the recent history window too: blocking timing phases must be regressing against both the latest successful `main` run and the 7-run median before the sustained gate fails, while immediate special-case regressions like a prepared-state browser install still fail on their own.
- Timing enforcement now uses severity tiers: `Total`, `Bootstrap`, `Playwright`, and prepared-state browser-install regressions are blocking, while noisier phases like `Preflight`, `Setup guard`, and `Startup/auth guard` are allowlisted into warning-only summary output unless you later promote them.
- Those warning/blocking thresholds are now target-specific and data-driven in `tooling/e2e-timing-rules.json`, so `web` and `mobile` can diverge without changing the renderer or enforcement scripts.
- CI now also emits `.artifacts/e2e/<target>-timing-decision.json` and matching GitHub annotations for the timing gate, the current warning set, and the per-phase trend classification so reviewers can inspect the sustained-trend decision without parsing the full Markdown summary.
- The workflow now drives that whole timing pipeline through one reusable GitHub action step in `.github/actions/report-e2e-timing`, so summary Markdown, annotations, decision JSON, and the optional enforced gate all come from the same runner instead of separate workflow steps.
- The CI workflow uploads the summary JSON files alongside the setup and Playwright logs for failed-run debugging.
- `pnpm db:start`: start local Supabase services
- `pnpm db:stop`: stop local Supabase services
- `pnpm db:reset`: reset the local database and reapply migrations behind the same local bootstrap lock used by the e2e prepare path
- `pnpm db:types`: regenerate local Supabase TypeScript types

## Documentation map

- `docs/architecture.md`: current system shape, boundaries, and drift-sensitive areas
- `docs/environment.md`: required and optional environment variables by app and subsystem
- `docs/vercel-deployment-runbook.md`: staging and production setup for `app.torqueops.io`, `staging.torqueops.io`, Vercel env vars, and cron wiring
- `docs/customer-sms-platform-runbook.md`: platform-owned setup checklist for bring-your-own SMS providers and background automations
- `docs/v2-operations-ia-and-wireframes.md`: future-state office product IA, role-based navigation, and workspace wireframes for the dispatch-led redesign
- `docs/v2-implementation-plan.md`: phased migration plan, milestones, dependencies, and exit criteria for implementing the v2 office product architecture
- `docs/v2-milestone-26-27-engineering-tickets.md`: build-ready engineering tickets for the shell reset and first visits workspace milestones
- `docs/release-checklist.md`: pre-release verification for schema, apps, docs, and operations
- `docs/mobile-field-device-validation.md`: real-device technician validation for the compressed stop, travel/call handoffs, inspection, evidence, billing, closeout, and dictation flow
- `docs/work-log.md`: chronological record of shipped milestones, open follow-up, and next decisions
- `docs/adr/0001-documentation-and-drift-control.md`: documentation contract for keeping the repo aligned as it changes
- `docs/adr/template.md`: ADR template for future architectural decisions
- `tooling/dispatch-board-integration.md`: dispatch board integration notes
- `tooling/customer-communication-layer-integration.md`: communication-layer integration notes

## Documentation discipline

Update the docs above whenever one of these changes lands:

- A new feature area or major route is introduced
- Database schema or RLS behavior changes
- Shared package boundaries or responsibilities change
- Operational setup or required environment variables change
- A milestone ships with important follow-up work still pending

Keep the docs lightweight and current. If a document stops being actively maintained, delete or replace it rather than letting it rot.

When a change is substantial enough to deserve a work-log entry or ADR, update that document in the same change rather than batching documentation later.
