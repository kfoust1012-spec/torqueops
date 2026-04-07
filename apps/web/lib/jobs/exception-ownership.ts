type ExceptionTone = "brand" | "danger" | "neutral" | "success" | "warning";

export type ExceptionOwner = "Closed" | "Dispatch" | "Finance" | "Service advisor" | "Supply";

export type ExceptionOwnershipSummary = {
  copy: string;
  label: string;
  owner: ExceptionOwner;
  tone: ExceptionTone;
};

function isStaleApproval(sentAt: string | null | undefined) {
  if (!sentAt) {
    return false;
  }

  const sentTime = Date.parse(sentAt);
  return Number.isFinite(sentTime) && sentTime <= Date.now() - 24 * 60 * 60 * 1000;
}

export function getEstimateExceptionOwnershipSummary(input: {
  sentAt?: string | null | undefined;
  status: string;
}) {
  if (input.status === "sent") {
    return isStaleApproval(input.sentAt)
      ? {
          copy: "Approval follow-up is overdue and should be actively worked now.",
          label: "Stale approval",
          owner: "Service advisor",
          tone: "danger" as const
        }
      : {
          copy: "The quote is live and still waiting on the customer decision.",
          label: "Approval watch",
          owner: "Service advisor",
          tone: "warning" as const
        };
  }

  if (input.status === "accepted") {
    return {
      copy: "Approved work should be released into visits and assigned cleanly.",
      label: "Release handoff",
      owner: "Dispatch",
      tone: "brand" as const
    };
  }

  if (input.status === "draft") {
    return {
      copy: "Pricing still needs to be completed before customer approval can start.",
      label: "Builder completion",
      owner: "Service advisor",
      tone: "brand" as const
    };
  }

  return {
    copy: "This estimate no longer needs active operator ownership.",
    label: "Closed",
    owner: "Closed",
    tone: "neutral" as const
  };
}

export function getCollectionsExceptionOwnershipSummary(input: {
  balanceDueCents: number;
  status: string;
  updatedAt: string;
}) {
  const updatedAtTime = Date.parse(input.updatedAt);
  const ageDays = Number.isNaN(updatedAtTime)
    ? 0
    : Math.max((Date.now() - updatedAtTime) / (24 * 60 * 60 * 1000), 0);

  if (input.status === "void") {
    return {
      copy: "This billing file is intentionally closed and does not need active follow-through.",
      label: "Voided",
      owner: "Closed",
      tone: "neutral" as const
    };
  }

  if (input.status === "paid" || input.balanceDueCents <= 0) {
    return {
      copy: "Money is fully collected and closeout ownership is complete.",
      label: "Paid",
      owner: "Closed",
      tone: "success" as const
    };
  }

  if (input.status === "draft") {
    return {
      copy: "Billing is drafted but still waiting to be released to the customer.",
      label: "Release billing",
      owner: "Service advisor",
      tone: "warning" as const
    };
  }

  if (ageDays >= 7) {
    return {
      copy: "The balance is aging and finance should escalate collection follow-through now.",
      label: "Aged collection risk",
      owner: "Finance",
      tone: "danger" as const
    };
  }

  if (input.status === "partially_paid") {
    return {
      copy: "A remaining balance is still open and finance owns the closeout push.",
      label: "Partial follow-up",
      owner: "Finance",
      tone: "brand" as const
    };
  }

  return {
    copy: "The invoice is live and finance owns the next customer payment touch.",
    label: "Collect now",
    owner: "Finance",
    tone: "warning" as const
  };
}

export function getSupplyExceptionOwnershipSummary(input: {
  inventoryIssueCount?: number | null | undefined;
  openPartRequestCount?: number | null | undefined;
}) {
  const blockerCount =
    Number(input.inventoryIssueCount ?? 0) + Number(input.openPartRequestCount ?? 0);

  if (blockerCount <= 0) {
    return {
      copy: "No active supply blocker is attached to this visit right now.",
      label: "Supply clear",
      owner: "Closed",
      tone: "success" as const
    };
  }

  return {
    copy: `${blockerCount} supply blocker${blockerCount === 1 ? "" : "s"} still need sourcing or stock resolution.`,
    label: "Supply blocker",
    owner: "Supply",
    tone: blockerCount > 1 ? "danger" : "warning" as const
  };
}
