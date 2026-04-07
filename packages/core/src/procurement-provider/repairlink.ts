import type {
  PartRequestLine,
  ProcurementProviderAccount,
  RepairLinkSearchContext,
  RepairLinkVehicleContext
} from "@mobile-mechanic/types";

export const REPAIRLINK_LOGIN_URL = "https://www.repairlinkshop.com/Account/Login";

export function buildRepairLinkDisplayName(
  account?: Pick<ProcurementProviderAccount, "displayName"> | null
) {
  return account?.displayName?.trim() || "RepairLink";
}

export function buildRepairLinkVehicleContext(input: {
  engine?: string | null | undefined;
  licensePlate?: string | null | undefined;
  make?: string | null | undefined;
  model?: string | null | undefined;
  vin: string;
  year?: number | null | undefined;
}): RepairLinkVehicleContext {
  return {
    year: input.year ?? null,
    make: input.make ?? null,
    model: input.model ?? null,
    engine: input.engine ?? null,
    vin: input.vin.trim().toUpperCase(),
    licensePlate: input.licensePlate ?? null
  };
}

export function buildRepairLinkSearchTerms(
  lines: Array<Pick<PartRequestLine, "description" | "partNumber">>
) {
  const terms = new Set<string>();

  for (const line of lines) {
    const partNumber = line.partNumber?.trim();
    if (partNumber) {
      terms.add(partNumber);
    }

    const description = line.description.trim();
    if (description) {
      terms.add(description);
    }
  }

  return [...terms];
}

export function buildRepairLinkSearchContext(input: {
  estimateId?: string | null | undefined;
  jobId: string;
  lines: Array<Pick<PartRequestLine, "description" | "id" | "partNumber">>;
  requestId: string;
  selectedPartRequestLineIds?: string[] | undefined;
  selectedDealerMappingIds: string[];
  vehicle: RepairLinkVehicleContext;
  fallbackMode?: "manual_capture" | "manual_link_out" | undefined;
}): RepairLinkSearchContext {
  return {
    requestId: input.requestId,
    jobId: input.jobId,
    estimateId: input.estimateId ?? null,
    searchTerms: buildRepairLinkSearchTerms(input.lines),
    selectedPartRequestLineIds:
      input.selectedPartRequestLineIds && input.selectedPartRequestLineIds.length
        ? input.selectedPartRequestLineIds
        : input.lines.map((line) => line.id),
    selectedDealerMappingIds: input.selectedDealerMappingIds,
    vehicle: input.vehicle,
    fallbackMode: input.fallbackMode ?? "manual_capture"
  };
}
