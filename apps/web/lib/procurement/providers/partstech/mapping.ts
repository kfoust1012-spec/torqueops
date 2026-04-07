import {
  buildPartsTechSearchTerms,
  buildPartsTechVehicleContext
} from "@mobile-mechanic/core";
import type { PartsTechSearchContext } from "@mobile-mechanic/types";

import type { ProcurementProviderSearchContextInput } from "../types";

export function buildPartsTechSearchContext(
  input: ProcurementProviderSearchContextInput
): PartsTechSearchContext {
  return {
    requestId: input.requestId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    searchTerms: buildPartsTechSearchTerms(input.lines),
    selectedPartRequestLineIds:
      input.selectedPartRequestLineIds && input.selectedPartRequestLineIds.length
        ? input.selectedPartRequestLineIds
        : input.lines.map((line) => line.id),
    vehicle: buildPartsTechVehicleContext(input.vehicle)
  };
}
