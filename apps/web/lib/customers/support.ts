export function getCustomerRecordHealth(
  customer: {
    email: string | null;
    phone: string | null;
  },
  addresses: Array<unknown>,
  vehicles: Array<unknown>
) {
  const missingFields = [
    !customer.email && !customer.phone ? "contact" : null,
    addresses.length === 0 ? "address" : null,
    vehicles.length === 0 ? "vehicle" : null
  ].filter(Boolean) as string[];

  if (missingFields.length === 0) {
    return {
      label: "Ready",
      detail: "All core fields present.",
      tone: "success" as const
    };
  }

  if (missingFields.length === 1) {
    return {
      label: "Needs 1 fix",
      detail: `Missing ${missingFields[0]}.`,
      tone: "warning" as const
    };
  }

  return {
    label: `Needs ${missingFields.length} fixes`,
    detail: `Missing ${missingFields.join(", ")}.`,
    tone: "danger" as const
  };
}

export function getCustomerApprovalRiskSummary(args: {
  activeVisitCount: number;
  pendingApprovalCount: number;
}) {
  if (args.pendingApprovalCount >= 2) {
    return {
      copy: `${args.pendingApprovalCount} approvals are still blocking release on this relationship.`,
      label: "Approval pileup",
      tone: "danger" as const
    };
  }

  if (args.pendingApprovalCount === 1) {
    return {
      copy: "One estimate is still waiting on customer approval and should be actively chased.",
      label: "Approval waiting",
      tone: "warning" as const
    };
  }

  if (args.activeVisitCount > 0) {
    return {
      copy: "No customer approval is currently blocking the active service thread.",
      label: "Approval clear",
      tone: "success" as const
    };
  }

  return {
    copy: "No active approvals are in flight for this relationship.",
    label: "No approvals",
    tone: "neutral" as const
  };
}

export function getCustomerBalanceRiskSummary(openBalanceCents: number) {
  if (openBalanceCents > 0) {
    return {
      copy: "Revenue is still open on this relationship and closeout follow-through matters now.",
      label: "Money open",
      tone: "brand" as const
    };
  }

  return {
    copy: "No unpaid balance is currently blocking this customer thread.",
    label: "Balance clear",
    tone: "success" as const
  };
}

export function getCustomerFollowUpRiskSummary(args: {
  activeFollowUpVisitCount: number;
  followUpRecoveryOwner: string;
}) {
  if (args.activeFollowUpVisitCount > 0) {
    return {
      copy: `${args.activeFollowUpVisitCount} linked return visit${
        args.activeFollowUpVisitCount === 1 ? "" : "s"
      } still need ${args.followUpRecoveryOwner} to keep the thread moving.`,
      label: "Return work active",
      tone: "warning" as const
    };
  }

  return {
    copy: "No active return-work thread is open on this relationship.",
    label: "No return work",
    tone: "neutral" as const
  };
}

export function getCustomerNextMove(args: {
  activeFollowUpVisits: Array<{ jobId: string; scheduledStartAt: string | null }>;
  activeVisits: Array<{
    estimate: { status: string } | null;
    jobId: string;
    scheduledStartAt: string | null;
  }>;
  customerId: string;
  customerName: string;
  openBalanceCents: number;
}) {
  const promiseRiskVisit =
    args.activeVisits.find((visit) => {
      if (!visit.scheduledStartAt) {
        return false;
      }

      const timestamp = Date.parse(visit.scheduledStartAt);
      return !Number.isNaN(timestamp) && timestamp <= Date.now();
    }) ?? null;

  if (promiseRiskVisit) {
    return {
      copy: "A promised visit needs recovery before customer trust erodes further.",
      href: `/dashboard/visits?jobId=${promiseRiskVisit.jobId}`,
      label: "Recover promised visit"
    };
  }

  const approvalVisit = args.activeVisits.find((visit) => visit.estimate?.status === "sent") ?? null;

  if (approvalVisit) {
    return {
      copy: "An estimate is still out for approval and should be actively pursued.",
      href: `/dashboard/visits?scope=awaiting_approval&query=${encodeURIComponent(args.customerName)}`,
      label: "Follow up approval"
    };
  }

  if (args.activeFollowUpVisits.length) {
    const activeFollowUpVisit = args.activeFollowUpVisits[0];

    if (!activeFollowUpVisit) {
      return {
        copy: "No live service thread is open, so the next best move is to start a fresh visit.",
        href: `/dashboard/visits/new?customerId=${args.customerId}`,
        label: "Start new visit"
      };
    }

    return {
      copy: "Return work is open and should stay attached to the same customer thread.",
      href: `/dashboard/visits?jobId=${activeFollowUpVisit.jobId}`,
      label: "Work return visit"
    };
  }

  if (args.openBalanceCents > 0) {
    return {
      copy: "This relationship has open money and should be moved through closeout.",
      href: `/dashboard/finance?query=${encodeURIComponent(args.customerName)}`,
      label: "Collect open balance"
    };
  }

  if (args.activeVisits.length) {
    const activeVisit = args.activeVisits[0];

    if (!activeVisit) {
      return {
        copy: "No live service thread is open, so the next best move is to start a fresh visit.",
        href: `/dashboard/visits/new?customerId=${args.customerId}`,
        label: "Start new visit"
      };
    }

    return {
      copy: "There is active service work in motion for this customer right now.",
      href: `/dashboard/visits?jobId=${activeVisit.jobId}`,
      label: "Open active visit"
    };
  }

  return {
    copy: "No live service thread is open, so the next best move is to start a fresh visit.",
    href: `/dashboard/visits/new?customerId=${args.customerId}`,
    label: "Start new visit"
  };
}

export function getCustomerThreadActionTarget(args: {
  customerName: string;
  leadVisit: {
    jobId: string;
    vehicleId: string;
  };
  summary: {
    copy: string;
  };
  threadIntent: "approval" | "closeout" | "follow_up" | "invoice" | "monitor" | "visit";
}) {
  switch (args.threadIntent) {
    case "approval":
      return {
        copy: args.summary.copy,
        href: `/dashboard/visits?scope=awaiting_approval&query=${encodeURIComponent(args.customerName)}`,
        label: "Work approval thread",
        tone: "primary" as const
      };
    case "follow_up":
      return {
        copy: args.summary.copy,
        href: `/dashboard/visits?scope=return_visit&query=${encodeURIComponent(args.customerName)}`,
        label: "Work return visits",
        tone: "primary" as const
      };
    case "closeout":
      return {
        copy: args.summary.copy,
        href: `/dashboard/finance?query=${encodeURIComponent(args.customerName)}`,
        label: "Work closeout risk",
        tone: "primary" as const
      };
    case "invoice":
      return {
        copy: args.summary.copy,
        href: `/dashboard/visits?jobId=${args.leadVisit.jobId}`,
        label: "Start invoice",
        tone: "primary" as const
      };
    case "visit":
      return {
        copy: args.summary.copy,
        href: `/dashboard/visits?jobId=${args.leadVisit.jobId}`,
        label: "Work live visit",
        tone: "primary" as const
      };
    default:
      return null;
  }
}

export function getCustomerRiskAction(args: {
  customerDisplayName: string;
  customerNextMove: { copy: string; href: string; label: string } | null;
  openBalanceCents: number;
  pendingApprovalCount: number;
  selectedCustomerFinanceBlocker: { jobId: string } | null;
  selectedCustomerSupplyBlocker: { jobId: string } | null;
  activeFollowUpVisitCount: number;
  promiseRisk: string;
  trustRisk: string;
}) {
  if (args.promiseRisk === "high" || args.trustRisk === "high") {
    return {
      copy: "Customer confidence is at risk. Open the promise-risk slice for this relationship first.",
      href: `/dashboard/visits?scope=promise_risk&query=${encodeURIComponent(args.customerDisplayName)}`,
      label: "Recover promise risk",
      tone: "primary" as const
    };
  }

  if (args.pendingApprovalCount > 0) {
    return {
      copy: "Approval is the active blocker on this relationship. Work approval follow-up before creating new work.",
      href: `/dashboard/visits?scope=awaiting_approval&query=${encodeURIComponent(args.customerDisplayName)}`,
      label: "Work approval thread",
      tone: "primary" as const
    };
  }

  if (args.selectedCustomerSupplyBlocker) {
    return {
      copy: "Supply is blocking an active visit on this relationship. Clear the parts or inventory issue before branching into anything new.",
      href: `/dashboard/visits/${args.selectedCustomerSupplyBlocker.jobId}/inventory`,
      label: "Unblock supply",
      tone: "primary" as const
    };
  }

  if (args.activeFollowUpVisitCount > 0) {
    return {
      copy: "Return-work recovery is active here. Keep the follow-up chain moving before branching into new visits.",
      href: `/dashboard/visits?scope=return_visit&query=${encodeURIComponent(args.customerDisplayName)}`,
      label: "Work return visits",
      tone: "primary" as const
    };
  }

  if (args.selectedCustomerFinanceBlocker || args.openBalanceCents > 0) {
    return {
      copy: "Money is still open on this relationship. Move into closeout before treating this like a clean customer thread.",
      href: args.selectedCustomerFinanceBlocker
        ? `/dashboard/visits/${args.selectedCustomerFinanceBlocker.jobId}/invoice`
        : "/dashboard/finance?stage=reminder_due",
      label: "Work closeout risk",
      tone: "primary" as const
    };
  }

  if (args.customerNextMove) {
    return {
      copy: args.customerNextMove.copy,
      href: args.customerNextMove.href,
      label: args.customerNextMove.label,
      tone: "primary" as const
    };
  }

  return null;
}