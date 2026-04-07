import { serviceAssetOwnershipTypes } from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";

export const vinSchema = z
  .string()
  .trim()
  .length(17)
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "VIN must be 17 characters and exclude I, O, and Q.")
  .nullable()
  .optional();

export const licensePlateSchema = z.string().trim().min(1).max(16).nullable().optional();
export const vehicleYearSchema = z.number().int().min(1900).max(2100).nullable().optional();
export const odometerSchema = z.number().int().min(0).nullable().optional();
export const serviceAssetOwnershipTypeSchema = z.enum(serviceAssetOwnershipTypes);

export const createVehicleInputSchema = z.object({
  companyId: uuidSchema,
  customerId: uuidSchema,
  ownershipType: serviceAssetOwnershipTypeSchema.optional(),
  year: vehicleYearSchema,
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  trim: optionalNullableStringSchema,
  engine: optionalNullableStringSchema,
  licensePlate: licensePlateSchema,
  licenseState: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  vin: vinSchema,
  color: optionalNullableStringSchema,
  odometer: odometerSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
}).superRefine((value, ctx) => {
  const hasPlate = Boolean(value.licensePlate);
  const hasState = Boolean(value.licenseState);

  if (hasPlate !== hasState) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License plate and license state must both be provided together.",
      path: hasPlate ? ["licenseState"] : ["licensePlate"]
    });
  }
});

export const updateVehicleInputSchema = z.object({
  customerId: uuidSchema,
  ownershipType: serviceAssetOwnershipTypeSchema.optional(),
  year: vehicleYearSchema,
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  trim: optionalNullableStringSchema,
  engine: optionalNullableStringSchema,
  licensePlate: licensePlateSchema,
  licenseState: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  vin: vinSchema,
  color: optionalNullableStringSchema,
  odometer: odometerSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
}).superRefine((value, ctx) => {
  const hasPlate = Boolean(value.licensePlate);
  const hasState = Boolean(value.licenseState);

  if (hasPlate !== hasState) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License plate and license state must both be provided together.",
      path: hasPlate ? ["licenseState"] : ["licensePlate"]
    });
  }
});

export const vehicleSearchSchema = z.string().trim().min(1).max(120);

export const vehicleListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  includeInactive: z.boolean().optional()
});
