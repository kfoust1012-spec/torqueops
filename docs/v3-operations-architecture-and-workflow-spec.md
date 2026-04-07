# Mobile Mechanic V3 Operations Architecture And Workflow Spec

This document turns the recent product critique into a concrete next-state product strategy.

It is not a UI moodboard.

It is a structural product spec for making the office product materially faster, clearer, more operational, and more premium.

Companion documents:

- [v2-operations-ia-and-wireframes.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-operations-ia-and-wireframes.md)
- [v2-implementation-plan.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-implementation-plan.md)
- [shopmonkey-visual-alignment-audit-2026-03-22.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/shopmonkey-visual-alignment-audit-2026-03-22.md)
- [fleet-ui-review-2026-03-21.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/fleet-ui-review-2026-03-21.md)

## Outcome this spec is driving

Ship a mobile mechanic operating system where:

- dispatch is the live command center
- visits are the canonical work object
- estimates are part of visit production, not a detached desk
- customer and vehicle context remain visible during execution
- fleet is a map-first field capacity workspace
- supply and finance act as unblock and closeout desks, not detached admin modules
- most daily work happens inside split workspaces, drawers, and contextual rails instead of full-page route changes

## Brutal product stance

The current product is already intelligent at the data and workflow-rule level.

The weakness is structural.

The product still behaves too much like a collection of polished modules:

- Dispatch
- Jobs or Visits
- Estimates
- Customers
- Customer Vehicles
- Fleet
- Fleet Vehicles
- Team
- Parts
- Inventory
- Invoices

That is too many nouns for one operating day.

The office product should stop presenting the business as software categories and instead present the business as live operational threads.

The product is not a set of records.

It is a system for moving one service thread from intake to cash with minimal navigation, minimal reorientation, and clear intervention points.

## Non-negotiable V3 rules

1. `Visit` is the primary operator-facing work object.
2. `Dispatch` is the default command center for live field operations.
3. `Estimate` is a visit-production tool, not a peer workspace to dispatch.
4. `Customer vehicle` and `fleet unit` remain visibly separate in both data model and UI model.
5. Full-page navigation is reserved for deep work, not routine review.
6. The next best action must be visible from every primary workspace.
7. Neutral information should never visually compete with urgent work.
8. Role-based defaults are required. One generic home is not acceptable.

## V3 sitemap

The office product should reduce to this top-level navigation:

1. `Dispatch`
2. `Visits`
3. `Customers`
4. `Fleet`
5. `Supply`
6. `Finance`

Secondary navigation:

1. `Today Brief`
2. `Reports`
3. `Settings`

Utility access only, not primary nav items:

- `Customer vehicles`
- `Fleet vehicles`
- `Team`
- standalone `Estimates`
- standalone `Invoices`
- standalone `Parts`
- standalone `Inventory`

## V3 role-based entry points

### Dispatcher

Default home:

- `Dispatch`

Primary concerns:

- live lanes
- route drift
- promise risk
- open capacity
- same-day insertion
- technician reassignment
- customer delay updates

### Service advisor or estimator

Default home:

- `Visits`

Primary concerns:

- intake cleanup
- estimate production
- approval follow-up
- readiness for dispatch
- customer communication
- invoice release handoff

### Owner or manager

Default home:

- `Today Brief`

Primary concerns:

- exceptions
- approvals waiting
- money waiting
- route failures
- technician readiness
- tomorrow risk

### Technician mobile user

Default home:

- `My Work`

Primary concerns:

- now
- next
- route timing
- customer access context
- inspection and photos
- parts blockers
- closeout steps

## V3 page-purpose model

### Dispatch

Purpose:

- live route control
- same-day insertion
- assignment and reassignment
- route recovery
- exception handling
- live customer timing updates

The user should be able to:

- assign or reassign a visit
- inspect visit context
- see promise risk
- see travel and route drift
- message the customer
- pull a visit back out of dispatch
- push a ready visit into a lane

without leaving the dispatch workspace.

### Visits

Purpose:

- intake
- estimate production
- approval follow-up
- readiness staging
- execution oversight
- closeout preparation

This should be the visit queue and visit workspace, not a second dispatch board.

### Customers

Purpose:

- relationship continuity
- active work visibility
- customer vehicle context
- service history
- communication thread
- billing exposure

This is not a CRM profile page.

It is the relationship workspace.

### Fleet

Purpose:

- map-first field visibility
- route health
- technician readiness
- fleet-unit readiness
- van stock and readiness exceptions

### Supply

Purpose:

- unblock work
- coordinate sourcing
- expose stock dependency
- manage carts, requests, orders, and transfers

### Finance

Purpose:

- release invoices
- collect money
- identify aged risk
- drive reminder follow-through

## Navigation rules

### What stays top-level

Only keep destinations that support a different operator goal.

### What becomes tabs

Use tabs when the user remains on the same object:

- customer overview, vehicles, history, messages, billing
- fleet live map, units, team, readiness
- finance queue states
- visit activity, estimate, inspection, photos, supply, invoice

### What becomes drawers

Use right-side drawers for routine review of:

- visit summary
- customer quick context
- vehicle quick context
- technician quick context
- estimate summary
- invoice summary
- communications thread

### What becomes split workspaces

Use split-pane layouts for:

- dispatch
- visits
- customers
- supply

### What should stop being full-page

These should no longer feel like separate destinations for common office work:

- estimate summary
- invoice summary
- customer quick review
- technician quick review
- assignment editing
- photos summary
- inspection summary

## V3 canonical workspace patterns

### Pattern 1: Queue plus drawer

Use for:

- finance
- support queues inside visits
- customer vehicle registry slices

Layout:

- left filters and saved views
- center queue
- right selection drawer

### Pattern 2: Split-pane operating desk

Use for:

- dispatch
- visits
- customers
- supply

Layout:

- left scope and queue
- center work canvas
- right contextual rail or drawer

### Pattern 3: Persistent object workspace

Use for:

- visit workspace
- estimate production workspace

Layout:

- top context strip
- center active canvas
- right utility rail
- internal tab or panel switching without route hopping

## Ideal visit lifecycle

The office product should support this exact operating sequence.

### 1. Intake

Operator goals:

- identify customer
- identify customer vehicle
- capture concern
- set urgency and likely visit type
- determine whether estimate is needed first

Required UI behavior:

- fast search-first intake
- create customer and vehicle inline if missing
- preserve customer and vehicle context immediately
- suggest repeat concerns or historical recommendations

### 2. Estimate production

Operator goals:

- price work quickly
- reuse known labor and parts patterns
- send approval without leaving context

Required UI behavior:

- estimate builder inside visit production
- labor templates
- repeat-job cloning
- likely-parts suggestions
- customer and vehicle context persistent on screen

### 3. Approval follow-up

Operator goals:

- monitor sent estimates
- identify stale approvals
- follow up without hunting for the record

Required UI behavior:

- approval queue inside Visits
- direct reminder actions
- support stage visible from visit queue and visit drawer

### 4. Ready-for-dispatch staging

Operator goals:

- confirm assignment readiness
- confirm schedule promise quality
- spot blockers before lane placement

Required UI behavior:

- readiness score or blocker strip
- route to dispatch action from the visit itself
- obvious visibility of parts blockers, inventory blockers, trust risk, and promise risk

### 5. Dispatch and field execution

Operator goals:

- assign technician
- insert into lane
- recover delays
- replan around drift
- keep customer updated

Required UI behavior:

- route board as primary canvas
- lane review drawer
- technician quick context
- customer update actions inline
- no forced page hop into a separate detail page for routine recovery work

### 6. On-site execution and artifact collection

Operator goals:

- inspection
- photos
- notes
- additional estimate if needed

Required UI behavior:

- artifact layers remain within visit workspace
- office users can inspect artifacts without changing primary context

### 7. Closeout and invoice release

Operator goals:

- confirm work completeness
- release invoice
- collect or remind

Required UI behavior:

- invoice state visible from visit workspace
- finance queue for release and collections
- one-click reminder actions from finance and visit context

### 8. Follow-up and revisit

Operator goals:

- monitor unresolved concerns
- create revisit fast
- preserve trust and history

Required UI behavior:

- revisit creation from visit or customer workspace
- service history and prior artifacts immediately accessible
- relationship context preserved

## Current-to-target route consolidation

The current route tree already shows improvement, but it still exposes too many concepts. The following table defines what should happen next.

### Keep and strengthen

- `/dashboard/dispatch`
  - keep as the live command center
- `/dashboard/visits`
  - keep as the canonical office production queue
- `/dashboard/customers`
  - keep as the relationship workspace
- `/dashboard/fleet`
  - keep as the field-capacity workspace
- `/dashboard/supply`
  - keep as the supply desk
- `/dashboard/finance`
  - keep as the collections and invoice desk

### Merge into parent workspaces

- `/dashboard/estimates`
  - demote from peer module into a support queue reachable from Visits
- `/dashboard/invoices`
  - merge into Finance and stop presenting as a peer module
- `/dashboard/customer-vehicles`
  - merge into Customers as a vehicles tab and context drawer
- `/dashboard/fleet-vehicles`
  - merge into Fleet as a units panel
- `/dashboard/team`
  - merge into Fleet as a technician and readiness panel
- `/dashboard/parts`
  - merge into Supply as sourcing and procurement views
- `/dashboard/inventory`
  - merge into Supply as stock and transfer views

### Shrink to workspace tabs or drawers

- `/dashboard/visits/[jobId]/estimate`
- `/dashboard/visits/[jobId]/estimate/workspace`
- `/dashboard/visits/[jobId]/inspection`
- `/dashboard/visits/[jobId]/photos`
- `/dashboard/visits/[jobId]/parts`
- `/dashboard/visits/[jobId]/inventory`
- `/dashboard/visits/[jobId]/invoice`

Target treatment:

- remain reachable for deep work during migration
- progressively redirect routine review into the visit workspace shell
- stop acting like separate product destinations

### Remove from operator mental model

- legacy `jobs` framing
- separate page identity for artifacts that belong to one visit thread
- separate “vehicles” destinations that obscure customer-owned versus company-owned asset boundaries

## Dispatch, Visits, and Estimates triangle

This is the highest-leverage product surface.

If this triangle is weak, the whole product feels fragmented.

If this triangle is strong, the product starts to feel elite.

### The core problem today

The current product still makes these feel like adjacent desks:

- Dispatch handles live placement
- Visits handles queue progression
- Estimates handles quote and approval states

That is one workflow presented as three destinations.

### Target operating model

The new model should be:

- Visits owns intake, estimate production, approval, readiness, and release to dispatch
- Dispatch owns lane placement, route execution, recovery, and live updates
- Estimate support exists as a filtered mode inside Visits, not as a primary peer product

### Dispatch target layout

Left column:

- saved views
- queue scopes
- release-ready visits
- unassigned backlog

Center canvas:

- live board
- map or lane switcher
- day and week views

Right rail:

- selected technician or lane summary
- selected visit quick context
- intervention dock
- customer update actions

High-value actions:

- assign
- reassign
- delay message
- replan
- open visit drawer
- move back to readiness

### Visits target layout

Left column:

- saved scopes
- active queue
- approval queue
- readiness queue
- billing follow-through queue

Center canvas:

- queue by default
- board optional
- selected visit workspace when opened

Right rail:

- operational focus
- customer and vehicle summary
- communications
- blockers

High-value actions:

- start estimate
- send approval
- assign owner
- set promise
- release to dispatch
- send reminder
- open customer context

### Estimate production target layout

Top context strip:

- customer
- vehicle
- concern
- visit readiness
- approval state

Left builder tools:

- labor templates
- repeat services
- likely parts
- historical recommendations

Center builder:

- estimate line items
- totals
- sections
- notes

Right support rail:

- service history
- photos or inspection context
- customer communication state
- send and follow-up actions

High-value actions:

- save draft
- send for approval
- duplicate from prior visit
- add recommended work bundle
- release approved work into dispatch readiness

## Interaction priorities

### Must become inline

- technician assignment
- promise window editing
- queue status changes
- note entry
- reminder actions
- customer delay updates

### Must become drawer-first

- visit review
- customer quick context
- vehicle quick context
- technician quick context
- invoice summary

### Must become guided flows

- new visit intake
- estimate send
- approved-to-dispatch handoff
- closeout
- revisit creation
- supply-blocked recovery

### Must get saved views

- ready for dispatch
- stale approvals
- same-day insert candidates
- supply blocked
- promise risk
- return visits
- ready to invoice
- overdue collections

### Must get keyboard support

- open command bar
- jump to visit
- assign technician
- open customer drawer
- send reminder
- send ETA update
- create revisit

## Visual and hierarchy requirements

The product should feel:

- cool, clean, and operational
- dense without being noisy
- premium because it is precise, not because it is decorative

Required changes:

- reduce header and card chrome on production desks
- reduce repeated badges and pills
- make the central canvas dominant
- use drawers and rails as support layers, not co-equal showcases
- make urgent states visually expensive and rare
- remove soft, equal-weight presentation across filters, board, and inspector layers

## Ruthless removal list

- no more new primary nav items
- no more peer treatment for Estimates, Invoices, Parts, Inventory, Team, or Vehicles
- no more separate-feeling pages for routine visit artifacts
- no more neutral summary cards above the real work surface when they do not change action
- no more mixed Jobs and Visits framing in active operator copy
- no more queue ordering that ignores urgency, promise risk, or operational cost

## Highest-impact sequence

1. Finish the nav and route-model consolidation around Dispatch, Visits, Customers, Fleet, Supply, and Finance.
2. Demote Estimates from peer desk to Visits support mode while preserving direct queue access.
3. Turn the visit detail tree into one persistent visit workspace with artifact tabs and utility rails.
4. Tighten Dispatch and Visits into one release-and-execution operating system.
5. Push Customer Vehicles, Fleet Vehicles, and Team fully into Customers or Fleet workspace modes.
6. Reduce visual chrome and hierarchy noise on all production desks.
7. Add saved views, shortcuts, and guided flows so expert users move faster without making novices lost.

## Acceptance criteria for V3 direction

This strategy is successful when:

- office users can move a visit from intake to dispatch with dramatically fewer route changes
- dispatchers can recover live work without opening full detail pages for routine context
- estimate work feels embedded in visit production rather than detached from it
- customer context remains nearby while work moves
- fleet reads as map-first and exception-first
- supply and finance clearly support the visit lifecycle instead of living beside it
- the product feels calmer and more premium while actually showing more useful work at once