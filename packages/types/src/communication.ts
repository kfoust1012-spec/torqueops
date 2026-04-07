import type { Json, UUID } from "./common";
import type { TimestampFields } from "./common";
import type { PublicTechnicianProfile } from "./technician-profile";

export const communicationChannels = ["email", "sms"] as const;

export type CommunicationChannel = (typeof communicationChannels)[number];

export const communicationTypes = [
  "estimate_notification",
  "invoice_notification",
  "payment_reminder",
  "appointment_confirmation",
  "dispatch_update"
] as const;

export type CommunicationType = (typeof communicationTypes)[number];

export const communicationStatuses = [
  "queued",
  "processing",
  "sent",
  "delivered",
  "failed",
  "canceled"
] as const;

export type CommunicationStatus = (typeof communicationStatuses)[number];

export const communicationEventTypes = [
  "estimate_notification_requested",
  "invoice_notification_requested",
  "payment_reminder_requested",
  "appointment_confirmation_requested",
  "dispatch_update_requested"
] as const;

export type CommunicationEventType = (typeof communicationEventTypes)[number];

export const communicationTriggerSources = ["manual", "workflow", "system", "webhook"] as const;

export type CommunicationTriggerSource = (typeof communicationTriggerSources)[number];

export const paymentReminderStages = ["upcoming", "due", "overdue"] as const;

export type PaymentReminderStage = (typeof paymentReminderStages)[number];

export const dispatchUpdateTypes = ["dispatched", "en_route", "running_late"] as const;

export type DispatchUpdateType = (typeof dispatchUpdateTypes)[number];

export interface CustomerCommunicationPreference extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  preferredChannel: CommunicationChannel | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  allowEstimateNotifications: boolean;
  allowInvoiceNotifications: boolean;
  allowPaymentReminders: boolean;
  allowAppointmentConfirmations: boolean;
  allowDispatchUpdates: boolean;
}

export interface CommunicationRecipientSnapshot {
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
}

export interface EstimateNotificationPayload {
  estimateNumber: string;
  estimateTitle: string;
  totalCents: number;
  jobTitle: string;
  customerName: string;
  vehicleLabel: string;
  companyTimeZone: string;
  actionUrl?: string | null;
}

export interface InvoiceNotificationPayload {
  invoiceNumber: string;
  invoiceTitle: string;
  totalCents: number;
  balanceDueCents: number;
  dueAt: string | null;
  customerName: string;
  jobTitle: string;
  companyTimeZone: string;
  paymentUrl: string | null;
  actionUrl?: string | null;
}

export interface PaymentReminderPayload {
  invoiceNumber: string;
  invoiceTitle: string;
  balanceDueCents: number;
  dueAt: string;
  reminderStage: PaymentReminderStage;
  customerName: string;
  jobTitle: string;
  companyTimeZone: string;
  paymentUrl: string | null;
  actionUrl?: string | null;
}

export interface AppointmentConfirmationPayload {
  customerName: string;
  jobTitle: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  companyTimeZone: string;
  technicianName: string | null;
  technicianProfile: PublicTechnicianProfile | null;
  serviceAddress: string | null;
  visitUrl?: string | null;
  actionUrl?: string | null;
}

export interface DispatchUpdatePayload {
  customerName: string;
  jobTitle: string;
  updateType: DispatchUpdateType;
  technicianName: string | null;
  technicianProfile: PublicTechnicianProfile | null;
  scheduledStartAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  companyTimeZone: string;
  serviceAddress: string | null;
  visitUrl?: string | null;
  actionUrl?: string | null;
}

export type CommunicationTemplatePayload =
  | EstimateNotificationPayload
  | InvoiceNotificationPayload
  | PaymentReminderPayload
  | AppointmentConfirmationPayload
  | DispatchUpdatePayload;

export interface CommunicationEvent extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID | null;
  estimateId: UUID | null;
  invoiceId: UUID | null;
  paymentId: UUID | null;
  eventType: CommunicationEventType;
  communicationType: CommunicationType;
  triggerSource: CommunicationTriggerSource;
  actorUserId: UUID | null;
  idempotencyKey: string;
  scheduledFor: string;
  occurredAt: string;
  payload: Json;
  processedAt: string | null;
  failedAt: string | null;
  failureMessage: string | null;
}

export interface CustomerCommunicationLogEntry extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID | null;
  estimateId: UUID | null;
  invoiceId: UUID | null;
  paymentId: UUID | null;
  eventId: UUID | null;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  provider: string;
  providerMessageId: string | null;
  providerMetadata: Json;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdByUserId: UUID | null;
}

export interface CommunicationDeliveryAttempt extends TimestampFields {
  id: UUID;
  communicationId: UUID;
  attemptNumber: number;
  provider: string;
  requestPayload: Json;
  responsePayload: Json;
  succeeded: boolean;
  errorMessage: string | null;
  attemptedAt: string;
}

export interface CommunicationListQuery {
  communicationType?: CommunicationType | undefined;
  channel?: CommunicationChannel | undefined;
  status?: CommunicationStatus | undefined;
  limit?: number | undefined;
}

export interface UpsertCustomerCommunicationPreferenceInput {
  companyId: UUID;
  customerId: UUID;
  preferredChannel?: CommunicationChannel | null | undefined;
  emailEnabled?: boolean | undefined;
  smsEnabled?: boolean | undefined;
  allowEstimateNotifications?: boolean | undefined;
  allowInvoiceNotifications?: boolean | undefined;
  allowPaymentReminders?: boolean | undefined;
  allowAppointmentConfirmations?: boolean | undefined;
  allowDispatchUpdates?: boolean | undefined;
}

export interface CreateCommunicationEventInput {
  companyId: UUID;
  customerId: UUID;
  jobId?: UUID | null | undefined;
  estimateId?: UUID | null | undefined;
  invoiceId?: UUID | null | undefined;
  paymentId?: UUID | null | undefined;
  eventType: CommunicationEventType;
  communicationType: CommunicationType;
  triggerSource: CommunicationTriggerSource;
  actorUserId?: UUID | null | undefined;
  idempotencyKey: string;
  scheduledFor?: string | undefined;
  occurredAt?: string | undefined;
  payload: Json;
}

export interface CreateQueuedCustomerCommunicationInput {
  companyId: UUID;
  customerId: UUID;
  jobId?: UUID | null | undefined;
  estimateId?: UUID | null | undefined;
  invoiceId?: UUID | null | undefined;
  paymentId?: UUID | null | undefined;
  eventId?: UUID | null | undefined;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  recipientName: string;
  recipientEmail?: string | null | undefined;
  recipientPhone?: string | null | undefined;
  subject?: string | null | undefined;
  bodyText: string;
  bodyHtml?: string | null | undefined;
  provider: string;
  createdByUserId?: UUID | null | undefined;
}

export interface SendEstimateNotificationInput {
  estimateId: UUID;
  channel?: CommunicationChannel | undefined;
  actorUserId: UUID;
  actionUrl?: string | null | undefined;
  resend?: boolean | undefined;
}

export interface SendInvoiceNotificationInput {
  invoiceId: UUID;
  channel?: CommunicationChannel | undefined;
  actorUserId: UUID;
  actionUrl?: string | null | undefined;
  resend?: boolean | undefined;
}

export interface SendPaymentReminderInput {
  invoiceId: UUID;
  channel?: CommunicationChannel | undefined;
  actorUserId: UUID;
  actionUrl?: string | null | undefined;
  resend?: boolean | undefined;
  reminderStage?: PaymentReminderStage | undefined;
}

export interface SendAppointmentConfirmationInput {
  jobId: UUID;
  channel?: CommunicationChannel | undefined;
  actorUserId: UUID;
  visitUrl?: string | null | undefined;
  resend?: boolean | undefined;
}

export interface SendDispatchUpdateInput {
  jobId: UUID;
  channel?: CommunicationChannel | undefined;
  actorUserId: UUID;
  visitUrl?: string | null | undefined;
  resend?: boolean | undefined;
  updateType: DispatchUpdateType;
}

export interface UpdateCustomerCommunicationStatusInput {
  status: CommunicationStatus;
  providerMessageId?: string | null | undefined;
  providerMetadata?: Json | undefined;
  errorCode?: string | null | undefined;
  errorMessage?: string | null | undefined;
  sentAt?: string | null | undefined;
  deliveredAt?: string | null | undefined;
  failedAt?: string | null | undefined;
}

export interface CreateCommunicationDeliveryAttemptInput {
  communicationId: UUID;
  attemptNumber: number;
  provider: string;
  requestPayload?: Json | undefined;
  responsePayload?: Json | undefined;
  succeeded: boolean;
  errorMessage?: string | null | undefined;
}
