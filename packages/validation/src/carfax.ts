import {
  carfaxHistoryFlagKinds,
  carfaxHistoryFlagSeverities,
  carfaxSummaryStatuses
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";

const carfaxDateValueSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
]);
const carfaxDateTimeSchema = carfaxDateValueSchema.nullable();
const carfaxRequiredVinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(17)
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "VIN must be 17 characters and exclude I, O, and Q.");

function validateCarfaxSummaryState(
  value: {
    status: (typeof carfaxSummaryStatuses)[number];
    summary: unknown;
    fetchedAt?: string | null | undefined;
  },
  ctx: z.RefinementCtx
) {
  const isReady = value.status === "ready";
  const hasSummary = value.summary !== null;
  const hasFetchedAt = value.fetchedAt !== null && value.fetchedAt !== undefined;

  if (isReady && hasSummary && hasFetchedAt) {
    return;
  }

  if (!isReady && !hasSummary && !hasFetchedAt) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      "Carfax summary state is inconsistent. Ready summaries require summary and fetchedAt; non-ready summaries must not include them.",
    path: ["status"]
  });
}

export const requiredVinSchema = carfaxRequiredVinSchema;
export const carfaxSummaryStatusSchema = z.enum(carfaxSummaryStatuses);
export const carfaxHistoryFlagSeveritySchema = z.enum(carfaxHistoryFlagSeverities);
export const carfaxHistoryFlagKindSchema = z.enum(carfaxHistoryFlagKinds);

export const carfaxMaintenanceHighlightSchema = z.object({
  label: z.string().trim().min(1).max(160),
  details: z.string().trim().min(1).max(400).nullable(),
  performedAt: carfaxDateTimeSchema,
  odometer: z.number().int().min(0).max(2_000_000).nullable()
});

export const carfaxHistoryFlagSchema = z.object({
  kind: carfaxHistoryFlagKindSchema,
  severity: carfaxHistoryFlagSeveritySchema,
  label: z.string().trim().min(1).max(160),
  details: z.string().trim().min(1).max(400).nullable(),
  reportedAt: carfaxDateTimeSchema
});

export const carfaxReportSummarySchema = z.object({
  reportDate: carfaxDateTimeSchema,
  ownerCount: z.number().int().min(0).max(100).nullable(),
  openRecallCount: z.number().int().min(0).max(100).nullable(),
  serviceRecordCount: z.number().int().min(0).max(10_000).nullable(),
  accidentCount: z.number().int().min(0).max(100).nullable(),
  damageCount: z.number().int().min(0).max(100).nullable(),
  lastReportedOdometer: z.number().int().min(0).max(2_000_000).nullable(),
  lastReportedAt: carfaxDateTimeSchema,
  maintenanceHighlights: z.array(carfaxMaintenanceHighlightSchema).max(10),
  historyFlags: z.array(carfaxHistoryFlagSchema).max(20),
  warnings: z.array(z.string().trim().min(1).max(200)).max(10)
});

export const vehicleCarfaxSummarySchema = z.object({
  source: z.literal("carfax"),
  vehicleId: uuidSchema,
  vin: carfaxRequiredVinSchema,
  status: carfaxSummaryStatusSchema,
  summary: carfaxReportSummarySchema.nullable(),
  fetchedAt: carfaxDateTimeSchema,
  lastAttemptedAt: z.string().datetime({ offset: true }),
  nextEligibleRefreshAt: z.string().datetime({ offset: true }),
  lastErrorMessage: z.string().trim().min(1).max(400).nullable()
}).superRefine(validateCarfaxSummaryState);

export const upsertVehicleCarfaxSummaryInputSchema = z.object({
  companyId: uuidSchema,
  vehicleId: uuidSchema,
  vin: carfaxRequiredVinSchema,
  status: carfaxSummaryStatusSchema,
  summary: carfaxReportSummarySchema.nullable(),
  fetchedAt: carfaxDateTimeSchema.optional(),
  lastAttemptedAt: z.string().datetime({ offset: true }).optional(),
  nextEligibleRefreshAt: z.string().datetime({ offset: true }).optional(),
  lastErrorMessage: z.string().trim().min(1).max(400).nullable().optional()
}).superRefine(validateCarfaxSummaryState);
