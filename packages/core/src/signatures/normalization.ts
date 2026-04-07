export const DEFAULT_ESTIMATE_APPROVAL_STATEMENT =
  "I authorize the listed estimate work and understand additional work requires a new approval.";

export function normalizeSignerName(value: string): string {
  return value.trim();
}

export function normalizeApprovalStatement(value: string): string {
  return value.trim();
}
