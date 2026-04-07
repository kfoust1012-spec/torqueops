export function calculateRemainingInvoicePaymentCents(input: {
  totalCents: number;
  amountPaidCents: number;
}): number {
  return Math.max(0, input.totalCents - input.amountPaidCents);
}

export function canRecordAdditionalInvoicePayment(input: {
  totalCents: number;
  amountPaidCents: number;
}): boolean {
  return calculateRemainingInvoicePaymentCents(input) > 0;
}
