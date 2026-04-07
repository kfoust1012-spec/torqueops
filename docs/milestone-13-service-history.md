# Milestone 13: Service History

## What shipped

- Customer history page: `/dashboard/customers/[customerId]/history`
- Vehicle history page: `/dashboard/vehicles/[vehicleId]/history`
- Read-only internal API endpoints for the same history payloads
- Shared history filters for date range, vehicle, and per-record status filters
- Quick navigation from customer history to vehicle history and back

## Data model

- No new SQL migration was added for the initial implementation.
- History is assembled from existing jobs, inspections, estimates, invoices, and payments.
- Jobs remain the primary visit container; related records are attached by `job_id` and `invoice_id`.

## Filter behavior

- `dateFrom` and `dateTo` filter on the computed service visit date.
- Customer history optionally filters to one vehicle.
- Status filters are per record type:
  - `jobStatuses`
  - `inspectionStatuses`
  - `estimateStatuses`
  - `invoiceStatuses`
  - `paymentStatuses`

## Internal API

- `GET /api/internal/service-history/customers/[customerId]`
- `GET /api/internal/service-history/vehicles/[vehicleId]`

Both endpoints require an authenticated office context and return the same payloads used by the server-rendered pages.

## Follow-up if history volume grows

- Add targeted composite indexes on `jobs(company_id, customer_id, created_at desc)` and `jobs(company_id, vehicle_id, created_at desc)` only if query plans show a need.
- If filters need to update without full navigation, the internal API payloads are already in place for a client-side enhancement.