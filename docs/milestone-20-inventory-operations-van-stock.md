# Milestone 20: Inventory Operations + Van Stock

This milestone extends Inventory Core with the operational workflows needed to move stock between the shop and technician vans, issue stock to jobs, return unused parts, track cores, and perform cycle counts without breaking the ledger model from Milestone 19.

## What shipped

- `van` stock locations using the existing `stock_locations` model
- Inventory transfers between locations
- Transfer lifecycle:
  - `draft`
  - `in_transit`
  - `received`
  - `canceled`
- Job inventory issue workflow from reserved stock
- Return-unused and consume-issued inventory flows
- Core hold and core return tracking tied to inventory operations
- Cycle count history and variance posting
- Low-stock visibility by location, including van locations
- Inventory operations workspace and transfer pages in the web app

## Core model

- `stock_locations` remains the single location model for:
  - shop stock
  - warehouse stock
  - van stock
- `inventory_transactions` remains the source of truth for on-hand quantity
- `inventory_reservations` remains the source of truth for reserved quantity
- `job_inventory_issues` tracks stock issued out to a job
- `inventory_transfers` tracks in-flight movement between locations
- `core_inventory_events` tracks held and returned cores

Available stock is still derived as:

`available = on_hand - reserved`

Issued stock leaves the source location through the inventory ledger. Returning unused issued stock writes stock back through the same ledger.

## Main routes

- `/dashboard/inventory`
- `/dashboard/inventory/transfers`
- `/dashboard/inventory/transfers/[transferId]`
- `/dashboard/inventory/locations/[locationId]`
- `/dashboard/inventory/cycle-counts`
- `/dashboard/inventory/cycle-counts/[cycleCountId]`
- `/dashboard/jobs/[jobId]/inventory`

## Main workflow entry points

- Inventory workspace:
  - transfer queue
  - low stock by location
  - van stock summary
- Job inventory:
  - reserve stock
  - issue inventory to the job
  - consume issued quantity
  - return unused quantity
- Purchase order detail:
  - core hold
  - core return

## Operational notes

- Van stock is not a separate subsystem. It is just a `stock_location` with `location_type = 'van'`.
- All stock-affecting changes still write through the inventory transaction ledger.
- Reservations still do not move stock. Only issue, return, receipt, transfer, count, adjustment, and core events affect on-hand.
- Transfer ship/receive, issue/consume/return, reservation consume/release, receipt into inventory, and PO return with inventory are all handled through transaction-safe database RPCs.
- Request-line stock coverage is tracked separately from procurement sourcing demand so inventory coverage and purchasing coverage do not double-count each other.

## Minimal mobile support

No new mobile inventory UI was added in this milestone.

That is intentional:

- Milestone 20 stays web-first and office-operational
- van stock is modeled correctly now
- technician-facing inventory interaction can be added later on top of the same location and ledger model without changing the underlying architecture

## Intentional scope limits

Not included in Milestone 20:

- supplier-specific integrations
- barcode scanning
- advanced warehouse/bin logic
- technician mobile transfer workflows
- automatic supplier replenishment

## Verification

The milestone is considered implemented when these pass:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:reset`
