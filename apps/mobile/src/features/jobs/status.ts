import { getAllowedTechnicianNextJobStatuses } from "@mobile-mechanic/core";
import type { JobStatus, TechnicianAllowedStatus } from "@mobile-mechanic/types";

export function getTechnicianStatusActions(status: JobStatus): TechnicianAllowedStatus[] {
  return getAllowedTechnicianNextJobStatuses(status);
}

export function getTechnicianStatusActionLabel(status: TechnicianAllowedStatus): string {
  switch (status) {
    case "en_route":
      return "Mark en route";
    case "arrived":
      return "Mark arrived";
    case "diagnosing":
      return "Start diagnosis";
    case "waiting_approval":
      return "Mark waiting approval";
    case "waiting_parts":
      return "Mark waiting on parts";
    case "repairing":
      return "Start repair";
    case "ready_for_payment":
      return "Mark ready for payment";
    case "completed":
      return "Complete stop";
    default:
      return status;
  }
}
