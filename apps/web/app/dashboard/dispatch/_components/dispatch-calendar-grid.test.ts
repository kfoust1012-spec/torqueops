import { describe, expect, it, vi } from "vitest";
import type { DispatchCalendarJobEvent, DispatchCalendarSettings } from "@mobile-mechanic/types";

import {
  buildMoveDispatchInput,
  buildResizeDispatchInput
} from "./dispatch-calendar-grid";

vi.mock("@mobile-mechanic/core", () => ({
  clampDispatchEventBounds: (input: {
    endsAt: string | null;
    settings: DispatchCalendarSettings;
    startsAt: string;
  }) => {
    const localDate = input.startsAt.slice(0, 10);
    const startBounds = `${localDate}T${String(input.settings.dayStartHour).padStart(2, "0")}:00:00.000Z`;
    const endBounds = `${localDate}T${String(input.settings.dayEndHour).padStart(2, "0")}:00:00.000Z`;
    const nextStart = new Date(
      Math.max(new Date(input.startsAt).getTime(), new Date(startBounds).getTime())
    );
    const nextEnd = new Date(
      Math.min(
        new Date(input.endsAt ?? input.startsAt).getTime(),
        new Date(endBounds).getTime()
      )
    );

    return {
      endsAt: nextEnd.toISOString(),
      startsAt: nextStart.toISOString()
    };
  },
  formatDispatchDateTime: (value: string | null | undefined) => value ?? "",
  getDispatchLocalDate: (value: string | Date) => {
    const date = typeof value === "string" ? value : value.toISOString();
    return date.slice(0, 10);
  },
  getMinutesIntoDispatchDay: (input: {
    settings: DispatchCalendarSettings;
    value: string;
  }) => {
    const date = new Date(input.value);
    return (date.getUTCHours() - input.settings.dayStartHour) * 60 + date.getUTCMinutes();
  },
  snapToDispatchSlot: (input: {
    date: string;
    minutesFromDayStart: number;
    settings: DispatchCalendarSettings;
  }) => {
    const slotMinutes = input.settings.slotMinutes;
    const snappedMinutes = Math.round(input.minutesFromDayStart / slotMinutes) * slotMinutes;
    const maxMinutes =
      (input.settings.dayEndHour - input.settings.dayStartHour) * 60 - slotMinutes;
    const clampedMinutes = Math.min(Math.max(snappedMinutes, 0), Math.max(maxMinutes, 0));
    const hour = input.settings.dayStartHour + Math.floor(clampedMinutes / 60);
    const minute = clampedMinutes % 60;

    return `${input.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  }
}));

const settings: DispatchCalendarSettings = {
  companyId: "company-1",
  createdAt: "2026-03-01T00:00:00.000Z",
  dayEndHour: 17,
  dayStartHour: 7,
  defaultView: "day",
  showSaturday: true,
  showSunday: false,
  slotMinutes: 30,
  updatedAt: "2026-03-01T00:00:00.000Z",
  updatedByUserId: "dispatcher-1",
  weekStartsOn: 1
};

function createJobEvent(
  overrides: Partial<DispatchCalendarJobEvent> = {}
): DispatchCalendarJobEvent {
  return {
    arrivalWindowEndAt: "2026-03-22T14:30:00.000Z",
    arrivalWindowStartAt: "2026-03-22T14:00:00.000Z",
    assignedTechnicianName: "Alex Tech",
    assignedTechnicianUserId: "tech-1",
    companyId: "company-1",
    customerDisplayName: "Taylor Driver",
    customerId: "customer-1",
    dayDate: "2026-03-22",
    durationMinutes: 60,
    eventEndAt: "2026-03-22T15:00:00.000Z",
    eventStartAt: "2026-03-22T14:00:00.000Z",
    id: "job-1",
    isActive: true,
    isOutsideVisibleHours: false,
    overlapsAvailability: false,
    overlapsOtherJobs: false,
    priority: "normal",
    resourceTechnicianUserId: "tech-1",
    scheduledEndAt: "2026-03-22T15:00:00.000Z",
    scheduledStartAt: "2026-03-22T14:00:00.000Z",
    status: "scheduled",
    title: "Brake service",
    trackCount: 1,
    trackIndex: 0,
    vehicleDisplayName: "2022 Ford Transit",
    vehicleId: "vehicle-1",
    ...overrides
  };
}

describe("dispatch calendar keyboard helpers", () => {
  it("builds move input and shifts arrival windows with the new start time", () => {
    const move = buildMoveDispatchInput({
      job: createJobEvent(),
      resourceUserId: "tech-2",
      scheduledStartAt: "2026-03-22T16:00:00.000Z",
      settings,
      timeZone: "UTC"
    });

    expect(move.assignedTechnicianUserId).toBe("tech-2");
    expect(move.scheduledStartAt).toBe("2026-03-22T16:00:00.000Z");
    expect(move.scheduledEndAt).toBe("2026-03-22T17:00:00.000Z");
    expect(move.arrivalWindowStartAt).toBe("2026-03-22T16:00:00.000Z");
    expect(move.arrivalWindowEndAt).toBe("2026-03-22T16:30:00.000Z");
  });

  it("builds resize input and enforces the minimum slot duration", () => {
    const resize = buildResizeDispatchInput({
      job: createJobEvent(),
      scheduledEndAt: "2026-03-22T14:10:00.000Z",
      settings,
      timeZone: "UTC"
    });

    expect(resize.scheduledEndAt).toBe("2026-03-22T14:30:00.000Z");
  });

  it("builds resize input and clamps the stop to the end of the dispatch day", () => {
    const resize = buildResizeDispatchInput({
      job: createJobEvent({
        arrivalWindowEndAt: null,
        arrivalWindowStartAt: null,
        eventEndAt: "2026-03-22T16:30:00.000Z",
        scheduledEndAt: "2026-03-22T16:30:00.000Z",
        scheduledStartAt: "2026-03-22T16:00:00.000Z"
      }),
      scheduledEndAt: "2026-03-22T18:30:00.000Z",
      settings,
      timeZone: "UTC"
    });

    expect(resize.scheduledEndAt).toBe("2026-03-22T17:00:00.000Z");
  });
});
