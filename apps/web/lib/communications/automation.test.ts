import { describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";

vi.mock("@mobile-mechanic/core", () => ({
  isTechnicianTravelJobStatus: (status: string) => ["dispatched", "en_route"].includes(status)
}));

const {
  resolveAutomatedPaymentReminderStage,
  shouldQueueEnRouteAutomation,
  shouldQueueRunningLateAutomation
} = await import("./automation");

describe("communication automations", () => {
  it("queues en-route automation when a dispatched visit is within the lead window", () => {
    expect(
      shouldQueueEnRouteAutomation(
        {
          id: "job-1",
          company_id: "company-1",
          status: "dispatched",
          scheduled_start_at: "2026-03-23T15:15:00.000Z",
          arrival_window_start_at: null,
          assigned_technician_user_id: "tech-1"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe(true);
  });

  it("queues en-route automation when an en-route visit is still inside the lead window", () => {
    expect(
      shouldQueueEnRouteAutomation(
        {
          id: "job-2",
          company_id: "company-1",
          status: "en_route",
          scheduled_start_at: "2026-03-23T15:15:00.000Z",
          arrival_window_start_at: null,
          assigned_technician_user_id: "tech-1"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe(true);
  });

  it("does not queue en-route automation after the promise has already slipped", () => {
    expect(
      shouldQueueEnRouteAutomation(
        {
          id: "job-1",
          company_id: "company-1",
          status: "dispatched",
          scheduled_start_at: "2026-03-23T14:55:00.000Z",
          arrival_window_start_at: null,
          assigned_technician_user_id: "tech-1"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe(false);
  });

  it("queues running-late automation after the grace period passes", () => {
    expect(
      shouldQueueRunningLateAutomation(
        {
          id: "job-1",
          company_id: "company-1",
          status: "dispatched",
          scheduled_start_at: "2026-03-23T14:50:00.000Z",
          arrival_window_start_at: null,
          assigned_technician_user_id: "tech-1"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe(true);
  });

  it("classifies automated payment reminder stages using scheduler-friendly windows", () => {
    expect(
      resolveAutomatedPaymentReminderStage(
        {
          id: "invoice-upcoming",
          company_id: "company-1",
          status: "issued",
          balance_due_cents: 12000,
          due_at: "2026-03-24T09:00:00.000Z"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe("upcoming");

    expect(
      resolveAutomatedPaymentReminderStage(
        {
          id: "invoice-due",
          company_id: "company-1",
          status: "issued",
          balance_due_cents: 12000,
          due_at: "2026-03-23T15:20:00.000Z"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe("due");

    expect(
      resolveAutomatedPaymentReminderStage(
        {
          id: "invoice-overdue",
          company_id: "company-1",
          status: "partially_paid",
          balance_due_cents: 12000,
          due_at: "2026-03-22T15:00:00.000Z"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBe("overdue");
  });

  it("ignores invoices outside the automation windows", () => {
    expect(
      resolveAutomatedPaymentReminderStage(
        {
          id: "invoice-too-early",
          company_id: "company-1",
          status: "issued",
          balance_due_cents: 12000,
          due_at: "2026-03-26T15:00:00.000Z"
        },
        new Date("2026-03-23T15:00:00.000Z")
      )
    ).toBeNull();
  });
});
