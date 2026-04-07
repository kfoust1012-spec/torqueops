# Customer-Facing Estimate / Invoice Flow Integration

This milestone adds customer-safe public document links for estimates and invoices without introducing a full portal account system.

## Data model

- `customer_document_links`: token-backed public access links for one estimate or one invoice.
- `customer_document_link_events`: audit trail for link lifecycle and customer interactions.
- `signatures.captured_by_user_id`: now nullable so public estimate approvals can use the existing signature workflow without a logged-in customer.

## Access strategy

- Public pages use signed tokens derived from the link id and `CUSTOMER_DOCUMENT_TOKEN_SECRET`.
- Only the token hash is stored in the database.
- Public resolution uses the server-side service-role client. No anonymous RLS access is granted to estimates, invoices, signatures, or payments.
- Office users retain RLS-based access to link rows and audit events.

## Public routes

- `GET /estimate/[token]`: customer-safe estimate review and approval page.
- `GET /invoice/[token]`: customer-safe invoice review and payment page.

## Office surfaces

- Estimate detail page shows active customer link status, copy-link, open-link, and resend-link actions.
- Invoice detail page shows active customer link status, copy-link, open-link, resend invoice link, and reminders that reuse the public invoice page.
- Sending an estimate or issuing an invoice now generates a public document link first, then queues the existing communication event with that public URL as `actionUrl`.

## Lifecycle tracking

- Link creation records `created`.
- Sending from office records `sent` and stores the last communication row id.
- Successful page loads record `viewed`, `first_viewed_at`, `last_viewed_at`, and increment `view_count`.
- Expired links are marked `expired` on resolution.
- Resend rotates the active link by revoking the previous one and creating a new one.
- Estimate approval and decline mark the link `completed`.
- Stripe payment success completes the invoice link via the existing webhook reconciliation route.

## Environment variables

Required for this milestone:

- `APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CUSTOMER_DOCUMENT_TOKEN_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional but commonly used with the communication layer:

- `COMMUNICATIONS_PROCESS_SECRET`
- `COMMUNICATIONS_FROM_EMAIL`
- `COMMUNICATIONS_REPLY_TO_EMAIL`
- `COMMUNICATIONS_FROM_PHONE`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

## Notes

- Customer notifications should use the public document URL as `actionUrl` instead of dashboard paths.
- Public invoice pages still use the existing Stripe checkout + payment reconciliation infrastructure.
- No customer portal history, account creation, or shared customer dashboard is included in this phase.