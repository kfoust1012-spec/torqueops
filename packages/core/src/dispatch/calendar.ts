import type {
  DispatchCalendarRange,
  DispatchCalendarSettings,
  DispatchCalendarSlot,
  DispatchCalendarView,
  DispatchCalendarVisibleDay
} from "@mobile-mechanic/types";

import {
  addMonthsToDateString,
  addDaysToDateString,
  getDispatchLocalDate,
  getMonthStartDate,
  getSafeTimeZone,
  zonedLocalDateTimeToUtc
} from "./scheduling";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid dispatch date: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function getWeekAnchorDate(value: string, weekStartsOn: number) {
  const parsed = parseDateOnly(value);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const dayOfWeek = date.getUTCDay();
  const shift = (dayOfWeek - weekStartsOn + 7) % 7;

  return addDaysToDateString(value, -shift);
}

function getMonthVisibleDateBounds(value: string, weekStartsOn: number) {
  const monthStart = getMonthStartDate(value);
  const nextMonthStart = getMonthStartDate(addMonthsToDateString(value, 1));
  const monthEnd = addDaysToDateString(nextMonthStart, -1);
  const startDate = getWeekAnchorDate(monthStart, weekStartsOn);
  const endDate = addDaysToDateString(getWeekAnchorDate(monthEnd, weekStartsOn), 6);

  return {
    dayCount:
      Math.round(
        (new Date(`${endDate}T00:00:00.000Z`).getTime() -
          new Date(`${startDate}T00:00:00.000Z`).getTime()) /
          86_400_000
      ) + 1,
    startDate
  };
}

function formatDispatchSlotTime(
  value: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options
  }).format(typeof value === "string" ? new Date(value) : value);
}

function buildVisibleDay(
  date: string,
  index: number,
  timeZone: string,
  view: DispatchCalendarView
): DispatchCalendarVisibleDay {
  const startAt = zonedLocalDateTimeToUtc(`${date}T00:00`, timeZone).toISOString();
  const endDate = addDaysToDateString(date, 1);
  const endAt = zonedLocalDateTimeToUtc(`${endDate}T00:00`, timeZone).toISOString();
  const anchorDate = zonedLocalDateTimeToUtc(`${date}T12:00`, timeZone);

  return {
    date,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(anchorDate),
    shortLabel: new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short"
    }).format(anchorDate),
    columnLabel:
      view === "day" && index === 0
        ? new Intl.DateTimeFormat("en-US", {
            timeZone,
            weekday: "long",
            month: "short",
            day: "numeric"
          }).format(anchorDate)
        : new Intl.DateTimeFormat("en-US", {
            timeZone,
            weekday: "short",
            month: "short",
            day: "numeric"
          }).format(anchorDate),
    startAt,
    endAt
  };
}

export function getDispatchCalendarRange(input: {
  date: string;
  settings: DispatchCalendarSettings;
  timeZone: string;
  view: DispatchCalendarView;
}): DispatchCalendarRange {
  const timeZone = getSafeTimeZone(input.timeZone);
  const monthBounds =
    input.view === "month"
      ? getMonthVisibleDateBounds(input.date, input.settings.weekStartsOn)
      : null;
  const anchorDate =
    input.view === "week"
      ? getWeekAnchorDate(input.date, input.settings.weekStartsOn)
      : monthBounds?.startDate ?? input.date;
  const dayCount = input.view === "week" ? 7 : monthBounds?.dayCount ?? 1;
  const visibleDays = Array.from({ length: dayCount }, (_, index) =>
    buildVisibleDay(addDaysToDateString(anchorDate, index), index, timeZone, input.view)
  ).filter((day) => {
    if (input.view === "day") {
      return true;
    }

    const weekday = new Date(day.startAt).getUTCDay();

    if (weekday === 0) {
      return input.settings.showSunday;
    }

    if (weekday === 6) {
      return input.settings.showSaturday;
    }

    return true;
  });

  const firstDay = visibleDays[0];
  const lastDay = visibleDays[visibleDays.length - 1];

  if (!firstDay || !lastDay) {
    throw new Error("Dispatch calendar must expose at least one visible day.");
  }

  return {
    view: input.view,
    date: input.date,
    rangeStartAt: firstDay.startAt,
    rangeEndAt: lastDay.endAt,
    visibleDays
  };
}

export function buildDispatchTimeSlots(input: {
  date: string;
  settings: DispatchCalendarSettings;
  timeZone: string;
}): DispatchCalendarSlot[] {
  const timeZone = getSafeTimeZone(input.timeZone);
  const slots: DispatchCalendarSlot[] = [];
  const totalMinutes = (input.settings.dayEndHour - input.settings.dayStartHour) * 60;
  const slotMinutes = input.settings.slotMinutes;

  for (let index = 0; index < totalMinutes / slotMinutes; index += 1) {
    const minutesFromDayStart = index * slotMinutes;
    const startHour = input.settings.dayStartHour + Math.floor(minutesFromDayStart / 60);
    const startMinute = minutesFromDayStart % 60;
    const slotDateTime = `${input.date}T${pad(startHour)}:${pad(startMinute)}`;
    const startsAt = zonedLocalDateTimeToUtc(slotDateTime, timeZone).toISOString();
    const nextMinutes = minutesFromDayStart + slotMinutes;
    const endHour = input.settings.dayStartHour + Math.floor(nextMinutes / 60);
    const endMinute = nextMinutes % 60;
    const endsAt = zonedLocalDateTimeToUtc(
      `${input.date}T${pad(endHour)}:${pad(endMinute)}`,
      timeZone
    ).toISOString();

    slots.push({
      index,
      minutesFromDayStart,
      startsAt,
      endsAt,
      label: formatDispatchSlotTime(startsAt, timeZone, {
        hour: "numeric",
        minute: "2-digit"
      }),
      shortLabel:
        startMinute === 0
          ? formatDispatchSlotTime(startsAt, timeZone, { hour: "numeric" })
          : formatDispatchSlotTime(startsAt, timeZone, {
              hour: "numeric",
              minute: "2-digit"
            })
    });
  }

  return slots;
}

export function snapToDispatchSlot(input: {
  date: string;
  minutesFromDayStart: number;
  settings: DispatchCalendarSettings;
  timeZone: string;
}) {
  const slotMinutes = input.settings.slotMinutes;
  const snappedMinutes =
    Math.round(input.minutesFromDayStart / slotMinutes) * slotMinutes;
  const maxMinutes =
    (input.settings.dayEndHour - input.settings.dayStartHour) * 60 - slotMinutes;
  const clampedMinutes = Math.min(Math.max(snappedMinutes, 0), Math.max(maxMinutes, 0));
  const nextHour = input.settings.dayStartHour + Math.floor(clampedMinutes / 60);
  const nextMinute = clampedMinutes % 60;

  return zonedLocalDateTimeToUtc(
    `${input.date}T${pad(nextHour)}:${pad(nextMinute)}`,
    input.timeZone
  ).toISOString();
}

export function clampDispatchEventBounds(input: {
  startsAt: string;
  endsAt: string | null;
  settings: DispatchCalendarSettings;
  timeZone: string;
}) {
  const timeZone = getSafeTimeZone(input.timeZone);
  const localDate = getDispatchLocalDate(input.startsAt, timeZone);
  const startBounds = zonedLocalDateTimeToUtc(
    `${localDate}T${pad(input.settings.dayStartHour)}:00`,
    timeZone
  ).toISOString();
  const endBounds = zonedLocalDateTimeToUtc(
    `${localDate}T${pad(input.settings.dayEndHour)}:00`,
    timeZone
  ).toISOString();

  const nextStart = new Date(Math.max(new Date(input.startsAt).getTime(), new Date(startBounds).getTime()));
  const nextEnd = new Date(
    Math.min(
      new Date(input.endsAt ?? input.startsAt).getTime(),
      new Date(endBounds).getTime()
    )
  );

  return {
    startsAt: nextStart.toISOString(),
    endsAt: nextEnd.toISOString()
  };
}
