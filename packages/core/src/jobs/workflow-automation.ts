import type { InspectionStatus, InvoiceStatus, JobStatus } from "@mobile-mechanic/types";

export type JobWorkflowAutomationSignal =
  | {
      kind: "estimate_approved";
    }
  | {
      invoiceStatus: InvoiceStatus;
      kind: "invoice_issued";
    }
  | {
      balanceDueCents: number;
      hasPendingCloseoutSync?: boolean | undefined;
      inspectionStatus?: InspectionStatus | null | undefined;
      invoiceStatus: InvoiceStatus;
      kind: "invoice_settled";
      photoCount?: number | null | undefined;
    };

export function resolveJobWorkflowAutomationTarget(input: {
  currentStatus: JobStatus;
  signal: JobWorkflowAutomationSignal;
}): JobStatus | null {
  const { currentStatus, signal } = input;

  if (currentStatus === "completed" || currentStatus === "canceled") {
    return null;
  }

  if (signal.kind === "estimate_approved") {
    return currentStatus === "waiting_approval" ? "repairing" : null;
  }

  if (signal.kind === "invoice_issued") {
    if (!["issued", "partially_paid", "paid"].includes(signal.invoiceStatus)) {
      return null;
    }

    return currentStatus === "repairing" ? "ready_for_payment" : null;
  }

  if (
    signal.invoiceStatus !== "paid" ||
    signal.balanceDueCents > 0 ||
    signal.hasPendingCloseoutSync === true ||
    signal.inspectionStatus !== "completed" ||
    (signal.photoCount ?? 0) <= 0
  ) {
    return null;
  }

  return currentStatus === "ready_for_payment" ? "completed" : null;
}

export function getJobWorkflowAutomationReason(input: {
  targetStatus: JobStatus;
  signal: JobWorkflowAutomationSignal;
}) {
  if (input.signal.kind === "estimate_approved" && input.targetStatus === "repairing") {
    return "Estimate approved in the field; repair can continue.";
  }

  if (input.signal.kind === "invoice_issued" && input.targetStatus === "ready_for_payment") {
    return "Field billing started; the stop is ready for payment collection.";
  }

  if (input.signal.kind === "invoice_settled" && input.targetStatus === "completed") {
    return "Invoice was fully paid; the stop can close automatically.";
  }

  return "Job status advanced automatically from the field workflow state.";
}
