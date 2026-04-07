import type { VinDecodedVehicleFields } from "@mobile-mechanic/types";

import { normalizeOptionalText } from "../customers/normalization";

export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function normalizeVinForDecode(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function isVinReadyForDecode(value: string | null | undefined): boolean {
  const normalized = normalizeVinForDecode(value);
  return Boolean(normalized && VIN_PATTERN.test(normalized));
}

export function hasDecodedVehicleCoreFields(decoded: VinDecodedVehicleFields): boolean {
  return Boolean(decoded.year && decoded.make && decoded.model);
}

export function getMissingDecodedVehicleFieldLabels(decoded: VinDecodedVehicleFields): string[] {
  const missing: string[] = [];

  if (!decoded.year) {
    missing.push("year");
  }

  if (!decoded.make) {
    missing.push("make");
  }

  if (!decoded.model) {
    missing.push("model");
  }

  if (!decoded.trim) {
    missing.push("trim");
  }

  if (!decoded.engine) {
    missing.push("engine");
  }

  return missing;
}