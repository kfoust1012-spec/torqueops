# Mobile Field Audit Remediation Plan

This plan turns the field workflow audit into implementation work.

The target is not a prettier mobile app.

The target is a technician flow that survives a full day of real field use with minimal taps, minimal reorientation, and minimal memory burden.

## Delivery rules

- Always optimize for the active stop before secondary admin concerns.
- Prefer one-stop execution over route-hopping.
- Treat leaving the app as a workflow failure unless the external handoff is unavoidable.
- Treat manual re-entry as a defect, not as normal product behavior.
- Prefer one obvious next action over multiple equally-weighted actions.

## Phase 1: Stop Workboard Hardening

Goal:
- Make the active stop fast enough to use one-handed under time pressure.

Tasks:
- Add a sticky bottom action dock to the stop so `Drive`, `Call`, `Inspect`, `Estimate`, `Evidence`, and `Pay` stay reachable without scrolling.
- Reorder the stop so action access appears before blocker review and lower-priority summaries.
- Tighten technician status progression so the app stops encouraging invalid field jumps.
- Keep completion gated by inspection, approval, invoice, payment, and evidence state.
- Keep resume-after-interruption affordances visible from the stop.

Exit criteria:
- A mechanic can open the stop and hit the next action in one tap.
- The stop no longer allows obvious bad state jumps like `arrived -> completed`.

## Phase 2: Assignment And Queue Reliability

Goal:
- Make assignment changes, queue priority, and next-stop handoff trustworthy.

Tasks:
- Add a technician notification center inside the app instead of relying only on OS push.
- Expand push coverage beyond assignment and timing to approval-ready, office message, billing follow-up, and reassignment events.
- Re-rank the technician queue by live urgency and route reality instead of raw status sort order.
- Add a post-completion `Open next stop` handoff that carries the mechanic straight into the next address.
- Add explicit assignment acknowledgement and reassignment visibility.

Exit criteria:
- A mechanic can trust the app to show the right next stop without hunting.
- Dispatch changes are visible even when OS push is unavailable or denied.

## Phase 3: Inspection Compression

Goal:
- Reduce inspection overhead while preserving evidence quality.

Tasks:
- Collapse inspection overview plus section drill-in into a faster progressive checklist path.
- Preserve quick-pass behavior and auto-scroll to the next unchecked item.
- Keep fail and attention paths inline without making the mechanic bounce through extra overview layers.
- Add a fast resume path back into the last active inspection section and item.

Exit criteria:
- Opening inspection lands near the next unfinished item, not just the top-level overview.
- Common pass flows complete with one tap per item.

## Phase 4: Estimate And Approval Compression

Goal:
- Make field pricing and approval feel like one stop-thread instead of multiple desks.

Tasks:
- Keep quick estimate line creation on the stop and tighten the draft flow further.
- Move customer approval capture into an inline stop sheet instead of a separate route for routine approvals.
- Prefill signer and approval context whenever possible.
- Reduce flat estimate form overhead and keep common line additions chip-first.
- Make grouped/office-only limits explicit without forcing extra navigation unless necessary.

Exit criteria:
- A mechanic can diagnose, price, and capture approval without feeling kicked into office software.

## Phase 5: Parts Workflow Completion

Goal:
- Turn parts from note capture into a real field unblock workflow.

Tasks:
- Add clearer `waiting on parts` state guidance from the stop.
- Reduce manual supplier entry with stronger recent-supplier and fitment shortcuts.
- Add structured order/pickup ETA tracking to sourced parts.
- Make return-visit decisions and parts holds visible from the stop without reopening the full estimate.

Exit criteria:
- A mechanic can explain what part is needed, where it is coming from, and whether the job is blocked without freehand reconstruction.

## Phase 6: Billing, Payment, And Closeout Consolidation

Goal:
- Finish the stop inside one billing thread with less bounce-out.

Tasks:
- Keep invoice issue, send, collect, and follow-up actions inside a single stop billing surface.
- Reduce invoice draft editing overhead for field use.
- Promote manual payment, resend link, and office follow-through into a single decision model.
- Add a dedicated closeout confirmation sheet with blocker checklist and next-stop handoff.
- Reduce dependence on external payment pages as the primary happy path wherever platform limits allow.

Exit criteria:
- A mechanic can leave the stop knowing payment and closeout were handled deliberately, not implied.

## Phase 7: Mobile Readability And Interaction Cleanup

Goal:
- Improve outdoor and one-hand usability without redesign churn.

Tasks:
- Reduce low-contrast helper copy in critical action areas.
- Trim long explanatory paragraphs on the stop, estimate, and invoice flows.
- Tighten chip and action wrapping in the highest-frequency surfaces.
- Preserve minimum touch targets while reducing vertical sprawl.

Exit criteria:
- The active stop reads clearly in sunlight and under interruption.

## Recommended execution order

1. Phase 1
2. Phase 2
3. Phase 6
4. Phase 4
5. Phase 3
6. Phase 5
7. Phase 7

This order prioritizes the active stop, assignment trust, and field closeout before deeper workflow refinements.
