# Launch Command Center

Use this document as the working launch runbook for staging, soft launch, and the first live week.

## 1. Launch Checklist

### Product readiness

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Latest migrations are applied in the launch environment
- [ ] Core office web flows verified:
  - [ ] login
  - [ ] customer creation
  - [ ] vehicle creation
  - [ ] job creation
  - [ ] dispatch assignment
  - [ ] estimate send
  - [ ] invoice issue
- [ ] Core technician mobile flows verified:
  - [ ] login
  - [ ] assigned jobs visible
  - [ ] job detail usable
  - [ ] inspection save
  - [ ] photos upload
- [ ] Core customer flows verified:
  - [ ] estimate link opens
  - [ ] estimate approval works
  - [ ] invoice link opens
  - [ ] Stripe checkout completes
  - [ ] payment return state is correct

### Operational readiness

- [ ] At least one owner/admin account exists
- [ ] At least one dispatcher account exists
- [ ] At least one technician account exists
- [ ] Demo/QA data seeded where needed
- [ ] Support owner assigned for launch week
- [ ] Manual fallback process agreed for:
  - [ ] customer comms
  - [ ] estimate approval follow-up
  - [ ] invoice/payment follow-up

## 2. Launch Blockers

Do not go live if any of these are failing.

- Payment reconciliation mismatch
- Duplicate-payment risk
- Broken Stripe webhook processing
- Broken public estimate or invoice links
- Broken estimate approval or signature capture
- Office login/session instability
- Technician login/session instability
- Dispatch and technician mobile assignment mismatch
- Wrong-company or wrong-customer data exposure
- Core workflow cannot complete:
  - intake -> dispatch -> inspection -> estimate -> invoice -> payment

## 3. Deployment Checklist

### Environment setup

- [ ] Staging and production use separate Supabase projects
- [ ] Staging and production use separate Stripe webhook secrets
- [ ] Staging and production use separate `CUSTOMER_DOCUMENT_TOKEN_SECRET` values
- [ ] `APP_URL` is correct for the deployed environment and has no trailing slash
- [ ] Server-only secrets are not exposed to mobile or `NEXT_PUBLIC_*`

### Web app

- [ ] Deploy Next.js web app
- [ ] Confirm login page loads
- [ ] Confirm office dashboard loads after login
- [ ] Confirm public estimate/invoice links resolve correctly from `APP_URL`

### Mobile app

- [ ] Expo/mobile build uses the correct public Supabase env
- [ ] Technician login works in the target environment
- [ ] Assigned jobs load in the mobile app

### Database

- [ ] All migrations applied successfully
- [ ] Company, profiles, memberships, and storage buckets verified

## 4. Webhook and Payment Verification Checklist

### Stripe

- [ ] `STRIPE_SECRET_KEY` matches the correct Stripe mode for the environment
- [ ] `STRIPE_WEBHOOK_SECRET` matches the same Stripe mode
- [ ] Stripe webhook endpoint points to:
  - [ ] `POST {APP_URL}/api/stripe/webhook`
- [ ] Relevant events are subscribed:
  - [ ] `checkout.session.completed`
  - [ ] `checkout.session.expired`

### Payment flow verification

- [ ] Create and issue a real test invoice in the target environment
- [ ] Open public invoice link on a real phone
- [ ] Complete Stripe checkout
- [ ] Verify webhook fires successfully
- [ ] Verify invoice moves to `paid` or `partially_paid` correctly
- [ ] Verify payment appears in office invoice detail
- [ ] Verify customer-facing invoice does not encourage a duplicate payment

### Communications callbacks

- [ ] Resend webhook endpoint configured if email is enabled
- [ ] Twilio webhook endpoint configured if SMS is enabled
- [ ] Internal communications processor route is called by scheduler or cron

## 5. QA Summary

Core QA coverage that must be considered complete before launch:

- Auth/session
- Customers and vehicles
- Jobs and dispatch
- Technician mobile workflow
- Inspections
- Photos
- Estimates
- Approvals and signatures
- Invoices
- Stripe payments
- Customer communications
- Public estimate and invoice pages
- Service history
- Meet Your Mechanic
- VIN decode
- Labor guide
- Carfax if enabled

Minimum go/no-go QA path:

- [ ] office web login
- [ ] technician mobile login
- [ ] create customer/vehicle/job
- [ ] assign and dispatch job
- [ ] technician completes inspection
- [ ] customer approves estimate
- [ ] office issues invoice
- [ ] customer pays invoice
- [ ] webhook reconciles payment
- [ ] final state is correct across office, technician, and customer surfaces

## 6. Seed and Demo Data Summary

### Demo tenant

Company:
- `North Loop Mobile Auto`

Users:
- `owner@northloopauto.com`
- `admin@northloopauto.com`
- `dispatch@northloopauto.com`
- `alex.tech@northloopauto.com`
- `sam.tech@northloopauto.com`

Key demo scenarios:
- scheduled job with sent estimate
- dispatched job
- in-progress technician job with inspection
- completed paid job
- completed partially paid job
- rich service-history customer

### QA tenant

Company:
- `Redwood Test Garage`

Users:
- `owner@redwoodtestgarage.com`
- `dispatch@redwoodtestgarage.com`
- `tech@redwoodtestgarage.com`

Key QA scenarios:
- phone-only customer
- email-only customer
- no-contact customer
- inactive customer/vehicle
- canceled job
- synthetic VIN/fallback cases

Bootstrap commands:

```powershell
pnpm bootstrap:dev-users
pnpm bootstrap:demo-data
```

## 7. Soft-Launch Plan

### Who goes first

- 1 owner or operations lead
- 1 dispatcher/service advisor
- 1 technician
- 5-10 friendly repeat customers max

### First workflows to run in real use

1. intake: customer + vehicle + job
2. dispatch assignment
3. technician mobile receipt
4. inspection + photos
5. estimate send + approval
6. invoice issue + payment
7. communication sends where appropriate

### Launch approach

- Day 1-2: smallest possible real pilot
- Day 3-4: slight volume increase only if stable
- Day 5-7: monitor repeatability and support load
- Do not widen rollout until no blocker-class issues remain active

## 8. First-Week Monitoring Checklist

### Daily review

- [ ] jobs created
- [ ] jobs assigned
- [ ] jobs completed
- [ ] estimates sent
- [ ] estimates approved
- [ ] invoices issued
- [ ] invoices paid
- [ ] partial payments
- [ ] overdue invoices
- [ ] Stripe webhook failures
- [ ] payment reconciliation failures
- [ ] communication delivery failures
- [ ] manual workaround count
- [ ] support requests count

### Daily user check-ins

- [ ] dispatcher check-in
- [ ] technician check-in
- [ ] customer-facing problems reviewed
- [ ] all incidents entered into one tracker

### Issues to review first each day

1. payment issues
2. auth/session issues
3. dispatch/mobile sync issues
4. public customer-link issues
5. communication failures

## 9. Rollback and Stop Conditions

Pause rollout immediately if any of these occur:

- payment mismatch
- duplicate-charge risk
- broken public estimate or invoice links
- broken approval or signature flow
- office login instability
- technician login instability
- dispatch/mobile assignment mismatch
- wrong-company or wrong-customer data exposure
- core workflow requires repeated manual rescue

For a small team, pause means:

- stop adding new users/customers
- reduce usage to the smallest pilot group
- use manual fallback for the affected workflow
- fix the issue before expanding again

## 10. Key Links and Config Items At Launch Time

### Key app links

- Web login: `http://localhost:3000/login` locally
- Office dashboard: `{APP_URL}/dashboard`
- Dispatch board: `{APP_URL}/dashboard/dispatch`
- Stripe webhook: `{APP_URL}/api/stripe/webhook`
- Resend webhook: `{APP_URL}/api/webhooks/communications/resend`
- Twilio webhook: `{APP_URL}/api/webhooks/communications/twilio`
- Internal comms processor: `{APP_URL}/api/internal/communications/process`

### Required config items

- `APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CUSTOMER_DOCUMENT_TOKEN_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

If communications are in launch scope:

- `COMMUNICATIONS_PROCESS_SECRET`
- `COMMUNICATIONS_FROM_EMAIL`
- `COMMUNICATIONS_REPLY_TO_EMAIL`
- `COMMUNICATIONS_FROM_PHONE`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### Final go-live sign-off

- [ ] technical owner sign-off
- [ ] product or operations owner sign-off
- [ ] payment verification sign-off
- [ ] support owner sign-off
- [ ] soft-launch user list approved
