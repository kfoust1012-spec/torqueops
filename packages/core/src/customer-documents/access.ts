import type {
  CustomerDocumentLinkStatus,
  EstimateStatus,
  InvoiceStatus
} from "@mobile-mechanic/types";

export const defaultCustomerDocumentLinkTtlHours = 168;

export function getCustomerDocumentLinkExpiresAt(
  now = new Date(),
  ttlHours = defaultCustomerDocumentLinkTtlHours
) {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
}

export function isCustomerDocumentLinkExpired(input: {
  status: CustomerDocumentLinkStatus;
  expiresAt: string;
}) {
  if (input.status !== "active") {
    return input.status === "expired";
  }

  return new Date(input.expiresAt).getTime() <= Date.now();
}

export function canCustomerApproveEstimate(status: EstimateStatus, linkStatus: CustomerDocumentLinkStatus) {
  return status === "sent" && linkStatus === "active";
}

export function canCustomerDeclineEstimate(status: EstimateStatus, linkStatus: CustomerDocumentLinkStatus) {
  return status === "sent" && linkStatus === "active";
}

export function canCustomerPayInvoice(
  status: InvoiceStatus,
  balanceDueCents: number,
  linkStatus: CustomerDocumentLinkStatus
) {
  return (status === "issued" || status === "partially_paid") && balanceDueCents > 0 && linkStatus === "active";
}