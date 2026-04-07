import type { LaborGuideContext, LaborGuideVehicleContext } from "@mobile-mechanic/types";

import { normalizeOptionalText } from "../customers/normalization";

const LABOR_GUIDE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with"
]);

export function normalizeLaborGuideText(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return "";
  }

  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildLaborGuideSearchText(context: LaborGuideContext): string {
  return [
    context.title,
    context.description,
    context.customerConcern,
    context.internalSummary,
    context.vehicle.year ? String(context.vehicle.year) : null,
    context.vehicle.make,
    context.vehicle.model,
    context.vehicle.trim,
    context.vehicle.engine
  ]
    .map((value) => normalizeLaborGuideText(value))
    .filter(Boolean)
    .join(" ");
}

export function buildLaborGuideSignalSearchText(context: LaborGuideContext): string {
  return [context.title, context.description, context.customerConcern]
    .map((value) => normalizeLaborGuideText(value))
    .filter(Boolean)
    .join(" ");
}

export function tokenizeLaborGuideText(value: string): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(/\s+/).filter((token) => token && !LABOR_GUIDE_STOP_WORDS.has(token)))];
}

export function countMatchedSignals(searchText: string, signals: string[]): string[] {
  const normalizedSearchText = normalizeLaborGuideText(searchText);

  return signals.filter((signal) => {
    const normalizedSignal = normalizeLaborGuideText(signal);
    return normalizedSignal.length > 0 && normalizedSearchText.includes(normalizedSignal);
  });
}

export function getLaborGuideVehicleLabel(vehicle: LaborGuideVehicleContext): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}