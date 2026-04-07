import {
  customerDocumentEventTypes,
  customerDocumentKinds,
  customerDocumentLinkStatuses
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";
import { approvalStatementSchema, signerNameSchema } from "./signature";

export const customerDocumentKindSchema = z.enum(customerDocumentKinds);
export const customerDocumentLinkStatusSchema = z.enum(customerDocumentLinkStatuses);
export const customerDocumentEventTypeSchema = z.enum(customerDocumentEventTypes);
export const customerDocumentTokenSchema = z.string().trim().min(24).max(512);
export const customerDocumentHashSchema = z.string().trim().length(64);
export const customerDocumentTimestampSchema = z.string().datetime({ offset: true });
export const customerDocumentUrlSchema = z.string().trim().url();

export const createCustomerDocumentLinkInputSchema = z
  .object({
    id: uuidSchema.optional(),
    companyId: uuidSchema,
    customerId: uuidSchema,
    jobId: uuidSchema,
    documentKind: customerDocumentKindSchema,
    estimateId: uuidSchema.nullable().optional(),
    invoiceId: uuidSchema.nullable().optional(),
    accessTokenHash: customerDocumentHashSchema,
    expiresAt: customerDocumentTimestampSchema,
    createdByUserId: uuidSchema
  })
  .superRefine((value, context) => {
    if (value.documentKind === "estimate") {
      if (!value.estimateId || value.invoiceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Estimate links require estimateId and must not include invoiceId.",
          path: ["estimateId"]
        });
      }
    }

    if (value.documentKind === "invoice") {
      if (!value.invoiceId || value.estimateId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invoice links require invoiceId and must not include estimateId.",
          path: ["invoiceId"]
        });
      }
    }

    if (value.documentKind === "job_visit" && (value.estimateId || value.invoiceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Job visit links must not include estimateId or invoiceId.",
        path: ["documentKind"]
      });
    }
  });

export const updateCustomerDocumentLinkViewInputSchema = z.object({
  viewedAt: customerDocumentTimestampSchema.optional()
});

export const updateCustomerDocumentLinkSentInputSchema = z.object({
  sentAt: customerDocumentTimestampSchema.optional(),
  communicationId: uuidSchema.nullable().optional()
});

export const completeCustomerDocumentLinkInputSchema = z.object({
  completedAt: customerDocumentTimestampSchema.optional()
});

export const revokeCustomerDocumentLinkInputSchema = z.object({
  revokedAt: customerDocumentTimestampSchema.optional(),
  reason: z.string().trim().min(1).max(4000).nullable().optional()
});

export const expireCustomerDocumentLinkInputSchema = z.object({
  expiredAt: customerDocumentTimestampSchema.optional()
});

export const recordCustomerDocumentLinkEventInputSchema = z
  .object({
    linkId: uuidSchema,
    companyId: uuidSchema,
    customerId: uuidSchema,
    jobId: uuidSchema,
    documentKind: customerDocumentKindSchema,
    estimateId: uuidSchema.nullable().optional(),
    invoiceId: uuidSchema.nullable().optional(),
    eventType: customerDocumentEventTypeSchema,
    occurredAt: customerDocumentTimestampSchema.optional(),
    ipAddress: z.string().trim().min(1).max(120).nullable().optional(),
    userAgent: z.string().trim().min(1).max(1000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdByUserId: uuidSchema.nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.documentKind === "estimate") {
      if (!value.estimateId || value.invoiceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Estimate link events require estimateId and must not include invoiceId.",
          path: ["estimateId"]
        });
      }
    }

    if (value.documentKind === "invoice") {
      if (!value.invoiceId || value.estimateId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invoice link events require invoiceId and must not include estimateId.",
          path: ["invoiceId"]
        });
      }
    }

    if (value.documentKind === "job_visit" && (value.estimateId || value.invoiceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Job visit link events must not include estimateId or invoiceId.",
        path: ["documentKind"]
      });
    }
  });

export const ensureEstimateAccessLinkInputSchema = z.object({
  estimateId: uuidSchema,
  actorUserId: uuidSchema,
  rotate: z.boolean().optional()
});

export const ensureInvoiceAccessLinkInputSchema = z.object({
  invoiceId: uuidSchema,
  actorUserId: uuidSchema,
  rotate: z.boolean().optional()
});

export const ensureJobVisitAccessLinkInputSchema = z.object({
  jobId: uuidSchema,
  actorUserId: uuidSchema,
  rotate: z.boolean().optional()
});

export const resolveCustomerDocumentAccessInputSchema = z.object({
  token: customerDocumentTokenSchema
});

export const approveEstimateViaLinkInputSchema = z.object({
  token: customerDocumentTokenSchema,
  signedByName: signerNameSchema,
  statement: approvalStatementSchema,
  signatureDataUrl: z.string().trim().startsWith("data:image/png;base64,")
});

export const declineEstimateViaLinkInputSchema = z.object({
  token: customerDocumentTokenSchema
});

export const createInvoiceCheckoutViaLinkInputSchema = z.object({
  token: customerDocumentTokenSchema
});