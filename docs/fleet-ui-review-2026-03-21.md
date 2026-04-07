# Fleet UI Review - 2026-03-21

## Current assessment

The Fleet page improved from a generic dashboard into a map-centered workspace, but it is still not at a premium or operator-ready level.

Current strengths:
- The map is now the primary stage instead of one card among many.
- The inspector is more structured than before and no longer mixes every detail into one long stack.
- The header is materially smaller and less disruptive than the original version.

Current weaknesses:
- The top rail, bottom roster, and side inspector still read as three separate overlay systems instead of one coherent command surface.
- The page is technician-detail-first rather than exception-first. It is better at showing a technician than helping an operator decide what needs attention now.
- The visual language still has too much rounded-card chrome, border noise, and duplicated pill treatment.
- The bottom roster takes a lot of space for relatively low operational value because it repeats identity and status instead of emphasizing risk and next action.
- The top rail contains useful controls but still does not feel like a disciplined command bar with a strong order of operations.
- The inspector is usable but still too card-stacked, which makes it feel like a detailed profile panel rather than a dense fleet control tool.

## Product goals for the redesign pass

The Fleet page should:
- make the live map the unquestioned primary surface
- surface exceptions before passive status
- reduce page chrome and repeated card treatment
- keep filters, roster, and inspector available without overpowering the map
- help an operator answer:
  - who needs attention now
  - who is available
  - what work is waiting
  - what route is at risk
  - what action should be taken next

## Redesign direction

### 1. Top rail becomes a command bar

- One compact command surface instead of a stacked deck.
- Left side should provide board context and high-signal counts.
- Center should hold date and technician scope.
- Right side should hold only the map controls.
- Passive metrics should become compact chips or summary counters, not large cards.

### 2. Bottom rail becomes an exception roster

- Sort technicians by operational urgency instead of leaving them in a neutral order.
- Cards should emphasize:
  - current status
  - next stop or open capacity
  - route risk
  - GPS health
- Repeated low-value copy such as generic vehicle labeling should be minimized.

### 3. Side rail becomes a dense inspector

- Top bar: selected technician identity plus status.
- Summary block: now, next, and route metrics.
- Action dock: dispatch, block, message, call.
- View switch: route vs waiting jobs.
- Scrollable content should live below a stable summary/action area.

### 4. Visual polish criteria

- Fewer slabs.
- Fewer nested rounded boxes.
- More contrast in hierarchy, less repetition in surface styling.
- Tighter spacing with more intentional alignment.
- Better use of map real estate.

## Implementation intent

The next pass should rebuild Fleet around:
- a single compact command bar
- an exception-driven roster
- a denser, clearer inspector

This is a redesign pass, not a micro-polish pass.
