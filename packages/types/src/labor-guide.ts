import type { UUID } from "./common";
import type { CreateEstimateLineItemInput } from "./estimate";

export const laborGuideSources = ["curated-rules"] as const;

export type LaborGuideSource = (typeof laborGuideSources)[number];

export const laborGuideSuggestionStatuses = ["ready", "no_match"] as const;

export type LaborGuideSuggestionStatus = (typeof laborGuideSuggestionStatuses)[number];

export const laborGuideConfidenceLevels = ["high", "medium", "low"] as const;

export type LaborGuideConfidenceLevel = (typeof laborGuideConfidenceLevels)[number];

export interface LaborGuideVehicleContext {
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  vin: string | null;
}

export interface LaborGuideContext {
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  title: string;
  description?: string | null | undefined;
  customerConcern?: string | null | undefined;
  internalSummary?: string | null | undefined;
  vehicle: LaborGuideVehicleContext;
}

export interface SuggestLaborOperationsInput {
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  query?: string | null | undefined;
}

export interface LaborGuideSuggestedOperation {
  code: string;
  name: string;
  description: string | null;
  suggestedHours: number;
  confidence: LaborGuideConfidenceLevel;
  rationale: string | null;
  matchedSignals: string[];
  lineItemDefaults: CreateEstimateLineItemInput;
}

export interface LaborGuideSuggestionResult {
  status: LaborGuideSuggestionStatus;
  source: LaborGuideSource;
  operations: LaborGuideSuggestedOperation[];
  warnings: string[];
}
