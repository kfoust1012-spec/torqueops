import { z } from "zod";

import { vinDecodeStatuses } from "@mobile-mechanic/types";

export const decodeVinInputSchema = z.object({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .length(17)
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "VIN must be 17 characters and exclude I, O, and Q.")
});

export const vinDecodedVehicleFieldsSchema = z.object({
  year: z.number().int().min(1900).max(2100).nullable(),
  make: z.string().trim().min(1).max(80).nullable(),
  model: z.string().trim().min(1).max(80).nullable(),
  trim: z.string().trim().max(80).nullable(),
  engine: z.string().trim().max(120).nullable()
});

export const vinDecodeResultSchema = z.object({
  vin: decodeVinInputSchema.shape.vin,
  status: z.enum(vinDecodeStatuses),
  decoded: vinDecodedVehicleFieldsSchema,
  warnings: z.array(z.string().trim().min(1).max(200)),
  source: z.literal("nhtsa")
});