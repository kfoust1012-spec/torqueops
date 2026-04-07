import {
  formatDispatchDateTime,
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { DispatchBoardJobItem, DispatchCalendarJobEvent } from "@mobile-mechanic/types";

import type { BadgeTone } from "../../../../components/ui";
import { getVisitNextMove } from "../../../../lib/jobs/workflow";

type DispatchOperationalJob = Pick<
  DispatchBoardJobItem,
  | "arrivalWindowEndAt"
  | "arrivalWindowStartAt"
  | "assignedTechnicianName"
  | "customerDisplayName"
  | "isActive"
  | "priority"
  | "scheduledEndAt"
  | "scheduledStartAt"
  | "status"
  | "title"
  | "vehicleDisplayName"
> &
  Partial<Pick<DispatchCalendarJobEvent, "durationMinutes" | "eventEndAt" | "eventStartAt">>;

type DispatchOperationalSignal = {
  label: string;
  tone: BadgeTone;
};

type DispatchTimelineProgress = {
  isLate: boolean;
  isLive: boolean;
  progressPercent: number | null;
};

export type DispatchVisitOperationalSignal = DispatchOperationalSignal;
export type DispatchVisitTimelineProgress = DispatchTimelineProgress;

function getStartAt(job: DispatchOperationalJob) {
  return job.eventStartAt ?? job.scheduledStartAt ?? null;
}

function getEndAt(job: DispatchOperationalJob) {
  return job.eventEndAt ?? job.scheduledEndAt ?? getStartAt(job);
}

function formatRelativeMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatDispatchDuration(durationMinutes: number) {
  return formatRelativeMinutes(durationMinutes);
}

export function formatDispatchShortTime(
  value: string | null | undefined,
  timeZone: string
) {
  return formatDispatchDateTime(value, timeZone, {
    day: undefined,
    hour: "numeric",
    minute: "2-digit",
    month: undefined
  });
}

export function formatDispatchShortRange(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  timeZone: string
) {
  if (!startAt) {
    return "No time set";
  }

  const startLabel = formatDispatchShortTime(startAt, timeZone);

  if (!endAt) {
    return startLabel;
  }

  return `${startLabel} - ${formatDispatchShortTime(endAt, timeZone)}`;
}

export function formatDispatchArrivalWindow(
  job: DispatchOperationalJob,
  timeZone: string
) {
  if (!job.arrivalWindowStartAt) {
    return null;
  }

  return formatDispatchShortRange(
    job.arrivalWindowStartAt,
    job.arrivalWindowEndAt,
    timeZone
  );
}

export function getDispatchVisitOperationalSignal(
  job: DispatchOperationalJob,
  timeZone: string,
  now = new Date()
): DispatchOperationalSignal {
  const startAt = getStartAt(job);
  const endAt = getEndAt(job);
  const startTime = startAt ? new Date(startAt).getTime() : null;
  const endTime = endAt ? new Date(endAt).getTime() : null;
  const arrivalStartTime = job.arrivalWindowStartAt
    ? new Date(job.arrivalWindowStartAt).getTime()
    : null;
  const arrivalEndTime = job.arrivalWindowEndAt
    ? new Date(job.arrivalWindowEndAt).getTime()
    : arrivalStartTime;
  const nowTime = now.getTime();
  const lateFromTime =
    isTechnicianTravelJobStatus(job.status) && arrivalEndTime
      ? arrivalEndTime
      : job.status === "scheduled" && startTime
        ? startTime
        : endTime;

  if (!job.isActive || job.status === "completed") {
    return { label: "Completed", tone: "success" };
  }

  if (job.status === "canceled") {
    return { label: "Closed", tone: "neutral" };
  }

  if (lateFromTime && nowTime > lateFromTime) {
    const lateMinutes = Math.max(
      Math.round((nowTime - lateFromTime) / 60_000),
      1
    );
    return {
      label: `Late ${formatRelativeMinutes(lateMinutes)}`,
      tone: "danger"
    };
  }

  if (isTechnicianOnSiteJobStatus(job.status)) {
    switch (job.status) {
      case "arrived":
        return { label: "Arrived", tone: "progress" };
      case "waiting_approval":
        return { label: "Waiting approval", tone: "warning" };
      case "waiting_parts":
        return { label: "Waiting on parts", tone: "warning" };
      case "ready_for_payment":
        return { label: "Ready for payment", tone: "info" };
      case "diagnosing":
        return { label: "Diagnosing", tone: "progress" };
      default:
        return { label: "Working now", tone: "progress" };
    }
  }

  if (isTechnicianTravelJobStatus(job.status)) {
    if (arrivalStartTime && arrivalEndTime) {
      if (nowTime >= arrivalStartTime && nowTime <= arrivalEndTime) {
        return { label: "Arriving now", tone: "progress" };
      }

      return {
        label: `Arrival ${formatDispatchArrivalWindow(job, timeZone)}`,
        tone: "info"
      };
    }

    return { label: "En route", tone: "info" };
  }

  if (startTime && endTime && nowTime >= startTime && nowTime <= endTime) {
    return { label: "Due now", tone: "warning" };
  }

  if (startTime) {
    const minutesUntilStart = Math.round((startTime - nowTime) / 60_000);

    if (minutesUntilStart > 0 && minutesUntilStart <= 30) {
      return {
        label: `Starts in ${formatRelativeMinutes(minutesUntilStart)}`,
        tone: "warning"
      };
    }
  }

  if (job.arrivalWindowStartAt) {
    return { label: "Arrival set", tone: "brand" };
  }

  return { label: "Scheduled", tone: "brand" };
}

export function getDispatchVisitSupportingText(
  job: DispatchOperationalJob,
  timeZone: string
) {
  const arrivalWindow = formatDispatchArrivalWindow(job, timeZone);

  if (arrivalWindow) {
    return `Arrival ${arrivalWindow}`;
  }

  return getVisitNextMove(job);
}

export function shouldEmphasizePriority(
  priority: DispatchOperationalJob["priority"]
) {
  return priority === "high" || priority === "urgent";
}

export function getDispatchVisitTimelineProgress(
  job: DispatchOperationalJob,
  now = new Date()
): DispatchTimelineProgress {
  const startAt = getStartAt(job);
  const endAt = getEndAt(job);

  if (!startAt || !endAt || !job.isActive || job.status === "completed" || job.status === "canceled") {
    return {
      isLate: false,
      isLive: false,
      progressPercent: null
    };
  }

  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  const nowTime = now.getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return {
      isLate: false,
      isLive: false,
      progressPercent: null
    };
  }

  if (nowTime >= endTime) {
    return {
      isLate: true,
      isLive: true,
      progressPercent: 100
    };
  }

  if (nowTime < startTime) {
    return {
      isLate: false,
      isLive: false,
      progressPercent: null
    };
  }

  const elapsedPercent = ((nowTime - startTime) / (endTime - startTime)) * 100;
  const clampedPercent = Math.min(Math.max(elapsedPercent, 6), 100);

  return {
    isLate: false,
    isLive: true,
    progressPercent: Math.round(clampedPercent * 10) / 10
  };
}

export const getDispatchJobOperationalSignal = getDispatchVisitOperationalSignal;
export const getDispatchJobSupportingText = getDispatchVisitSupportingText;
export const getDispatchJobTimelineProgress = getDispatchVisitTimelineProgress;
