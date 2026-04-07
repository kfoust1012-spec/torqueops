import { describe, expect, it } from "vitest";

import {
  getExportFileName,
  getImportRunEntitySummaries,
  getImportRunExportRequestError,
  getImportRunFailures,
  getImportRunMode,
  getImportRunRequestedTables,
  getImportRunWebhookSummary
} from "./service";

describe("data import summary helpers", () => {
  it("parses entity counts, failures, and export metadata from run summaries", () => {
    const summaryJson = {
      counts: {
        attachmentsCreated: "2",
        customersCreated: 2,
        customersUpdated: "1",
        jobsCreated: 4,
        vehiclesUpdated: 3
      },
      exportFileName: "shopmonkey-export.csv",
      exportRequestError: " Export API unavailable ",
      failures: [" customer import failed ", "", 42],
      requestedTables: ["customer", "order"]
    };
    const entitySummaries = getImportRunEntitySummaries(summaryJson);

    expect(entitySummaries.find((summary) => summary.id === "customers")).toMatchObject({
      created: 2,
      total: 3,
      updated: 1
    });
    expect(entitySummaries.find((summary) => summary.id === "jobs")).toMatchObject({
      created: 4,
      total: 4,
      updated: 0
    });
    expect(entitySummaries.find((summary) => summary.id === "vehicles")).toMatchObject({
      created: 0,
      total: 3,
      updated: 3
    });
    expect(entitySummaries.find((summary) => summary.id === "attachments")).toMatchObject({
      created: 2,
      total: 2,
      updated: 0
    });
    expect(getImportRunFailures(summaryJson)).toEqual(["customer import failed"]);
    expect(getExportFileName(summaryJson)).toBe("shopmonkey-export.csv");
    expect(getImportRunExportRequestError(summaryJson)).toBe("Export API unavailable");
    expect(getImportRunRequestedTables(summaryJson, { tables: ["vehicle"] })).toEqual([
      "customer",
      "order"
    ]);
  });

  it("falls back to options for requested tables and webhook metadata", () => {
    const optionsJson = {
      mode: "delta",
      tables: ["vehicle", "inspection"],
      webhook: {
        id: "wh_123",
        operation: "updated",
        receivedAt: "2026-03-24T10:00:00.000Z",
        table: "order"
      }
    };

    expect(getImportRunMode(optionsJson)).toBe("delta");
    expect(getImportRunRequestedTables(null, optionsJson)).toEqual([
      "vehicle",
      "inspection"
    ]);
    expect(getImportRunWebhookSummary(optionsJson)).toEqual({
      id: "wh_123",
      operation: "updated",
      receivedAt: "2026-03-24T10:00:00.000Z",
      table: "order"
    });
    expect(getImportRunMode({})).toBe("full");
    expect(getImportRunWebhookSummary({})).toBeNull();
  });
});
