import type {
  CreateCustomerAddressInput,
  CreateCustomerInput,
  UpdateCustomerAddressInput,
  UpdateCustomerInput
} from "@mobile-mechanic/types";

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCustomerInput(input: CreateCustomerInput | UpdateCustomerInput) {
  return {
    ...input,
    relationshipType: input.relationshipType ?? "retail_customer",
    companyName: normalizeOptionalText(input.companyName),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: normalizeOptionalText(input.email),
    phone: normalizeOptionalText(input.phone),
    notes: normalizeOptionalText(input.notes)
  };
}

export function normalizeCustomerAddressInput(
  input: CreateCustomerAddressInput | UpdateCustomerAddressInput
) {
  return {
    ...input,
    siteName: normalizeOptionalText(input.siteName),
    serviceContactName: normalizeOptionalText(input.serviceContactName),
    serviceContactPhone: normalizeOptionalText(input.serviceContactPhone),
    accessWindowNotes: normalizeOptionalText(input.accessWindowNotes),
    line1: input.line1.trim(),
    line2: normalizeOptionalText(input.line2),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    postalCode: input.postalCode.trim(),
    country: (input.country ?? "US").trim().toUpperCase(),
    gateCode: normalizeOptionalText(input.gateCode),
    parkingNotes: normalizeOptionalText(input.parkingNotes),
    isActive: input.isActive ?? true
  };
}

export { normalizeOptionalText };
