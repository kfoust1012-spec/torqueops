# Mobile Mechanic V2 Operations IA And Wireframes

This document is the future-state product architecture brief for the office web application.

Implementation companion:

- [v2-implementation-plan.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-implementation-plan.md)

It is not a visual polish note.

It is the execution spec for turning the current feature-rich office product into a dispatch-led, visit-centric operating system for a mobile mechanic business.

## Why this exists

The current product already covers major capability areas:

- dispatch
- jobs
- estimates
- invoices
- customers
- customer vehicles
- fleet
- fleet vehicles
- team
- parts
- inventory

The problem is not missing modules.

The problem is that the system still behaves too much like a set of related modules instead of one coherent field-service operations platform. Office users still cross too many page boundaries to complete one real-world visit lifecycle.

This spec defines the next architecture:

- fewer top-level modules
- dispatch as the command center
- visits as the core operational object
- customer and vehicle context preserved across work
- fewer full-page hops
- more split-pane and drawer-based workflows
- stronger role-based starting points

## Product stance

The office product should evolve into:

- a dispatch-led operations cockpit
- a visit-centric workflow system
- a relationship-aware customer workspace
- a map-aware field-capacity system
- a premium but dense SaaS workspace

It should feel closer to:

- Shopmonkey for workflow clarity and scanability
- field-service dispatch software for route and capacity logic
- Tekmetric for denser estimate and admin workspaces

It should not feel like:

- generic admin software
- a collection of CRUD categories
- a polished dashboard shell wrapped around many separate destinations

## Core principles

1. The visit is the operational center of gravity.
2. Dispatch is the live control surface for office operations.
3. Customer context and vehicle context should remain nearby during execution.
4. Customer-owned vehicles and company-owned fleet units must remain visibly separate.
5. Full-page navigation should be the exception, not the default.
6. The next best action should be obvious from the current workspace.
7. Different roles should not share the same default home.

## Canonical objects

### Visit

The operational work object.

Contains or references:

- customer
- customer vehicle
- concern
- technician assignment
- schedule promise
- status
- inspection
- estimate
- photos
- invoice
- parts blockers
- inventory or supply dependencies
- customer communications

### Customer

The relationship object.

Contains or references:

- contact data
- preferred channel
- active visits
- customer vehicles
- service history
- messages
- billing exposure

### Customer vehicle

Customer-owned service asset.

Contains or references:

- ownership
- VIN
- mileage
- active concerns
- recent visits
- recommendations
- inspection and photo history

### Fleet unit

Company-owned van or field asset.

Contains or references:

- assigned technician
- route state
- readiness
- maintenance risk
- van stock
- live position

## V2 top-level sitemap

The primary office navigation should be reduced to:

1. `Dispatch`
2. `Visits`
3. `Customers`
4. `Fleet`
5. `Supply`
6. `Finance`

The following should be secondary or utility-level destinations:

- `Today Brief`
- `Reports`
- `Settings`

## Role-based entry points

### Dispatcher

Default home:

- `Dispatch`

Primary concerns:

- today’s routes
- open capacity
- late stops
- unassigned work
- reassignment
- customer timing updates

### Service advisor or estimator

Default home:

- `Visits`

Primary concerns:

- intake cleanup
- customer context
- estimate production
- approval follow-up
- scheduling readiness
- invoice handoff

### Owner or manager

Default home:

- `Today Brief`

Primary concerns:

- urgent exceptions
- throughput
- approvals waiting
- money waiting
- field readiness

### Technician mobile user

Default home:

- `My Work`

Primary concerns:

- current assignment
- inspection
- photos
- notes
- job status progression

## Primary navigation model

### Dispatch

Purpose:

- live route control
- lane ownership
- same-day insertion
- reassignment
- capacity balancing
- exception handling

Subviews:

- live board
- map plus lanes
- capacity
- exceptions
- saved views

### Visits

Purpose:

- intake
- readiness
- assignment staging
- approval follow-up
- active visit oversight
- billing handoff

Subviews:

- active queue
- board
- awaiting approval
- ready for dispatch
- live today
- ready to invoice
- closed search

### Customers

Purpose:

- relationship management
- service history
- communications
- customer vehicle access
- active work and billing context

Subviews:

- overview
- vehicles
- history
- messages
- billing

### Fleet

Purpose:

- live map
- route health
- field capacity
- fleet readiness
- unit and technician visibility

Subviews:

- live map
- units
- team
- readiness
- route exceptions

### Supply

Purpose:

- parts demand
- sourcing
- supplier routing
- inventory control
- transfers
- stock availability

Subviews:

- requests
- quotes
- orders
- inventory
- transfers
- suppliers

### Finance

Purpose:

- invoice release
- collections
- payment visibility
- revenue follow-through

Subviews:

- ready to invoice
- draft invoices
- sent unpaid
- partial payments
- overdue
- paid

## Secondary navigation model

### Today Brief

Purpose:

- high-level daily brief for owners and managers

Should answer:

- what is urgent
- what is blocked
- what is waiting approval
- what money is waiting
- what field readiness issue needs intervention

### Reports

Purpose:

- focused reporting library

Should not be top-level until it contains:

- saved reports
- favorites
- operational drill-downs
- export and comparison workflows

### Settings

Purpose:

- workflow-specific configuration

Should stay shallow and grouped by operational domain:

- dispatch
- suppliers
- inventory locations
- communications
- company settings

## Structural rules

### What remains top-level

Keep top-level only when a module supports a distinct operator goal that cannot be handled as a tab, drawer, or subview.

### What becomes a tab

Use tabs when the user is still within the same primary object:

- customer overview, vehicles, history, messages, billing
- fleet live map, units, team, readiness
- finance queue states

### What becomes a drawer

Use right drawers for:

- visit details
- customer quick context
- vehicle quick context
- estimate summary
- invoice summary
- technician quick context
- communications history

### What becomes split-pane

Use split-pane layouts for:

- dispatch
- visits
- customers
- supply

### What should stop being full-page

These should stop feeling like separate destinations whenever possible:

- job detail
- estimate summary
- invoice summary
- photos summary
- assignment editor
- customer quick inspection

## Canonical workspace patterns

### Pattern 1: Queue plus drawer

Use for:

- visits
- finance
- customer vehicle registry

Layout:

- center queue or list
- right drawer on selection
- no permanent separate detail page required for routine review

### Pattern 2: Split-pane operations workspace

Use for:

- dispatch
- customers
- supply

Layout:

- left scope or queue
- center primary work canvas
- right contextual drawer or rail

### Pattern 3: Persistent object workspace

Use for:

- visit workspace
- estimate workspace

Layout:

- top context strip
- center main canvas
- right utility rail
- subtools layered inside one shell

## Wireframe concepts

The following are text wireframes for the main v2 screens.

## V2 screen: Today Brief

### Purpose

Daily operational summary for owner and manager roles.

### Layout

Top row:

- urgent exceptions
- approvals waiting
- money waiting
- capacity issues

Center:

- live dispatch snapshot
- today’s active visits

Right rail:

- top blockers
- stale approvals
- late jobs
- readiness issues

Bottom:

- upcoming tomorrow
- collections follow-up

### Rules

- no decorative charts by default
- every block must open a working queue
- keep it compact

## V2 screen: Dispatch

### Purpose

Primary office command center during operating hours.

### Layout

Top command bar:

- date
- view mode
- saved view
- capacity counts
- late count
- route-risk count
- unassigned count
- quick create

Left rail:

- unassigned visits
- unscheduled visits
- same-day opportunities

Center canvas:

- day lanes by technician
- optional map overlay or split map mode
- drag and drop scheduling

Right drawer on selection:

- visit summary
- customer and vehicle
- promise window
- tech assignment
- estimate status
- send customer update
- reassign
- reschedule
- open full visit workspace

Bottom or secondary strip:

- suggested same-day insertions
- route exceptions

### Dispatch modes

1. Lane mode
2. Map plus lane mode
3. Capacity mode
4. Exceptions mode

### Required quick actions

- assign technician
- set or change arrival window
- mark delayed
- send update
- move to tomorrow
- open visit workspace

## V2 screen: Visits

### Purpose

Unified operations queue for intake through billing handoff.

### Layout

Top bar:

- search
- saved view
- owner filter
- tech filter
- readiness filter
- quick create
- board or queue toggle

Main queue groups:

- Intake blockers
- Needs assignment
- Needs time promise
- Ready for dispatch
- Live today
- Ready to invoice

Right drawer:

- visit snapshot
- customer
- vehicle
- next best action
- add note
- call or text customer
- open estimate
- open invoice
- assign tech
- set schedule

### Alternate views

- compact queue default
- board optional
- billing-focused list

### Rules

- queue is default
- board is optional
- drawer opens first
- full visit workspace opens only when deeper work is needed

## V2 screen: Visit Workspace

### Purpose

The main deep-work environment for one service visit.

This replaces the current stack of separate job subpages.

### Layout

Context strip:

- visit title
- customer
- customer vehicle
- status
- tech
- promise window
- estimate state
- invoice state
- next action

Main canvas tabs:

1. Timeline
2. Inspection
3. Estimate
4. Photos
5. Notes

Right utility rail tabs:

1. Customer
2. Billing
3. Parts
4. Inventory
5. Communications

Sticky action bar:

- assign or reassign
- schedule
- send estimate
- send update
- issue invoice
- collect payment

### Rules

- stay inside this shell for most visit work
- avoid sending the user to separate full pages for artifacts
- estimate editing should happen in-place or in an internal submode

## V2 screen: Estimate Workspace

### Purpose

Focused production surface for building and revising estimates.

### Layout

Left rail:

- templates
- canned jobs
- labor guide
- packages

Center canvas:

- estimate sections
- line items
- inline editing
- drag reorder

Right rail:

- supplier offers
- manual quotes
- totals
- notes
- approval and send

### Rules

- this is the only true estimate editing surface
- the estimate queue page only manages queue state
- no duplicate edit patterns for the same estimate lifecycle

## V2 screen: Customers

### Purpose

Relationship workspace, not static profile storage.

### Layout

Left registry:

- customer search
- saved segments
- recent customers
- relationship risk slices

Center workspace header:

- preferred contact
- active visits
- approvals waiting
- unpaid balance
- last service
- next booked work

Center tabs:

1. Overview
2. Vehicles
3. History
4. Messages
5. Billing

Right drawer:

- quick actions
- add vehicle
- new visit
- new estimate
- edit customer
- recent comms

### Rules

- active work and money should surface before passive record detail
- vehicle selection should not eject the user into another major section

## V2 screen: Fleet

### Purpose

Map-first field capacity and readiness system.

### Layout

Top command bar:

- date
- visible team or unit scope
- route exceptions
- late stops
- GPS offline
- waiting work

Center:

- live map

Bottom roster or side roster:

- urgency-sorted units
- current stop
- next stop
- route health
- GPS state
- open capacity

Right inspector:

- selected unit or technician
- route timeline
- readiness
- message or call
- open in dispatch

### Tabs

1. Live map
2. Units
3. Team
4. Readiness

## V2 screen: Supply

### Purpose

Unified desk for sourcing and inventory control.

### Layout

Top bar:

- demand waiting
- uncovered lines
- carts
- orders
- low-stock alerts

Left or center queue:

- requests
- quotes
- orders

Right rail:

- supplier context
- item availability
- transfer recommendation
- linked visits waiting on supply

Inventory subview:

- denser table format
- stock lookup
- location balances
- transfer board

### Rules

- supply blockers must surface back into visits and dispatch
- this cannot be the only place where parts problems are visible

## V2 screen: Finance

### Purpose

Collections and invoice release workflow.

### Layout

Top queue summary:

- ready to invoice
- draft invoices
- unpaid
- partial payments
- overdue

Center queue:

- grouped by follow-through state

Right drawer:

- invoice snapshot
- payment history
- linked visit
- customer contact
- reminder actions

### Rules

- optimize for release and collection speed
- keep customer and visit context visible while collecting

## Route migration map

### Current top-level routes to keep as primary

- `/dashboard/dispatch`
- `/dashboard/customers`
- `/dashboard/fleet`

### Current top-level routes to rename or reframe

- `/dashboard/jobs` -> `/dashboard/visits`
- `/dashboard/parts` + `/dashboard/inventory` -> `/dashboard/supply`
- `/dashboard/invoices` -> `/dashboard/finance`
- `/dashboard` -> `/dashboard/today` or role-based entry

### Current top-level routes to demote from primary nav

- `/dashboard/customer-vehicles`
- `/dashboard/fleet-vehicles`
- `/dashboard/team`
- `/dashboard/reports`
- `/dashboard/settings`

### Current deep visit routes to collapse into visit workspace

- job detail
- estimate summary
- estimate edit
- estimate workspace bootstrap
- invoice summary
- invoice edit
- inspection
- photos
- parts
- inventory
- edit

These can still exist during migration, but they should be treated as transitional implementation routes rather than the final product model.

## Ruthless removal rules

Remove or merge anything that:

- duplicates context already visible elsewhere
- exists only because of the database model
- forces a page hop for a routine action
- promotes a registry to first-class nav without daily operational value
- uses a full page where a drawer or tab would be faster

## Implementation phases

### Phase 1: Shell and IA reset

- reduce primary navigation
- add role-based home routing
- rename Jobs to Visits in product language
- demote secondary registries from primary nav

### Phase 2: Visit-centric workflow reset

- build visit queue
- add visit drawer
- define persistent visit workspace shell
- reduce cross-page artifact hopping

### Phase 3: Dispatch and visit convergence

- connect dispatch selection to visit drawer and workspace
- add same-day insertion logic
- add next best action logic
- add customer update prompts

### Phase 4: Customer workspace consolidation

- merge customer and customer vehicle work into one relationship system
- keep separate vehicle registry as a lookup mode only

### Phase 5: Fleet consolidation

- merge fleet, fleet vehicles, and team into one field-capacity system

### Phase 6: Supply and finance consolidation

- unify parts and inventory into supply
- rebuild invoices into finance follow-through

## Acceptance criteria

The redesign is on track when the office user can:

- move a visit from intake to dispatch without opening multiple full pages
- quote work without losing customer, vehicle, and visit context
- see route, technician, and customer context from dispatch without page hopping
- manage customer relationships without bouncing between customer and vehicle modules
- review supply blockers from the visit and dispatch surfaces
- issue and collect invoices while keeping visit context visible

## Working rule

When a redesign decision is ambiguous, choose the option that:

1. preserves visit context
2. reduces page changes
3. keeps dispatch as the live control system
4. separates customer assets from company assets
5. makes the next operational move obvious
