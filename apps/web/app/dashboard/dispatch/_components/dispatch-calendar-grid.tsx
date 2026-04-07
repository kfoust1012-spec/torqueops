"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  clampDispatchEventBounds,
  formatDispatchDateTime,
  getDispatchLocalDate,
  getMinutesIntoDispatchDay,
  isTechnicianActiveFieldJobStatus,
  snapToDispatchSlot
} from "@mobile-mechanic/core";
import type {
  DispatchBoardJobItem,
  DispatchCalendarResource,
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarData,
  DispatchCalendarJobEvent,
  MoveDispatchJobInput,
  ResizeDispatchJobInput
} from "@mobile-mechanic/types";
import { cx } from "../../../../components/ui";
import {
  buildDispatchOnBoardFollowThroughItems,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "../../../../lib/dispatch/follow-through";

import { DispatchAvailabilityEvent } from "./dispatch-availability-event";
import {
  formatDispatchDuration,
  formatDispatchShortRange,
  formatDispatchShortTime,
  getDispatchVisitSupportingText,
  getDispatchVisitTimelineProgress
} from "./dispatch-calendar-signals";
import { DispatchVisitEvent } from "./dispatch-visit-event";
import { DispatchResourceHeader } from "./dispatch-resource-header";
import {
  getDispatchThreadLaneActionRelation,
  getDispatchThreadBoardRelation,
  type DispatchThreadBoardContext
} from "./dispatch-thread-board-context";
import { DispatchTimeAxis } from "./dispatch-time-axis";

type DispatchCalendarGridProps = {
  activeThreadContext: DispatchThreadBoardContext;
  calendar: DispatchCalendarData;
  draggingVisitId: string | null;
  hasOpenQueue: boolean;
  highlightedVisitId: string | null;
  now: Date;
  onAvailabilityClick: (blockId: string) => void;
  onFocusResourceConflicts: (technicianUserId: string) => void;
  onFocusSingleLane: (technicianUserId: string) => void;
  onVisitClick: (jobId: string) => void;
  onVisitDragEnd: () => void;
  onVisitDragStart: (jobId: string) => void;
  onMoveVisit: (input: MoveDispatchJobInput) => Promise<void>;
  onRemoveAvailabilityBlock: (blockId: string) => Promise<void>;
  onResizeVisit: (input: ResizeDispatchJobInput) => Promise<void>;
  pendingVisitIds: string[];
  promiseSummaries: Array<{
    jobId: string;
    summary: DispatchOnBoardPromiseSummary;
  }>;
  removingAvailabilityBlockId: string | null;
  selectedAvailabilityBlockId: string | null;
  selectedVisitId: string | null;
  threadLaneActions:
    | {
        canDefer: boolean;
        canSendUpdate: boolean;
        deferPending: boolean;
        onDefer: () => void;
        onSendUpdate: () => void;
        onTakeLane: (technicianUserId: string) => void;
        reroutePending: boolean;
        sendUpdatePending: boolean;
        sendUpdateLabel: string;
      }
    | null;
  zoomPreset: "overview" | "comfortable" | "detail";
};

type ResizeState = {
  dayDate: string;
  event: DispatchCalendarJobEvent;
  pointerId: number;
  resourceUserId: string;
};

type DropPreviewState = {
  height: number;
  key: string;
  top: number;
};

type KeyboardRouteAction = {
  ariaLabel: string;
  buttonLabel: string;
  disabled?: boolean;
  isCurrentPlacement: boolean;
  note: string;
  onRoute: () => void;
};

type KeyboardMoveControls = {
  canMoveBackward: boolean;
  canMoveEarlier: boolean;
  canMoveForward: boolean;
  canMoveLater: boolean;
  canResizeLonger: boolean;
  canResizeShorter: boolean;
  hint: string;
  onMoveBackward: () => void;
  onMoveEarlier: () => void;
  onMoveForward: () => void;
  onMoveLater: () => void;
  onResizeLonger: () => void;
  onResizeShorter: () => void;
};

const SLOT_HEIGHT = 44;

function getColumnKey(dayDate: string, technicianUserId: string) {
  return `${dayDate}:${technicianUserId}`;
}

function getCalendarViewportLayout(
  zoomPreset: "overview" | "comfortable" | "detail",
  resourceCount: number
) {
  if (zoomPreset === "overview") {
    if (resourceCount >= 8) {
      return { columnMinWidth: 132, slotHeight: 34, zoom: 0.66 };
    }

    if (resourceCount >= 6) {
      return { columnMinWidth: 148, slotHeight: 34, zoom: 0.74 };
    }

    if (resourceCount >= 4) {
      return { columnMinWidth: 164, slotHeight: 36, zoom: 0.82 };
    }

    return { columnMinWidth: 190, slotHeight: 36, zoom: 0.88 };
  }

  if (zoomPreset === "detail") {
    return { columnMinWidth: 280, slotHeight: 50, zoom: 1.04 };
  }

  if (resourceCount >= 7) {
    return { columnMinWidth: 188, slotHeight: SLOT_HEIGHT, zoom: 0.9 };
  }

  return { columnMinWidth: 240, slotHeight: SLOT_HEIGHT, zoom: 1 };
}

function getEventPosition(input: {
  dayDate: string;
  eventEndAt: string;
  eventStartAt: string;
  settings: DispatchCalendarData["settings"];
  slotHeight?: number;
  timeZone: string;
  trackCount: number;
  trackIndex: number;
}) {
  const slotHeight = input.slotHeight ?? SLOT_HEIGHT;
  const startMinutes = getMinutesIntoDispatchDay({
    date: input.dayDate,
    settings: input.settings,
    timeZone: input.timeZone,
    value: input.eventStartAt
  });
  const endMinutes = getMinutesIntoDispatchDay({
    date: input.dayDate,
    settings: input.settings,
    timeZone: input.timeZone,
    value: input.eventEndAt
  });
  const safeTrackCount = Math.max(input.trackCount, 1);
  const trackWidth = 100 / safeTrackCount;

  return {
    height: Math.max(((Math.max(endMinutes - startMinutes, input.settings.slotMinutes)) / input.settings.slotMinutes) * slotHeight, slotHeight),
    left: `calc(${trackWidth * input.trackIndex}% + 4px)`,
    top: Math.max((startMinutes / input.settings.slotMinutes) * slotHeight, 0),
    width: `calc(${trackWidth}% - 8px)`
  };
}

function sortLaneJobsByStartAt(jobs: DispatchCalendarJobEvent[]) {
  return [...jobs].sort(
    (left, right) =>
      new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime()
  );
}

function getLaneRouteSnapshot(input: {
  blockedMinutes: number;
  conflictCount: number;
  jobs: DispatchCalendarJobEvent[];
  now: Date;
  openMinutes: number;
  resource: DispatchCalendarResource;
  timezone: string;
}) {
  const sortedJobs = sortLaneJobsByStartAt(input.jobs);
  const liveJob =
    sortedJobs.find((job) => getDispatchVisitTimelineProgress(job, input.now).isLive) ??
    sortedJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status)) ??
    null;
  const nextJob =
    sortedJobs.find((job) => {
      const startsAt = new Date(job.eventStartAt).getTime();

      return startsAt >= input.now.getTime() && job.status !== "completed" && job.status !== "canceled";
    }) ?? null;

  if (liveJob) {
    return {
      detail: `${liveJob.customerDisplayName} · ${liveJob.title}`,
      headline: `Live now · ${formatDispatchShortRange(liveJob.eventStartAt, liveJob.eventEndAt, input.timezone)}`,
      note:
        input.resource.backlogCount > 0
          ? `${input.resource.backlogCount} assigned backlog still waiting`
          : getDispatchVisitSupportingText(liveJob, input.timezone)
    };
  }

  if (nextJob) {
    return {
      detail: `${nextJob.customerDisplayName} · ${nextJob.title}`,
      headline: `Next stop · ${formatDispatchShortTime(nextJob.eventStartAt, input.timezone)}`,
      note: getDispatchVisitSupportingText(nextJob, input.timezone)
    };
  }

  if (input.conflictCount > 0) {
    return {
      detail: "Lane needs conflict cleanup before adding more work.",
      headline: "Conflict pressure",
      note: `${input.conflictCount} dispatch conflicts flagged`
    };
  }

  if (input.resource.backlogCount > 0) {
    return {
      detail: "Assigned work has not been placed on the board yet.",
      headline: "Backlog waiting",
      note: `${input.resource.backlogCount} backlog ${input.resource.backlogCount === 1 ? "visit" : "visits"}`
    };
  }

  if (input.blockedMinutes > 0) {
    return {
      detail: "Availability blocks shape when this lane can take work.",
      headline: "Window shaped",
      note: `${formatDispatchDuration(input.blockedMinutes)} blocked`
    };
  }

  return {
    detail: "Ready for the next mobile visit with room still open.",
    headline: "Route window open",
    note: `${formatDispatchDuration(input.openMinutes)} open capacity`
  };
}

function getEmptyLaneHint(input: {
  blockedMinutes: number;
  hasOpenQueue: boolean;
  laneAvailabilityCount: number;
  lanePressure: string;
  openMinutes: number;
}) {
  if (input.laneAvailabilityCount > 0) {
    return {
      detail: `Availability still blocks ${formatDispatchDuration(input.blockedMinutes)} of this route window.`,
      title: "Lane constrained"
    };
  }

  if (input.hasOpenQueue) {
    return {
      detail:
        input.lanePressure === "open"
          ? `Dispatch can place work here with ${formatDispatchDuration(input.openMinutes)} still open.`
          : "This lane can still absorb queue work if route timing fits.",
      title: "Drop queue work"
    };
  }

  return {
    detail: `${formatDispatchDuration(input.openMinutes)} still open for mobile work.`,
    title: "Route window open"
  };
}

function getEventDensity(input: {
  event: DispatchCalendarJobEvent;
  resourceCount: number;
  zoomPreset: "overview" | "comfortable" | "detail";
}) {
  if (
    input.event.trackCount > 1 ||
    input.event.durationMinutes <= 75 ||
    (input.resourceCount >= 5 && input.event.durationMinutes <= 120)
  ) {
    return "tight" as const;
  }

  if (
    input.zoomPreset === "overview" ||
    input.resourceCount >= 4 ||
    input.event.durationMinutes <= 135
  ) {
    return "dense" as const;
  }

  return "default" as const;
}

export function getMoveableJobDurationMinutes(input: {
  event: Pick<DispatchCalendarJobEvent, "scheduledEndAt" | "scheduledStartAt">;
  slotMinutes: number;
}) {
  if (input.event.scheduledStartAt && input.event.scheduledEndAt) {
    return Math.max(
      Math.round(
        (new Date(input.event.scheduledEndAt).getTime() -
          new Date(input.event.scheduledStartAt).getTime()) /
          60_000
      ),
      input.slotMinutes
    );
  }

  return input.slotMinutes * 2;
}

function roundMinutesUpToSlot(minutes: number, slotMinutes: number) {
  return Math.ceil(minutes / slotMinutes) * slotMinutes;
}

export function buildMoveDispatchInput(input: {
  job: DispatchBoardJobItem | DispatchCalendarJobEvent;
  resourceUserId: string;
  scheduledStartAt: string;
  settings: DispatchCalendarData["settings"];
  timeZone: string;
}): MoveDispatchJobInput {
  const durationMinutes = getMoveableJobDurationMinutes({
    event: input.job,
    slotMinutes: input.settings.slotMinutes
  });
  const unclampedEndAt = new Date(
    new Date(input.scheduledStartAt).getTime() + durationMinutes * 60_000
  ).toISOString();
  const bounded = clampDispatchEventBounds({
    endsAt: unclampedEndAt,
    settings: input.settings,
    startsAt: input.scheduledStartAt,
    timeZone: input.timeZone
  });
  const originalStartAt = input.job.scheduledStartAt;
  const shiftMs = originalStartAt
    ? new Date(bounded.startsAt).getTime() - new Date(originalStartAt).getTime()
    : 0;

  return {
    arrivalWindowEndAt: input.job.arrivalWindowEndAt
      ? new Date(new Date(input.job.arrivalWindowEndAt).getTime() + shiftMs).toISOString()
      : null,
    arrivalWindowStartAt: input.job.arrivalWindowStartAt
      ? new Date(new Date(input.job.arrivalWindowStartAt).getTime() + shiftMs).toISOString()
      : null,
    assignedTechnicianUserId: input.resourceUserId,
    jobId: input.job.id,
    scheduledEndAt: bounded.endsAt,
    scheduledStartAt: bounded.startsAt
  };
}

export function buildResizeDispatchInput(input: {
  job: DispatchCalendarJobEvent;
  scheduledEndAt: string;
  settings: DispatchCalendarData["settings"];
  timeZone: string;
}): ResizeDispatchJobInput {
  const bounded = clampDispatchEventBounds({
    endsAt: input.scheduledEndAt,
    settings: input.settings,
    startsAt: input.job.eventStartAt,
    timeZone: input.timeZone
  });
  const minimumEndTime =
    new Date(input.job.eventStartAt).getTime() + input.settings.slotMinutes * 60_000;
  const safeEndAt =
    new Date(bounded.endsAt).getTime() <= minimumEndTime
      ? new Date(minimumEndTime).toISOString()
      : bounded.endsAt;

  return {
    arrivalWindowEndAt: input.job.arrivalWindowEndAt,
    arrivalWindowStartAt: input.job.arrivalWindowStartAt,
    jobId: input.job.id,
    scheduledEndAt: safeEndAt
  };
}

function getKeyboardPlacement(input: {
  dayDate: string;
  job: DispatchBoardJobItem | DispatchCalendarJobEvent;
  laneAvailability: DispatchCalendarAvailabilityEvent[];
  laneJobs: DispatchCalendarJobEvent[];
  onMoveVisit: (input: MoveDispatchJobInput) => Promise<void>;
  resourceDisplayName: string;
  resourceUserId: string;
  settings: DispatchCalendarData["settings"];
  timeZone: string;
}): KeyboardRouteAction | null {
  if (input.job.status === "completed" || input.job.status === "canceled") {
    return null;
  }

  const currentJobDayDate = input.job.scheduledStartAt
    ? getDispatchLocalDate(input.job.scheduledStartAt, input.timeZone)
    : null;
  const currentResourceUserId =
    "resourceTechnicianUserId" in input.job
      ? input.job.resourceTechnicianUserId
      : input.job.assignedTechnicianUserId;
  const durationMinutes = Math.min(
    getMoveableJobDurationMinutes({
      event: input.job,
      slotMinutes: input.settings.slotMinutes
    }),
    Math.max((input.settings.dayEndHour - input.settings.dayStartHour) * 60, input.settings.slotMinutes)
  );
  const dayCapacityMinutes = Math.max(
    (input.settings.dayEndHour - input.settings.dayStartHour) * 60,
    input.settings.slotMinutes
  );
  const maxStartMinutes = Math.max(dayCapacityMinutes - durationMinutes, 0);
  const preferredStartMinutes =
    input.job.scheduledStartAt &&
    currentJobDayDate === input.dayDate
      ? Math.min(
          Math.max(
            getMinutesIntoDispatchDay({
              date: input.dayDate,
              settings: input.settings,
              timeZone: input.timeZone,
              value: input.job.scheduledStartAt
            }),
            0
          ),
          maxStartMinutes
        )
      : (() => {
          const lastLaneJob = sortLaneJobsByStartAt(input.laneJobs).at(-1);

          if (!lastLaneJob) {
            return 0;
          }

          const laneEndMinutes = getMinutesIntoDispatchDay({
            date: input.dayDate,
            settings: input.settings,
            timeZone: input.timeZone,
            value: lastLaneJob.eventEndAt
          });

          return Math.min(
            Math.max(roundMinutesUpToSlot(laneEndMinutes, input.settings.slotMinutes), 0),
            maxStartMinutes
          );
        })();
  const occupiedWindows = [
    ...input.laneJobs.map((job) => ({
      end: getMinutesIntoDispatchDay({
        date: input.dayDate,
        settings: input.settings,
        timeZone: input.timeZone,
        value: job.eventEndAt
      }),
      start: getMinutesIntoDispatchDay({
        date: input.dayDate,
        settings: input.settings,
        timeZone: input.timeZone,
        value: job.eventStartAt
      })
    })),
    ...input.laneAvailability.map((block) => ({
      end: getMinutesIntoDispatchDay({
        date: input.dayDate,
        settings: input.settings,
        timeZone: input.timeZone,
        value: block.eventEndAt
      }),
      start: getMinutesIntoDispatchDay({
        date: input.dayDate,
        settings: input.settings,
        timeZone: input.timeZone,
        value: block.eventStartAt
      })
    }))
  ].sort((left, right) => left.start - right.start);

  let candidateStartMinutes = preferredStartMinutes;
  let placed = false;

  for (let iteration = 0; iteration < occupiedWindows.length + 2; iteration += 1) {
    const candidateEndMinutes = candidateStartMinutes + durationMinutes;
    const collision = occupiedWindows.find(
      (window) =>
        window.end > candidateStartMinutes && window.start < candidateEndMinutes
    );

    if (!collision) {
      placed = true;
      break;
    }

    const nextStartMinutes = Math.min(
      roundMinutesUpToSlot(collision.end, input.settings.slotMinutes),
      maxStartMinutes
    );

    if (nextStartMinutes === candidateStartMinutes) {
      break;
    }

    candidateStartMinutes = nextStartMinutes;
  }

  if (!placed) {
    const candidateEndMinutes = candidateStartMinutes + durationMinutes;
    const stillCollides = occupiedWindows.some(
      (window) =>
        window.end > candidateStartMinutes && window.start < candidateEndMinutes
    );

    if (stillCollides) {
      return null;
    }
  }

  const scheduledStartAt = snapToDispatchSlot({
    date: input.dayDate,
    minutesFromDayStart: candidateStartMinutes,
    settings: input.settings,
    timeZone: input.timeZone
  });
  const moveInput = buildMoveDispatchInput({
    job: input.job,
    resourceUserId: input.resourceUserId,
    scheduledStartAt,
    settings: input.settings,
    timeZone: input.timeZone
  });
  const isCurrentPlacement =
    currentResourceUserId === input.resourceUserId &&
    currentJobDayDate === input.dayDate &&
    input.job.scheduledStartAt === moveInput.scheduledStartAt &&
    input.job.scheduledEndAt === moveInput.scheduledEndAt;
  const startTimeLabel = formatDispatchShortTime(moveInput.scheduledStartAt, input.timeZone);

  return {
    ariaLabel: `${isCurrentPlacement ? "Selected stop already routed in" : "Route selected stop to"} ${input.resourceDisplayName} at ${startTimeLabel}`,
    buttonLabel: isCurrentPlacement ? "Placed" : "Route here",
    isCurrentPlacement,
    note: isCurrentPlacement ? `Already set for ${startTimeLabel}` : `${startTimeLabel} next open`,
    onRoute: () => {
      if (isCurrentPlacement) {
        return;
      }

      void input.onMoveVisit(moveInput);
    }
  };
}

export function DispatchCalendarGrid({
  activeThreadContext,
  calendar,
  draggingVisitId,
  hasOpenQueue,
  highlightedVisitId,
  now,
  onAvailabilityClick,
  onFocusResourceConflicts,
  onFocusSingleLane,
  onVisitClick,
  onVisitDragEnd,
  onVisitDragStart,
  onMoveVisit,
  onRemoveAvailabilityBlock,
  onResizeVisit,
  pendingVisitIds,
  promiseSummaries,
  removingAvailabilityBlockId,
  selectedAvailabilityBlockId,
  selectedVisitId,
  threadLaneActions,
  zoomPreset
}: DispatchCalendarGridProps) {
  const promiseSummariesByJobId = new Map(
    promiseSummaries.map((entry) => [entry.jobId, entry.summary] as const)
  );
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreviewState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [resizePreviewEndAt, setResizePreviewEndAt] = useState<string | null>(null);
  const columnBodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleDays = calendar.range.visibleDays;
  const resources = calendar.resources;
  const layout = getCalendarViewportLayout(zoomPreset, resources.length);
  const slotHeight = layout.slotHeight;
  const columns = visibleDays.flatMap((day) =>
    resources.map((resource) => ({
      day,
      key: getColumnKey(day.date, resource.technicianUserId),
      resource
    }))
  );
  const bodyHeight = calendar.slots.length * slotHeight;
  const jobsByColumn = new Map<string, DispatchCalendarJobEvent[]>();
  const availabilityByColumn = new Map<string, DispatchCalendarAvailabilityEvent[]>();
  const conflictsByColumn = new Map<string, number>();
  const jobsById = new Map(calendar.jobs.map((job) => [job.id, job]));
  const dayCapacityMinutes = Math.max(
    (calendar.settings.dayEndHour - calendar.settings.dayStartHour) * 60,
    1
  );
  const todayDate = getDispatchLocalDate(now, calendar.timezone);
  const activeDayDate = visibleDays[0]?.date ?? null;
  const selectedKeyboardVisit =
    selectedVisitId ? getDraggedVisit(selectedVisitId) : null;
  const nowIndicator =
    activeDayDate && activeDayDate === todayDate
      ? (() => {
          const nowIso = now.toISOString();
          const minutesIntoDay = getMinutesIntoDispatchDay({
            date: activeDayDate,
            settings: calendar.settings,
            timeZone: calendar.timezone,
            value: nowIso
          });

          if (minutesIntoDay < 0 || minutesIntoDay > dayCapacityMinutes) {
            return null;
          }

          return {
            label: formatDispatchDateTime(nowIso, calendar.timezone, {
              day: undefined,
              hour: "numeric",
              minute: "2-digit",
              month: undefined
            }),
            top: (minutesIntoDay / calendar.settings.slotMinutes) * slotHeight
          };
        })()
      : null;

  function getDraggedVisit(jobId: string) {
    return (
      jobsById.get(jobId) ??
      calendar.unassignedScheduledJobs.find((job) => job.id === jobId) ??
      calendar.backlogJobs.find((job) => job.id === jobId) ??
      null
    );
  }

  for (const job of calendar.jobs) {
    if (!job.resourceTechnicianUserId) {
      continue;
    }

    const key = getColumnKey(job.dayDate, job.resourceTechnicianUserId);
    const current = jobsByColumn.get(key) ?? [];
    current.push(job);
    jobsByColumn.set(key, current);
  }

  for (const block of calendar.availability) {
    const key = getColumnKey(block.dayDate, block.technicianUserId);
    const current = availabilityByColumn.get(key) ?? [];
    current.push(block);
    availabilityByColumn.set(key, current);
  }

  for (const conflict of calendar.conflicts) {
    if (!conflict.technicianUserId) {
      continue;
    }

    const key = getColumnKey(conflict.dayDate, conflict.technicianUserId);
    conflictsByColumn.set(key, (conflictsByColumn.get(key) ?? 0) + 1);
  }

  useEffect(() => {
    if (draggingVisitId) {
      return;
    }

    setDropTargetKey(null);
    setDropPreview(null);
  }, [draggingVisitId]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const activeResizeState = resizeState;
    const maybeColumnRef =
      columnBodyRefs.current[getColumnKey(activeResizeState.dayDate, activeResizeState.resourceUserId)];

    if (!maybeColumnRef) {
      setResizeState(null);
      setResizePreviewEndAt(null);
      return;
    }
    const columnRef = maybeColumnRef;

    function resolvePreviewEndAt(clientY: number) {
      const rect = columnRef.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      const minutesFromDayStart = (offsetY / slotHeight) * calendar.settings.slotMinutes;
      const snappedEndAt = snapToDispatchSlot({
        date: activeResizeState.dayDate,
        minutesFromDayStart,
        settings: calendar.settings,
        timeZone: calendar.timezone
      });
      const minimumEndTime =
        new Date(activeResizeState.event.eventStartAt).getTime() +
        calendar.settings.slotMinutes * 60_000;

      if (new Date(snappedEndAt).getTime() <= minimumEndTime) {
        return new Date(minimumEndTime).toISOString();
      }

      return clampDispatchEventBounds({
        endsAt: snappedEndAt,
        settings: calendar.settings,
        startsAt: activeResizeState.event.eventStartAt,
        timeZone: calendar.timezone
      }).endsAt;
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeResizeState.pointerId) {
        return;
      }

      setResizePreviewEndAt(resolvePreviewEndAt(event.clientY));
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== activeResizeState.pointerId) {
        return;
      }

      const nextEndAt = resolvePreviewEndAt(event.clientY);
      setResizeState(null);
      setResizePreviewEndAt(null);

      if (!nextEndAt || nextEndAt === activeResizeState.event.eventEndAt) {
        return;
      }

      void onResizeVisit({
        arrivalWindowEndAt: activeResizeState.event.arrivalWindowEndAt,
        arrivalWindowStartAt: activeResizeState.event.arrivalWindowStartAt,
        jobId: activeResizeState.event.id,
        scheduledEndAt: nextEndAt
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    setResizePreviewEndAt(activeResizeState.event.eventEndAt);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [calendar.settings, calendar.timezone, onResizeVisit, resizeState, slotHeight]);

  async function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
    dayDate: string,
    resourceUserId: string
  ) {
    event.preventDefault();
    const draggedVisitId = event.dataTransfer.getData("text/plain") || draggingVisitId;

    if (!draggedVisitId) {
      setDropTargetKey(null);
      return;
    }

    const draggedVisit = getDraggedVisit(draggedVisitId);

    if (!draggedVisit) {
      setDropTargetKey(null);
      onVisitDragEnd();
      return;
    }

      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const minutesFromDayStart = (offsetY / slotHeight) * calendar.settings.slotMinutes;
      const scheduledStartAt = snapToDispatchSlot({
        date: dayDate,
        minutesFromDayStart,
      settings: calendar.settings,
      timeZone: calendar.timezone
    });
    const originalDurationMinutes =
      draggedVisit.scheduledStartAt && draggedVisit.scheduledEndAt
        ? Math.max(
            Math.round(
              (new Date(draggedVisit.scheduledEndAt).getTime() -
                new Date(draggedVisit.scheduledStartAt).getTime()) /
                60_000
            ),
            calendar.settings.slotMinutes
          )
        : calendar.settings.slotMinutes * 2;
    const unclampedEndAt = new Date(
      new Date(scheduledStartAt).getTime() + originalDurationMinutes * 60_000
    ).toISOString();
    const bounded = clampDispatchEventBounds({
      endsAt: unclampedEndAt,
      settings: calendar.settings,
      startsAt: scheduledStartAt,
      timeZone: calendar.timezone
    });
    const originalStartAt = draggedVisit.scheduledStartAt;
    const shiftMs = originalStartAt
      ? new Date(bounded.startsAt).getTime() - new Date(originalStartAt).getTime()
      : 0;
    const arrivalWindowStartAt = draggedVisit.arrivalWindowStartAt
      ? new Date(new Date(draggedVisit.arrivalWindowStartAt).getTime() + shiftMs).toISOString()
      : null;
    const arrivalWindowEndAt = draggedVisit.arrivalWindowEndAt
      ? new Date(new Date(draggedVisit.arrivalWindowEndAt).getTime() + shiftMs).toISOString()
      : null;

    setDropTargetKey(null);
    setDropPreview(null);
    onVisitDragEnd();

    await onMoveVisit({
      arrivalWindowEndAt,
      arrivalWindowStartAt,
      assignedTechnicianUserId: resourceUserId,
      jobId: draggedVisit.id,
      scheduledEndAt: bounded.endsAt,
      scheduledStartAt: bounded.startsAt
    });
  }

  function handleDragPreview(
    event: React.DragEvent<HTMLDivElement>,
    dayDate: string,
    key: string
  ) {
    const draggedVisitId = event.dataTransfer.getData("text/plain") || draggingVisitId;

    if (!draggedVisitId) {
      setDropPreview(null);
      return;
    }

    const draggedVisit = getDraggedVisit(draggedVisitId);

    if (!draggedVisit) {
      setDropPreview(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const minutesFromDayStart = (offsetY / slotHeight) * calendar.settings.slotMinutes;
    const scheduledStartAt = snapToDispatchSlot({
      date: dayDate,
      minutesFromDayStart,
      settings: calendar.settings,
      timeZone: calendar.timezone
    });
    const durationMinutes =
      draggedVisit.scheduledStartAt && draggedVisit.scheduledEndAt
        ? Math.max(
            Math.round(
              (new Date(draggedVisit.scheduledEndAt).getTime() -
                new Date(draggedVisit.scheduledStartAt).getTime()) /
                60_000
            ),
            calendar.settings.slotMinutes
          )
        : calendar.settings.slotMinutes * 2;
    const top =
      (getMinutesIntoDispatchDay({
        date: dayDate,
        settings: calendar.settings,
        timeZone: calendar.timezone,
        value: scheduledStartAt
      }) /
        calendar.settings.slotMinutes) *
      slotHeight;

    setDropPreview({
      height: Math.max((durationMinutes / calendar.settings.slotMinutes) * slotHeight, slotHeight),
      key,
      top
    });
  }

  return (
    <div
      className="dispatch-calendar-shell"
      data-dragging={draggingVisitId ? "true" : "false"}
      data-queue-open={hasOpenQueue ? "true" : "false"}
      data-zoom-preset={zoomPreset}
      style={
        {
          "--dispatch-calendar-column-min-width": `${layout.columnMinWidth}px`,
          "--dispatch-calendar-slot-height": `${slotHeight}px`,
          zoom: layout.zoom
        } as CSSProperties
      }
    >
      <div className="dispatch-calendar__day-groups">
        <div className="dispatch-calendar__day-groups-spacer" />
        <div
          className="dispatch-calendar__day-groups-track"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${layout.columnMinWidth}px, 1fr))` }}
        >
          {visibleDays.map((day) => (
            <div
              className="dispatch-calendar__day-group"
              key={day.date}
              style={{ gridColumn: `span ${resources.length}` }}
            >
              <strong>{day.columnLabel}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="dispatch-calendar__chrome">
        <DispatchTimeAxis slots={calendar.slots} />
        <div className="dispatch-calendar__main">
          <div
            className="dispatch-calendar__resource-row"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${layout.columnMinWidth}px, 1fr))` }}
          >
            {columns.map(({ day, key, resource }) => {
              const laneJobs = jobsByColumn.get(key) ?? [];
              const laneAvailability = availabilityByColumn.get(key) ?? [];
              const laneThreadActionRelation = getDispatchThreadLaneActionRelation({
                context: activeThreadContext,
                dayDate: day.date,
                orderedResourceTechnicianUserIds: resources.map(
                  (entry) => entry.technicianUserId
                ),
                resourceTechnicianUserId: resource.technicianUserId
              });
              const laneThreadRelation = getDispatchThreadBoardRelation({
                context: activeThreadContext,
                dayDate: day.date,
                resourceTechnicianUserId: resource.technicianUserId,
                visitId: selectedVisitId ?? "__dispatch-lane__"
              });
              const scheduledMinutes = laneJobs.reduce(
                (total, job) => total + job.durationMinutes,
                0
              );
              const blockedMinutes = laneAvailability.reduce(
                (total, block) => total + block.durationMinutes,
                0
              );
              const laneFollowThrough = summarizeDispatchLaneFollowThrough(
                buildDispatchOnBoardFollowThroughItems({
                  jobs: laneJobs,
                  now,
                  promiseSummariesByJobId
                })
              );
              const conflictCount = conflictsByColumn.get(key) ?? 0;
              const openMinutes = Math.max(
                dayCapacityMinutes - Math.min(scheduledMinutes + blockedMinutes, dayCapacityMinutes),
                0
              );

              return (
                <DispatchResourceHeader
                  className={cx(
                    laneThreadRelation.hasContext &&
                      laneThreadRelation.matchesLane &&
                      laneThreadRelation.matchesDay &&
                      "dispatch-lane-header--thread-neighbor",
                    laneThreadRelation.isDimmed && "dispatch-lane-header--thread-dimmed"
                  )}
                  isFocusedScope={resources.length === 1}
                  keyboardRouteAction={
                    selectedKeyboardVisit
                      ? (() => {
                          const action = getKeyboardPlacement({
                            dayDate: day.date,
                            job: selectedKeyboardVisit,
                            laneAvailability,
                            laneJobs,
                            onMoveVisit,
                            resourceDisplayName: resource.displayName,
                            resourceUserId: resource.technicianUserId,
                            settings: calendar.settings,
                            timeZone: calendar.timezone
                          });

                          if (!action) {
                            return null;
                          }

                          return {
                            ...action,
                            disabled: pendingVisitIds.includes(selectedKeyboardVisit.id)
                          };
                        })()
                      : null
                  }
                  key={key}
                  onConflictClick={
                    conflictCount
                      ? () => onFocusResourceConflicts(resource.technicianUserId)
                      : undefined
                  }
                  onFocusLane={() => onFocusSingleLane(resource.technicianUserId)}
                  routeSnapshot={getLaneRouteSnapshot({
                    blockedMinutes,
                    conflictCount,
                    jobs: laneJobs,
                    now,
                    openMinutes,
                    resource,
                    timezone: calendar.timezone
                  })}
                  resource={resource}
                  summary={{
                    availabilityBlockCount: laneAvailability.length,
                    blockedPercent: Math.min((blockedMinutes / dayCapacityMinutes) * 100, 100),
                    conflictCount,
                    followThrough: laneFollowThrough,
                    scheduledCount: laneJobs.length,
                    scheduledMinutes,
                    utilizationPercent: Math.min((scheduledMinutes / dayCapacityMinutes) * 100, 100)
                  }}
                  threadContextActions={
                    threadLaneActions && laneThreadActionRelation.isCurrentLane
                      ? [
                          ...(threadLaneActions.canSendUpdate
                            ? [
                                {
                                  disabled: threadLaneActions.sendUpdatePending,
                                  key: `${resource.technicianUserId}:send-update`,
                                  label: threadLaneActions.sendUpdateLabel,
                                  onClick: threadLaneActions.onSendUpdate,
                                  tone: "primary" as const
                                }
                              ]
                            : []),
                          {
                            key: `${resource.technicianUserId}:hold-lane`,
                            label: "Hold lane",
                            onClick: () => onFocusSingleLane(resource.technicianUserId),
                            tone: "secondary" as const
                          },
                          ...(threadLaneActions.canDefer
                            ? [
                                {
                                  disabled: threadLaneActions.deferPending,
                                  key: `${resource.technicianUserId}:defer`,
                                  label: "Defer to queue",
                                  onClick: threadLaneActions.onDefer,
                                  tone: "secondary" as const
                                }
                              ]
                            : [])
                        ]
                      : threadLaneActions && laneThreadActionRelation.isAdjacentLane
                        ? [
                            {
                              disabled: threadLaneActions.reroutePending,
                              key: `${resource.technicianUserId}:take-stop`,
                              label: "Take this stop",
                              onClick: () => threadLaneActions.onTakeLane(resource.technicianUserId),
                              tone: "primary" as const
                            }
                          ]
                        : undefined
                  }
                />
              );
            })}
          </div>

          <div
            className="dispatch-calendar__lane-row"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${layout.columnMinWidth}px, 1fr))` }}
          >
            {columns.map(({ day, key, resource }, columnIndex) => {
              const laneJobs = jobsByColumn.get(key) ?? [];
              const laneAvailability = availabilityByColumn.get(key) ?? [];
              const laneThreadRelation = getDispatchThreadBoardRelation({
                context: activeThreadContext,
                dayDate: day.date,
                resourceTechnicianUserId: resource.technicianUserId,
                visitId: selectedVisitId ?? "__dispatch-lane__"
              });
              const conflictCount = conflictsByColumn.get(key) ?? 0;
              const scheduledMinutes = laneJobs.reduce(
                (total, job) => total + job.durationMinutes,
                0
              );
              const blockedMinutes = laneAvailability.reduce(
                (total, block) => total + block.durationMinutes,
                0
              );
              const utilizationPercent = Math.min((scheduledMinutes / dayCapacityMinutes) * 100, 100);
              const blockedPercent = Math.min((blockedMinutes / dayCapacityMinutes) * 100, 100);
              const openMinutes = Math.max(
                dayCapacityMinutes - Math.min(scheduledMinutes + blockedMinutes, dayCapacityMinutes),
                0
              );
              const showEmptyLaneHint =
                laneJobs.length === 0 &&
                (laneAvailability.length > 0 ||
                  hasOpenQueue ||
                  zoomPreset === "detail" ||
                  resources.length <= 4);
              const lanePressure =
                conflictCount > 0
                  ? "danger"
                  : utilizationPercent >= 88
                    ? "heavy"
                    : utilizationPercent >= 58
                      ? "busy"
                      : blockedPercent >= 20
                        ? "shaped"
                        : laneJobs.length > 0
                          ? "active"
                          : "open";

              return (
                <div
                  className={cx(
                    "dispatch-calendar__lane",
                    laneThreadRelation.hasContext &&
                      laneThreadRelation.matchesLane &&
                      laneThreadRelation.matchesDay &&
                      "dispatch-calendar__lane--thread-neighbor",
                    laneThreadRelation.isDimmed && "dispatch-calendar__lane--thread-dimmed"
                  )}
                  key={key}
                  data-conflicted={conflictCount > 0 ? "true" : "false"}
                  data-empty={laneJobs.length === 0 ? "true" : "false"}
                  data-pressure={lanePressure}
                  style={
                    {
                      "--dispatch-lane-accent": resource.laneColor ?? "var(--ui-brand-strong)",
                      "--dispatch-lane-blocked": `${blockedPercent}%`,
                      "--dispatch-lane-load": `${utilizationPercent}%`
                    } as CSSProperties
                  }
                >
                  <div
                    className="dispatch-calendar__column-body"
                    data-drop-target={dropTargetKey === key}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropTargetKey(key);
                      handleDragPreview(event, day.date, key);
                    }}
                    onDragLeave={(event) => {
                      const relatedTarget = event.relatedTarget;

                      if (
                        relatedTarget instanceof Node &&
                        event.currentTarget.contains(relatedTarget)
                      ) {
                        return;
                      }

                      const rect = event.currentTarget.getBoundingClientRect();

                      if (
                        event.clientX >= rect.left &&
                        event.clientX <= rect.right &&
                        event.clientY >= rect.top &&
                        event.clientY <= rect.bottom
                      ) {
                        return;
                      }

                      setDropTargetKey((current) => (current === key ? null : current));
                      setDropPreview((current) => (current?.key === key ? null : current));
                    }}
                    onDrop={(event) => void handleDrop(event, day.date, resource.technicianUserId)}
                    ref={(element) => {
                      columnBodyRefs.current[key] = element;
                    }}
                    style={{ minHeight: `${bodyHeight}px` }}
                  >
                    {nowIndicator ? (
                      <div
                        className="dispatch-calendar__now-band"
                        style={{
                          height: `${Math.max(slotHeight * 1.2, 32)}px`,
                          top: `${Math.max(nowIndicator.top - slotHeight * 0.6, 0)}px`
                        }}
                      />
                    ) : null}

                    {calendar.slots.map((slot, slotIndex) => (
                      <div
                        className="dispatch-calendar__slot-line"
                        data-hour-start={slot.minutesFromDayStart % 60 === 0}
                        key={`${key}-slot-${slot.index}`}
                        style={{ top: `${slotIndex * slotHeight}px` }}
                      />
                    ))}

                    {nowIndicator ? (
                      <div
                        className="dispatch-calendar__now-line"
                        style={{ top: `${nowIndicator.top}px` }}
                      >
                        {columnIndex === 0 ? (
                          <span className="dispatch-calendar__now-pill">
                            {nowIndicator.label}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {showEmptyLaneHint ? (
                      (() => {
                        const emptyLaneHint = getEmptyLaneHint({
                          blockedMinutes,
                          hasOpenQueue,
                          laneAvailabilityCount: laneAvailability.length,
                          lanePressure,
                          openMinutes
                        });

                        return (
                          <div
                            className={cx(
                              "dispatch-calendar__empty-lane",
                              laneAvailability.length > 0 &&
                                "dispatch-calendar__empty-lane--constrained"
                            )}
                          >
                            <span className="dispatch-calendar__empty-lane-kicker">
                              {laneAvailability.length > 0
                                ? "Route shaped"
                                : hasOpenQueue
                                  ? "Ready for queue"
                                  : "Open route"}
                            </span>
                            <strong>{emptyLaneHint.title}</strong>
                            <p>{emptyLaneHint.detail}</p>
                          </div>
                        );
                      })()
                    ) : null}

                    {dropPreview?.key === key ? (
                      <div
                        className="dispatch-calendar__event dispatch-calendar__event--preview"
                        style={{
                          height: `${dropPreview.height}px`,
                          left: "8px",
                          top: `${dropPreview.top}px`,
                          width: "calc(100% - 16px)",
                          zIndex: 1
                        }}
                      />
                    ) : null}

                    {laneAvailability.map((availabilityEvent) => {
                      const position = getEventPosition({
                        dayDate: day.date,
                        eventEndAt: availabilityEvent.eventEndAt,
                        eventStartAt: availabilityEvent.eventStartAt,
                        settings: calendar.settings,
                        slotHeight,
                        timeZone: calendar.timezone,
                        trackCount: Math.max(availabilityEvent.trackCount, 1),
                        trackIndex: availabilityEvent.trackIndex
                      });

                      return (
                        <DispatchAvailabilityEvent
                          event={availabilityEvent}
                          isSelected={selectedAvailabilityBlockId === availabilityEvent.id}
                          key={availabilityEvent.id}
                          onClick={onAvailabilityClick}
                          onRemove={(blockId) => void onRemoveAvailabilityBlock(blockId)}
                          removing={removingAvailabilityBlockId === availabilityEvent.id}
                          style={{
                            height: `${position.height}px`,
                            left: position.left,
                            top: `${position.top}px`,
                            width: position.width,
                            zIndex: 2
                          }}
                          timezone={calendar.timezone}
                        />
                      );
                    })}

                    {laneJobs.map((jobEvent) => {
                      const threadRelation = getDispatchThreadBoardRelation({
                        context: activeThreadContext,
                        dayDate: jobEvent.dayDate,
                        resourceTechnicianUserId: jobEvent.resourceTechnicianUserId,
                        visitId: jobEvent.id
                      });
                      const previewEndAt =
                        resizeState?.event.id === jobEvent.id && resizePreviewEndAt
                          ? resizePreviewEndAt
                          : jobEvent.eventEndAt;
                      const jobColumnIndex = columns.findIndex(
                        (column) =>
                          column.day.date === jobEvent.dayDate &&
                          column.resource.technicianUserId === jobEvent.resourceTechnicianUserId
                      );
                      const jobStartMinutes = Math.max(
                        getMinutesIntoDispatchDay({
                          date: jobEvent.dayDate,
                          settings: calendar.settings,
                          timeZone: calendar.timezone,
                          value: jobEvent.eventStartAt
                        }),
                        0
                      );
                      const jobDurationMinutes = getMoveableJobDurationMinutes({
                        event: jobEvent,
                        slotMinutes: calendar.settings.slotMinutes
                      });
                      const jobMaxStartMinutes = Math.max(dayCapacityMinutes - jobDurationMinutes, 0);
                      const buildSlotMove = (deltaMinutes: number) => {
                        const nextStartMinutes = Math.min(
                          Math.max(jobStartMinutes + deltaMinutes, 0),
                          jobMaxStartMinutes
                        );
                        const scheduledStartAt = snapToDispatchSlot({
                          date: jobEvent.dayDate,
                          minutesFromDayStart: nextStartMinutes,
                          settings: calendar.settings,
                          timeZone: calendar.timezone
                        });

                        return buildMoveDispatchInput({
                          job: jobEvent,
                          resourceUserId: jobEvent.resourceTechnicianUserId ?? resource.technicianUserId,
                          scheduledStartAt,
                          settings: calendar.settings,
                          timeZone: calendar.timezone
                        });
                      };
                      const buildColumnMove = (deltaColumns: number) => {
                        const targetColumn = columns[jobColumnIndex + deltaColumns];

                        if (!targetColumn) {
                          return null;
                        }

                        const targetDayCapacityMinutes = Math.max(
                          (calendar.settings.dayEndHour - calendar.settings.dayStartHour) * 60,
                          calendar.settings.slotMinutes
                        );
                        const targetMaxStartMinutes = Math.max(
                          targetDayCapacityMinutes - jobDurationMinutes,
                          0
                        );
                        const scheduledStartAt = snapToDispatchSlot({
                          date: targetColumn.day.date,
                          minutesFromDayStart: Math.min(jobStartMinutes, targetMaxStartMinutes),
                          settings: calendar.settings,
                          timeZone: calendar.timezone
                        });

                        return buildMoveDispatchInput({
                          job: jobEvent,
                          resourceUserId: targetColumn.resource.technicianUserId,
                          scheduledStartAt,
                          settings: calendar.settings,
                          timeZone: calendar.timezone
                        });
                      };
                      const currentDurationMinutes = Math.max(
                        Math.round(
                          (new Date(jobEvent.eventEndAt).getTime() -
                            new Date(jobEvent.eventStartAt).getTime()) /
                            60_000
                        ),
                        calendar.settings.slotMinutes
                      );
                      const maxDurationMinutes = Math.max(
                        dayCapacityMinutes - jobStartMinutes,
                        calendar.settings.slotMinutes
                      );
                      const buildResize = (deltaMinutes: number) => {
                        const nextDurationMinutes = Math.min(
                          Math.max(
                            currentDurationMinutes + deltaMinutes,
                            calendar.settings.slotMinutes
                          ),
                          maxDurationMinutes
                        );
                        const scheduledEndAt = new Date(
                          new Date(jobEvent.eventStartAt).getTime() +
                            nextDurationMinutes * 60_000
                        ).toISOString();

                        return buildResizeDispatchInput({
                          job: jobEvent,
                          scheduledEndAt,
                          settings: calendar.settings,
                          timeZone: calendar.timezone
                        });
                      };
                      const keyboardMoveControls: KeyboardMoveControls | null =
                        pendingVisitIds.includes(jobEvent.id)
                          ? null
                          : {
                              canMoveBackward: jobColumnIndex > 0,
                              canMoveEarlier: jobStartMinutes > 0,
                              canMoveForward: jobColumnIndex < columns.length - 1,
                              canMoveLater: jobStartMinutes < jobMaxStartMinutes,
                              canResizeLonger: currentDurationMinutes < maxDurationMinutes,
                              canResizeShorter:
                                currentDurationMinutes > calendar.settings.slotMinutes,
                              hint: `Arrow keys move this stop. Shift plus up or down resizes by ${calendar.settings.slotMinutes} minutes.`,
                              onMoveBackward: () => {
                                const moveInput = buildColumnMove(-1);

                                if (moveInput) {
                                  void onMoveVisit(moveInput);
                                }
                              },
                              onMoveEarlier: () => void onMoveVisit(buildSlotMove(-calendar.settings.slotMinutes)),
                              onMoveForward: () => {
                                const moveInput = buildColumnMove(1);

                                if (moveInput) {
                                  void onMoveVisit(moveInput);
                                }
                              },
                              onMoveLater: () => void onMoveVisit(buildSlotMove(calendar.settings.slotMinutes)),
                              onResizeLonger: () => void onResizeVisit(buildResize(calendar.settings.slotMinutes)),
                              onResizeShorter: () => void onResizeVisit(buildResize(-calendar.settings.slotMinutes))
                            };
                      const position = getEventPosition({
                        dayDate: day.date,
                        eventEndAt: previewEndAt,
                        eventStartAt: jobEvent.eventStartAt,
                        settings: calendar.settings,
                        slotHeight,
                        timeZone: calendar.timezone,
                        trackCount: Math.max(jobEvent.trackCount, 1),
                        trackIndex: jobEvent.trackIndex
                      });

                      return (
                        <DispatchVisitEvent
                          density={getEventDensity({
                            event: jobEvent,
                            resourceCount: resources.length,
                            zoomPreset
                          })}
                          event={jobEvent}
                          isFreshPlacement={highlightedVisitId === jobEvent.id}
                          isDragging={draggingVisitId === jobEvent.id}
                          isThreadDimmed={threadRelation.isDimmed}
                          isThreadNeighbor={threadRelation.isNeighbor}
                          keyboardMoveControls={selectedVisitId === jobEvent.id ? keyboardMoveControls : null}
                          isPendingMutation={pendingVisitIds.includes(jobEvent.id)}
                          promiseSummary={promiseSummariesByJobId.get(jobEvent.id) ?? null}
                          isSelected={selectedVisitId === jobEvent.id}
                          key={jobEvent.id}
                          now={now}
                          onClick={() => onVisitClick(jobEvent.id)}
                          onDragEnd={onVisitDragEnd}
                          onDragStart={() => onVisitDragStart(jobEvent.id)}
                          onResizeStart={({ pointerId }) =>
                            setResizeState({
                              dayDate: day.date,
                              event: jobEvent,
                              pointerId,
                              resourceUserId: resource.technicianUserId
                            })
                          }
                          style={{
                            height: `${position.height}px`,
                            left: position.left,
                            top: `${position.top}px`,
                            width: position.width,
                            zIndex: selectedVisitId === jobEvent.id ? 4 : 3
                          }}
                          timezone={calendar.timezone}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
