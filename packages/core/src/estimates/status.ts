import type { EstimateStatus } from "@mobile-mechanic/types";

const allowedTransitions: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["sent", "void"],
  sent: ["accepted", "declined", "void"],
  accepted: [],
  declined: [],
  void: []
};

const manualAllowedTransitions: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["sent", "void"],
  sent: ["declined", "void"],
  accepted: [],
  declined: [],
  void: []
};

export function getAllowedNextEstimateStatuses(status: EstimateStatus): EstimateStatus[] {
  return manualAllowedTransitions[status];
}

export function canTransitionEstimateStatus(
  fromStatus: EstimateStatus,
  toStatus: EstimateStatus
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  return allowedTransitions[fromStatus].includes(toStatus);
}

export function isTerminalEstimateStatus(status: EstimateStatus): boolean {
  return allowedTransitions[status].length === 0;
}
