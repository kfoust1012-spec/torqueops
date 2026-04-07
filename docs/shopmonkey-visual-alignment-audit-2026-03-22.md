# Shopmonkey Visual Alignment Audit

Date: 2026-03-22

This document captures the current visual alignment gap between the local application and the target benchmark direction described in the mobile mechanic overhaul.

It is not a cloning brief.

It is a corrective design audit intended to answer:

- where the current UI diverges from the intended benchmark language
- what Shopmonkey appears to do well visually and structurally
- what needs to change page by page to move this product toward a workflow-first, dispatch-first, premium SaaS operations cockpit
- why the current Jobs board is not operationally usable

## Scope

This audit compares:

- official Shopmonkey help and product documentation
- the current local application structure and visible page patterns
- the current implementation state of:
  - Dashboard
  - Dispatch
  - Jobs
  - Estimates
  - Customers
  - Customer Vehicles
  - Fleet
  - Fleet Vehicles
  - Team

## Source notes

Primary external references used:

- Shopmonkey Workflow Views:
  https://support.shopmonkey.io/hc/en-us/articles/38743858598676-Workflow-Views
- Shopmonkey Workflow Cards:
  https://support.shopmonkey.io/hc/en-us/articles/38744238912788-Workflow-Cards
- Shopmonkey Calendar Filters & View Options:
  https://support.shopmonkey.io/hc/en-us/articles/38742864574612-Calendar-Filters-View-Options
- Shopmonkey Shopmonkey 2.0 Updates:
  https://support.shopmonkey.io/hc/en-us/articles/38744786302100-Shopmonkey-2-0-Updates
- Shopmonkey Assign Technicians to Labor Items:
  https://support.shopmonkey.io/hc/en-us/articles/38743885537172-Assign-Technicians-to-Labor-Items
- Shopmonkey Technician View:
  https://support.shopmonkey.io/hc/en-us/articles/38964387625236-Shopmonkey-How-do-I-use-the-Technician-View
- Shopmonkey Customer Info & Preferences:
  https://support.shopmonkey.io/hc/en-us/articles/38743956107284-Customer-Info-Preferences
- Shopmonkey Add Vehicles:
  https://support.shopmonkey.io/hc/en-us/articles/38743934303252-Add-Vehicles

Local implementation references:

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dispatch/_components/dispatch-command-center.tsx`
- `apps/web/app/dashboard/jobs/page.tsx`
- `apps/web/app/dashboard/jobs/_components/jobs-workboard.tsx`
- `apps/web/app/dashboard/estimates/page.tsx`
- `apps/web/app/dashboard/customers/_components/customers-workspace-shell.tsx`
- `apps/web/app/dashboard/customer-vehicles/page.tsx`
- `apps/web/app/dashboard/fleet/page.tsx`
- `apps/web/app/dashboard/fleet-vehicles/page.tsx`
- `apps/web/app/dashboard/team/page.tsx`
- `apps/web/app/design-system.css`

## Benchmark interpretation

Shopmonkey should be treated as the primary visual benchmark for:

- compact workflow density
- bright, application-like SaaS surfaces
- strong left navigation
- operationally useful cards and lists
- quick scan hierarchy
- right-side panels that preserve context
- configurable view modes for crowded workflows

Tekmetric remains more relevant for:

- denser admin information architecture
- estimate and reporting depth
- tabular operational density

AutoLeap remains more relevant for:

- board logic
- workflow movement
- queue progression

Field-service and dispatch products remain more relevant for:

- route movement
- technician travel state
- map-first scheduling
- assignment and reassignment

The intended product should look visually closer to Shopmonkey than it does now, while functioning more like a mobile mechanic control center.

## Core findings

### 1. The current product is too atmospheric and not operational enough

The current system still relies too heavily on:

- warm cream gradients
- soft promotional card styling
- oversized padded surfaces
- long explanatory copy blocks
- decorative empty-state space

This creates a polished appearance, but not a workflow-dense one.

Shopmonkey, by contrast, reads as:

- cooler and cleaner
- tighter and more compact
- more informational per square inch
- more desktop-application-like
- more immediately actionable

### 2. The current system wastes too much vertical and horizontal space

Across the app, especially Jobs, the UI still spends too much room on:

- introductory copy
- oversized lane headers
- repeated support text
- large empty lane footprints
- generous gutters that reduce visible work

Shopmonkey’s workflow and calendar documentation strongly imply the opposite design goal:

- show more work at once
- support condensed modes
- preserve clarity while increasing density

### 3. The current visual hierarchy is too “equal weight”

Many current screens still present:

- command strips
- filters
- board columns
- side rail cards

with similar visual weight.

That makes the screen feel flat.

Shopmonkey tends to create a stronger hierarchy:

- primary workspace dominates
- controls are compact and attached to the workspace
- supporting details are secondary
- side panels are contextual, not co-equal showcase blocks

### 4. The current color and material system is not aligned

The current product still feels:

- warm beige / parchment
- soft gold accent heavy
- rounded and cushioned
- editorial

Shopmonkey feels closer to:

- white or near-white base
- cool gray framing
- blue-forward action emphasis
- restrained status colors
- crisper borders
- smaller shadow depth
- smaller corner radii

### 5. The current Jobs board is not usable enough

This is the biggest immediate issue.

The current Jobs board is not just visually off-benchmark. It is structurally difficult to use.

Problems:

- six fixed-width columns are rendered side by side
- the inspector remains open on the right, permanently consuming width
- the board requires horizontal panning before work becomes visible
- empty lanes still occupy large visual blocks
- lane headers are mini feature cards rather than compact queue headers
- filters occupy too much vertical height before the board begins
- card and lane copy consumes too much space relative to the number of visible jobs

This is contrary to the benchmark direction and contrary to the practical need to manage active work quickly.

### 6. The current cards are still too editorial

Many cards still read like polished summaries rather than dense work objects.

Shopmonkey-style workflow cards feel more like:

- compact work packets
- fast visual summaries
- strong labels
- concise metadata
- clearly colored state
- minimal prose

Our cards still often use:

- too much support text
- too much vertical breathing room
- not enough compact state grouping

### 7. The current shell still feels like a set of premium cards, not an operations desktop

The shell overhaul improved navigation, but the overall product still does not feel close enough to:

- desktop ops software
- command workspace
- tightly integrated workflow system

It still has too much “showcase” quality.

## Shopmonkey visual traits to adopt more aggressively

### Layout

- tighter top action bars
- stronger left-rail application framing
- compact filters attached directly to the active workspace
- smaller workspace headers
- dense list and board modes
- side drawers and detail rails that do not steal excessive workspace width

### Spacing

- less generous card padding
- shorter vertical rhythm
- tighter gutters between modules
- shorter section headers
- less empty-state whitespace

### Surface styling

- whiter surfaces
- cooler gray boundaries
- smaller corner radius
- less glow and less warm gradient usage
- subtler shadows
- sharper component edges

### Typography

- smaller all-caps labels
- tighter section titles
- stronger contrast between primary labels and helper text
- less paragraph copy
- more compact metadata blocks

### Interaction model

- configurable view density
- condensed views for busy boards
- grouped-by-tech or grouped-by-status options where relevant
- side panels for preserving context
- quick actions embedded directly into compact cards

## Current app vs target benchmark

### Dashboard

Current state:

- improved operationally
- still too card-heavy and stylized
- still not compact enough

Gap vs benchmark:

- needs a denser command-center feel
- should reduce card treatment and height
- should elevate the central live workspace more aggressively

### Dispatch

Current state:

- best aligned page conceptually
- stronger control-center direction than most other pages
- still visually softer and larger than benchmark

Gap vs benchmark:

- headers and cards still need denser mode
- map/list/route controls need tighter toolbar behavior
- route and tech detail should feel more application-grade, less card-grade

### Jobs

Current state:

- workflow logic improved
- interactions added
- layout still fails practical use

Gap vs benchmark:

- not compact enough
- not configurable enough
- not width-efficient enough
- still too much explanatory card chrome

### Estimates

Current state:

- better structure than before
- still not yet a truly compact estimate-production desktop

Gap vs benchmark:

- needs less presentation and more production density
- needs tighter module framing
- should feel more like a persistent estimate canvas than a lane showcase

### Customers

Current state:

- relationship framing improved
- still visually broader and softer than benchmark

Gap vs benchmark:

- should be denser and more tabbed
- summary area should become more transactional
- should reduce decorative spacing

### Customer Vehicles

Current state:

- separation from fleet is correct
- registry direction is improved

Gap vs benchmark:

- still needs tighter registry density
- should feel more asset-list-like
- action density should increase

### Fleet

Current state:

- operationally appropriate direction
- still visually too soft

Gap vs benchmark:

- should borrow Shopmonkey’s compact control bar discipline
- map-first workspace should dominate more clearly

### Fleet Vehicles

Current state:

- structural separation is correct
- operational framing is better than before

Gap vs benchmark:

- still needs denser internal-asset roster treatment
- should feel more like an operational unit console than a card gallery

### Team

Current state:

- better workload framing than before
- still too much card weight

Gap vs benchmark:

- should shift toward denser list plus selected-context detail
- should look more like an active workforce console

## Non-negotiable corrective moves

These need to happen if the product is going to visually align with the intended benchmark direction.

### 1. Replace the warm cream visual bias

Do this globally:

- shift base backgrounds toward white and ultra-light cool gray
- reduce warm gradients to occasional accent use only
- reduce parchment-like fills
- reduce gold tint as default framing

### 2. Increase density everywhere

Do this globally:

- shrink card padding
- shrink command band heights
- reduce helper copy
- reduce section header height
- reduce top-of-page vertical travel

### 3. Create compact and condensed modes

At minimum, add density modes for:

- Dispatch
- Jobs
- Estimates
- Fleet

### 4. Convert static right rails into contextual drawers where appropriate

This matters especially on:

- Jobs
- Dispatch
- Estimates
- Customers

### 5. Treat lists and boards as tools, not showcases

Every major operational page should prioritize:

- visible rows
- visible cards
- visible state changes
- visible actions

over:

- presentation copy
- empty decorative space
- oversized container styling

## Detailed corrective plan by page

### Global shell and visual system

#### Goal

Make the whole app feel more like a premium workflow desktop application and less like a set of large showcase cards.

#### Actions

- Replace the current warm shell styling with a cooler palette:
  - base canvas: white or ultra-light gray
  - secondary surfaces: cool neutral grays
  - action accent: one saturated blue
  - statuses: reserved only for meaning
- Reduce border radius globally by one size tier.
- Reduce shadow blur and opacity globally.
- Reduce average card padding by 15-25%.
- Introduce a denser type scale for metadata and workspace labels.
- Standardize compact top bars:
  - page title on left
  - global or module search
  - filters
  - date controls when relevant
  - primary action cluster on right
- Add workspace density options to boards and data-heavy views:
  - comfortable
  - compact
  - condensed

### Dashboard

#### Goal

Make the dashboard feel like today’s operating brief, not a homepage.

#### Actions

- Keep the top KPI strip but reduce height substantially.
- Remove any remaining decorative framing around summary items.
- Make the center workspace dominate the page visually.
- Default the center to a compact dispatch/list hybrid.
- Keep the right rail narrow and urgent:
  - approvals
  - delays
  - parts blockers
  - tech issues
- Compress the bottom strips:
  - team workload
  - money waiting
  - upcoming jobs
- Remove explanatory copy where the label itself is enough.

#### Visual target

- tighter rows
- stronger blue action controls
- less card showcase behavior
- more scan efficiency

### Dispatch

#### Goal

Keep Dispatch as the hero module and push it even closer to a field-service control center with Shopmonkey-level compactness.

#### Actions

- Compress the command strip and filter controls.
- Add explicit density/view toggles:
  - map-first
  - split map/list
  - condensed lanes
- Tighten technician lane headers.
- Compress job event cards one step further by default.
- Reduce inspector width and make it collapsible on desktop.
- Make route actions sit in a sticky side drawer rather than equal-weight cards.
- Use stronger route color rules and sharper map overlays.

#### Visual target

- crisper workspace framing
- more route data visible at once
- less ornamental card padding

### Jobs

#### Goal

Rebuild Jobs into a compact, configurable workboard that is actually usable at desktop width.

#### Current problem

The current layout shows:

- too much filter height
- too many equal-width columns
- empty lanes consuming width
- a side inspector stealing board area
- insufficient visible cards

#### Immediate layout correction

- Remove the permanent split between board and inspector.
- Default to board-first with inspector closed.
- Make the inspector a slide-over or collapsible drawer that opens only on selection.
- Replace the six fixed visible columns with:
  - a compact board that shows four lanes at a time on standard desktop widths
  - horizontal movement only when needed
  - or grouped workflow stages with a lane switcher
- Collapse empty lanes by default or move them into an overflow rail.
- Convert lane headers from mini cards into a compact sticky lane row:
  - lane name
  - count
  - one key metric
  - one action

#### View modes

Add:

- Board
- List
- Compact queue

For Board, also add:

- Comfortable
- Condensed

#### Card redesign

- customer name
- job title
- vehicle
- status stack
- assigned tech
- schedule/arrival
- estimate or approval marker
- dollar signal
- one-line next move

Reduce or remove:

- long support text
- repeated explanatory metadata
- oversized internal gaps

#### Toolbar redesign

- shrink the filter card into a true command row
- allow filters to wrap compactly
- move Apply/Clear into the same control line
- reduce vertical footprint by at least half

#### Interaction redesign

- keep drag/drop
- show drop affordance without giant empty space
- allow inspect drawer to slide over the board
- keep quick actions inline and compact

#### Visual target

The Jobs page should feel meaningfully closer to Shopmonkey workflow density:

- more jobs visible
- faster scanning
- less panning
- less empty chrome
- inspector used only when needed

### Estimates

#### Goal

Make Estimates feel like a production tool, not a showcase of lanes.

#### Actions

- Compress the top command band.
- Convert the lane area into a tighter production strip or queue summary.
- Make the estimate canvas the dominant workspace.
- Keep catalog and templates in a compact left utility rail.
- Keep totals, preview, notes, and send actions in a right drawer.
- Reduce lane-card storytelling copy.

#### Visual target

- production desktop
- tighter controls
- quicker entry into editing

### Customers

#### Goal

Make customer profiles denser, more transactional, and more relationship-aware.

#### Actions

- Compress customer header height.
- Surface:
  - phone
  - email
  - preferred contact
  - outstanding balance
  - active jobs
  - account value
  in one compact summary strip
- Keep tabs sticky and tight.
- Move notes/messages into more direct utility entry points.
- Reduce oversized panel spacing.

#### Visual target

- fewer decorative blocks
- more relationship context in one glance

### Customer Vehicles

#### Goal

Make the registry feel like a dense customer asset list.

#### Actions

- reduce cardization
- favor denser rows or compact tiles
- show owner, vehicle identity, VIN, active concerns, last service, open estimate, and quick actions
- keep photos/inspection/service history one click away

#### Visual target

- registry-first
- not gallery-first

### Customer Vehicle Profile

#### Goal

Make the profile feel like a true service record workspace.

#### Actions

- compress the hero area
- add sticky tabs
- increase density in service history and recommendation sections
- keep inspection/photo access highly visible
- reduce large empty regions
- make owner relationship and vehicle history feel adjacent at all times

### Fleet

#### Goal

Use Shopmonkey’s compact visual discipline while preserving map-first field logic.

#### Actions

- compact command bar
- stronger map dominance
- tighter route and unit filter controls
- compact alert rail
- denser unit list under or beside the map

#### Visual target

- map-first
- compact operational controls

### Fleet Vehicles

#### Goal

Make company units feel like internal operational assets, not customer records.

#### Actions

- tighten the roster layout
- show:
  - unit
  - assigned tech
  - route state
  - maintenance due
  - alert state
  - downtime
- make detail rail denser and more tabbed
- reduce decorative whitespace

### Team

#### Goal

Make Team feel like an active field workforce console.

#### Actions

- shift technician cards toward denser list behavior
- keep selected technician detail in a compact rail
- prioritize:
  - route state
  - live work
  - clock state
  - assigned unit
  - estimate workload
  - inspection workload
- reduce oversized card framing

### Invoices

#### Goal

Make Invoices feel like a compact financial operations workspace.

#### Actions

- reduce card showcase behavior
- favor dense list or table views
- show balance, due date, status, and quick actions prominently
- keep payment and send actions in a compact utility rail

### Parts / Inventory

#### Goal

Bring parts and inventory closer to Shopmonkey’s practical parts workflow density.

#### Actions

- use more tables and denser lists
- reduce oversized cards
- strengthen search and filter persistence
- add more compact status handling
- keep part detail and ordering context in right-side panels where possible

### Reports

#### Goal

Make Reports feel like a report library and operational analysis center, not a dashboard of decorative charts.

#### Actions

- create compact report navigation
- support favorites and recent reports
- reduce equal-weight KPI cards
- prioritize useful slices and quick drill-in

### Settings

#### Goal

Make Settings feel like a dense operational admin area.

#### Actions

- use left subnavigation
- compress section framing
- reduce decorative treatment
- prioritize fast scan and grouped controls

## Execution priority

### Priority 1

Jobs page layout correction.

This is the most visibly broken operational page today.

### Priority 2

Global visual system shift away from warm cream card styling toward cooler, denser application styling.

### Priority 3

Dispatch density and inspector refinement.

### Priority 4

Estimates production workspace compression.

### Priority 5

Customers and Customer Vehicles density pass.

### Priority 6

Fleet, Fleet Vehicles, and Team density pass.

## Working rule

If a future design decision is ambiguous, prefer the option that:

- shows more useful work at once
- shortens the path between seeing and acting
- preserves context through drawers and rails
- reduces padding before reducing clarity
- makes the product feel more like working software and less like a polished showcase

## Immediate note on Jobs

The current Jobs board should be considered visually non-final and structurally non-compliant with the benchmark direction.

Its current six-column board plus fixed inspector arrangement should be replaced in the next execution pass.

The correct direction is:

- board-first
- compact by default
- configurable density
- collapsible inspector
- fewer always-visible empty lanes
- more visible jobs per screen
