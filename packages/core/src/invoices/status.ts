import type { InvoiceStatus } from "@mobile-mechanic/types";

const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "void"],
  issued: ["void"],
  partially_paid: ["void"],
  paid: [],
  void: []
};

export function getAllowedNextInvoiceStatuses(status: InvoiceStatus): InvoiceStatus[] {
  return allowedTransitions[status];
}

export function canTransitionInvoiceStatus(fromStatus: InvoiceStatus, toStatus: InvoiceStatus): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  return allowedTransitions[fromStatus].includes(toStatus);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return allowedTransitions[status].length === 0;
}
