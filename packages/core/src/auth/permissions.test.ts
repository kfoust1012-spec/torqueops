import { describe, expect, it } from "vitest";

import {
  canAccessMobileApp,
  canAccessTechnicianWorkflow,
  isMobileAppRole,
  isTechnicianWorkflowRole,
  MOBILE_APP_ROLES,
  TECHNICIAN_WORKFLOW_ROLES
} from "../index";

describe("auth role semantics", () => {
  it("keeps mobile app access open to the same roles that can run the field workflow", () => {
    expect(MOBILE_APP_ROLES.has("owner")).toBe(true);
    expect(MOBILE_APP_ROLES.has("admin")).toBe(true);
    expect(MOBILE_APP_ROLES.has("technician")).toBe(true);

    expect(canAccessMobileApp("owner")).toBe(true);
    expect(canAccessMobileApp("admin")).toBe(true);
    expect(canAccessMobileApp("technician")).toBe(true);

    expect(canAccessTechnicianWorkflow("owner")).toBe(true);
    expect(canAccessTechnicianWorkflow("admin")).toBe(true);
    expect(canAccessTechnicianWorkflow("technician")).toBe(true);
  });

  it("allows owner and admin memberships to run technician workflows when they are assigned in the field", () => {
    expect(isTechnicianWorkflowRole("technician")).toBe(true);
    expect(isTechnicianWorkflowRole("owner")).toBe(true);
    expect(isTechnicianWorkflowRole("admin")).toBe(true);

    expect(canAccessTechnicianWorkflow("technician")).toBe(true);
    expect(canAccessTechnicianWorkflow("owner")).toBe(true);
    expect(canAccessTechnicianWorkflow("admin")).toBe(true);

    expect(TECHNICIAN_WORKFLOW_ROLES.has("technician")).toBe(true);
    expect(TECHNICIAN_WORKFLOW_ROLES.has("owner")).toBe(true);
    expect(TECHNICIAN_WORKFLOW_ROLES.has("admin")).toBe(true);
    expect(isMobileAppRole("owner")).toBe(true);
  });
});
