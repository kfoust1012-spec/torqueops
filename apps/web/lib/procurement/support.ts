import { buildProcurementWorkspaceHref, type ProcurementWorkspaceView } from "./workspace";

type ProcurementDefaultViewInput = {
  manualAttentionCount: number;
  openCarts: number;
  openPurchaseOrders: number;
  openRequests: number;
  providerAttentionCount: number;
};

type ProcurementPriorityActionInput = ProcurementDefaultViewInput;

type SupplyPriorityActionInput = ProcurementPriorityActionInput & {
  draftTransferCount: number;
  lowStockCount: number;
  reorderDueCount: number;
  vanAttentionCount: number;
};

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function buildSupplyInventoryHref(input: {
  lowStock?: boolean;
  view: "catalog" | "control" | "locations" | "movement";
}) {
  const params = new URLSearchParams({ view: input.view });

  if (input.lowStock) {
    params.set("lowStock", "1");
  }

  return `/dashboard/supply/inventory?${params.toString()}`;
}

export function getProcurementDefaultView(input: ProcurementDefaultViewInput) {
  if (input.manualAttentionCount > 0) {
    return "attention" satisfies ProcurementWorkspaceView;
  }

  if (input.openRequests > 0) {
    return "requests" satisfies ProcurementWorkspaceView;
  }

  if (input.openCarts > 0) {
    return "carts" satisfies ProcurementWorkspaceView;
  }

  if (input.openPurchaseOrders > 0) {
    return "orders" satisfies ProcurementWorkspaceView;
  }

  return "setup" satisfies ProcurementWorkspaceView;
}

export function getProcurementPriorityAction(input: ProcurementPriorityActionInput) {
  if (input.manualAttentionCount > 0) {
    return {
      description:
        "Work uncovered demand first so jobs stop waiting on manual routing or a supplier decision.",
      eyebrow: "Start here",
      primaryLabel: "Open attention",
      primaryView: "attention" as const,
      title: `${formatCount(input.manualAttentionCount, "line")} still need supplier coverage`
    };
  }

  if (input.openRequests > 0) {
    return {
      description:
        "These requests still need quotes, routing, or downstream movement into carts and purchase orders.",
      eyebrow: "Next up",
      primaryLabel: "Open requests",
      primaryView: "requests" as const,
      title: `${formatCount(input.openRequests, "request")} are waiting to be worked`
    };
  }

  if (input.openCarts > 0) {
    return {
      description:
        "Supplier carts are staged and ready for manual ordering or purchase-order conversion.",
      eyebrow: "Ready to order",
      primaryLabel: "Open carts",
      primaryView: "carts" as const,
      title: `${formatCount(input.openCarts, "cart")} are ready for the next ordering step`
    };
  }

  if (input.openPurchaseOrders > 0) {
    return {
      description:
        "Purchase orders are live and still need ordering, receiving, install follow-through, or returns work.",
      eyebrow: "In progress",
      primaryLabel: "Open orders",
      primaryView: "orders" as const,
      title: `${formatCount(input.openPurchaseOrders, "purchase order")} are still active`
    };
  }

  if (input.providerAttentionCount > 0) {
    return {
      description:
        "Demand is quiet, so this is the right time to clean up provider mappings, credentials, and fallback setup.",
      eyebrow: "Setup next",
      primaryLabel: "Review setup",
      primaryView: "setup" as const,
      title: `${formatCount(input.providerAttentionCount, "setup issue")} should be cleaned up`
    };
  }

  return {
    description:
      "No queues are blocked right now. Use setup to tighten provider coverage and reusable supplies before the next wave of demand.",
    eyebrow: "Desk clear",
    primaryLabel: "Open setup",
    primaryView: "setup" as const,
    title: "The parts desk is under control"
  };
}

export function getSupplyPriorityAction(input: SupplyPriorityActionInput) {
  if (input.manualAttentionCount > 0) {
    return {
      description:
        "Uncovered demand is still blocking visits. Route supplier coverage first so field work stops waiting on manual parts decisions.",
      eyebrow: "Supply priority",
      primaryHref: buildProcurementWorkspaceHref({ view: "attention" }),
      primaryLabel: "Open uncovered demand",
      secondaryHref: "/dashboard/visits?scope=supply_blocked",
      secondaryLabel: "Review supply-blocked visits",
      title: `${formatCount(input.manualAttentionCount, "line")} are still uncovered`,
      tone: "warning" as const
    };
  }

  if (input.reorderDueCount > 0) {
    return {
      description:
        "Reorder-critical stock is now the fastest way to create new supply blockers. Fix critical balances before they spill into requests and dispatch.",
      eyebrow: "Supply priority",
      primaryHref: buildSupplyInventoryHref({ lowStock: true, view: "catalog" }),
      primaryLabel: "Open low stock",
      secondaryHref: buildSupplyInventoryHref({ view: "movement" }),
      secondaryLabel: "Review transfers",
      title: `${formatCount(input.reorderDueCount, "balance")} need replenishment now`,
      tone: "danger" as const
    };
  }

  if (input.openRequests > 0) {
    return {
      description:
        "Fresh sourcing demand is waiting to be quoted, routed, or staged into carts before technicians lose momentum.",
      eyebrow: "Supply priority",
      primaryHref: buildProcurementWorkspaceHref({ view: "requests" }),
      primaryLabel: "Open requests",
      secondaryHref: "/dashboard/dispatch",
      secondaryLabel: "Open dispatch",
      title: `${formatCount(input.openRequests, "request")} are waiting to be worked`,
      tone: "brand" as const
    };
  }

  if (input.draftTransferCount > 0) {
    return {
      description:
        "Stock is already allocated but not yet moving. Ship or clean drafts so van and shop balances stay believable.",
      eyebrow: "Supply priority",
      primaryHref: buildSupplyInventoryHref({ view: "movement" }),
      primaryLabel: "Manage transfers",
      secondaryHref: buildSupplyInventoryHref({ view: "locations" }),
      secondaryLabel: "Review locations",
      title: `${formatCount(input.draftTransferCount, "draft transfer")} still need shipment`,
      tone: "warning" as const
    };
  }

  if (input.openCarts > 0) {
    return {
      description:
        "Supplier carts are staged and ready for the next ordering step. Keep them moving before demand stalls in the desk.",
      eyebrow: "Supply priority",
      primaryHref: buildProcurementWorkspaceHref({ view: "carts" }),
      primaryLabel: "Open carts",
      secondaryHref: buildProcurementWorkspaceHref({ view: "orders" }),
      secondaryLabel: "Open orders",
      title: `${formatCount(input.openCarts, "cart")} are ready to order`,
      tone: "brand" as const
    };
  }

  if (input.lowStockCount > 0 || input.vanAttentionCount > 0) {
    return {
      description:
        "Sourcing is quiet enough to tighten stock control before low-balance rows become real visit blockers.",
      eyebrow: "Supply priority",
      primaryHref: buildSupplyInventoryHref({ lowStock: true, view: "control" }),
      primaryLabel: "Open stock control",
      secondaryHref: buildSupplyInventoryHref({ view: "locations" }),
      secondaryLabel: "Review locations",
      title: `${formatCount(input.lowStockCount, "low-stock row")} and ${formatCount(input.vanAttentionCount, "van alert")} need review`,
      tone: "warning" as const
    };
  }

  if (input.openPurchaseOrders > 0) {
    return {
      description:
        "Purchase orders are active and should stay traceable through receiving, install handoff, and returns.",
      eyebrow: "Supply priority",
      primaryHref: buildProcurementWorkspaceHref({ view: "orders" }),
      primaryLabel: "Open orders",
      secondaryHref: buildProcurementWorkspaceHref({ view: "setup" }),
      secondaryLabel: "Review setup",
      title: `${formatCount(input.openPurchaseOrders, "purchase order")} are still in flight`,
      tone: "brand" as const
    };
  }

  if (input.providerAttentionCount > 0) {
    return {
      description:
        "Demand is under control, so clean provider setup and mappings before the next request wave arrives.",
      eyebrow: "Supply priority",
      primaryHref: buildProcurementWorkspaceHref({ view: "setup" }),
      primaryLabel: "Review setup",
      secondaryHref: "/dashboard/supply/integrations",
      secondaryLabel: "Open integrations",
      title: `${formatCount(input.providerAttentionCount, "setup issue")} should be cleaned up`,
      tone: "neutral" as const
    };
  }

  return {
    description:
      "Sourcing and stock control are both stable. Use the desk to keep readiness high before new field demand arrives.",
    eyebrow: "Supply priority",
    primaryHref: buildProcurementWorkspaceHref({ view: "requests" }),
    primaryLabel: "Open requests",
    secondaryHref: buildSupplyInventoryHref({ view: "control" }),
    secondaryLabel: "Open stock control",
    title: "Supply is under control",
    tone: "success" as const
  };
}