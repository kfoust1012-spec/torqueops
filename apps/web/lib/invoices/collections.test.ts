import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvoiceSummary } from "@mobile-mechanic/types";

import {
  getCollectionStage,
  getCollectionStageRank,
  resolveCollectionStage
} from "./collections";

function buildInvoice(
  overrides?: Partial<Pick<InvoiceSummary, "balanceDueCents" | "status" | "updatedAt">>
) {
  return {
    balanceDueCents: 12_500,
    status: "issued" as InvoiceSummary["status"],
    updatedAt: "2026-03-25T12:00:00.000Z",
    ...overrides
  };
}

describe("invoice collections helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats zero-balance and paid invoices as closed paid", () => {
    expect(getCollectionStage(buildInvoice({ balanceDueCents: 0 }))).toBe("closed_paid");
    expect(getCollectionStage(buildInvoice({ status: "paid" }))).toBe("closed_paid");
  });

  it("keeps fresh issued invoices in active collection before reminder threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(getCollectionStage(buildInvoice({ updatedAt: "2026-03-24T00:00:01.000Z" }))).toBe("collect_now");
  });

  it("elevates open technician payment handoffs ahead of normal collection flow", () => {
    expect(getCollectionStage(buildInvoice(), { openPaymentHandoffCount: 1 })).toBe("field_handoff");
    expect(
      getCollectionStage(buildInvoice({ status: "draft" }), { openPaymentHandoffCount: 2 })
    ).toBe("field_handoff");
  });

  it("moves issued and partial invoices into reminder due after two days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(getCollectionStage(buildInvoice({ updatedAt: "2026-03-23T11:59:59.000Z" }))).toBe("reminder_due");
    expect(
      getCollectionStage(buildInvoice({ status: "partially_paid", updatedAt: "2026-03-23T11:59:59.000Z" }))
    ).toBe("reminder_due");
  });

  it("escalates any outstanding invoice to aged risk after seven days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(getCollectionStage(buildInvoice({ updatedAt: "2026-03-18T11:59:59.000Z" }))).toBe("aged_risk");
  });

  it("orders stages by collection urgency", () => {
    expect(getCollectionStageRank("aged_risk")).toBeLessThan(getCollectionStageRank("reminder_due"));
    expect(getCollectionStageRank("reminder_due")).toBeLessThan(getCollectionStageRank("collect_now"));
    expect(getCollectionStageRank("collect_now")).toBeLessThan(getCollectionStageRank("closed_paid"));
  });

  it("resolves only supported collection stages", () => {
    expect(resolveCollectionStage("field_handoff")).toBe("field_handoff");
    expect(resolveCollectionStage("aged_risk")).toBe("aged_risk");
    expect(resolveCollectionStage("not_real")).toBeUndefined();
  });
});
