import type { EstimateLineItem, EstimateWorkspacePricingDefaults } from "@mobile-mechanic/types";

export const DEFAULT_LABOR_RATE_CENTS = 15_000;
export const DEFAULT_PART_SELL_MULTIPLIER_BASIS_POINTS = 14_000;
export const PART_SELL_PRICE_ROUNDING_INCREMENT_CENTS = 25;

type PricingLineItem = Pick<
  EstimateLineItem,
  "actualCostCents" | "estimatedCostCents" | "itemType" | "quantity" | "unitPriceCents"
>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getMedian(values: number[]) {
  if (!values.length) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? null;
  }

  const lowerValue = sortedValues[middleIndex - 1];
  const upperValue = sortedValues[middleIndex];

  if (lowerValue === undefined || upperValue === undefined) {
    return null;
  }

  return Math.round((lowerValue + upperValue) / 2);
}

function resolveEstimatedUnitCostCents(lineItem: PricingLineItem) {
  const resolvedTotalCostCents = lineItem.actualCostCents ?? lineItem.estimatedCostCents;

  if (typeof resolvedTotalCostCents !== "number") {
    return null;
  }

  const quantity = Number(lineItem.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return Math.round(resolvedTotalCostCents / quantity);
}

export function resolveEstimateWorkspacePricingDefaults(
  lineItems: PricingLineItem[]
): EstimateWorkspacePricingDefaults {
  const laborRateCandidates = lineItems
    .filter(
      (lineItem) =>
        lineItem.itemType === "labor" &&
        Number.isFinite(lineItem.quantity) &&
        lineItem.quantity > 0 &&
        lineItem.unitPriceCents > 0
    )
    .map((lineItem) => lineItem.unitPriceCents);
  const inferredLaborRateCents = getMedian(laborRateCandidates);

  const partSellMultiplierCandidates = lineItems
    .filter((lineItem) => lineItem.itemType === "part" && lineItem.unitPriceCents > 0)
    .map((lineItem) => {
      const estimatedUnitCostCents = resolveEstimatedUnitCostCents(lineItem);

      if (!estimatedUnitCostCents || estimatedUnitCostCents <= 0) {
        return null;
      }

      return clamp(Math.round((lineItem.unitPriceCents * 10_000) / estimatedUnitCostCents), 11_000, 30_000);
    })
    .filter((value): value is number => typeof value === "number");
  const inferredPartSellMultiplierBasisPoints = getMedian(partSellMultiplierCandidates);

  return {
    laborRateCents: inferredLaborRateCents ?? DEFAULT_LABOR_RATE_CENTS,
    laborRateSource: inferredLaborRateCents ? "estimate_history" : "fallback",
    partSellMultiplierBasisPoints:
      inferredPartSellMultiplierBasisPoints ?? DEFAULT_PART_SELL_MULTIPLIER_BASIS_POINTS,
    partSellMultiplierSource: inferredPartSellMultiplierBasisPoints ? "estimate_history" : "fallback"
  };
}

export function calculateSuggestedPartUnitPriceCents(
  unitCostCents: number | null | undefined,
  partSellMultiplierBasisPoints: number
) {
  if (typeof unitCostCents !== "number" || unitCostCents <= 0) {
    return 0;
  }

  const rawSuggestedSellPriceCents = Math.round((unitCostCents * partSellMultiplierBasisPoints) / 10_000);
  return Math.ceil(rawSuggestedSellPriceCents / PART_SELL_PRICE_ROUNDING_INCREMENT_CENTS) *
    PART_SELL_PRICE_ROUNDING_INCREMENT_CENTS;
}
