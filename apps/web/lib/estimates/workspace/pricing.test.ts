import { describe, expect, it } from "vitest";

import {
  DEFAULT_LABOR_RATE_CENTS,
  DEFAULT_PART_SELL_MULTIPLIER_BASIS_POINTS,
  calculateSuggestedPartUnitPriceCents,
  resolveEstimateWorkspacePricingDefaults
} from "./pricing";

describe("estimate workspace pricing", () => {
  it("falls back to default labor and part pricing when no history exists", () => {
    expect(resolveEstimateWorkspacePricingDefaults([])).toEqual({
      laborRateCents: DEFAULT_LABOR_RATE_CENTS,
      laborRateSource: "fallback",
      partSellMultiplierBasisPoints: DEFAULT_PART_SELL_MULTIPLIER_BASIS_POINTS,
      partSellMultiplierSource: "fallback"
    });
  });

  it("infers labor rate and part sell multiplier from existing estimate lines", () => {
    expect(
      resolveEstimateWorkspacePricingDefaults([
        {
          actualCostCents: null,
          estimatedCostCents: null,
          itemType: "labor",
          quantity: 1,
          unitPriceCents: 13_500
        },
        {
          actualCostCents: null,
          estimatedCostCents: null,
          itemType: "labor",
          quantity: 2,
          unitPriceCents: 14_500
        },
        {
          actualCostCents: 18_000,
          estimatedCostCents: 18_000,
          itemType: "part",
          quantity: 2,
          unitPriceCents: 13_500
        }
      ])
    ).toEqual({
      laborRateCents: 14_000,
      laborRateSource: "estimate_history",
      partSellMultiplierBasisPoints: 15_000,
      partSellMultiplierSource: "estimate_history"
    });
  });

  it("rounds suggested part sell pricing up to the nearest quarter", () => {
    expect(calculateSuggestedPartUnitPriceCents(17_126, 14_000)).toBe(24_000);
  });
});
