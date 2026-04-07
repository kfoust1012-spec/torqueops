import type { InvoiceLineItem, InvoiceTotals } from "@mobile-mechanic/types";

export function calculateInvoiceLineSubtotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function calculateInvoiceSubtotalCents(lineItems: Pick<InvoiceLineItem, "lineSubtotalCents">[]): number {
  return lineItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
}

export function calculateInvoiceTaxableSubtotalCents(
  lineItems: Pick<InvoiceLineItem, "lineSubtotalCents" | "taxable">[]
): number {
  return lineItems.reduce((sum, item) => sum + (item.taxable ? item.lineSubtotalCents : 0), 0);
}

export function calculateInvoiceTaxCents(
  taxableSubtotalCents: number,
  taxRateBasisPoints: number,
  discountCents = 0
): number {
  const discountAppliedToTaxableBase = Math.min(discountCents, taxableSubtotalCents);
  const taxableBaseAfterDiscount = Math.max(0, taxableSubtotalCents - discountAppliedToTaxableBase);

  return Math.round((taxableBaseAfterDiscount * taxRateBasisPoints) / 10000);
}

export function calculateInvoiceTotalCents(input: {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
}): number {
  return Math.max(0, input.subtotalCents - input.discountCents) + input.taxCents;
}

export function calculateInvoiceBalanceDueCents(input: {
  totalCents: number;
  amountPaidCents: number;
}): number {
  return Math.max(0, input.totalCents - input.amountPaidCents);
}

export function calculateInvoiceTotals(input: {
  amountPaidCents?: number;
  discountCents?: number;
  lineItems: Pick<InvoiceLineItem, "lineSubtotalCents" | "taxable">[];
  taxRateBasisPoints?: number;
}): InvoiceTotals {
  const subtotalCents = calculateInvoiceSubtotalCents(input.lineItems);
  const taxableSubtotalCents = calculateInvoiceTaxableSubtotalCents(input.lineItems);
  const discountCents = Math.min(Math.max(0, input.discountCents ?? 0), subtotalCents);
  const taxCents = calculateInvoiceTaxCents(
    taxableSubtotalCents,
    input.taxRateBasisPoints ?? 0,
    discountCents
  );
  const totalCents = calculateInvoiceTotalCents({
    subtotalCents,
    discountCents,
    taxCents
  });
  const amountPaidCents = Math.min(Math.max(0, input.amountPaidCents ?? 0), totalCents);

  return {
    subtotalCents,
    discountCents,
    taxableSubtotalCents,
    taxCents,
    totalCents,
    amountPaidCents,
    balanceDueCents: calculateInvoiceBalanceDueCents({
      totalCents,
      amountPaidCents
    })
  };
}
