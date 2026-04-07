import { describe, expect, it } from "vitest";

import {
  buildVehicleAwareRetailerSearchQuery,
  parseRetailerCurrencyTextToCents
} from "./live-retailer-search";

describe("live retailer search helpers", () => {
  it("adds vehicle context to a generic retailer query", () => {
    expect(
      buildVehicleAwareRetailerSearchQuery({
        fallbackQuery: "Front brake pad and rotor kit",
        vehicleContext: {
          year: 2022,
          make: "Toyota",
          model: "RAV4"
        }
      })
    ).toBe("Front brake pad and rotor kit 2022 Toyota RAV4");
  });

  it("does not duplicate vehicle context already present in the query", () => {
    expect(
      buildVehicleAwareRetailerSearchQuery({
        explicitQuery: "AGM battery 2019 Ford F-150",
        fallbackQuery: "AGM battery",
        vehicleContext: {
          year: 2019,
          make: "Ford",
          model: "F-150"
        }
      })
    ).toBe("AGM battery 2019 Ford F-150");
  });

  it("converts retailer money text into cents", () => {
    expect(parseRetailerCurrencyTextToCents("$259.99")).toBe(25_999);
    expect(parseRetailerCurrencyTextToCents("Refundable Core $22.00")).toBe(2_200);
    expect(parseRetailerCurrencyTextToCents("not priced")).toBeNull();
  });
});
