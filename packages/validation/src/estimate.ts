import {
  estimateLineItemTypes,
  estimateLiveRetailerSearchProviders,
  estimateSectionSources,
  estimateStatuses,
  procurementProviders
} from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";
import { costCentsSchema, partNumberSchema, supplierUrlSchema } from "./procurement";

export const estimateStatusSchema = z.enum(estimateStatuses);
export const estimateLineItemTypeSchema = z.enum(estimateLineItemTypes);
export const estimateSectionSourceSchema = z.enum(estimateSectionSources);
export const estimateNumberSchema = z.string().trim().min(1).max(50);
export const estimateTitleSchema = z.string().trim().min(1).max(160);
export const estimateSectionTitleSchema = z.string().trim().min(1).max(120);
export const estimateLongTextSchema = z.string().trim().min(1).max(4000).nullable().optional();
export const estimateCurrencyCodeSchema = z.literal("USD");
export const estimateDiscountSchema = z.number().int().min(0);
export const estimateTaxRateBasisPointsSchema = z.number().int().min(0).max(2500);
export const estimateQuantitySchema = z.number().positive().max(100000);
export const estimateUnitPriceCentsSchema = z.number().int().min(0);
export const estimateServicePackageNameSchema = z.string().trim().min(1).max(120);
export const estimateSortOrderSchema = z.number().int().min(0).max(9999);

export const createEstimateInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateNumber: estimateNumberSchema,
  title: estimateTitleSchema,
  notes: estimateLongTextSchema,
  terms: estimateLongTextSchema,
  taxRateBasisPoints: estimateTaxRateBasisPointsSchema.optional(),
  discountCents: estimateDiscountSchema.optional(),
  createdByUserId: uuidSchema
});

export const updateEstimateInputSchema = z.object({
  estimateNumber: estimateNumberSchema,
  title: estimateTitleSchema,
  notes: estimateLongTextSchema,
  terms: estimateLongTextSchema,
  taxRateBasisPoints: estimateTaxRateBasisPointsSchema.optional(),
  discountCents: estimateDiscountSchema.optional()
});

const estimateLineItemInputSchema = z.object({
  estimateSectionId: uuidSchema.nullable().optional(),
  itemType: estimateLineItemTypeSchema,
  name: z.string().trim().min(1).max(160),
  description: estimateLongTextSchema,
  quantity: estimateQuantitySchema,
  unitPriceCents: estimateUnitPriceCentsSchema,
  taxable: z.boolean().optional()
});

export const createEstimateLineItemInputSchema = estimateLineItemInputSchema;

export const updateEstimateLineItemInputSchema = createEstimateLineItemInputSchema;

export const changeEstimateStatusInputSchema = z.object({
  status: estimateStatusSchema
});

export const estimateListQuerySchema = z.object({
  status: estimateStatusSchema.optional(),
  query: z.string().trim().max(160).optional()
});

export const createEstimateSectionInputSchema = z.object({
  estimateId: uuidSchema,
  companyId: uuidSchema,
  jobId: uuidSchema,
  title: estimateSectionTitleSchema,
  description: estimateLongTextSchema,
  notes: estimateLongTextSchema,
  source: estimateSectionSourceSchema.optional(),
  sourceRef: z.string().trim().min(1).max(160).nullable().optional(),
  createdByUserId: uuidSchema
});

export const updateEstimateSectionInputSchema = z.object({
  title: estimateSectionTitleSchema,
  description: estimateLongTextSchema,
  notes: estimateLongTextSchema,
  position: estimateSortOrderSchema.optional()
});

export const moveEstimateLineItemInputSchema = z.object({
  estimateSectionId: uuidSchema.nullable().optional(),
  position: estimateSortOrderSchema
});

export const estimateServicePackageLineInputSchema = z.object({
  itemType: estimateLineItemTypeSchema,
  name: z.string().trim().min(1).max(160),
  description: estimateLongTextSchema,
  quantity: estimateQuantitySchema,
  unitPriceCents: estimateUnitPriceCentsSchema,
  taxable: z.boolean().optional(),
  manufacturer: optionalNullableStringSchema,
  partNumber: optionalNullableStringSchema,
  supplierSku: optionalNullableStringSchema
});

export const createEstimateServicePackageInputSchema = z.object({
  companyId: uuidSchema,
  name: estimateServicePackageNameSchema,
  description: estimateLongTextSchema,
  notes: estimateLongTextSchema,
  sortOrder: estimateSortOrderSchema.optional(),
  createdByUserId: uuidSchema,
  lines: z.array(estimateServicePackageLineInputSchema).min(1).max(30)
});

export const updateEstimateServicePackageInputSchema = z.object({
  name: estimateServicePackageNameSchema,
  description: estimateLongTextSchema,
  notes: estimateLongTextSchema,
  sortOrder: estimateSortOrderSchema.optional(),
  isActive: z.boolean().optional(),
  lines: z.array(estimateServicePackageLineInputSchema).min(1).max(30)
});

export const applyEstimateServicePackageInputSchema = z.object({
  servicePackageId: uuidSchema,
  targetSectionTitle: estimateSectionTitleSchema.nullable().optional()
});

export const saveEstimateSectionAsPackageInputSchema = z.object({
  name: estimateServicePackageNameSchema,
  description: estimateLongTextSchema,
  notes: estimateLongTextSchema
});

export const searchEstimatePartOffersInputSchema = z.object({
  lineItemId: uuidSchema,
  provider: z.enum(procurementProviders),
  searchTerms: z.array(z.string().trim().min(1).max(160)).max(8).optional(),
  selectedDealerMappingIds: z.array(uuidSchema).max(12).optional()
});

export const selectEstimatePartOfferInputSchema = z.object({
  lineItemId: uuidSchema,
  providerQuoteLineId: uuidSchema
});

export const createEstimateManualPartOfferInputSchema = z.object({
  lineItemId: uuidSchema,
  supplierAccountId: uuidSchema,
  supplierPartNumber: partNumberSchema,
  quotedUnitCostCents: costCentsSchema,
  quotedCoreChargeCents: costCentsSchema.optional(),
  availabilityText: optionalNullableStringSchema,
  supplierUrl: supplierUrlSchema,
  notes: estimateLongTextSchema,
  selectAfterCreate: z.boolean().optional()
});

export const selectEstimateManualPartOfferInputSchema = z.object({
  lineItemId: uuidSchema,
  supplierCartLineId: uuidSchema
});

export const selectEstimateCatalogPartOfferInputSchema = z.object({
  lineItemId: uuidSchema,
  offerId: z.string().trim().min(1).max(160)
});

export const searchEstimateLiveRetailerOffersInputSchema = z.object({
  lineItemId: uuidSchema,
  query: z.string().trim().min(1).max(240).nullable().optional(),
  provider: z.enum(estimateLiveRetailerSearchProviders).optional(),
  limit: z.number().int().min(1).max(8).optional()
});

const estimateLiveRetailerOfferInputSchema = z.object({
  id: z.string().trim().min(1).max(240),
  provider: z.enum(estimateLiveRetailerSearchProviders),
  supplierLabel: z.string().trim().min(1).max(120),
  supplierUrl: supplierUrlSchema,
  manufacturer: optionalNullableStringSchema,
  partNumber: partNumberSchema,
  description: z.string().trim().min(1).max(240),
  quotedUnitCostCents: costCentsSchema,
  quotedCoreChargeCents: costCentsSchema,
  availabilityText: optionalNullableStringSchema,
  fitmentNotes: estimateLongTextSchema,
  searchQuery: z.string().trim().min(1).max(240)
});

export const selectEstimateLiveRetailerOfferInputSchema = z.object({
  lineItemId: uuidSchema,
  offer: estimateLiveRetailerOfferInputSchema
});
