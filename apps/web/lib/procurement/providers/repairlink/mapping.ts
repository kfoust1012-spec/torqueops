import {
  buildRepairLinkSearchContext,
  buildRepairLinkVehicleContext
} from "@mobile-mechanic/core";
import type { RepairLinkSearchContext } from "@mobile-mechanic/types";

import type { ProcurementProviderSearchContextInput } from "../types";

export function buildRepairLinkProviderSearchContext(
  input: ProcurementProviderSearchContextInput
): RepairLinkSearchContext {
  if (!input.vehicle.vin) {
    throw new Error("RepairLink search requires a VIN.");
  }

  return buildRepairLinkSearchContext({
    requestId: input.requestId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    lines: input.lines.map((line) => ({
      description: line.description,
      id: line.id,
      partNumber: line.partNumber
    })),
    selectedPartRequestLineIds: input.selectedPartRequestLineIds,
    selectedDealerMappingIds: input.selectedSupplierMappingIds ?? [],
    vehicle: buildRepairLinkVehicleContext({
      engine: input.vehicle.engine,
      licensePlate: input.vehicle.licensePlate,
      make: input.vehicle.make,
      model: input.vehicle.model,
      vin: input.vehicle.vin,
      year: input.vehicle.year
    })
  });
}
