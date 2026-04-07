# Customer SMS Self-Serve Onboarding Spec

This document defines the self-serve onboarding UX and admin checklist for company-owned SMS setup in a subscription version of the product.

Companion docs:

- [customer-sms-provider-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-provider-engineering-tickets.md)
- [customer-sms-platform-runbook.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/customer-sms-platform-runbook.md)
- [release-checklist.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/release-checklist.md)
- [environment.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/environment.md)

## Goal

Let a new mechanic company connect `Twilio` or `Telnyx`, complete the minimum manual provider setup, verify delivery callbacks, and safely enable automated customer texting without support intervention.

## Product constraints

1. The product supports `Twilio` and `Telnyx` for automated SMS.
2. `Google Voice` is not supported for automated sends.
3. The shop owns its provider account, number, and carrier registration.
4. The app does not automate `A2P 10DLC` or toll-free registration in v1.
5. Automated customer SMS must stay disabled until required onboarding checks pass.

## Primary users

- `Owner`
- `Admin`
- `Dispatcher`

Recommended permission rule:

- only `owner` and `admin` can connect or disconnect providers
- `dispatcher` can view status but cannot change credentials or enable automations

## Entry points

Primary entry:

- `Settings > Communications`

First-run prompts:

- onboarding card on the company home page when no SMS provider is configured
- blocking callout on automation pages if user tries to enable SMS workflows before setup is complete

## Core onboarding model

The app should present onboarding as a guided checklist, not a raw provider settings form.

Checklist statuses:

- `not_started`
- `in_progress`
- `blocked`
- `complete`

Automation readiness states:

- `not_ready`
- `provider_connected`
- `verification_pending`
- `ready_for_test`
- `ready_for_live`

## Onboarding flow

Recommended route structure:

- `/dashboard/settings/communications`
- `/dashboard/settings/communications/onboarding`
- `/dashboard/settings/communications/onboarding/provider`
- `/dashboard/settings/communications/onboarding/compliance`
- `/dashboard/settings/communications/onboarding/connect`
- `/dashboard/settings/communications/onboarding/test`
- `/dashboard/settings/communications/onboarding/review`

### Step 1: Choose provider

Purpose:

- choose `Twilio` or `Telnyx`
- explain tradeoff briefly

UI content:

- provider cards
- short comparison:
  - `Twilio`: easiest setup in this app
  - `Telnyx`: strong alternative if the shop already uses it or prefers its pricing
- note that provider account, number purchase, and US registration happen in the provider portal

Primary actions:

- `Use Twilio`
- `Use Telnyx`

Checklist output:

- selected provider

### Step 2: Business and compliance prep

Purpose:

- gather the information the shop will need before they leave for the provider portal

Fields:

- legal business name
- DBA or customer-facing shop name
- EIN or sole proprietor status
- business address
- business phone
- website URL
- privacy policy URL
- terms URL
- support email

Structured prompts:

- how customers opt in to text messages
- whether the shop will send links
- whether the shop will send phone numbers in messages
- preferred sender type:
  - `local 10DLC`
  - `toll-free`

Provider-specific note:

- show `toll-free` only for providers and sender setups where that is supported operationally

Checklist output:

- business identity saved
- opt-in method saved
- sender type chosen

### Step 3: Message policy prep

Purpose:

- generate the compliance text the provider will ask for

Required inputs:

- campaign description
- message flow description
- sample messages
- help contact

App-generated defaults for this product:

- campaign description:
  - transactional service updates for appointment scheduling, technician arrival, delay notifications, estimate or invoice reminders, and payment follow-up
- message flow:
  - customers provide their mobile number during booking, estimate approval, or invoice intake and agree to receive service-related text messages
- sample messages:
  - `{{shop_name}}: Your technician is on the way to {{service_address}} and is expected around {{eta}}. Reply STOP to opt out.`
  - `{{shop_name}}: We are running about {{delay_minutes}} minutes behind for your {{appointment_date}} visit. We will text you again with an updated ETA. Reply STOP to opt out.`
  - `{{shop_name}}: Invoice {{invoice_number}} for {{invoice_total}} is ready. Pay here: {{payment_link}}. Reply STOP to opt out.`

Required editable fields:

- `message and data rates may apply` disclosure
- opt-out instructions
- support contact line

Checklist output:

- sample messages approved
- opt-in language approved
- help/stop wording approved

### Step 4: Provider portal tasks

Purpose:

- give the admin an exact manual checklist to complete outside the app

#### Twilio track

The app should display:

1. Create or sign in to a Twilio account.
2. Buy a sender number.
3. Complete `A2P 10DLC` registration for local numbers, or toll-free verification for toll-free numbers.
4. Wait for provider approval if required.
5. Copy these values back into the app:
   - `Account SID`
   - `Auth Token`
   - sender number

#### Telnyx track

The app should display:

1. Create or sign in to a Telnyx account.
2. Create an API key.
3. Create or choose a messaging profile.
4. Buy and assign a sender number.
5. Complete `10DLC` registration if using a local US number.
6. Copy these values back into the app:
   - `API key`
   - sender number
   - messaging profile ID if used
   - webhook signing public key

Checklist output:

- provider account created
- number purchased
- carrier registration submitted

### Step 5: Connect provider in the app

Purpose:

- persist the provider account and verify basic connectivity

UI behavior:

- render provider-specific form fields
- show the expected account-specific webhook URL
- show the current default provider state

Twilio fields:

- display name
- sender number
- account SID
- auth token
- `set as default provider`

Telnyx fields:

- display name
- sender number
- API key
- messaging profile ID
- webhook signing public key
- `set as default provider`

Primary actions:

- `Save and verify`
- `Save for later`

Checklist output:

- credentials saved
- provider verified
- webhook URL generated

### Step 6: Verify callback and test delivery

Purpose:

- make sure sends and delivery receipts actually work before live use

Required tasks:

- send a test SMS to the account owner or admin mobile number
- confirm outbound send succeeded
- confirm delivery webhook was received
- show provider message ID and final status

Recommended UI:

- dedicated test panel
- most recent test result card
- visible states:
  - `send_failed`
  - `sent_no_callback`
  - `delivered`

Blocking rule:

- `Enable automation` remains disabled until at least one test text reaches `delivered`

Checklist output:

- test send completed
- delivery callback verified

### Step 7: Review and enable automations

Purpose:

- turn on the workflows only after setup is complete

Automation toggles:

- `Technician on the way`
- `Running late`
- `Invoice ready or due`

Recommended defaults:

- all toggles off initially
- user must enable each one explicitly

Required review card:

- provider name
- sender number
- default provider
- last verified at
- last test result
- opt-out wording preview

Checklist output:

- automation policy reviewed
- individual automations enabled

## Admin checklist

This is the checklist the app should show in the onboarding sidebar and communications overview.

1. Choose supported SMS provider
2. Save business identity and website details
3. Define customer opt-in flow
4. Approve sample service-text messages
5. Create provider account
6. Purchase sender number
7. Submit carrier registration
8. Save provider credentials in the app
9. Verify provider connection
10. Verify webhook callback
11. Send successful test text
12. Enable live customer SMS automations

## Blocking rules

The app should block live SMS automation if any of these are missing:

- no default SMS provider
- provider account status is not `connected`
- no sender number saved
- no verified webhook path
- no successful test delivery
- no saved opt-in method
- no approved sample messages

The app should show warnings, not blocks, for:

- registration submitted but not yet approved
- provider connected but test send not yet run
- provider connected but no automations enabled

## Communications settings dashboard additions

The settings overview should gain a readiness summary.

Summary cards:

- `Default provider`
- `Readiness`
- `Last verified`
- `Live automations enabled`

Checklist panel:

- inline status for each onboarding step
- each row links to the exact place to fix it

Operational warnings:

- unsupported provider warning for `Google Voice`
- compliance reminder for US texting registration
- warning if the default provider is disconnected

## Suggested copy

Communications hub helper text:

- `Connect a supported SMS provider, verify delivery callbacks, and enable automated customer texting when the shop is ready.`

Blocking callout:

- `Customer SMS is not ready yet. Complete provider setup, verify delivery, and run a test message before enabling live automations.`

Compliance helper:

- `Your shop is responsible for carrier registration, consent collection, and approved sender usage.`

## Recommended implementation phases

Phase 1:

- onboarding checklist model derived from current provider settings
- communications overview readiness panel
- test SMS action and result tracking
- automation gating rules

Phase 2:

- dedicated onboarding routes and stepper UX
- provider-specific guidance blocks
- generated sample-message and opt-in copy

Phase 3:

- saved onboarding progress
- support-facing troubleshooting panel
- optional white-glove setup path

## Engineering follow-up

This spec should become at least one new ticket pack item:

- self-serve onboarding wizard
- readiness checklist model
- test-send verification flow
- automation gating rules

## Acceptance criteria

- A first-time company admin can follow one guided flow from no provider to verified test send.
- The app clearly separates provider setup, compliance preparation, and live activation.
- Live SMS automation cannot be enabled accidentally before delivery verification succeeds.
- Support and QA can use the same checklist the customer sees.

## Official references

- Twilio A2P 10DLC business info: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info
- Twilio toll-free onboarding: https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding
- Telnyx 10DLC quickstart: https://developers.telnyx.com/docs/messaging/10dlc/quickstart
- Telnyx receiving webhooks: https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks
