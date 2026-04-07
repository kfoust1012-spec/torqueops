# Mobile Field Workflow Backlog

## Goal

Make `apps/mobile` the technician's primary field operating system instead of a read-mostly companion. A mechanic should be able to run a stop from assignment through payment with the next action visible in one or two taps.

## Non-negotiable outcomes

- The technician can see the next required action immediately after opening a stop.
- Core field states cover the real journey: released, en route, arrived, diagnosing, waiting approval, waiting parts, repairing, ready for payment, complete.
- Estimate, parts, invoice, payment, notes, photos, and closeout all stay inside the mobile field flow.
- Field actions survive bad connectivity through an offline mutation queue.

## Current blockers from the audit

- No reliable assignment or change alerting from the mobile app.
- Persisted technician status is too coarse and skips arrival, waiting, and parts states.
- The stop detail uses too many stacked sections before the mechanic reaches the next move.
- Mobile cannot create estimates, source parts, issue invoices, or collect payment natively.
- Payment, maps, and phone workflows still push the mechanic out of the app.
- Only location updates have explicit offline queueing.

## Delivery order

### Epic 1: Real field status model

Objective:
- Replace the current `scheduled/dispatched -> in_progress -> completed` technician flow with a state model that matches field reality.

Tickets:
- `FW-01` Add persisted field statuses to the database enum, generated types, validation rules, and status-history copy.
- `FW-02` Update shared status helpers, API repositories, and mobile status actions to support the new state graph safely.
- `FW-03` Update dispatch and visit detail surfaces so office users can see technician route, arrival, approval, parts, and payment waiting states.
- `FW-04` Audit communications and automations that key off job status so customer messaging does not regress during the migration.

Acceptance:
- A technician can move through `Released -> En route -> Arrived -> Diagnosing -> Waiting approval -> Waiting parts -> Repairing -> Ready for payment -> Complete`.
- Dispatch and status history show those states consistently.
- Existing jobs and RPC calls do not break during rollout.

### Epic 2: Single-stop workboard

Objective:
- Make the stop detail the mechanic's one-screen field workboard.

Tickets:
- `FW-05` Replace the current stacked stop sequence with a workboard header that shows current stage, blocker, and primary next action.
- `FW-06` Add a dense quick-action cluster for call, navigate, inspection, estimate, photos, invoice, and payment.
- `FW-07` Keep closeout blockers, status controls, and stop facts on the same screen instead of separate top-level sections.
- `FW-08` Add a sticky bottom action bar once the base workboard information density settles.

Acceptance:
- The mechanic can see status, route/contact tools, and the next required action without reading through multiple cards first.
- Every core stop tool is reachable in one tap from the stop workboard.

### Epic 3: Mobile estimate and parts completion

Objective:
- Remove the field dead ends around pricing and sourcing.

Tickets:
- `FW-09` Add mobile estimate creation and editing for technician-safe line items.
- `FW-10` Add approval capture inline from the stop workboard and estimate thread.
- `FW-11` Add mobile parts search, supplier comparison, order state, and waiting-on-parts updates.
- `FW-12` Attach sourced parts directly to estimate and invoice follow-through.

Acceptance:
- A technician can diagnose, build added work, get approval, and source parts without leaving the mobile product.

### Epic 4: Mobile billing and closeout

Objective:
- Let the mechanic finish payment and job closeout without office intervention.

Tickets:
- `FW-13` Add mobile invoice creation and issue flows when the field stop has approved work ready to bill.
- `FW-14` Add native payment collection modes for payment link, manual card, cash, and check tracking.
- `FW-15` Build a one-pass closeout confirmation that validates invoice, payment, evidence, and notes before completion.

Acceptance:
- The technician can leave a stop only after the real billing and closeout state is explicit.

### Epic 5: Alerts and offline safety

Objective:
- Make the product reliable under field conditions.

Tickets:
- `FW-16` Add push notifications for new assignment, reassignment, timing changes, approval events, and office messages.
- `FW-17` Add an offline mutation queue for technician status, notes, inspections, attachments, approvals, invoice actions, and payments.
- `FW-18` Add sync-state visibility so the technician knows whether a field action is pending, saved, or failed.

Acceptance:
- A mechanic can keep working through low signal without losing field updates or having to remember what to re-enter later.

## Current implementation slice

This tranche intentionally avoids a schema migration first. It does two things:

- Use a shared derived field-stage helper to expose the real current stage even while the persisted status enum is still coarse.
- Rebuild the technician stop detail into a denser workboard so stage, blocker, next action, and core tools move toward the final model immediately.

## Implementation note

The first slice is a bridge, not the destination. The derived field-stage helper improves mobile guidance now, but the real fix still requires the persisted status migration in `FW-01` through `FW-04`.
