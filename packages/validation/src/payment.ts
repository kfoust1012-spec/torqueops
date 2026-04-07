import {
  paymentProviders,
  paymentStatuses,
  technicianPaymentTenderTypes
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";

export const paymentStatusSchema = z.enum(paymentStatuses);
export const paymentProviderSchema = z.enum(paymentProviders);
export const paymentTenderTypeSchema = z.enum(technicianPaymentTenderTypes);
export const stripeCheckoutSessionIdSchema = z.string().trim().min(1).max(255);
export const stripePaymentIntentIdSchema = z.string().trim().min(1).max(255).nullable().optional();
export const stripeChargeIdSchema = z.string().trim().min(1).max(255).nullable().optional();
export const stripeEventIdSchema = z.string().trim().min(1).max(255);
export const paymentUrlSchema = z.string().trim().url().nullable();
export const paymentIsoDateTimeSchema = z.string().datetime({ offset: true });
export const paymentReferenceNoteSchema = z.string().trim().min(1).max(1000).nullable().optional();

export const updateInvoicePaymentLinkInputSchema = z.object({
  paymentUrl: paymentUrlSchema,
  paymentUrlExpiresAt: paymentIsoDateTimeSchema.nullable(),
  stripeCheckoutSessionId: stripeCheckoutSessionIdSchema.nullable()
});

export const recordStripeInvoicePaymentInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  invoiceId: uuidSchema,
  stripeCheckoutSessionId: stripeCheckoutSessionIdSchema,
  stripePaymentIntentId: stripePaymentIntentIdSchema,
  stripeChargeId: stripeChargeIdSchema,
  stripeEventId: stripeEventIdSchema,
  amountCents: z.number().int().positive(),
  currencyCode: z.literal("USD"),
  receiptUrl: z.string().trim().url().nullable().optional(),
  paidAt: paymentIsoDateTimeSchema.optional()
});

export const recordManualInvoicePaymentInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  invoiceId: uuidSchema,
  tenderType: paymentTenderTypeSchema,
  amountCents: z.number().int().positive(),
  currencyCode: z.literal("USD"),
  note: paymentReferenceNoteSchema,
  recordedByUserId: uuidSchema.nullable().optional(),
  paidAt: paymentIsoDateTimeSchema.optional()
});
