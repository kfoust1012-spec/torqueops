import type { InvoiceSummary } from "@mobile-mechanic/types";

export type CollectionStage =
  | "field_handoff"
  | "ready_release"
  | "collect_now"
  | "reminder_due"
  | "aged_risk"
  | "partial_follow_up"
  | "closed_paid"
  | "voided";

type CollectionStageRecord = Pick<InvoiceSummary, "balanceDueCents" | "status" | "updatedAt">;

type CollectionThreadMoveInput = {
  customerName: string;
  jobId: string;
  summary: {
    copy: string;
  };
  threadIntent: "approval" | "closeout" | "follow_up" | "invoice" | "monitor" | "visit";
};

type FinancePriorityActionInput = {
  agedRiskCount: number;
  collectNowCount: number;
  fieldHandoffCount: number;
  outstandingBalance: number;
  partialFollowUpCount: number;
  readyReleaseCount: number;
  reminderDueCount: number;
};

const collectionStages: CollectionStage[] = [
  "field_handoff",
  "ready_release",
  "collect_now",
  "reminder_due",
  "aged_risk",
  "partial_follow_up",
  "closed_paid",
  "voided"
];

export function getCollectionStage(
  invoice: CollectionStageRecord,
  options?: {
    openPaymentHandoffCount?: number;
  }
) {
  const updatedAtTime = Date.parse(invoice.updatedAt);
  const ageDays = Number.isNaN(updatedAtTime)
    ? 0
    : Math.max((Date.now() - updatedAtTime) / (24 * 60 * 60 * 1000), 0);
  const openPaymentHandoffCount = Math.max(0, options?.openPaymentHandoffCount ?? 0);

  if (invoice.status === "void") {
    return "voided" as const;
  }

  if (invoice.status === "paid" || invoice.balanceDueCents <= 0) {
    return "closed_paid" as const;
  }

  if (openPaymentHandoffCount > 0) {
    return "field_handoff" as const;
  }

  if (invoice.status === "draft") {
    return "ready_release" as const;
  }

  if (ageDays >= 7) {
    return "aged_risk" as const;
  }

  if (invoice.status === "partially_paid") {
    return ageDays >= 2 ? ("reminder_due" as const) : ("partial_follow_up" as const);
  }

  if (invoice.status === "issued") {
    return ageDays >= 2 ? ("reminder_due" as const) : ("collect_now" as const);
  }

  return "collect_now" as const;
}

export function getCollectionStageLabel(stage: CollectionStage) {
  switch (stage) {
    case "field_handoff":
      return "Field handoff";
    case "ready_release":
      return "Ready to release";
    case "collect_now":
      return "Collect now";
    case "reminder_due":
      return "Reminder due";
    case "aged_risk":
      return "Aged risk";
    case "partial_follow_up":
      return "Partial follow-up";
    case "closed_paid":
      return "Closed paid";
    case "voided":
      return "Voided";
    default:
      return "Collections";
  }
}

export function getCollectionStageTone(stage: CollectionStage) {
  switch (stage) {
    case "field_handoff":
      return "warning" as const;
    case "ready_release":
      return "warning" as const;
    case "collect_now":
      return "brand" as const;
    case "reminder_due":
      return "warning" as const;
    case "aged_risk":
      return "danger" as const;
    case "partial_follow_up":
      return "brand" as const;
    case "closed_paid":
      return "success" as const;
    case "voided":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function getCollectionStageCopy(stage: CollectionStage) {
  switch (stage) {
    case "field_handoff":
      return "A technician logged a payment handoff that office still needs to reconcile.";
    case "ready_release":
      return "Draft billing is still waiting to be released.";
    case "collect_now":
      return "Invoice is out and should stay in active follow-through.";
    case "reminder_due":
      return "Customer likely needs another payment touch now.";
    case "aged_risk":
      return "This balance is going cold and needs escalation.";
    case "partial_follow_up":
      return "Money is in motion but the remainder still needs closure.";
    case "closed_paid":
      return "Money is closed and the record is clear.";
    case "voided":
      return "This billing record is intentionally out of play.";
    default:
      return "Collections context available.";
  }
}

export function getCollectionNextMove(stage: CollectionStage) {
  switch (stage) {
    case "field_handoff":
      return {
        copy: "Review the technician billing handoff now and either reconcile the payment or clear the customer promise.",
        label: "Resolve field handoff"
      };
    case "ready_release":
      return {
        copy: "Release the invoice so finance can start real customer follow-through.",
        label: "Release invoice"
      };
    case "collect_now":
      return {
        copy: "Stay close to the payment and keep customer follow-through active.",
        label: "Collect payment"
      };
    case "reminder_due":
      return {
        copy: "Send the next reminder now before the balance goes colder.",
        label: "Send reminder"
      };
    case "aged_risk":
      return {
        copy: "Escalate collection risk and push for a clear payment commitment.",
        label: "Escalate collection"
      };
    case "partial_follow_up":
      return {
        copy: "Close the remaining balance while the customer thread is still warm.",
        label: "Close remaining balance"
      };
    case "closed_paid":
      return {
        copy: "No collections move is needed. The file is financially clear.",
        label: "Monitor only"
      };
    case "voided":
      return {
        copy: "Keep the voided file archived and use it only for reference.",
        label: "Archive file"
      };
    default:
      return {
        copy: "Review the record and decide the next collections move.",
        label: "Review collections"
      };
  }
}

export function getFinanceThreadNextMove(input: CollectionThreadMoveInput) {
  switch (input.threadIntent) {
    case "approval":
      return {
        copy: input.summary.copy,
        label: "Re-open approval thread",
        href: `/dashboard/visits?scope=awaiting_approval&query=${encodeURIComponent(input.customerName)}`
      };
    case "follow_up":
      return {
        copy: input.summary.copy,
        label: "Coordinate return work",
        href: `/dashboard/visits?scope=return_visit&query=${encodeURIComponent(input.customerName)}`
      };
    case "invoice":
      return {
        copy: input.summary.copy,
        label: "Finish billing setup",
        href: `/dashboard/visits/${input.jobId}/invoice`
      };
    case "closeout":
      return {
        copy: input.summary.copy,
        label: "Drive closeout",
        href: `/dashboard/visits/${input.jobId}/invoice`
      };
    default:
      return null;
  }
}

export function getCollectionStageRank(stage: CollectionStage) {
  switch (stage) {
    case "aged_risk":
      return 0;
    case "reminder_due":
      return 1;
    case "field_handoff":
      return 2;
    case "partial_follow_up":
      return 3;
    case "collect_now":
      return 4;
    case "ready_release":
      return 5;
    case "closed_paid":
      return 6;
    case "voided":
      return 7;
    default:
      return 8;
  }
}

export function resolveCollectionStage(value: string): CollectionStage | undefined {
  return collectionStages.includes(value as CollectionStage) ? (value as CollectionStage) : undefined;
}

export function getFinancePriorityAction(input: FinancePriorityActionInput) {
  if (input.agedRiskCount > 0) {
    return {
      copy: "Older balances are drifting cold. Work the riskiest files first before they become slow collections problems.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=aged_risk",
      label: "Open aged risk",
      secondaryHref: "/dashboard/visits?scope=billing_follow_up",
      secondaryLabel: "Review billing handoff",
      title: `${input.agedRiskCount} balance${input.agedRiskCount === 1 ? " is" : "s are"} in aged risk`,
      tone: "danger" as const
    };
  }

  if (input.fieldHandoffCount > 0) {
    return {
      copy: "Technicians already handed billing back from the field. Reconcile those payment outcomes before they turn into note-chasing.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=field_handoff",
      label: "Open field handoffs",
      secondaryHref: "/dashboard/visits?scope=billing_follow_up",
      secondaryLabel: "Open billing follow-up",
      title: `${input.fieldHandoffCount} field handoff${input.fieldHandoffCount === 1 ? " needs" : "s need"} review`,
      tone: "warning" as const
    };
  }

  if (input.reminderDueCount > 0) {
    return {
      copy: "Reminder pressure is building. Push the next customer touch now while the thread is still recoverable.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=reminder_due",
      label: "Open reminders",
      secondaryHref: "/dashboard/finance?stage=partial_follow_up",
      secondaryLabel: "Review partials",
      title: `${input.reminderDueCount} reminder${input.reminderDueCount === 1 ? " is" : "s are"} due now`,
      tone: "warning" as const
    };
  }

  if (input.readyReleaseCount > 0) {
    return {
      copy: "Draft invoices are still trapped before release. Move them out so finance can start real follow-through.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=ready_release",
      label: "Open ready to release",
      secondaryHref: "/dashboard/visits?scope=billing_follow_up",
      secondaryLabel: "Open ready-to-bill visits",
      title: `${input.readyReleaseCount} draft invoice${input.readyReleaseCount === 1 ? " is" : "s are"} waiting to release`,
      tone: "warning" as const
    };
  }

  if (input.partialFollowUpCount > 0) {
    return {
      copy: "Partial payment threads still need closure while the customer context is warm.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=partial_follow_up",
      label: "Open partial follow-up",
      secondaryHref: "/dashboard/finance?stage=collect_now",
      secondaryLabel: "Open active collections",
      title: `${input.partialFollowUpCount} partial payment thread${input.partialFollowUpCount === 1 ? " needs" : "s need"} closure`,
      tone: "brand" as const
    };
  }

  if (input.collectNowCount > 0) {
    return {
      copy: "Fresh balances are still open and need active collection work before they age into higher-risk follow-through.",
      eyebrow: "Finance priority",
      href: "/dashboard/finance?stage=collect_now",
      label: "Open active collections",
      secondaryHref: "/dashboard/visits",
      secondaryLabel: "Open visits",
      title: `${input.collectNowCount} invoice${input.collectNowCount === 1 ? " is" : "s are"} in active follow-through`,
      tone: "brand" as const
    };
  }

  return {
    copy:
      input.outstandingBalance > 0
        ? "Outstanding money exists, but the visible queue is stable. Keep monitoring customer threads and release readiness."
        : "Revenue follow-through is clear right now. Use the desk to keep release and collection discipline tight.",
    eyebrow: "Finance priority",
    href: "/dashboard/finance",
    label: "Open finance desk",
    secondaryHref: "/dashboard/visits?scope=billing_follow_up",
    secondaryLabel: "Review billing handoff",
    title: input.outstandingBalance > 0 ? "Collections are stable but still open" : "Finance is under control",
    tone: "success" as const
  };
}

export function getInvoiceActionLabel(invoice: Pick<InvoiceSummary, "status">) {
  return invoice.status === "draft" ? "Open invoice draft" : "Open invoice";
}
