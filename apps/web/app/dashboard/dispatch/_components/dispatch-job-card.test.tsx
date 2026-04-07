import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AssignableTechnicianOption, DispatchBoardJobItem } from "@mobile-mechanic/types";

import { DispatchJobCard } from "./dispatch-job-card";

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

const noopAction = async (_formData: FormData) => {};

function createJob(overrides: Partial<DispatchBoardJobItem> = {}): DispatchBoardJobItem {
  return {
    id: "job-1",
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: "vehicle-1",
    title: "Brake inspection",
    status: "scheduled",
    priority: "urgent",
    customerDisplayName: "Taylor Driver",
    vehicleDisplayName: "2022 Ford Transit",
    assignedTechnicianUserId: "tech-1",
    assignedTechnicianName: "Alex Tech",
    scheduledStartAt: "2026-03-09T13:00:00.000Z",
    scheduledEndAt: "2026-03-09T14:30:00.000Z",
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
    isActive: true,
    ...overrides
  };
}

describe("DispatchJobCard", () => {
  it("renders status, schedule, assignment controls, and visit link", () => {
    const html = renderToStaticMarkup(
      <DispatchJobCard
        assignAction={noopAction}
        job={createJob()}
        rescheduleAction={noopAction}
        returnTo="/dashboard/dispatch?view=day"
        sendAppointmentConfirmationAction={noopAction}
        sendDispatchUpdateAction={noopAction}
        technicians={technicians}
        timeZone="UTC"
      />
    );

    expect(html).toContain("Brake inspection");
    expect(html).toContain("Taylor Driver · 2022 Ford Transit");
    expect(html).toContain("Scheduled");
    expect(html).toContain("Urgent");
    expect(html).toContain("Alex Tech");
    expect(html).toContain('name="jobId"');
    expect(html).toContain('value="job-1"');
    expect(html).toContain('value="/dashboard/dispatch?view=day"');
    expect(html).toContain('href="/dashboard/visits?jobId=job-1"');
    expect(html).toContain("Assign");
    expect(html).toContain("Reschedule");
  });

  it("renders unscheduled and unassigned fallback labels", () => {
    const html = renderToStaticMarkup(
      <DispatchJobCard
        assignAction={noopAction}
        job={createJob({
          assignedTechnicianUserId: null,
          assignedTechnicianName: null,
          scheduledStartAt: null,
          scheduledEndAt: null,
          status: "new"
        })}
        rescheduleAction={noopAction}
        returnTo="/dashboard/dispatch"
        sendAppointmentConfirmationAction={noopAction}
        sendDispatchUpdateAction={noopAction}
        technicians={technicians}
        timeZone="UTC"
      />
    );

    expect(html).toContain("Unscheduled");
    expect(html).toContain("Unassigned");
    expect(html).toContain("New");
  });
});
