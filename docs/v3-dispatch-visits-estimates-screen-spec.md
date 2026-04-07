# V3 Dispatch, Visits, And Estimates Screen Spec

This document defines the target screen behavior for the highest-leverage part of the office product.

Scope:

- Dispatch
- Visits
- Estimate production and estimate support

Companion docs:

- [v3-operations-architecture-and-workflow-spec.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-operations-architecture-and-workflow-spec.md)
- [v3-route-consolidation-engineering-tickets.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v3-route-consolidation-engineering-tickets.md)
- [shopmonkey-visual-alignment-audit-2026-03-22.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/shopmonkey-visual-alignment-audit-2026-03-22.md)

This is not a high-level philosophy note.

It is a screen-behavior spec.

## Core product rule

Dispatch, Visits, and Estimates are not three separate products.

They are three operational modes of one service thread.

The UI should express that explicitly.

## Shared visual rules

1. The main canvas must dominate the screen.
2. Header chrome must stay compact.
3. Filters must attach to the active workspace, not float above it as a separate layer.
4. Right-side rails should show context and action, not become a second page.
5. The same visit should be able to move across all three desks without losing context.
6. Badges and pills should be reduced to high-signal cases only.

## Screen 1: Dispatch command center

### Purpose

Own live lane placement, recovery, same-day insertion, and field communication.

### Primary user

Dispatcher.

### Top structure

Top strip:

- small workspace title
- date context
- saved view selector
- lane scope
- compact queue counters
- compact utilities only

Rules:

- no oversized hero header
- no descriptive copy blocks once the user is already in the desk
- toolbar height should be aggressively protected

### Main layout

Left support column:

- saved views
- release-ready queue
- unassigned backlog
- same-day insert candidates
- high-risk exceptions

Center canvas:

- live lane board by default
- optional map or week mode toggle
- lane headers remain compact and readable
- board stays visually dominant

Right rail:

- selected lane or technician header
- selected visit quick context
- action dock
- communication actions
- exception summary

### Dispatch interaction rules

- selecting a lane item should not navigate away immediately
- clicking a visit card opens a visit quick drawer first
- routine actions happen inline:
  - assign technician
  - reassign
  - send delay message
  - review promise risk
  - move back to readiness
- full-page visit open is secondary, not primary

### Dispatch watchlist behavior

The right-side list should stop acting like a roster.

It should sort by intervention value:

1. late or drifting lanes
2. open same-day capacity
3. no-GPS confidence failures
4. blocked or weak-promise visits

Each row should answer:

- why this matters now
- what the next action is
- whether the lane has spare capacity or needs recovery

### Dispatch wireframe

```text
+--------------------------------------------------------------------------------------+
| Dispatch | Mon Mar 23 | Saved view | 6 lanes | Queue 8 | Conflicts 4 | Controls      |
+--------------------------------------------------------------------------------------+
| Saved scopes      | Lane board / map toggle / day-week control                      |
| Release ready     | +------------------------------------------------------------+ |
| Backlog           | | Lane A | Lane B | Lane C | Lane D | Lane E | Lane F       | |
| Insert candidates | | visit   visit    visit    visit    visit    visit          | |
| Promise risk      | | visit   visit    visit    gap      visit    visit          | |
|                   | +------------------------------------------------------------+ |
|                   |                                                                |
+-------------------+-----------------------------------------------+----------------+
| Queue cards / saved scopes                                        | Selected lane  |
|                                                                   | or visit rail  |
|                                                                   | quick actions  |
+-------------------------------------------------------------------+----------------+
```

## Screen 2: Visits production desk

### Purpose

Own intake, estimate production, approval follow-up, readiness, and closeout staging.

### Primary users

- service advisor
- estimator
- admin follow-through owner

### Main layout

Left column:

- saved scopes
- production filters
- queue mode selector
- estimate-support scopes
- readiness scopes
- billing follow-through scopes

Center canvas:

- queue first
- board optional
- selected visit workspace expands in place when needed

Right rail:

- operational focus summary
- customer and vehicle context
- communication thread summary
- blockers
- direct actions

### Visits queue rules

Queue is the default because office users need to move work, not admire workflow columns.

Every row should expose:

- customer and vehicle identity
- current stage
- next required move
- promise quality
- estimate or billing state if relevant
- blocker visibility
- primary action

Rows should sort by operational urgency, not by neutral chronology.

### Visits board rules

- board remains available for higher-level flow review
- board is secondary to the queue
- board headers must stay compact and non-editorial
- selected card opens context in place, not through a separate desk jump

### Visits selected-thread behavior

Opening a visit from the queue should not immediately launch a full-page detail page.

Preferred behavior:

- first open a right drawer or inline expanded panel
- from there allow:
  - estimate production
  - send approval
  - assign owner or technician
  - set promise
  - release to dispatch
  - open customer context

### Visits wireframe

```text
+--------------------------------------------------------------------------------------+
| Visits | Scope: Ready for dispatch | Search | Saved view | Queue mode               |
+--------------------------------------------------------------------------------------+
| Saved scopes      | Visit queue                                                   | |
| Needs intake      | +----------------------------------------------------------+ | |
| Drafting estimate | | row: customer / vehicle / stage / blocker / next move    | | |
| Awaiting approval | | row: customer / vehicle / stage / blocker / next move    | | |
| Ready dispatch    | | row: customer / vehicle / stage / blocker / next move    | | |
| Billing follow-up | +----------------------------------------------------------+ | |
|                   | Inline selected visit workspace or drawer when row active     | |
+-------------------+---------------------------------------------------------------+--+
| Operational focus / customer / vehicle / comms / blockers / next actions           |
+--------------------------------------------------------------------------------------+
```

## Screen 3: Estimate production workspace

### Purpose

Draft, revise, send, and release estimate work without losing visit context.

### Product rule

Estimate production is not a detached desk.

It is a production mode inside the visit thread.

### Layout

Top context strip:

- customer
- vehicle
- concern
- current visit stage
- estimate status
- trust or approval pressure

Left tools column:

- labor templates
- common symptom bundles
- repeat services
- historical recommendations
- likely parts

Center builder:

- editable line items
- sections
- subtotals
- notes
- totals and approval terms

Right support rail:

- service history
- photos or inspection context
- communication state
- send and reminder actions
- release-to-dispatch readiness indicator

### Estimate support queue mode

When opened as a queue view rather than a specific estimate builder, the desk should behave like a focused scope inside Visits.

Visible scopes:

- drafting
- awaiting approval
- stale approval
- approved release

Each queue item should answer:

- which visit this belongs to
- what stage the estimate is in
- what the next move is
- whether the customer thread is aging

### Estimate wireframe

```text
+--------------------------------------------------------------------------------------+
| Visit 1042 | Dana Foster | 2020 Honda Accord | Estimate draft | Ready for approval? |
+--------------------------------------------------------------------------------------+
| Templates / bundles | Estimate builder canvas                               | Rail |
| Repeat jobs         | +--------------------------------------------------+ | Hist |
| Likely parts        | | labor line                                        | | Comms|
| Recommendations     | | part line                                         | | Send |
|                     | | fee line                                          | | Risk |
|                     | | notes                                             | | Rel. |
|                     | +--------------------------------------------------+ |      |
+---------------------+------------------------------------------------------+------+
| Save draft | Send approval | Duplicate prior | Add bundle | Release when approved   |
+--------------------------------------------------------------------------------------+
```

## Cross-screen continuity rules

### Rule 1: Preserve the hot thread

If the user opened an estimate from a visit, the UI must preserve that visit context and provide a strong return path.

### Rule 2: Route changes are optional, not mandatory

Common decisions should happen inside the current desk through drawers, tabs, and inline actions.

### Rule 3: The next move must stay explicit

Every selected state in Dispatch, Visits, or Estimates should expose one clearly primary next action.

### Rule 4: Customer and vehicle context are always nearby

The user should never have to hunt across separate modules to answer basic thread questions.

### Rule 5: Recovery path must be direct

From Dispatch, a weak or blocked visit should route back into the correct Visits readiness scope, not a generic desk landing page.

## Responsive behavior

### Desktop

- full three-zone layout
- central canvas remains dominant
- right rail visible by default when space allows

### Tablet

- left scope collapses first into a toggle or drawer
- right rail becomes a slide-over panel
- central queue or board remains the default visible surface

### Mobile web or narrow office widths

- desk-specific compact mode only
- queue-first behavior takes priority over board mode
- drawers become full-height sheets
- preserve primary actions, not decorative summary layers

## Design failure conditions

The redesign is off-track if any of the following remain true:

- Dispatch has more visual emphasis on toolbar chrome than on the live board
- Visits still feels like a board-first status page instead of a production desk
- estimate work still reads like a detached module
- the user must page-hop to inspect customer, vehicle, or billing context during common work
- neutral summary cards consume more attention than the actual queue or board

## Success criteria

This screen strategy succeeds when:

- dispatchers can act from the live board with minimal route changes
- advisors can move from intake to estimate to readiness inside one thread
- estimate support feels like production work, not admin work
- users can keep customer and vehicle context nearby while moving quickly
- the product feels denser, calmer, and more premium because the hierarchy is sharper