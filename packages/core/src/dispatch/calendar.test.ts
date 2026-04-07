import { describe, expect, it } from "vitest";

import { getDispatchCalendarRange } from "./calendar";

describe("dispatch calendar helpers", () => {
  it("builds a full month range anchored to visible week boundaries", () => {
    const range = getDispatchCalendarRange({
      date: "2026-03-13",
      settings: {
        companyId: "company-1",
        createdAt: "2026-03-01T00:00:00.000Z",
        dayEndHour: 19,
        dayStartHour: 7,
        defaultView: "day",
        showSaturday: true,
        showSunday: true,
        slotMinutes: 30,
        updatedAt: "2026-03-01T00:00:00.000Z",
        updatedByUserId: "user-1",
        weekStartsOn: 1
      },
      timeZone: "America/Chicago",
      view: "month"
    });

    expect(range.view).toBe("month");
    expect(range.visibleDays).toHaveLength(42);
    expect(range.visibleDays[0]?.date).toBe("2026-02-23");
    expect(range.visibleDays[41]?.date).toBe("2026-04-05");
  });
});
