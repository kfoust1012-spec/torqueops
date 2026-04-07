import { z } from "zod";

import {
  partLifecycleStatuses,
  partRequestOrigins,
  partRequestStatuses,
  partReturnStatuses,
  purchaseOrderStatuses,
  supplierAccountModes,
  supplierCartStatuses
} from "@mobile-mechanic/types";

import { optionalNullableStringSchema, uuidSchema } from "./common";

const trimmedString = z.string().trim().min(1);

export const supplierAccountModeSchema = z.enum(supplierAccountModes);
export const partRequestOriginSchema = z.enum(partRequestOrigins);
export const partRequestStatusSchema = z.enum(partRequestStatuses);
export const partLifecycleStatusSchema = z.enum(partLifecycleStatuses);
export const supplierCartStatusSchema = z.enum(supplierCartStatuses);
export const purchaseOrderStatusSchema = z.enum(purchaseOrderStatuses);
export const partReturnStatusSchema = z.enum(partReturnStatuses);

export const supplierNameSchema = trimmedString.max(120);
export const supplierSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export const supplierUrlSchema = z.string().trim().url().nullable().optional();
export const procurementTextSchema = trimmedString.max(2000);
export const partDescriptionSchema = trimmedString.max(240);
export const partNumberSchema = z.string().trim().min(1).max(120).nullable().optional();
export const supplierSkuSchema = z.string().trim().min(1).max(120).nullable().optional();
export const procurementQuantitySchema = z.number().positive().max(9999);
export const nonNegativeQuantitySchema = z.number().min(0).max(9999);
export const costCentsSchema = z.number().int().min(0).max(10_000_000);
export const poNumberSchema = z.string().trim().min(1).max(64);

const supplierAccountInputSchema = z
  .object({
    name: supplierNameSchema,
    slug: supplierSlugSchema,
    mode: supplierAccountModeSchema,
    externalUrl: supplierUrlSchema,
    contactName: optionalNullableStringSchema,
    contactEmail: optionalNullableStringSchema,
    contactPhone: optionalNullableStringSchema,
    notes: optionalNullableStringSchema
  })
  .superRefine((value, context) => {
    if (value.mode === "link_out" && !value.externalUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link-out suppliers require an external URL.",
        path: ["externalUrl"]
      });
    }
  });

export const createSupplierAccountInputSchema = supplierAccountInputSchema.extend({
  companyId: uuidSchema,
  sortOrder: z.number().int().min(0).max(9999).optional()
});

export const updateSupplierAccountInputSchema = supplierAccountInputSchema.extend({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional()
});

export const createSupplierRoutingRuleInputSchema = z.object({
  companyId: uuidSchema,
  supplierAccountId: uuidSchema,
  name: trimmedString.max(160),
  priority: z.number().int().min(0).max(9999).optional(),
  matchJobPriority: optionalNullableStringSchema,
  matchVehicleMake: optionalNullableStringSchema,
  matchHasCore: z.boolean().nullable().optional(),
  matchPartTerm: optionalNullableStringSchema
});

export const updateSupplierRoutingRuleInputSchema = z.object({
  supplierAccountId: uuidSchema,
  name: trimmedString.max(160),
  priority: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  matchJobPriority: optionalNullableStringSchema,
  matchVehicleMake: optionalNullableStringSchema,
  matchHasCore: z.boolean().nullable().optional(),
  matchPartTerm: optionalNullableStringSchema
});

export const createPartRequestInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  origin: partRequestOriginSchema,
  requestedByUserId: uuidSchema,
  notes: optionalNullableStringSchema
});

export const createPartRequestFromEstimateInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema,
  requestedByUserId: uuidSchema,
  notes: optionalNullableStringSchema
});

export const addPartRequestLineInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  estimateLineItemId: uuidSchema.nullable().optional(),
  inventoryItemId: uuidSchema.nullable().optional(),
  description: partDescriptionSchema,
  manufacturer: optionalNullableStringSchema,
  partNumber: partNumberSchema,
  supplierSku: supplierSkuSchema,
  quantityRequested: procurementQuantitySchema.optional(),
  quotedUnitCostCents: costCentsSchema.nullable().optional(),
  estimatedUnitCostCents: costCentsSchema.nullable().optional(),
  needsCore: z.boolean().optional(),
  coreChargeCents: costCentsSchema.optional(),
  notes: optionalNullableStringSchema,
  createdByUserId: uuidSchema
});

export const updatePartRequestLineInputSchema = z.object({
  status: partLifecycleStatusSchema.optional(),
  description: partDescriptionSchema,
  inventoryItemId: uuidSchema.nullable().optional(),
  manufacturer: optionalNullableStringSchema,
  partNumber: partNumberSchema,
  supplierSku: supplierSkuSchema,
  quantityRequested: procurementQuantitySchema.optional(),
  quotedUnitCostCents: costCentsSchema.nullable().optional(),
  estimatedUnitCostCents: costCentsSchema.nullable().optional(),
  actualUnitCostCents: costCentsSchema.nullable().optional(),
  needsCore: z.boolean().optional(),
  coreChargeCents: costCentsSchema.optional(),
  lastSupplierAccountId: uuidSchema.nullable().optional(),
  notes: optionalNullableStringSchema
});

export const routePartRequestLinesInputSchema = z.object({
  companyId: uuidSchema,
  requestId: uuidSchema,
  requestLineIds: z.array(uuidSchema).min(1).optional(),
  actorUserId: uuidSchema
});

export const addSupplierCartLineInputSchema = z.object({
  companyId: uuidSchema,
  supplierAccountId: uuidSchema,
  partRequestLineId: uuidSchema,
  providerQuoteLineId: uuidSchema.nullable().optional(),
  jobId: uuidSchema,
  quantity: procurementQuantitySchema,
  quotedUnitCostCents: costCentsSchema.nullable().optional(),
  quotedCoreChargeCents: costCentsSchema.optional(),
  supplierPartNumber: partNumberSchema,
  supplierUrl: supplierUrlSchema,
  availabilityText: optionalNullableStringSchema,
  notes: optionalNullableStringSchema
});

export const updateSupplierCartLineInputSchema = z.object({
  quantity: procurementQuantitySchema,
  quotedUnitCostCents: costCentsSchema.nullable().optional(),
  quotedCoreChargeCents: costCentsSchema.optional(),
  supplierPartNumber: partNumberSchema,
  supplierUrl: supplierUrlSchema,
  availabilityText: optionalNullableStringSchema,
  notes: optionalNullableStringSchema
});

export const convertSupplierCartToPurchaseOrderInputSchema = z.object({
  companyId: uuidSchema,
  cartId: uuidSchema,
  poNumber: poNumberSchema,
  orderedByUserId: uuidSchema,
  expectedAt: optionalNullableStringSchema,
  externalReference: optionalNullableStringSchema,
  manualOrderUrl: supplierUrlSchema,
  notes: optionalNullableStringSchema
});

export const markPurchaseOrderOrderedInputSchema = z.object({
  status: z.literal("ordered").optional(),
  orderedAt: optionalNullableStringSchema,
  expectedAt: optionalNullableStringSchema,
  externalReference: optionalNullableStringSchema,
  manualOrderUrl: supplierUrlSchema,
  notes: optionalNullableStringSchema
});

export const recordPurchaseReceiptInputSchema = z.object({
  companyId: uuidSchema,
  supplierAccountId: uuidSchema,
  purchaseOrderId: uuidSchema,
  receivedByUserId: uuidSchema,
  receivedAt: z.string().datetime({ offset: true }),
  receiptNumber: optionalNullableStringSchema,
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: uuidSchema,
        quantityReceived: procurementQuantitySchema,
        unitReceivedCostCents: costCentsSchema.nullable().optional(),
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
});

export const recordPartInstallationInputSchema = z.object({
  purchaseOrderLineId: uuidSchema,
  quantityInstalled: procurementQuantitySchema
});

export const createPartReturnInputSchema = z.object({
  companyId: uuidSchema,
  supplierAccountId: uuidSchema,
  purchaseOrderId: uuidSchema.nullable().optional(),
  returnedByUserId: uuidSchema,
  returnedAt: z.string().datetime({ offset: true }).nullable().optional(),
  returnNumber: optionalNullableStringSchema,
  reason: optionalNullableStringSchema,
  notes: optionalNullableStringSchema,
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: uuidSchema,
        quantityReturned: procurementQuantitySchema,
        isCoreReturn: z.boolean().optional(),
        creditAmountCents: costCentsSchema.nullable().optional(),
        notes: optionalNullableStringSchema
      })
    )
    .min(1)
});

export const markCoreDueInputSchema = z.object({
  purchaseOrderLineId: uuidSchema,
  quantityCoreDue: nonNegativeQuantitySchema
});

export const markCoreReturnedInputSchema = z.object({
  purchaseOrderLineId: uuidSchema,
  quantityCoreReturned: nonNegativeQuantitySchema
});

export const procurementWorkspaceQuerySchema = z.object({
  status: z
    .union([partLifecycleStatusSchema, purchaseOrderStatusSchema, partRequestStatusSchema])
    .optional(),
  supplierAccountId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  query: z.string().trim().min(1).optional()
});
