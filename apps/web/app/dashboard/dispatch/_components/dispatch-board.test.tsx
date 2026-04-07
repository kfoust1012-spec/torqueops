import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  AssignableTechnicianOption,
  DispatchBoardData,
  DispatchBoardJobItem,
  TechnicianAvailabilityBlock
} from "@mobile-mechanic/types";

import { DispatchBoard } from "./dispatch-board";

function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

vi.mock("@mobile-mechanic/core", () => ({
  formatDesignLabel: (value: string | null | undefined) =>
    value
      ? value
          .split("_")
          .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
          .join(" ")
      : "",
  formatDesignStatusLabel: (value: string | null | undefined) =>
    value
      ? value
          .split("_")
          .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
          .join(" ")
      : "",
  formatDispatchDateTime: (value: string | null | undefined) => value ?? "Not scheduled",
  getDispatchLocalDate: (value: string | Date) => {
    const date = typeof value === "string" ? value : value.toISOString();
    return date.slice(0, 10);
  },
  resolveDesignPriorityTone: () => "warning",
  resolveDesignReminderStageTone: () => "info",
  resolveDesignSeverityTone: () => "warning",
  resolveDesignStatusTone: () => "info",
  toDispatchDateTimeInput: (value: string | null | undefined) => {
    if (!value) {
      return "";
    }

    return value.slice(0, 16);
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

const noopAction = async (_formData: FormData) => {};

const technicians: AssignableTechnicianOption[] = [
  {
    userId: "tech-1",
    displayName: "Alex Tech",
    email: "alex@example.com",
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
    customerDisplayName: "Taylor Driver",
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

function createBlock(overrides: Partial<TechnicianAvailabilityBlock> = {}): TechnicianAvailabilityBlock {
  return {
    id: "block-1",
    companyId: "company-1",
    technicianUserId: "tech-1",
    blockType: "training",
    title: "Shop training",
    startsAt: "2026-03-09T15:00:00.000Z",
    endsAt: "2026-03-09T16:00:00.000Z",
    isAllDay: false,
    notes: "Monthly safety review",
    createdByUserId: "dispatcher-1",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides
  };
}

function createBoard(overrides: Partial<DispatchBoardData> = {}): DispatchBoardData {
  return {
    view: "week",
    date: "2026-03-09",
    timezone: "UTC",
    rangeStartAt: "2026-03-09T00:00:00.000Z",
    rangeEndAt: "2026-03-16T00:00:00.000Z",
    visibleDays: [
      {
        date: "2026-03-09",
        label: "Mon, Mar 9",
        shortLabel: "Mon",
        startAt: "2026-03-09T00:00:00.000Z",
        endAt: "2026-03-10T00:00:00.000Z"
      },
      {
        date: "2026-03-10",
        label: "Tue, Mar 10",
        shortLabel: "Tue",
        startAt: "2026-03-10T00:00:00.000Z",
        endAt: "2026-03-11T00:00:00.000Z"
      }
    ],
    technicians: [
      {
        technicianUserId: "tech-1",
        displayName: "Alex Tech",
        email: "alex@example.com",
        role: "technician",
        jobs: [
          createJob({
            id: "job-1",
            title: "Lane scheduled job",
            assignedTechnicianUserId: "tech-1",
            assignedTechnicianName: "Alex Tech",
            scheduledStartAt: "2026-03-09T09:00:00.000Z",
            scheduledEndAt: "2026-03-09T10:00:00.000Z"
          })
        ],
        unscheduledJobs: [
          createJob({
            id: "job-2",
            title: "Lane backlog",
            assignedTechnicianUserId: "tech-1",
            assignedTechnicianName: "Alex Tech"
          })
        ],
        availabilityBlocks: [createBlock()]
      }
    ],
    unassignedJobs: [
      createJob({
        id: "job-3",
        title: "Unassigned scheduled",
        scheduledStartAt: "2026-03-09T11:00:00.000Z",
        scheduledEndAt: "2026-03-09T12:00:00.000Z"
      })
    ],
    unscheduledUnassignedJobs: [createJob({ id: "job-4", title: "Unassigned backlog" })],
    ...overrides
  };
}

describe("DispatchBoard", () => {
  it("renders technician lanes, week headings, unassigned sections, and availability blocks", () => {
    const html = renderToStaticMarkup(
      <DispatchBoard
        assignAction={noopAction}
        board={createBoard()}
        createAvailabilityBlockAction={noopAction}
        deleteAvailabilityBlockAction={noopAction}
        rescheduleAction={noopAction}
        returnTo="/dashboard/dispatch?view=week"
        sendAppointmentConfirmationAction={noopAction}
        sendDispatchUpdateAction={noopAction}
        technicians={technicians}
      />
    );

    expect(html).toContain("Ready to assign");
    expect(html).toContain("Unscheduled jobs");
    expect(html).toContain("Unassigned scheduled");
    expect(html).toContain("Unassigned backlog");
    expect(html).toContain("Alex Tech");
    expect(html).toContain("technician · 1 scheduled · 1 unscheduled · 1 today");
    expect(html).toContain("Mon, Mar 9");
    expect(html).toContain("Tue, Mar 10");
    expect(html).toContain("Shop training");
    expect(html).toContain("Monthly safety review");
    expect(html).toContain("Remove block");
    expect(html).toContain("Add availability block");
    expect(html).toContain("Lane scheduled job");
    expect(html).toContain("Lane backlog");
  });

  it("renders the no-technicians empty state", () => {
    const html = renderToStaticMarkup(
      <DispatchBoard
        assignAction={noopAction}
        board={createBoard({ technicians: [], unassignedJobs: [], unscheduledUnassignedJobs: [] })}
        createAvailabilityBlockAction={noopAction}
        deleteAvailabilityBlockAction={noopAction}
        rescheduleAction={noopAction}
        returnTo="/dashboard/dispatch"
        sendAppointmentConfirmationAction={noopAction}
        sendDispatchUpdateAction={noopAction}
        technicians={[]}
      />
    );

    expect(html).toContain("No assignable technicians available");
    expect(html).toContain("No unscheduled backlog.");
  });

  it("does not duplicate jobs or blocks into the next day when they end at midnight", () => {
    const html = renderToStaticMarkup(
      <DispatchBoard
        assignAction={noopAction}
        board={createBoard({
          technicians: [
            {
              technicianUserId: "tech-1",
              displayName: "Alex Tech",
              email: "alex@example.com",
              role: "technician",
              jobs: [
                createJob({
                  id: "job-boundary",
                  title: "Boundary scheduled job",
                  assignedTechnicianUserId: "tech-1",
                  assignedTechnicianName: "Alex Tech",
                  scheduledStartAt: "2026-03-09T23:00:00.000Z",
                  scheduledEndAt: "2026-03-10T00:00:00.000Z"
                })
              ],
              unscheduledJobs: [],
              availabilityBlocks: [
                createBlock({
                  title: "Boundary block",
                  startsAt: "2026-03-09T22:00:00.000Z",
                  endsAt: "2026-03-10T00:00:00.000Z"
                })
              ]
            }
          ],
          unassignedJobs: [],
          unscheduledUnassignedJobs: []
        })}
        createAvailabilityBlockAction={noopAction}
        deleteAvailabilityBlockAction={noopAction}
        rescheduleAction={noopAction}
        returnTo="/dashboard/dispatch?view=week"
        sendAppointmentConfirmationAction={noopAction}
        sendDispatchUpdateAction={noopAction}
        technicians={technicians}
      />
    );

    expect(countOccurrences(html, "Boundary scheduled job")).toBe(1);
    expect(countOccurrences(html, "Boundary block")).toBe(1);
  });
});
