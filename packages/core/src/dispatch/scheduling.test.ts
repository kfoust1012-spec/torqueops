import { describe, expect, it } from "vitest";

import {
  getDispatchRange,
  getWeekStartDate,
  shiftDispatchDate,
  toDispatchDateTimeInput,
  zonedLocalDateTimeToUtc
} from "./scheduling";

describe("dispatch scheduling helpers", () => {
  it("derives the monday week start for any day in the week", () => {
    expect(getWeekStartDate("2026-03-11")).toBe("2026-03-09");
    expect(getWeekStartDate("2026-03-15")).toBe("2026-03-09");
  });

  it("builds a week range using the company timezone", () => {
    const range = getDispatchRange("2026-03-11", "week", "America/New_York");

    expect(range.visibleDays).toHaveLength(7);
    expect(range.visibleDays[0]?.date).toBe("2026-03-09");
    expect(range.visibleDays[6]?.date).toBe("2026-03-15");
    expect(range.rangeStartAt).toBe("2026-03-09T04:00:00.000Z");
    expect(range.rangeEndAt).toBe("2026-03-16T04:00:00.000Z");
  });

  it("converts local dispatch times to utc and back to datetime-local inputs", () => {
    const utcValue = zonedLocalDateTimeToUtc("2026-03-09T08:30", "America/New_York");

    expect(utcValue.toISOString()).toBe("2026-03-09T12:30:00.000Z");
    expect(toDispatchDateTimeInput(utcValue.toISOString(), "America/New_York")).toBe(
      "2026-03-09T08:30"
    );
  });

  it("shifts day and week anchors by the correct interval", () => {
    expect(shiftDispatchDate("2026-03-11", "day", 1)).toBe("2026-03-12");
    expect(shiftDispatchDate("2026-03-11", "week", -1)).toBe("2026-03-04");
    expect(shiftDispatchDate("2026-03-31", "month", 1)).toBe("2026-04-30");
  });
});
