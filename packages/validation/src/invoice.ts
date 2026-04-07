import { invoiceLineItemTypes, invoiceStatuses } from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";

export const invoiceStatusSchema = z.enum(invoiceStatuses);
export const invoiceLineItemTypeSchema = z.enum(invoiceLineItemTypes);
export const invoiceNumberSchema = z.string().trim().min(1).max(50);
export const invoiceTitleSchema = z.string().trim().min(1).max(160);
export const invoiceLongTextSchema = z.string().trim().min(1).max(4000).nullable().optional();
export const invoiceCurrencyCodeSchema = z.literal("USD");
export const invoiceDiscountSchema = z.number().int().min(0);
export const invoiceTaxRateBasisPointsSchema = z.number().int().min(0).max(2500);
export const invoiceQuantitySchema = z.number().positive().max(100000);
export const invoiceUnitPriceCentsSchema = z.number().int().min(0);
export const invoiceDueAtSchema = z.string().datetime({ offset: true }).nullable().optional();

export const createInvoiceInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema.nullable().optional(),
  invoiceNumber: invoiceNumberSchema,
  title: invoiceTitleSchema,
  notes: invoiceLongTextSchema,
  terms: invoiceLongTextSchema,
  taxRateBasisPoints: invoiceTaxRateBasisPointsSchema.optional(),
  discountCents: invoiceDiscountSchema.optional(),
  dueAt: invoiceDueAtSchema,
  createdByUserId: uuidSchema
});

export const createInvoiceFromEstimateInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  estimateId: uuidSchema,
  invoiceNumber: invoiceNumberSchema,
  createdByUserId: uuidSchema
});

export const updateInvoiceInputSchema = z.object({
  invoiceNumber: invoiceNumberSchema,
  title: invoiceTitleSchema,
  notes: invoiceLongTextSchema,
  terms: invoiceLongTextSchema,
  taxRateBasisPoints: invoiceTaxRateBasisPointsSchema.optional(),
  discountCents: invoiceDiscountSchema.optional(),
  dueAt: invoiceDueAtSchema
});

export const createInvoiceLineItemInputSchema = z.object({
  itemType: invoiceLineItemTypeSchema,
  name: z.string().trim().min(1).max(160),
  description: invoiceLongTextSchema,
  quantity: invoiceQuantitySchema,
  unitPriceCents: invoiceUnitPriceCentsSchema,
  taxable: z.boolean().optional()
});

export const updateInvoiceLineItemInputSchema = createInvoiceLineItemInputSchema;

export const changeInvoiceStatusInputSchema = z.object({
  status: invoiceStatusSchema
});

export const invoiceListQuerySchema = z.object({
  status: invoiceStatusSchema.optional(),
  query: z.string().trim().max(160).optional()
});
