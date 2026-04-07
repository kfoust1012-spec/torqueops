type EstimateSupportStatus = "draft" | "sent" | "accepted" | "declined" | "void" | (string & {});

export type EstimateSupportStage =
  | "drafting"
  | "awaiting_approval"
  | "stale_approval"
  | "approved_release"
  | "closed";

export type EstimateSupportRecord = {
  acceptedAt?: string | null;
  estimateNumber?: string | null;
  sentAt?: string | null;
  status: EstimateSupportStatus;
  updatedAt?: string;
};

const supportStages: EstimateSupportStage[] = [
  "drafting",
  "awaiting_approval",
  "stale_approval",
  "approved_release",
  "closed"
];

export function resolveEstimateSupportStage(value: string): EstimateSupportStage | undefined {
  return supportStages.includes(value as EstimateSupportStage) ? (value as EstimateSupportStage) : undefined;
}

export function mapLegacyEstimateStatusToSupportStage(value: string): EstimateSupportStage | undefined {
  switch (value) {
    case "draft":
      return "drafting";
    case "sent":
      return "awaiting_approval";
    case "accepted":
      return "approved_release";
    case "declined":
    case "void":
      return "closed";
    default:
      return undefined;
  }
}

export function isStaleEstimateApproval(estimate: Pick<EstimateSupportRecord, "sentAt" | "status">) {
  if (estimate.status !== "sent" || !estimate.sentAt) {
    return false;
  }

  const sentAt = Date.parse(estimate.sentAt);
  return Number.isFinite(sentAt) && sentAt <= Date.now() - 24 * 60 * 60 * 1000;
}

export function getEstimateSupportStage(estimate: EstimateSupportRecord): EstimateSupportStage {
  switch (estimate.status) {
    case "draft":
      return "drafting";
    case "sent":
      return isStaleEstimateApproval(estimate) ? "stale_approval" : "awaiting_approval";
    case "accepted":
      return "approved_release";
    default:
      return "closed";
  }
}

export function getEstimateSupportStageLabel(stage: EstimateSupportStage) {
  switch (stage) {
    case "drafting":
      return "Builder in progress";
    case "awaiting_approval":
      return "Awaiting approval";
    case "stale_approval":
      return "Stale approval";
    case "approved_release":
      return "Approved to release";
    case "closed":
      return "Closed";
    default:
      return "Estimate";
  }
}

export function getEstimateSupportTone(stage: EstimateSupportStage) {
  switch (stage) {
    case "drafting":
      return "brand" as const;
    case "awaiting_approval":
      return "warning" as const;
    case "stale_approval":
      return "danger" as const;
    case "approved_release":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

export function getEstimateSupportRank(stage: EstimateSupportStage) {
  switch (stage) {
    case "stale_approval":
      return 0;
    case "approved_release":
      return 1;
    case "awaiting_approval":
      return 2;
    case "drafting":
      return 3;
    default:
      return 4;
  }
}

export function getEstimateSupportActionLabel(estimate: Pick<EstimateSupportRecord, "status">) {
  if (estimate.status === "draft") return "Open builder";
  if (estimate.status === "accepted") return "Open release handoff";
  return "Open approval view";
}

export function getEstimateNextStepLabel(estimate: EstimateSupportRecord) {
  const stage = getEstimateSupportStage(estimate);

  switch (stage) {
    case "drafting":
      return "Finish and send";
    case "awaiting_approval":
      return "Monitor approval";
    case "stale_approval":
      return "Chase approval";
    case "approved_release":
      return "Release to visits";
    case "closed":
      return estimate.status === "declined" ? "Revise if needed" : "Archive";
    default:
      return "Review";
  }
}

export function getEstimateStageCopy(estimate: EstimateSupportRecord) {
  const stage = getEstimateSupportStage(estimate);

  switch (stage) {
    case "drafting":
      return "Pricing is still in progress and not ready for customer approval.";
    case "awaiting_approval":
      return "Sent and waiting on a customer decision.";
    case "stale_approval":
      return "Approval follow-up is overdue and needs operator attention.";
    case "approved_release":
      return "Approved work is ready to be released into visits and dispatch.";
    case "closed":
      return estimate.status === "declined" ? "Closed unless reopened." : "Closed intentionally.";
    default:
      return "In estimate workflow.";
  }
}

export function getEstimateDecisionCopy(estimate: EstimateSupportRecord) {
  const stage = getEstimateSupportStage(estimate);

  switch (stage) {
    case "drafting":
      return "Finish pricing, then send the approval link from the builder.";
    case "awaiting_approval":
      return "Keep the quote visible, but let the approval window play out before escalating.";
    case "stale_approval":
      return "Follow up now and either lock the decision or convert the work into a scheduled visit.";
    case "approved_release":
      return "Release the approved visit into operations, assign ownership, and lock timing.";
    case "closed":
      return estimate.status === "declined"
        ? "Keep it closed unless the customer wants a revision."
        : "Keep it archived and reference it only if a replacement quote is needed.";
    default:
      return "Review the estimate and decide the next move.";
  }
}

export function getVisitEstimateSupportSummary(estimate: EstimateSupportRecord | null) {
  if (!estimate) {
    return {
      copy: "Builder work should start from this visit so pricing stays attached to the actual field thread.",
      label: "Open builder queue"
    };
  }

  const estimateLabel = estimate.estimateNumber ?? "This estimate";
  const stage = getEstimateSupportStage(estimate);

  switch (stage) {
    case "drafting":
      return {
        copy: `${estimateLabel} is still in builder throughput. Keep pricing work tied to this visit until it is ready to send.`,
        label: "Open builder queue"
      };
    case "awaiting_approval":
      return {
        copy: `${estimateLabel} is waiting on customer approval and should stay connected to this visit's next move.`,
        label: "Monitor approval"
      };
    case "stale_approval":
      return {
        copy: `${estimateLabel} needs approval follow-up now before this visit thread goes colder.`,
        label: "Chase approval"
      };
    case "approved_release":
      return {
        copy: `${estimateLabel} is approved and should move back into visit release and billing without desk drift.`,
        label: "Open release runway"
      };
    case "closed":
    default:
      return {
        copy: `${estimateLabel} is closed and should only be reviewed if this visit needs to reopen or revise pricing.`,
        label: "Open closed estimates"
      };
  }
}
