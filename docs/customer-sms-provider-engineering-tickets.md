# Customer SMS Provider Engineering Tickets

This document turns provider-agnostic customer SMS support into concrete engineering tickets.

Companion docs:

- [customer-communication-layer-integration.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/tooling/customer-communication-layer-integration.md)
- [customer-sms-self-serve-onboarding-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-self-serve-onboarding-spec.md)
- [v2-implementation-plan.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-implementation-plan.md)
- [v2-milestone-26-27-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-milestone-26-27-engineering-tickets.md)

These tickets are intentionally scoped around the current codebase.

They are written to extend the existing durable communications layer instead of creating a second messaging system.

## Scope of this ticket pack

Included:

- bring-your-own SMS provider accounts per company
- first-party support for `Twilio`
- first-party support for `Telnyx`
- company-level default SMS provider selection
- provider-specific webhook verification and delivery reconciliation
- company-aware provider resolution for queued communications and future automations
- testing, demo data, and release documentation updates

Not included yet:

- `Google Voice` automation support
- two-way customer conversation inbox
- automated A2P 10DLC brand and campaign registration
- automated toll-free verification workflows
- WhatsApp, RCS, or chat-app channels
- support for every CPaaS vendor on day one

## Provider support boundaries

First-party supported in this pack:

- `Twilio`
- `Telnyx`

Explicitly not supported for automation:

- `Google Voice`

Notes:

- `Google Voice` is excluded because Google Voice messaging is intended for interactive conversations and its policy forbids automated or scripted messaging.
- `Shopmonkey` is not a transport provider to integrate into this codebase. It is a product with its own messaging stack.
- Additional providers such as `Vonage` or `Plivo` should only be added after at least one real customer needs them.

## Working assumptions

1. Existing `communication_events`, `customer_communications`, and `communication_delivery_attempts` remain the source of truth.
2. Email stays on `Resend` in this phase. This ticket pack is about SMS transport only.
3. Shops connect their own provider account, sender number, and carrier registration.
4. Provider choice is company-level first. Per-customer or per-message provider overrides can wait.
5. Existing queued communication and retry semantics stay intact.
6. Existing Twilio-only installations need a migration path that does not break production sends.
7. Future automatic late / en-route / invoice reminder workflows should reuse this provider layer instead of bypassing it.

## Recommended delivery order

1. data model and repository support
2. provider registry and resolver
3. Twilio migration into the new adapter model
4. communications settings UI
5. Telnyx adapter and webhook support
6. automation and release hardening
7. self-serve onboarding and automation readiness UX

## Ticket 1: Add company SMS provider account model

### Goal

Create a multi-tenant account model for connectable SMS providers.

### User outcome

Each mechanic company can connect its own SMS provider account and sender number instead of sharing one global platform credential.

### Current implementation surface

- `supabase/migrations/0041_customer_communications.sql`
- `packages/types/src/communication.ts`
- `packages/validation/src/communication.ts`
- `packages/api-client/src/repositories/communications.ts`
- procurement provider precedent:
  - `supabase/migrations/0079_procurement_provider_core.sql`
  - `apps/web/lib/procurement/providers/credentials.ts`

### Required changes

- Add `sms_provider` enum with:
  - `twilio`
  - `telnyx`
- Add `sms_provider_account_status` enum with:
  - `connected`
  - `action_required`
  - `error`
  - `disconnected`
- Add `sms_provider_accounts` table with:
  - `id`
  - `company_id`
  - `provider`
  - `status`
  - `display_name`
  - `from_number`
  - `is_default`
  - `credential_ciphertext`
  - `credential_hint`
  - `settings_json`
  - `capabilities_json`
  - `webhook_path_token`
  - `last_verified_at`
  - `last_error_message`
  - `created_at`
  - `updated_at`
- Add uniqueness and safety constraints:
  - one row per `company_id + provider`
  - at most one default SMS provider per company
  - `from_number` required in E.164 format
- Add RLS policies and updated-at trigger matching current multi-tenant patterns.
- Add communication types, validation schemas, and repository helpers for:
  - create or update provider account
  - list provider accounts by company
  - fetch default provider account by company
  - mark account verified
  - disconnect account
- Add a new credential helper for SMS provider secrets using encrypted JSON and a dedicated server secret such as `SMS_PROVIDER_CREDENTIAL_SECRET`.

### Recommended implementation

- Mirror the `procurement_provider_accounts` shape closely so the product has one recognizable integration pattern.
- Store provider credentials as encrypted JSON instead of provider-specific columns so adding a third provider does not require a schema rewrite.
- Use `webhook_path_token` or provider-account-specific routes from the start so webhook verification is unambiguous in a multi-company deployment.

### Acceptance criteria

- A company can save `Twilio` and `Telnyx` accounts independently.
- One account can be marked as the default SMS provider for the company.
- Credentials are never stored in plaintext.
- Office-only users can manage their company account records without crossing tenant boundaries.

## Ticket 2: Add SMS provider adapter contract and company-aware resolver

### Goal

Separate message workflows from SMS transport so providers become pluggable.

### User outcome

Customer SMS flows keep working even when different shops use different providers.

### Current implementation surface

- `apps/web/lib/communications/providers.ts`
- `apps/web/lib/communications/processor.ts`
- `apps/web/lib/communications/delivery-webhooks.ts`
- `apps/web/lib/communications/follow-up.ts`
- `packages/api-client/src/repositories/communications.ts`
- procurement provider precedent:
  - `apps/web/lib/procurement/providers/registry.ts`
  - `apps/web/lib/procurement/providers/types.ts`

### Required changes

- Create `apps/web/lib/communications/sms-providers/types.ts` with an `SmsProviderAdapter` contract.
- Create `apps/web/lib/communications/sms-providers/registry.ts`.
- Create `apps/web/lib/communications/sms-providers/resolver.ts`.
- Split email and SMS transport so:
  - email keeps using the existing `Resend` path
  - SMS goes through the provider registry
- Replace hard-coded Twilio defaults in:
  - `packages/api-client/src/repositories/communications.ts`
  - `apps/web/lib/communications/follow-up.ts`
- Add a company-aware provider lookup so queued SMS rows store the chosen provider name at enqueue time.
- Add account-specific callback URL building so outbound sends can point to:
  - `/api/webhooks/communications/twilio/[providerAccountId]`
  - `/api/webhooks/communications/telnyx/[providerAccountId]`
- Generalize delivery webhook input typing so it is no longer limited to `resend | twilio`.

### Recommended implementation

- Keep `customer_communications.provider` as the durable provider identifier on each queued row.
- Resolve the provider at enqueue time, not only at send time, so the audit trail shows which provider the system intended to use.
- Do not push provider credential logic into `packages/api-client`; keep credentials and adapter execution in the web app server layer.

### Acceptance criteria

- SMS sends are no longer hard-coded to `twilio`.
- The same appointment, dispatch, and invoice reminder workflows can enqueue SMS for either supported provider.
- The processor can route a queued SMS communication to the correct adapter based on `customer_communications.provider`.

## Ticket 3: Refactor Twilio into the first provider adapter and preserve migration safety

### Goal

Move the current Twilio integration onto the new provider-account architecture without breaking existing customers.

### User outcome

Shops already using Twilio continue sending messages while the platform moves from global environment variables to per-company accounts.

### Current implementation surface

- `apps/web/lib/communications/providers.ts`
- `apps/web/lib/communications/delivery-webhooks.ts`
- `apps/web/app/api/webhooks/communications/twilio/route.ts`
- `tooling/customer-communication-layer-integration.md`

### Required changes

- Move Twilio SMS send logic into `apps/web/lib/communications/sms-providers/twilio/adapter.ts`.
- Move Twilio webhook mapping into a provider-specific module under the same folder.
- Change the Twilio status callback URL to use the connected provider account route.
- Verify Twilio webhooks against the stored account secret instead of a single global auth token.
- Add a Twilio account verification action that confirms:
  - account credentials are valid
  - sender number is present
  - callback URL is the expected one
- Add a migration path for existing installs:
  - one-time bootstrap from current env vars into a company provider account, or
  - temporary env fallback for one release with a clear removal plan
- Update `tooling/customer-communication-layer-integration.md` so Twilio is documented as a provider account, not only as server env.

### Recommended implementation

- Treat current env-based Twilio values as migration input, not the long-term architecture.
- Prefer a one-time admin bootstrap over indefinite env fallback.
- Keep existing Twilio delivery status semantics when mapping to `sent`, `delivered`, and `failed`.

### Acceptance criteria

- A company with a connected Twilio account can send SMS without using global Twilio env vars.
- Twilio delivery callbacks still reconcile `provider_message_id` correctly.
- Existing hosted environments can migrate without losing delivery visibility.

## Ticket 4: Add communications settings UI for provider connections and default selection

### Goal

Give office admins a supported place to connect, verify, and switch SMS providers.

### User outcome

A shop can open Settings, connect `Twilio` or `Telnyx`, choose a default sender, and see whether messaging is ready.

### Current implementation surface

- `apps/web/app/dashboard/settings/page.tsx`
- procurement integration precedent:
  - `apps/web/app/dashboard/parts/integrations/page.tsx`
  - `apps/web/app/dashboard/parts/integrations/partstech/page.tsx`
  - `apps/web/app/dashboard/parts/integrations/repairlink/page.tsx`

### Required changes

- Add a communications settings entry point from `Settings`.
- Add a communications integrations index page, for example:
  - `/dashboard/settings/communications`
- Add provider detail pages, for example:
  - `/dashboard/settings/communications/twilio`
  - `/dashboard/settings/communications/telnyx`
- Support these office actions:
  - save credentials
  - save sender number
  - copy the expected webhook URL
  - verify connection
  - set as default provider
  - disconnect provider
- Show status and operational context:
  - connected
  - action required
  - last verified at
  - last error message
  - current default provider
- Add product guidance in the UI:
  - SMS automation requires a supported provider
  - `Google Voice` is not supported for automated sends
  - US messaging compliance remains the shop's responsibility

### Recommended implementation

- Mirror the parts integration UX so provider setup feels familiar.
- Keep setup shallow: account, sender number, verify, default selection.
- Do not attempt a full carrier-compliance wizard in this first pass.

### Acceptance criteria

- A company admin can connect and verify a Twilio account from the UI.
- A company admin can connect and verify a Telnyx account from the UI.
- The settings hub exposes communications configuration as a first-class operational setup area.

## Ticket 5: Add Telnyx as the second supported SMS adapter

### Goal

Prove the provider abstraction by supporting a second real SMS vendor.

### User outcome

Shops that do not want Twilio can connect Telnyx and still use the same automated customer texting workflows.

### Current implementation surface

- new SMS provider registry from Ticket 2
- new provider account model from Ticket 1
- no current Telnyx communication integration exists

### Required changes

- Add `apps/web/lib/communications/sms-providers/telnyx/adapter.ts`.
- Add Telnyx delivery webhook mapping and verification.
- Add Telnyx route:
  - `/api/webhooks/communications/telnyx/[providerAccountId]`
- Support outbound send requirements:
  - API key credential
  - sender number or messaging profile linkage from account settings
  - provider message ID capture
- Support inbound webhook verification using the account-specific signing configuration.
- Map Telnyx delivery states into the existing generic communication lifecycle:
  - `sent`
  - `delivered`
  - `failed`
- Surface Telnyx verification results and operational errors in the same settings UI as Twilio.

### Recommended implementation

- Start with SMS send plus delivery callbacks only.
- Require the user to paste whatever Telnyx signing or profile identifiers are needed during setup rather than trying to provision them automatically.
- Keep metadata provider-specific in `provider_metadata`, but normalize final communication status the same way as Twilio.

### Acceptance criteria

- A company with a connected Telnyx account can send SMS through the same communication queue.
- Telnyx delivery callbacks update communication status correctly.
- Switching the company default from Twilio to Telnyx does not require any workflow-level code changes.

## Ticket 6: Make processing, follow-up workflows, and future automations provider-aware

### Goal

Ensure the transport abstraction is honored everywhere SMS can be sent.

### User outcome

Manual sends and future automatic sends behave consistently regardless of which supported SMS provider the shop has chosen.

### Current implementation surface

- `apps/web/lib/communications/processor.ts`
- `apps/web/lib/communications/follow-up.ts`
- `packages/api-client/src/repositories/communications.ts`
- planned future automation surfaces for late, en-route, and invoice reminder texts

### Required changes

- Update queued send processing so it resolves the provider adapter from the communication row.
- Improve error handling so provider failures mention the provider account and configuration issue clearly.
- Update follow-up and manual office send helpers so SMS provider selection is company-aware.
- Define missing-provider behavior:
  - explicit SMS requests should fail with a clear configuration error if no supported provider is connected
  - do not silently convert an explicit SMS request into email
- Ensure future automatic workflows reuse this same resolution path and do not hard-code `twilio`.
- Confirm retry and reconciliation logic remains provider-agnostic.

### Recommended implementation

- Enforce provider selection before a queued SMS row is created when the request explicitly asks for SMS.
- Keep provider resolution deterministic and visible in the communication log.
- Reuse the same queue, retry, and delivery-attempt tables; only the transport edge should change.

### Acceptance criteria

- Manual SMS sends fail fast and clearly when the company has no configured SMS provider.
- Manual SMS sends succeed through the company default provider when one is configured.
- Future automation code has one supported path for resolving SMS transport.

## Ticket 7: Add tests, demo fixtures, migration notes, and release checks

### Goal

Ship provider-agnostic SMS support with enough verification and operational guidance that it is supportable.

### User outcome

The team can release the feature without guessing about migration, webhook health, or provider-specific failures.

### Current implementation surface

- `apps/web/lib/communications/delivery-webhooks.test.ts`
- `tooling/scripts/bootstrap-demo-data.mjs`
- `docs/release-checklist.md`
- `tooling/customer-communication-layer-integration.md`

### Required changes

- Add unit tests for:
  - provider account resolution
  - default provider selection
  - Twilio send and webhook mapping
  - Telnyx send and webhook mapping
  - missing-provider failure cases
- Add integration coverage for queued communication processing across both supported SMS providers.
- Add demo data for at least:
  - one company using Twilio
  - one company using Telnyx
  - communication history rows proving provider-specific delivery metadata
- Update operational docs:
  - setup instructions
  - migration notes from env-based Twilio
  - release checklist verification steps
  - known unsupported providers
- Add a short runbook for support and QA covering:
  - provider connection test
  - webhook test
  - failed delivery trace
  - default-provider switch test

### Recommended implementation

- Treat documentation and test fixtures as part of the feature, not follow-up cleanup.
- Add at least one end-to-end QA path that verifies queue -> provider -> callback -> delivered status.

### Acceptance criteria

- Both supported providers are covered by automated tests.
- QA can follow a written checklist to validate a provider connection before release.
- The release process includes explicit verification for provider callbacks and retry behavior.

## Ticket 8: Add self-serve provider onboarding, readiness checklist, and live-activation gates

### Goal

Turn provider setup into a guided SaaS onboarding flow instead of a raw settings screen.

### User outcome

A new mechanic company can choose a supported provider, prepare compliance inputs, connect credentials, run a test message, and only then enable live customer SMS automations.

### Current implementation surface

- `apps/web/app/dashboard/settings/communications/page.tsx`
- `apps/web/app/dashboard/settings/communications/twilio/page.tsx`
- `apps/web/app/dashboard/settings/communications/telnyx/page.tsx`
- [customer-sms-self-serve-onboarding-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-self-serve-onboarding-spec.md)

### Required changes

- Add a communications onboarding entry flow, for example:
  - `/dashboard/settings/communications/onboarding`
- Add a checklist model that tracks or derives:
  - provider selected
  - business identity saved
  - opt-in flow saved
  - sample messages approved
  - provider connected
  - webhook verified
  - test text delivered
  - automations enabled
- Add provider-specific guidance for:
  - Twilio account + number + `A2P 10DLC` or toll-free verification
  - Telnyx account + API key + messaging profile + `10DLC`
- Add a `send test text` action and persist the latest result in a supportable way.
- Add gating rules so live SMS automations cannot be enabled until readiness checks pass.
- Add overview cards and a fix-forward checklist to the communications hub.

### Recommended implementation

- Derive as much checklist state as possible from real provider records and communication logs before adding a new table.
- Keep the first pass office-admin oriented and operationally blunt.
- Prefer one guided sequence over multiple disconnected utility pages.

### Acceptance criteria

- A first-time company admin can reach a guided onboarding path from communications settings.
- The app shows exactly what is incomplete before live SMS can be enabled.
- Automated customer SMS cannot be turned on before a successful test delivery and verified provider connection.

## Suggested phase boundaries

Phase 1:

- Ticket 1
- Ticket 2
- Ticket 3

Phase 2:

- Ticket 4
- Ticket 5

Phase 3:

- Ticket 6
- Ticket 7
- Ticket 8

## Official references

- Twilio Message status callbacks: https://www.twilio.com/docs/messaging/api/message-resource
- Twilio A2P 10DLC compliance: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Telnyx webhook verification: https://developers.telnyx.com/development/api-fundamentals/webhooks/receiving-webhooks
- Telnyx 10DLC quickstart: https://developers.telnyx.com/docs/messaging/10dlc/quickstart
- Google Voice texting help: https://support.google.com/voice/answer/115116?hl=en
- Google Voice acceptable use policy: https://support.google.com/voice/answer/9230450?hl=en
