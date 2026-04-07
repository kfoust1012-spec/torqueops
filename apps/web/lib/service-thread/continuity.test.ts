import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  isTechnicianActiveFieldJobStatus: (status: string) =>
    ["dispatched", "en_route", "arrived", "diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "in_progress"].includes(status),
  isTechnicianTravelJobStatus: (status: string) => ["dispatched", "en_route"].includes(status)
}));

import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveRouteConfidenceSnapshot,
  deriveVisitRouteConfidenceSnapshot
} from "./continuity";

describe("deriveReleaseRunwayState", () => {
  it("treats approved and ready scheduled work as ready for release", () => {
    expect(
      deriveReleaseRunwayState({
        estimateStatus: "approved",
        hasBlockingIssues: false,
        hasOwner: true,
        hasPromise: true,
        readinessReadyCount: 3,
        readinessTotalCount: 3,
        visitStatus: "scheduled"
      })
    ).toMatchObject({
      label: "Ready for release",
      state: "ready_for_release",
      tone: "brand"
    });
  });

  it("treats dispatched work as already placed", () => {
    expect(
      deriveReleaseRunwayState({
        estimateStatus: "approved",
        hasBlockingIssues: false,
        hasOwner: true,
        hasPromise: true,
        readinessReadyCount: 3,
        readinessTotalCount: 3,
        visitStatus: "dispatched"
      })
    ).toMatchObject({
      label: "Placed",
      state: "placed",
      tone: "success"
    });
  });

  it("treats waiting-approval work as already placed", () => {
    expect(
      deriveReleaseRunwayState({
        estimateStatus: "approved",
        hasBlockingIssues: false,
        hasOwner: true,
        hasPromise: true,
        readinessReadyCount: 3,
        readinessTotalCount: 3,
        visitStatus: "waiting_approval"
      })
    ).toMatchObject({
      label: "Placed",
      state: "placed",
      tone: "success"
    });
  });
});

describe("derivePromiseConfidenceSnapshot", () => {
  it("downgrades promise confidence when site, supply, and trust are weak", () => {
    expect(
      derivePromiseConfidenceSnapshot({
        hasServiceSitePlaybook: false,
        hasSupplyRisk: true,
        promiseSummary: {
          confidencePercent: 64,
          copy: "Promise is under pressure.",
          recommendedAction: "dispatched",
        },
        readinessSummary: {
          readyCount: 1,
          score: 40,
          totalCount: 3
        },
        releaseRunwayState: {
          copy: "Blocked",
          label: "Not ready",
          state: "not_ready",
          tone: "warning"
        },
        trustSummary: {
          risk: "high"
        }
      })
    ).toMatchObject({
      label: "Weak promise confidence",
      level: "weak",
      tone: "danger"
    });
  });
});

describe("deriveRouteConfidenceSnapshot", () => {
  it("scores a stable route as strong confidence", () => {
    expect(
      deriveRouteConfidenceSnapshot({
        hasLiveGps: true,
        hasPartsConfidence: true,
        hasServiceSitePlaybook: true,
        hasTechnicianReadiness: true,
        laneSlackMinutes: 75,
        promiseConfidencePercent: 92,
        routeIssueCount: 0
      })
    ).toMatchObject({
      label: "Strong route confidence",
      level: "strong",
      tone: "success"
    });
  });
});

describe("deriveVisitRouteConfidenceSnapshot", () => {
  it("downgrades a visit route when owner, site, and supply posture are weak", () => {
    expect(
      deriveVisitRouteConfidenceSnapshot({
        assignedTechnicianUserId: null,
        hasServiceSitePlaybook: false,
        hasSupplyRisk: true,
        promiseConfidencePercent: 58,
        visitStatus: "scheduled"
      })
    ).toMatchObject({
      label: "Weak route confidence",
      level: "weak",
      tone: "danger"
    });
  });

  it("treats on-site blocked work as live route context", () => {
    expect(
      deriveVisitRouteConfidenceSnapshot({
        assignedTechnicianUserId: "tech-1",
        hasServiceSitePlaybook: true,
        hasSupplyRisk: false,
        promiseConfidencePercent: 80,
        visitStatus: "waiting_parts"
      })
    ).toMatchObject({
      level: "strong"
    });
  });
});

describe("buildServiceSiteThreadSummary", () => {
  it("marks a missing site as a warning for fleet accounts", () => {
    expect(
      buildServiceSiteThreadSummary({
        activeVisitCount: 0,
        commercialAccountMode: "fleet_account",
        linkedAssetCount: 4,
        linkedVisitCount: 6,
        site: null
      })
    ).toMatchObject({
      label: "No service site thread",
      playbookState: "missing",
      tone: "warning"
    });
  });

  it("marks a site with playbook fields as ready", () => {
    expect(
      buildServiceSiteThreadSummary({
        activeVisitCount: 1,
        commercialAccountMode: "retail_customer",
        linkedAssetCount: 1,
        linkedVisitCount: 3,
        site: {
          accessWindowNotes: "Gate opens at 8",
          gateCode: "2044",
          id: "site-1",
          label: "service",
          line1: "123 Main",
          parkingNotes: null,
          serviceContactName: "Leah",
          serviceContactPhone: null,
          siteName: "North lot"
        }
      })
    ).toMatchObject({
      label: "Site thread live",
      playbookState: "ready",
      tone: "success"
    });
  });
});
