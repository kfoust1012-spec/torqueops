import type {
  EstimateStatus,
  InspectionStatus,
  InvoiceStatus,
  JobStatus
} from "@mobile-mechanic/types";

export const fieldStopStages = [
  "travel",
  "inspection",
  "approval",
  "parts",
  "repair",
  "billing",
  "closeout",
  "complete"
] as const;

export type FieldStopStage = (typeof fieldStopStages)[number];

export type FieldStopWorkflowInput = {
  balanceDueCents?: number | null | undefined;
  estimateStatus?: EstimateStatus | null | undefined;
  hadPartialFailure?: boolean | undefined;
  inspectionStatus?: InspectionStatus | null | undefined;
  invoiceStatus?: InvoiceStatus | null | undefined;
  jobStatus: JobStatus;
  photoCount?: number | null | undefined;
};

export type FieldStopStageSummary = {
  blocker: string | null;
  detail: string;
  label: string;
  nextActionLabel: string;
  stage: FieldStopStage;
};

function hasPositiveBalance(balanceDueCents: number | null | undefined) {
  return typeof balanceDueCents === "number" && balanceDueCents > 0;
}

export function getFieldStopStageSummary(
  input: FieldStopWorkflowInput
): FieldStopStageSummary {
  if (input.jobStatus === "canceled") {
    return {
      blocker: "This stop has been canceled and should not receive more field work.",
      detail: "Review the stop record for cancellation notes before leaving the thread behind.",
      label: "Canceled",
      nextActionLabel: "Review stop",
      stage: "complete"
    };
  }

  if (input.jobStatus === "completed") {
    return {
      blocker: null,
      detail: "All required field artifacts look closed from the technician view.",
      label: "Complete",
      nextActionLabel: "Review closeout",
      stage: "complete"
    };
  }

  if (input.jobStatus === "new") {
    return {
      blocker: "The office has not fully released this stop into the field yet.",
      detail: "Confirm schedule, customer timing, and dispatch ownership before treating this as active route work.",
      label: "Awaiting release",
      nextActionLabel: "Review stop",
      stage: "travel"
    };
  }

  if (input.jobStatus === "scheduled") {
    return {
      blocker: null,
      detail: "Confirm timing, load route guidance, and mark the stop en route when you leave for the customer.",
      label: "Ready to depart",
      nextActionLabel: "Mark en route",
      stage: "travel"
    };
  }

  if (input.jobStatus === "dispatched") {
    return {
      blocker: null,
      detail: "The stop is already released into the field queue and should be pushed into the real travel state once the technician is leaving.",
      label: "Released",
      nextActionLabel: "Mark en route",
      stage: "travel"
    };
  }

  if (input.jobStatus === "en_route") {
    return {
      blocker: null,
      detail: "The mechanic is on the way. Keep maps and customer timing handy until arrival is confirmed.",
      label: "En route",
      nextActionLabel: "Mark arrived",
      stage: "travel"
    };
  }

  if (input.jobStatus === "arrived") {
    return {
      blocker: null,
      detail: "The stop is on site. Start diagnosis or inspection capture before work branches further.",
      label: "Arrived on site",
      nextActionLabel: "Start diagnosis",
      stage: "inspection"
    };
  }

  if (input.jobStatus === "diagnosing") {
    return {
      blocker: input.inspectionStatus === "completed" ? null : "Diagnosis is live, but the inspection still needs field results.",
      detail: "Capture findings and move the stop into approval, parts, or active repair based on what the diagnosis confirms.",
      label: "Diagnosing",
      nextActionLabel: "Open inspection",
      stage: "inspection"
    };
  }

  if (input.jobStatus === "waiting_approval") {
    return {
      blocker: "Customer approval is still pending for the active work recommendation.",
      detail: "Keep the stop in approval hold until the customer signs or the office changes the plan.",
      label: "Waiting approval",
      nextActionLabel: "Capture approval",
      stage: "approval"
    };
  }

  if (input.jobStatus === "waiting_parts") {
    return {
      blocker: "Parts are still blocking the stop from moving back into active repair.",
      detail: "Track the stop as waiting on parts so the office does not assume the mechanic is still wrenching.",
      label: "Waiting parts",
      nextActionLabel: "Review parts hold",
      stage: "parts"
    };
  }

  if (input.jobStatus === "repairing") {
    return {
      blocker: null,
      detail: "Approved work is actively underway. Keep evidence and repair notes current before moving into billing.",
      label: "Repair in progress",
      nextActionLabel: "Review closeout",
      stage: "repair"
    };
  }

  if (input.jobStatus === "ready_for_payment") {
    return {
      blocker: hasPositiveBalance(input.balanceDueCents)
        ? "Customer payment is still outstanding for this stop."
        : null,
      detail: "Repair work is finished and the stop should move through invoice review, payment, and closeout.",
      label: "Ready for payment",
      nextActionLabel: hasPositiveBalance(input.balanceDueCents) ? "Collect payment" : "Open invoice",
      stage: "billing"
    };
  }

  if (input.inspectionStatus !== "completed") {
    return {
      blocker: "Inspection still needs field results before the stop can move into approval or billing.",
      detail: "Capture the inspection first so customer-facing pricing and office follow-up start from actual findings.",
      label: "On-site diagnosis",
      nextActionLabel: "Open inspection",
      stage: "inspection"
    };
  }

  if (input.estimateStatus === "draft") {
    return {
      blocker: "Estimate pricing is still being assembled before the customer can approve the work.",
      detail: "Open the estimate so pricing gaps or office follow-up do not stay hidden while the stop is active.",
      label: "Estimate draft",
      nextActionLabel: "Open estimate",
      stage: "approval"
    };
  }

  if (input.estimateStatus === "sent") {
    return {
      blocker: "Customer approval is still pending for the active estimate.",
      detail: "Capture the field signature before continuing with approved repair work.",
      label: "Waiting approval",
      nextActionLabel: "Capture approval",
      stage: "approval"
    };
  }

  if (input.estimateStatus === "declined") {
    return {
      blocker: "The customer declined the active estimate, so added work is still blocked.",
      detail: "Review the estimate with the office before continuing any work that depended on customer approval.",
      label: "Estimate declined",
      nextActionLabel: "Review estimate",
      stage: "approval"
    };
  }

  if (input.estimateStatus === "void") {
    return {
      blocker: "The active estimate was voided and can no longer support approval or billing follow-through.",
      detail: "Open the estimate thread and confirm the current approved work before continuing.",
      label: "Estimate voided",
      nextActionLabel: "Review estimate",
      stage: "approval"
    };
  }

  if (!input.invoiceStatus || input.invoiceStatus === "draft") {
    return {
      blocker: "Billing is not ready yet because the invoice still needs to be created or issued.",
      detail: "Move the stop into invoice preparation before trying to collect payment.",
      label: "Needs invoice",
      nextActionLabel: "Open invoice",
      stage: "billing"
    };
  }

  if (hasPositiveBalance(input.balanceDueCents)) {
    return {
      blocker: "Customer payment is still outstanding for this stop.",
      detail: "Collect or confirm payment before closing the visit.",
      label: "Payment due",
      nextActionLabel: "Collect payment",
      stage: "billing"
    };
  }

  if ((input.photoCount ?? 0) === 0) {
    return {
      blocker: "Field evidence is still missing from the stop record.",
      detail: "Capture at least one supporting photo before leaving so the closeout file is not relying on memory.",
      label: "Needs evidence",
      nextActionLabel: "Open photos",
      stage: "closeout"
    };
  }

  if (input.hadPartialFailure) {
    return {
      blocker: "Some stop artifacts failed to refresh cleanly and should be rechecked before closeout.",
      detail: "Refresh the stop and reopen the affected artifacts before marking the work complete.",
      label: "Refresh artifacts",
      nextActionLabel: "Refresh stop",
      stage: "closeout"
    };
  }

  return {
    blocker: null,
    detail: "Inspection, approval, billing, payment, and evidence look clear enough to finish the stop.",
    label: "Ready to close",
    nextActionLabel: "Complete stop",
    stage: "closeout"
  };
}
