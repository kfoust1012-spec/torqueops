import type {
  EstimateSection,
  EstimateSectionDetail,
  EstimateVehicleContextSnapshot,
  EstimateWorkspaceLineItem,
  EstimateWorkspaceSummary,
  Vehicle
} from "@mobile-mechanic/types";

import { getVehicleDisplayName } from "../vehicles/formatting";

export function buildEstimateVehicleContextSnapshot(vehicle: Vehicle): EstimateVehicleContextSnapshot {
  return {
    vehicleId: vehicle.id,
    displayName: getVehicleDisplayName(vehicle),
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    engine: vehicle.engine,
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    odometer: vehicle.odometer
  };
}

export function groupEstimateWorkspaceLineItems(input: {
  lineItems: EstimateWorkspaceLineItem[];
  sections: EstimateSection[];
}): {
  sections: EstimateSectionDetail[];
  ungroupedLineItems: EstimateWorkspaceLineItem[];
} {
  const lineItemsBySectionId = new Map<string, EstimateWorkspaceLineItem[]>();
  const ungroupedLineItems: EstimateWorkspaceLineItem[] = [];

  for (const lineItem of input.lineItems) {
    if (!lineItem.estimateSectionId) {
      ungroupedLineItems.push(lineItem);
      continue;
    }

    const lineItemsForSection = lineItemsBySectionId.get(lineItem.estimateSectionId) ?? [];
    lineItemsForSection.push(lineItem);
    lineItemsBySectionId.set(lineItem.estimateSectionId, lineItemsForSection);
  }

  return {
    sections: input.sections
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((section) => ({
        section,
        lineItems: (lineItemsBySectionId.get(section.id) ?? []).slice().sort((left, right) => left.position - right.position)
      })),
    ungroupedLineItems: ungroupedLineItems.slice().sort((left, right) => left.position - right.position)
  };
}

export function calculateEstimateWorkspaceSummary(input: {
  sections: EstimateSectionDetail[];
  ungroupedLineItems: EstimateWorkspaceLineItem[];
}): EstimateWorkspaceSummary {
  const allLineItems = [
    ...input.ungroupedLineItems,
    ...input.sections.flatMap((section) => section.lineItems)
  ];

  const laborLineCount = allLineItems.filter((lineItem) => lineItem.itemType === "labor").length;
  const partLineCount = allLineItems.filter((lineItem) => lineItem.itemType === "part").length;
  const feeLineCount = allLineItems.filter((lineItem) => lineItem.itemType === "fee").length;

  return {
    sectionCount: input.sections.length,
    lineItemCount: allLineItems.length,
    laborLineCount,
    partLineCount,
    feeLineCount,
    totalLaborHours: allLineItems
      .filter((lineItem) => lineItem.itemType === "labor")
      .reduce((sum, lineItem) => sum + lineItem.quantity, 0)
  };
}
