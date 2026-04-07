import type { AppRole } from "@mobile-mechanic/types";

import { isAdminRole, isMobileAppRole, isOfficeRole, isTechnicianWorkflowRole } from "./roles";

export function canManageCompany(role: AppRole): boolean {
  return isAdminRole(role);
}

export function canManageCompanyMembers(role: AppRole): boolean {
  return isAdminRole(role);
}

export function canAccessOfficeApp(role: AppRole): boolean {
  return isOfficeRole(role);
}

export function canAccessMobileApp(role: AppRole): boolean {
  return isMobileAppRole(role);
}

export function canAccessTechnicianWorkflow(role: AppRole): boolean {
  return isTechnicianWorkflowRole(role);
}

export function canEditCustomerRecords(role: AppRole): boolean {
  return isOfficeRole(role);
}

export function canEditJobRecords(role: AppRole): boolean {
  return isOfficeRole(role);
}
