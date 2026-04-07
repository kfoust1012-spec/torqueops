# Milestone 17: Carfax Integration

## What shipped

- A cached `vehicle_carfax_summaries` table scoped by company and vehicle
- Shared Carfax summary types and validation contracts
- A server-only Carfax fetch and refresh service with throttled retry windows
- A full Carfax summary card on the internal vehicle detail page
- Compact cached Carfax context on internal job intake and estimate review pages
- An office-only internal API route for cached vehicle Carfax summaries

## Operational boundaries

- The integration is additive only. Vehicle creation, job intake, estimate editing, and estimate sending continue to work if Carfax is unavailable.
- Carfax is fetched manually from the internal vehicle page. Intake and estimate pages read the cache only.
- No Carfax data is shown on customer-facing estimate pages or on mobile estimate approval flows.
- Only normalized summary data is stored. Raw provider payloads and full external reports are intentionally not persisted in this milestone.

## Provider adapter assumption

- `apps/web/lib/carfax/provider.ts` expects the upstream integration to return either:
  - the normalized `CarfaxReportSummary` object directly
  - or an envelope with `summary` or `reportSummary`
  - or a status envelope with `status`, `message`, or `error`
- If the eventual Carfax partner payload differs, update only the provider normalization layer and keep the rest of the app unchanged.
- The current request transport in `apps/web/lib/carfax/provider.ts` is a provisional adapter shape for Milestone 17, not a finalized vendor contract.
- Do not expand request/auth configuration outside the provider adapter until the actual Carfax partner specification is confirmed.

## Environment

Add these to `apps/web/.env.local`:

- `CARFAX_API_KEY`
- `CARFAX_API_BASE_URL`
- The exact auth headers and body format are intentionally isolated to `apps/web/lib/carfax/provider.ts` and may change once the real provider contract is finalized.

## Refresh behavior

- `ready`: next refresh allowed after 24 hours
- `not_available`: next refresh allowed after 24 hours
- `provider_error`: next refresh allowed after 15 minutes

## Internal API

- `GET /api/internal/vehicles/[vehicleId]/carfax-summary`

This route requires authenticated office access and returns the cached normalized summary or `null`.
It is an internal-only helper and should not be expanded into a broader reporting API in this milestone.
