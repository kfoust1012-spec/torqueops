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

  it("keeps step 5 anchored to Today brief instead of estimate intake", () => {
    const stepFive = dashboardWalkthroughSteps[4];

    expect(stepFive).toMatchObject({
      ctaLabel: "Open Today brief",
      href: "/dashboard",
      id: "return-home",
      label: "Dashboard",
      title: "Read Today brief"
    });
    expect(`${stepFive?.body} ${stepFive?.href} ${stepFive?.title}`.toLowerCase()).not.toContain("estimate");
  });
});
