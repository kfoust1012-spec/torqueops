# V3 Milestones 30-31 Engineering Tickets

This document turns the first two V3 milestones into implementation-ready tickets.

Companion docs:

- [v3-operations-architecture-and-workflow-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-operations-architecture-and-workflow-spec.md)
- [v3-implementation-backlog.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-implementation-backlog.md)
- [v3-route-consolidation-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-route-consolidation-engineering-tickets.md)

Included:

- Milestone 30: V3 shell and route-model finish
- Milestone 31: Visits queue and estimate-support convergence

Not included yet:

- persistent visit workspace shell completion
- dispatch and visits operating-system convergence
- fleet and customer consolidation implementation detail
- supply and finance completion passes

## Working assumptions

1. Existing compatibility routes remain live during migration.
2. Shell framing should move before route deletion.
3. Estimate support may remain a focused desk temporarily, but it must stop feeling like a peer product.
4. File-level changes should prefer redirects, wrappers, and helper normalization over risky rewrites.

## Milestone 30 ticket set

## Ticket 30.1: Finish shell demotion of standalone Estimates

### Goal

Remove the last shell-level signals that imply Estimates is a primary product desk.

### User outcome

Estimate follow-through reads as part of Visits-first production, not a competing module.

### Current implementation surface

- `apps/web/components/dashboard-nav-config.ts`
- `apps/web/components/dashboard-shell-nav.tsx`
- `apps/web/components/dashboard-mobile-nav.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/reports/page.tsx`

### Required changes

- keep `Estimates` out of primary nav
- route Today Brief approval pressure into Visits approval scopes by default
- route reporting-launch estimate follow-through into Visits-first scopes by default
- audit shell launch actions for any remaining estimate-first peer-module behavior

### Acceptance criteria

- shell no longer suggests Estimates is a peer primary desk
- common approval follow-through launches from Visits-first routes

## Ticket 30.2: Normalize estimate support handoff helpers to Visits-first routing

### Goal

Make estimate support helpers preserve the active visit thread.

### User outcome

From a selected visit, opening estimate follow-through keeps the operator anchored in Visits.

### Current implementation surface

- `apps/web/app/dashboard/visits/page.tsx`
- shared estimate-support helper usage in selected visit artifacts

### Required changes

- convert selected-visit estimate-support launch helpers to `/dashboard/visits` query-state entry where possible
- map estimate stages into Visits scopes:
  - `drafting` -> visit selected in intake context
  - `awaiting_approval` -> approval queue
  - `stale_approval` -> stale approval queue
  - `approved_release` -> ready dispatch queue
- preserve direct estimate workspace launch for builder work

### Acceptance criteria

- selected-visit estimate follow-through does not dump the user into a detached generic estimate queue

## Ticket 30.3: Finish parent-desk launch-path normalization for secondary desks

### Goal

Standardize how secondary desks open from parent workspaces.

### Current implementation surface

- Today Brief launch cards
- Reports link grid
- cross-desk actions in Visits, Dispatch, Finance, and Supply

### Required changes

- use Visits-first links for estimate support and approval work
- use parent desk links for finance and supply instead of old peer-module naming
- preserve deep links only for intentional deep work

### Acceptance criteria

- launch actions reflect the V3 parent-desk model consistently

## Ticket 30.4: Audit remaining Jobs and Estimates shell copy at the desk-entry level

### Goal

Remove product-model drift that is still visible at page entry.

### Current implementation surface

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/visits/page.tsx`
- `apps/web/app/dashboard/estimates/page.tsx`
- `apps/web/app/dashboard/reports/page.tsx`

### Required changes

- replace visible desk-entry `job` wording with `visit` where the operator model is already Visits-first
- reinforce estimate desk copy as support for visit production

### Acceptance criteria

- entry-level copy no longer reintroduces the old module taxonomy

## Milestone 31 ticket set

## Ticket 31.1: Add explicit Visits scopes for estimate-production follow-through

### Goal

Make Visits the first place advisors work estimate-related queues.

### User outcome

Advisors can open drafting, approval, stale approval, and ready-dispatch work from Visits without mentally changing desks.

### Current implementation surface

- `apps/web/app/dashboard/visits/page.tsx`
- estimate support helpers

### Required changes

- strengthen Visits queue presets and launch paths around:
  - drafting
  - awaiting approval
  - stale approval
  - approved release
- preserve selected visit focus on handoff

### Acceptance criteria

- Visits can carry estimate support load for normal production follow-through

## Ticket 31.2: Reframe Estimate support actions around return-to-Visits continuity

### Goal

Keep the estimate desk useful without letting it feel detached.

### Current implementation surface

- `apps/web/app/dashboard/estimates/page.tsx`

### Required changes

- preserve the current queue desk
- route lane summaries and follow-through actions back into Visits where the work should continue there
- strengthen return-to-Visits actions and copy

### Acceptance criteria

- the estimate desk behaves like focused support, not a competing product area

## Ticket 31.3: Preserve estimate-builder direct access while demoting estimate-queue identity

### Goal

Keep estimate drafting fast without keeping the wrong navigation model.

### Current implementation surface

- `apps/web/app/dashboard/visits/[jobId]/estimate/workspace/page.tsx`
- `apps/web/app/dashboard/visits/page.tsx`
- `apps/web/app/dashboard/estimates/page.tsx`

### Required changes

- keep direct builder routes and builder launch actions intact
- route queue-level follow-through into Visits scopes where the operator is managing thread progression rather than drafting

### Acceptance criteria

- the builder remains fast
- the queue identity becomes Visits-first

## Suggested implementation order

1. Ticket 30.1
2. Ticket 30.2
3. Ticket 30.3
4. Ticket 30.4
5. Ticket 31.1
6. Ticket 31.2
7. Ticket 31.3