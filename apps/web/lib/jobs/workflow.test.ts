import { describe, expect, it, vi } from "vitest";

import type { DispatchBoardJobItem, JobListItem } from "@mobile-mechanic/types";

vi.mock("@mobile-mechanic/core", () => ({
  canTransitionJobStatus: () => true,
  isTechnicianActiveFieldJobStatus: (status: string) =>
    ["dispatched", "en_route", "arrived", "diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "in_progress"].includes(status),
  isTechnicianOnSiteJobStatus: (status: string) =>
    ["arrived", "diagnosing", "waiting_approval", "waiting_parts", "repairing", "ready_for_payment", "in_progress"].includes(status),
  isTechnicianTravelJobStatus: (status: string) => ["dispatched", "en_route"].includes(status)
}));

import {
  getDispatchQueueState,
  getVisitNextMove,
  getVisitPrimaryAction,
  getVisitWorkflowState
} from "./workflow";

function createJob(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: "job-1",
    isActive: true,
    priority: "normal",
    scheduledStartAt: null,
    status: "new",
    title: "Brake inspection",
    arrivalWindowStartAt: null,
    assignedTechnicianUserId: null,
    assignedTechnicianName: null,
    customerDisplayName: "Taylor Driver",
    customerEmail: "taylor@example.com",
    customerPhone: "555-0100",
    vehicleDisplayName: "2022 Ford Transit",
    ...overrides
  };
}

function createDispatchJob(overrides: Partial<DispatchBoardJobItem> = {}): DispatchBoardJobItem {
  return {
    id: "job-1",
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: "vehicle-1",
    title: "Brake inspection",
    status: "new",
    priority: "normal",
    customerDisplayName: "Taylor Driver",
    vehicleDisplayName: "2022 Ford Transit",
    assignedTechnicianUserId: null,
    assignedTechnicianName: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
    isActive: true,
    ...overrides
  };
}

describe("job workflow", () => {
  it("treats unscheduled unassigned work as intake", () => {
    const job = createJob();

    expect(getVisitWorkflowState(job)).toBe("intake");
    expect(getVisitNextMove(job)).toBe("Finish intake");
    expect(getVisitPrimaryAction(job)).toEqual({
      intent: "edit",
      label: "Finish intake"
    });
  });

  it("treats scheduled unassigned work as needing assignment", () => {
    const job = createDispatchJob({
      scheduledStartAt: "2026-03-13T15:00:00.000Z"
    });

    expect(getVisitWorkflowState(job)).toBe("needs_assignment");
    expect(getVisitNextMove(job)).toBe("Assign technician");
    expect(getDispatchQueueState(job)).toBe("ready_now");
  });

  it("treats assigned unscheduled work as ready to schedule", () => {
    const job = createDispatchJob({
      assignedTechnicianUserId: "tech-1",
      assignedTechnicianName: "Alex Tech"
    });

    expect(getVisitWorkflowState(job)).toBe("ready_to_schedule");
    expect(getVisitNextMove(job)).toBe("Set schedule window");
    expect(getVisitPrimaryAction(job)).toEqual({
      intent: "edit",
      label: "Schedule visit"
    });
    expect(getDispatchQueueState(job)).toBe("needs_slot");
  });

  it("treats assigned scheduled work as ready to dispatch", () => {
    const job = createDispatchJob({
      assignedTechnicianUserId: "tech-1",
      assignedTechnicianName: "Alex Tech",
      scheduledStartAt: "2026-03-13T15:00:00.000Z"
    });

    expect(getVisitWorkflowState(job)).toBe("ready_to_dispatch");
    expect(getVisitNextMove(job)).toBe("Push to dispatch");
    expect(getVisitPrimaryAction(job)).toEqual({
      intent: "dispatch",
      label: "Open dispatch"
    });
  });

  it("treats technician travel and field statuses as live", () => {
    expect(
      getVisitWorkflowState(
        createDispatchJob({
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-13T15:00:00.000Z",
          status: "dispatched"
        })
      )
    ).toBe("live");

    expect(
      getVisitWorkflowState(
        createDispatchJob({
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-13T15:00:00.000Z",
          status: "waiting_parts"
        })
      )
    ).toBe("live");

    expect(
      getVisitNextMove(
        createDispatchJob({
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-13T15:00:00.000Z",
          status: "in_progress"
        })
      )
    ).toBe("Monitor live work");
  });

  it("surfaces live-work next moves for approval and parts blockers", () => {
    expect(
      getVisitNextMove(
        createDispatchJob({
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-13T15:00:00.000Z",
          status: "waiting_approval"
        })
      )
    ).toBe("Push estimate approval");

    expect(
      getVisitNextMove(
        createDispatchJob({
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-13T15:00:00.000Z",
          status: "waiting_parts"
        })
      )
    ).toBe("Clear parts blocker");
  });

  it("treats inactive and terminal work as completed", () => {
    expect(
      getVisitWorkflowState(
        createJob({
          isActive: false,
          status: "new"
        })
      )
    ).toBe("completed");

    expect(
      getVisitWorkflowState(
        createJob({
          status: "completed"
        })
      )
    ).toBe("completed");
  });
});
