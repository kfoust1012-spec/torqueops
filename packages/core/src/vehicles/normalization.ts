import type { CreateVehicleInput, UpdateVehicleInput } from "@mobile-mechanic/types";

import { normalizeOptionalText } from "../customers/normalization";

export function normalizeVin(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeLicensePlate(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeVehicleInput(input: CreateVehicleInput | UpdateVehicleInput) {
  return {
    ...input,
    make: input.make.trim(),
    model: input.model.trim(),
    trim: normalizeOptionalText(input.trim),
    engine: normalizeOptionalText(input.engine),
    licensePlate: normalizeLicensePlate(input.licensePlate),
    licenseState: normalizeOptionalText(input.licenseState)?.toUpperCase() ?? null,
    vin: normalizeVin(input.vin),
    color: normalizeOptionalText(input.color),
    odometer: input.odometer ?? null,
    notes: normalizeOptionalText(input.notes),
    year: input.year ?? null
  };
}
