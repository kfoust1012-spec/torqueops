# Milestone 22: RepairLink OEM Integration

## Scope
- Integrate RepairLink into the existing procurement provider abstraction
- Support VIN-linked OEM sourcing context from parts requests
- Track OEM quote and order provenance inside internal procurement records
- Support company-level account configuration and dealer mappings
- Preserve graceful manual capture and manual order fallback when automation is not officially confirmed

## Confirmed vs fallback behavior

### Confirmed in this milestone
- RepairLink is a first-class `procurement_provider`
- Company can save RepairLink username/password credentials
- Company can configure dealer mappings to internal supplier accounts
- VIN-linked OEM search sessions can be started from a parts request
- RepairLink provider quotes persist internal OEM sourcing context:
  - VIN-linked vehicle context
  - selected dealer mappings
  - search terms
  - fallback metadata
- Manual OEM quote capture creates provider quote lines that convert into normal supplier carts
- Purchase orders built from those carts can record RepairLink provider-order provenance

### Fallback-only in this milestone
- Automated RepairLink search
- Automated RepairLink order submission
- Dealer discovery APIs
- Order status callbacks or webhooks

Where official API details are not confirmed, the adapter returns `manual_required` and the office workflow stays operational through manual quote capture and manual order handoff.

## Key workflow
1. Configure RepairLink credentials at `/dashboard/parts/integrations/repairlink`
2. Create active dealer mappings to internal supplier accounts
3. Open a parts request with a vehicle VIN
4. Start a RepairLink OEM search session
5. Capture OEM offers manually against a mapped dealer
6. Convert those quote lines into normal supplier carts
7. Convert supplier carts into normal purchase orders
8. Record an OEM provider order handoff from the PO page when needed

## Boundaries
- RepairLink-specific behavior stays inside the provider adapter and provider service layer
- Internal procurement tables remain the system of record for carts, purchase orders, receipts, and costing
- No undocumented RepairLink endpoints are called
- No advanced OEM catalog browsing UI is introduced in this milestone
