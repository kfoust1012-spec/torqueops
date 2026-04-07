# Mobile Mechanic V2 Implementation Plan

This document turns the v2 IA and wireframe spec into an execution backlog.

Companion document:

- [v2-operations-ia-and-wireframes.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-operations-ia-and-wireframes.md)
- [v2-milestone-26-27-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-milestone-26-27-engineering-tickets.md)

This plan is intentionally opinionated.

It is designed to prevent the team from continuing to add depth to the current module structure while the product still needs structural consolidation.

## Outcome this plan is driving

Ship a dispatch-led, visit-centric office product where:

- office users work from fewer primary modules
- visits are handled in one persistent workspace
- dispatch and visits are tightly linked
- customer and vehicle context stay preserved
- fleet, team, and units behave as one field-capacity system
- supply and finance support operations instead of living as detached back-office destinations

## Current architectural problem

The product already has strong capability coverage, but the current architecture still spreads the visit lifecycle across too many peer routes and page surfaces:

- `jobs`
- `job detail`
- `estimate`
- `estimate workspace`
- `invoice`
- `inspection`
- `photos`
- `parts`
- `inventory`
- `customers`
- `customer vehicles`
- `fleet`
- `fleet vehicles`
- `team`

That creates three major risks:

1. Too many top-level destinations
2. Too many full-page hops for one visit lifecycle
3. Too much duplicated chrome and workspace framing across modules

## Non-negotiable implementation rules

1. Do not add more primary nav items.
2. Do not deepen the current job subpage tree unless it directly supports the migration to the visit workspace.
3. Prefer drawers, tabs, and split panes over new full-page detail routes.
4. Preserve the separation between customer-owned vehicles and company-owned fleet units at both data and UI levels.
5. Prioritize office operational speed over static record presentation.
6. Every milestone must reduce fragmentation, not merely restyle it.

## Program structure

The redesign should be executed in eight milestones.

Each milestone below includes:

- goal
- major product changes
- route impact
- implementation surface
- dependencies
- acceptance criteria

## Milestone 26: Shell And IA Reset

### Goal

Reset the product shell so the navigation reflects the future product model instead of the current module sprawl.

### Product changes

- Reduce primary navigation to:
  - `Dispatch`
  - `Visits`
  - `Customers`
  - `Fleet`
  - `Supply`
  - `Finance`
- Move the following out of primary nav:
  - `Customer vehicles`
  - `Fleet vehicles`
  - `Team`
  - `Reports`
  - `Settings`
- Introduce role-based home behavior:
  - dispatchers -> `Dispatch`
  - service advisors / estimators -> `Visits`
  - owners / managers -> `Today Brief`
- Rename product language:
  - `Jobs` -> `Visits`
  - `Invoices` -> `Finance`
  - `Parts` + `Inventory` -> `Supply`

### Route impact

- Keep existing route files during migration
- Change primary nav labels and destinations first
- Add transitional redirects or shell aliases as needed:
  - `/dashboard/visits` -> backed by current jobs surface at first
  - `/dashboard/finance` -> backed by current invoices surface at first
  - `/dashboard/supply` -> backed by current parts surface at first

### Implementation surface

- `apps/web/components/dashboard-shell-nav.tsx`
- `apps/web/components/dashboard-mobile-nav.tsx`
- `apps/web/app/dashboard/layout.tsx`
- role-aware routing entry logic in the dashboard shell

### Dependencies

- none

### Acceptance criteria

- Primary nav is reduced and future-state names are visible in-product
- Secondary modules remain reachable but are no longer framed as peer operational hubs
- Different office roles no longer share one generic default landing screen

## Milestone 27: Visits Queue And Drawer

### Goal

Turn the current jobs page into the first real `Visits` workspace.

### Product changes

- Make compact queue the default visit view
- Keep board as an optional mode, not the primary mental model
- Add a stronger visit drawer as the first-level interaction
- Ensure common visit actions happen from the queue and drawer:
  - assign technician
  - set schedule
  - add note
  - call or text customer
  - open estimate
  - open invoice
  - move to dispatch

### Route impact

- Create `/dashboard/visits`
- Keep `/dashboard/jobs` as transitional alias or redirect
- Use the current jobs data and workflow logic as the source of truth

### Implementation surface

- `apps/web/app/dashboard/jobs/page.tsx`
- `apps/web/app/dashboard/jobs/_components/jobs-workboard.tsx`
- shared visit queue and drawer components

### Dependencies

- Milestone 26 shell and IA reset

### Acceptance criteria

- A service advisor can move most visits forward from the queue without opening a full detail page
- Board mode still exists, but queue mode is clearly the default and best-supported path
- Drawer actions materially reduce job-detail page openings

## Milestone 28: Persistent Visit Workspace

### Goal

Replace the current stack of visit-related subpages with a single persistent visit workspace shell.

### Product changes

- Introduce a visit workspace with:
  - context strip
  - main canvas
  - right utility rail
- Fold existing visit-level tools into the workspace:
  - timeline
  - inspection
  - estimate
  - photos
  - notes
  - billing context
  - parts blockers
  - inventory or supply context
  - communications

### Route impact

- Add `/dashboard/visits/[visitId]` or equivalent visit workspace route
- Keep current deep job routes as transitional targets
- Deep routes should start redirecting into workspace tabs once parity exists

### Implementation surface

- current job detail route
- current estimate workspace
- current inspection, photos, invoice, parts, and inventory visit routes

### Dependencies

- Milestone 27 visits queue and drawer

### Acceptance criteria

- Opening a visit gives the user one stable workspace instead of a menu of artifact pages
- Estimate, inspection, photos, and invoice review can be reached without leaving the visit shell
- Full-page artifact hopping is materially reduced

## Milestone 29: Dispatch And Visit Convergence

### Goal

Make dispatch and visits feel like one operating system instead of adjacent modules.

### Product changes

- Connect dispatch selection directly to visit drawer and visit workspace
- Add stronger dispatch next actions:
  - assign best tech
  - suggest same-day insertions
  - surface late-stop updates
  - reveal approvals blocking route release
- Make dispatch the default live-hours command center for dispatcher roles

### Route impact

- No major new route expansion required
- Dispatch should deep-link into visit drawer and workspace reliably

### Implementation surface

- `apps/web/app/dashboard/dispatch/page.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx`
- current dispatch quick-edit and operations rail components
- visits drawer integration points

### Dependencies

- Milestone 27 visits queue and drawer
- Milestone 28 persistent visit workspace

### Acceptance criteria

- Dispatch selection preserves visit context instead of sending users into separate detail pages
- Dispatchers can resolve most route and stop issues without leaving Dispatch
- Visit status, estimate state, and customer timing context are visible from Dispatch

## Milestone 30: Customer Relationship Workspace Consolidation

### Goal

Turn customers into one relationship workspace and demote customer vehicles from being a primary peer module.

### Product changes

- Keep `Customers` as the relationship workspace
- Move customer vehicles into the customer workspace as a first-class tab and sub-registry
- Make customer overview emphasize:
  - active visits
  - approvals waiting
  - unpaid balance
  - recent communication
  - next booked work

### Route impact

- Keep vehicle profile routes as needed
- Demote `/dashboard/customer-vehicles` from primary nav
- Route registry usage toward customer workspace first

### Implementation surface

- `apps/web/app/dashboard/customers`
- `apps/web/app/dashboard/customer-vehicles`
- customer workspace routing helpers and vehicle profile links

### Dependencies

- Milestone 26 shell and IA reset

### Acceptance criteria

- Customer work no longer feels split between `Customers` and `Customer Vehicles`
- Vehicle selection stays inside the relationship workflow instead of ejecting the user into a separate module
- Customer overview is operational, not just descriptive

## Milestone 31: Fleet Capacity System Consolidation

### Goal

Merge fleet, fleet vehicles, and team into one field-capacity system.

### Product changes

- Keep `Fleet` as the top-level area
- Move `Units`, `Team`, and `Readiness` into Fleet tabs or views
- Maintain strict separation from customer vehicles
- Make map-first exception handling the default

### Route impact

- Demote `/dashboard/fleet-vehicles`
- Demote `/dashboard/team`
- Keep detail routes only where needed for deep unit or technician context

### Implementation surface

- `apps/web/app/dashboard/fleet`
- `apps/web/app/dashboard/fleet-vehicles`
- `apps/web/app/dashboard/team`

### Dependencies

- Milestone 29 dispatch and visit convergence

### Acceptance criteria

- Office users no longer need to choose between Fleet, Fleet Vehicles, and Team to understand capacity
- Fleet supports live position, readiness, and workforce context from one system

## Milestone 32: Supply Consolidation

### Goal

Unify parts and inventory into one operational supply area.

### Product changes

- Introduce `Supply` as the office sourcing and stock area
- Keep subviews for:
  - requests
  - quotes
  - orders
  - inventory
  - transfers
  - suppliers
- Surface visit-level supply blockers back into Visits and Dispatch

### Route impact

- Add `/dashboard/supply`
- Keep `/dashboard/parts` and `/dashboard/inventory` as transitional routes or subroutes

### Implementation surface

- `apps/web/app/dashboard/parts`
- `apps/web/app/dashboard/inventory`
- visit workspace and dispatch blockers integration

### Dependencies

- Milestone 28 persistent visit workspace

### Acceptance criteria

- Supply functions as one desk, not two adjacent modules
- Parts blockers are visible from the visit lifecycle, not trapped in a separate admin surface

## Milestone 33: Finance Consolidation

### Goal

Rebuild invoices into a proper finance follow-through workspace.

### Product changes

- Introduce `Finance` as the top-level billing and collections area
- Group queues by follow-through state:
  - ready to invoice
  - draft invoices
  - unpaid
  - partial payments
  - overdue
  - paid
- Keep linked visit and customer context visible while collecting

### Route impact

- Add `/dashboard/finance`
- Keep `/dashboard/invoices` as transitional route or redirect

### Implementation surface

- `apps/web/app/dashboard/invoices`
- visit workspace billing tabs and finance links

### Dependencies

- Milestone 28 persistent visit workspace

### Acceptance criteria

- Invoice release and payment collection happen in a dedicated follow-through workspace
- Finance feels tied to visit context rather than detached from operations

## Milestone 34: Secondary Surface Cleanup

### Goal

Clean up the remaining secondary surfaces after the main operational model is in place.

### Product changes

- Reframe `Today Brief` as a role-specific summary surface
- Reduce `Reports` to a secondary analytics library until it is deep enough
- Keep `Settings` shallow and grouped by operational domain
- Remove or redirect redundant legacy entry points

### Dependencies

- Milestones 26 through 33

### Acceptance criteria

- The product feels like one coherent system
- Secondary areas no longer compete with live operations for primary attention

## Cross-cutting workstreams

These workstreams span multiple milestones and should be tracked continuously.

### Workstream A: Product language migration

- replace `jobs` with `visits` in primary office UI
- preserve backward-compatible route handling during migration
- ensure mobile technician language stays clear and consistent

### Workstream B: Drawer and split-pane standardization

- standardize right-drawer interaction model
- standardize split-pane page scaffolds
- remove repeated hero plus metrics plus rail layouts where not needed

### Workstream C: Next best action logic

- visit next action
- dispatch next action
- approval follow-up prompts
- billing follow-through prompts
- route exception prompts

### Workstream D: Saved views and power-user speed

- saved queue views
- saved dispatch views
- keyboard shortcuts
- command palette

### Workstream E: Migration and redirects

- keep old routes functional while new surfaces land
- add explicit redirects once parity exists
- avoid breaking bookmarked operational routes until replacement paths are stable

## Recommended implementation order inside the codebase

1. Shell and nav reset
2. Visits route and queue
3. Visits drawer hardening
4. Visit workspace shell
5. Dispatch integration into visit context
6. Customer consolidation
7. Fleet consolidation
8. Supply and finance consolidation
9. Legacy route cleanup

## Suggested route migration sequence

### First wave

- `/dashboard/visits`
- `/dashboard/finance`
- `/dashboard/supply`

These can initially reuse current page internals with lighter IA changes.

### Second wave

- `/dashboard/visits/[visitId]`

This is the real structural pivot.

### Third wave

- legacy job artifact routes redirect into visit workspace tabs

Examples:

- job detail -> visit timeline
- estimate -> visit estimate tab
- invoice -> visit billing tab
- inspection -> visit inspection tab
- photos -> visit photos tab

## Exit criteria by phase

### Exit criteria for shell reset

- primary nav reduced
- role-based home in place
- renamed product language visible

### Exit criteria for visits phase

- queue default
- drawer default
- reduced dependence on full job page

### Exit criteria for visit workspace phase

- estimate, inspection, photos, notes, and billing reachable inside one shell
- legacy deep routes no longer required for common work

### Exit criteria for dispatch convergence

- dispatch selection preserves visit context
- dispatch is the clear live-hours command center

### Exit criteria for consolidation phases

- customer vehicles no longer behave as a peer top-level product area
- fleet vehicles and team no longer behave as separate primary modules
- parts and inventory no longer feel disconnected
- invoices no longer behave as a narrow static queue

## Risks to actively avoid

- shipping only naming changes without structural changes
- preserving too many legacy pages because they already exist
- continuing to add feature depth to deprecated peer modules
- rebuilding visuals without reducing workflow fragmentation
- keeping the board metaphor as the center of Visits when the queue is operationally faster

## Immediate next tasks

When implementation begins, the first ticket set should cover:

1. New primary nav structure and labels
2. Transitional route aliases for `visits`, `finance`, and `supply`
3. Role-based home routing
4. Visits queue default view
5. Visits drawer action hardening

## Working rule

If a decision trades off between preserving old route structures and preserving operational context, preserve operational context.
