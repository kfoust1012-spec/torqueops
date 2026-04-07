import { describe, expect, it } from "vitest";

import { buildSuggestedLaborLineItemDefaults } from "./mapping";

describe("labor guide mapping", () => {
  it("creates editable labor line-item defaults with zeroed pricing", () => {
    expect(
      buildSuggestedLaborLineItemDefaults({
        name: "Brake system inspection",
        description: "Inspect the brake system before finalizing parts.",
        suggestedHours: 1,
        rationale: "Brake complaints need inspection first."
      })
    ).toEqual({
      itemType: "labor",
      name: "Brake system inspection",
      description:
        "Inspect the brake system before finalizing parts. Suggested labor time: 1 hour. Brake complaints need inspection first.",
      quantity: 1,
      unitPriceCents: 0,
      taxable: true
    });
  });
});