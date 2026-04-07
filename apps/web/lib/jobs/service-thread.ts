import {
  formatCurrencyFromCents,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";

import type { JobStatus } from "@mobile-mechanic/types";

import type { VisitFollowUpSummary } from "./follow-up";

type ServiceThreadTone = "brand" | "danger" | "neutral" | "success" | "warning";

type ServiceThreadEstimate = {
  estimateNumber?: string | null;
  status: string;
  totalCents?: number | null;
} | null;

type ServiceThreadInvoice = {
  amountPaidCents?: number | null;
  balanceDueCents?: number | null;
  invoiceNumber?: string | null;
  status: string;
  totalCents?: number | null;
} | null;

type ServiceThreadJob = {
  status: JobStatus;
};

export type ServiceThreadSegment = {
  detail: string;
  key: "estimate" | "approval" | "visit" | "follow_up" | "invoice" | "payment";
  label: string;
  tone: ServiceThreadTone;
  value: string;
};

export type ServiceThreadSummary = {
  copy: string;
  label: string;
  nextActionLabel: string;
  segments: ServiceThreadSegment[];
  tone: ServiceThreadTone;
};

export type ServiceThreadActionIntent =
  | "approval"
  | "closeout"
  | "follow_up"
  | "invoice"
  | "monitor"
  | "visit";

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getEstimateSegment(estimate: ServiceThreadEstimate): ServiceThreadSegment {
  if (!estimate) {
    return {
      detail: "No estimate is attached to this thread yet.",
      key: "estimate",
      label: "Estimate",
      tone: "neutral",
      value: "Not started"
    };
  }

  const amountLabel =
    typeof estimate.totalCents === "number" ? ` · ${formatCurrencyFromCents(estimate.totalCents)}` : "";

  switch (estimate.status) {
    case "draft":
      return {
        detail: "The estimate is still being built and has not been sent yet.",
        key: "estimate",
        label: "Estimate",
        tone: "warning",
        value: `Draft${amountLabel}`
      };
    case "sent":
      return {
        detail: "The estimate is out with the customer and still driving the thread.",
        key: "estimate",
        label: "Estimate",
        tone: "brand",
        value: `${estimate.estimateNumber ?? "Estimate"} sent${amountLabel}`
      };
    case "approved":
      return {
        detail: "Approval is clear and the estimate is ready to release work forward.",
        key: "estimate",
        label: "Estimate",
        tone: "success",
        value: `Approved${amountLabel}`
      };
    case "declined":
      return {
        detail: "The current estimate was declined and likely needs a different recommendation.",
        key: "estimate",
        label: "Estimate",
        tone: "danger",
        value: "Declined"
      };
    default:
      return {
        detail: `Estimate state is ${formatLabel(estimate.status)}.`,
        key: "estimate",
        label: "Estimate",
        tone: "neutral",
        value: formatLabel(estimate.status)
      };
  }
}

function getApprovalSegment(estimate: ServiceThreadEstimate): ServiceThreadSegment {
  if (!estimate) {
    return {
      detail: "No estimate is blocking the service thread right now.",
      key: "approval",
      label: "Approval",
      tone: "neutral",
      value: "No quote"
    };
  }

  switch (estimate.status) {
    case "draft":
      return {
        detail: "Approval cannot happen until the estimate is actually sent.",
        key: "approval",
        label: "Approval",
        tone: "warning",
        value: "Not sent"
      };
    case "sent":
      return {
        detail: "Customer approval is the active blocker on this thread.",
        key: "approval",
        label: "Approval",
        tone: "warning",
        value: "Waiting"
      };
    case "approved":
      return {
        detail: "Approval is clear.",
        key: "approval",
        label: "Approval",
        tone: "success",
        value: "Cleared"
      };
    case "declined":
      return {
        detail: "The thread needs a new recommendation or a recovery conversation.",
        key: "approval",
        label: "Approval",
        tone: "danger",
        value: "Declined"
      };
    default:
      return {
        detail: "Approval is not the active blocker right now.",
        key: "approval",
        label: "Approval",
        tone: "neutral",
        value: formatLabel(estimate.status)
      };
  }
}

function getVisitSegment(job: ServiceThreadJob): ServiceThreadSegment {
  switch (job.status) {
    case "new":
      return {
        detail: "The visit is still in intake and has not been scheduled into live work yet.",
        key: "visit",
        label: "Visit",
        tone: "warning",
        value: "Intake"
      };
    case "scheduled":
      return {
        detail: "The visit has a promised time and is staged for dispatch.",
        key: "visit",
        label: "Visit",
        tone: "brand",
        value: "Scheduled"
      };
    case "dispatched":
    case "en_route":
      return {
        detail: "The visit is live in dispatch and moving toward the customer.",
        key: "visit",
        label: "Visit",
        tone: "brand",
        value: "En route"
      };
    case "arrived":
    case "diagnosing":
    case "repairing":
    case "in_progress":
      return {
        detail: "Field work is in motion now.",
        key: "visit",
        label: "Visit",
        tone: "success",
        value: "On site"
      };
    case "waiting_approval":
      return {
        detail: "Field work is on site, but customer approval is holding the next move.",
        key: "visit",
        label: "Visit",
        tone: "warning",
        value: "Waiting approval"
      };
    case "waiting_parts":
      return {
        detail: "Field work is on site, but parts availability is holding the next move.",
        key: "visit",
        label: "Visit",
        tone: "warning",
        value: "Waiting parts"
      };
    case "ready_for_payment":
      return {
        detail: "Field work is complete enough to move into payment and closeout.",
        key: "visit",
        label: "Visit",
        tone: "success",
        value: "Ready for payment"
      };
    case "completed":
      return {
        detail: "Field work is done and the thread should now finish through closeout or follow-up.",
        key: "visit",
        label: "Visit",
        tone: "success",
        value: "Completed"
      };
    case "canceled":
      return {
        detail: "The visit is out of play unless the thread is reopened.",
        key: "visit",
        label: "Visit",
        tone: "neutral",
        value: "Canceled"
      };
    default:
      return {
        detail: `Visit state is ${formatLabel(job.status)}.`,
        key: "visit",
        label: "Visit",
        tone: "neutral",
        value: formatLabel(job.status)
      };
  }
}

function getFollowUpSegment(
  followUpSummary: Pick<
    VisitFollowUpSummary,
    "copy" | "hasChainContext" | "label" | "shouldCreateReturnVisit" | "staleFollowUp" | "tone"
  > | null | undefined
): ServiceThreadSegment {
  if (!followUpSummary) {
    return {
      detail: "No return-work context is attached to this thread.",
      key: "follow_up",
      label: "Follow-up",
      tone: "neutral",
      value: "None"
    };
  }

  if (followUpSummary.shouldCreateReturnVisit) {
    return {
      detail: "The thread should branch into return work before context goes cold.",
      key: "follow_up",
      label: "Follow-up",
      tone: "warning",
      value: "Needed"
    };
  }

  if (!followUpSummary.hasChainContext) {
    return {
      detail: "No active return-work chain is attached right now.",
      key: "follow_up",
      label: "Follow-up",
      tone: "neutral",
      value: "None"
    };
  }

  return {
    detail: followUpSummary.copy,
    key: "follow_up",
    label: "Follow-up",
    tone: followUpSummary.staleFollowUp ? "warning" : followUpSummary.tone,
    value: followUpSummary.label
  };
}

function getInvoiceSegment(
  invoice: ServiceThreadInvoice,
  jobStatus: JobStatus
): ServiceThreadSegment {
  if (!invoice) {
    return {
      detail:
        jobStatus === "completed"
          ? "Field work is done, but billing has not been started yet."
          : "No invoice is attached to this thread yet.",
      key: "invoice",
      label: "Invoice",
      tone: jobStatus === "completed" ? "warning" : "neutral",
      value: jobStatus === "completed" ? "Needed" : "Not started"
    };
  }

  switch (invoice.status) {
    case "draft":
      return {
        detail: "Billing exists but still needs to be released to the customer.",
        key: "invoice",
        label: "Invoice",
        tone: "warning",
        value: "Draft"
      };
    case "issued":
      return {
        detail: "The invoice is live with the customer.",
        key: "invoice",
        label: "Invoice",
        tone: "brand",
        value: "Issued"
      };
    case "partially_paid":
      return {
        detail: "Collections are in motion but the thread is not financially closed yet.",
        key: "invoice",
        label: "Invoice",
        tone: "brand",
        value: "Partial"
      };
    case "paid":
      return {
        detail: "Billing is fully closed.",
        key: "invoice",
        label: "Invoice",
        tone: "success",
        value: "Paid"
      };
    case "void":
      return {
        detail: "This billing record is intentionally out of play.",
        key: "invoice",
        label: "Invoice",
        tone: "neutral",
        value: "Void"
      };
    default:
      return {
        detail: `Invoice state is ${formatLabel(invoice.status)}.`,
        key: "invoice",
        label: "Invoice",
        tone: "neutral",
        value: formatLabel(invoice.status)
      };
  }
}

function getPaymentSegment(invoice: ServiceThreadInvoice): ServiceThreadSegment {
  if (!invoice) {
    return {
      detail: "No money is attached to the thread yet.",
      key: "payment",
      label: "Payment",
      tone: "neutral",
      value: "No balance"
    };
  }

  const balanceDueCents = Math.max(invoice.balanceDueCents ?? 0, 0);

  if (invoice.status === "draft") {
    return {
      detail: "Collections cannot start until the invoice is released.",
      key: "payment",
      label: "Payment",
      tone: "warning",
      value: "Not live"
    };
  }

  if (invoice.status === "paid" || balanceDueCents <= 0) {
    return {
      detail: "Payment is closed on this thread.",
      key: "payment",
      label: "Payment",
      tone: "success",
      value: "Collected"
    };
  }

  if (invoice.status === "partially_paid") {
    return {
      detail: "Part of the balance is in, but closeout still needs follow-through.",
      key: "payment",
      label: "Payment",
      tone: "brand",
      value: `${formatCurrencyFromCents(balanceDueCents)} due`
    };
  }

  return {
    detail: "Money is still open on this thread.",
    key: "payment",
    label: "Payment",
    tone: "brand",
    value: `${formatCurrencyFromCents(balanceDueCents)} due`
  };
}

export function getServiceThreadSummary(input: {
  estimate?: ServiceThreadEstimate | undefined;
  followUpSummary?: Pick<
    VisitFollowUpSummary,
    "copy" | "hasChainContext" | "label" | "shouldCreateReturnVisit" | "staleFollowUp" | "tone"
  > | null | undefined;
  invoice?: ServiceThreadInvoice | undefined;
  job: ServiceThreadJob;
}): ServiceThreadSummary {
  const estimateSegment = getEstimateSegment(input.estimate ?? null);
  const approvalSegment = getApprovalSegment(input.estimate ?? null);
  const visitSegment = getVisitSegment(input.job);
  const followUpSegment = getFollowUpSegment(input.followUpSummary ?? null);
  const invoiceSegment = getInvoiceSegment(input.invoice ?? null, input.job.status);
  const paymentSegment = getPaymentSegment(input.invoice ?? null);
  const segments = [
    estimateSegment,
    approvalSegment,
    visitSegment,
    followUpSegment,
    invoiceSegment,
    paymentSegment
  ] satisfies ServiceThreadSegment[];

  if (approvalSegment.value === "Waiting") {
    return {
      copy: "Approval is still the gating move on this service thread.",
      label: "Approval blocking release",
      nextActionLabel: "Follow up approval",
      segments,
      tone: "warning"
    };
  }

  if (followUpSegment.value === "Needed") {
    return {
      copy: "The service thread needs a return-work branch before the context goes cold.",
      label: "Return work needed",
      nextActionLabel: "Create return visit",
      segments,
      tone: "warning"
    };
  }

  if (paymentSegment.value.endsWith("due")) {
    return {
      copy: "Revenue is still open on this thread and closeout should stay active.",
      label: "Revenue still open",
      nextActionLabel: "Work closeout",
      segments,
      tone: "brand"
    };
  }

  if (followUpSegment.tone === "warning") {
    return {
      copy: followUpSegment.detail,
      label: "Follow-up chain active",
      nextActionLabel: "Work return visit",
      segments,
      tone: "warning"
    };
  }

  if (input.job.status === "scheduled" || isTechnicianActiveFieldJobStatus(input.job.status)) {
    return {
      copy: "The service thread is active and should keep moving without losing commercial or customer context.",
      label: "Service in motion",
      nextActionLabel: "Keep thread moving",
      segments,
      tone: "brand"
    };
  }

  if (input.job.status === "completed" && invoiceSegment.value === "Needed") {
    return {
      copy: "Field work is done, but the thread still needs billing to close cleanly.",
      label: "Billing not started",
      nextActionLabel: "Start invoice",
      segments,
      tone: "warning"
    };
  }

  return {
    copy: "Estimate, field work, follow-up, and money state are aligned enough to keep this thread oriented.",
    label: paymentSegment.value === "Collected" ? "Thread closed" : "Thread visible",
    nextActionLabel: paymentSegment.value === "Collected" ? "Monitor only" : "Review thread",
    segments,
    tone: paymentSegment.value === "Collected" ? "success" : "neutral"
  };
}

export function getServiceThreadActionIntent(summary: ServiceThreadSummary): ServiceThreadActionIntent {
  switch (summary.nextActionLabel) {
    case "Follow up approval":
      return "approval";
    case "Create return visit":
    case "Work return visit":
      return "follow_up";
    case "Work closeout":
      return "closeout";
    case "Start invoice":
      return "invoice";
    case "Keep thread moving":
      return "visit";
    default:
      return "monitor";
  }
}

export function getServiceThreadPressureScore(summary: ServiceThreadSummary) {
  switch (getServiceThreadActionIntent(summary)) {
    case "approval":
      return 100;
    case "follow_up":
      return summary.tone === "warning" ? 92 : 78;
    case "closeout":
      return 84;
    case "invoice":
      return 68;
    case "visit":
      return 42;
    case "monitor":
    default:
      return summary.tone === "success" ? 8 : 18;
  }
}
