# V2 Milestones 26-27 Engineering Tickets

This document turns the first two v2 milestones into concrete engineering tickets.

Companion docs:

- [v2-operations-ia-and-wireframes.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-operations-ia-and-wireframes.md)
- [v2-implementation-plan.md](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/docs/v2-implementation-plan.md)

These tickets are intentionally scoped around the current codebase.

They are written to help implementation start without re-deciding the information architecture.

## Scope of this ticket pack

Included:

- Milestone 26: Shell and IA reset
- Milestone 27: Visits queue and drawer

Not included yet:

- persistent visit workspace
- dispatch and visit convergence
- customer consolidation
- fleet consolidation
- supply consolidation
- finance consolidation

## Working assumptions

1. Existing routes stay live during migration.
2. Product language can move ahead of route deletions.
3. `jobs` remains the data model and most internal code naming for now.
4. `visits` becomes the office-facing product label first, then the route alias, then the long-term workspace shell.
5. Existing `jobs` page and `JobsWorkboard` are the starting implementation surface for Milestone 27.

## Milestone 26 ticket set

## Ticket 26.1: Reduce primary nav to v2 categories

### Goal

Replace the current module-heavy nav with the future-state primary model.

### User outcome

Office users see:

- `Dispatch`
- `Visits`
- `Customers`
- `Fleet`
- `Supply`
- `Finance`

They do not see `Customer vehicles`, `Fleet vehicles`, `Team`, `Reports`, or `Settings` as peer operational hubs in the main nav.

### Current implementation surface

- `apps/web/components/dashboard-shell-nav.tsx`
- `apps/web/components/dashboard-mobile-nav.tsx`

### Required changes

- Rewrite `dashboardNavSections` to use the new primary grouping.
- Rename product labels:
  - `Jobs` -> `Visits`
  - `Invoices` -> `Finance`
  - `Parts` or `Inventory` exposure -> `Supply`
- Point primary nav items to transitional routes:
  - `Dispatch` -> `/dashboard/dispatch`
  - `Visits` -> `/dashboard/visits`
  - `Customers` -> `/dashboard/customers`
  - `Fleet` -> `/dashboard/fleet`
  - `Supply` -> `/dashboard/supply`
  - `Finance` -> `/dashboard/finance`
- Remove customer-vehicle, fleet-vehicle, team, reports, and settings items from the main mobile nav.

### Notes

- Do not delete access to secondary routes yet.
- This is a navigation demotion, not a route removal.

### Acceptance criteria

- Primary desktop nav matches the v2 categories.
- Primary mobile nav matches the v2 categories.
- Secondary routes are no longer visually presented as primary workflow destinations.

## Ticket 26.2: Add transitional route aliases for visits, supply, and finance

### Goal

Expose future-state route names without requiring immediate full rewrites.

### User outcome

Users can navigate to:

- `/dashboard/visits`
- `/dashboard/supply`
- `/dashboard/finance`

even if the underlying feature implementations are still backed by current pages.

### Current implementation surface

- `apps/web/app/dashboard`

### Required changes

- Add `visits/page.tsx` backed by the current jobs workspace.
- Add `supply/page.tsx` backed by the current parts workspace.
- Add `finance/page.tsx` backed by the current invoices workspace.
- Decide whether these are:
  - thin wrapper pages that import current route implementations, or
  - redirects to the old route while the shell shifts first.

### Recommended implementation

- Prefer thin wrapper pages, not redirects, so new nav paths become canonical immediately.

### Acceptance criteria

- New primary routes exist and render successfully.
- Primary nav does not point to deprecated route names.
- Existing routes remain functional during migration.

## Ticket 26.3: Add role-based dashboard entry behavior

### Goal

Stop sending all office roles to the same generic dashboard entry.

### User outcome

- dispatchers land in `Dispatch`
- service advisors and estimators land in `Visits`
- owners and admins can still land in the brief

### Current implementation surface

- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/page.tsx`
- company membership and role context from `lib/company-context`

### Required changes

- Define an initial role-to-home mapping.
- Decide whether `/dashboard`:
  - remains the brief for owners/admins only, or
  - becomes a role-aware redirect entry.
- Preserve direct access to the brief if needed through a secondary entry such as `/dashboard/today`.

### Recommended implementation

- Keep `/dashboard` as role-aware entry.
- Introduce `/dashboard/today` or equivalent for the brief.

### Acceptance criteria

- Dispatchers do not land on a generic summary page by default.
- Service advisors and estimators do not land on a generic summary page by default.
- Owners and admins retain access to the brief.

## Ticket 26.4: Update shell copy to future-state language

### Goal

Make the shell communicate the new product model consistently.

### Current implementation surface

- `apps/web/app/dashboard/layout.tsx`
- nav hints and labels in `dashboard-shell-nav.tsx`
- top-level page titles as needed for first-wave migrated screens

### Required changes

- Replace `Jobs` language with `Visits` in shell-level copy.
- Replace `Invoices` with `Finance` where the route is being re-exposed.
- Replace `Parts` and `Inventory` peer-language with `Supply` where appropriate in the shell.
- Reword helper text that still assumes the old module model.

### Acceptance criteria

- Users see future-state language at the shell level.
- Shell copy no longer reinforces the old module taxonomy.

## Ticket 26.5: Preserve access to demoted modules through secondary entry points

### Goal

Make sure demoted surfaces remain reachable during migration without staying in the main nav.

### Current implementation surface

- customer pages
- fleet pages
- settings and reports pages

### Required changes

- Add secondary links or internal entry points for:
  - customer vehicles
  - fleet vehicles
  - team
  - reports
  - settings
- Put them in:
  - customers workspace
  - fleet workspace
  - settings utility areas
  - finance or owner utility clusters

### Acceptance criteria

- No current operational capability becomes unreachable.
- Demoted routes can still be opened intentionally.

## Milestone 27 ticket set

## Ticket 27.1: Create the visits route as the primary office queue

### Goal

Make `/dashboard/visits` the canonical office work queue.

### User outcome

Service advisors and estimators work from Visits, not Jobs.

### Current implementation surface

- `apps/web/app/dashboard/jobs/page.tsx`
- future wrapper at `apps/web/app/dashboard/visits/page.tsx`

### Required changes

- Build `/dashboard/visits/page.tsx`.
- Reuse the current jobs logic initially.
- Rename visible UI:
  - page title `Jobs` -> `Visits`
  - button copy and descriptors to visit-centric language
- Keep `/dashboard/jobs` as transitional alias or redirect.

### Acceptance criteria

- `/dashboard/visits` is the primary office queue route.
- The UI reads as a visit workflow, not a jobs module.

## Ticket 27.2: Make compact queue the default visits mode

### Goal

Stop centering the board metaphor for office execution.

### User outcome

Users land in a compact, urgency-sorted queue by default, with board still available as an option.

### Current implementation surface

- `apps/web/app/dashboard/jobs/_components/jobs-workboard.tsx`

### Required changes

- Change default view mode from `board` to compact queue for office desktop.
- Preserve board toggle.
- Review mobile behavior so queue mode remains the obvious default.
- Make queue grouping and sorting carry the most important execution logic:
  - intake blockers
  - needs assignment
  - needs time promise
  - ready for dispatch
  - live
  - ready to invoice

### Acceptance criteria

- Queue mode is the default on desktop and mobile.
- Board mode still exists for users who want it.
- The queue feels like the first-class workflow surface.

## Ticket 27.3: Reframe the page hero and toolbar around visits, not jobs

### Goal

Align the current jobs page framing to the future-state Visits model.

### Current implementation surface

- `apps/web/app/dashboard/jobs/page.tsx`

### Required changes

- Change title and descriptive copy to `Visits`.
- Replace `New job` CTA language with visit-oriented copy where appropriate.
- Keep estimate creation visible, but subordinate it to the visit workflow.
- Tighten toolbar copy so it emphasizes:
  - intake
  - assignment
  - scheduling
  - dispatch readiness
  - billing handoff

### Acceptance criteria

- The page reads as a visit operations queue.
- Copy no longer over-emphasizes board behavior.

## Ticket 27.4: Harden the existing visit drawer as the primary first-level interaction

### Goal

Make the drawer strong enough that users do not need the full job page for routine work.

### Current implementation surface

- drawer logic inside `apps/web/app/dashboard/jobs/page.tsx`

### Required changes

- Keep the drawer open via route state as it works now.
- Improve action priority inside the drawer:
  - assign technician
  - set schedule
  - move to dispatch
  - open estimate
  - open invoice
  - add note
  - call or text customer
- Reduce low-value detail that duplicates the upcoming visit workspace.
- Make “Full job” clearly secondary.

### Acceptance criteria

- Most routine office actions can be completed from the drawer.
- The full job page is no longer the obvious first next step.

## Ticket 27.5: Add inline visit actions for assignment and schedule promise

### Goal

Reduce full-page dependency for the two most common queue actions.

### Current implementation surface

- `apps/web/app/dashboard/jobs/page.tsx`
- `apps/web/app/dashboard/jobs/_components/jobs-workboard.tsx`
- existing internal jobs or dispatch mutation paths

### Required changes

- Add lightweight assignment controls from the drawer or queue row.
- Add lightweight schedule or arrival-promise editing from the drawer.
- Reuse current workflow and mutation rules.

### Acceptance criteria

- A dispatcher or advisor can assign or schedule from the queue workflow without opening edit pages.

## Ticket 27.6: Introduce saved views and better scope presets for visits

### Goal

Make the first visits workspace immediately useful for different office roles.

### Current implementation surface

- current query-param filter system in `jobs/page.tsx`
- `JobsWorkboard`

### Required changes

- Add first-pass preset scopes such as:
  - My active visits
  - Needs assignment
  - Awaiting approval
  - Ready for dispatch
  - Ready to invoice
- Saved views can be lightweight initially if full persistence is too much for Milestone 27.

### Acceptance criteria

- Users can jump into meaningful slices without rebuilding filter state every time.

## Ticket 27.7: Rename and reorganize queue grouping labels to match the v2 model

### Goal

Bring the workflow labels closer to real-world office execution language.

### Current implementation surface

- `packages/core` and `apps/web/lib/jobs/workflow`
- `apps/web/app/dashboard/jobs/page.tsx`
- `apps/web/app/dashboard/jobs/_components/jobs-workboard.tsx`

### Required changes

- Keep the underlying workflow model if needed.
- Re-label visible group names and summaries so they match:
  - intake blockers
  - needs assignment
  - needs time promise
  - ready for dispatch
  - live today
  - ready to invoice

### Acceptance criteria

- The visible queue taxonomy matches the future-state Visits model even if underlying enums remain unchanged for now.

## Ticket 27.8: Add visits route telemetry and migration checkpoints

### Goal

Measure whether the new visits route and drawer are actually reducing page hops.

### Required changes

- Add basic instrumentation or event logging for:
  - visits route opens
  - drawer opens
  - full job page opens from visits
  - assignment action from queue or drawer
  - schedule action from queue or drawer
- If formal analytics are not in scope, define at least the event hooks or TODO integration points.

### Acceptance criteria

- The team can verify whether Milestone 27 is reducing dependence on the full job page.

## Recommended build order

Implement these tickets in this order:

1. Ticket 26.1
2. Ticket 26.2
3. Ticket 26.3
4. Ticket 26.4
5. Ticket 26.5
6. Ticket 27.1
7. Ticket 27.2
8. Ticket 27.3
9. Ticket 27.4
10. Ticket 27.5
11. Ticket 27.6
12. Ticket 27.7
13. Ticket 27.8

## Definition of done for this ticket pack

This milestone packet is complete when:

- the shell uses the v2 primary navigation
- future-state route names exist
- role-based home behavior exists
- `Visits` is the primary office queue label and route
- compact queue is the default
- the drawer is strong enough to handle routine visit actions
- full job page openings are no longer the normal path for everyday queue work
