import type { EstimateVehicleContextSnapshot } from "@mobile-mechanic/types";

export function normalizeRetailerSearchWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function parseRetailerCurrencyTextToCents(value: string | null | undefined) {
  const match = normalizeRetailerSearchWhitespace(value).match(/\$?\s*([\d,]+(?:\.\d{2})?)/);

  if (!match) {
    return null;
  }

  const normalizedNumber = Number(match[1]?.replaceAll(",", ""));

  if (!Number.isFinite(normalizedNumber)) {
    return null;
  }

  return Math.round(normalizedNumber * 100);
}

export function buildVehicleAwareRetailerSearchQuery(input: {
  explicitQuery?: string | null | undefined;
  fallbackQuery: string;
  vehicleContext: Pick<EstimateVehicleContextSnapshot, "make" | "model" | "year">;
}) {
  const baseQuery =
    normalizeRetailerSearchWhitespace(input.explicitQuery) ||
    normalizeRetailerSearchWhitespace(input.fallbackQuery);
  const vehicleBits = [
    input.vehicleContext.year ? String(input.vehicleContext.year) : "",
    input.vehicleContext.make,
    input.vehicleContext.model
  ]
    .map((value) => normalizeRetailerSearchWhitespace(value))
    .filter(Boolean);

  if (!baseQuery || !vehicleBits.length) {
    return baseQuery;
  }

  const lowerBaseQuery = baseQuery.toLowerCase();
  const alreadyIncludesVehicle = vehicleBits.every((value) =>
    lowerBaseQuery.includes(value.toLowerCase())
  );

  return alreadyIncludesVehicle ? baseQuery : `${baseQuery} ${vehicleBits.join(" ")}`.trim();
}
