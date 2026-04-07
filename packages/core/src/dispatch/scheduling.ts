import type {
  DispatchBoardQuery,
  DispatchBoardRange,
  DispatchBoardView,
  DispatchBoardVisibleDay,
  DispatchCalendarView
} from "@mobile-mechanic/types";

type DispatchDateTimeParts = {
  date: string;
  time: string;
};

const FALLBACK_TIME_ZONE = "UTC";

function pad(value: number): string {
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

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid dispatch datetime: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

function buildDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset"
  });
  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") {
    return 0;
  }

  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(timeZoneName);

  if (!match) {
    throw new Error(`Unsupported timezone offset format: ${timeZoneName}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getSafeTimeZone(value: string | null | undefined): string {
  if (!value) {
    return FALLBACK_TIME_ZONE;
  }

  return isValidTimeZone(value) ? value : FALLBACK_TIME_ZONE;
}

export function addDaysToDateString(value: string, days: number): string {
  const parsed = parseDateOnly(value);
  const nextDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));

  return buildDateString(nextDate);
}

export function addMonthsToDateString(value: string, months: number): string {
  const parsed = parseDateOnly(value);
  const monthAnchor = new Date(Date.UTC(parsed.year, parsed.month - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const nextDay = Math.min(parsed.day, lastDayOfTargetMonth);

  return buildDateString(
    new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), nextDay))
  );
}

export function getMonthStartDate(value: string): string {
  const parsed = parseDateOnly(value);

  return `${parsed.year}-${pad(parsed.month)}-01`;
}

export function getWeekStartDate(value: string): string {
  const parsed = parseDateOnly(value);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const dayOfWeek = date.getUTCDay();
  const shift = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return addDaysToDateString(value, shift);
}

export function zonedLocalDateTimeToUtc(value: string, timeZone: string): Date {
  const parsed = parseLocalDateTime(value);
  const normalizedTimeZone = getSafeTimeZone(timeZone);
  const utcGuess = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    0,
    0
  );
  let candidate = utcGuess;

  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(candidate), normalizedTimeZone);
    const nextCandidate = utcGuess - offsetMinutes * 60_000;

    if (nextCandidate === candidate) {
      break;
    }

    candidate = nextCandidate;
  }

  return new Date(candidate);
}

export function getDispatchDateTimeParts(
  value: Date | string,
  timeZone: string
): DispatchDateTimeParts {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getSafeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time: `${getPart("hour")}:${getPart("minute")}`
  };
}

export function getDispatchLocalDate(value: Date | string, timeZone: string): string {
  return getDispatchDateTimeParts(value, timeZone).date;
}

export function toDispatchDateTimeInput(
  value: Date | string | null | undefined,
  timeZone: string
): string {
  if (!value) {
    return "";
  }

  const parts = getDispatchDateTimeParts(value, timeZone);
  return `${parts.date}T${parts.time}`;
}

export function formatDispatchDateTime(
  value: Date | string | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: getSafeTimeZone(timeZone),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options
  }).format(typeof value === "string" ? new Date(value) : value);
}

function buildVisibleDay(date: string, timeZone: string): DispatchBoardVisibleDay {
  const startAt = zonedLocalDateTimeToUtc(`${date}T00:00`, timeZone).toISOString();
  const endDate = addDaysToDateString(date, 1);
  const endAt = zonedLocalDateTimeToUtc(`${endDate}T00:00`, timeZone).toISOString();
  const displayDate = zonedLocalDateTimeToUtc(`${date}T12:00`, timeZone);

  return {
    date,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: getSafeTimeZone(timeZone),
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(displayDate),
    shortLabel: new Intl.DateTimeFormat("en-US", {
      timeZone: getSafeTimeZone(timeZone),
      weekday: "short"
    }).format(displayDate),
    startAt,
    endAt
  };
}

export function getDispatchRange(
  date: string,
  view: DispatchBoardView,
  timeZone: string
): DispatchBoardRange {
  const normalizedTimeZone = getSafeTimeZone(timeZone);
  const anchorDate = view === "week" ? getWeekStartDate(date) : date;
  const visibleDays = Array.from({ length: view === "week" ? 7 : 1 }, (_, index) =>
    buildVisibleDay(addDaysToDateString(anchorDate, index), normalizedTimeZone)
  );
  const firstVisibleDay = visibleDays[0];
  const lastVisibleDay = visibleDays[visibleDays.length - 1];

  if (!firstVisibleDay || !lastVisibleDay) {
    throw new Error("Dispatch range requires at least one visible day.");
  }

  return {
    view,
    date,
    rangeStartAt: firstVisibleDay.startAt,
    rangeEndAt: lastVisibleDay.endAt,
    visibleDays
  };
}

export function shiftDispatchDate(
  date: string,
  view: DispatchBoardQuery["view"] | DispatchCalendarView | undefined,
  direction: -1 | 1
): string {
  if (view === "week") {
    return addDaysToDateString(date, direction * 7);
  }

  if (view === "month") {
    return addMonthsToDateString(date, direction);
  }

  return addDaysToDateString(date, direction);
}
