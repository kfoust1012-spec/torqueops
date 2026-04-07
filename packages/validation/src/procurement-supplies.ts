import { z } from "zod";

import { procurementProviders } from "@mobile-mechanic/types";

import { optionalNullableStringSchema, uuidSchema } from "./common";

const trimmedString = z.string().trim().min(1);

export const supplyListNameSchema = trimmedString.max(160);
export const supplyListDescriptionSchema = optionalNullableStringSchema;
export const supplyListLineDescriptionSchema = trimmedString.max(240);
export const supplyListSearchQuerySchema = optionalNullableStringSchema;
export const supplyListQuantitySchema = z.number().positive().max(9999);
export const supplyListExpectedUnitCostCentsSchema = z
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .nullable()
  .optional();
export const supplyListProviderSchema = z.enum(procurementProviders);
export const supplyListProviderProductKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullable()
  .optional();
export const supplyListProviderOfferKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullable()
  .optional();

export const createProcurementSupplyListInputSchema = z.object({
  companyId: uuidSchema,
  name: supplyListNameSchema,
  description: supplyListDescriptionSchema,
  createdByUserId: uuidSchema
});

export const updateProcurementSupplyListInputSchema = z.object({
  name: supplyListNameSchema.optional(),
  description: supplyListDescriptionSchema,
  isActive: z.boolean().optional()
});

export const upsertProcurementSupplyListLineInputSchema = z
  .object({
    lineId: uuidSchema.optional(),
    supplyListId: uuidSchema,
    companyId: uuidSchema,
    inventoryItemId: uuidSchema.nullable().optional(),
    description: supplyListLineDescriptionSchema,
    defaultQuantity: supplyListQuantitySchema,
    searchQuery: supplyListSearchQuerySchema,
    provider: supplyListProviderSchema,
    providerProductKey: supplyListProviderProductKeySchema,
    providerOfferKey: supplyListProviderOfferKeySchema,
    expectedUnitCostCents: supplyListExpectedUnitCostCentsSchema,
    notes: optionalNullableStringSchema
  })
  .superRefine((value, context) => {
    if (!value.description && !value.searchQuery && !value.providerProductKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supply list lines need a description, search query, or provider product key.",
        path: ["description"]
      });
    }
  });

export const applyProcurementSupplyListToRequestInputSchema = z.object({
  companyId: uuidSchema,
  requestId: uuidSchema,
  supplyListId: uuidSchema,
  actorUserId: uuidSchema
});
