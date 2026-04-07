import { describe, expect, it, vi } from "vitest";

vi.mock("@mobile-mechanic/core", () => ({
  formatCurrencyFromCents: (value: number) => `$${(value / 100).toFixed(2)}`
}));

import {
  getVisitBillingActionLabel,
  getVisitBillingArtifactSummary,
  getVisitBillingGroups,
  getVisitBillingNote,
  getVisitBillingSortRank,
  getVisitBillingState,
  getVisitBillingStateLabel,
  getVisitBillingStateTone
} from "./billing-state";

function buildInvoice(
  overrides?: Partial<{
    balanceDueCents: number;
    invoiceNumber: string;
    status: "draft" | "issued" | "partially_paid" | "paid" | "void";
    totalCents: number;
    updatedAt: string;
  }>
) {
  return {
    balanceDueCents: 12_500,
    invoiceNumber: "INV-101",
    status: "issued" as const,
    totalCents: 25_000,
    updatedAt: "2026-03-25T12:00:00.000Z",
    ...overrides
  };
}

describe("visit billing adapter", () => {
  it("maps missing invoices to ready-to-invoice visit state", () => {
    expect(getVisitBillingState(null)).toBe("needs_invoice");
    expect(getVisitBillingStateLabel("needs_invoice")).toBe("Ready to invoice");
    expect(getVisitBillingStateTone("needs_invoice")).toBe("warning");
  });

  it("maps draft invoices to invoice_draft", () => {
    expect(getVisitBillingState(buildInvoice({ status: "draft" }))).toBe("invoice_draft");
  });

  it("maps open collection stages to payment_due", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(getVisitBillingState(buildInvoice({ updatedAt: "2026-03-20T00:00:00.000Z" }))).toBe("payment_due");
    vi.useRealTimers();
  });

  it("uses finance-stage copy in the visit invoice artifact summary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));

    expect(getVisitBillingArtifactSummary(buildInvoice({ status: "draft" }), null)).toMatchObject({
      status: "Ready to release",
      copy: "Draft billing is still waiting to be released.",
      value: "$250.00"
    });

    expect(getVisitBillingArtifactSummary(buildInvoice({ updatedAt: "2026-03-15T00:00:00.000Z" }), 12_500)).toMatchObject({
      status: "Aged risk",
      copy: "This balance is going cold and needs escalation.",
      value: "$125.00"
    });

    vi.useRealTimers();
  });

  it("provides workboard billing actions, notes, and ordering from the shared helper", () => {
    expect(getVisitBillingActionLabel("needs_invoice", true)).toBe("Start invoice");
    expect(getVisitBillingActionLabel("closed_paid", false)).toBe("View receipt");
    expect(getVisitBillingNote("needs_invoice", null)).toBe("Closed visit still needs an invoice.");
    expect(getVisitBillingNote("needs_invoice", {} as never)).toBe("Approved work is ready to invoice.");
    expect(getVisitBillingSortRank("needs_invoice")).toBeLessThan(getVisitBillingSortRank("payment_due"));
  });

  it("groups completed jobs by shared visit billing state", () => {
    const jobs = [{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }] as never[];
    const invoicesByJobId = new Map([
      ["job-1", buildInvoice({ status: "draft" })],
      ["job-2", buildInvoice({ status: "paid", balanceDueCents: 0 })]
    ]);

    expect(getVisitBillingGroups(jobs as never, invoicesByJobId as never)).toEqual([
      expect.objectContaining({ label: "Ready to invoice", jobs: [jobs[2]] }),
      expect.objectContaining({ label: "Draft invoices", jobs: [jobs[0]] }),
      expect.objectContaining({ label: "Closed paid", jobs: [jobs[1]] })
    ]);
  });
});