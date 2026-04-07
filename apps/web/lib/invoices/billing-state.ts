import { formatCurrencyFromCents } from "@mobile-mechanic/core";
import type { Estimate, Invoice, JobListItem } from "@mobile-mechanic/types";

import {
  getCollectionStage,
  getCollectionStageCopy,
  getCollectionStageLabel,
  getCollectionStageTone,
  type CollectionStage
} from "./collections";

export type VisitBillingState = "closed_paid" | "invoice_draft" | "needs_invoice" | "payment_due" | "voided";

export type VisitBillingGroup = {
  copy: string;
  label: string;
  state: VisitBillingState;
  tone: "brand" | "neutral" | "success" | "warning";
};

type VisitBillingInvoice = Pick<
  Invoice,
  "balanceDueCents" | "invoiceNumber" | "status" | "totalCents" | "updatedAt"
>;

function mapCollectionStageToVisitBillingState(stage: CollectionStage): VisitBillingState {
  switch (stage) {
    case "ready_release":
      return "invoice_draft";
    case "collect_now":
    case "reminder_due":
    case "aged_risk":
    case "partial_follow_up":
      return "payment_due";
    case "closed_paid":
      return "closed_paid";
    case "voided":
      return "voided";
    default:
      return "payment_due";
  }
}

export function getVisitBillingState(invoice: VisitBillingInvoice | null): VisitBillingState {
  if (!invoice) {
    return "needs_invoice";
  }

  return mapCollectionStageToVisitBillingState(getCollectionStage(invoice));
}

export function getVisitBillingStateLabel(state: VisitBillingState) {
  switch (state) {
    case "needs_invoice":
      return "Ready to invoice";
    case "invoice_draft":
      return "Draft invoice";
    case "payment_due":
      return "Payment due";
    case "closed_paid":
      return "Closed paid";
    case "voided":
      return "Voided";
    default:
      return "Billing";
  }
}

export function getVisitBillingStateTone(state: VisitBillingState) {
  switch (state) {
    case "needs_invoice":
    case "invoice_draft":
      return "warning" as const;
    case "payment_due":
      return "brand" as const;
    case "closed_paid":
      return "success" as const;
    case "voided":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function getVisitBillingArtifactSummary(invoice: VisitBillingInvoice | null, balanceDueCents: number | null) {
  if (!invoice) {
    return {
      copy: "Billing has not started yet. Open the invoice file when labor and parts are ready.",
      status: "Not started",
      title: "Invoice",
      value: "No invoice"
    };
  }

  const collectionStage = getCollectionStage(invoice);

  if (collectionStage === "closed_paid") {
    return {
      copy: getCollectionStageCopy(collectionStage),
      status: getCollectionStageLabel(collectionStage),
      title: "Invoice",
      value: "Paid"
    };
  }

  return {
    copy: getCollectionStageCopy(collectionStage),
    status: getCollectionStageLabel(collectionStage),
    title: "Invoice",
    value:
      collectionStage === "ready_release" || !balanceDueCents || balanceDueCents <= 0
        ? formatCurrencyFromCents(invoice.totalCents)
        : formatCurrencyFromCents(balanceDueCents)
  };
}

export function getVisitBillingCollectionTone(invoice: VisitBillingInvoice | null) {
  return invoice ? getCollectionStageTone(getCollectionStage(invoice)) : "warning";
}

export function getVisitBillingActionLabel(state: VisitBillingState, canEditRecords: boolean) {
  switch (state) {
    case "needs_invoice":
      return canEditRecords ? "Start invoice" : "Open billing";
    case "invoice_draft":
      return canEditRecords ? "Finish invoice" : "Open invoice";
    case "payment_due":
      return "Open invoice";
    case "closed_paid":
      return "View receipt";
    case "voided":
      return "Open invoice";
    default:
      return "Open billing";
  }
}

export function getVisitBillingNote(state: VisitBillingState, estimate: Estimate | null) {
  switch (state) {
    case "needs_invoice":
      return estimate ? "Approved work is ready to invoice." : "Closed visit still needs an invoice.";
    case "invoice_draft":
      return "Invoice started but not released yet.";
    case "payment_due":
      return "Invoice is out and money is still open.";
    case "closed_paid":
      return "Collected and financially closed.";
    case "voided":
      return "Voided invoices may need review.";
    default:
      return "Billing follow-through is still open.";
  }
}

export function getVisitBillingSortRank(state: VisitBillingState) {
  switch (state) {
    case "needs_invoice":
      return 0;
    case "invoice_draft":
      return 1;
    case "payment_due":
      return 2;
    case "closed_paid":
      return 3;
    case "voided":
      return 4;
    default:
      return 5;
  }
}

export function getVisitBillingGroupMeta(state: VisitBillingState): VisitBillingGroup {
  switch (state) {
    case "needs_invoice":
      return {
        copy: "Closed work that still needs an invoice started.",
        label: "Ready to invoice",
        state,
        tone: "warning"
      };
    case "invoice_draft":
      return {
        copy: "Invoice started but not released yet.",
        label: "Draft invoices",
        state,
        tone: "warning"
      };
    case "payment_due":
      return {
        copy: "Invoice is out and money is still open.",
        label: "Payment due",
        state,
        tone: "brand"
      };
    case "closed_paid":
      return {
        copy: "Collected and financially closed.",
        label: "Closed paid",
        state,
        tone: "success"
      };
    case "voided":
      return {
        copy: "Voided invoices that may need review.",
        label: "Voided",
        state,
        tone: "neutral"
      };
    default:
      return {
        copy: "Billing follow-through is still open.",
        label: "Billing",
        state,
        tone: "neutral"
      };
  }
}

export function getVisitBillingGroups(jobs: JobListItem[], invoicesByJobId: Map<string, Invoice>) {
  const states: VisitBillingState[] = [
    "needs_invoice",
    "invoice_draft",
    "payment_due",
    "closed_paid",
    "voided"
  ];

  return states
    .map((state) => ({
      ...getVisitBillingGroupMeta(state),
      jobs: jobs.filter((job) => getVisitBillingState(invoicesByJobId.get(job.id) ?? null) === state)
    }))
    .filter((group) => group.jobs.length > 0);
}
