import {
  buildAppointmentConfirmationBody,
  buildAppointmentConfirmationSubject,
  buildCommunicationIdempotencyKey,
  buildDispatchUpdateBody,
  buildDispatchUpdateSubject,
  buildEstimateNotificationBody,
  buildEstimateNotificationSubject,
  buildInvoiceNotificationBody,
  buildInvoiceNotificationSubject,
  buildPaymentReminderBody,
  buildPaymentReminderSubject,
  canSendCommunicationType,
  formatServiceAddressSummary,
  hasPublicTechnicianProfile,
  getCustomerDisplayName,
  getPaymentReminderStage,
  toPublicTechnicianProfile,
  getVehicleDisplayName,
  isInvoiceEligibleForReminder,
  resolveCommunicationChannel
} from "@mobile-mechanic/core";
import type {
  AppointmentConfirmationPayload,
  CommunicationDeliveryAttempt,
  CommunicationEvent,
  CommunicationListQuery,
  CreateCommunicationDeliveryAttemptInput,
  CreateCommunicationEventInput,
  CreateQueuedCustomerCommunicationInput,
  CustomerCommunicationLogEntry,
  CustomerCommunicationPreference,
  Database,
  DispatchUpdatePayload,
  InvoiceNotificationPayload,
  Json,
  PaymentReminderPayload,
  SendAppointmentConfirmationInput,
  SendDispatchUpdateInput,
  SendEstimateNotificationInput,
  SendInvoiceNotificationInput,
  SendPaymentReminderInput,
  UpdateCustomerCommunicationStatusInput,
  UpsertCustomerCommunicationPreferenceInput
} from "@mobile-mechanic/types";
import {
  communicationListQuerySchema,
  createCommunicationDeliveryAttemptInputSchema,
  createCommunicationEventInputSchema,
  createQueuedCustomerCommunicationInputSchema,
  sendAppointmentConfirmationInputSchema,
  sendDispatchUpdateInputSchema,
  sendEstimateNotificationInputSchema,
  sendInvoiceNotificationInputSchema,
  sendPaymentReminderInputSchema,
  updateCustomerCommunicationStatusInputSchema,
  upsertCustomerCommunicationPreferenceInputSchema
} from "@mobile-mechanic/validation";

import { getCustomerById } from "./customers";
import { getCompanyById } from "./companies";
import { getEstimateDetailById } from "./estimates";
import { getInvoiceDetailById } from "./invoices";
import { getJobById } from "./jobs";
import { getPaymentById } from "./payments";
import { createProfilePhotoSignedUrl, listProfilesByIds, mapProfileRowToTechnicianProfile } from "./profiles";
import { getDefaultSmsProviderAccountByCompany } from "./sms-provider-accounts";
import { getVehicleById } from "./vehicles";
import type { AppSupabaseClient } from "../supabase/types";
import { getCommunicationAutomationSettings } from "./communication-automation-settings";

type CommunicationPreferenceRow =
  Database["public"]["Tables"]["customer_communication_preferences"]["Row"];
type CommunicationEventRow = Database["public"]["Tables"]["communication_events"]["Row"];
type CustomerCommunicationRow = Database["public"]["Tables"]["customer_communications"]["Row"];
type DeliveryAttemptRow = Database["public"]["Tables"]["communication_delivery_attempts"]["Row"];
type CustomerAddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];

function asJson(value: unknown): Json {
  return (value ?? null) as Json;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function mapPreferenceRow(row: CommunicationPreferenceRow): CustomerCommunicationPreference {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    preferredChannel: row.preferred_channel,
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    allowEstimateNotifications: row.allow_estimate_notifications,
    allowInvoiceNotifications: row.allow_invoice_notifications,
    allowPaymentReminders: row.allow_payment_reminders,
    allowAppointmentConfirmations: row.allow_appointment_confirmations,
    allowDispatchUpdates: row.allow_dispatch_updates,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEventRow(row: CommunicationEventRow): CommunicationEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    invoiceId: row.invoice_id,
    paymentId: row.payment_id,
    eventType: row.event_type,
    communicationType: row.communication_type,
    triggerSource: row.trigger_source,
    actorUserId: row.actor_user_id,
    idempotencyKey: row.idempotency_key,
    scheduledFor: row.scheduled_for,
    occurredAt: row.occurred_at,
    payload: row.payload,
    processedAt: row.processed_at,
    failedAt: row.failed_at,
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCommunicationRow(row: CustomerCommunicationRow): CustomerCommunicationLogEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    invoiceId: row.invoice_id,
    paymentId: row.payment_id,
    eventId: row.event_id,
    communicationType: row.communication_type,
    channel: row.channel,
    status: row.status,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    recipientPhone: row.recipient_phone,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    providerMetadata: row.provider_metadata,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAttemptRow(row: DeliveryAttemptRow): CommunicationDeliveryAttempt {
  return {
    id: row.id,
    communicationId: row.communication_id,
    attemptNumber: row.attempt_number,
    provider: row.provider,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    succeeded: row.succeeded,
    errorMessage: row.error_message,
    attemptedAt: row.attempted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getPrimaryAddressByCustomer(client: AppSupabaseClient, customerId: string) {
  const result = await client
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<CustomerAddressRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}

async function getTechnicianDisplayName(client: AppSupabaseClient, userId: string | null) {
  if (!userId) {
    return null;
  }

  const result = await listProfilesByIds(client, [userId]);

  if (result.error) {
    throw result.error;
  }

  const profile = result.data?.[0];
  return profile?.full_name ?? profile?.email ?? userId;
}

async function getTechnicianCommunicationProfile(
  client: AppSupabaseClient,
  userId: string | null
) {
  if (!userId) {
    return {
      technicianName: null,
      technicianProfile: null
    };
  }

  const result = await listProfilesByIds(client, [userId]);

  if (result.error) {
    throw result.error;
  }

  const row = result.data?.[0];

  if (!row) {
    return {
      technicianName: userId,
      technicianProfile: null
    };
  }

  const profile = mapProfileRowToTechnicianProfile(row);
  const technicianName = profile.fullName ?? profile.email ?? userId;

  if (!hasPublicTechnicianProfile(profile)) {
    return {
      technicianName,
      technicianProfile: null
    };
  }

  const signedUrlResult = await createProfilePhotoSignedUrl(client, profile);

  if (signedUrlResult.error) {
    throw signedUrlResult.error;
  }

  return {
    technicianName,
    technicianProfile: toPublicTechnicianProfile(profile, signedUrlResult.data?.signedUrl ?? null)
  };
}

export async function resolveDefaultCommunicationProvider(
  client: AppSupabaseClient,
  companyId: string,
  channel: CustomerCommunicationLogEntry["channel"]
) {
  if (channel === "email") {
    return "resend";
  }

  const providerResult = await getDefaultSmsProviderAccountByCompany(client, companyId);

  if (providerResult.error) {
    throw providerResult.error;
  }

  return providerResult.data?.provider ?? "twilio";
}

async function getCompanyTimeZone(client: AppSupabaseClient, companyId: string) {
  const result = await getCompanyById(client, companyId);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Company not found.");
  }

  return result.data.timezone;
}

export async function getCustomerCommunicationPreferences(
  client: AppSupabaseClient,
  companyId: string,
  customerId: string
) {
  const result = await client
    .from("customer_communication_preferences")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .maybeSingle<CommunicationPreferenceRow>();

  return {
    ...result,
    data: result.data ? mapPreferenceRow(result.data) : null
  };
}

export async function upsertCustomerCommunicationPreferences(
  client: AppSupabaseClient,
  input: UpsertCustomerCommunicationPreferenceInput
) {
  const parsed = upsertCustomerCommunicationPreferenceInputSchema.parse(input);
  const result = await client
    .from("customer_communication_preferences")
    .upsert(
      {
        company_id: parsed.companyId,
        customer_id: parsed.customerId,
        preferred_channel: parsed.preferredChannel ?? null,
        email_enabled: parsed.emailEnabled ?? true,
        sms_enabled: parsed.smsEnabled ?? true,
        allow_estimate_notifications: parsed.allowEstimateNotifications ?? true,
        allow_invoice_notifications: parsed.allowInvoiceNotifications ?? true,
        allow_payment_reminders: parsed.allowPaymentReminders ?? true,
        allow_appointment_confirmations: parsed.allowAppointmentConfirmations ?? true,
        allow_dispatch_updates: parsed.allowDispatchUpdates ?? true
      },
      { onConflict: "company_id,customer_id" }
    )
    .select("*")
    .single<CommunicationPreferenceRow>();

  return {
    ...result,
    data: result.data ? mapPreferenceRow(result.data) : null
  };
}

export async function createCommunicationEvent(
  client: AppSupabaseClient,
  input: CreateCommunicationEventInput
) {
  const parsed = createCommunicationEventInputSchema.parse(input);
  const insertResult = await client
    .from("communication_events")
    .insert({
      company_id: parsed.companyId,
      customer_id: parsed.customerId,
      job_id: parsed.jobId ?? null,
      estimate_id: parsed.estimateId ?? null,
      invoice_id: parsed.invoiceId ?? null,
      payment_id: parsed.paymentId ?? null,
      event_type: parsed.eventType,
      communication_type: parsed.communicationType,
      trigger_source: parsed.triggerSource,
      actor_user_id: parsed.actorUserId ?? null,
      idempotency_key: parsed.idempotencyKey,
      scheduled_for: parsed.scheduledFor ?? new Date().toISOString(),
      occurred_at: parsed.occurredAt ?? new Date().toISOString(),
      payload: asJson(parsed.payload)
    })
    .select("*")
    .single<CommunicationEventRow>();

  if (isUniqueViolation(insertResult.error)) {
    const existing = await client
      .from("communication_events")
      .select("*")
      .eq("idempotency_key", parsed.idempotencyKey)
      .single<CommunicationEventRow>();

    return {
      ...existing,
      data: existing.data ? mapEventRow(existing.data) : null
    };
  }

  return {
    ...insertResult,
    data: insertResult.data ? mapEventRow(insertResult.data) : null
  };
}

export async function getCommunicationEventById(client: AppSupabaseClient, eventId: string) {
  const result = await client
    .from("communication_events")
    .select("*")
    .eq("id", eventId)
    .single<CommunicationEventRow>();

  return {
    ...result,
    data: result.data ? mapEventRow(result.data) : null
  };
}

export async function listCommunicationEventsByIds(
  client: AppSupabaseClient,
  eventIds: string[]
) {
  if (!eventIds.length) {
    return {
      data: [],
      error: null,
      count: 0,
      status: 200,
      statusText: "OK"
    };
  }

  const result = await client
    .from("communication_events")
    .select("*")
    .in("id", eventIds)
    .returns<CommunicationEventRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapEventRow) : null
  };
}

export async function markCommunicationEventProcessed(client: AppSupabaseClient, eventId: string) {
  const result = await client
    .from("communication_events")
    .update({
      processed_at: new Date().toISOString(),
      failed_at: null,
      failure_message: null
    })
    .eq("id", eventId)
    .select("*")
    .single<CommunicationEventRow>();

  return {
    ...result,
    data: result.data ? mapEventRow(result.data) : null
  };
}

export async function markCommunicationEventFailed(
  client: AppSupabaseClient,
  eventId: string,
  message: string
) {
  const result = await client
    .from("communication_events")
    .update({
      failed_at: new Date().toISOString(),
      failure_message: message
    })
    .eq("id", eventId)
    .select("*")
    .single<CommunicationEventRow>();

  return {
    ...result,
    data: result.data ? mapEventRow(result.data) : null
  };
}

export async function createQueuedCustomerCommunication(
  client: AppSupabaseClient,
  input: CreateQueuedCustomerCommunicationInput
) {
  const parsed = createQueuedCustomerCommunicationInputSchema.parse(input);
  const insertResult = await client
    .from("customer_communications")
    .insert({
      company_id: parsed.companyId,
      customer_id: parsed.customerId,
      job_id: parsed.jobId ?? null,
      estimate_id: parsed.estimateId ?? null,
      invoice_id: parsed.invoiceId ?? null,
      payment_id: parsed.paymentId ?? null,
      event_id: parsed.eventId ?? null,
      communication_type: parsed.communicationType,
      channel: parsed.channel,
      status: "queued",
      recipient_name: parsed.recipientName,
      recipient_email: parsed.recipientEmail ?? null,
      recipient_phone: parsed.recipientPhone ?? null,
      subject: parsed.subject ?? null,
      body_text: parsed.bodyText,
      body_html: parsed.bodyHtml ?? null,
      provider: parsed.provider,
      provider_metadata: asJson({}),
      created_by_user_id: parsed.createdByUserId ?? null
    })
    .select("*")
    .single<CustomerCommunicationRow>();

  if (isUniqueViolation(insertResult.error) && parsed.eventId) {
    const existing = await client
      .from("customer_communications")
      .select("*")
      .eq("event_id", parsed.eventId)
      .single<CustomerCommunicationRow>();

    return {
      ...existing,
      data: existing.data ? mapCommunicationRow(existing.data) : null
    };
  }

  return {
    ...insertResult,
    data: insertResult.data ? mapCommunicationRow(insertResult.data) : null
  };
}

export async function getCustomerCommunicationById(
  client: AppSupabaseClient,
  communicationId: string
) {
  const result = await client
    .from("customer_communications")
    .select("*")
    .eq("id", communicationId)
    .single<CustomerCommunicationRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationRow(result.data) : null
  };
}

export async function getCustomerCommunicationByProviderMessageId(
  client: AppSupabaseClient,
  provider: string,
  providerMessageId: string
) {
  const result = await client
    .from("customer_communications")
    .select("*")
    .eq("provider", provider)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle<CustomerCommunicationRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationRow(result.data) : null
  };
}

export async function getLatestDeliveredSmsCommunicationByProvider(
  client: AppSupabaseClient,
  companyId: string,
  provider: string
) {
  const result = await client
    .from("customer_communications")
    .select("*")
    .eq("company_id", companyId)
    .eq("channel", "sms")
    .eq("provider", provider)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerCommunicationRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationRow(result.data) : null
  };
}

export async function claimCustomerCommunicationForProcessing(
  client: AppSupabaseClient,
  communicationId: string
) {
  const result = await client
    .from("customer_communications")
    .update({
      status: "processing",
      error_code: null,
      error_message: null,
      failed_at: null
    })
    .eq("id", communicationId)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle<CustomerCommunicationRow>();

  if (result.error) {
    return {
      ...result,
      data: null
    };
  }

  if (result.data) {
    return {
      ...result,
      data: mapCommunicationRow(result.data)
    };
  }

  return getCustomerCommunicationById(client, communicationId);
}

export async function listQueuedCustomerCommunications(
  client: AppSupabaseClient,
  limit = 20,
  offset = 0
) {
  const result = await client
    .from("customer_communications")
    .select("*")
    .in("status", ["queued", "failed"])
    .order("failed_at", { ascending: true, nullsFirst: true })
    .order("queued_at", { ascending: true })
    .range(offset, offset + Math.max(limit - 1, 0))
    .returns<CustomerCommunicationRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCommunicationRow) : null
  };
}

export async function updateCustomerCommunicationStatus(
  client: AppSupabaseClient,
  communicationId: string,
  input: UpdateCustomerCommunicationStatusInput
) {
  const parsed = updateCustomerCommunicationStatusInputSchema.parse(input);
  const updates: Database["public"]["Tables"]["customer_communications"]["Update"] = {
    status: parsed.status,
    ...(parsed.providerMessageId !== undefined ? { provider_message_id: parsed.providerMessageId } : {}),
    ...(parsed.providerMetadata !== undefined
      ? { provider_metadata: asJson(parsed.providerMetadata) }
      : {}),
    ...(parsed.errorCode !== undefined ? { error_code: parsed.errorCode } : {}),
    ...(parsed.errorMessage !== undefined ? { error_message: parsed.errorMessage } : {}),
    ...(parsed.sentAt !== undefined ? { sent_at: parsed.sentAt } : {}),
    ...(parsed.deliveredAt !== undefined ? { delivered_at: parsed.deliveredAt } : {}),
    ...(parsed.failedAt !== undefined ? { failed_at: parsed.failedAt } : {})
  };

  const result = await client
    .from("customer_communications")
    .update(updates)
    .eq("id", communicationId)
    .select("*")
    .single<CustomerCommunicationRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationRow(result.data) : null
  };
}

export async function createCommunicationDeliveryAttempt(
  client: AppSupabaseClient,
  input: CreateCommunicationDeliveryAttemptInput
) {
  const parsed = createCommunicationDeliveryAttemptInputSchema.parse(input);
  const result = await client
    .from("communication_delivery_attempts")
    .insert({
      communication_id: parsed.communicationId,
      attempt_number: parsed.attemptNumber,
      provider: parsed.provider,
      request_payload: asJson(parsed.requestPayload ?? {}),
      response_payload: asJson(parsed.responsePayload ?? {}),
      succeeded: parsed.succeeded,
      error_message: parsed.errorMessage ?? null
    })
    .select("*")
    .single<DeliveryAttemptRow>();

  return {
    ...result,
    data: result.data ? mapAttemptRow(result.data) : null
  };
}

export async function listCustomerCommunications(
  client: AppSupabaseClient,
  customerId: string,
  query: CommunicationListQuery = {}
) {
  const parsed = communicationListQuerySchema.parse(query);
  let builder = client
    .from("customer_communications")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (parsed.communicationType) {
    builder = builder.eq("communication_type", parsed.communicationType);
  }

  if (parsed.channel) {
    builder = builder.eq("channel", parsed.channel);
  }

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.limit) {
    builder = builder.limit(parsed.limit);
  }

  const result = await builder.returns<CustomerCommunicationRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCommunicationRow) : null
  };
}

export async function listJobCommunications(
  client: AppSupabaseClient,
  jobId: string,
  query: CommunicationListQuery = {}
) {
  const parsed = communicationListQuerySchema.parse(query);
  let builder = client
    .from("customer_communications")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (parsed.communicationType) {
    builder = builder.eq("communication_type", parsed.communicationType);
  }

  if (parsed.channel) {
    builder = builder.eq("channel", parsed.channel);
  }

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.limit) {
    builder = builder.limit(parsed.limit);
  }

  const result = await builder.returns<CustomerCommunicationRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCommunicationRow) : null
  };
}

type EnqueueResolvedInput = {
  companyId: string;
  customerId: string;
  jobId?: string | null;
  estimateId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  actorUserId: string;
  requestedChannel?: CustomerCommunicationLogEntry["channel"] | undefined;
  communicationType: CustomerCommunicationLogEntry["communicationType"];
  eventType: CommunicationEvent["eventType"];
  triggerSource: CommunicationEvent["triggerSource"];
  idempotencyKey: string;
  subject: string;
  bodyText: string;
  payload: CreateCommunicationEventInput["payload"];
};

type CommunicationAutomationSettingKey =
  | "dispatchEnRouteSmsEnabled"
  | "dispatchRunningLateSmsEnabled"
  | "invoicePaymentReminderSmsEnabled";

function getDispatchUpdateTypeFromPayload(
  payload: CreateCommunicationEventInput["payload"]
): DispatchUpdatePayload["updateType"] | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const updateType = (payload as { updateType?: unknown }).updateType;

  if (
    updateType === "dispatched" ||
    updateType === "en_route" ||
    updateType === "running_late"
  ) {
    return updateType;
  }

  return null;
}

function resolveAutomationSettingKey(
  input: Pick<EnqueueResolvedInput, "communicationType" | "payload">
): CommunicationAutomationSettingKey | null {
  if (input.communicationType === "payment_reminder") {
    return "invoicePaymentReminderSmsEnabled";
  }

  if (input.communicationType !== "dispatch_update") {
    return null;
  }

  const updateType = getDispatchUpdateTypeFromPayload(input.payload);

  if (updateType === "en_route") {
    return "dispatchEnRouteSmsEnabled";
  }

  if (updateType === "running_late") {
    return "dispatchRunningLateSmsEnabled";
  }

  return null;
}

async function assertAutomatedSmsAllowed(
  client: AppSupabaseClient,
  input: Pick<EnqueueResolvedInput, "companyId" | "communicationType" | "payload" | "triggerSource">,
  channel: CustomerCommunicationLogEntry["channel"]
) {
  if (channel !== "sms" || input.triggerSource === "manual") {
    return;
  }

  const automationSettingKey = resolveAutomationSettingKey(input);

  if (!automationSettingKey) {
    return;
  }

  const settingsResult = await getCommunicationAutomationSettings(client, input.companyId);

  if (settingsResult.error) {
    throw settingsResult.error;
  }

  if (!settingsResult.data?.[automationSettingKey]) {
    throw new Error("SMS automation is disabled for this workflow.");
  }
}

async function enqueueResolvedCommunication(
  client: AppSupabaseClient,
  input: EnqueueResolvedInput,
  recipientName: string,
  recipientEmail: string | null,
  recipientPhone: string | null
) {
  const preferenceResult = await getCustomerCommunicationPreferences(
    client,
    input.companyId,
    input.customerId
  );

  if (preferenceResult.error) {
    throw preferenceResult.error;
  }

  const preference = preferenceResult.data;

  if (!canSendCommunicationType(input.communicationType, preference)) {
    throw new Error("Customer preferences do not allow this communication type.");
  }

  const channel = resolveCommunicationChannel({
    requestedChannel: input.requestedChannel,
    preference,
    recipientEmail,
    recipientPhone
  });

  await assertAutomatedSmsAllowed(client, input, channel);

  const provider = await resolveDefaultCommunicationProvider(client, input.companyId, channel);

  const eventResult = await createCommunicationEvent(client, {
    companyId: input.companyId,
    customerId: input.customerId,
    jobId: input.jobId ?? null,
    estimateId: input.estimateId ?? null,
    invoiceId: input.invoiceId ?? null,
    paymentId: input.paymentId ?? null,
    eventType: input.eventType,
    communicationType: input.communicationType,
    triggerSource: input.triggerSource,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload
  });

  if (eventResult.error || !eventResult.data) {
    return {
      ...eventResult,
      data: null
    };
  }

  return createQueuedCustomerCommunication(client, {
    companyId: input.companyId,
    customerId: input.customerId,
    jobId: input.jobId ?? null,
    estimateId: input.estimateId ?? null,
    invoiceId: input.invoiceId ?? null,
    paymentId: input.paymentId ?? null,
    eventId: eventResult.data.id,
    communicationType: input.communicationType,
    channel,
    recipientName,
    recipientEmail,
    recipientPhone,
    subject: input.subject,
    bodyText: input.bodyText,
    provider,
    createdByUserId: input.actorUserId
  });
}

export async function enqueueEstimateNotification(
  client: AppSupabaseClient,
  input: SendEstimateNotificationInput
) {
  const parsed = sendEstimateNotificationInputSchema.parse(input);
  const detailResult = await getEstimateDetailById(client, parsed.estimateId);

  if (detailResult.error || !detailResult.data) {
    return {
      ...detailResult,
      data: null
    };
  }

  const detail = detailResult.data;
  const companyTimeZone = await getCompanyTimeZone(client, detail.estimate.companyId);

  if (detail.estimate.status === "draft") {
    throw new Error("Estimate notifications require a sent or finalized estimate.");
  }

  const payload = {
    estimateNumber: detail.estimate.estimateNumber,
    estimateTitle: detail.estimate.title,
    totalCents: detail.estimate.totalCents,
    jobTitle: detail.job.title,
    customerName: getCustomerDisplayName(detail.customer),
    vehicleLabel: getVehicleDisplayName(detail.vehicle),
    companyTimeZone,
    actionUrl: parsed.actionUrl ?? null
  };

  const resendSuffix = parsed.resend ? new Date().toISOString() : "sent";

  return enqueueResolvedCommunication(
    client,
    {
      companyId: detail.estimate.companyId,
      customerId: detail.customer.id,
      jobId: detail.job.id,
      estimateId: detail.estimate.id,
      actorUserId: parsed.actorUserId,
      requestedChannel: parsed.channel,
      communicationType: "estimate_notification",
      eventType: "estimate_notification_requested",
      triggerSource: parsed.resend ? "manual" : "workflow",
      idempotencyKey: buildCommunicationIdempotencyKey(
        "estimate",
        detail.estimate.id,
        "estimate_notification",
        resendSuffix
      ),
      subject: buildEstimateNotificationSubject(payload),
      bodyText: buildEstimateNotificationBody(payload),
      payload: asJson(payload)
    },
    getCustomerDisplayName(detail.customer),
    detail.customer.email,
    detail.customer.phone
  );
}

export async function enqueueInvoiceNotification(
  client: AppSupabaseClient,
  input: SendInvoiceNotificationInput
) {
  const parsed = sendInvoiceNotificationInputSchema.parse(input);
  const detailResult = await getInvoiceDetailById(client, parsed.invoiceId);

  if (detailResult.error || !detailResult.data) {
    return {
      ...detailResult,
      data: null
    };
  }

  const detail = detailResult.data;
  const companyTimeZone = await getCompanyTimeZone(client, detail.invoice.companyId);

  if (!["issued", "partially_paid", "paid"].includes(detail.invoice.status)) {
    throw new Error("Invoice notifications require an issued or paid invoice.");
  }

  const payload: InvoiceNotificationPayload = {
    invoiceNumber: detail.invoice.invoiceNumber,
    invoiceTitle: detail.invoice.title,
    totalCents: detail.invoice.totalCents,
    balanceDueCents: detail.invoice.balanceDueCents,
    dueAt: detail.invoice.dueAt,
    customerName: getCustomerDisplayName(detail.customer),
    jobTitle: detail.job.title,
    companyTimeZone,
    paymentUrl: parsed.actionUrl ? null : detail.invoice.paymentUrl,
    actionUrl: parsed.actionUrl ?? detail.invoice.paymentUrl
  };

  const resendSuffix = parsed.resend ? new Date().toISOString() : "issued";

  return enqueueResolvedCommunication(
    client,
    {
      companyId: detail.invoice.companyId,
      customerId: detail.customer.id,
      jobId: detail.job.id,
      invoiceId: detail.invoice.id,
      actorUserId: parsed.actorUserId,
      requestedChannel: parsed.channel,
      communicationType: "invoice_notification",
      eventType: "invoice_notification_requested",
      triggerSource: parsed.resend ? "manual" : "workflow",
      idempotencyKey: buildCommunicationIdempotencyKey(
        "invoice",
        detail.invoice.id,
        "invoice_notification",
        resendSuffix
      ),
      subject: buildInvoiceNotificationSubject(payload),
      bodyText: buildInvoiceNotificationBody(payload),
      payload: asJson(payload)
    },
    getCustomerDisplayName(detail.customer),
    detail.customer.email,
    detail.customer.phone
  );
}

export async function enqueuePaymentReminder(
  client: AppSupabaseClient,
  input: SendPaymentReminderInput
) {
  const parsed = sendPaymentReminderInputSchema.parse(input);
  const detailResult = await getInvoiceDetailById(client, parsed.invoiceId);

  if (detailResult.error || !detailResult.data) {
    return {
      ...detailResult,
      data: null
    };
  }

  const detail = detailResult.data;
  const companyTimeZone = await getCompanyTimeZone(client, detail.invoice.companyId);

  if (!isInvoiceEligibleForReminder(detail.invoice)) {
    throw new Error("This invoice is not eligible for payment reminders.");
  }

  const reminderStage = parsed.reminderStage ?? getPaymentReminderStage(detail.invoice);
  const payload: PaymentReminderPayload = {
    invoiceNumber: detail.invoice.invoiceNumber,
    invoiceTitle: detail.invoice.title,
    balanceDueCents: detail.invoice.balanceDueCents,
    dueAt: detail.invoice.dueAt ?? new Date().toISOString(),
    reminderStage,
    customerName: getCustomerDisplayName(detail.customer),
    jobTitle: detail.job.title,
    companyTimeZone,
    paymentUrl: parsed.actionUrl ? null : detail.invoice.paymentUrl,
    actionUrl: parsed.actionUrl ?? detail.invoice.paymentUrl
  };

  const dedupeToken = parsed.resend ? new Date().toISOString() : `${reminderStage}:${payload.dueAt}`;

  return enqueueResolvedCommunication(
    client,
    {
      companyId: detail.invoice.companyId,
      customerId: detail.customer.id,
      jobId: detail.job.id,
      invoiceId: detail.invoice.id,
      actorUserId: parsed.actorUserId,
      requestedChannel: parsed.channel,
      communicationType: "payment_reminder",
      eventType: "payment_reminder_requested",
      triggerSource: parsed.resend ? "manual" : "system",
      idempotencyKey: buildCommunicationIdempotencyKey(
        "invoice",
        detail.invoice.id,
        "payment_reminder",
        dedupeToken
      ),
      subject: buildPaymentReminderSubject(payload),
      bodyText: buildPaymentReminderBody(payload),
      payload: asJson(payload)
    },
    getCustomerDisplayName(detail.customer),
    detail.customer.email,
    detail.customer.phone
  );
}

export async function enqueueAppointmentConfirmation(
  client: AppSupabaseClient,
  input: SendAppointmentConfirmationInput
) {
  const parsed = sendAppointmentConfirmationInputSchema.parse(input);
  const jobResult = await getJobById(client, parsed.jobId);

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  const job = jobResult.data;
  const companyTimeZone = await getCompanyTimeZone(client, job.companyId);

  if (!job.scheduledStartAt) {
    throw new Error("Appointment confirmations require a scheduled start time.");
  }

  const [customerResult, vehicleResult, addressResult, technicianResult] = await Promise.all([
    getCustomerById(client, job.customerId),
    getVehicleById(client, job.vehicleId),
    getPrimaryAddressByCustomer(client, job.customerId),
    getTechnicianCommunicationProfile(client, job.assignedTechnicianUserId)
  ]);

  if (customerResult.error || !customerResult.data) {
    return {
      ...customerResult,
      data: null
    };
  }

  if (vehicleResult.error || !vehicleResult.data) {
    return {
      ...vehicleResult,
      data: null
    };
  }

  if (addressResult.error) {
    throw addressResult.error;
  }

  const payload: AppointmentConfirmationPayload = {
    customerName: getCustomerDisplayName(customerResult.data),
    jobTitle: job.title,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
    arrivalWindowStartAt: job.arrivalWindowStartAt,
    arrivalWindowEndAt: job.arrivalWindowEndAt,
    companyTimeZone,
    technicianName: technicianResult.technicianName,
    technicianProfile: technicianResult.technicianProfile,
    serviceAddress: formatServiceAddressSummary(
      addressResult.data
        ? {
            line1: addressResult.data.line1,
            line2: addressResult.data.line2,
            city: addressResult.data.city,
            state: addressResult.data.state,
            postalCode: addressResult.data.postal_code
          }
        : null
    ),
    visitUrl: parsed.visitUrl ?? null,
    actionUrl: null
  };

  const dedupeToken = parsed.resend
    ? new Date().toISOString()
    : `${job.scheduledStartAt}:${job.scheduledEndAt ?? ""}:${job.arrivalWindowStartAt ?? ""}:${job.arrivalWindowEndAt ?? ""}`;

  return enqueueResolvedCommunication(
    client,
    {
      companyId: job.companyId,
      customerId: customerResult.data.id,
      jobId: job.id,
      actorUserId: parsed.actorUserId,
      requestedChannel: parsed.channel,
      communicationType: "appointment_confirmation",
      eventType: "appointment_confirmation_requested",
      triggerSource: parsed.resend ? "manual" : "workflow",
      idempotencyKey: buildCommunicationIdempotencyKey(
        "job",
        job.id,
        "appointment_confirmation",
        dedupeToken
      ),
      subject: buildAppointmentConfirmationSubject(),
      bodyText: buildAppointmentConfirmationBody(payload),
      payload: asJson(payload)
    },
    getCustomerDisplayName(customerResult.data),
    customerResult.data.email,
    customerResult.data.phone
  );
}

export async function enqueueDispatchUpdate(
  client: AppSupabaseClient,
  input: SendDispatchUpdateInput
) {
  const parsed = sendDispatchUpdateInputSchema.parse(input);
  const jobResult = await getJobById(client, parsed.jobId);

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  const job = jobResult.data;
  const companyTimeZone = await getCompanyTimeZone(client, job.companyId);

  if (!job.assignedTechnicianUserId) {
    throw new Error("Dispatch updates require an assigned technician.");
  }

  const [customerResult, addressResult, technicianResult] = await Promise.all([
    getCustomerById(client, job.customerId),
    getPrimaryAddressByCustomer(client, job.customerId),
    getTechnicianCommunicationProfile(client, job.assignedTechnicianUserId)
  ]);

  if (customerResult.error || !customerResult.data) {
    return {
      ...customerResult,
      data: null
    };
  }

  if (addressResult.error) {
    throw addressResult.error;
  }

  const payload: DispatchUpdatePayload = {
    customerName: getCustomerDisplayName(customerResult.data),
    jobTitle: job.title,
    updateType: parsed.updateType,
    technicianName: technicianResult.technicianName,
    technicianProfile: technicianResult.technicianProfile,
    scheduledStartAt: job.scheduledStartAt,
    arrivalWindowStartAt: job.arrivalWindowStartAt,
    arrivalWindowEndAt: job.arrivalWindowEndAt,
    companyTimeZone,
    serviceAddress: formatServiceAddressSummary(
      addressResult.data
        ? {
            line1: addressResult.data.line1,
            line2: addressResult.data.line2,
            city: addressResult.data.city,
            state: addressResult.data.state,
            postalCode: addressResult.data.postal_code
          }
        : null
    ),
    visitUrl: parsed.visitUrl ?? null,
    actionUrl: null
  };

  const dedupeToken = parsed.resend
    ? new Date().toISOString()
    : `${parsed.updateType}:${job.arrivalWindowStartAt ?? job.arrivalWindowEndAt ?? job.scheduledStartAt ?? job.scheduledEndAt ?? job.updatedAt}`;

  return enqueueResolvedCommunication(
    client,
    {
      companyId: job.companyId,
      customerId: customerResult.data.id,
      jobId: job.id,
      actorUserId: parsed.actorUserId,
      requestedChannel: parsed.channel,
      communicationType: "dispatch_update",
      eventType: "dispatch_update_requested",
      triggerSource: parsed.resend ? "manual" : "workflow",
      idempotencyKey: buildCommunicationIdempotencyKey(
        "job",
        job.id,
        "dispatch_update",
        dedupeToken
      ),
      subject: buildDispatchUpdateSubject(payload),
      bodyText: buildDispatchUpdateBody(payload),
      payload: asJson(payload)
    },
    getCustomerDisplayName(customerResult.data),
    customerResult.data.email,
    customerResult.data.phone
  );
}

export async function getNextCommunicationAttemptNumber(
  client: AppSupabaseClient,
  communicationId: string
) {
  const result = await client
    .from("communication_delivery_attempts")
    .select("attempt_number")
    .eq("communication_id", communicationId)
    .order("attempt_number", { ascending: false })
    .limit(1);

  if (result.error) {
    throw result.error;
  }

  const latestAttempt = Array.isArray(result.data) ? result.data[0] : null;
  return (latestAttempt?.attempt_number ?? 0) + 1;
}

export async function getCommunicationRelatedPayment(
  client: AppSupabaseClient,
  communication: Pick<CustomerCommunicationLogEntry, "paymentId">
) {
  if (!communication.paymentId) {
    return { data: null, error: null };
  }

  return getPaymentById(client, communication.paymentId);
}
