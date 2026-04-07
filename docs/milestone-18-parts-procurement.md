# Milestone 18: Parts & Purchasing Core

This milestone adds a web-first office procurement workflow to the existing job, estimate, invoice, and profitability system.

## Scope Included

- `Source Parts` entry from job detail and estimate context
- global parts workspace for office staff
- supplier accounts with `manual` and `link_out` modes
- supplier routing rules
- grouped supplier carts
- purchase orders and purchase order lines
- receiving, returns, and core tracking
- actual-cost write-back into estimate, invoice, and job profitability context

## Intentionally Deferred

- supplier-specific API integrations
- mobile technician procurement UI
- automated vendor checkout
- inventory management
- stocking and bin locations

## Database Surface

New enums:

- `supplier_account_mode`
- `part_request_origin`
- `part_request_status`
- `part_lifecycle_status`
- `supplier_cart_status`
- `purchase_order_status`
- `part_return_status`

New tables:

- `supplier_accounts`
- `supplier_routing_rules`
- `part_requests`
- `part_request_lines`
- `supplier_carts`
- `supplier_cart_lines`
- `purchase_orders`
- `purchase_order_lines`
- `purchase_receipts`
- `purchase_receipt_lines`
- `part_returns`
- `part_return_lines`

Existing tables extended:

- `estimate_line_items`
  - `part_request_line_id`
  - `estimated_cost_cents`
  - `actual_cost_cents`
- `invoice_line_items`
  - `part_request_line_id`
  - `estimated_cost_cents`
  - `actual_cost_cents`

## Access Model

Procurement records are currently office-only at the database policy layer:

- `owner`
- `admin`
- `dispatcher`

That matches Milestone 18 scope:

- web-first
- admin/office focused
- no technician procurement write surface yet

## Main Workflow

1. Office user starts a part request from a job or estimate.
2. Request lines are added manually or seeded from estimate part lines.
3. Routing rules group request lines into supplier carts by supplier bucket.
4. Office staff reviews each cart and either:
   - uses a manual supplier workflow, or
   - uses a link-out supplier workflow
5. A cart is converted into a purchase order.
6. Purchase order lines move through lifecycle states:
   - `quoted`
   - `ordered`
   - `received`
   - `installed`
   - `returned`
   - `core_due`
   - `core_returned`
7. Actual received cost writes back into profitability context for:
   - job summary
   - estimate part lines
   - invoice part lines

## Entry Points

Job context:

- `/dashboard/jobs/[jobId]`
- `/dashboard/jobs/[jobId]/parts`

Estimate context:

- `/dashboard/jobs/[jobId]/estimate`
- `/dashboard/jobs/[jobId]/estimate/edit`

Global procurement workspace:

- `/dashboard/parts`

Supplier configuration:

- `/dashboard/parts/suppliers`

Operational detail routes:

- `/dashboard/parts/requests/[requestId]`
- `/dashboard/parts/carts/[cartId]`
- `/dashboard/parts/purchase-orders/[purchaseOrderId]`

## Supplier Modes

`manual`

- office staff can record quoted cost and ordering information in-system
- purchase order lifecycle is tracked in-system
- no external supplier API is required

`link_out`

- office staff can store the supplier URL and link out to the vendor site
- cart and PO tracking still stays in-system
- ordering remains manually confirmed and recorded

## Profitability Write-Back

Estimate and invoice part lines now support linked procurement data.

Write-back behavior:

- estimated procurement cost can populate `estimate_line_items.estimated_cost_cents`
- actual received procurement cost can populate:
  - `estimate_line_items.actual_cost_cents`
  - `invoice_line_items.actual_cost_cents`
- job-level profitability summary aggregates part sell vs part cost across linked records

This milestone does not change invoice totals or estimate totals automatically. It adds cost context for profitability and operational tracking.

## Implementation Surface

Schema:

- [0056_procurement_core.sql](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/supabase/migrations/0056_procurement_core.sql)
- [0057_procurement_rls.sql](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/supabase/migrations/0057_procurement_rls.sql)

Shared domain:

- [procurement.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/packages/types/src/procurement.ts)
- [procurement.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/packages/validation/src/procurement.ts)
- [index.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/packages/core/src/procurement/index.ts)

Data and services:

- [procurement.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/packages/api-client/src/repositories/procurement.ts)
- [service.ts](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/lib/procurement/service.ts)

Web routes:

- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/parts/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/parts/suppliers/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/parts/requests/%5BrequestId%5D/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/parts/carts/%5BcartId%5D/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/parts/purchase-orders/%5BpurchaseOrderId%5D/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/jobs/%5BjobId%5D/parts/page.tsx)

Existing flow integration:

- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/jobs/%5BjobId%5D/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/jobs/%5BjobId%5D/estimate/page.tsx)
- [page.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/jobs/%5BjobId%5D/estimate/edit/page.tsx)
- [layout.tsx](/C:/Users/Kyle/Documents/Mobile%20Mechanic%20Software/apps/web/app/dashboard/layout.tsx)

## Verification

The milestone currently passes:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:reset`

## Next Likely Follow-Ups

These are intentionally outside Milestone 18:

- technician read-only parts visibility on mobile
- supplier-specific integrations
- inventory and stock tracking
- automatic restocking
- margin reporting dashboards
