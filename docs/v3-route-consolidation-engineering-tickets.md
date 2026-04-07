# V3 Route Consolidation Engineering Tickets

This document converts the V3 architecture direction into route-by-route engineering tickets.

Companion docs:

- [v3-operations-architecture-and-workflow-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-operations-architecture-and-workflow-spec.md)
- [v3-implementation-backlog.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-implementation-backlog.md)
- [v2-milestone-26-27-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-milestone-26-27-engineering-tickets.md)

These tickets assume the current codebase already exposes both legacy and V2 transitional routes.

They are written to reduce product-model duplication without forcing one risky rewrite.

## Working assumptions

1. Compatibility routes may stay live longer than shell framing.
2. Operator language should move before internal renaming when needed.
3. Existing page implementations can be wrapped or re-exported during migration.
4. Priority goes to reducing page identity duplication, not deleting route files immediately.

## Ticket 30.1: Finish shell demotion of standalone Estimates

### Goal

Stop presenting Estimates as a peer desk in the shell while preserving compatibility access.

### Current implementation surface

- `apps/web/components/dashboard-nav-config.ts`
- office shell components that render nav sections
- estimate launch links from Today Brief, Visits, and Dispatch

### Required changes

- remove any remaining primary-shell emphasis for `/dashboard/estimates`
- ensure estimate entry points route through Visits when the operator is continuing an existing thread
- keep `/dashboard/estimates` reachable for compatibility and focused queue access

### Acceptance criteria

- Estimates is no longer framed as a primary peer module
- estimate follow-through launches from Visits by default

## Ticket 30.2: Fully demote Customer Vehicles to Customers workspace ownership

### Goal

Make customer-owned vehicle review feel like part of Customers instead of a separate desk.

### Current implementation surface

- `apps/web/app/dashboard/customer-vehicles/page.tsx`
- `apps/web/app/dashboard/customers/page.tsx`
- `apps/web/app/dashboard/customers/_components/customers-workspace-shell.tsx`

### Required changes

- keep `/dashboard/customer-vehicles` as redirect or compatibility entry
- strengthen Customers vehicles mode, filters, and selection handling
- ensure common launch points land in Customers with the correct tab, customer, or vehicle selected

### Acceptance criteria

- users do not need a separate desk identity for customer-owned vehicles
- vehicle context is reachable from Customers and Visits without shell duplication

## Ticket 30.3: Fully demote Fleet Vehicles and Team to Fleet workspace ownership

### Goal

Turn Fleet into the one parent desk for units and technicians.

### Current implementation surface

- `apps/web/app/dashboard/fleet/page.tsx`
- `apps/web/app/dashboard/fleet/_components/fleet-workspace.tsx`
- `apps/web/app/dashboard/fleet-vehicles/page.tsx`
- `apps/web/app/dashboard/team/page.tsx`

### Required changes

- preserve compatibility entry routes
- ensure Fleet panel, tab, or query-state ownership for `units` and `team`
- standardize launch links to `/dashboard/fleet?panel=...`

### Acceptance criteria

- operators experience units and technicians as parts of Fleet, not as peer modules

## Ticket 30.4: Finish Supply parent-route ownership

### Goal

Unify legacy Parts and Inventory desks under Supply.

### Current implementation surface

- `apps/web/app/dashboard/supply/page.tsx`
- `apps/web/app/dashboard/parts/page.tsx`
- `apps/web/app/dashboard/inventory/page.tsx`
- supply sub-routes under `apps/web/app/dashboard/supply/**`

### Required changes

- standardize all main navigation and desk-to-desk links to `/dashboard/supply`
- keep deep parts and inventory sub-routes functional during migration
- make support copy consistently frame these as Supply functions

### Acceptance criteria

- Supply is the parent operational desk
- Parts and Inventory no longer read as peer product identities

## Ticket 30.5: Finish Finance parent-route ownership

### Goal

Unify standalone invoice desk framing under Finance.

### Current implementation surface

- `apps/web/app/dashboard/finance/page.tsx`
- `apps/web/app/dashboard/invoices/page.tsx`
- visit invoice artifact links and finance launch links

### Required changes

- standardize shell and cross-desk links to `/dashboard/finance`
- preserve `/dashboard/invoices` as compatibility path if still needed
- ensure visit-side billing links open focused finance states when the user is leaving visit context intentionally

### Acceptance criteria

- Finance becomes the only parent desk identity for collections and invoice follow-through

## Ticket 31.1: Move estimate-support entry into Visits scopes

### Goal

Make estimate production and approval follow-through feel native to Visits.

### Current implementation surface

- `apps/web/app/dashboard/visits/page.tsx`
- `apps/web/app/dashboard/estimates/page.tsx`
- shared estimate-support helpers

### Required changes

- add explicit Visits scopes for drafting, awaiting approval, stale approval, and approved release
- make estimate-support actions return to visit context cleanly
- pass selected visit or estimate focus into estimate-support queue views when needed

### Acceptance criteria

- a service advisor can move from visit queue to estimate work without feeling like they changed products

## Ticket 31.2: Reframe `/dashboard/estimates` as a support desk, not a primary desk

### Goal

Keep the estimate queue without preserving the wrong product model.

### Current implementation surface

- `apps/web/app/dashboard/estimates/page.tsx`

### Required changes

- change page framing, copy, and launch actions to reinforce that estimate support belongs to Visits
- prefer return links and queue actions that reopen visit context instead of deep module hopping

### Acceptance criteria

- the desk is still useful for focused quote follow-through
- it no longer competes conceptually with Visits

## Ticket 32.1: Create one persistent visit workspace shell

### Goal

Collapse the artifact tree under a single visit shell.

### Current implementation surface

- `apps/web/app/dashboard/visits/[jobId]/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/_components/visit-workspace-shell.tsx`
- deep sub-routes under `apps/web/app/dashboard/visits/[jobId]/**`

### Required changes

- strengthen the existing visit shell as the primary container
- ensure estimate, inspection, photos, supply, and invoice live as internal tabs or panels first
- keep deep routes functioning during parity work

### Acceptance criteria

- routine artifact review stays inside the visit shell
- visit context remains stable while the user changes tools

## Ticket 32.2: Downgrade estimate detail route identity

### Goal

Stop treating estimate pages as separate destinations during common visit work.

### Current implementation surface

- `apps/web/app/dashboard/visits/[jobId]/estimate/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/estimate/workspace/page.tsx`

### Required changes

- preserve deep links for direct entry and edit flows
- redirect or embed routine review into the visit shell
- standardize shell-level back paths into the parent visit workspace

### Acceptance criteria

- the operator perceives estimate work as part of the visit thread

## Ticket 32.3: Downgrade inspection, photos, supply, and invoice route identity

### Goal

Reduce the remaining artifact-page fragmentation.

### Current implementation surface

- `apps/web/app/dashboard/visits/[jobId]/inspection/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/photos/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/parts/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/inventory/page.tsx`
- `apps/web/app/dashboard/visits/[jobId]/invoice/page.tsx`

### Required changes

- use tab or rail treatment inside the visit shell for review-first flows
- preserve deep routes for specialized deep work only
- standardize action handoff back into the visit workspace

### Acceptance criteria

- office users no longer bounce across multiple route identities for one visit lifecycle

## Ticket 33.1: Open visit quick context directly from Dispatch

### Goal

Let dispatchers inspect the hot thread without leaving the board.

### Current implementation surface

- `apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx`
- dispatch quick-edit and operations rail components

### Required changes

- add visit quick-context drawer behavior from dispatch cards or selected lane items
- keep lane-level context visible while the drawer is open
- expose message, replan, and route-back-to-readiness actions inline

### Acceptance criteria

- dispatchers do not need full-page route changes for routine lane recovery decisions

## Ticket 33.2: Strengthen Visits-to-Dispatch release handoff

### Goal

Make release to dispatch obvious and low-friction.

### Current implementation surface

- `apps/web/app/dashboard/visits/page.tsx`
- visit drawer and visit artifact actions
- dispatch route helpers

### Required changes

- standardize primary release actions from the queue and selected visit
- deep-link into the appropriate dispatch view, lane scope, or date context
- preserve return path to the originating visit queue scope

### Acceptance criteria

- ready work reaches dispatch with minimal clicks and no ambiguity about what happens next

## Ticket 33.3: Route dispatch recoveries back into readiness scopes, not generic pages

### Goal

Make recovery feel like part of one operating system.

### Current implementation surface

- dispatch recovery actions
- visit queue scope helpers
- dashboard alias and search-param helpers

### Required changes

- standardize recovery actions to reopen the correct Visits queue or selected visit focus
- reduce generic desk landings from dispatch exceptions

### Acceptance criteria

- recovery work lands the user in the exact next queue state instead of a broad module shell

## Ticket 34.1: Deep-link customer and vehicle context through parent workspaces only

### Goal

Stop leaking secondary route identity into normal work.

### Current implementation surface

- customer workspace helpers
- vehicle helper links from Visits, Estimates, and Today Brief

### Required changes

- normalize links to customer and vehicle context through `/dashboard/customers`
- pass tab, customer, and selected vehicle search state as needed

### Acceptance criteria

- customer and vehicle context open through one parent workspace model

## Ticket 35.1: Deep-link unit and technician context through Fleet only

### Goal

Normalize field-capacity links around Fleet.

### Current implementation surface

- dispatch links into fleet-related views
- fleet workspace routing state
- Today Brief and exception links

### Required changes

- standardize links to `/dashboard/fleet?panel=units` and `/dashboard/fleet?panel=team`
- avoid standalone route framing in operator-facing actions

### Acceptance criteria

- field-capacity detail always feels like part of Fleet

## Ticket 36.1: Standardize parent-desk return paths from Supply and Finance to Visits

### Goal

Make support desks feel subordinate to visit work.

### Current implementation surface

- supply and finance queue actions
- visit-side artifact actions and cross-links

### Required changes

- whenever support actions originate from a visit, preserve a clean return path to the same visit or visit queue scope
- prefer focused return actions over generic desk links

### Acceptance criteria

- operators can resolve blockers or billing work and return to the same thread easily

## Suggested implementation order

1. Tickets 30.1 to 30.5
2. Tickets 31.1 and 31.2
3. Tickets 32.1 to 32.3
4. Tickets 33.1 to 33.3
5. Tickets 34.1, 35.1, and 36.1