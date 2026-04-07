import {
  canAccessTechnicianWorkflow,
  canEditCustomerRecords,
  canEditJobRecords
} from "@mobile-mechanic/core";
import type { AppRole } from "@mobile-mechanic/types";

export function canCreateJobsFromMobile(role: AppRole) {
  return canEditCustomerRecords(role) && canEditJobRecords(role);
}

export function canRunFieldWorkflowFromMobile(role: AppRole) {
  return canAccessTechnicianWorkflow(role);
}
