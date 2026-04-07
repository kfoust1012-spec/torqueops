import type { JobStatus } from "@mobile-mechanic/types";

type ShopmonkeyLifecycleInput = {
  authorized: boolean;
  authorizedDate?: string | null | undefined;
  completedDate?: string | null | undefined;
  createdDate: string;
  deleted: boolean;
  fullyPaidDate?: string | null | undefined;
  invoiced: boolean;
  orderCreatedDate?: string | null | undefined;
  paid: boolean;
  scheduledStartAt?: string | null | undefined;
  updatedDate?: string | null | undefined;
};

type ImportedJobLifecycle = {
  completedAt: string | null;
  startedAt: string | null;
  status: JobStatus;
};

function getImportStartTimestamp(input: ShopmonkeyLifecycleInput) {
  return input.authorizedDate ?? input.orderCreatedDate ?? input.createdDate;
}

export function deriveShopmonkeyImportedJobLifecycle(
  input: ShopmonkeyLifecycleInput
): ImportedJobLifecycle {
  if (input.deleted) {
    return {
      completedAt: null,
      startedAt: null,
      status: "canceled"
    };
  }

  if (input.completedDate || input.invoiced || input.paid) {
    return {
      completedAt: input.completedDate ?? input.fullyPaidDate ?? input.updatedDate ?? null,
      startedAt: getImportStartTimestamp(input),
      status: "completed"
    };
  }

  if (input.authorized) {
    return {
      completedAt: null,
      startedAt: getImportStartTimestamp(input),
      status: "repairing"
    };
  }

  if (input.scheduledStartAt) {
    return {
      completedAt: null,
      startedAt: null,
      status: "scheduled"
    };
  }

  return {
    completedAt: null,
    startedAt: null,
    status: "new"
  };
}
