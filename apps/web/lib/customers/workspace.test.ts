import { describe, expect, it } from "vitest";

import { buildCustomerWorkspaceHref } from "./workspace";

describe("customer workspace routes", () => {
  it("preserves return target metadata for estimate intake detours", () => {
    expect(
      buildCustomerWorkspaceHref("customer-1", {
        newAddress: true,
        returnLabel: "Back to estimate intake",
        returnTo: "/dashboard/visits/new?customerId=customer-1&vehicleId=vehicle-1&mode=estimate",
        tab: "addresses"
      })
    ).toBe(
      "/dashboard/customers?customerId=customer-1&tab=addresses&newAddress=1&returnTo=%2Fdashboard%2Fvisits%2Fnew%3FcustomerId%3Dcustomer-1%26vehicleId%3Dvehicle-1%26mode%3Destimate&returnLabel=Back+to+estimate+intake"
    );
  });
});
