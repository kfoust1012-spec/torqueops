# Customer SMS Platform Runbook

This runbook is the internal checklist for getting the platform side of customer SMS fully ready before onboarding real mechanic companies.

Use this with:

- [environment.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/environment.md)
- [release-checklist.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/release-checklist.md)
- [customer-sms-self-serve-onboarding-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-self-serve-onboarding-spec.md)

## Goal

Finish every platform-owned setup step so the only remaining work for a new mechanic company is:

- choose `Twilio` or `Telnyx`
- buy or assign a sender number
- complete provider compliance and carrier registration
- paste provider credentials into the app

## Platform-ready definition

The platform side is considered ready when all of these are true:

1. The required SMS schema migrations are applied.
2. Server secrets for stored provider credentials and background processing are configured.
3. The internal communications processor route is called by a real scheduler.
4. The office app shows the communications readiness and automation controls without runtime errors.
5. Automated `en_route`, `running_late`, and invoice reminder SMS can be produced once a shop connects a verified provider, completes the saved compliance profile, and delivers one provider test message.

## One-time platform setup

### 1. Apply database migrations

These migrations are already in the repo and must be present in every environment:

- `0098_sms_provider_accounts.sql`
- `0099_sms_provider_accounts_rls.sql`
- `0100_communication_automation_settings.sql`
- `0101_communication_automation_settings_rls.sql`
- `0108_communication_onboarding_profiles.sql`
- `0109_communication_onboarding_profiles_rls.sql`

Local development:

- run `pnpm db:reset`

Hosted environments:

- apply the migrations through the normal Supabase migration pipeline in numeric order

### 2. Configure server environment

Required for provider-account storage and background automation:

- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CUSTOMER_DOCUMENT_TOKEN_SECRET`
- `SMS_PROVIDER_CREDENTIAL_SECRET`
- `COMMUNICATIONS_PROCESS_SECRET`

Required if email is part of launch scope:

- `COMMUNICATIONS_FROM_EMAIL`
- `COMMUNICATIONS_REPLY_TO_EMAIL`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

Optional legacy fallback only:

- `COMMUNICATIONS_FROM_PHONE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Notes:

- `SMS_PROVIDER_CREDENTIAL_SECRET` encrypts company-owned `Twilio` and `Telnyx` credentials stored in the database.
- Global Twilio env credentials are no longer the primary model. They only support the existing legacy fallback path when a company-specific Twilio account is not connected yet.

### 3. Configure background processing

The internal route is:

- `POST /api/internal/communications/process`

Auth:

- `Authorization: Bearer ${COMMUNICATIONS_PROCESS_SECRET}`

This route now does both:

- produce eligible SMS automations
- process queued communication deliveries

Recommended scheduler cadence:

- every `5 minutes`

Example request body:

```json
{
  "limit": 10,
  "automationLimit": 10
}
```

Optional control:

- set `"skipAutomations": true` only if you need delivery retries without automation production during maintenance

### 4. Validate the platform build

Minimum verification:

- run `pnpm typecheck`
- run `pnpm test`
- open `Settings > Communications`
- confirm the page renders readiness, provider cards, and automation toggles
- confirm the communications onboarding flow renders the `provider`, `compliance`, `connect`, `test`, and `review` steps
- confirm the provider settings pages for `Twilio` and `Telnyx` render

### 5. Validate protected internal behavior

Check these expected conditions:

- the process route returns `401` with the wrong bearer token
- the process route returns `503` if `COMMUNICATIONS_PROCESS_SECRET` is missing
- companies without a connected default SMS provider do not produce live automations
- manual office sends still work even if automation flags are off

## What is already finished in code

Platform-owned functionality now in place:

- per-company SMS provider accounts
- `Twilio` adapter support
- `Telnyx` adapter support
- account-specific delivery webhooks
- saved company-level SMS compliance and onboarding profile
- dedicated in-app provider test-send flow with persisted callback state
- readiness gating in communications settings
- company-level automation activation flags
- live automation producer for:
  - `technician on the way`
  - `running late`
  - invoice payment reminders

## What still comes from each mechanic company

Do not block platform readiness on these. They are shop-owned inputs:

- provider selection
- provider account creation
- sender number purchase or assignment
- `A2P 10DLC` registration or toll-free verification
- provider credentials
- webhook key material for `Telnyx`
- complete the in-app delivery test to a real phone

## Known boundaries

Still not platform-complete:

- inbound SMS or reply handling
- customer conversation inbox
- live GPS ETA-based late detection
- automated provider compliance submission

These are follow-up features, not blockers for the core bring-your-own-provider launch shape.

## Handoff rule

Once this runbook is complete, onboarding a new mechanic company should require no code changes and no schema changes. It should be a settings and compliance workflow only.
