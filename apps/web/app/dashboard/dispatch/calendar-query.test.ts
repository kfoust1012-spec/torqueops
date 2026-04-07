import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  shiftDispatchDate: (date: string, view: string | undefined, direction: -1 | 1) => {
    if (view === "month") {
      return direction === 1 ? "2026-04-30" : "2026-02-28";
    }

    return date;
  }
}));

const calendarQueryModule = import("./calendar-query");

describe("dispatch calendar query helpers", () => {
  it("accepts month view from search params", async () => {
    const { parseDispatchCalendarSearchParams } = await calendarQueryModule;

    expect(
      parseDispatchCalendarSearchParams({
        defaultView: "day",
        fallbackDate: "2026-03-13",
        searchParams: {
          date: "2026-03-18",
          view: "month"
        }
      })
    ).toEqual({
      date: "2026-03-18",
      focusMode: false,
      includeUnassigned: true,
      jobId: "",
      resourceUserIds: [],
      savedViewId: "",
      scope: "all_workers",
      view: "month"
    });
  });

  it("shifts month dispatch hrefs by calendar month", async () => {
    const { shiftDispatchCalendarHref } = await calendarQueryModule;

    expect(
      shiftDispatchCalendarHref(
        {
          date: "2026-03-31",
          focusMode: false,
          includeUnassigned: true,
          jobId: "",
          resourceUserIds: [],
          savedViewId: "",
          scope: "all_workers",
          view: "month"
        },
        1
      )
    ).toBe("/dashboard/dispatch?date=2026-04-30&view=month&scope=all_workers&includeUnassigned=1");
  });
});
