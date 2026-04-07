import {
  canTransitionJobStatus,
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { DispatchBoardJobItem, JobStatus, JobListItem } from "@mobile-mechanic/types";
import type { BadgeTone } from "../../components/ui";

export const visitWorkflowStates = [
  "intake",
  "needs_assignment",
  "ready_to_schedule",
  "ready_to_dispatch",
  "live",
  "completed"
] as const;

export type VisitWorkflowState = (typeof visitWorkflowStates)[number];
export const jobWorkflowStates = visitWorkflowStates;
export type JobWorkflowState = VisitWorkflowState;

export function isVisitWorkflowState(value: string): value is VisitWorkflowState {
  return visitWorkflowStates.includes(value as VisitWorkflowState);
}

export const dispatchQueueStates = ["ready_now", "needs_slot", "intake_waiting"] as const;

export type DispatchQueueState = (typeof dispatchQueueStates)[number];

type WorkflowJob = Pick<
  JobListItem,
  "isActive" | "scheduledStartAt" | "status"
> & {
  arrivalWindowStartAt?: string | null;
  assignedTechnicianName?: string | null;
  assignedTechnicianUserId?: string | null;
};

export type VisitWorkflowMovePlan = {
  assignedTechnicianUserId?: string | null;
  clearSchedule?: boolean;
  toStatus?: JobStatus;
};

export type VisitWorkflowMoveAssessment =
  | {
      allowed: true;
      plan: VisitWorkflowMovePlan;
    }
  | {
      allowed: false;
      message: string;
    };

export type JobWorkflowMovePlan = VisitWorkflowMovePlan;
export type JobWorkflowMoveAssessment = VisitWorkflowMoveAssessment;

function hasTechnician(visit: WorkflowJob) {
  return Boolean(visit.assignedTechnicianUserId ?? visit.assignedTechnicianName);
}

function hasScheduleIntent(visit: WorkflowJob) {
  return Boolean(visit.scheduledStartAt || visit.arrivalWindowStartAt);
}

function buildWorkflowMoveError(message: string): JobWorkflowMoveAssessment {
  return {
    allowed: false,
    message
  };
}

function buildWorkflowMovePlan(plan: VisitWorkflowMovePlan): VisitWorkflowMoveAssessment {
  return {
    allowed: true,
    plan
  };
}

function getStatusTransitionError(visit: WorkflowJob, toStatus: JobStatus) {
  return canTransitionJobStatus(visit.status, toStatus)
    ? null
    : `This visit cannot move from ${visit.status.replaceAll("_", " ")} to ${toStatus.replaceAll("_", " ")} from the board.`;
}

export function getVisitWorkflowState(visit: WorkflowJob): VisitWorkflowState {
  if (!visit.isActive || visit.status === "completed" || visit.status === "canceled") {
    return "completed";
  }

  if (isTechnicianActiveFieldJobStatus(visit.status)) {
    return "live";
  }

  if (hasScheduleIntent(visit) && hasTechnician(visit)) {
    return "ready_to_dispatch";
  }

  if (hasScheduleIntent(visit) && !hasTechnician(visit)) {
    return "needs_assignment";
  }

  if (!hasScheduleIntent(visit) && hasTechnician(visit)) {
    return "ready_to_schedule";
  }

  return "intake";
}

export function getVisitWorkflowLabel(state: VisitWorkflowState) {
  switch (state) {
    case "intake":
      return "Blocked / intake";
    case "needs_assignment":
      return "Needs assignment";
    case "ready_to_schedule":
      return "Ready to schedule";
    case "ready_to_dispatch":
      return "Ready for dispatch";
    case "live":
      return "Live";
    case "completed":
      return "Completed";
    default:
      return "Queue";
  }
}

export function getVisitWorkflowTone(state: VisitWorkflowState): BadgeTone {
  switch (state) {
    case "intake":
      return "neutral";
    case "needs_assignment":
      return "warning";
    case "ready_to_schedule":
      return "brand";
    case "ready_to_dispatch":
      return "info";
    case "live":
      return "progress";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

export function getVisitNextMove(visit: WorkflowJob) {
  const workflowState = getVisitWorkflowState(visit);

  if (workflowState === "completed") {
    return visit.status === "canceled" ? "Review closure" : "Review completed work";
  }

  if (workflowState === "live") {
    if (isTechnicianTravelJobStatus(visit.status)) {
      return "Track arrival";
    }

    if (visit.status === "waiting_approval") {
      return "Push estimate approval";
    }

    if (visit.status === "waiting_parts") {
      return "Clear parts blocker";
    }

    if (visit.status === "ready_for_payment") {
      return "Collect payment";
    }

    return "Monitor live work";
  }

  if (workflowState === "ready_to_dispatch") {
    return "Push to dispatch";
  }

  if (workflowState === "ready_to_schedule") {
    return "Set schedule window";
  }

  if (workflowState === "needs_assignment") {
    return "Assign technician";
  }

  return "Finish intake";
}

export function getVisitPrimaryAction(visit: WorkflowJob): {
  intent: "dispatch" | "edit" | "open";
  label: string;
} {
  const workflowState = getVisitWorkflowState(visit);

  if (workflowState === "completed") {
    return { intent: "open", label: "Review visit" };
  }

  if (workflowState === "live") {
    return { intent: "dispatch", label: "Track live work" };
  }

  if (workflowState === "ready_to_dispatch") {
    return { intent: "dispatch", label: "Open dispatch" };
  }

  if (workflowState === "ready_to_schedule") {
    return { intent: "edit", label: "Schedule visit" };
  }

  if (workflowState === "needs_assignment") {
    return { intent: "edit", label: "Assign technician" };
  }

  return { intent: "edit", label: "Finish intake" };
}

export function assessVisitWorkflowMove(
  visit: WorkflowJob,
  targetState: VisitWorkflowState
): VisitWorkflowMoveAssessment {
  const currentState = getVisitWorkflowState(visit);

  if (currentState === targetState) {
    return buildWorkflowMoveError(`This visit is already in ${getVisitWorkflowLabel(targetState)}.`);
  }

  if (!visit.isActive || visit.status === "completed" || visit.status === "canceled") {
    return buildWorkflowMoveError("Completed or canceled visits cannot move to another workboard lane.");
  }

  if (targetState === "completed") {
    if (!isTechnicianOnSiteJobStatus(visit.status) || !canTransitionJobStatus(visit.status, "completed")) {
      return buildWorkflowMoveError("Only active on-site visits can move into Complete from the board.");
    }

    return buildWorkflowMovePlan({ toStatus: "completed" });
  }

  if (targetState === "live") {
    if (!hasTechnician(visit)) {
      return buildWorkflowMoveError("Assign a technician before moving this visit into Live.");
    }

    if (!hasScheduleIntent(visit)) {
      return buildWorkflowMoveError("Set an arrival target before moving this visit into Live.");
    }

    if (isTechnicianActiveFieldJobStatus(visit.status)) {
      return buildWorkflowMovePlan({});
    }

    const transitionError = getStatusTransitionError(visit, "dispatched");

    if (transitionError) {
      return buildWorkflowMoveError(transitionError);
    }

    return buildWorkflowMovePlan({ toStatus: "dispatched" });
  }

  if (isTechnicianOnSiteJobStatus(visit.status)) {
    return buildWorkflowMoveError("On-site visits must be completed from the board or adjusted from the full visit record.");
  }

  if (targetState === "ready_to_dispatch") {
    if (!hasTechnician(visit)) {
      return buildWorkflowMoveError("Assign a technician before staging this visit for dispatch.");
    }

    if (!hasScheduleIntent(visit)) {
      return buildWorkflowMoveError("Set a schedule target before staging this visit for dispatch.");
    }

    if (isTechnicianTravelJobStatus(visit.status)) {
      const transitionError = getStatusTransitionError(visit, "scheduled");

      if (transitionError) {
        return buildWorkflowMoveError(transitionError);
      }

      return buildWorkflowMovePlan({ toStatus: "scheduled" });
    }

    if (visit.status === "new") {
      const transitionError = getStatusTransitionError(visit, "scheduled");

      if (transitionError) {
        return buildWorkflowMoveError(transitionError);
      }

      return buildWorkflowMovePlan({ toStatus: "scheduled" });
    }

    return buildWorkflowMovePlan({});
  }

  if (targetState === "ready_to_schedule") {
    if (!hasTechnician(visit)) {
      return buildWorkflowMoveError("Assign a technician before moving this visit into Ready to schedule.");
    }

    if (isTechnicianTravelJobStatus(visit.status)) {
      const transitionError = getStatusTransitionError(visit, "scheduled");

      if (transitionError) {
        return buildWorkflowMoveError(transitionError);
      }

      return buildWorkflowMovePlan({
        clearSchedule: true,
        toStatus: "scheduled"
      });
    }

    return buildWorkflowMovePlan({ clearSchedule: true });
  }

  if (targetState === "needs_assignment") {
    if (!hasScheduleIntent(visit)) {
      return buildWorkflowMoveError("Set a schedule target before moving this visit into Needs assignment.");
    }

    if (isTechnicianTravelJobStatus(visit.status)) {
      const transitionError = getStatusTransitionError(visit, "scheduled");

      if (transitionError) {
        return buildWorkflowMoveError(transitionError);
      }

      return buildWorkflowMovePlan({
        assignedTechnicianUserId: null,
        toStatus: "scheduled"
      });
    }

    return buildWorkflowMovePlan({ assignedTechnicianUserId: null });
  }

  if (targetState === "intake") {
    if (isTechnicianTravelJobStatus(visit.status)) {
      const transitionError = getStatusTransitionError(visit, "scheduled");

      if (transitionError) {
        return buildWorkflowMoveError(transitionError);
      }

      return buildWorkflowMovePlan({
        assignedTechnicianUserId: null,
        clearSchedule: true,
        toStatus: "scheduled"
      });
    }

    return buildWorkflowMovePlan({
      assignedTechnicianUserId: null,
      clearSchedule: true
    });
  }

  return buildWorkflowMoveError("That lane move is not supported from the board.");
}

export function getDispatchQueueState(visit: DispatchBoardJobItem): DispatchQueueState {
  const workflowState = getVisitWorkflowState(visit);

  if (workflowState === "needs_assignment") {
    return "ready_now";
  }

  if (workflowState === "ready_to_schedule") {
    return "needs_slot";
  }

  return "intake_waiting";
}

export function getDispatchQueueLabel(state: DispatchQueueState) {
  switch (state) {
    case "ready_now":
      return "Ready now";
    case "needs_slot":
      return "Needs slot";
    case "intake_waiting":
      return "Intake waiting";
    default:
      return "Queue";
  }
}

export function countVisitsByWorkflowState(jobs: WorkflowJob[], state: VisitWorkflowState) {
  return jobs.filter((visit) => getVisitWorkflowState(visit) === state).length;
}

export function countJobsByStatus(jobs: Array<Pick<WorkflowJob, "status">>, status: JobStatus) {
  return jobs.filter((visit) => visit.status === status).length;
}

export const isJobWorkflowState = isVisitWorkflowState;
export const getJobWorkflowState = getVisitWorkflowState;
export const getJobWorkflowLabel = getVisitWorkflowLabel;
export const getJobWorkflowTone = getVisitWorkflowTone;
export const getJobNextMove = getVisitNextMove;
export const getJobPrimaryAction = getVisitPrimaryAction;
export const assessJobWorkflowMove = assessVisitWorkflowMove;
export const countJobsByWorkflowState = countVisitsByWorkflowState;
