# Environment Reference

This document is the operational source of truth for application configuration. Keep it aligned with `apps/web/.env.example`, `apps/mobile/.env.example`, and any server-side env validation code.

## Local setup model

- The root `.env.example` is a convenience reference for local development
- Web variables live in `apps/web/.env.local`
- Mobile variables live in `apps/mobile/.env.local`
- Public Supabase values are duplicated because web and Expo use different environment variable prefixes

## Shared local Supabase values

### Web client

- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase URL for browser and server-session clients
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key for web auth and data access constrained by RLS

### Mobile client

- `EXPO_PUBLIC_SUPABASE_URL`: public Supabase URL for Expo client usage
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: public anon key for mobile auth and data access constrained by RLS

## Required web server variables

These are required by `apps/web/lib/server-env.ts` and can break server startup or route execution when absent.

- `APP_URL`: canonical absolute base URL used for deep links, payment return URLs, webhook callback URLs, and dispatch/job links. Use the public host for the current environment and keep it distinct between staging and production.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role key for privileged server-side processing such as durable communication processing
- `CUSTOMER_DOCUMENT_TOKEN_SECRET`: signing secret for public estimate, invoice, and visit document links. Use a different value in staging and production.
- `PROCUREMENT_PROVIDER_CREDENTIAL_SECRET`: server-only encryption secret for stored procurement provider credentials such as PartsTech. Use a different value in staging and production.
- `SMS_PROVIDER_CREDENTIAL_SECRET`: server-only encryption secret for stored company-owned SMS provider credentials such as Twilio or Telnyx. Use a different value in staging and production.
- `STRIPE_SECRET_KEY`: Stripe server SDK key for checkout and payment flows. Staging must use a Stripe test key; production must use a live key.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret for the webhook endpoint. It must come from the same Stripe mode as `STRIPE_SECRET_KEY` for that environment.

## Optional communications variables

These are optional at process startup but required for the related delivery channels to succeed.

- `COMMUNICATIONS_PROCESS_SECRET`: bearer token protecting `POST /api/internal/communications/process`
- `IMPORTS_PROCESS_SECRET`: bearer token protecting `POST /api/internal/imports/process`
- `CRON_SECRET`: optional shared secret used by Vercel Cron to authorize `GET /api/cron/communications` and `GET /api/cron/imports`
- `COMMUNICATIONS_FROM_EMAIL`: sender address for email delivery
- `COMMUNICATIONS_REPLY_TO_EMAIL`: optional reply-to address for email delivery
- `COMMUNICATIONS_FROM_PHONE`: legacy fallback sending phone number for global Twilio delivery when a company has not connected its own provider account yet
- `RESEND_API_KEY`: email provider credential
- `RESEND_WEBHOOK_SECRET`: signing secret for the Resend delivery webhook endpoint
- `TWILIO_ACCOUNT_SID`: legacy fallback Twilio account identifier
- `TWILIO_AUTH_TOKEN`: legacy fallback Twilio auth token

## Optional vehicle enrichment variables

These stay optional, but both values must be configured together when Carfax integration is enabled.

- `CARFAX_API_KEY`: provider credential for vehicle history lookups
- `CARFAX_API_BASE_URL`: absolute provider base URL for Carfax requests

If the provider variables are missing, communication enqueue still works but delivery attempts record failures instead of silently succeeding.

For customer SMS specifically:

- the preferred production model is company-owned provider credentials stored in `sms_provider_accounts`
- `SMS_PROVIDER_CREDENTIAL_SECRET` is required for that model
- global Twilio env credentials remain only as a legacy fallback path for companies that have not connected their own Twilio account yet
- Telnyx does not use global env credentials in the current architecture

## Deployment notes

- `APP_URL` should be the canonical public host for the deployed web app. Do not rely on request-derived origins for customer links, Stripe returns, or Twilio callbacks.
- Stripe staging must use test mode end to end: test `STRIPE_SECRET_KEY`, test `STRIPE_WEBHOOK_SECRET`, and a staging `APP_URL`. Production must use the live equivalents as one matched set.
- The internal communications processor route `POST /api/internal/communications/process` is protected by `COMMUNICATIONS_PROCESS_SECRET` and should be called by a scheduler or cron in any environment that expects durable delivery retries or SMS automations.
- The internal imports processor route `POST /api/internal/imports/process` is protected by `IMPORTS_PROCESS_SECRET` and should be called by a scheduler or cron in any environment that expects queued import retries or webhook-triggered data sync.
- The Vercel-native cron routes `GET /api/cron/communications` and `GET /api/cron/imports` require `CRON_SECRET`. If you deploy on Vercel and enable cron jobs, set `CRON_SECRET` in the project before enabling those schedules.
- That route now does two jobs: it produces eligible customer SMS automations and processes queued communication deliveries.
- Staging and production should use separate Supabase projects, separate Stripe webhook secrets, and separate customer document token secrets.
- Expo mobile builds should only receive the public Supabase values for the environment they target.

## Launch-critical verification

Before letting real users into an environment, verify these conditions explicitly:

- `APP_URL` matches the real public host and protocol for that environment
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` come from the same Stripe mode for that environment
- `CUSTOMER_DOCUMENT_TOKEN_SECRET` is unique to that environment
- `PROCUREMENT_PROVIDER_CREDENTIAL_SECRET` is present, server-only, and unique to that environment
- `SMS_PROVIDER_CREDENTIAL_SECRET` is present, server-only, and unique to that environment
- `SUPABASE_SERVICE_ROLE_KEY` is present and server-only
- if using Vercel Cron, `CRON_SECRET` is present and server-only
- If customer communications are in launch scope, these are all non-empty and correct:
  - `COMMUNICATIONS_PROCESS_SECRET`
  - `COMMUNICATIONS_FROM_EMAIL`
  - `RESEND_API_KEY` for email
  - `RESEND_WEBHOOK_SECRET` for email delivery callbacks
  - if using legacy fallback SMS only: `COMMUNICATIONS_FROM_PHONE`, `TWILIO_ACCOUNT_SID`, and `TWILIO_AUTH_TOKEN`

Real launch should also verify the environment, not just the variables:

- private storage uploads succeed for signatures and attachments
- Stripe webhook callbacks reach the deployed app
- communications webhook callbacks reach the deployed app
- the internal communications processor route is called by a real scheduler or cron
- if customer SMS is in scope, at least one company can connect a provider account, verify it, deliver a test SMS, and then enable live automations

## Source locations in code

- `apps/web/lib/env.ts`: parses web public env
- `apps/mobile/src/env.ts`: parses mobile public env
- `apps/web/lib/server-env.ts`: parses required and optional server-only env, including customer document, provider credential, and Carfax config
- `apps/web/lib/communications/providers.ts`: enforces provider-specific delivery requirements
- `apps/web/lib/communications/automation.ts`: produces scheduled customer SMS automations during background processing

## Drift checks

Update this document when any of these happen:

- A new environment variable is introduced
- A variable changes from optional to required or the reverse
- A variable changes app ownership between web, mobile, or shared setup
- A new external provider is added

When changing env requirements, update these together:

- This document
- `apps/web/.env.example` and or `apps/mobile/.env.example`
- Any parsing or validation layer
- Any setup or integration notes that mention the affected subsystem
