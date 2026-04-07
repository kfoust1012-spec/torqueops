import { describe, expect, it } from "vitest";

import { resolveEstimateCatalogPartOffers } from "./internal-parts-catalog";

describe("resolveEstimateCatalogPartOffers", () => {
  it("returns vehicle-aware brake kit offers for the seeded RAV4 front brake line", () => {
    const offers = resolveEstimateCatalogPartOffers({
      lineItem: {
        name: "Front brake pad and rotor kit",
        description: "Pads, rotors, and hardware as inspection confirms."
      },
      supplierAccounts: [],
      vehicleContext: {
        vehicleId: "vehicle-rav4",
        displayName: "2022 Toyota RAV4",
        year: 2022,
        make: "Toyota",
        model: "RAV4",
        trim: "XLE",
        engine: "2.5L I4",
        vin: "2T3P1RFV4NW180601",
        licensePlate: "RAV606",
        odometer: 48210
      }
    });

    expect(offers).toHaveLength(3);
    expect(offers[0]?.supplierLabel).toBe("O'Reilly Auto Parts");
    expect(offers[0]?.partNumber).toBe("OR-RAV4-FBK-22");
  });

  it("returns battery offers for the seeded F-150 battery line", () => {
    const offers = resolveEstimateCatalogPartOffers({
      lineItem: {
        name: "Battery",
        description: "Replacement battery matched to the vehicle group size and specification."
      },
      supplierAccounts: [],
      vehicleContext: {
        vehicleId: "vehicle-f150",
        displayName: "2019 Ford F-150",
        year: 2019,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
        engine: "5.0L V8",
        vin: "1FTFW1E50KFA00001",
        licensePlate: "DEMO123",
        odometer: 71320
      }
    });

    expect(offers.map((offer) => offer.partNumber)).toContain("OR-94R-AGM-F150");
    expect(offers.map((offer) => offer.supplierLabel)).toContain("AutoZone");
  });

  it("returns no offers for unmapped repairs", () => {
    const offers = resolveEstimateCatalogPartOffers({
      lineItem: {
        name: "Cabin air filter",
        description: "Replace cabin filter"
      },
      supplierAccounts: [],
      vehicleContext: {
        vehicleId: "vehicle-rav4",
        displayName: "2022 Toyota RAV4",
        year: 2022,
        make: "Toyota",
        model: "RAV4",
        trim: "XLE",
        engine: "2.5L I4",
        vin: "2T3P1RFV4NW180601",
        licensePlate: "RAV606",
        odometer: 48210
      }
    });

    expect(offers).toEqual([]);
  });
});
