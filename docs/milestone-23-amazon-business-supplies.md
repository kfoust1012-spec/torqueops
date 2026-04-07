# Milestone 23: Amazon Business Supplies Integration

## Scope
- Integrate Amazon Business into the existing procurement provider abstraction
- Support supply-oriented sourcing for oils, shop rags, consumables, and misc non-core items
- Track Amazon Business quote and order provenance inside internal procurement records
- Support company-level account configuration for supply purchasing
- Support reusable internal supply lists that can seed job-linked parts requests
- Preserve graceful manual capture and manual link-out fallback when automation is not officially confirmed or fully available

## Confirmed vs fallback behavior

### Confirmed in this milestone
- Amazon Business is a first-class `procurement_provider`
- Company can save Amazon Business account settings:
  - account email
  - region
  - default supplier account
  - buying group ID
  - buyer email mode / override
  - default shipping address text
  - default fallback mode
- Amazon Business supply sessions can be started from a parts request
- Amazon Business quote context persists internal supply sourcing metadata:
  - selected request lines
  - search terms
  - optional supply-list origin
  - fallback metadata
- Manual Amazon Business offer capture creates provider quote lines that convert into normal supplier carts
- Purchase orders built from those carts can record Amazon Business provider-order provenance
- Internal supply lists can be created, edited, and applied to parts requests

### Fallback-only in this milestone
- Automated Amazon Business search result ingestion
- Automated Amazon Business order submission
- Any unsupported cart or browser-based ordering flow

Where official provider automation is not confirmed or not available for the target flow, the adapter returns `manual_required` and the office workflow remains operational through manual quote capture or manual link-out.

## Key workflow
1. Configure Amazon Business at `/dashboard/parts/integrations/amazon-business`
2. Set the default internal supplier account used for converted supply offers
3. Create reusable supply lists at `/dashboard/parts/supplies`
4. Open a job-linked parts request
5. Apply a supply list or search directly from the request
6. Start an Amazon Business supply session
7. Capture supply offers manually when needed
8. Convert captured offers into internal supplier carts
9. Convert carts into normal purchase orders
10. Record Amazon Business provider-order provenance from the PO page when needed

## Boundaries
- Amazon-specific behavior stays inside the provider adapter and provider service layer
- Internal procurement tables remain the system of record for carts, purchase orders, receipts, returns, and costing
- No undocumented Amazon Business endpoints are called
- No retail-style shopping experience or barcode flow is introduced in this milestone
- Supply lists are internal-only reusable kits, not Amazon-native saved lists
