import {
  laborGuideConfidenceLevels,
  laborGuideSources,
  laborGuideSuggestionStatuses
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";
import { createEstimateLineItemInputSchema, estimateLongTextSchema } from "./estimate";

export const laborGuideSourceSchema = z.enum(laborGuideSources);
export const laborGuideSuggestionStatusSchema = z.enum(laborGuideSuggestionStatuses);
export const laborGuideConfidenceLevelSchema = z.enum(laborGuideConfidenceLevels);
export const laborGuideOperationCodeSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
export const laborGuideSuggestedHoursSchema = z.number().positive().max(24);

export const laborGuideVehicleContextSchema = z.object({
  year: z.number().int().min(1900).max(2100).nullable(),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  trim: z.string().trim().min(1).max(120).nullable(),
  engine: z.string().trim().min(1).max(120).nullable(),
  vin: z.string().trim().min(1).max(17).nullable()
});

export const laborGuideContextSchema = z.object({
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: estimateLongTextSchema,
  customerConcern: estimateLongTextSchema,
  internalSummary: estimateLongTextSchema,
  vehicle: laborGuideVehicleContextSchema
});

export const suggestLaborOperationsInputSchema = z.object({
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  query: z.string().trim().min(1).max(200).nullable().optional()
});

export const laborGuideSuggestedOperationSchema = z.object({
  code: laborGuideOperationCodeSchema,
  name: z.string().trim().min(1).max(160),
  description: estimateLongTextSchema,
  suggestedHours: laborGuideSuggestedHoursSchema,
  confidence: laborGuideConfidenceLevelSchema,
  rationale: estimateLongTextSchema,
  matchedSignals: z.array(z.string().trim().min(1).max(80)).max(10),
  lineItemDefaults: createEstimateLineItemInputSchema
});

export const laborGuideSuggestionResultSchema = z.object({
  status: laborGuideSuggestionStatusSchema,
  source: laborGuideSourceSchema,
  operations: z.array(laborGuideSuggestedOperationSchema).max(8),
  warnings: z.array(z.string().trim().min(1).max(240)).max(8)
});
