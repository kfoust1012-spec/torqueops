import type { JobStatus, TechnicianAllowedStatus } from "@mobile-mechanic/types";

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  new: ["scheduled", "dispatched", "canceled"],
  scheduled: ["dispatched", "en_route", "canceled"],
  dispatched: ["scheduled", "en_route", "canceled"],
  en_route: ["scheduled", "dispatched", "arrived", "canceled"],
  arrived: ["diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed", "canceled"],
  diagnosing: ["waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed", "canceled"],
  waiting_approval: ["diagnosing", "waiting_parts", "repairing", "ready_for_payment", "completed", "canceled"],
  waiting_parts: ["diagnosing", "repairing", "ready_for_payment", "completed", "canceled"],
  repairing: ["waiting_parts", "ready_for_payment", "completed", "canceled"],
  ready_for_payment: ["repairing", "completed", "canceled"],
  in_progress: ["diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed", "canceled"],
  completed: [],
  canceled: []
};

export const technicianUpcomingJobStatuses = ["scheduled", "dispatched"] as const;
export const technicianTravelJobStatuses = ["dispatched", "en_route"] as const;
export const technicianOnSiteJobStatuses = [
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "in_progress"
] as const;
export const technicianActiveFieldJobStatuses = [
  "dispatched",
  "en_route",
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "in_progress"
] as const;
export const technicianLiveJobStatuses = [
  "en_route",
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "in_progress"
] as const;

export function getAllowedNextJobStatuses(status: JobStatus): JobStatus[] {
  return allowedTransitions[status];
}

export function canTransitionJobStatus(fromStatus: JobStatus, toStatus: JobStatus): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  return allowedTransitions[fromStatus].includes(toStatus);
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return allowedTransitions[status].length === 0;
}

export function isTechnicianUpcomingJobStatus(status: JobStatus): boolean {
  return technicianUpcomingJobStatuses.includes(status as (typeof technicianUpcomingJobStatuses)[number]);
}

export function isTechnicianLiveJobStatus(status: JobStatus): boolean {
  return technicianLiveJobStatuses.includes(status as (typeof technicianLiveJobStatuses)[number]);
}

export function isTechnicianActiveFieldJobStatus(status: JobStatus): boolean {
  return technicianActiveFieldJobStatuses.includes(status as (typeof technicianActiveFieldJobStatuses)[number]);
}

export function isTechnicianTravelJobStatus(status: JobStatus): boolean {
  return technicianTravelJobStatuses.includes(status as (typeof technicianTravelJobStatuses)[number]);
}

export function isTechnicianOnSiteJobStatus(status: JobStatus): boolean {
  return technicianOnSiteJobStatuses.includes(status as (typeof technicianOnSiteJobStatuses)[number]);
}

export function getAllowedTechnicianNextJobStatuses(status: JobStatus): TechnicianAllowedStatus[] {
  switch (status) {
    case "scheduled":
    case "dispatched":
      return ["en_route"];
    case "en_route":
      return ["arrived"];
    case "arrived":
      return ["diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed"];
    case "diagnosing":
      return ["waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed"];
    case "waiting_approval":
      return ["diagnosing", "waiting_parts", "repairing", "ready_for_payment", "completed"];
    case "waiting_parts":
      return ["diagnosing", "repairing", "ready_for_payment", "completed"];
    case "repairing":
      return ["waiting_parts", "ready_for_payment", "completed"];
    case "ready_for_payment":
      return ["repairing", "completed"];
    case "in_progress":
      return ["diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "completed"];
    default:
      return [];
  }
}

export function canTechnicianTransitionJobStatus(
  fromStatus: JobStatus,
  toStatus: TechnicianAllowedStatus
): boolean {
  return getAllowedTechnicianNextJobStatuses(fromStatus).includes(toStatus);
}
