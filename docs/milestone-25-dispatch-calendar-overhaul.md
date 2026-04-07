# Milestone 25: Dispatch Calendar Overhaul

## Scope
- Replaces the old dispatch lane board with a multi-resource calendar command center.
- Keeps `jobs` and `technician_availability_blocks` as the only scheduling source of truth.
- Adds company calendar settings, saved views, and lane presentation preferences.
- Supports:
  - all-workers view
  - single-tech view
  - subset/saved-view filtering
  - unassigned scheduled rail
  - backlog rail
  - inline availability blocks
  - drag/drop move and reassignment
  - drag resize for duration changes
  - low-friction quick edit
  - conflict visibility

## Data model
- `dispatch_calendar_settings`
- `dispatch_saved_views`
- `dispatch_saved_view_members`
- `dispatch_resource_preferences`

No second schedule table was introduced.

## Interaction model
- Drag unassigned or backlog jobs into a lane to assign and schedule.
- Drag scheduled jobs across lanes to reassign.
- Drag scheduled jobs within a lane to reschedule.
- Resize the bottom handle on a calendar event to change duration.
- Click a job to open the quick-edit drawer.
- Add/remove availability blocks directly from dispatch.

## Conflict model
Conflicts are derived at read time from:
- overlapping jobs
- jobs overlapping availability blocks
- jobs outside configured dispatch hours

Conflicts are visible in:
- lane headers
- event treatment
- left-rail conflict summary

## Design intent
- Dense but readable dispatch surface
- Sticky time axis and date/resource headers
- Clear technician lanes with lane color accents
- Stronger status and conflict treatment than the old board
- Premium command-center styling without introducing heavy calendar dependencies

## Technical notes
- Uses the existing design system plus dispatch-specific calendar styles in `apps/web/app/design-system.css`.
- Uses internal JSON mutation routes for drag/drop, resize, quick edit, availability, and saved views.
- Uses native browser drag/drop and pointer resize interactions instead of a large scheduler dependency.

## Out of scope
- Route optimization
- AI scheduling
- Payroll/timeclock
- Technician mobile dispatch calendar
