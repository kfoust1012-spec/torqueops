import type {
  AddPartRequestLineInput,
  CreatePartRequestInput,
  CreateSupplierAccountInput,
  UpdatePartRequestLineInput,
  UpdateSupplierAccountInput
} from "@mobile-mechanic/types";

function trimOrNull(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizePartNumber(value: string | null | undefined) {
  const trimmed = trimOrNull(value);
  return trimmed ? trimmed.toUpperCase().replaceAll(/\s+/g, "") : null;
}

export function normalizeSupplierSku(value: string | null | undefined) {
  const trimmed = trimOrNull(value);
  return trimmed ? trimmed.replaceAll(/\s+/g, "-").toUpperCase() : null;
}

export function normalizeSupplierUrl(value: string | null | undefined) {
  return trimOrNull(value) ?? null;
}

export function normalizeSupplierAccountInput<T extends CreateSupplierAccountInput | UpdateSupplierAccountInput>(
  input: T
): T {
  return {
    ...input,
    contactEmail: trimOrNull(input.contactEmail),
    contactName: trimOrNull(input.contactName),
    contactPhone: trimOrNull(input.contactPhone),
    externalUrl: normalizeSupplierUrl(input.externalUrl),
    name: input.name.trim(),
    notes: trimOrNull(input.notes),
    slug: input.slug.trim().toLowerCase()
  } as T;
}

export function normalizePartRequestInput(input: CreatePartRequestInput) {
  return {
    ...input,
    notes: trimOrNull(input.notes)
  };
}

export function normalizePartRequestLineInput<T extends AddPartRequestLineInput | UpdatePartRequestLineInput>(
  input: T
): T {
  return {
    ...input,
    description: input.description.trim(),
    manufacturer: trimOrNull(input.manufacturer),
    notes: trimOrNull(input.notes),
    partNumber: normalizePartNumber(input.partNumber),
    supplierSku: normalizeSupplierSku(input.supplierSku)
  } as T;
}
