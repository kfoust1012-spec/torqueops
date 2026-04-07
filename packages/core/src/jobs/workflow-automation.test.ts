import { describe, expect, it } from "vitest";

import {
  getJobWorkflowAutomationReason,
  resolveJobWorkflowAutomationTarget
} from "./workflow-automation";

describe("job workflow automation", () => {
  it("moves waiting approval into repair after estimate approval", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "waiting_approval",
        signal: { kind: "estimate_approved" }
      })
    ).toBe("repairing");
  });

  it("moves active repair into payment-ready after invoice issue", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "repairing",
        signal: {
          invoiceStatus: "issued",
          kind: "invoice_issued"
        }
      })
    ).toBe("ready_for_payment");
  });

  it("does not move parts-hold work into billing just because an invoice exists", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "waiting_parts",
        signal: {
          invoiceStatus: "issued",
          kind: "invoice_issued"
        }
      })
    ).toBeNull();
  });

  it("completes payment-ready work only when the invoice is fully settled", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "ready_for_payment",
        signal: {
          balanceDueCents: 0,
          inspectionStatus: "completed",
          invoiceStatus: "paid",
          kind: "invoice_settled",
          photoCount: 2
        }
      })
    ).toBe("completed");
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "ready_for_payment",
        signal: {
          balanceDueCents: 2500,
          inspectionStatus: "completed",
          invoiceStatus: "partially_paid",
          kind: "invoice_settled",
          photoCount: 2
        }
      })
    ).toBeNull();
  });

  it("holds paid work open when closeout artifacts are still missing", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "ready_for_payment",
        signal: {
          balanceDueCents: 0,
          inspectionStatus: "in_progress",
          invoiceStatus: "paid",
          kind: "invoice_settled",
          photoCount: 2
        }
      })
    ).toBeNull();
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "ready_for_payment",
        signal: {
          balanceDueCents: 0,
          inspectionStatus: "completed",
          invoiceStatus: "paid",
          kind: "invoice_settled",
          photoCount: 0
        }
      })
    ).toBeNull();
  });

  it("holds paid work open when the device still has queued closeout sync", () => {
    expect(
      resolveJobWorkflowAutomationTarget({
        currentStatus: "ready_for_payment",
        signal: {
          balanceDueCents: 0,
          hasPendingCloseoutSync: true,
          inspectionStatus: "completed",
          invoiceStatus: "paid",
          kind: "invoice_settled",
          photoCount: 2
        }
      })
    ).toBeNull();
  });

  it("formats operator-readable automation reasons", () => {
    expect(
      getJobWorkflowAutomationReason({
        signal: { kind: "estimate_approved" },
        targetStatus: "repairing"
      })
    ).toBe("Estimate approved in the field; repair can continue.");
    expect(
      getJobWorkflowAutomationReason({
        signal: {
          balanceDueCents: 0,
          invoiceStatus: "paid",
          kind: "invoice_settled"
        },
        targetStatus: "completed"
      })
    ).toBe("Invoice was fully paid; the stop can close automatically.");
  });
});
