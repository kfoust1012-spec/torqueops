"use client";

import { Fragment, type CSSProperties } from "react";
import { getDispatchLocalDate } from "@mobile-mechanic/core";
import type {
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarData,
  DispatchCalendarJobEvent
} from "@mobile-mechanic/types";

import { PriorityBadge, cx } from "../../../../components/ui";
import {
  buildDispatchOnBoardFollowThroughItems,
  getDispatchOnBoardFollowThroughActionLabel,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "../../../../lib/dispatch/follow-through";
import { getDispatchLaneLoadState } from "../../../../lib/dispatch/lane-health";

import {
  formatDispatchArrivalWindow,
  formatDispatchShortRange,
  getDispatchVisitOperationalSignal,
  getDispatchVisitTimelineProgress,
  getDispatchVisitSupportingText,
  shouldEmphasizePriority
} from "./dispatch-calendar-signals";
import { DispatchConflictIndicator } from "./dispatch-conflict-indicator";
import {
  getDispatchThreadLaneActionRelation,
  getDispatchThreadBoardRelation,
  type DispatchThreadBoardContext
} from "./dispatch-thread-board-context";

type DispatchWeekCalendarProps = {
  activeThreadContext: DispatchThreadBoardContext;
  calendar: DispatchCalendarData;
  highlightedVisitId: string | null;
  now: Date;
  onFocusResourceConflicts: (technicianUserId: string) => void;
  onFocusSingleLane: (technicianUserId: string) => void;
  onOpenDay: (dayDate: string) => void;
  onOpenVisit: (jobId: string) => void;
  promiseSummaries: Array<{
    jobId: string;
    summary: DispatchOnBoardPromiseSummary;
  }>;
  selectedDate: string;
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

const previewCountByZoomPreset = {
  comfortable: 2,
  detail: 3,
  overview: 1
} as const;

function getWeekPreviewLimit(input: {
  jobCount: number;
  resourceCount: number;
  zoomPreset: "overview" | "comfortable" | "detail";
}) {
  const baseLimit = previewCountByZoomPreset[input.zoomPreset];

  if (input.zoomPreset === "detail") {
    return input.jobCount >= 5 || input.resourceCount >= 5 ? 2 : baseLimit;
  }

  if (input.jobCount >= 4 || input.resourceCount >= 6) {
    return 1;
  }

  return baseLimit;
}

function getColumnKey(dayDate: string, technicianUserId: string) {
  return `${dayDate}:${technicianUserId}`;
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((segment) => segment.trim()[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatBookedHours(minutes: number) {
  if (!minutes) {
    return "Open";
  }

  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h booked`;
}

function formatOpenHours(minutes: number) {
  const hours = minutes / 60;

  if (!hours) {
    return "No open time";
  }

  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h open`;
}

function getWeekResourceNote(input: {
  availabilityBlockCount: number;
  backlogCount: number;
  conflictCount: number;
  openMinutes: number;
}) {
  if (input.conflictCount > 0) {
    return `${input.conflictCount} conflict${input.conflictCount === 1 ? "" : "s"} to clear`;
  }

  if (input.backlogCount > 0) {
    return `${input.backlogCount} waiting to route`;
  }

  if (input.availabilityBlockCount > 0) {
    return `${formatOpenHours(input.openMinutes)} around ${input.availabilityBlockCount} block${
      input.availabilityBlockCount === 1 ? "" : "s"
    }`;
  }

  return `${formatOpenHours(input.openMinutes)} across the week`;
}

export function DispatchWeekCalendar({
  activeThreadContext,
  calendar,
  highlightedVisitId,
  now,
  onFocusResourceConflicts,
  onFocusSingleLane,
  onOpenDay,
  onOpenVisit,
  promiseSummaries,
  selectedDate,
  selectedVisitId,
  threadLaneActions,
  zoomPreset
}: DispatchWeekCalendarProps) {
  const promiseSummariesByJobId = new Map(
    promiseSummaries.map((entry) => [entry.jobId, entry.summary] as const)
  );
  const jobsByColumn = new Map<string, DispatchCalendarJobEvent[]>();
  const availabilityByColumn = new Map<string, DispatchCalendarAvailabilityEvent[]>();
  const conflictsByColumn = new Map<string, number>();
  const readyCountByDay = new Map<string, number>();
  const totalScheduledByDay = new Map<string, number>();
  const scheduledMinutesByDay = new Map<string, number>();
  const blockedMinutesByDay = new Map<string, number>();
  const scheduledMinutesByColumn = new Map<string, number>();
  const blockedMinutesByColumn = new Map<string, number>();
  const totalConflictsByDay = new Map<string, number>();
  const totalAvailabilityMinutesByResource = new Map<string, number>();
  const todayDate = getDispatchLocalDate(now, calendar.timezone);
  const dayCapacityMinutes = Math.max(
    (calendar.settings.dayEndHour - calendar.settings.dayStartHour) * 60,
    1
  );
  const totalDayCapacityMinutes = Math.max(dayCapacityMinutes * Math.max(calendar.resources.length, 1), 1);
  const totalWeekCapacityMinutes = Math.max(
    dayCapacityMinutes * Math.max(calendar.range.visibleDays.length, 1),
    1
  );
  for (const job of calendar.jobs) {
    if (!job.resourceTechnicianUserId) {
      continue;
    }

    const key = getColumnKey(job.dayDate, job.resourceTechnicianUserId);
    const current = jobsByColumn.get(key) ?? [];
    current.push(job);
    jobsByColumn.set(key, current);
    totalScheduledByDay.set(job.dayDate, (totalScheduledByDay.get(job.dayDate) ?? 0) + 1);
    scheduledMinutesByDay.set(
      job.dayDate,
      (scheduledMinutesByDay.get(job.dayDate) ?? 0) + job.durationMinutes
    );
    scheduledMinutesByColumn.set(
      key,
      (scheduledMinutesByColumn.get(key) ?? 0) + job.durationMinutes
    );
  }

  for (const laneJobs of jobsByColumn.values()) {
    laneJobs.sort(
      (left, right) =>
        new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime()
    );
  }

  for (const job of calendar.unassignedScheduledJobs) {
    if (!job.scheduledStartAt) {
      continue;
    }

    const dayDate = getDispatchLocalDate(job.scheduledStartAt, calendar.timezone);
    readyCountByDay.set(dayDate, (readyCountByDay.get(dayDate) ?? 0) + 1);
    totalScheduledByDay.set(dayDate, (totalScheduledByDay.get(dayDate) ?? 0) + 1);
  }

  for (const block of calendar.availability) {
    const key = getColumnKey(block.dayDate, block.technicianUserId);
    const current = availabilityByColumn.get(key) ?? [];
    current.push(block);
    availabilityByColumn.set(key, current);
    blockedMinutesByDay.set(
      block.dayDate,
      (blockedMinutesByDay.get(block.dayDate) ?? 0) + block.durationMinutes
    );
    blockedMinutesByColumn.set(
      key,
      (blockedMinutesByColumn.get(key) ?? 0) + block.durationMinutes
    );
    totalAvailabilityMinutesByResource.set(
      block.technicianUserId,
      (totalAvailabilityMinutesByResource.get(block.technicianUserId) ?? 0) + block.durationMinutes
    );
  }

  for (const laneAvailability of availabilityByColumn.values()) {
    laneAvailability.sort(
      (left, right) =>
        new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime()
    );
  }

  for (const conflict of calendar.conflicts) {
    totalConflictsByDay.set(
      conflict.dayDate,
      (totalConflictsByDay.get(conflict.dayDate) ?? 0) + 1
    );

    if (!conflict.technicianUserId) {
      continue;
    }

    const key = getColumnKey(conflict.dayDate, conflict.technicianUserId);
    conflictsByColumn.set(key, (conflictsByColumn.get(key) ?? 0) + 1);
  }

  const gridStyle = {
    "--dispatch-week-day-count": `${calendar.range.visibleDays.length}`,
    gridTemplateColumns: `248px repeat(${calendar.range.visibleDays.length}, minmax(${zoomPreset === "overview" ? 180 : zoomPreset === "detail" ? 240 : 210}px, 1fr))`
  } as CSSProperties;

  return (
    <div className="dispatch-week" data-zoom-preset={zoomPreset}>
      <div className="dispatch-week__grid" style={gridStyle}>
        <div className="dispatch-week__corner">
          <span className="dispatch-week__eyebrow">Field lanes</span>
          <strong>Route load</strong>
        </div>

        {calendar.range.visibleDays.map((day) => {
          const scheduledCount = totalScheduledByDay.get(day.date) ?? 0;
          const readyCount = readyCountByDay.get(day.date) ?? 0;
          const conflictCount = totalConflictsByDay.get(day.date) ?? 0;
          const scheduledMinutes = scheduledMinutesByDay.get(day.date) ?? 0;
          const blockedMinutes = blockedMinutesByDay.get(day.date) ?? 0;
          const utilizationPercent = Math.min((scheduledMinutes / totalDayCapacityMinutes) * 100, 100);
          const blockedPercent = Math.min((blockedMinutes / totalDayCapacityMinutes) * 100, 100);

          return (
            <button
              className={cx(
                "dispatch-week__day",
                day.date === selectedDate && "dispatch-week__day--selected",
                day.date === todayDate && "dispatch-week__day--today"
              )}
              key={day.date}
              onClick={() => onOpenDay(day.date)}
              type="button"
            >
              <div className="dispatch-week__day-copy">
                <span>{day.shortLabel}</span>
                <strong>{day.label}</strong>
              </div>
              <div className="dispatch-week__day-loadbar">
                <span
                  className="dispatch-week__day-loadbar-segment dispatch-week__day-loadbar-segment--scheduled"
                  style={{ width: `${utilizationPercent}%` }}
                />
                {blockedPercent ? (
                  <span
                    className="dispatch-week__day-loadbar-segment dispatch-week__day-loadbar-segment--blocked"
                    style={{ width: `${blockedPercent}%` }}
                  />
                ) : null}
              </div>
              <div className="dispatch-week__day-signals">
                {scheduledCount ? (
                  <span className="dispatch-week__day-metric">{scheduledCount} booked</span>
                ) : null}
                {readyCount ? (
                  <span className="dispatch-week__day-metric dispatch-week__day-metric--warning">
                    {readyCount} ready
                  </span>
                ) : null}
                {conflictCount ? (
                  <span className="dispatch-week__day-metric dispatch-week__day-metric--danger">
                    {conflictCount} conflicts
                  </span>
                ) : null}
                {!scheduledCount && !readyCount && !conflictCount ? (
                  <span className="dispatch-week__day-metric dispatch-week__day-metric--neutral">
                    Open
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}

        {calendar.resources.map((resource) => {
          const resourceThreadActionRelation = getDispatchThreadLaneActionRelation({
            context: activeThreadContext,
            orderedResourceTechnicianUserIds: calendar.resources.map(
              (entry) => entry.technicianUserId
            ),
            resourceTechnicianUserId: resource.technicianUserId
          });
          const resourceThreadRelation = getDispatchThreadBoardRelation({
            context: activeThreadContext,
            resourceTechnicianUserId: resource.technicianUserId,
            visitId: selectedVisitId ?? "__dispatch-week-resource__"
          });
          const resourceJobs = calendar.jobs.filter(
            (job) => job.resourceTechnicianUserId === resource.technicianUserId
          );
          const blockedMinutes = totalAvailabilityMinutesByResource.get(resource.technicianUserId) ?? 0;
          const openMinutes = Math.max(
            totalWeekCapacityMinutes -
              Math.min(resource.scheduledMinutes + blockedMinutes, totalWeekCapacityMinutes),
            0
          );
          const scheduledPercent = Math.min(
            (resource.scheduledMinutes / totalWeekCapacityMinutes) * 100,
            100
          );
          const blockedPercent = Math.min(
            (blockedMinutes / totalWeekCapacityMinutes) * 100,
            100
          );
          const laneFollowThrough = summarizeDispatchLaneFollowThrough(
            buildDispatchOnBoardFollowThroughItems({
              jobs: resourceJobs,
              now,
              promiseSummariesByJobId
            })
          );
          const dailySpark = calendar.range.visibleDays.map((day) => {
            const key = getColumnKey(day.date, resource.technicianUserId);
            const scheduledMinutes = scheduledMinutesByColumn.get(key) ?? 0;
            const blockedMinutes = blockedMinutesByColumn.get(key) ?? 0;
            const conflictCount = conflictsByColumn.get(key) ?? 0;

            return {
              blockedPercent: Math.min((blockedMinutes / dayCapacityMinutes) * 100, 100),
              conflictCount,
              label: `${day.shortLabel} ${day.label}`,
              scheduledPercent: Math.min((scheduledMinutes / dayCapacityMinutes) * 100, 100)
            };
          });

          return (
            <Fragment key={resource.technicianUserId}>
              <aside
                className="dispatch-week__resource"
                data-thread-state={
                  resourceThreadRelation.matchesLane
                    ? "neighbor"
                    : resourceThreadRelation.isDimmed
                      ? "dimmed"
                      : undefined
                }
                style={
                  resource.laneColor
                    ? ({ "--dispatch-lane-accent": resource.laneColor } as CSSProperties)
                    : undefined
                }
              >
                <div className="dispatch-week__resource-topline">
                  <div className="dispatch-week__resource-identity">
                    <span className="dispatch-week__resource-avatar">
                      {getInitials(resource.displayName)}
                    </span>
                    <div className="dispatch-week__resource-copy">
                      <strong>{resource.displayName}</strong>
                      <span>
                        {getWeekResourceNote({
                          availabilityBlockCount: resource.availabilityBlockCount,
                          backlogCount: resource.backlogCount,
                          conflictCount: resource.conflictCount,
                          openMinutes
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="dispatch-week__resource-actions">
                    {threadLaneActions && resourceThreadActionRelation.isCurrentLane
                      ? (
                          <>
                            {threadLaneActions.canSendUpdate ? (
                              <button
                                className="dispatch-week__resource-action dispatch-week__resource-action--primary"
                                disabled={threadLaneActions.sendUpdatePending}
                                onClick={threadLaneActions.onSendUpdate}
                                type="button"
                              >
                                {threadLaneActions.sendUpdateLabel}
                              </button>
                            ) : null}
                            <button
                              className="dispatch-week__resource-action"
                              onClick={() => onFocusSingleLane(resource.technicianUserId)}
                              type="button"
                            >
                              Hold lane
                            </button>
                            {threadLaneActions.canDefer ? (
                              <button
                                className="dispatch-week__resource-action"
                                disabled={threadLaneActions.deferPending}
                                onClick={threadLaneActions.onDefer}
                                type="button"
                              >
                                Defer to queue
                              </button>
                            ) : null}
                          </>
                        )
                      : threadLaneActions && resourceThreadActionRelation.isAdjacentLane
                        ? (
                            <button
                              className="dispatch-week__resource-action dispatch-week__resource-action--primary"
                              disabled={threadLaneActions.reroutePending}
                              onClick={() => threadLaneActions.onTakeLane(resource.technicianUserId)}
                              type="button"
                            >
                              Take this stop
                            </button>
                          )
                        : null}
                    {!resourceThreadActionRelation.isCurrentLane ? (
                      <button
                        className="dispatch-week__resource-action"
                        onClick={() => onFocusSingleLane(resource.technicianUserId)}
                        type="button"
                      >
                        Focus lane
                      </button>
                    ) : null}
                    <DispatchConflictIndicator
                      count={resource.conflictCount}
                      onClick={
                        resource.conflictCount
                          ? () => onFocusResourceConflicts(resource.technicianUserId)
                          : undefined
                      }
                    />
                  </div>
                </div>

                <div className="dispatch-week__resource-metrics">
                  <span className="dispatch-week__resource-metric dispatch-week__resource-metric--primary">
                    {formatBookedHours(resource.scheduledMinutes)}
                  </span>
                  <span className="dispatch-week__resource-metric">
                    {resource.scheduledCount} stops
                  </span>
                  {laneFollowThrough.attentionCount ? (
                    <span
                      className={cx(
                        "dispatch-week__resource-metric",
                        "dispatch-week__resource-metric--follow-through",
                        laneFollowThrough.highestRiskTone === "danger" &&
                          "dispatch-week__resource-metric--follow-through-danger",
                        laneFollowThrough.highestRiskTone === "warning" &&
                          "dispatch-week__resource-metric--follow-through-warning"
                      )}
                    >
                      {laneFollowThrough.attentionCount} timing risk
                      {laneFollowThrough.attentionCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {laneFollowThrough.attentionCount ? (
                    <span className="dispatch-week__resource-metric">
                      {laneFollowThrough.staleLabel}
                    </span>
                  ) : null}
                  <span className="dispatch-week__resource-metric">
                    {formatOpenHours(openMinutes)}
                  </span>
                  {resource.availabilityBlockCount && resource.conflictCount === 0 ? (
                    <span className="dispatch-week__resource-metric">
                      {resource.availabilityBlockCount} block{resource.availabilityBlockCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>

                <div className="dispatch-week__resource-spark" aria-hidden>
                  {dailySpark.map((daySpark) => (
                    <span
                      className="dispatch-week__resource-spark-day"
                      data-conflicted={daySpark.conflictCount > 0 ? "true" : "false"}
                      key={`${resource.technicianUserId}-${daySpark.label}`}
                      title={daySpark.label}
                    >
                      <span
                        className="dispatch-week__resource-spark-bar dispatch-week__resource-spark-bar--scheduled"
                        style={{ height: `${Math.max(daySpark.scheduledPercent, daySpark.scheduledPercent ? 14 : 6)}%` }}
                      />
                      {daySpark.blockedPercent ? (
                        <span
                          className="dispatch-week__resource-spark-bar dispatch-week__resource-spark-bar--blocked"
                          style={{ height: `${Math.max(daySpark.blockedPercent, 10)}%` }}
                        />
                      ) : null}
                    </span>
                  ))}
                </div>

                <div className="dispatch-week__resource-loadbar">
                  <span
                    className="dispatch-week__resource-loadbar-segment dispatch-week__resource-loadbar-segment--scheduled"
                    style={{ width: `${scheduledPercent}%` }}
                  />
                  {blockedPercent ? (
                    <span
                      className="dispatch-week__resource-loadbar-segment dispatch-week__resource-loadbar-segment--blocked"
                      style={{ width: `${blockedPercent}%` }}
                    />
                  ) : null}
                </div>
              </aside>

              {calendar.range.visibleDays.map((day) => {
                const key = getColumnKey(day.date, resource.technicianUserId);
                const laneJobs = jobsByColumn.get(key) ?? [];
                const laneAvailability = availabilityByColumn.get(key) ?? [];
                const conflictCount = conflictsByColumn.get(key) ?? 0;
                const scheduledMinutes = laneJobs.reduce(
                  (total, job) => total + job.durationMinutes,
                  0
                );
                const blockedMinutes = blockedMinutesByColumn.get(key) ?? 0;
                const openMinutes = Math.max(
                  dayCapacityMinutes - Math.min(scheduledMinutes + blockedMinutes, dayCapacityMinutes),
                  0
                );
                const utilizationPercent = Math.min((scheduledMinutes / dayCapacityMinutes) * 100, 100);
                const blockedPercent = Math.min((blockedMinutes / dayCapacityMinutes) * 100, 100);
                const loadState = getDispatchLaneLoadState({
                  availabilityCount: laneAvailability.length,
                  blockedPercent,
                  conflictCount,
                  utilizationPercent
                });
                const visibleJobLimit = getWeekPreviewLimit({
                  jobCount: laneJobs.length,
                  resourceCount: calendar.resources.length,
                  zoomPreset
                });
                const overflowCount = Math.max(laneJobs.length - visibleJobLimit, 0);
                const visibleJobs = laneJobs.slice(0, visibleJobLimit);
                const isOpenCell = laneJobs.length === 0 && laneAvailability.length === 0 && conflictCount === 0;
                const isDenseCell = overflowCount > 0 || laneJobs.length >= 4;

                return (
                  <section
                    className={cx(
                      "dispatch-week__cell",
                      resourceThreadRelation.matchesLane && "dispatch-week__cell--thread-neighbor",
                      resourceThreadRelation.isDimmed && "dispatch-week__cell--thread-dimmed",
                      day.date === selectedDate && "dispatch-week__cell--selected",
                      day.date === todayDate && "dispatch-week__cell--today",
                      conflictCount > 0 && "dispatch-week__cell--conflicted",
                      isDenseCell && "dispatch-week__cell--dense",
                      laneJobs.length === 0 &&
                        laneAvailability.length === 0 &&
                        "dispatch-week__cell--open"
                    )}
                    data-pressure={loadState.tone}
                    key={key}
                  >
                    <div className="dispatch-week__cell-loadbar">
                      <span
                        className="dispatch-week__cell-loadbar-segment dispatch-week__cell-loadbar-segment--scheduled"
                        style={{ width: `${utilizationPercent}%` }}
                      />
                      {blockedPercent ? (
                        <span
                          className="dispatch-week__cell-loadbar-segment dispatch-week__cell-loadbar-segment--blocked"
                          style={{ width: `${blockedPercent}%` }}
                        />
                      ) : null}
                    </div>

                    {isOpenCell ? (
                      <div className="dispatch-week__cell-empty">
                        <span className="dispatch-week__cell-empty-kicker">Route open</span>
                        <strong>{formatOpenHours(openMinutes)}</strong>
                      </div>
                    ) : (
                      <div className="dispatch-week__cell-header">
                        <div className="dispatch-week__cell-copy">
                          <strong>{loadState.label}</strong>
                          <span>
                            {laneJobs.length
                              ? formatBookedHours(scheduledMinutes)
                              : laneAvailability.length
                                ? `${laneAvailability.length} blocks`
                                : formatOpenHours(openMinutes)}
                          </span>
                        </div>
                        <div className="dispatch-week__cell-actions">
                          {conflictCount ? (
                            <DispatchConflictIndicator
                              count={conflictCount}
                              onClick={() =>
                                onFocusResourceConflicts(resource.technicianUserId)
                              }
                              tone="warning"
                            />
                          ) : null}
                          {laneJobs.length || laneAvailability.length ? (
                            <span className="dispatch-week__cell-load-copy">
                              {Math.round(utilizationPercent)}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {laneAvailability.length ? (
                      <button
                        className="dispatch-week__availability"
                        onClick={() => onOpenDay(day.date)}
                        type="button"
                      >
                        {laneAvailability[0]?.title ?? "Availability block"}
                        {laneAvailability.length > 1
                          ? ` +${laneAvailability.length - 1} more`
                          : ""}
                      </button>
                    ) : null}

                    {visibleJobs.length ? (
                      <div className="dispatch-week__jobs">
                        {visibleJobs.map((job) => {
                          const threadRelation = getDispatchThreadBoardRelation({
                            context: activeThreadContext,
                            dayDate: day.date,
                            resourceTechnicianUserId: job.resourceTechnicianUserId,
                            visitId: job.id
                          });
                          const signal = getDispatchVisitOperationalSignal(
                            job,
                            calendar.timezone,
                            now
                          );
                          const promiseSummary = promiseSummariesByJobId.get(job.id) ?? null;
                          const followThroughNeedsAttention = Boolean(
                            promiseSummary &&
                              promiseSummary.recommendedAction &&
                              (promiseSummary.tone === "warning" || promiseSummary.tone === "danger")
                          );
                          const timelineProgress = getDispatchVisitTimelineProgress(job, now);
                          const arrivalWindow = formatDispatchArrivalWindow(
                            job,
                            calendar.timezone
                          );

                          return (
                            <button
                              className={cx(
                                "dispatch-week__job",
                                highlightedVisitId === job.id && "dispatch-week__job--placement-highlight",
                                threadRelation.isNeighbor && "dispatch-week__job--thread-neighbor",
                                threadRelation.isDimmed && "dispatch-week__job--thread-dimmed",
                                selectedVisitId === job.id && "dispatch-week__job--selected",
                                signal.tone === "danger" && "dispatch-week__job--danger",
                                signal.tone === "progress" && "dispatch-week__job--progress",
                                followThroughNeedsAttention &&
                                  "dispatch-week__job--follow-through-attention",
                                timelineProgress.isLive && "dispatch-week__job--live",
                                timelineProgress.isLate && "dispatch-week__job--late"
                              )}
                              id={`dispatch-job-${job.id}`}
                              key={job.id}
                              onClick={() => onOpenVisit(job.id)}
                              type="button"
                            >
                              <div className="dispatch-week__job-topline">
                                <span className="dispatch-week__job-time">
                                  {timelineProgress.isLive ? (
                                    <span
                                      aria-hidden
                                      className="dispatch-week__job-live-dot"
                                    />
                                  ) : null}
                                  {formatDispatchShortRange(
                                    job.eventStartAt,
                                    job.eventEndAt,
                                    calendar.timezone
                                  )}
                                </span>
                                <span
                                  className={cx(
                                    "dispatch-week__job-signal",
                                    `dispatch-week__job-signal--${signal.tone}`
                                  )}
                                >
                                  {signal.label}
                                </span>
                              </div>

                              <strong>{job.title}</strong>

                              {zoomPreset !== "overview" && !isDenseCell ? (
                                <p>
                                  {job.customerDisplayName} · {job.vehicleDisplayName}
                                </p>
                              ) : null}

                              <div className="dispatch-week__job-footer">
                                {shouldEmphasizePriority(job.priority) ? (
                                  <PriorityBadge value={job.priority} />
                                ) : null}
                                {followThroughNeedsAttention ? (
                                  <span
                                    className={cx(
                                      "dispatch-week__job-follow-chip",
                                      promiseSummary?.tone === "danger"
                                        ? "dispatch-week__job-follow-chip--danger"
                                        : "dispatch-week__job-follow-chip--warning"
                                    )}
                                  >
                                    {getDispatchOnBoardFollowThroughActionLabel(
                                      promiseSummary?.recommendedAction ?? null
                                    )}
                                  </span>
                                ) : null}
                                {zoomPreset === "detail" && arrivalWindow && !isDenseCell ? (
                                  <span className="dispatch-week__job-support">
                                    {followThroughNeedsAttention
                                      ? promiseSummary?.lastCustomerUpdateLabel ?? `Promise ${arrivalWindow}`
                                      : `Promise ${arrivalWindow}`}
                                  </span>
                                ) : zoomPreset !== "overview" && !isDenseCell ? (
                                  <span className="dispatch-week__job-support">
                                    {followThroughNeedsAttention
                                      ? promiseSummary?.lastCustomerUpdateLabel ??
                                        getDispatchVisitSupportingText(job, calendar.timezone)
                                      : getDispatchVisitSupportingText(job, calendar.timezone)}
                                  </span>
                                ) : null}
                              </div>

                              {timelineProgress.progressPercent !== null ? (
                                <div
                                  className={cx(
                                    "dispatch-week__job-progress",
                                    timelineProgress.isLate &&
                                      "dispatch-week__job-progress--late"
                                  )}
                                >
                                  <span
                                    className="dispatch-week__job-progress-fill"
                                    style={{ width: `${timelineProgress.progressPercent}%` }}
                                  />
                                </div>
                              ) : null}
                            </button>
                          );
                        })}

                        {overflowCount ? (
                          <button
                            className="dispatch-week__more"
                            onClick={() => onOpenDay(day.date)}
                            type="button"
                          >
                            +{overflowCount} more stops
                          </button>
                        ) : null}
                      </div>
                    ) : laneAvailability.length ? (
                      <button
                        className="dispatch-week__open-day"
                        onClick={() => onOpenDay(day.date)}
                        type="button"
                      >
                        Review lane
                      </button>
                    ) : null}
                  </section>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
