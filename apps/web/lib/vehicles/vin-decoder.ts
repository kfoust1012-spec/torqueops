import {
  getMissingDecodedVehicleFieldLabels,
  hasDecodedVehicleCoreFields,
  normalizeOptionalText
} from "@mobile-mechanic/core";
import type { VinDecodeResult, VinDecodedVehicleFields } from "@mobile-mechanic/types";
import { decodeVinInputSchema, vinDecodeResultSchema } from "@mobile-mechanic/validation";

type NhtsaDecodeVinResponse = {
  Results?: Array<Record<string, unknown>> | null;
};

const VIN_DECODE_TIMEOUT_MS = 5000;

function createEmptyDecodedFields(): VinDecodedVehicleFields {
  return {
    year: null,
    make: null,
    model: null,
    trim: null,
    engine: null
  };
}

function createDecodeResult(
  vin: string,
  status: VinDecodeResult["status"],
  decoded: VinDecodedVehicleFields,
  warnings: string[]
): VinDecodeResult {
  return vinDecodeResultSchema.parse({
    vin,
    status,
    decoded,
    warnings,
    source: "nhtsa"
  });
}

function normalizeDecodedText(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  if (["0", "NULL", "NOT APPLICABLE"].includes(normalized.toUpperCase())) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function parseModelYear(value: unknown): number | null {
  const normalized = normalizeDecodedText(value, 4);

  if (!normalized) {
    return null;
  }

  const year = Number(normalized);

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return null;
  }

  return year;
}

function buildDecodedEngineLabel(row: Record<string, unknown>): string | null {
  const engineModel = normalizeDecodedText(row.EngineModel);

  if (engineModel) {
    return engineModel;
  }

  const displacementLiters = normalizeDecodedText(row.DisplacementL, 20);
  const cylinders = normalizeDecodedText(row.EngineCylinders, 20);

  if (displacementLiters && cylinders) {
    return `${displacementLiters}L ${cylinders}-cyl`;
  }

  if (displacementLiters) {
    return `${displacementLiters}L`;
  }

  if (cylinders) {
    return `${cylinders}-cyl`;
  }

  return normalizeDecodedText(row.EngineConfiguration);
}

export function mapNhtsaVinDecodeResponse(vin: string, payload: unknown): VinDecodeResult {
  const response = payload as NhtsaDecodeVinResponse;
  const row = Array.isArray(response.Results) ? response.Results[0] : null;

  if (!row || typeof row !== "object") {
    return createDecodeResult(vin, "not_found", createEmptyDecodedFields(), [
      "Vehicle details could not be confirmed from the VIN."
    ]);
  }

  const decoded: VinDecodedVehicleFields = {
    year: parseModelYear(row.ModelYear),
    make: normalizeDecodedText(row.Make, 80),
    model: normalizeDecodedText(row.Model, 80),
    trim: normalizeDecodedText(row.Trim, 80),
    engine: buildDecodedEngineLabel(row)
  };
  const warnings: string[] = [];
  const errorText = normalizeDecodedText(row.ErrorText, 200);

  if (errorText && !errorText.startsWith("0 - VIN decoded clean")) {
    warnings.push(errorText);
  }

  const missingLabels = getMissingDecodedVehicleFieldLabels(decoded);

  if (!decoded.trim) {
    warnings.push("Trim was not available from VIN decode.");
  }

  if (!decoded.engine) {
    warnings.push("Engine details were not available from VIN decode.");
  }

  if (!decoded.year && !decoded.make && !decoded.model && !decoded.trim && !decoded.engine) {
    return createDecodeResult(vin, "not_found", decoded, warnings.length ? warnings : [
      "Vehicle details could not be confirmed from the VIN."
    ]);
  }

  if (hasDecodedVehicleCoreFields(decoded)) {
    return createDecodeResult(vin, "success", decoded, warnings);
  }

  return createDecodeResult(
    vin,
    "partial",
    decoded,
    warnings.length
      ? warnings
      : [`VIN decode was partial. Missing ${missingLabels.join(", ")}.`]
  );
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const parsed = decodeVinInputSchema.parse({ vin });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIN_DECODE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(parsed.vin)}?format=json`,
      {
        cache: "no-store",
        signal: controller.signal
      }
    );

    if (!response.ok) {
      return createDecodeResult(parsed.vin, "provider_error", createEmptyDecodedFields(), [
        "Vehicle details could not be fetched right now. Manual entry is still available."
      ]);
    }

    const payload = await response.json();
    return mapNhtsaVinDecodeResponse(parsed.vin, payload);
  } catch {
    return createDecodeResult(parsed.vin, "provider_error", createEmptyDecodedFields(), [
      "Vehicle details could not be fetched right now. Manual entry is still available."
    ]);
  } finally {
    clearTimeout(timeout);
  }
}