# V3 Dispatch, Visits, And Estimates UI Build Plan

This document translates the screen spec into component-level build tasks.

Companion docs:

- [v3-dispatch-visits-estimates-screen-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-dispatch-visits-estimates-screen-spec.md)
- [v3-milestone-30-31-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-milestone-30-31-engineering-tickets.md)
- [v3-route-consolidation-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-route-consolidation-engineering-tickets.md)

This is a build-plan document.

It maps target product behavior to current file surfaces so design and implementation can proceed without rediscovering the codebase.

## Build rule

Prefer re-composition of existing desk shells, queue helpers, and rails over inventing parallel components.

## 1. Dispatch build plan

### Primary files

- `apps/web/app/dashboard/dispatch/page.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-operations-rail.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-quick-edit-panel.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-unassigned-panel.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-board.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-week-calendar.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-calendar-grid.tsx`

### Build tasks

#### Task D1: Compress header and toolbar framing

Outcome:

- dispatch board becomes visually dominant

Changes:

- reduce top copy and header height in `dispatch/page.tsx`
- tighten toolbar grouping inside `dispatch-command-center.tsx`
- keep counters, date controls, and view controls compact and attached to the board

#### Task D2: Split left support column from board canvas

Outcome:

- release-ready, backlog, and insert candidates stop competing with the board

Changes:

- reorganize queue and saved-view surfaces inside `dispatch-command-center.tsx`
- move low-priority controls out of the board header into support regions or secondary controls

#### Task D3: Convert the right rail into an intervention dock

Outcome:

- the right side answers what needs action now rather than listing technicians neutrally

Changes:

- refactor `dispatch-operations-rail.tsx`
- sort by intervention value, not neutral roster order
- keep selected lane or technician summary pinned above scrollable detail

#### Task D4: Open visit quick context from lane cards

Outcome:

- dispatchers can inspect the hot thread without leaving the board

Changes:

- reuse `dispatch-quick-edit-panel.tsx` or replace it with a visit quick-context drawer
- expose actions for reassign, send delay update, review promise risk, and move back to readiness

## 2. Visits build plan

### Primary files

- `apps/web/app/dashboard/visits/page.tsx`
- `apps/web/app/dashboard/visits/_components/jobs-workboard.tsx`
- `apps/web/app/dashboard/_components/operational-focus-panel.tsx`

### Build tasks

#### Task V1: Make queue-first behavior visually dominant

Outcome:

- Visits reads as a production desk, not a board-first status page

Changes:

- tighten page framing in `visits/page.tsx`
- keep board mode available but clearly secondary
- promote queue presets, focus scopes, and selected-thread actions

#### Task V2: Strengthen selected-thread drawer behavior

Outcome:

- common visit decisions stop forcing full-page detail jumps

Changes:

- refine selected-thread sections in `visits/page.tsx`
- keep operational focus, customer context, blockers, and direct actions high in the drawer
- reduce duplicated summary content

#### Task V3: Route estimate follow-through through Visits scopes

Outcome:

- estimate support becomes part of visit production

Changes:

- normalize estimate-support launch helpers in `visits/page.tsx`
- add or refine queue scopes for drafting, approval, stale approval, and ready dispatch

#### Task V4: Tighten workboard secondary mode

Outcome:

- board remains useful without feeling like the primary desk

Changes:

- compact lane headers in `jobs-workboard.tsx`
- reduce editorial copy and vertical space per lane
- keep selected card actions anchored in Visits context

## 3. Estimate support and builder build plan

### Primary files

- `apps/web/app/dashboard/estimates/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/estimate/workspace/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/estimate/page.tsx`

### Build tasks

#### Task E1: Reframe estimate desk as support for Visits

Outcome:

- the queue desk remains useful without feeling like a standalone module

Changes:

- tighten page framing in `estimates/page.tsx`
- route follow-through actions back into Visits where appropriate
- keep builder launch direct for actual drafting work

#### Task E2: Preserve thread continuity in the builder

Outcome:

- estimate drafting stays in visit context conceptually, even when the builder has its own route

Changes:

- strengthen top context strip and return-to-visit actions in the builder route
- keep customer, vehicle, concern, and next-step context prominent

#### Task E3: Distinguish builder work from queue work

Outcome:

- operators understand when they are drafting versus when they are managing approvals

Changes:

- use the estimate queue for support-stage triage
- use the builder route for actual estimate composition and revision

## 4. Shared primitives to reuse

### Existing reusable components

- `apps/web/app/dashboard/_components/operational-focus-panel.tsx`
- `apps/web/app/dashboard/_components/dashboard-queue-panel.tsx`
- `apps/web/app/dashboard/_components/field-command-shell.tsx`

### Shared helper layers already aligned to this direction

- `apps/web/lib/office-workspace-focus.ts`
- shared estimate-support helpers
- shared billing-state helpers
- shared service-thread helpers

## 5. Implementation sequence

1. Normalize Visits-first estimate launch paths.
2. Tighten Today Brief and Reports estimate follow-through links.
3. Compress Dispatch framing and rework the right rail into an intervention dock.
4. Strengthen Visits queue-first framing and selected-thread drawer actions.
5. Reframe Estimate support as a secondary desk and preserve builder direct access.

## 6. Success criteria

The build plan succeeds when:

- Dispatch reads as the live control surface
- Visits reads as the advisor production desk
- Estimate support feels embedded in Visits-first workflow ownership
- existing components are reused enough that the implementation surface stays coherent instead of fragmenting again