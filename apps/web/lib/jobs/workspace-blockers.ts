import type { JobListItem } from "@mobile-mechanic/types";
import type { TechnicianPaymentHandoffSummary } from "../invoices/payment-handoffs";

import {
  getCollectionsExceptionOwnershipSummary,
  getEstimateExceptionOwnershipSummary,
  getSupplyExceptionOwnershipSummary,
  type ExceptionOwnershipSummary
} from "./exception-ownership";

type WorkspaceBlockerJob = Pick<
  JobListItem,
  "customerDisplayName" | "id" | "status" | "title" | "vehicleDisplayName"
>;

type WorkspaceEstimate = {
  sentAt?: string | null | undefined;
  status: string;
};

type WorkspaceInvoice = {
  balanceDueCents: number;
  status: string;
  updatedAt: string;
};

export type WorkspaceBlockerItem = {
  customerDisplayName: string;
  estimateOwnership: ExceptionOwnershipSummary | null;
  financeBalanceDueCents: number;
  financeHandoffSummary: TechnicianPaymentHandoffSummary | null;
  openPaymentHandoffCount: number;
  financeOwnership: ExceptionOwnershipSummary | null;
  hasApprovedRelease: boolean;
  inventoryIssueCount: number;
  jobId: string;
  openPartRequestCount: number;
  supplyBlockerCount: number;
  supplyOwnership: ExceptionOwnershipSummary;
  title: string;
  vehicleDisplayName: string;
};

export type WorkspaceBlockerSummary = {
  approvedReleaseCount: number;
  approvedReleaseItems: WorkspaceBlockerItem[];
  blockedJobCount: number;
  financeBlockedCount: number;
  financeBlockedItems: WorkspaceBlockerItem[];
  items: WorkspaceBlockerItem[];
  staleApprovalCount: number;
  supplyBlockedCount: number;
  supplyBlockedItems: WorkspaceBlockerItem[];
};

function compareWorkspaceBlockerItems(left: WorkspaceBlockerItem, right: WorkspaceBlockerItem) {
  if (left.supplyBlockerCount !== right.supplyBlockerCount) {
    return right.supplyBlockerCount - left.supplyBlockerCount;
  }

  if (left.openPaymentHandoffCount !== right.openPaymentHandoffCount) {
    return right.openPaymentHandoffCount - left.openPaymentHandoffCount;
  }

  if (left.financeBalanceDueCents !== right.financeBalanceDueCents) {
    return right.financeBalanceDueCents - left.financeBalanceDueCents;
  }

  return left.title.localeCompare(right.title);
}

export function buildWorkspaceBlockerSummary(input: {
  estimatesByJobId: ReadonlyMap<string, WorkspaceEstimate | null | undefined>;
  inventoryIssuesByJobId: ReadonlyMap<string, number>;
  invoicesByJobId: ReadonlyMap<string, WorkspaceInvoice | null | undefined>;
  jobs: WorkspaceBlockerJob[];
  paymentHandoffSummaryByJobId?: ReadonlyMap<string, TechnicianPaymentHandoffSummary>;
  openPaymentHandoffCountByJobId?: ReadonlyMap<string, number>;
  openPartRequestsByJobId: ReadonlyMap<string, number>;
}): WorkspaceBlockerSummary {
  const items: WorkspaceBlockerItem[] = input.jobs
    .map((job) => {
      const estimate = input.estimatesByJobId.get(job.id) ?? null;
      const invoice = input.invoicesByJobId.get(job.id) ?? null;
      const financeHandoffSummary = input.paymentHandoffSummaryByJobId?.get(job.id) ?? null;
      const openPaymentHandoffCount = input.openPaymentHandoffCountByJobId?.get(job.id) ?? 0;
      const openPartRequestCount = input.openPartRequestsByJobId.get(job.id) ?? 0;
      const inventoryIssueCount = input.inventoryIssuesByJobId.get(job.id) ?? 0;
      const estimateOwnership: ExceptionOwnershipSummary | null = estimate
        ? (getEstimateExceptionOwnershipSummary({
            sentAt: estimate.sentAt ?? null,
            status: estimate.status
          }) as ExceptionOwnershipSummary)
        : null;
      const financeOwnership: ExceptionOwnershipSummary | null = invoice
        ? (getCollectionsExceptionOwnershipSummary({
            balanceDueCents: invoice.balanceDueCents,
            status: invoice.status,
            updatedAt: invoice.updatedAt
          }) as ExceptionOwnershipSummary)
        : null;
      const supplyOwnership = getSupplyExceptionOwnershipSummary({
        inventoryIssueCount,
        openPartRequestCount
      }) as ExceptionOwnershipSummary;

      return {
        customerDisplayName: job.customerDisplayName,
        estimateOwnership,
        financeBalanceDueCents: invoice?.balanceDueCents ?? 0,
        financeHandoffSummary,
        financeOwnership,
        hasApprovedRelease: estimateOwnership?.owner === "Dispatch",
        inventoryIssueCount,
        jobId: job.id,
        openPaymentHandoffCount,
        openPartRequestCount,
        supplyBlockerCount: inventoryIssueCount + openPartRequestCount,
        supplyOwnership,
        title: job.title,
        vehicleDisplayName: job.vehicleDisplayName
      };
    })
    .sort(compareWorkspaceBlockerItems);

  const approvedReleaseItems = items.filter((item) => item.hasApprovedRelease);
  const supplyBlockedItems = items.filter((item) => item.supplyBlockerCount > 0);
  const financeBlockedItems = items.filter(
    (item) => item.openPaymentHandoffCount > 0 || item.financeOwnership?.owner === "Finance"
  );
  const staleApprovalCount = items.filter((item) => item.estimateOwnership?.label === "Stale approval").length;
  const blockedJobIds = new Set(
    items
      .filter(
        (item) =>
          item.supplyBlockerCount > 0 ||
          item.openPaymentHandoffCount > 0 ||
          item.financeOwnership?.owner === "Finance"
      )
      .map((item) => item.jobId)
  );

  return {
    approvedReleaseCount: approvedReleaseItems.length,
    approvedReleaseItems,
    blockedJobCount: blockedJobIds.size,
    financeBlockedCount: financeBlockedItems.length,
    financeBlockedItems,
    items,
    staleApprovalCount,
    supplyBlockedCount: supplyBlockedItems.length,
    supplyBlockedItems
  };
}
