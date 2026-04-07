import type {
  CreateInvoiceInput,
  CreateInvoiceLineItemInput,
  UpdateInvoiceInput,
  UpdateInvoiceLineItemInput
} from "@mobile-mechanic/types";

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeInvoiceInput(input: CreateInvoiceInput): {
  companyId: string;
  jobId: string;
  estimateId: string | null;
  invoiceNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  taxRateBasisPoints: number;
  discountCents: number;
  dueAt: string | null;
  createdByUserId: string;
};
export function normalizeInvoiceInput(input: UpdateInvoiceInput): {
  invoiceNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  taxRateBasisPoints: number;
  discountCents: number;
  dueAt: string | null;
};
export function normalizeInvoiceInput(input: CreateInvoiceInput | UpdateInvoiceInput) {
  return {
    ...input,
    invoiceNumber: input.invoiceNumber.trim(),
    title: input.title.trim(),
    notes: normalizeNullableText(input.notes),
    terms: normalizeNullableText(input.terms),
    taxRateBasisPoints: input.taxRateBasisPoints ?? 0,
    discountCents: input.discountCents ?? 0,
    dueAt: normalizeNullableText(input.dueAt),
    ...("estimateId" in input ? { estimateId: input.estimateId ?? null } : {})
  };
}

export function normalizeInvoiceLineItemInput(
  input: CreateInvoiceLineItemInput | UpdateInvoiceLineItemInput
) {
  return {
    ...input,
    name: input.name.trim(),
    description: normalizeNullableText(input.description),
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    taxable: input.taxable ?? true
  };
}
