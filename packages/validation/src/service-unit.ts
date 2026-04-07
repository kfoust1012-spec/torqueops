import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";
import { licensePlateSchema, vehicleYearSchema, vinSchema } from "./vehicle";

export const serviceUnitQuerySchema = z.object({
  assignedTechnicianUserId: uuidSchema.optional(),
  includeInactive: z.boolean().optional(),
  query: z.string().trim().max(120).optional()
});

export const createServiceUnitInputSchema = z.object({
  companyId: uuidSchema,
  stockLocationId: uuidSchema,
  assignedTechnicianUserId: uuidSchema.nullable().optional(),
  unitCode: z.string().trim().min(1).max(32),
  displayName: z.string().trim().min(1).max(120),
  year: vehicleYearSchema,
  make: optionalNullableStringSchema,
  model: optionalNullableStringSchema,
  licensePlate: licensePlateSchema,
  licenseState: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  vin: vinSchema,
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

export const updateServiceUnitInputSchema = z.object({
  stockLocationId: uuidSchema.optional(),
  assignedTechnicianUserId: uuidSchema.nullable().optional(),
  unitCode: z.string().trim().min(1).max(32),
  displayName: z.string().trim().min(1).max(120),
  year: vehicleYearSchema,
  make: optionalNullableStringSchema,
  model: optionalNullableStringSchema,
  licensePlate: licensePlateSchema,
  licenseState: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  vin: vinSchema,
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
