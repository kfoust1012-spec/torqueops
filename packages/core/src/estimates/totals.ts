import type { EstimateLineItem, EstimateTotals } from "@mobile-mechanic/types";

export function calculateEstimateLineSubtotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function calculateEstimateSubtotalCents(lineItems: Pick<EstimateLineItem, "lineSubtotalCents">[]): number {
  return lineItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
}

export function calculateEstimateTaxableSubtotalCents(
  lineItems: Pick<EstimateLineItem, "lineSubtotalCents" | "taxable">[]
): number {
  return lineItems.reduce((sum, item) => sum + (item.taxable ? item.lineSubtotalCents : 0), 0);
}

export function calculateEstimateTaxCents(
  taxableSubtotalCents: number,
  taxRateBasisPoints: number,
  discountCents = 0
): number {
  const discountAppliedToTaxableBase = Math.min(discountCents, taxableSubtotalCents);
  const taxableBaseAfterDiscount = Math.max(0, taxableSubtotalCents - discountAppliedToTaxableBase);

  return Math.round((taxableBaseAfterDiscount * taxRateBasisPoints) / 10000);
}

export function calculateEstimateTotalCents(input: {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
}): number {
  return Math.max(0, input.subtotalCents - input.discountCents) + input.taxCents;
}

export function calculateEstimateTotals(input: {
  discountCents?: number;
  lineItems: Pick<EstimateLineItem, "lineSubtotalCents" | "taxable">[];
  taxRateBasisPoints?: number;
}): EstimateTotals {
  const subtotalCents = calculateEstimateSubtotalCents(input.lineItems);
  const taxableSubtotalCents = calculateEstimateTaxableSubtotalCents(input.lineItems);
  const discountCents = Math.min(Math.max(0, input.discountCents ?? 0), subtotalCents);
  const taxCents = calculateEstimateTaxCents(
    taxableSubtotalCents,
    input.taxRateBasisPoints ?? 0,
    discountCents
  );

  return {
    subtotalCents,
    discountCents,
    taxableSubtotalCents,
    taxCents,
    totalCents: calculateEstimateTotalCents({
      subtotalCents,
      discountCents,
      taxCents
    })
  };
}

export function formatCurrencyFromCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(cents / 100);
}
