import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCustomerApprovalRiskSummary,
  getCustomerBalanceRiskSummary,
  getCustomerFollowUpRiskSummary,
  getCustomerNextMove,
  getCustomerRecordHealth,
  getCustomerRiskAction,
  getCustomerThreadActionTarget
} from "./support";

describe("customer support helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("summarizes missing customer record fields", () => {
    expect(getCustomerRecordHealth({ email: null, phone: null }, [], [])).toEqual({
      detail: "Missing contact, address, vehicle.",
      label: "Needs 3 fixes",
      tone: "danger"
    });
  });

  it("summarizes approval, balance, and follow-up risk", () => {
    expect(getCustomerApprovalRiskSummary({ activeVisitCount: 1, pendingApprovalCount: 2 })).toMatchObject({
      label: "Approval pileup",
      tone: "danger"
    });
    expect(getCustomerBalanceRiskSummary(5000)).toMatchObject({ label: "Money open", tone: "brand" });
    expect(
      getCustomerFollowUpRiskSummary({ activeFollowUpVisitCount: 2, followUpRecoveryOwner: "service" })
    ).toMatchObject({ label: "Return work active", tone: "warning" });
  });

  it("prioritizes promised visit recovery in customer next move", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(
      getCustomerNextMove({
        activeFollowUpVisits: [],
        activeVisits: [
          {
            estimate: null,
            jobId: "job-1",
            scheduledStartAt: "2026-03-25T10:00:00.000Z"
          }
        ],
        customerId: "cust-1",
        customerName: "Alex Rivera",
        openBalanceCents: 0
      })
    ).toMatchObject({ href: "/dashboard/visits?jobId=job-1", label: "Recover promised visit" });
  });

  it("routes customer thread actions from the explicit thread intent", () => {
    expect(
      getCustomerThreadActionTarget({
        customerName: "Alex Rivera",
        leadVisit: { jobId: "job-1", vehicleId: "veh-1" },
        summary: { copy: "Approval is waiting." },
        threadIntent: "approval"
      })
    ).toMatchObject({ label: "Work approval thread", tone: "primary" });
  });

  it("chooses customer risk action in the expected priority order", () => {
    expect(
      getCustomerRiskAction({
        activeFollowUpVisitCount: 0,
        customerDisplayName: "Alex Rivera",
        customerNextMove: null,
        openBalanceCents: 0,
        pendingApprovalCount: 1,
        promiseRisk: "low",
        selectedCustomerFinanceBlocker: null,
        selectedCustomerSupplyBlocker: null,
        trustRisk: "low"
      })
    ).toMatchObject({ label: "Work approval thread" });

    expect(
      getCustomerRiskAction({
        activeFollowUpVisitCount: 0,
        customerDisplayName: "Alex Rivera",
        customerNextMove: null,
        openBalanceCents: 0,
        pendingApprovalCount: 0,
        promiseRisk: "high",
        selectedCustomerFinanceBlocker: null,
        selectedCustomerSupplyBlocker: null,
        trustRisk: "low"
      })
    ).toMatchObject({ label: "Recover promise risk" });
  });
});