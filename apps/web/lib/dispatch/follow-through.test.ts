import { describe, expect, it, vi } from "vitest";
import type { DispatchCalendarJobEvent } from "@mobile-mechanic/types";

vi.mock("@mobile-mechanic/core", () => ({
  isTechnicianOnSiteJobStatus: (status: string) =>
    ["arrived", "diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "in_progress"].includes(status),
  isTechnicianTravelJobStatus: (status: string) => ["dispatched", "en_route"].includes(status)
}));

import {
  buildDispatchOnBoardFollowThroughItems,
  formatDispatchFollowThroughAgeLabel,
  getDispatchLaneFollowThroughPressureScore,
  getDispatchOnBoardFollowThroughActionLabel,
  getDispatchOnBoardFollowThroughRiskScore,
  needsDispatchPromiseIntervention,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "./follow-through";

const now = new Date("2026-03-29T15:00:00.000Z");

function buildJob(
  overrides?: Partial<DispatchCalendarJobEvent>
): DispatchCalendarJobEvent {
  return {
    arrivalWindowEndAt: "2026-03-29T15:30:00.000Z",
    arrivalWindowStartAt: "2026-03-29T15:00:00.000Z",
    assignedTechnicianName: "Alex Lane",
    assignedTechnicianUserId: "tech-1",
    companyId: "company-1",
    customerDisplayName: "Jordan Fleet",
    customerId: "customer-1",
    dayDate: "2026-03-29",
    durationMinutes: 60,
    eventEndAt: "2026-03-29T15:30:00.000Z",
    eventStartAt: "2026-03-29T15:00:00.000Z",
    id: "job-1",
    isActive: true,
    isOutsideVisibleHours: false,
    overlapsAvailability: false,
    overlapsOtherJobs: false,
    priority: "normal",
    resourceTechnicianUserId: "tech-1",
    scheduledEndAt: "2026-03-29T15:30:00.000Z",
    scheduledStartAt: "2026-03-29T15:00:00.000Z",
    serviceSiteId: null,
    status: "dispatched" as const,
    title: "Battery replacement",
    trackCount: 1,
    trackIndex: 0,
    vehicleDisplayName: "2019 Ford Transit",
    vehicleId: "vehicle-1",
    ...overrides
  };
}

function buildPromiseSummary(
  overrides?: Partial<DispatchOnBoardPromiseSummary>
): DispatchOnBoardPromiseSummary {
  return {
    breachRisk: "none",
    confidenceLabel: "High confidence",
    confidencePercent: 88,
    copy: "The customer has recent timing context tied to this visit.",
    label: "On track",
    lastCustomerUpdateAt: "2026-03-29T14:40:00.000Z",
    lastCustomerUpdateLabel: "Updated 20 min ago",
    nextUpdateLabel: "No update due",
    owner: "Dispatch",
    promisedAt: "2026-03-29T15:00:00.000Z",
    recommendedAction: null,
    tone: "success",
    ...overrides
  };
}

describe("dispatch on-board follow-through", () => {
  it("ranks stale en-route follow-through above routine on-board work", () => {
    const highRiskJob = buildJob({ id: "job-risk", status: "dispatched", title: "Late roadside help" });
    const steadyJob = buildJob({ id: "job-steady", status: "scheduled", title: "Routine oil service" });
    const items = buildDispatchOnBoardFollowThroughItems({
      jobs: [steadyJob, highRiskJob],
      now,
      promiseSummariesByJobId: new Map([
        [
          highRiskJob.id,
          buildPromiseSummary({
            breachRisk: "high",
            confidenceLabel: "Broken promise",
            confidencePercent: 12,
            copy: "The promised timing has already slipped and the customer has not been updated.",
            label: "Promise missed",
            lastCustomerUpdateAt: null,
            lastCustomerUpdateLabel: "No customer timing update logged",
            nextUpdateLabel: "Due now",
            recommendedAction: "en_route",
            tone: "danger"
          })
        ],
        [
          steadyJob.id,
          buildPromiseSummary({
            confidencePercent: 90,
            label: "On track",
            lastCustomerUpdateAt: "2026-03-29T14:55:00.000Z",
            lastCustomerUpdateLabel: "Updated 5 min ago",
            nextUpdateLabel: "No update due",
            recommendedAction: null,
            tone: "success"
          })
        ]
      ])
    });

    expect(items[0]?.job.id).toBe(highRiskJob.id);
    expect(items[0]?.riskScore).toBeGreaterThan(items[1]?.riskScore ?? 0);
  });

  it("pushes watch-level confirmation gaps above quiet live jobs", () => {
    const confirmationGapJob = buildJob({ id: "job-confirm", status: "scheduled", title: "Brake follow-up" });
    const quietLiveJob = buildJob({ id: "job-quiet", status: "in_progress", title: "Inspection wrap-up" });
    const confirmationGapScore = getDispatchOnBoardFollowThroughRiskScore({
      job: confirmationGapJob,
      now,
      promiseSummary: buildPromiseSummary({
        breachRisk: "watch",
        confidenceLabel: "Watch closely",
        confidencePercent: 55,
        copy: "The visit is approaching its promise window and no appointment confirmation is logged.",
        label: "Confirm timing",
        lastCustomerUpdateAt: null,
        lastCustomerUpdateLabel: "No customer timing update logged",
        nextUpdateLabel: "Due in 20 min",
        owner: "Service advisor",
        recommendedAction: "appointment_confirmation",
        tone: "warning"
      })
    });
    const quietLiveScore = getDispatchOnBoardFollowThroughRiskScore({
      job: quietLiveJob,
      now,
      promiseSummary: buildPromiseSummary({
        confidenceLabel: "On site",
        confidencePercent: 85,
        copy: "Field work is in motion.",
        label: "Working now",
        nextUpdateLabel: "Update only if timing changes",
        recommendedAction: null,
        tone: "success"
      })
    });

    expect(confirmationGapScore).toBeGreaterThan(quietLiveScore);
  });

  it("treats waiting-parts stops as live field risk instead of routine on-site noise", () => {
    const waitingPartsScore = getDispatchOnBoardFollowThroughRiskScore({
      job: buildJob({ id: "job-parts", status: "waiting_parts", title: "Parts hold" }),
      now,
      promiseSummary: buildPromiseSummary({
        confidenceLabel: "On site",
        confidencePercent: 72,
        label: "Waiting on parts",
        recommendedAction: null,
        tone: "warning"
      })
    });
    const quietLiveScore = getDispatchOnBoardFollowThroughRiskScore({
      job: buildJob({ id: "job-live", status: "in_progress", title: "Routine work" }),
      now,
      promiseSummary: buildPromiseSummary({
        confidenceLabel: "On site",
        confidencePercent: 85,
        label: "Working now",
        recommendedAction: null,
        tone: "success"
      })
    });

    expect(waitingPartsScore).toBeGreaterThan(quietLiveScore);
  });

  it("maps customer-update actions into concise operator labels", () => {
    expect(getDispatchOnBoardFollowThroughActionLabel("dispatched")).toBe("Send dispatched");
    expect(getDispatchOnBoardFollowThroughActionLabel("en_route")).toBe("Send en route");
    expect(getDispatchOnBoardFollowThroughActionLabel("appointment_confirmation")).toBe(
      "Confirm timing"
    );
    expect(getDispatchOnBoardFollowThroughActionLabel(null)).toBe("Review thread");
  });

  it("treats only warning and danger summaries with actions as active promise intervention", () => {
    expect(
      needsDispatchPromiseIntervention(
        buildPromiseSummary({
          recommendedAction: "en_route",
          tone: "danger"
        })
      )
    ).toBe(true);
    expect(
      needsDispatchPromiseIntervention(
        buildPromiseSummary({
          recommendedAction: "appointment_confirmation",
          tone: "warning"
        })
      )
    ).toBe(true);
    expect(
      needsDispatchPromiseIntervention(
        buildPromiseSummary({
          recommendedAction: null,
          tone: "success"
        })
      )
    ).toBe(false);
    expect(
      needsDispatchPromiseIntervention(
        buildPromiseSummary({
          recommendedAction: "dispatched",
          tone: "brand"
        })
      )
    ).toBe(false);
  });

  it("summarizes lane follow-through pressure with count and stalest update", () => {
    const items = buildDispatchOnBoardFollowThroughItems({
      jobs: [
        buildJob({ id: "job-a", status: "dispatched", title: "Late roadside help" }),
        buildJob({ id: "job-b", status: "scheduled", title: "Brake follow-up" }),
        buildJob({ id: "job-c", status: "in_progress", title: "Quiet inspection" })
      ],
      now,
      promiseSummariesByJobId: new Map([
        [
          "job-a",
          buildPromiseSummary({
            breachRisk: "high",
            confidencePercent: 12,
            lastCustomerUpdateAt: null,
            lastCustomerUpdateLabel: "No customer timing update logged",
            nextUpdateLabel: "Due now",
            recommendedAction: "en_route",
            tone: "danger"
          })
        ],
        [
          "job-b",
          buildPromiseSummary({
            breachRisk: "watch",
            confidencePercent: 55,
            lastCustomerUpdateAt: "2026-03-29T13:00:00.000Z",
            lastCustomerUpdateLabel: "Updated 2 hr ago",
            nextUpdateLabel: "Due in 20 min",
            recommendedAction: "appointment_confirmation",
            tone: "warning"
          })
        ],
        [
          "job-c",
          buildPromiseSummary({
            confidencePercent: 85,
            label: "Working now",
            recommendedAction: null,
            tone: "success"
          })
        ]
      ])
    });

    expect(summarizeDispatchLaneFollowThrough(items)).toEqual({
      attentionCount: 2,
      dangerCount: 1,
      highestRiskTone: "danger",
      staleLabel: "No update logged",
      staleMinutes: null
    });
  });

  it("formats stale follow-through age labels compactly", () => {
    expect(formatDispatchFollowThroughAgeLabel(null)).toBe("No update logged");
    expect(formatDispatchFollowThroughAgeLabel(42)).toBe("Stale 42m");
    expect(formatDispatchFollowThroughAgeLabel(135)).toBe("Stale 2h 15m");
  });

  it("weights stale lane timing pressure above routine lane load", () => {
    expect(
      getDispatchLaneFollowThroughPressureScore({
        attentionCount: 2,
        dangerCount: 1,
        highestRiskTone: "danger",
        staleLabel: "No update logged",
        staleMinutes: null
      })
    ).toBeGreaterThan(
      getDispatchLaneFollowThroughPressureScore({
        attentionCount: 1,
        dangerCount: 0,
        highestRiskTone: "warning",
        staleLabel: "Stale 42m",
        staleMinutes: 42
      })
    );
  });
});
