import { describe, expect, it } from "vitest";

import {
  getProcurementDefaultView,
  getProcurementPriorityAction,
  getSupplyPriorityAction
} from "./support";

describe("procurement support helpers", () => {
  it("chooses the procurement default view by queue urgency", () => {
    expect(
      getProcurementDefaultView({
        manualAttentionCount: 1,
        openCarts: 3,
        openPurchaseOrders: 2,
        openRequests: 4,
        providerAttentionCount: 0
      })
    ).toBe("attention");

    expect(
      getProcurementDefaultView({
        manualAttentionCount: 0,
        openCarts: 0,
        openPurchaseOrders: 0,
        openRequests: 2,
        providerAttentionCount: 0
      })
    ).toBe("requests");
  });

  it("prioritizes procurement attention over downstream queues", () => {
    expect(
      getProcurementPriorityAction({
        manualAttentionCount: 2,
        openCarts: 5,
        openPurchaseOrders: 4,
        openRequests: 3,
        providerAttentionCount: 1
      })
    ).toMatchObject({
      primaryView: "attention",
      primaryLabel: "Open attention"
    });
  });

  it("prioritizes supply replenishment before open requests once coverage is clear", () => {
    expect(
      getSupplyPriorityAction({
        draftTransferCount: 1,
        lowStockCount: 5,
        manualAttentionCount: 0,
        openCarts: 2,
        openPurchaseOrders: 3,
        openRequests: 4,
        providerAttentionCount: 1,
        reorderDueCount: 2,
        vanAttentionCount: 1
      })
    ).toMatchObject({
      primaryLabel: "Open low stock",
      tone: "danger"
    });
  });

  it("falls back to supply control when sourcing and stock are stable", () => {
    expect(
      getSupplyPriorityAction({
        draftTransferCount: 0,
        lowStockCount: 0,
        manualAttentionCount: 0,
        openCarts: 0,
        openPurchaseOrders: 0,
        openRequests: 0,
        providerAttentionCount: 0,
        reorderDueCount: 0,
        vanAttentionCount: 0
      })
    ).toMatchObject({
      primaryLabel: "Open requests",
      secondaryLabel: "Open stock control",
      tone: "success"
    });
  });
});