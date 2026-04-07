import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DispatchCalendarJobEvent } from "@mobile-mechanic/types";

import type { DispatchOnBoardPromiseSummary } from "../../../../lib/dispatch/follow-through";
import { DispatchVisitEvent } from "./dispatch-visit-event";

vi.mock("@mobile-mechanic/core", () => ({
  formatDispatchDateTime: (value: string | null | undefined) => value ?? "Not scheduled"
}));

function createEvent(overrides: Partial<DispatchCalendarJobEvent> = {}): DispatchCalendarJobEvent {
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
    status: "dispatched",
    title: "Battery replacement",
    trackCount: 1,
    trackIndex: 0,
    vehicleDisplayName: "2019 Ford Transit",
    vehicleId: "vehicle-1",
    ...overrides
  };
}

function createPromiseSummary(
  overrides: Partial<DispatchOnBoardPromiseSummary> = {}
): DispatchOnBoardPromiseSummary {
  return {
    breachRisk: "high",
    confidenceLabel: "Broken promise",
    confidencePercent: 12,
    copy: "The promised timing has already slipped.",
    label: "Promise missed",
    lastCustomerUpdateAt: null,
    lastCustomerUpdateLabel: "No customer timing update logged",
    nextUpdateLabel: "Due now",
    owner: "Dispatch",
    promisedAt: "2026-03-29T15:00:00.000Z",
    recommendedAction: "en_route",
    tone: "danger",
    ...overrides
  };
}

describe("DispatchVisitEvent", () => {
  it("renders a follow-through chip and latest customer-update text for risky live stops", () => {
    const html = renderToStaticMarkup(
      <DispatchVisitEvent
        event={createEvent()}
        now={new Date("2026-03-29T16:00:00.000Z")}
        onClick={() => {}}
        onDragEnd={() => {}}
        onDragStart={() => {}}
        onResizeStart={() => {}}
        promiseSummary={createPromiseSummary()}
        style={{}}
        timezone="UTC"
      />
    );

    expect(html).toContain("Send en route");
    expect(html).toContain("No customer timing update logged");
  });
});
