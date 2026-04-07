import { describe, expect, it } from "vitest";

import {
  buildAutoResolvedTechnicianPaymentHandoffNote,
  formatTechnicianPaymentResolutionDispositionLabel,
  inferTechnicianPaymentHandoffResolutionDisposition,
  summarizeOpenTechnicianPaymentHandoffsByJobId,
  summarizeTechnicianPaymentHandoffResolutionDisposition
} from "./payment-handoffs";

describe("technician payment handoff helpers", () => {
  it("infers conservative office dispositions from handoff kinds", () => {
    expect(
      inferTechnicianPaymentHandoffResolutionDisposition({
        kind: "manual_tender",
        tenderType: "cash"
      })
    ).toBe("manual_tender_reconciled");
    expect(
      inferTechnicianPaymentHandoffResolutionDisposition({
        kind: "promised_to_pay_later",
        tenderType: null
      })
    ).toBe("promise_accepted");
    expect(
      inferTechnicianPaymentHandoffResolutionDisposition({
        kind: "other",
        tenderType: null
      })
    ).toBe("escalated_to_billing_owner");
  });

  it("formats office disposition labels for desk surfaces", () => {
    expect(formatTechnicianPaymentResolutionDispositionLabel("manual_tender_reconciled")).toBe(
      "Cash/check reconciled"
    );
    expect(formatTechnicianPaymentResolutionDispositionLabel("promise_accepted")).toBe(
      "Promise accepted"
    );
  });

  it("falls back to escalation when open handoffs disagree on the safest disposition", () => {
    expect(
      summarizeTechnicianPaymentHandoffResolutionDisposition([
        {
          kind: "manual_tender",
          tenderType: "cash"
        },
        {
          kind: "resend_link",
          tenderType: null
        }
      ])
    ).toBe("escalated_to_billing_owner");
  });

  it("builds auto-resolution notes when a real payment clears the invoice", () => {
    expect(
      buildAutoResolvedTechnicianPaymentHandoffNote({
        amountCents: 12345,
        provider: "manual"
      })
    ).toBe(
      "Auto-resolved after a field payment of $123.45 was posted to the invoice ledger."
    );
    expect(
      buildAutoResolvedTechnicianPaymentHandoffNote({
        amountCents: 8900,
        provider: "stripe"
      })
    ).toBe(
      "Auto-resolved after a customer payment of $89.00 cleared the invoice checkout flow."
    );
  });

  it("includes structured action notes in the office handoff summary copy", () => {
    const summaries = summarizeOpenTechnicianPaymentHandoffsByJobId({
      handoffs: [
        {
          amountCents: null,
          companyId: "company-1",
          createdAt: "2026-04-05T00:00:00.000Z",
          customerPromiseAt: null,
          id: "handoff-1",
          invoiceId: "invoice-1",
          jobId: "job-1",
          kind: "resend_link",
          note: "Technician needs office to refresh the payment page for invoice INV-204.",
          resolutionDisposition: null,
          resolutionNote: null,
          resolvedAt: null,
          resolvedByUserId: null,
          status: "open",
          technicianUserId: "tech-1",
          tenderType: null,
          updatedAt: "2026-04-05T00:00:00.000Z"
        }
      ],
      invoiceIdToJobId: new Map([["invoice-1", "job-1"]])
    });

    expect(summaries.get("job-1")?.copy).toContain(
      "Technician needs office to refresh the payment page for invoice INV-204."
    );
  });
});
