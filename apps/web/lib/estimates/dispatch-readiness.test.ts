import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  isTechnicianActiveFieldJobStatus: (status: string) =>
    [
      "dispatched",
      "en_route",
      "arrived",
      "diagnosing",
      "waiting_approval",
      "waiting_parts",
      "repairing",
      "ready_for_payment",
      "in_progress"
    ].includes(status),
  isTechnicianOnSiteJobStatus: (status: string) =>
    [
      "arrived",
      "diagnosing",
      "waiting_approval",
      "waiting_parts",
      "repairing",
      "ready_for_payment",
      "in_progress"
    ].includes(status)
}));

import {
  getEstimateBulkDispatchUpdateReadiness,
  getEstimateBulkOwnerReadiness,
  getEstimateBulkPromiseReadiness,
  getEstimateBulkReleaseReadiness,
  getEstimateOnBoardStatusRiskRank,
  isEstimateApprovedReleaseAlreadyOnBoard,
  type EstimateDeskJobState
} from "./dispatch-readiness";

function createJob(overrides: Partial<EstimateDeskJobState> = {}): EstimateDeskJobState {
  return {
    arrivalWindowStartAt: null,
    assignedTechnicianUserId: "tech-1",
    id: "job-1",
    isActive: true,
    scheduledStartAt: null,
    status: "new",
    ...overrides
  };
}

describe("estimate dispatch readiness", () => {
  it("blocks owner and promise edits once field work is active", () => {
    const waitingPartsJob = createJob({ status: "waiting_parts" });

    expect(getEstimateBulkOwnerReadiness(waitingPartsJob)).toEqual({
      blockedReason: "Visit is already live in dispatch.",
      isReady: false
    });
    expect(getEstimateBulkPromiseReadiness(waitingPartsJob)).toEqual({
      blockedReason: "Visit is already live in dispatch.",
      isReady: false
    });
  });

  it("allows release only when a new visit is fully ready to dispatch", () => {
    expect(
      getEstimateBulkReleaseReadiness(createJob({ status: "new" }), {
        workflowState: "ready_to_dispatch"
      })
    ).toEqual({
      blockedReason: null,
      isReady: true
    });

    expect(
      getEstimateBulkReleaseReadiness(createJob({ status: "new" }), {
        workflowState: "needs_assignment"
      })
    ).toEqual({
      blockedReason: "Assign a field owner before releasing this visit.",
      isReady: false
    });
  });

  it("treats scheduled and active field visits as already on board", () => {
    expect(
      isEstimateApprovedReleaseAlreadyOnBoard({
        job: createJob({ status: "scheduled" })
      })
    ).toBe(true);
    expect(
      isEstimateApprovedReleaseAlreadyOnBoard({
        job: createJob({ status: "ready_for_payment" })
      })
    ).toBe(true);
    expect(
      isEstimateApprovedReleaseAlreadyOnBoard({
        job: createJob({ status: "new" })
      })
    ).toBe(false);
  });

  it("keeps already-live timing updates in the en-route follow-through bucket", () => {
    expect(
      getEstimateBulkDispatchUpdateReadiness(createJob({ status: "scheduled" }))
    ).toEqual({
      blockedReason: null,
      isReady: true,
      updateType: "dispatched"
    });

    expect(
      getEstimateBulkDispatchUpdateReadiness(createJob({ status: "waiting_approval" }))
    ).toEqual({
      blockedReason: null,
      isReady: true,
      updateType: "en_route"
    });
  });

  it("ranks travel below on-site field work for follow-through risk", () => {
    expect(getEstimateOnBoardStatusRiskRank("scheduled")).toBe(1);
    expect(getEstimateOnBoardStatusRiskRank("en_route")).toBe(2);
    expect(getEstimateOnBoardStatusRiskRank("arrived")).toBe(3);
    expect(getEstimateOnBoardStatusRiskRank("ready_for_payment")).toBe(3);
    expect(getEstimateOnBoardStatusRiskRank("canceled")).toBe(0);
  });
});
