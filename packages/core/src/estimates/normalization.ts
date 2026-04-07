import type {
  CreateEstimateInput,
  CreateEstimateLineItemInput,
  UpdateEstimateInput,
  UpdateEstimateLineItemInput
} from "@mobile-mechanic/types";

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeEstimateInput(input: CreateEstimateInput): {
  companyId: string;
  jobId: string;
  estimateNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  taxRateBasisPoints: number;
  discountCents: number;
  createdByUserId: string;
};
export function normalizeEstimateInput(input: UpdateEstimateInput): {
  estimateNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  taxRateBasisPoints: number;
  discountCents: number;
};
export function normalizeEstimateInput(input: CreateEstimateInput | UpdateEstimateInput) {
  return {
    ...input,
    estimateNumber: input.estimateNumber.trim(),
    title: input.title.trim(),
    notes: normalizeNullableText(input.notes),
    terms: normalizeNullableText(input.terms),
    taxRateBasisPoints: input.taxRateBasisPoints ?? 0,
    discountCents: input.discountCents ?? 0
  };
}

export function normalizeEstimateLineItemInput(
  input: CreateEstimateLineItemInput | UpdateEstimateLineItemInput
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
