"use client";

import {
  formatDispatchDateTime,
  getDispatchLocalDate,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";
import type { DispatchCalendarConflict, DispatchCalendarData, JobStatus } from "@mobile-mechanic/types";

import { cx } from "../../../../components/ui";
import {
  getDispatchThreadBoardRelation,
  type DispatchThreadBoardContext
} from "./dispatch-thread-board-context";

type DispatchMonthCalendarProps = {
  activeThreadContext: DispatchThreadBoardContext;
  calendar: DispatchCalendarData;
  highlightedVisitId: string | null;
  now: Date;
  onOpenDay: (dayDate: string) => void;
  onOpenVisit: (jobId: string) => void;
  selectedDate: string;
  selectedVisitId: string | null;
};

type MonthJobPreview = {
  assignedTechnicianName: string | null;
  id: string;
  isConflicted: boolean;
  isUnassigned: boolean;
  priority: DispatchCalendarData["jobs"][number]["priority"];
  scheduledStartAt: string;
  status: JobStatus;
  title: string;
};

function buildVisibleWeekdayCount(calendar: DispatchCalendarData) {
  let count = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = (calendar.settings.weekStartsOn + offset) % 7;

    if (weekday === 0 && !calendar.settings.showSunday) {
      continue;
    }

    if (weekday === 6 && !calendar.settings.showSaturday) {
      continue;
    }

    count += 1;
  }

  return Math.max(count, 1);
}

function compareMonthJobPreviews(left: MonthJobPreview, right: MonthJobPreview) {
  if (left.isUnassigned !== right.isUnassigned) {
    return left.isUnassigned ? -1 : 1;
  }

  if (left.priority !== right.priority) {
    const rank = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3
    } as const;

    return rank[left.priority] - rank[right.priority];
  }

  const leftStart = new Date(left.scheduledStartAt).getTime();
  const rightStart = new Date(right.scheduledStartAt).getTime();

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function buildMonthPreviewMap(calendar: DispatchCalendarData) {
  const previewsByDay = new Map<string, MonthJobPreview[]>();
  const conflictedJobIds = new Set(
    calendar.conflicts
      .map((conflict) => conflict.jobId)
      .filter((value): value is string => Boolean(value))
  );

  for (const job of calendar.jobs) {
    const current = previewsByDay.get(job.dayDate) ?? [];
    current.push({
      assignedTechnicianName: job.assignedTechnicianName,
      id: job.id,
      isConflicted: conflictedJobIds.has(job.id),
      isUnassigned: false,
      priority: job.priority,
      scheduledStartAt: job.eventStartAt,
      status: job.status,
      title: job.title
    });
    previewsByDay.set(job.dayDate, current);
  }

  for (const job of calendar.unassignedScheduledJobs) {
    if (!job.scheduledStartAt) {
      continue;
    }

    const dayDate = getDispatchLocalDate(job.scheduledStartAt, calendar.timezone);
    const current = previewsByDay.get(dayDate) ?? [];
    current.push({
      assignedTechnicianName: null,
      id: job.id,
      isConflicted: conflictedJobIds.has(job.id),
      isUnassigned: true,
      priority: job.priority,
      scheduledStartAt: job.scheduledStartAt,
      status: job.status,
      title: job.title
    });
    previewsByDay.set(dayDate, current);
  }

  for (const previews of previewsByDay.values()) {
    previews.sort(compareMonthJobPreviews);
  }

  return previewsByDay;
}

function buildConflictMap(conflicts: DispatchCalendarConflict[]) {
  const conflictsByDay = new Map<string, DispatchCalendarConflict[]>();

  for (const conflict of conflicts) {
    const current = conflictsByDay.get(conflict.dayDate) ?? [];
    current.push(conflict);
    conflictsByDay.set(conflict.dayDate, current);
  }

  return conflictsByDay;
}

function buildScheduledMinutesByDay(calendar: DispatchCalendarData) {
  const minutesByDay = new Map<string, number>();

  for (const job of calendar.jobs) {
    minutesByDay.set(job.dayDate, (minutesByDay.get(job.dayDate) ?? 0) + job.durationMinutes);
  }

  return minutesByDay;
}

function buildAvailabilityMinutesByDay(calendar: DispatchCalendarData) {
  const minutesByDay = new Map<string, number>();

  for (const block of calendar.availability) {
    minutesByDay.set(
      block.dayDate,
      (minutesByDay.get(block.dayDate) ?? 0) + block.durationMinutes
    );
  }

  return minutesByDay;
}

function getMonthStatusLabel(input: { isUnassigned: boolean; status: JobStatus }) {
  if (input.isUnassigned) {
    return "Lane needed";
  }

  if (isTechnicianActiveFieldJobStatus(input.status)) {
    return "Live";
  }

  if (input.status === "scheduled") {
    return "Booked";
  }

  if (input.status === "completed") {
    return "Done";
  }

  if (input.status === "canceled") {
    return "Canceled";
  }

  return input.status.replaceAll("_", " ");
}

function getMonthPreviewLimit(input: {
  conflictCount: number;
  previewCount: number;
  readyCount: number;
}) {
  if (input.previewCount >= 5 || input.conflictCount > 0 || input.readyCount > 0) {
    return 1;
  }

  return 2;
}

export function DispatchMonthCalendar({
  activeThreadContext,
  calendar,
  highlightedVisitId,
  now,
  onOpenDay,
  onOpenVisit,
  selectedDate,
  selectedVisitId
}: DispatchMonthCalendarProps) {
  const todayDate = getDispatchLocalDate(now, calendar.timezone);
  const daysPerWeek = buildVisibleWeekdayCount(calendar);
  const visibleDays = calendar.range.visibleDays;
  const weekdayHeaders = visibleDays.slice(0, daysPerWeek);
  const previewMap = buildMonthPreviewMap(calendar);
  const conflictMap = buildConflictMap(calendar.conflicts);
  const scheduledMinutesByDay = buildScheduledMinutesByDay(calendar);
  const blockedMinutesByDay = buildAvailabilityMinutesByDay(calendar);
  const currentMonthPrefix = calendar.range.date.slice(0, 7);
  const totalDayCapacityMinutes = Math.max(
    (calendar.settings.dayEndHour - calendar.settings.dayStartHour) *
      60 *
      Math.max(calendar.resources.length, 1),
    1
  );
  const weeks = Array.from(
    { length: Math.ceil(visibleDays.length / daysPerWeek) },
    (_, index) => visibleDays.slice(index * daysPerWeek, (index + 1) * daysPerWeek)
  );
  const visibleLaneCount = Math.max(calendar.resources.length, 1);

  return (
    <div className="dispatch-month">
      <div
        className="dispatch-month__weekday-row"
        style={{ gridTemplateColumns: `repeat(${daysPerWeek}, minmax(0, 1fr))` }}
      >
        {weekdayHeaders.map((day) => (
          <div className="dispatch-month__weekday" key={day.date}>
            <span>{day.shortLabel}</span>
          </div>
        ))}
      </div>

      <div className="dispatch-month__weeks">
        {weeks.map((week, weekIndex) => (
          <div
            className="dispatch-month__week"
            key={`week-${weekIndex + 1}`}
            style={{ gridTemplateColumns: `repeat(${daysPerWeek}, minmax(0, 1fr))` }}
          >
            {week.map((day) => {
              const previews = previewMap.get(day.date) ?? [];
              const readyCount = previews.filter((preview) => preview.isUnassigned).length;
              const conflictCount = conflictMap.get(day.date)?.length ?? 0;
              const visiblePreviewLimit = getMonthPreviewLimit({
                conflictCount,
                previewCount: previews.length,
                readyCount
              });
              const visiblePreviews = previews.slice(0, visiblePreviewLimit);
              const overflowCount = Math.max(previews.length - visiblePreviews.length, 0);
              const isOutsideMonth = !day.date.startsWith(currentMonthPrefix);
              const isToday = day.date === todayDate;
              const isSelected = day.date === selectedDate;
              const scheduledMinutes = scheduledMinutesByDay.get(day.date) ?? 0;
              const blockedMinutes = blockedMinutesByDay.get(day.date) ?? 0;
              const utilizationPercent = Math.min((scheduledMinutes / totalDayCapacityMinutes) * 100, 100);
              const blockedPercent = Math.min((blockedMinutes / totalDayCapacityMinutes) * 100, 100);
              const daySummary =
                conflictCount > 0
                  ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`
                  : readyCount > 0
                    ? `${readyCount} waiting for lane`
                    : previews.length > 0
                      ? `${Math.round(utilizationPercent)}% routed`
                      : null;
              const pressure =
                conflictCount > 0
                  ? "danger"
                  : readyCount > 0
                    ? "warning"
                    : utilizationPercent >= 88
                      ? "busy"
                      : previews.length > 0
                        ? "active"
                        : "open";
              const openState =
                previews.length === 0 && !readyCount && !conflictCount && !isOutsideMonth
                  ? blockedPercent > 0
                    ? {
                        detail: `${Math.round(blockedPercent)}% shaped`,
                        label: "Window shaped",
                        tone: "shaped" as const
                      }
                    : day.date >= todayDate
                      ? {
                          detail: `${visibleLaneCount} lane${visibleLaneCount === 1 ? "" : "s"} ready`,
                          label: day.date === todayDate ? "Open today" : "Routes open",
                          tone: "open" as const
                        }
                      : null
                  : null;
              const dayThreadRelation = getDispatchThreadBoardRelation({
                context: activeThreadContext,
                dayDate: day.date,
                visitId: selectedVisitId ?? "__dispatch-month-day__"
              });

              return (
                <article
                  className={cx(
                    "dispatch-month__day",
                    dayThreadRelation.isNeighbor && "dispatch-month__day--thread-neighbor",
                    dayThreadRelation.isDimmed && "dispatch-month__day--thread-dimmed",
                    previews.length > 0 && "dispatch-month__day--busy",
                    conflictCount > 0 && "dispatch-month__day--conflicted",
                    isOutsideMonth && "dispatch-month__day--outside",
                    isToday && "dispatch-month__day--today",
                    isSelected && "dispatch-month__day--selected"
                  )}
                  data-pressure={pressure}
                  key={day.date}
                >
                  <div className="dispatch-month__day-loadbar">
                    <span
                      className="dispatch-month__day-loadbar-segment dispatch-month__day-loadbar-segment--scheduled"
                      style={{ width: `${utilizationPercent}%` }}
                    />
                    {blockedPercent ? (
                      <span
                        className="dispatch-month__day-loadbar-segment dispatch-month__day-loadbar-segment--blocked"
                        style={{ width: `${blockedPercent}%` }}
                      />
                    ) : null}
                  </div>

                  <button
                    className="dispatch-month__day-link"
                    onClick={() => onOpenDay(day.date)}
                    type="button"
                  >
                    <div className="dispatch-month__day-header">
                      <div className="dispatch-month__day-heading">
                        <strong>{Number(day.date.slice(-2))}</strong>
                        <span>{day.label}</span>
                      </div>
                      <div className="dispatch-month__day-signals">
                        {previews.length ? (
                          <span className="dispatch-month__day-signal">
                            {previews.length} stops
                          </span>
                        ) : null}
                        {readyCount ? (
                          <span className="dispatch-month__day-signal dispatch-month__day-signal--warning">
                            {readyCount} waiting
                          </span>
                        ) : null}
                        {conflictCount ? (
                          <span className="dispatch-month__day-signal dispatch-month__day-signal--danger">
                            {conflictCount} conflicts
                          </span>
                        ) : null}
                      </div>
                    </div>

                  {daySummary ? <p className="dispatch-month__day-summary">{daySummary}</p> : null}
                  </button>

                  {visiblePreviews.length || overflowCount ? (
                    <div className="dispatch-month__events">
                      {visiblePreviews.map((preview) => (
                        (() => {
                          const threadRelation = getDispatchThreadBoardRelation({
                            context: activeThreadContext,
                            dayDate: day.date,
                            visitId: preview.id
                          });

                          return (
                        <button
                          className={cx(
                            "dispatch-month__event",
                            highlightedVisitId === preview.id && "dispatch-month__event--placement-highlight",
                            threadRelation.isNeighbor && "dispatch-month__event--thread-neighbor",
                            threadRelation.isDimmed && "dispatch-month__event--thread-dimmed",
                            preview.isUnassigned && "dispatch-month__event--unassigned",
                            preview.isConflicted && "dispatch-month__event--conflicted",
                            preview.priority === "high" && "dispatch-month__event--high",
                            preview.priority === "urgent" && "dispatch-month__event--urgent",
                            selectedVisitId === preview.id && "dispatch-month__event--selected"
                          )}
                          id={`dispatch-job-${preview.id}`}
                          key={preview.id}
                          onClick={() => onOpenVisit(preview.id)}
                          type="button"
                        >
                          <div className="dispatch-month__event-topline">
                            <span>
                              {formatDispatchDateTime(preview.scheduledStartAt, calendar.timezone, {
                                day: undefined,
                                hour: "numeric",
                                minute: "2-digit",
                                month: undefined
                              })}
                            </span>
                            <span>{preview.isUnassigned ? "Lane needed" : preview.assignedTechnicianName ?? "Booked"}</span>
                          </div>
                          <strong>{preview.title}</strong>
                          <span className="dispatch-month__event-meta">
                            {getMonthStatusLabel({
                              isUnassigned: preview.isUnassigned,
                              status: preview.status
                            })}
                          </span>
                        </button>
                          );
                        })()
                      ))}

                      {overflowCount ? (
                        <button
                          className="dispatch-month__more"
                          onClick={() => onOpenDay(day.date)}
                          type="button"
                        >
                          +{overflowCount} more stops
                        </button>
                      ) : null}
                    </div>
                  ) : openState ? (
                    <div className="dispatch-month__open-state" data-tone={openState.tone}>
                      <span className="dispatch-month__open-state-kicker">{openState.label}</span>
                      <strong className="dispatch-month__open-state-title">{openState.detail}</strong>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
