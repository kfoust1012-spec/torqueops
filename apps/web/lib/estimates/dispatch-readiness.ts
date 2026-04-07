import {
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus
} from "@mobile-mechanic/core";
import type { Job } from "@mobile-mechanic/types";

import type { VisitWorkflowState } from "../jobs/workflow";

export type EstimateDeskJobState = Pick<
  Job,
  "arrivalWindowStartAt" | "assignedTechnicianUserId" | "id" | "isActive" | "scheduledStartAt" | "status"
>;

export type EstimateBulkActionReadiness = {
  blockedReason: string | null;
  isReady: boolean;
};

export type EstimateDispatchUpdateType = "dispatched" | "en_route";

export type EstimateBulkDispatchUpdateReadiness = EstimateBulkActionReadiness & {
  updateType: EstimateDispatchUpdateType | null;
};

export type EstimateReleaseRunwayContext = {
  workflowState: VisitWorkflowState;
} | null;

export function getEstimateBulkOwnerReadiness(
  job: EstimateDeskJobState | null
): EstimateBulkActionReadiness {
  if (!job) {
    return {
      blockedReason: "Visit record is missing from the release runway.",
      isReady: false
    };
  }

  if (!job.isActive) {
    return {
      blockedReason: "Visit is archived and cannot be reassigned from this queue.",
      isReady: false
    };
  }

  if (job.status === "completed") {
    return {
      blockedReason: "Visit is already completed.",
      isReady: false
    };
  }

  if (job.status === "canceled") {
    return {
      blockedReason: "Visit is canceled.",
      isReady: false
    };
  }

  if (isTechnicianActiveFieldJobStatus(job.status)) {
    return {
      blockedReason: "Visit is already live in dispatch.",
      isReady: false
    };
  }

  return {
    blockedReason: null,
    isReady: true
  };
}

export function getEstimateBulkPromiseReadiness(
  job: EstimateDeskJobState | null
): EstimateBulkActionReadiness {
  if (!job) {
    return {
      blockedReason: "Visit record is missing from the release runway.",
      isReady: false
    };
  }

  if (!job.isActive) {
    return {
      blockedReason: "Visit is archived and cannot take a new promise from this queue.",
      isReady: false
    };
  }

  if (job.status === "completed") {
    return {
      blockedReason: "Visit is already completed.",
      isReady: false
    };
  }

  if (job.status === "canceled") {
    return {
      blockedReason: "Visit is canceled.",
      isReady: false
    };
  }

  if (isTechnicianActiveFieldJobStatus(job.status)) {
    return {
      blockedReason: "Visit is already live in dispatch.",
      isReady: false
    };
  }

  return {
    blockedReason: null,
    isReady: true
  };
}

export function getEstimateBulkReleaseReadiness(
  job: EstimateDeskJobState | null,
  releaseRunway: EstimateReleaseRunwayContext
): EstimateBulkActionReadiness {
  if (!job) {
    return {
      blockedReason: "Visit record is missing from the release runway.",
      isReady: false
    };
  }

  if (!job.isActive) {
    return {
      blockedReason: "Visit is archived and cannot be released into Dispatch.",
      isReady: false
    };
  }

  if (job.status === "scheduled") {
    return {
      blockedReason: "Visit is already on the dispatch board.",
      isReady: false
    };
  }

  if (isTechnicianActiveFieldJobStatus(job.status)) {
    return {
      blockedReason: "Visit is already live in dispatch.",
      isReady: false
    };
  }

  if (job.status === "completed") {
    return {
      blockedReason: "Visit is already completed.",
      isReady: false
    };
  }

  if (job.status === "canceled") {
    return {
      blockedReason: "Visit is canceled.",
      isReady: false
    };
  }

  if (job.status !== "new") {
    return {
      blockedReason: "Visit no longer belongs in the approved-release lane.",
      isReady: false
    };
  }

  if (!releaseRunway) {
    return {
      blockedReason: "Release runway context is unavailable for this visit.",
      isReady: false
    };
  }

  switch (releaseRunway.workflowState) {
    case "ready_to_dispatch":
      return {
        blockedReason: null,
        isReady: true
      };
    case "needs_assignment":
      return {
        blockedReason: "Assign a field owner before releasing this visit.",
        isReady: false
      };
    case "ready_to_schedule":
      return {
        blockedReason: "Set a promise window before releasing this visit.",
        isReady: false
      };
    case "intake":
      return {
        blockedReason: "Finish intake cleanup in Visits before releasing this visit.",
        isReady: false
      };
    case "live":
      return {
        blockedReason: "Visit is already live in dispatch.",
        isReady: false
      };
    case "completed":
    default:
      return {
        blockedReason: "Visit already needs closeout instead of dispatch release.",
        isReady: false
      };
  }
}

export function isEstimateApprovedReleaseAlreadyOnBoard(input: {
  job: EstimateDeskJobState | null;
}) {
  return input.job?.status === "scheduled" || Boolean(
    input.job && isTechnicianActiveFieldJobStatus(input.job.status)
  );
}

export function getEstimateBulkDispatchUpdateReadiness(
  job: EstimateDeskJobState | null
): EstimateBulkDispatchUpdateReadiness {
  if (!job) {
    return {
      blockedReason: "Visit details are unavailable for this follow-through action.",
      isReady: false,
      updateType: null
    };
  }

  if (!job.isActive) {
    return {
      blockedReason: "Archived visits cannot send new customer timing updates.",
      isReady: false,
      updateType: null
    };
  }

  if (!job.assignedTechnicianUserId) {
    return {
      blockedReason: "Assign a technician before sending a timing update.",
      isReady: false,
      updateType: null
    };
  }

  if (job.status === "scheduled") {
    return {
      blockedReason: null,
      isReady: true,
      updateType: "dispatched"
    };
  }

  if (isTechnicianActiveFieldJobStatus(job.status)) {
    return {
      blockedReason: null,
      isReady: true,
      updateType: "en_route"
    };
  }

  return {
    blockedReason: "This visit is no longer in a live dispatch state.",
    isReady: false,
    updateType: null
  };
}

export function getEstimateOnBoardStatusRiskRank(
  status: EstimateDeskJobState["status"] | null | undefined
) {
  if (status === "scheduled") {
    return 1;
  }

  if (status && isTechnicianOnSiteJobStatus(status)) {
    return 3;
  }

  if (status && isTechnicianActiveFieldJobStatus(status)) {
    return 2;
  }

  return 0;
}
