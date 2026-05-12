import { describe, expect, it } from "vitest";

import { dashboardWalkthroughSteps } from "./walkthrough";

describe("dashboard walkthrough steps", () => {
  it("keeps the customer-facing walkthrough at 33 steps", () => {
    expect(dashboardWalkthroughSteps).toHaveLength(33);
  });

  it("continues after the Today brief home-base step", () => {
    expect(dashboardWalkthroughSteps[4]?.id).toBe("return-home");
    expect(dashboardWalkthroughSteps[5]?.id).toBe("dispatch-open");
  });
});
