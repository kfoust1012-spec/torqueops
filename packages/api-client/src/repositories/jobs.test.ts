import { describe, expect, it } from "vitest";

import { buildTechnicianDashboardSummary } from "./jobs";

describe("buildTechnicianDashboardSummary", () => {
  it("counts assigned today using the company timezone instead of UTC", () => {
    const summary = buildTechnicianDashboardSummary(
      [
        {
          scheduled_start_at: "2026-03-09T20:00:00.000Z",
          status: "scheduled"
        },
        {
          scheduled_start_at: "2026-03-10T00:30:00.000Z",
          status: "dispatched"
        },
        {
          scheduled_start_at: "2026-03-11T08:00:00.000Z",
          status: "in_progress"
        }
      ],
      "America/Los_Angeles",
      new Date("2026-03-10T06:30:00.000Z")
    );

    expect(summary).toEqual({
      assignedTodayCount: 2,
      inProgressCount: 1,
      upcomingCount: 2
    });
  });
});