import type { PartLifecycleStatus, PartRequestLine, PurchaseOrderLine } from "@mobile-mechanic/types";

export function calculatePartLifecycleStatus(input: {
  quantityOrdered: number;
  quantityReceived: number;
  quantityInstalled: number;
  quantityReturned: number;
  quantityCoreDue: number;
  quantityCoreReturned: number;
}): PartLifecycleStatus {
  if (input.quantityCoreDue > input.quantityCoreReturned) {
    return "core_due";
  }

  if (input.quantityCoreDue > 0 && input.quantityCoreReturned >= input.quantityCoreDue) {
    return "core_returned";
  }

  if (input.quantityReturned > 0) {
    return "returned";
  }

  if (input.quantityInstalled > 0) {
    return "installed";
  }

  if (input.quantityReceived > 0) {
    return "received";
  }

  if (input.quantityOrdered > 0) {
    return "ordered";
  }

  return "quoted";
}

export function isPartRequestLineFulfilled(
  line: Pick<PartRequestLine, "quantityRequested" | "quantityInstalled">
) {
  return line.quantityInstalled >= line.quantityRequested;
}

export function isPurchaseOrderReceivable(
  line: Pick<PurchaseOrderLine, "quantityOrdered" | "quantityReceived">
) {
  return line.quantityReceived < line.quantityOrdered;
}

export function isReturnAllowed(
  line: Pick<PurchaseOrderLine, "quantityReceived" | "quantityReturned">
) {
  return line.quantityReturned < line.quantityReceived;
}

export function isCoreReturnOutstanding(
  line: Pick<PurchaseOrderLine, "quantityCoreDue" | "quantityCoreReturned">
) {
  return line.quantityCoreDue > line.quantityCoreReturned;
}
