# Milestone 21: PartsTech Aftermarket Integration

## What shipped

- PartsTech account configuration with encrypted credential storage
- explicit connection state:
  - `connected`
  - `action_required`
  - `error`
  - `disconnected`
- provider supplier mappings into existing internal supplier accounts
- request-level PartsTech quote session persistence
- manual PartsTech offer capture into provider quote lines
- conversion from provider quote lines into internal supplier carts
- purchase-order level provider order provenance
- safe manual fallback when documented provider automation is unavailable

## Confirmed vs fallback behavior

The integration preserves the procurement abstraction:

- internal supplier carts and purchase orders remain the system of record
- PartsTech data is stored as provider accounts, mappings, quote lines, and provider order records
- supplier carts and purchase orders only receive normalized internal data

Confirmed logic in this milestone:

- account configuration and status handling
- encrypted credential storage
- provider supplier mapping
- provider quote persistence
- provider quote line to internal supplier cart conversion
- provider order provenance on purchase orders

Fallback-only logic in this milestone:

- automated PartsTech search
- automated PartsTech ordering

When the provider boundary cannot complete a fully confirmed automation path, the system:

- records a provider quote session or provider order attempt
- marks the state as `manual_required` or `action_required`
- keeps the request, cart, and PO usable through the normal procurement workflow

## Operational flow

1. Configure the PartsTech account in `/dashboard/parts/integrations/partstech`
2. Add supplier mappings from PartsTech supplier identities to internal supplier accounts
3. Open a parts request and choose `Search PartsTech`
4. Review the provider quote session
5. Capture offer lines manually when needed
6. Convert selected provider quote lines into internal supplier carts
7. Convert carts into purchase orders as normal
8. Optionally record a PartsTech provider-order attempt from the PO detail page

## Guardrails

- no undocumented provider endpoints are assumed
- no provider adapter writes directly into procurement tables
- manual procurement remains fully usable if:
  - credentials are missing
  - provider access is limited
  - supplier mapping is missing
  - ordering cannot be confirmed through documented provider behavior
