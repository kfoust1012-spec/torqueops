import type { InvoiceStatus } from "@mobile-mechanic/types";

export function canInvoiceAcceptPayments(status: InvoiceStatus): boolean {
  return status === "issued" || status === "partially_paid";
}

export function isInvoicePaymentTerminal(status: InvoiceStatus): boolean {
  return status === "paid" || status === "void";
}
