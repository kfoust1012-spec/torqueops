import { describe, expect, it } from "vitest";

import type {
  AssignableTechnicianOption,
  DispatchBoardJobItem,
  TechnicianAvailabilityBlock
} from "@mobile-mechanic/types";

import { buildDispatchBoardData } from "./dispatch";

const technicians: AssignableTechnicianOption[] = [
  {
    userId: "tech-1",
    displayName: "Alex Tech",
    email: "alex@example.com",
    role: "technician"
  },
  {
    userId: "tech-2",
    displayName: "Bailey Tech",
    email: "bailey@example.com",
    role: "technician"
  }
];

function createJob(overrides: Partial<DispatchBoardJobItem> & Pick<DispatchBoardJobItem, "id" | "title">): DispatchBoardJobItem {
  const { id, title, ...rest } = overrides;

  return {
    id,
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: "vehicle-1",
    title,
    status: "scheduled",
    priority: "normal",
    customerDisplayName: "Customer One",
    vehicleDisplayName: "2022 Ford Transit",
    assignedTechnicianUserId: null,
    assignedTechnicianName: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
    isActive: true,
    ...rest
  };
}

function createBlock(
  overrides: Partial<TechnicianAvailabilityBlock> & Pick<TechnicianAvailabilityBlock, "id" | "technicianUserId" | "title">
): TechnicianAvailabilityBlock {
  const { id, technicianUserId, title, ...rest } = overrides;

  return {
    id,
    companyId: "company-1",
    technicianUserId,
    blockType: "unavailable",
    title,
    startsAt: "2026-03-09T15:00:00.000Z",
    endsAt: "2026-03-09T16:00:00.000Z",
    isAllDay: false,
    notes: null,
    createdByUserId: "dispatcher-1",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...rest
  };
}

describe("buildDispatchBoardData", () => {
  it("groups jobs by technician, keeps unassigned sections, and ignores out-of-range scheduled work", () => {
    const data = buildDispatchBoardData({
      date: "2026-03-09",
      timezone: "UTC",
      range: {
        view: "day",
        rangeStartAt: "2026-03-09T00:00:00.000Z",
        rangeEndAt: "2026-03-10T00:00:00.000Z",
        visibleDays: [
          {
            date: "2026-03-09",
            label: "Mon, Mar 9",
            shortLabel: "Mon",
            startAt: "2026-03-09T00:00:00.000Z",
            endAt: "2026-03-10T00:00:00.000Z"
          }
        ]
      },
      technicians,
      jobs: [
        createJob({
          id: "job-2",
          title: "Later lane job",
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-09T14:00:00.000Z"
        }),
        createJob({
          id: "job-1",
          title: "Early lane job",
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-09T09:00:00.000Z"
        }),
        createJob({
          id: "job-3",
          title: "Lane backlog",
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech"
        }),
        createJob({
          id: "job-4",
          title: "Unassigned scheduled",
          scheduledStartAt: "2026-03-09T11:00:00.000Z"
        }),
        createJob({
          id: "job-5",
          title: "Unassigned backlog"
        }),
        createJob({
          id: "job-6",
          title: "Unknown tech scheduled",
          assignedTechnicianUserId: "tech-9",
          assignedTechnicianName: "Unknown Tech",
          scheduledStartAt: "2026-03-09T12:00:00.000Z"
        }),
        createJob({
          id: "job-7",
          title: "Out of range scheduled",
          assignedTechnicianUserId: "tech-2",
          assignedTechnicianName: "Bailey Tech",
          scheduledStartAt: "2026-03-11T12:00:00.000Z"
        })
      ],
      availabilityBlocks: [
        createBlock({ id: "block-2", technicianUserId: "tech-1", title: "Later block", startsAt: "2026-03-09T17:00:00.000Z" }),
        createBlock({ id: "block-1", technicianUserId: "tech-1", title: "Earlier block", startsAt: "2026-03-09T08:00:00.000Z" }),
        createBlock({ id: "block-3", technicianUserId: "tech-9", title: "Ignored block" })
      ],
      includeUnscheduled: true
    });

    expect(data.technicians).toHaveLength(2);
    expect(data.technicians[0]?.technicianUserId).toBe("tech-1");
    expect(data.technicians[0]?.jobs.map((job) => job.id)).toEqual(["job-1", "job-2"]);
    expect(data.technicians[0]?.unscheduledJobs.map((job) => job.id)).toEqual(["job-3"]);
    expect(data.technicians[0]?.availabilityBlocks.map((block) => block.id)).toEqual([
      "block-1",
      "block-2"
    ]);
    expect(data.technicians[1]?.jobs).toHaveLength(0);
    expect(data.unassignedJobs.map((job) => job.id)).toEqual(["job-4", "job-6"]);
    expect(data.unscheduledUnassignedJobs.map((job) => job.id)).toEqual(["job-5"]);
  });

  it("omits unscheduled jobs when includeUnscheduled is false", () => {
    const data = buildDispatchBoardData({
      date: "2026-03-09",
      timezone: "UTC",
      range: {
        view: "day",
        rangeStartAt: "2026-03-09T00:00:00.000Z",
        rangeEndAt: "2026-03-10T00:00:00.000Z",
        visibleDays: [
          {
            date: "2026-03-09",
            label: "Mon, Mar 9",
            shortLabel: "Mon",
            startAt: "2026-03-09T00:00:00.000Z",
            endAt: "2026-03-10T00:00:00.000Z"
          }
        ]
      },
      technicians,
      jobs: [
        createJob({ id: "job-1", title: "Lane backlog", assignedTechnicianUserId: "tech-1", assignedTechnicianName: "Alex Tech" }),
        createJob({ id: "job-2", title: "Unassigned backlog" })
      ],
      availabilityBlocks: [],
      includeUnscheduled: false
    });

    expect(data.technicians[0]?.unscheduledJobs).toHaveLength(0);
    expect(data.unscheduledUnassignedJobs).toHaveLength(0);
  });

  it("does not keep jobs in range when they end exactly at the range start", () => {
    const data = buildDispatchBoardData({
      date: "2026-03-10",
      timezone: "UTC",
      range: {
        view: "day",
        rangeStartAt: "2026-03-10T00:00:00.000Z",
        rangeEndAt: "2026-03-11T00:00:00.000Z",
        visibleDays: [
          {
            date: "2026-03-10",
            label: "Tue, Mar 10",
            shortLabel: "Tue",
            startAt: "2026-03-10T00:00:00.000Z",
            endAt: "2026-03-11T00:00:00.000Z"
          }
        ]
      },
      technicians,
      jobs: [
        createJob({
          id: "job-boundary",
          title: "Boundary job",
          assignedTechnicianUserId: "tech-1",
          assignedTechnicianName: "Alex Tech",
          scheduledStartAt: "2026-03-09T23:00:00.000Z",
          scheduledEndAt: "2026-03-10T00:00:00.000Z"
        })
      ],
      availabilityBlocks: [],
      includeUnscheduled: true
    });

    expect(data.technicians[0]?.jobs).toHaveLength(0);
    expect(data.unassignedJobs).toHaveLength(0);
  });
});