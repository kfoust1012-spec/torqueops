# Milestone 19: Inventory Core

This milestone adds office-first inventory management on top of the procurement foundation from Milestone 18.

## What shipped

- Inventory items / SKUs
- Inventory item aliases for future supplier matching
- Stock locations
- Immutable inventory transaction ledger
- Reservation-based reserved quantity tracking
- Derived on-hand / reserved / available balances
- Reorder thresholds by item and location
- Purchase-order receiving into inventory
- Inventory workspace, item detail, locations, and stock lookup in the web app
- Job-level inventory reservations from procurement demand

## Core model

- `inventory_transactions` is the source of truth for on-hand quantity
- `inventory_reservations` is the source of truth for reserved quantity
- available quantity is derived as:

`available = on_hand - reserved`

This avoids fragile mutable counters and keeps future supplier integrations compatible with the same ledger.

## Main routes

- `/dashboard/inventory`
- `/dashboard/inventory/items`
- `/dashboard/inventory/items/[itemId]`
- `/dashboard/inventory/locations`
- `/dashboard/inventory/lookup`
- `/dashboard/jobs/[jobId]/inventory`

## Main workflow entry points

- Purchase order detail:
  - receive purchased lines into inventory after the procurement receipt exists
- Job detail:
  - inventory shortcut next to parts
- Job parts:
  - job inventory summary and direct entry into stock reservation flow

## Intentional scope limits

Not included in Milestone 19:

- van stock workflows
- technician/mobile inventory operations
- barcode scanning
- supplier-specific integrations
- automatic job consumption from stock
- transfer workflows between locations

## Operational notes

- Reservations are availability guards only. They do not change on-hand quantity.
- Manual adjustments are supported, but purchase receipts and purchase returns should remain the primary inventory-entry sources.
- Receiving into inventory requires:
  - a received PO line quantity
  - an inventory item
  - a stock location

## Verification

The milestone is considered implemented when these pass:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:reset`
