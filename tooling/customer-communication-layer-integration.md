# Customer Communication Layer Integration

This milestone adds a durable customer communication backbone around estimates, invoices, reminders, appointments, and dispatch updates.

## Data model

- `customer_communication_preferences`: customer-level send preferences and channel defaults.
- `communication_events`: durable outbox events with idempotency keys.
- `customer_communications`: immutable communication log rows tied to customer and optional job/estimate/invoice/payment context.
- `communication_delivery_attempts`: delivery retry and provider-response audit trail.
- `invoices.due_at`: due-date anchor for payment reminder eligibility.

## Delivery flow

1. Office actions enqueue communication events and queued log rows through `@mobile-mechanic/api-client` communication repository functions.
2. Web server actions immediately try to process the queued message through `apps/web/lib/communications/processor.ts`.
3. The processor uses a service-role Supabase client so status and attempt updates do not depend on end-user RLS privileges.
4. Provider delivery is abstracted in `apps/web/lib/communications/providers.ts`.
5. The internal route `POST /api/internal/communications/process` exists for cron and batch processing.
6. That internal route now produces eligible customer SMS automations before processing queued deliveries.
7. Provider webhooks reconcile provider message IDs through:
   - `POST /api/webhooks/communications/resend`
   - `POST /api/webhooks/communications/twilio/[providerAccountId]`
   - `POST /api/webhooks/communications/telnyx/[providerAccountId]`

## Current office send surfaces

- Estimate detail: resend estimate notification.
- Estimate edit: auto-enqueue when moved to `sent`.
- Invoice detail: resend invoice notification and manual payment reminder.
- Invoice edit: auto-enqueue when moved to `issued`.
- Job detail: appointment confirmation, dispatched update, en-route update, plus job communication history.
- Dispatch board cards: appointment confirmation, dispatched update, en-route update.
- Customer detail: customer-wide communication history.
- Background automation: `en_route`, `running_late`, and invoice reminder SMS when company readiness and automation flags allow them.

## Environment variables

Required existing server env:

- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional communication env:

- `COMMUNICATIONS_PROCESS_SECRET`
- `COMMUNICATIONS_FROM_EMAIL`
- `COMMUNICATIONS_REPLY_TO_EMAIL`
- `COMMUNICATIONS_FROM_PHONE` for legacy Twilio fallback only
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID` for legacy Twilio fallback only
- `TWILIO_AUTH_TOKEN` for legacy Twilio fallback only
- `SMS_PROVIDER_CREDENTIAL_SECRET` for stored company-owned Twilio or Telnyx credentials

If provider env is missing, enqueue still succeeds and the processor records a failed delivery attempt with a visible error on the communication log.

## Operational notes

- Use `enqueue*` repository functions for all future office or customer-facing sends.
- Do not send directly from page actions or provider code; always create an event and queued log row first.
- Payment reminders require `invoice.status in ('issued', 'partially_paid')`, positive `balance_due_cents`, and non-null `due_at`.
- Explicit resends generate a fresh idempotency token. Workflow-triggered sends dedupe on stable business keys.
- Automated SMS workflows are gated by company readiness plus `communication_automation_settings`.

## Suggested next follow-ups

- Add customer preference editing in office UI if the team wants manual channel controls before portal work.
- Add inbound SMS handling if two-way customer conversations move into scope.
