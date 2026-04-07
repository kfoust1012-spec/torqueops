import { z } from "zod";

import {
  amazonBusinessRegions,
  procurementProviderAccountStatuses,
  procurementProviderOrderStatuses,
  procurementProviders,
  procurementProviderQuoteStatuses,
  procurementProviderSupplierMappingStatuses
} from "@mobile-mechanic/types";

import { optionalNullableStringSchema, uuidSchema } from "./common";
import { vinSchema } from "./vehicle";

const trimmedString = z.string().trim().min(1);
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const procurementProviderSchema = z.enum(procurementProviders);
export const procurementProviderAccountStatusSchema = z.enum(
  procurementProviderAccountStatuses
);
export const procurementProviderSupplierMappingStatusSchema = z.enum(
  procurementProviderSupplierMappingStatuses
);
export const persistedProcurementProviderSupplierMappingStatusSchema = z.enum([
  "active",
  "pending_approval",
  "disabled"
]);
export const procurementProviderQuoteStatusSchema = z.enum(
  procurementProviderQuoteStatuses
);
export const procurementProviderOrderStatusSchema = z.enum(
  procurementProviderOrderStatuses
);

export const partsTechUsernameSchema = trimmedString.max(160);
export const partsTechApiKeySchema = trimmedString.max(240);
export const repairLinkUsernameSchema = trimmedString.max(160);
export const repairLinkPasswordSchema = trimmedString.max(240);
export const amazonBusinessAccountEmailSchema = trimmedString.email().max(160);
export const amazonBusinessRegionSchema = z.enum(amazonBusinessRegions);
export const amazonBusinessBuyerEmailModeSchema = z.enum(["authorized_user", "override"]);
export const providerSupplierKeySchema = trimmedString.max(160);
export const providerOfferKeySchema = trimmedString.max(200);
export const providerProductKeySchema = trimmedString.max(200);
export const providerTextSchema = trimmedString.max(2000);
export const providerQuantitySchema = z.number().positive().max(9999);
export const providerCostCentsSchema = z.number().int().min(0).max(10_000_000);

export const partsTechVehicleContextSchema = z.object({
  year: z.number().int().min(1900).max(2100).nullable(),
  make: optionalNullableStringSchema,
  model: optionalNullableStringSchema,
  engine: optionalNullableStringSchema,
  vin: optionalNullableStringSchema,
  licensePlate: optionalNullableStringSchema
});

export const repairLinkVehicleContextSchema = partsTechVehicleContextSchema.extend({
  vin: vinSchema.unwrap()
});

export const repairLinkDealerMappingIdsSchema = z.array(uuidSchema).min(1);

const partstechAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: z.literal("partstech"),
  displayName: trimmedString.max(120),
  username: partsTechUsernameSchema,
  apiKey: partsTechApiKeySchema
});

const repairLinkAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: z.literal("repairlink"),
  displayName: trimmedString.max(120),
  username: repairLinkUsernameSchema,
  password: repairLinkPasswordSchema,
  preferredDealerMappingIds: z.array(uuidSchema).optional(),
  defaultFallbackMode: z.enum(["manual_capture", "manual_link_out"]).optional()
});

export const upsertAmazonBusinessAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: z.literal("amazon_business"),
  displayName: trimmedString.max(120),
  accountEmail: amazonBusinessAccountEmailSchema,
  defaultSupplierAccountId: uuidSchema.nullable().optional(),
  region: amazonBusinessRegionSchema,
  buyingGroupId: optionalNullableStringSchema,
  buyerEmailMode: amazonBusinessBuyerEmailModeSchema.optional(),
  buyerEmailOverride: optionalNullableStringSchema,
  defaultShippingAddressText: optionalNullableStringSchema,
  defaultFallbackMode: z.enum(["manual_capture", "manual_link_out"]).optional()
});

export const upsertProcurementProviderAccountInputSchema = z.discriminatedUnion("provider", [
  partstechAccountInputSchema,
  repairLinkAccountInputSchema,
  upsertAmazonBusinessAccountInputSchema
]);

export const verifyProcurementProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: procurementProviderSchema
});

export const disconnectProcurementProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: procurementProviderSchema
});

export const upsertProcurementProviderSupplierMappingInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  supplierAccountId: uuidSchema,
  providerSupplierKey: providerSupplierKeySchema,
  providerSupplierName: trimmedString.max(160),
  providerLocationKey: optionalNullableStringSchema,
  status: persistedProcurementProviderSupplierMappingStatusSchema,
  supportsQuote: z.boolean().optional(),
  supportsOrder: z.boolean().optional(),
  metadataJson: jsonRecordSchema.optional()
});

export const searchPartsTechOffersInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  requestId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  requestedByUserId: uuidSchema,
  selectedPartRequestLineIds: z.array(uuidSchema).min(1).optional(),
  searchTerms: z.array(trimmedString.max(160)).min(1),
  vehicle: partsTechVehicleContextSchema
});

export const searchRepairLinkOffersInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  requestId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  requestedByUserId: uuidSchema,
  selectedPartRequestLineIds: z.array(uuidSchema).min(1).optional(),
  selectedDealerMappingIds: repairLinkDealerMappingIdsSchema,
  vehicle: repairLinkVehicleContextSchema
});

export const searchAmazonBusinessOffersInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  requestId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  requestedByUserId: uuidSchema,
  selectedPartRequestLineIds: z.array(uuidSchema).min(1),
  searchTerms: z.array(trimmedString.max(160)).min(1),
  supplyListId: uuidSchema.nullable().optional()
});

export const createProcurementProviderQuoteInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  partRequestId: uuidSchema,
  requestedByUserId: uuidSchema,
  vehicleContextJson: jsonRecordSchema.optional(),
  searchContextJson: jsonRecordSchema.optional(),
  status: procurementProviderQuoteStatusSchema.optional(),
  expiresAt: optionalNullableStringSchema,
  metadataJson: jsonRecordSchema.optional()
});

export const createProcurementProviderQuoteLineInputSchema = z.object({
  companyId: uuidSchema,
  providerQuoteId: uuidSchema,
  partRequestLineId: uuidSchema,
  providerSupplierMappingId: uuidSchema.nullable().optional(),
  providerOfferKey: providerOfferKeySchema,
  providerProductKey: providerProductKeySchema.nullable().optional(),
  providerLocationKey: optionalNullableStringSchema,
  providerSupplierKey: providerSupplierKeySchema,
  providerSupplierName: trimmedString.max(160),
  description: trimmedString.max(240),
  manufacturer: optionalNullableStringSchema,
  partNumber: optionalNullableStringSchema,
  quantity: providerQuantitySchema,
  unitPriceCents: providerCostCentsSchema.nullable().optional(),
  coreChargeCents: providerCostCentsSchema.nullable().optional(),
  availabilityText: optionalNullableStringSchema,
  etaText: optionalNullableStringSchema,
  selectedForCart: z.boolean().optional(),
  rawResponseJson: jsonRecordSchema.optional()
});

export const selectProviderQuoteLineForCartInputSchema = z.object({
  companyId: uuidSchema,
  providerQuoteLineId: uuidSchema,
  actorUserId: uuidSchema
});

export const createManualRepairLinkQuoteLineInputSchema = z.object({
  companyId: uuidSchema,
  requestId: uuidSchema,
  partRequestLineId: uuidSchema,
  requestedByUserId: uuidSchema,
  providerSupplierMappingId: uuidSchema,
  description: trimmedString.max(240),
  partNumber: optionalNullableStringSchema,
  quantity: providerQuantitySchema,
  unitPriceCents: providerCostCentsSchema.nullable().optional(),
  coreChargeCents: providerCostCentsSchema.nullable().optional(),
  availabilityText: optionalNullableStringSchema,
  etaText: optionalNullableStringSchema
});

export const createManualAmazonBusinessQuoteLineInputSchema = z.object({
  companyId: uuidSchema,
  requestId: uuidSchema,
  partRequestLineId: uuidSchema,
  requestedByUserId: uuidSchema,
  description: trimmedString.max(240),
  partNumber: optionalNullableStringSchema,
  providerProductKey: providerProductKeySchema.nullable().optional(),
  quantity: providerQuantitySchema,
  unitPriceCents: providerCostCentsSchema.nullable().optional(),
  availabilityText: optionalNullableStringSchema,
  etaText: optionalNullableStringSchema
});

export const submitProviderPurchaseOrderInputSchema = z.object({
  companyId: uuidSchema,
  providerAccountId: uuidSchema,
  purchaseOrderId: uuidSchema,
  providerQuoteId: uuidSchema.nullable().optional(),
  actorUserId: uuidSchema,
  manualReference: optionalNullableStringSchema,
  notes: optionalNullableStringSchema
});

export const submitAmazonBusinessPurchaseOrderInputSchema =
  submitProviderPurchaseOrderInputSchema.extend({
    provider: z.literal("amazon_business")
  });
