import type {
  DispatchCalendarQuery,
  DispatchCalendarScope,
  DispatchCalendarView
} from "@mobile-mechanic/types";
import { shiftDispatchDate } from "@mobile-mechanic/core";

type DispatchSearchParamValue = string | string[] | undefined;

type DispatchCalendarSearchParams = {
  date?: DispatchSearchParamValue;
  focus?: DispatchSearchParamValue;
  includeUnassigned?: DispatchSearchParamValue;
  jobId?: DispatchSearchParamValue;
  resourceUserIds?: DispatchSearchParamValue;
  savedViewId?: DispatchSearchParamValue;
  scope?: DispatchSearchParamValue;
  view?: DispatchSearchParamValue;
};

export type DispatchCalendarPageState = {
  date: string;
  focusMode: boolean;
  includeUnassigned: boolean;
  jobId: string;
  resourceUserIds: string[];
  savedViewId: string;
  scope: DispatchCalendarScope;
  view: DispatchCalendarView;
};

function getSearchParam(value: DispatchSearchParamValue): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSearchValues(value: DispatchSearchParamValue): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function parseBoolean(value: DispatchSearchParamValue, fallback: boolean) {
  const normalized = getSearchParam(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseDispatchCalendarSearchParams(input: {
  defaultView: DispatchCalendarView;
  fallbackDate: string;
  searchParams: DispatchCalendarSearchParams;
}): DispatchCalendarPageState {
  const requestedDate = getSearchParam(input.searchParams.date);
  const requestedView = getSearchParam(input.searchParams.view);
  const requestedScope = getSearchParam(input.searchParams.scope);
  const requestedSavedViewId = getSearchParam(input.searchParams.savedViewId);
  const requestedJobId = getSearchParam(input.searchParams.jobId);
  const requestedResourceUserIds = getSearchValues(input.searchParams.resourceUserIds);

  return {
    date: isValidDateString(requestedDate) ? requestedDate : input.fallbackDate,
    focusMode: parseBoolean(input.searchParams.focus, false),
    includeUnassigned: parseBoolean(input.searchParams.includeUnassigned, true),
    jobId: isValidUuid(requestedJobId) ? requestedJobId : "",
    resourceUserIds: requestedResourceUserIds.filter(isValidUuid),
    savedViewId: isValidUuid(requestedSavedViewId) ? requestedSavedViewId : "",
    scope:
      requestedScope === "single_tech" || requestedScope === "subset"
        ? (requestedScope as DispatchCalendarScope)
        : "all_workers",
    view:
      requestedView === "day" || requestedView === "week" || requestedView === "month"
        ? requestedView
        : input.defaultView
  };
}

export function buildDispatchCalendarHref(
  current: DispatchCalendarPageState,
  patch: Partial<DispatchCalendarPageState>
) {
  const next: DispatchCalendarPageState = {
    date: patch.date ?? current.date,
    focusMode: patch.focusMode ?? current.focusMode,
    includeUnassigned: patch.includeUnassigned ?? current.includeUnassigned,
    jobId: patch.jobId ?? current.jobId,
    resourceUserIds: patch.resourceUserIds ?? current.resourceUserIds,
    savedViewId: patch.savedViewId ?? current.savedViewId,
    scope: patch.scope ?? current.scope,
    view: patch.view ?? current.view
  };
  const params = new URLSearchParams();

  params.set("date", next.date);
  params.set("view", next.view);
  params.set("scope", next.scope);
  if (next.focusMode) {
    params.set("focus", "1");
  }
  params.set("includeUnassigned", next.includeUnassigned ? "1" : "0");

  if (next.savedViewId) {
    params.set("savedViewId", next.savedViewId);
  }

  if (next.resourceUserIds.length) {
    params.set("resourceUserIds", next.resourceUserIds.join(","));
  }

  if (next.jobId) {
    params.set("jobId", next.jobId);
  }

  return `/dashboard/dispatch?${params.toString()}`;
}

export function shiftDispatchCalendarHref(
  current: DispatchCalendarPageState,
  direction: -1 | 1
) {
  return buildDispatchCalendarHref(current, {
    date: shiftDispatchDate(current.date, current.view, direction)
  });
}

export function toDispatchCalendarQuery(
  state: DispatchCalendarPageState
): DispatchCalendarQuery {
  return {
    date: state.date,
    includeUnassigned: state.includeUnassigned,
    resourceUserIds: state.resourceUserIds,
    savedViewId: state.savedViewId || undefined,
    scope: state.scope,
    view: state.view
  };
}
