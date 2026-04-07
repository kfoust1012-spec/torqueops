import { z } from "zod";

import {
  inventoryAliasTypes,
  inventoryItemTypes,
  inventoryOperationalTransactionTypes,
  inventoryTransactionSourceTypes,
  inventoryTransactionTypes,
  stockLocationTypes
} from "@mobile-mechanic/types";

import { optionalNullableStringSchema, uuidSchema } from "./common";

const trimmedString = z.string().trim().min(1);

export const inventoryItemTypeSchema = z.enum(inventoryItemTypes);
export const inventoryAliasTypeSchema = z.enum(inventoryAliasTypes);
export const stockLocationTypeSchema = z.enum(stockLocationTypes);
export const inventoryTransactionTypeSchema = z.enum(inventoryTransactionTypes);
export const inventoryTransactionSourceTypeSchema = z.enum(inventoryTransactionSourceTypes);

export const inventorySkuSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._-]+$/);
export const inventoryNameSchema = trimmedString.max(160);
export const inventoryAliasValueSchema = trimmedString.max(160);
export const stockLocationNameSchema = trimmedString.max(120);
export const stockLocationSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export const quantitySchema = z.number().positive().max(999999);
export const inventoryNonNegativeQuantitySchema = z.number().min(0).max(999999);
export const unitCostCentsSchema = z.number().int().min(0).max(10_000_000);
export const inventoryNotesSchema = trimmedString.max(2000);

export const createInventoryItemInputSchema = z.object({
  companyId: uuidSchema,
  sku: inventorySkuSchema,
  name: inventoryNameSchema,
  description: optionalNullableStringSchema,
  manufacturer: optionalNullableStringSchema,
  partNumber: optionalNullableStringSchema,
  supplierAccountId: uuidSchema.nullable().optional(),
  defaultUnitCostCents: unitCostCentsSchema.nullable().optional(),
  itemType: inventoryItemTypeSchema.optional(),
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
});

export const updateInventoryItemInputSchema = z.object({
  sku: inventorySkuSchema,
  name: inventoryNameSchema,
  description: optionalNullableStringSchema,
  manufacturer: optionalNullableStringSchema,
  partNumber: optionalNullableStringSchema,
  supplierAccountId: uuidSchema.nullable().optional(),
  defaultUnitCostCents: unitCostCentsSchema.nullable().optional(),
  itemType: inventoryItemTypeSchema.optional(),
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
});

export const createInventoryItemAliasInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  aliasType: inventoryAliasTypeSchema,
  value: inventoryAliasValueSchema
});

export const createStockLocationInputSchema = z.object({
  companyId: uuidSchema,
  name: stockLocationNameSchema,
  slug: stockLocationSlugSchema,
  locationType: stockLocationTypeSchema.optional(),
  technicianUserId: uuidSchema.nullable().optional(),
  vehicleLabel: optionalNullableStringSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
});

export const updateStockLocationInputSchema = z.object({
  name: stockLocationNameSchema,
  slug: stockLocationSlugSchema,
  locationType: stockLocationTypeSchema.optional(),
  technicianUserId: uuidSchema.nullable().optional(),
  vehicleLabel: optionalNullableStringSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
});

export const upsertInventoryStockSettingInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  stockLocationId: uuidSchema,
  reorderPointQuantity: inventoryNonNegativeQuantitySchema.optional(),
  lowStockThresholdQuantity: inventoryNonNegativeQuantitySchema.optional(),
  preferredReorderQuantity: quantitySchema.nullable().optional(),
  isStockedHere: z.boolean().optional()
});

export const createInventoryAdjustmentInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  stockLocationId: uuidSchema,
  transactionType: z.enum(["adjustment_in", "adjustment_out"]),
  quantity: quantitySchema,
  unitCostCents: unitCostCentsSchema.nullable().optional(),
  notes: optionalNullableStringSchema,
  createdByUserId: uuidSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional()
});

export const createInventoryReservationInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  stockLocationId: uuidSchema,
  jobId: uuidSchema,
  partRequestLineId: uuidSchema.nullable().optional(),
  quantityReserved: quantitySchema,
  notes: optionalNullableStringSchema,
  createdByUserId: uuidSchema
});

export const releaseInventoryReservationInputSchema = z.object({
  reservationId: uuidSchema,
  quantityReleased: quantitySchema
});

export const consumeReservedInventoryInputSchema = z.object({
  reservationId: uuidSchema,
  quantityConsumed: quantitySchema,
  createdByUserId: uuidSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema
});

export const receivePurchasedInventoryInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  stockLocationId: uuidSchema,
  purchaseOrderLineId: uuidSchema,
  purchaseReceiptLineId: uuidSchema.nullable().optional(),
  quantityReceived: quantitySchema,
  unitCostCents: unitCostCentsSchema.nullable().optional(),
  notes: optionalNullableStringSchema,
  createdByUserId: uuidSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional()
});

export const inventoryLookupQuerySchema = z.object({
  query: z.string().trim().min(1).optional(),
  stockLocationId: uuidSchema.optional(),
  itemType: inventoryItemTypeSchema.optional(),
  includeInactive: z.boolean().optional(),
  lowStockOnly: z.boolean().optional()
});

export const inventoryTransactionsQuerySchema = z.object({
  inventoryItemId: uuidSchema.optional(),
  stockLocationId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  sourceType: inventoryTransactionSourceTypeSchema.optional(),
  transactionType: z.enum(inventoryOperationalTransactionTypes).optional(),
  limit: z.number().int().min(1).max(200).optional()
});
