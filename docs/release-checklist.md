# Release Checklist

Use this checklist before calling a milestone ready for release, handoff, or broader QA.

## Code and app health

- Run `pnpm typecheck`
- Run `pnpm test` if meaningful tests exist for the affected area
- Start the affected app surfaces and verify the primary workflows changed by the release
- Confirm no required environment variables are missing for the flows being exercised

## Database and schema

- Confirm new Supabase migrations apply cleanly in the intended order
- If schema changed, verify any dependent generated or shared types are current
- Review any RLS, triggers, guards, or storage-policy changes for expected tenant behavior
- If local demo or dev data depends on the schema change, update bootstrap scripts or seed assumptions

## Operational integrations

- Verify external-provider flows touched by the release, such as Stripe, Resend, Twilio, or internal processing routes
- Confirm service-role and secret-dependent paths fail clearly when config is incomplete
- Check any internal endpoints or scheduled-process expectations added by the release
- If company-owned SMS providers are in scope, verify provider-account storage and delivery-webhook reconciliation with the intended provider

## Go-Live gates

These are the hard gates for letting real users into the system, even for a controlled soft launch.

- Verify web office login works in the hosted target environment
- Verify technician mobile login works in the hosted target environment
- Run the current technician real-device workflow checklist in [mobile-field-device-validation.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/mobile-field-device-validation.md) on at least one iPhone and one Android phone for releases that materially change the field flow
- Verify private storage uploads work in the hosted target environment:
  - technician profile photo upload
  - job photo upload
  - estimate signature capture and storage
- Verify one complete hosted estimate flow end to end:
  - create job
  - create and send estimate
  - open public estimate link on a real phone
  - approve estimate with signature
- Verify one complete hosted invoice and payment flow end to end:
  - create and issue invoice
  - open public invoice link on a real phone
  - complete Stripe checkout in the correct mode for the environment
  - verify webhook reconciliation
  - verify invoice shows the correct final paid or partially paid state
- Verify communications in the hosted target environment if they are part of launch scope:
  - appointment confirmation
  - dispatch update
  - automated `en_route` or `running_late` SMS after the company enables automation
  - invoice or payment reminder
  - provider callback/webhook status update
  - internal communications processor route invoked by scheduler or cron
- Verify the exact production or staging config set is present and mode-matched:
  - `APP_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CUSTOMER_DOCUMENT_TOKEN_SECRET`
  - `SMS_PROVIDER_CREDENTIAL_SECRET` when company-owned SMS credentials are stored
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `COMMUNICATIONS_PROCESS_SECRET` when communications are expected to retry reliably
- Confirm the customer-SMS platform runbook is complete before inviting real shops to self-serve setup
- Confirm the week-one manual fallback path is owned and documented:
  - who sends manual customer updates if communications fail
  - who handles manual invoice or payment follow-up if Stripe or webhooks fail
  - who triages launch-day incidents
  - who decides whether rollout pauses

Do not go live if any item above is unverified or failing.

## Documentation and drift control

- Update `docs/work-log.md` with shipped scope and known follow-up
- Update `docs/environment.md` if env requirements changed
- Update `docs/architecture.md` if responsibilities or boundaries changed
- Add or update feature notes under `tooling/` if the release introduced a cross-cutting subsystem
- Add an ADR if the release included a meaningful architectural or policy decision
- Update `docs/customer-sms-platform-runbook.md` when SMS provider setup, automations, or deployment steps change

## Release notes and follow-up

- Capture any known limitations, rollout risks, or manual cleanup steps
- Record deferred work explicitly instead of leaving it implicit in code comments or chat history
- If there is no deployment runbook yet for the release shape, note the manual release sequence in the work log entry

## Soft-launch stop conditions

Pause rollout expansion immediately if any of these occur during the first real users:

- payment mismatch, duplicate-charge risk, or failed reconciliation
- technician cannot reliably see assigned jobs
- dispatch and technician mobile show conflicting assignment or schedule state
- public estimate or invoice links fail or show the wrong customer or job
- estimate approval or signature capture fails in real use
- wrong-company or wrong-customer data is exposed

These are not acceptable for a soft launch and should be fixed before continuing.
