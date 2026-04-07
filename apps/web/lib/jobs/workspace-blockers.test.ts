import { describe, expect, it } from "vitest";

import { buildWorkspaceBlockerSummary } from "./workspace-blockers";

describe("workspace blocker summary", () => {
  it("treats open technician payment handoffs as finance blockers", () => {
    const summary = buildWorkspaceBlockerSummary({
      estimatesByJobId: new Map(),
      inventoryIssuesByJobId: new Map(),
      invoicesByJobId: new Map([
        [
          "job_1",
          {
            balanceDueCents: 0,
            status: "issued",
            updatedAt: "2026-04-03T12:00:00.000Z"
          }
        ]
      ]),
      jobs: [
        {
          customerDisplayName: "Customer",
          id: "job_1",
          status: "completed",
          title: "Brake service",
          vehicleDisplayName: "2019 Ford Transit"
        }
      ],
      openPaymentHandoffCountByJobId: new Map([["job_1", 2]]),
      openPartRequestsByJobId: new Map()
    });

    expect(summary.financeBlockedCount).toBe(1);
    expect(summary.blockedJobCount).toBe(1);
    expect(summary.financeBlockedItems[0]?.openPaymentHandoffCount).toBe(2);
  });
});
