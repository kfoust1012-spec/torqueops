import type { AppRole } from "@mobile-mechanic/types";

export const ADMIN_ROLES: ReadonlySet<AppRole> = new Set(["owner", "admin"]);
export const OFFICE_ROLES: ReadonlySet<AppRole> = new Set(["owner", "admin", "dispatcher"]);
export const MOBILE_APP_ROLES: ReadonlySet<AppRole> = new Set(["owner", "admin", "technician"]);
export const TECHNICIAN_WORKFLOW_ROLES: ReadonlySet<AppRole> = new Set(["owner", "admin", "technician"]);

export function isAdminRole(role: AppRole): boolean {
  return ADMIN_ROLES.has(role);
}

export function isOfficeRole(role: AppRole): boolean {
  return OFFICE_ROLES.has(role);
}

export function isTechnicianWorkflowRole(role: AppRole): boolean {
  return TECHNICIAN_WORKFLOW_ROLES.has(role);
}

export function isMobileAppRole(role: AppRole): boolean {
  return MOBILE_APP_ROLES.has(role);
}
