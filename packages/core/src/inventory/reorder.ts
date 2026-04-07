import type { InventoryReorderStatus } from "@mobile-mechanic/types";

export function calculateReorderStatus(input: {
  availableQuantity: number;
  lowStockThresholdQuantity: number | null;
  reorderPointQuantity: number | null;
}): InventoryReorderStatus {
  if (
    typeof input.reorderPointQuantity === "number" &&
    input.availableQuantity <= input.reorderPointQuantity
  ) {
    return "reorder_due";
  }

  if (
    typeof input.lowStockThresholdQuantity === "number" &&
    input.availableQuantity <= input.lowStockThresholdQuantity
  ) {
    return "low_stock";
  }

  return "ok";
}

export function isLowStock(status: InventoryReorderStatus) {
  return status === "low_stock" || status === "reorder_due";
}

export function isReorderDue(status: InventoryReorderStatus) {
  return status === "reorder_due";
}

export function suggestReorderQuantity(input: {
  availableQuantity: number;
  preferredReorderQuantity: number | null;
  reorderPointQuantity: number | null;
}) {
  if (typeof input.preferredReorderQuantity === "number" && input.preferredReorderQuantity > 0) {
    return input.preferredReorderQuantity;
  }

  if (typeof input.reorderPointQuantity === "number" && input.availableQuantity < input.reorderPointQuantity) {
    return input.reorderPointQuantity - input.availableQuantity;
  }

  return 0;
}
