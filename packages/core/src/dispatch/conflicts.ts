import type {
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarConflict,
  DispatchBoardJobItem,
  DispatchCalendarJobEvent,
  DispatchCalendarSettings
} from "@mobile-mechanic/types";

import { getDispatchDateTimeParts, getDispatchLocalDate } from "./scheduling";

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return new Date(leftStart).getTime() < new Date(rightEnd).getTime() &&
    new Date(leftEnd).getTime() > new Date(rightStart).getTime();
}

function buildOutsideHoursConflict(
  event: DispatchCalendarJobEvent,
  settings: DispatchCalendarSettings,
  timeZone: string
): DispatchCalendarConflict | null {
  const startParts = getDispatchDateTimeParts(event.eventStartAt, timeZone);
  const endParts = getDispatchDateTimeParts(event.eventEndAt, timeZone);
  const localStartMinutes =
    Number(startParts.time.slice(0, 2)) * 60 + Number(startParts.time.slice(3, 5));
  const localEndMinutes =
    Number(endParts.time.slice(0, 2)) * 60 + Number(endParts.time.slice(3, 5));
  const startBoundaryMinutes = settings.dayStartHour * 60;
  const endBoundaryMinutes = settings.dayEndHour * 60;

  if (
    startParts.date === event.dayDate &&
    endParts.date === event.dayDate &&
    localStartMinutes >= startBoundaryMinutes &&
    localEndMinutes <= endBoundaryMinutes
  ) {
    return null;
  }

  return {
    id: `outside-hours-${event.id}`,
    conflictType: "outside_hours",
    severity: "warning",
    title: "Outside business hours",
    description: `${event.title} extends outside the configured dispatch hours.`,
    dayDate: event.dayDate,
    technicianUserId: event.resourceTechnicianUserId,
    jobId: event.id,
    availabilityBlockId: null
  };
}

export function detectDispatchConflicts(input: {
  availability: DispatchCalendarAvailabilityEvent[];
  backlogJobs?: DispatchBoardJobItem[] | null | undefined;
  jobs: DispatchCalendarJobEvent[];
  settings: DispatchCalendarSettings;
  timeZone: string;
}) {
  const conflicts: DispatchCalendarConflict[] = [];

  const jobsByLane = new Map<string, DispatchCalendarJobEvent[]>();
  const blocksByLane = new Map<string, DispatchCalendarAvailabilityEvent[]>();

  for (const event of input.jobs) {
    const laneKey = `${event.dayDate}:${event.resourceTechnicianUserId ?? "unassigned"}`;
    const laneEvents = jobsByLane.get(laneKey) ?? [];
    laneEvents.push(event);
    jobsByLane.set(laneKey, laneEvents);

    const outsideHoursConflict = buildOutsideHoursConflict(
      event,
      input.settings,
      input.timeZone
    );

    if (outsideHoursConflict) {
      conflicts.push(outsideHoursConflict);
    }

  }

  for (const backlogJob of input.backlogJobs ?? []) {
    if (!backlogJob.assignedTechnicianUserId) {
      continue;
    }

    conflicts.push({
      id: `backlog-assigned-${backlogJob.id}`,
      conflictType: "backlog_assigned",
      severity: "warning",
      title: "Assigned without a scheduled time",
      description: `${backlogJob.title} is assigned but still unscheduled.`,
      dayDate: getDispatchLocalDate(new Date(), input.timeZone),
      technicianUserId: backlogJob.assignedTechnicianUserId,
      jobId: backlogJob.id,
      availabilityBlockId: null
    });
  }

  for (const block of input.availability) {
    const laneKey = `${block.dayDate}:${block.technicianUserId}`;
    const laneBlocks = blocksByLane.get(laneKey) ?? [];
    laneBlocks.push(block);
    blocksByLane.set(laneKey, laneBlocks);
  }

  for (const [laneKey, laneJobs] of jobsByLane.entries()) {
    const sortedJobs = [...laneJobs].sort(
      (left, right) =>
        new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime()
    );

    for (let index = 0; index < sortedJobs.length; index += 1) {
      const current = sortedJobs[index];

      if (!current) {
        continue;
      }

      for (let nextIndex = index + 1; nextIndex < sortedJobs.length; nextIndex += 1) {
        const next = sortedJobs[nextIndex];

        if (!next) {
          continue;
        }

        if (new Date(next.eventStartAt).getTime() >= new Date(current.eventEndAt).getTime()) {
          break;
        }

        if (overlaps(current.eventStartAt, current.eventEndAt, next.eventStartAt, next.eventEndAt)) {
          conflicts.push({
            id: `job-overlap-${current.id}-${next.id}`,
            conflictType: "job_overlap",
            severity: "danger",
            title: "Job overlap",
            description: `${current.title} overlaps ${next.title}.`,
            dayDate: current.dayDate,
            technicianUserId: current.resourceTechnicianUserId,
            jobId: current.id,
            availabilityBlockId: null
          });
        }
      }
    }

    const laneBlocks = blocksByLane.get(laneKey) ?? [];

    for (const job of sortedJobs) {
      const matchingBlocks = laneBlocks.filter((block) =>
        overlaps(job.eventStartAt, job.eventEndAt, block.eventStartAt, block.eventEndAt)
      );

      for (const matchingBlock of matchingBlocks) {
        conflicts.push({
          id: `availability-overlap-${job.id}-${matchingBlock.id}`,
          conflictType: "availability_overlap",
          severity: "danger",
          title: "Availability conflict",
          description: `${job.title} overlaps ${matchingBlock.title}.`,
          dayDate: job.dayDate,
          technicianUserId: job.resourceTechnicianUserId,
          jobId: job.id,
          availabilityBlockId: matchingBlock.id
        });
      }
    }
  }

  return conflicts;
}
