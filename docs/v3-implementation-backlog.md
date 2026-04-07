# Mobile Mechanic V3 Implementation Backlog

This document turns the V3 product strategy into an execution sequence.

Companion docs:

- [v3-operations-architecture-and-workflow-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-operations-architecture-and-workflow-spec.md)
- [v2-implementation-plan.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-implementation-plan.md)
- [v2-milestone-26-27-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-milestone-26-27-engineering-tickets.md)

This backlog is intentionally biased toward structural simplification.

It is not a styling backlog.

It is an operating-model backlog.

## Program outcome

Ship an office product where:

- Dispatch is the live command center
- Visits is the canonical production queue and workspace
- Estimates behaves as a support mode inside Visits
- Customers preserves relationship and vehicle continuity
- Fleet owns map-first field capacity and technician readiness
- Supply and Finance operate as unblock and closeout desks
- routine work is completed with fewer route changes and fewer separate page identities

## Delivery rules

1. Every milestone must reduce fragmentation, not just move labels around.
2. Do not add new top-level operational destinations.
3. Prefer wrappers, redirects, tabs, drawers, and split panes over creating fresh full-page trees.
4. Do not blur customer-owned vehicles with company-owned fleet units.
5. Dispatch board real estate must remain protected during every pass.
6. Estimate production must move closer to the visit thread, never farther away.

## Milestone 30: V3 Shell and route-model finish

### Goal

Finish the shell-level product model so the app no longer exposes legacy module sprawl as the default experience.

### Product changes

- Lock primary navigation to:
  - `Dispatch`
  - `Visits`
  - `Customers`
  - `Fleet`
  - `Supply`
  - `Finance`
- Move `Estimates` out of peer-shell treatment.
- Move `Customer vehicles`, `Fleet vehicles`, and `Team` fully into parent workspaces.
- Standardize role-based landing behavior.

### Route impact

- keep current routes live during migration
- remove remaining shell framing that still makes demoted modules look primary
- finish transitional alias strategy where old routes remain reachable but clearly secondary

### Implementation surface

- shell nav config
- dashboard shell layouts
- role-based dashboard entry behavior
- workspace entry links from Today Brief, Dispatch, Customers, Fleet, Supply, and Finance

### Acceptance criteria

- operators no longer see a peer-shell `Estimates` identity in the main navigation model
- parent workspaces own entry to vehicles, units, and team views
- role defaults are consistent and visible

## Milestone 31: Visits queue and estimate-support convergence

### Goal

Make Visits the default production desk and demote Estimates into a support mode.

### Product changes

- Visits queue remains the primary advisor workspace
- estimate support becomes a view or scoped mode inside Visits
- stale approval, drafting, approved-release, and quote follow-up all open in visit context first
- shared queue model drives both visit production and estimate follow-through

### Route impact

- preserve `/dashboard/estimates` during migration as a compatibility desk
- route new estimate-support entry points through Visits
- keep deep estimate workspace routes reachable while reducing their standalone feeling

### Implementation surface

- Visits page and queue controls
- estimate-support desk
- visit estimate artifact cards and routing helpers
- Today Brief and Dispatch handoff links

### Acceptance criteria

- the operator no longer has to mentally leave Visits to continue estimate work
- estimate queue scopes preserve the selected visit context
- the app treats estimate work as visit production, not as a sibling admin module

## Milestone 32: Persistent visit workspace

### Goal

Replace the current visit-related subpage stack with one stable workspace shell.

### Product changes

- create one visit workspace with:
  - context strip
  - main canvas
  - utility rail
- move estimate, inspection, photos, supply, invoice, notes, and communication review into one shell
- preserve direct deep links while routing routine review back into workspace tabs or rails

### Route impact

- keep `/dashboard/visits/[jobId]` as the canonical persistent workspace
- progressively downgrade deep artifact routes into redirect or shell-tab entry points

### Implementation surface

- visit workspace shell
- visit detail route tree
- estimate workspace integration
- inspection, photos, parts, inventory, and invoice subpages

### Acceptance criteria

- one visit thread can be reviewed end-to-end without bouncing across separate page identities
- artifact review does not routinely eject the operator from visit context
- drawer and tab behavior replace a meaningful amount of full-page artifact navigation

## Milestone 33: Dispatch and Visits operating-system convergence

### Goal

Make Dispatch and Visits feel like two modes of the same system instead of adjacent desks.

### Product changes

- release-to-dispatch is visible directly from Visits
- lane review opens visit context directly from Dispatch
- dispatch recovery actions can move a visit back to readiness without awkward route shifts
- dispatch backlog, live board, and readiness queue use shared language for ownership, promise quality, and blockers

### Route impact

- minimize direct route jumps from Dispatch to deep visit artifact pages
- preserve dispatch return paths into relevant visit scopes

### Implementation surface

- dispatch command center
- dispatch operations rail
- visits queue and drawer
- Today Brief launch actions

### Acceptance criteria

- dispatchers can inspect, replan, message, and recover a visit from the board without excessive page hopping
- advisors can release a visit into dispatch from the same production thread
- dispatch and visits share one clear operational language

## Milestone 34: Customer and vehicle relationship consolidation

### Goal

Make Customers the relationship workspace and remove separate mental-model weight from customer vehicles.

### Product changes

- Customers owns:
  - overview
  - vehicles
  - history
  - messages
  - billing
- customer vehicle quick context opens inline from customer or visit surfaces
- active visits and unpaid exposure become first-class in the customer workspace

### Route impact

- keep `/dashboard/customer-vehicles` only as compatibility entry
- route regular vehicle review into Customers workspace modes

### Implementation surface

- customers workspace shell
- customer service history panels
- customer vehicle forms and selectors
- visit and estimate customer-context links

### Acceptance criteria

- customer and customer-vehicle context remain together during support work
- customer workspace supports action, not just record viewing
- separate customer-vehicle route identity no longer carries day-to-day product weight

## Milestone 35: Fleet, units, and team consolidation

### Goal

Turn Fleet into the single field-capacity workspace.

### Product changes

- Fleet becomes map-first and exception-first
- units and team become internal workspace modes
- readiness, route drift, GPS health, and van support issues become the dominant organizational logic

### Route impact

- keep `/dashboard/fleet-vehicles` and `/dashboard/team` only as secondary compatibility paths
- route normal navigation through Fleet tabs or panels

### Implementation surface

- fleet workspace
- fleet live map
- readiness, team, and unit panels
- fleet launch links from Dispatch and Today Brief

### Acceptance criteria

- the field-capacity system reads as one workspace
- unit and technician views no longer look like separate primary modules
- exception-first ordering replaces neutral profile-first listing

## Milestone 36: Supply and Finance desk completion

### Goal

Finish the support desks so they clearly exist to unblock and close visits.

### Product changes

- Supply emphasizes blocked work, sourcing urgency, and stock availability
- Finance emphasizes invoice release, reminders, aged risk, and payment follow-through
- both desks open back into visit context cleanly

### Route impact

- keep old `parts`, `inventory`, and `invoices` routes only as compatibility surfaces
- standardize parent-desk routing to `/dashboard/supply` and `/dashboard/finance`

### Implementation surface

- supply workspace pages and tabs
- finance workspace page and queues
- visit-side artifact summaries and support actions

### Acceptance criteria

- support desks feel subordinate to the visit lifecycle rather than detached back-office modules
- blocked work and money waiting are actionable from their desks and from visit context

## Milestone 37: Interaction and automation acceleration

### Goal

Increase power-user speed after the structural model is in place.

### Product changes

- saved views for high-frequency queues
- keyboard shortcuts for jump, assign, remind, and replan actions
- guided flows for intake, estimate send, dispatch release, closeout, and revisit creation
- smarter defaults for technician assignment and same-day insertion candidates

### Acceptance criteria

- experienced users can move faster without increasing cognitive overhead for new users
- the product surfaces next-best actions more often than it asks users to decide where to go next

## Milestone 38: Visual hierarchy and density finish

### Goal

Finish the product so it feels premium because it is operationally sharp.

### Product changes

- compress desk chrome
- reduce surface repetition
- reduce badge and pill overuse
- make central work canvases dominant
- use exception styling more sparingly and more precisely

### Acceptance criteria

- the product feels calmer, denser, and more expensive without becoming vague or sparse
- urgent work stands out clearly from passive information

## Backlog priority order

1. Milestone 30: V3 shell and route-model finish
2. Milestone 31: Visits queue and estimate-support convergence
3. Milestone 32: Persistent visit workspace
4. Milestone 33: Dispatch and Visits operating-system convergence
5. Milestone 34: Customer and vehicle relationship consolidation
6. Milestone 35: Fleet, units, and team consolidation
7. Milestone 36: Supply and Finance desk completion
8. Milestone 37: Interaction and automation acceleration
9. Milestone 38: Visual hierarchy and density finish

## Definition of success

This backlog succeeds when the app stops feeling like several smart modules and starts feeling like one field-service operating system.