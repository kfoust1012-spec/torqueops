# Vercel Deployment Runbook

This runbook is the practical setup for hosting TorqueOps on Vercel with:

- `app.torqueops.io` for production
- `staging.torqueops.io` for vendor testing and pre-production validation
- optional `www.torqueops.io` for a marketing or landing site later

## Recommended topology

Use two separate Vercel projects that both point at the same repo:

1. `torqueops-web-prod`
   - branch: `main`
   - root directory: `apps/web`
   - custom domain: `app.torqueops.io`
2. `torqueops-web-staging`
   - branch: `main` or a dedicated `staging` branch
   - root directory: `apps/web`
   - custom domain: `staging.torqueops.io`

Two projects are cleaner than one when you need:

- different `APP_URL` values
- different Supabase projects
- different Stripe modes and webhook secrets
- a staging environment you can safely hand to vendors such as O'Reilly

## Vercel project settings

For both projects:

- Framework preset: `Next.js`
- Root Directory: `apps/web`
- Enable `Include source files outside of the Root Directory`
- Install Command: leave default or set `pnpm install --frozen-lockfile`
- Build Command: leave default or set `pnpm build`
- Output Directory: leave default for Next.js

This repo already carries a project-local [vercel.json](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/vercel.json) under `apps/web`, so when Vercel uses `apps/web` as the project root it will pick up the cron configuration automatically.

## Domain plan

### Production

- `app.torqueops.io`
  - primary product host
  - set `APP_URL=https://app.torqueops.io`

### Staging

- `staging.torqueops.io`
  - vendor-accessible test environment
  - set `APP_URL=https://staging.torqueops.io`

### Optional landing site

- `www.torqueops.io`
  - keep this separate from the app if you want marketing pages later

If the domain is already registered through Vercel, adding these domains to the Vercel projects is usually enough. Vercel-managed DNS can attach the correct records directly from the project domain UI.

## Environment variables

Use different values for staging and production anywhere secrets or third-party systems are involved.

### Required in both projects

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CUSTOMER_DOCUMENT_TOKEN_SECRET`
- `PROCUREMENT_PROVIDER_CREDENTIAL_SECRET`
- `MIGRATION_SOURCE_CREDENTIAL_SECRET`
- `SMS_PROVIDER_CREDENTIAL_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Recommended for background processing

- `COMMUNICATIONS_PROCESS_SECRET`
- `IMPORTS_PROCESS_SECRET`
- `CRON_SECRET`

### Optional, depending on launch scope

- `COMMUNICATIONS_FROM_EMAIL`
- `COMMUNICATIONS_REPLY_TO_EMAIL`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `COMMUNICATIONS_FROM_PHONE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `CARFAX_API_KEY`
- `CARFAX_API_BASE_URL`
- `NEXT_PUBLIC_TOMTOM_API_KEY`
- `TOMTOM_API_KEY`

## Environment mapping

### Production project

- `APP_URL=https://app.torqueops.io`
- Supabase: production project values
- Stripe: live mode values
- customer document / provider / SMS encryption secrets: production-only values

### Staging project

- `APP_URL=https://staging.torqueops.io`
- Supabase: staging project values
- Stripe: test mode values
- customer document / provider / SMS encryption secrets: staging-only values

Do not reuse production signing or encryption secrets in staging.

## Mobile alignment

The mobile app should target the correct web host for the environment it talks to:

- staging mobile builds: `EXPO_PUBLIC_WEB_APP_URL=https://staging.torqueops.io`
- production mobile builds: `EXPO_PUBLIC_WEB_APP_URL=https://app.torqueops.io`

That is required for mobile billing, approval, attachment, and procurement handoff flows to resolve back to the right web surface.

## Vercel Cron

This repo now includes two Vercel cron routes:

- `GET /api/cron/communications`
- `GET /api/cron/imports`

They are protected by `CRON_SECRET`, which Vercel sends back as the `Authorization: Bearer ...` header when cron runs.

The schedule is defined in [apps/web/vercel.json](C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/vercel.json):

- communications: `0 13 * * *`
- imports: `15 13 * * *`

These daily schedules are intentionally conservative and easy to support on a basic Vercel plan. If you later move to a plan that supports more frequent cron execution, update `apps/web/vercel.json` and redeploy.

## Vendor-ready staging checklist

Before telling O'Reilly or another integration partner that staging is ready:

1. `https://staging.torqueops.io/login` loads successfully
2. office login works with a vendor-safe test account
3. estimate and invoice public links resolve against staging `APP_URL`
4. Stripe staging callbacks return to the staging domain
5. file uploads work for signatures and attachments
6. cron routes return `401` without auth and `200` when invoked with the real `CRON_SECRET`
7. mobile builds targeting staging can reach `staging.torqueops.io`

## First deployment sequence

1. Import the repo into Vercel twice, once for staging and once for production
2. Set `apps/web` as the root directory in both projects
3. Add all required environment variables to staging first
4. Attach `staging.torqueops.io`
5. Deploy staging and validate the checklist above
6. Add production variables
7. Attach `app.torqueops.io`
8. Deploy production after staging is stable

## Practical recommendation

The fastest credible setup for the O'Reilly conversation is:

- create the staging Vercel project first
- get `staging.torqueops.io` live
- verify login, estimates, invoices, and cron routes
- then tell vendors you have a real pre-production environment available
