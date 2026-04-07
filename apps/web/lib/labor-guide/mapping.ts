import type { CreateEstimateLineItemInput, LaborGuideSuggestedOperation } from "@mobile-mechanic/types";

function formatSuggestedHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1).replace(/\.0$/, "");
}

function formatSuggestedHourLabel(hours: number): string {
  const formattedHours = formatSuggestedHours(hours);
  return `${formattedHours} ${hours === 1 ? "hour" : "hours"}`;
}

export function buildSuggestedLaborLineItemDescription(input: {
  description: string | null;
  suggestedHours: number;
  rationale: string | null;
}): string {
  return [
    input.description,
    `Suggested labor time: ${formatSuggestedHourLabel(input.suggestedHours)}.`,
    input.rationale
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildSuggestedLaborLineItemDefaults(input: {
  name: string;
  description: string | null;
  suggestedHours: number;
  rationale: string | null;
}): CreateEstimateLineItemInput {
  return {
    itemType: "labor",
    name: input.name,
    description: buildSuggestedLaborLineItemDescription(input),
    quantity: input.suggestedHours,
    unitPriceCents: 0,
    taxable: true
  };
}

export function mapSuggestedOperationToLineItemInput(
  operation: LaborGuideSuggestedOperation
): CreateEstimateLineItemInput {
  return operation.lineItemDefaults;
}