import { z } from "zod";

import {
  coreInventoryStatuses,
  inventoryTransferStatuses,
  jobInventoryIssueStatuses,
  stockLocationTypes
} from "@mobile-mechanic/types";

import { optionalNullableStringSchema, uuidSchema } from "./common";
import { inventoryNonNegativeQuantitySchema, inventoryNotesSchema, quantitySchema, unitCostCentsSchema } from "./inventory";

export const inventoryTransferStatusSchema = z.enum(inventoryTransferStatuses);
export const jobInventoryIssueStatusSchema = z.enum(jobInventoryIssueStatuses);
export const coreInventoryStatusSchema = z.enum(coreInventoryStatuses);

export const transferReferenceNumberSchema = z.string().trim().min(1).max(120);
export const locationQuantitySchema = quantitySchema;
export const cycleCountQuantitySchema = inventoryNonNegativeQuantitySchema;
export const inventoryOpsNotesSchema = inventoryNotesSchema;
export const locationInventoryTypeSchema = z.enum(stockLocationTypes);

export const createInventoryTransferInputSchema = z.object({
  companyId: uuidSchema,
  fromStockLocationId: uuidSchema,
  toStockLocationId: uuidSchema,
  requestedByUserId: uuidSchema,
  referenceNumber: transferReferenceNumberSchema.nullable().optional(),
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        inventoryItemId: uuidSchema,
        quantityRequested: locationQuantitySchema,
        unitCostCents: unitCostCentsSchema.nullable().optional(),
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
});

export const shipInventoryTransferInputSchema = z.object({
  transferId: uuidSchema,
  shippedByUserId: uuidSchema,
  shippedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        transferLineId: uuidSchema,
        quantityShipped: locationQuantitySchema,
        unitCostCents: unitCostCentsSchema.nullable().optional(),
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
});

export const receiveInventoryTransferInputSchema = z.object({
  transferId: uuidSchema,
  receivedByUserId: uuidSchema,
  receivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        transferLineId: uuidSchema,
        quantityReceived: locationQuantitySchema,
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
});

export const cancelInventoryTransferInputSchema = z.object({
  transferId: uuidSchema,
  notes: optionalNullableStringSchema
});

export const createJobInventoryIssueInputSchema = z.object({
  companyId: uuidSchema,
  inventoryReservationId: uuidSchema,
  quantityIssued: locationQuantitySchema,
  issuedByUserId: uuidSchema,
  issuedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema
});

export const consumeIssuedInventoryInputSchema = z.object({
  issueId: uuidSchema,
  quantityConsumed: locationQuantitySchema,
  notes: optionalNullableStringSchema
});

export const returnIssuedInventoryInputSchema = z.object({
  issueId: uuidSchema,
  quantityReturned: locationQuantitySchema,
  returnedByUserId: uuidSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema
});

export const createInventoryCycleCountInputSchema = z.object({
  companyId: uuidSchema,
  stockLocationId: uuidSchema,
  countedByUserId: uuidSchema,
  countedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        inventoryItemId: uuidSchema,
        countedQuantity: cycleCountQuantitySchema,
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
    .superRefine((lines, ctx) => {
      const seen = new Set<string>();

      lines.forEach((line, index) => {
        if (seen.has(line.inventoryItemId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each inventory item can only appear once per cycle count.",
            path: [index, "inventoryItemId"]
          });
          return;
        }

        seen.add(line.inventoryItemId);
      });
    })
});

export const recordCoreInventoryHoldInputSchema = z.object({
  companyId: uuidSchema,
  inventoryItemId: uuidSchema,
  stockLocationId: uuidSchema,
  quantity: locationQuantitySchema,
  heldByUserId: uuidSchema,
  purchaseOrderLineId: uuidSchema.nullable().optional(),
  jobInventoryIssueId: uuidSchema.nullable().optional(),
  partRequestLineId: uuidSchema.nullable().optional(),
  notes: optionalNullableStringSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional()
});

export const recordCoreInventoryReturnInputSchema = z.object({
  coreEventId: uuidSchema,
  returnedByUserId: uuidSchema,
  notes: optionalNullableStringSchema,
  effectiveAt: z.string().datetime({ offset: true }).nullable().optional()
});

export const locationInventoryQuerySchema = z.object({
  stockLocationId: uuidSchema.optional(),
  locationType: locationInventoryTypeSchema.optional(),
  lowStockOnly: z.boolean().optional()
});

export const transferWorkspaceQuerySchema = z.object({
  status: inventoryTransferStatusSchema.optional(),
  stockLocationId: uuidSchema.optional()
});
