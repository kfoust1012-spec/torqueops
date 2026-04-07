import { describe, expect, it } from "vitest";

import {
  buildDispatchHref,
  getReturnTo,
  parseCreateAvailabilityBlockFormData,
  parseDeleteAvailabilityBlockFormData,
  parseQuickAssignFormData,
  parseQuickRescheduleFormData,
  resolveDispatchPageState
} from "./helpers";

function createFormData(entries: Array<[string, string]>) {
  const formData = new FormData();

  for (const [key, value] of entries) {
    formData.set(key, value);
  }

  return formData;
}

describe("dispatch page helpers", () => {
  it("resolves dispatch page state with defaults", () => {
    expect(resolveDispatchPageState({}, "2026-03-09")).toEqual({
      view: "day",
      date: "2026-03-09",
      technicianUserId: "",
      includeUnscheduled: true
    });
  });

  it("resolves explicit query state values", () => {
    expect(
      resolveDispatchPageState(
        {
          view: "week",
          date: "2026-03-12",
          technicianUserId: "11111111-1111-4111-8111-111111111111",
          includeUnscheduled: "false"
        },
        "2026-03-09"
      )
    ).toEqual({
      view: "week",
      date: "2026-03-12",
      technicianUserId: "11111111-1111-4111-8111-111111111111",
      includeUnscheduled: false
    });
  });

  it("falls back when query params are malformed", () => {
    expect(
      resolveDispatchPageState(
        {
          view: "month",
          date: "not-a-date",
          technicianUserId: "not-a-uuid",
          includeUnscheduled: "1"
        },
        "2026-03-09"
      )
    ).toEqual({
      view: "day",
      date: "2026-03-09",
      technicianUserId: "",
      includeUnscheduled: true
    });
  });

  it("builds dispatch hrefs and only includes optional params when needed", () => {
    expect(
      buildDispatchHref(
        {
          view: "day",
          date: "2026-03-09",
          technicianUserId: "",
          includeUnscheduled: true
        },
        {}
      )
    ).toBe("/dashboard/dispatch?view=day&date=2026-03-09&includeUnscheduled=1");

    expect(
      buildDispatchHref(
        {
          view: "day",
          date: "2026-03-09",
          technicianUserId: "tech-1",
          includeUnscheduled: true
        },
        {
          view: "week",
          includeUnscheduled: false,
          technicianUserId: ""
        }
      )
    ).toBe("/dashboard/dispatch?view=week&date=2026-03-09");
  });

  it("guards returnTo to dispatch routes only", () => {
    expect(getReturnTo("/dashboard/dispatch?view=week")).toBe("/dashboard/dispatch?view=week");
    expect(getReturnTo("/dashboard/visits")).toBe("/dashboard/dispatch");
    expect(getReturnTo(null)).toBe("/dashboard/dispatch");
  });

  it("parses quick assign action payloads", () => {
    const formData = createFormData([
      ["jobId", "job-1"],
      ["assignedTechnicianUserId", "tech-1"],
      ["returnTo", "/dashboard/dispatch?view=day"]
    ]);

    expect(parseQuickAssignFormData(formData)).toEqual({
      jobId: "job-1",
      input: {
        assignedTechnicianUserId: "tech-1"
      },
      returnTo: "/dashboard/dispatch?view=day"
    });
  });

  it("parses quick reschedule action payloads and trims empty end times to null", () => {
    const formData = createFormData([
      ["jobId", "job-2"],
      ["scheduledStartAt", "2026-03-09T08:00"],
      ["scheduledEndAt", "   "],
      ["returnTo", "/dashboard/visits"]
    ]);

    expect(parseQuickRescheduleFormData(formData)).toEqual({
      jobId: "job-2",
      input: {
        scheduledStartAt: "2026-03-09T08:00",
        scheduledEndAt: null
      },
      returnTo: "/dashboard/dispatch"
    });
  });

  it("parses availability block create and delete payloads", () => {
    const createForm = createFormData([
      ["technicianUserId", "tech-1"],
      ["blockType", "training"],
      ["title", "Shop training"],
      ["startsAt", "2026-03-09T13:00"],
      ["endsAt", "2026-03-09T15:00"],
      ["notes", "Monthly safety review"],
      ["returnTo", "/dashboard/dispatch?view=week"]
    ]);
    createForm.set("isAllDay", "on");

    expect(parseCreateAvailabilityBlockFormData(createForm, "company-1", "user-1")).toEqual({
      input: {
        companyId: "company-1",
        technicianUserId: "tech-1",
        blockType: "training",
        title: "Shop training",
        startsAt: "2026-03-09T13:00",
        endsAt: "2026-03-09T15:00",
        isAllDay: true,
        notes: "Monthly safety review",
        createdByUserId: "user-1"
      },
      returnTo: "/dashboard/dispatch?view=week"
    });

    const deleteForm = createFormData([
      ["blockId", "block-1"],
      ["returnTo", "/dashboard/visits"]
    ]);

    expect(parseDeleteAvailabilityBlockFormData(deleteForm)).toEqual({
      blockId: "block-1",
      returnTo: "/dashboard/dispatch"
    });
  });
});