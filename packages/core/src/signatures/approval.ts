import type { EstimateStatus } from "@mobile-mechanic/types";

export function canEstimateBeApproved(status: EstimateStatus): boolean {
  return status === "sent";
}

export function isEstimateApprovalComplete(input: {
  approvalStatement: string | null;
  approvedByName: string | null;
  approvedSignatureId: string | null;
  approvedAt: string | null;
}) {
  return Boolean(
    input.approvalStatement &&
      input.approvedByName &&
      input.approvedSignatureId &&
      input.approvedAt
  );
}
