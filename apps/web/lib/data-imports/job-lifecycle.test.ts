import { describe, expect, it } from "vitest";

import { deriveShopmonkeyImportedJobLifecycle } from "./job-lifecycle";

describe("shopmonkey imported job lifecycle", () => {
  it("maps authorized active work into the current field-status model", () => {
    expect(
      deriveShopmonkeyImportedJobLifecycle({
        authorized: true,
        authorizedDate: "2026-04-03T12:00:00.000Z",
        createdDate: "2026-04-02T12:00:00.000Z",
        deleted: false,
        invoiced: false,
        orderCreatedDate: "2026-04-02T13:00:00.000Z",
        paid: false,
        scheduledStartAt: "2026-04-03T15:00:00.000Z",
        updatedDate: "2026-04-03T12:15:00.000Z"
      })
    ).toEqual({
      completedAt: null,
      startedAt: "2026-04-03T12:00:00.000Z",
      status: "repairing"
    });
  });

  it("marks completed imported work as completed with lifecycle timestamps", () => {
    expect(
      deriveShopmonkeyImportedJobLifecycle({
        authorized: true,
        authorizedDate: "2026-04-03T12:00:00.000Z",
        completedDate: "2026-04-03T16:00:00.000Z",
        createdDate: "2026-04-02T12:00:00.000Z",
        deleted: false,
        fullyPaidDate: "2026-04-03T17:00:00.000Z",
        invoiced: true,
        orderCreatedDate: "2026-04-02T13:00:00.000Z",
        paid: false,
        scheduledStartAt: "2026-04-03T15:00:00.000Z",
        updatedDate: "2026-04-03T16:30:00.000Z"
      })
    ).toEqual({
      completedAt: "2026-04-03T16:00:00.000Z",
      startedAt: "2026-04-03T12:00:00.000Z",
      status: "completed"
    });
  });

  it("leaves unscheduled untouched work in intake and deleted work canceled", () => {
    expect(
      deriveShopmonkeyImportedJobLifecycle({
        authorized: false,
        createdDate: "2026-04-02T12:00:00.000Z",
        deleted: false,
        invoiced: false,
        paid: false
      })
    ).toEqual({
      completedAt: null,
      startedAt: null,
      status: "new"
    });

    expect(
      deriveShopmonkeyImportedJobLifecycle({
        authorized: false,
        createdDate: "2026-04-02T12:00:00.000Z",
        deleted: true,
        invoiced: false,
        paid: false,
        scheduledStartAt: "2026-04-03T15:00:00.000Z"
      })
    ).toEqual({
      completedAt: null,
      startedAt: null,
      status: "canceled"
    });
  });
});
