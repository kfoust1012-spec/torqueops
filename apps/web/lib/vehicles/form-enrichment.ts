import type { VinDecodedVehicleFields } from "@mobile-mechanic/types";

type VehicleFormFieldValues = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
};

type VehicleFormFieldBaselineValues = Partial<VehicleFormFieldValues>;

export type VehicleFormDecodeMergeResult = {
  values: VehicleFormFieldValues;
  appliedFields: string[];
};

function isBlank(value: string): boolean {
  return !value.trim();
}

export function applyDecodedVehicleFieldsToFormValues(
  current: VehicleFormFieldValues,
  decoded: VinDecodedVehicleFields,
  baseline: VehicleFormFieldBaselineValues = {}
): VehicleFormDecodeMergeResult {
  const appliedFields: string[] = [];
  const nextValues: VehicleFormFieldValues = {
    ...current
  };

  function canApplyField(field: keyof VehicleFormFieldValues): boolean {
    return isBlank(current[field]) || current[field] === (baseline[field] ?? "");
  }

  if (canApplyField("year") && decoded.year !== null) {
    nextValues.year = String(decoded.year);
    appliedFields.push("year");
  }

  if (canApplyField("make") && decoded.make) {
    nextValues.make = decoded.make;
    appliedFields.push("make");
  }

  if (canApplyField("model") && decoded.model) {
    nextValues.model = decoded.model;
    appliedFields.push("model");
  }

  if (canApplyField("trim") && decoded.trim) {
    nextValues.trim = decoded.trim;
    appliedFields.push("trim");
  }

  if (canApplyField("engine") && decoded.engine) {
    nextValues.engine = decoded.engine;
    appliedFields.push("engine");
  }

  return {
    values: nextValues,
    appliedFields
  };
}