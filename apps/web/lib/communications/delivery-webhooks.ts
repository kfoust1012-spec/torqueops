import {
  getCustomerCommunicationByProviderMessageId,
  updateCustomerCommunicationStatus
} from "@mobile-mechanic/api-client";
import type {
  CommunicationStatus,
  CustomerCommunicationLogEntry,
  Json,
  SmsProvider,
  UpdateCustomerCommunicationStatusInput
} from "@mobile-mechanic/types";

type DeliveryWebhookStatus = Extract<CommunicationStatus, "sent" | "delivered" | "failed">;

export type CommunicationDeliveryWebhookInput = {
  provider: "resend" | SmsProvider;
  providerMessageId: string;
  status: DeliveryWebhookStatus;
  occurredAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerMetadata?: Record<string, unknown>;
};

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: {
      message?: string;
      type?: string;
      subType?: string;
    };
  };
};

type TelnyxWebhookPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: {
      errors?: Array<{
        code?: string;
        detail?: string;
        title?: string;
      }>;
      from?: {
        phone_number?: string;
      };
      id?: string;
      messaging_profile_id?: string | null;
      to?: Array<{
        phone_number?: string;
        status?: string;
        updated_at?: string;
      }>;
      webhook_url?: string | null;
    };
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
};

type ReconcileDeliveryResult = {
  matched: boolean;
  updated: boolean;
  communication: CustomerCommunicationLogEntry | null;
};

function asMetadataRecord(value: Json | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeOccurredAt(value?: string | null): string {
  if (value) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function buildMergedProviderMetadata(
  communication: CustomerCommunicationLogEntry,
  input: CommunicationDeliveryWebhookInput,
  occurredAt: string
): Json {
  return {
    ...asMetadataRecord(communication.providerMetadata),
    ...(input.providerMetadata ?? {}),
    lastDeliveryWebhook: {
      provider: input.provider,
      status: input.status,
      occurredAt,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null
    }
  } as Json;
}

export function buildDeliveryStatusUpdate(
  communication: CustomerCommunicationLogEntry,
  input: CommunicationDeliveryWebhookInput
): UpdateCustomerCommunicationStatusInput {
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const providerMetadata = buildMergedProviderMetadata(communication, input, occurredAt);

  if (input.status === "delivered") {
    return {
      status: "delivered",
      providerMetadata,
      errorCode: null,
      errorMessage: null,
      sentAt: communication.sentAt ?? occurredAt,
      deliveredAt: communication.deliveredAt ?? occurredAt,
      failedAt: null
    };
  }

  if (input.status === "failed") {
    if (communication.status === "delivered") {
      return {
        status: communication.status,
        providerMetadata
      };
    }

    return {
      status: "failed",
      providerMetadata,
      errorCode: input.errorCode ?? communication.errorCode ?? "delivery_failed",
      errorMessage: input.errorMessage ?? communication.errorMessage ?? "Delivery failed.",
      failedAt: communication.failedAt ?? occurredAt
    };
  }

  if (["delivered", "failed"].includes(communication.status)) {
    return {
      status: communication.status,
      providerMetadata
    };
  }

  return {
    status: "sent",
    providerMetadata,
    errorCode: null,
    errorMessage: null,
    sentAt: communication.sentAt ?? occurredAt,
    failedAt: null
  };
}

export function mapResendWebhookToDeliveryInput(
  payload: ResendWebhookPayload
): CommunicationDeliveryWebhookInput | null {
  const providerMessageId = payload.data?.email_id?.trim();

  if (!providerMessageId) {
    return null;
  }

  const baseInput = {
    provider: "resend" as const,
    providerMessageId,
    occurredAt: payload.created_at ?? null,
    providerMetadata: {
      resendEventType: payload.type ?? null,
      resendTo: payload.data?.to ?? [],
      resendSubject: payload.data?.subject ?? null
    }
  };

  switch (payload.type) {
    case "email.sent":
      return {
        ...baseInput,
        status: "sent"
      };
    case "email.delivered":
      return {
        ...baseInput,
        status: "delivered"
      };
    case "email.bounced":
    case "email.complained":
    case "email.failed":
    case "email.suppressed":
      return {
        ...baseInput,
        status: "failed",
        errorCode: payload.type ?? "email.failed",
        errorMessage:
          payload.data?.bounce?.message ??
          `Resend reported ${payload.type ?? "an email delivery failure"}.`,
        providerMetadata: {
          ...baseInput.providerMetadata,
          resendBounceType: payload.data?.bounce?.type ?? null,
          resendBounceSubType: payload.data?.bounce?.subType ?? null
        }
      };
    default:
      return null;
  }
}

export function mapTwilioWebhookToDeliveryInput(
  formFields: Record<string, string>
): CommunicationDeliveryWebhookInput | null {
  const providerMessageId =
    formFields.MessageSid?.trim() ||
    formFields.SmsSid?.trim() ||
    formFields.SmsMessageSid?.trim() ||
    "";
  const messageStatus =
    formFields.MessageStatus?.trim().toLowerCase() ||
    formFields.SmsStatus?.trim().toLowerCase() ||
    "";

  if (!providerMessageId || !messageStatus) {
    return null;
  }

  const baseInput = {
    provider: "twilio" as const,
    providerMessageId,
    occurredAt: formFields.DateUpdated ?? null,
    errorCode: formFields.ErrorCode?.trim() || null,
    errorMessage: formFields.ErrorMessage?.trim() || null,
    providerMetadata: {
      twilioStatus: messageStatus,
      twilioTo: formFields.To?.trim() || null,
      twilioFrom: formFields.From?.trim() || null,
      twilioAccountSid: formFields.AccountSid?.trim() || null,
      twilioMessagingServiceSid: formFields.MessagingServiceSid?.trim() || null,
      twilioErrorCode: formFields.ErrorCode?.trim() || null
    }
  };

  if (["delivered", "read"].includes(messageStatus)) {
    return {
      ...baseInput,
      status: "delivered"
    };
  }

  if (["failed", "undelivered", "canceled"].includes(messageStatus)) {
    return {
      ...baseInput,
      status: "failed",
      errorMessage:
        baseInput.errorMessage ?? `Twilio reported ${messageStatus} for this message.`
    };
  }

  if (["accepted", "scheduled", "queued", "sending", "sent", "partially_delivered"].includes(messageStatus)) {
    return {
      ...baseInput,
      status: "sent"
    };
  }

  return null;
}

export function mapTelnyxWebhookToDeliveryInput(
  payload: TelnyxWebhookPayload
): CommunicationDeliveryWebhookInput | null {
  const providerMessageId = payload.data?.payload?.id?.trim();
  const eventType = payload.data?.event_type?.trim().toLowerCase() || "";
  const recipient = payload.data?.payload?.to?.[0];
  const recipientStatus = recipient?.status?.trim().toLowerCase() || "";
  const providerStatus = recipientStatus || eventType.replace(/^message\./, "");

  if (!providerMessageId || !eventType) {
    return null;
  }

  const baseInput = {
    provider: "telnyx" as const,
    providerMessageId,
    occurredAt: recipient?.updated_at ?? payload.data?.occurred_at ?? null,
    errorCode: payload.data?.payload?.errors?.[0]?.code?.trim() || null,
    errorMessage:
      payload.data?.payload?.errors?.[0]?.detail?.trim() ||
      payload.data?.payload?.errors?.[0]?.title?.trim() ||
      null,
    providerMetadata: {
      telnyxEventId: payload.data?.id ?? null,
      telnyxEventType: eventType,
      telnyxStatus: providerStatus || null,
      telnyxTo: recipient?.phone_number ?? null,
      telnyxFrom: payload.data?.payload?.from?.phone_number ?? null,
      telnyxMessagingProfileId: payload.data?.payload?.messaging_profile_id ?? null,
      telnyxWebhookUrl: payload.data?.payload?.webhook_url ?? null,
      telnyxWebhookAttempt: payload.meta?.attempt ?? null,
      telnyxDeliveredTo: payload.meta?.delivered_to ?? null
    }
  };

  if (eventType === "message.delivered" || providerStatus === "delivered") {
    return {
      ...baseInput,
      status: "delivered"
    };
  }

  if (
    [
      "delivery_failed",
      "delivery_unconfirmed",
      "dlr_timeout",
      "failed",
      "gw_timeout",
      "sending_failed",
      "undelivered"
    ].includes(providerStatus)
  ) {
    return {
      ...baseInput,
      status: "failed",
      errorMessage:
        baseInput.errorMessage ?? `Telnyx reported ${providerStatus} for this message.`
    };
  }

  if (
    eventType === "message.sent" ||
    ["accepted", "queued", "sending", "sent"].includes(providerStatus)
  ) {
    return {
      ...baseInput,
      status: "sent"
    };
  }

  return null;
}

export async function reconcileCommunicationDelivery(
  input: CommunicationDeliveryWebhookInput
): Promise<ReconcileDeliveryResult> {
  const { getServiceRoleSupabaseClient } = await import("../supabase/service-role");
  const client = getServiceRoleSupabaseClient();
  const communicationResult = await getCustomerCommunicationByProviderMessageId(
    client,
    input.provider,
    input.providerMessageId
  );

  if (communicationResult.error) {
    throw communicationResult.error;
  }

  if (!communicationResult.data) {
    return {
      matched: false,
      updated: false,
      communication: null
    };
  }

  const updatedResult = await updateCustomerCommunicationStatus(
    client,
    communicationResult.data.id,
    buildDeliveryStatusUpdate(communicationResult.data, input)
  );

  if (updatedResult.error) {
    throw updatedResult.error;
  }

  return {
    matched: true,
    updated: true,
    communication: updatedResult.data
  };
}
