import { normalizeOptionalText, normalizeVinForDecode, isVinReadyForDecode } from "@mobile-mechanic/core";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VinDecodeResult,
  VinDecodedVehicleFields
} from "@mobile-mechanic/types";

import { decodeVin } from "./vin-decoder";

type VehicleWriteInput = CreateVehicleInput | UpdateVehicleInput;

type VehicleDecodedBaseline = Partial<Record<keyof VinDecodedVehicleFields, string | number | null>>;

function mergeRequiredTextField(currentValue: string | null | undefined, decodedValue: string | null): string {
  return normalizeOptionalText(currentValue) ?? decodedValue ?? "";
}

function mergeOptionalTextField(
  currentValue: string | null | undefined,
  decodedValue: string | null
): string | null {
  return normalizeOptionalText(currentValue) ?? decodedValue ?? null;
}

export function mergeVehicleInputWithDecodedFields<T extends VehicleWriteInput>(
  input: T,
  decoded: VinDecodedVehicleFields,
  baseline: VehicleDecodedBaseline = {}
): T {
  const shouldApplyYear = input.year === null || input.year === undefined || input.year === baseline.year;
  const shouldApplyMake = !normalizeOptionalText(input.make) || input.make.trim() === String(baseline.make ?? "").trim();
  const shouldApplyModel = !normalizeOptionalText(input.model) || input.model.trim() === String(baseline.model ?? "").trim();
  const shouldApplyTrim = !normalizeOptionalText(input.trim) || normalizeOptionalText(input.trim) === normalizeOptionalText(String(baseline.trim ?? ""));
  const shouldApplyEngine = !normalizeOptionalText(input.engine) || normalizeOptionalText(input.engine) === normalizeOptionalText(String(baseline.engine ?? ""));

  return {
    ...input,
    year: shouldApplyYear ? (decoded.year ?? input.year ?? null) : input.year ?? null,
    make: shouldApplyMake ? mergeRequiredTextField(null, decoded.make) || input.make : input.make,
    model: shouldApplyModel ? mergeRequiredTextField(null, decoded.model) || input.model : input.model,
    trim: shouldApplyTrim ? mergeOptionalTextField(null, decoded.trim) : mergeOptionalTextField(input.trim, null),
    engine: shouldApplyEngine ? mergeOptionalTextField(null, decoded.engine) : mergeOptionalTextField(input.engine, null)
  };
}

export async function enrichVehicleInputWithVinDecode<T extends VehicleWriteInput>(
  input: T,
  options: {
    baseline?: VehicleDecodedBaseline | undefined;
  } = {}
): Promise<{
  input: T;
  decodeResult: VinDecodeResult | null;
}> {
  const normalizedVin = normalizeVinForDecode(input.vin);
  const normalizedInput = {
    ...input,
    vin: normalizedVin
  } as T;

  if (!isVinReadyForDecode(normalizedVin)) {
    return {
      input: normalizedInput,
      decodeResult: null
    };
  }

  const decodeResult = await decodeVin(normalizedVin as string);

  if (decodeResult.status !== "success" && decodeResult.status !== "partial") {
    return {
      input: normalizedInput,
      decodeResult
    };
  }

  return {
    input: mergeVehicleInputWithDecodedFields(normalizedInput, decodeResult.decoded, options.baseline),
    decodeResult
  };
}