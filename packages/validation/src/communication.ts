import {
  communicationChannels,
  communicationEventTypes,
  communicationStatuses,
  communicationTriggerSources,
  communicationTypes,
  dispatchUpdateTypes,
  paymentReminderStages
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";
import { customerDocumentUrlSchema } from "./customer-document";

export const communicationChannelSchema = z.enum(communicationChannels);
export const communicationTypeSchema = z.enum(communicationTypes);
export const communicationStatusSchema = z.enum(communicationStatuses);
export const communicationEventTypeSchema = z.enum(communicationEventTypes);
export const communicationTriggerSourceSchema = z.enum(communicationTriggerSources);
export const paymentReminderStageSchema = z.enum(paymentReminderStages);
export const dispatchUpdateTypeSchema = z.enum(dispatchUpdateTypes);
export const communicationProviderSchema = z.string().trim().min(1).max(120);
export const communicationBodySchema = z.string().trim().min(1).max(12000);
export const communicationSubjectSchema = z.string().trim().min(1).max(240).nullable().optional();
export const communicationEmailSchema = z.string().trim().email().nullable().optional();
export const communicationPhoneSchema = z.string().trim().min(7).max(30).nullable().optional();
export const communicationTimestampSchema = z.string().datetime({ offset: true });
export const communicationJsonSchema = z.record(z.string(), z.unknown());

export const communicationListQuerySchema = z.object({
  communicationType: communicationTypeSchema.optional(),
  channel: communicationChannelSchema.optional(),
  status: communicationStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export const upsertCustomerCommunicationPreferenceInputSchema = z.object({
  companyId: uuidSchema,
  customerId: uuidSchema,
  preferredChannel: communicationChannelSchema.nullable().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  allowEstimateNotifications: z.boolean().optional(),
  allowInvoiceNotifications: z.boolean().optional(),
  allowPaymentReminders: z.boolean().optional(),
  allowAppointmentConfirmations: z.boolean().optional(),
  allowDispatchUpdates: z.boolean().optional()
});

export const createCommunicationEventInputSchema = z.object({
  companyId: uuidSchema,
  customerId: uuidSchema,
  jobId: uuidSchema.nullable().optional(),
  estimateId: uuidSchema.nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  paymentId: uuidSchema.nullable().optional(),
  eventType: communicationEventTypeSchema,
  communicationType: communicationTypeSchema,
  triggerSource: communicationTriggerSourceSchema,
  actorUserId: uuidSchema.nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(240),
  scheduledFor: communicationTimestampSchema.optional(),
  occurredAt: communicationTimestampSchema.optional(),
  payload: communicationJsonSchema
});

export const createQueuedCustomerCommunicationInputSchema = z.object({
  companyId: uuidSchema,
  customerId: uuidSchema,
  jobId: uuidSchema.nullable().optional(),
  estimateId: uuidSchema.nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  paymentId: uuidSchema.nullable().optional(),
  eventId: uuidSchema.nullable().optional(),
  communicationType: communicationTypeSchema,
  channel: communicationChannelSchema,
  recipientName: z.string().trim().min(1).max(160),
  recipientEmail: communicationEmailSchema,
  recipientPhone: communicationPhoneSchema,
  subject: communicationSubjectSchema,
  bodyText: communicationBodySchema,
  bodyHtml: z.string().trim().min(1).max(30000).nullable().optional(),
  provider: communicationProviderSchema,
  createdByUserId: uuidSchema.nullable().optional()
});

export const sendEstimateNotificationInputSchema = z.object({
  estimateId: uuidSchema,
  channel: communicationChannelSchema.optional(),
  actorUserId: uuidSchema,
  actionUrl: customerDocumentUrlSchema.nullable().optional(),
  resend: z.boolean().optional()
});

export const sendInvoiceNotificationInputSchema = z.object({
  invoiceId: uuidSchema,
  channel: communicationChannelSchema.optional(),
  actorUserId: uuidSchema,
  actionUrl: customerDocumentUrlSchema.nullable().optional(),
  resend: z.boolean().optional()
});

export const sendPaymentReminderInputSchema = z.object({
  invoiceId: uuidSchema,
  channel: communicationChannelSchema.optional(),
  actorUserId: uuidSchema,
  actionUrl: customerDocumentUrlSchema.nullable().optional(),
  resend: z.boolean().optional(),
  reminderStage: paymentReminderStageSchema.optional()
});

export const sendAppointmentConfirmationInputSchema = z.object({
  jobId: uuidSchema,
  channel: communicationChannelSchema.optional(),
  actorUserId: uuidSchema,
  visitUrl: customerDocumentUrlSchema.nullable().optional(),
  resend: z.boolean().optional()
});

export const sendDispatchUpdateInputSchema = z.object({
  jobId: uuidSchema,
  channel: communicationChannelSchema.optional(),
  actorUserId: uuidSchema,
  visitUrl: customerDocumentUrlSchema.nullable().optional(),
  resend: z.boolean().optional(),
  updateType: dispatchUpdateTypeSchema
});

export const updateCustomerCommunicationStatusInputSchema = z.object({
  status: communicationStatusSchema,
  providerMessageId: z.string().trim().min(1).max(240).nullable().optional(),
  providerMetadata: communicationJsonSchema.optional(),
  errorCode: z.string().trim().min(1).max(120).nullable().optional(),
  errorMessage: z.string().trim().min(1).max(4000).nullable().optional(),
  sentAt: communicationTimestampSchema.nullable().optional(),
  deliveredAt: communicationTimestampSchema.nullable().optional(),
  failedAt: communicationTimestampSchema.nullable().optional()
});

export const createCommunicationDeliveryAttemptInputSchema = z.object({
  communicationId: uuidSchema,
  attemptNumber: z.number().int().min(1),
  provider: communicationProviderSchema,
  requestPayload: communicationJsonSchema.optional(),
  responsePayload: communicationJsonSchema.optional(),
  succeeded: z.boolean(),
  errorMessage: z.string().trim().min(1).max(4000).nullable().optional()
});
