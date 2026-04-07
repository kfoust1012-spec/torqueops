import type {
  Json,
  SmsProviderAccount,
  SmsProviderLastTestResult,
  SmsProviderTestResultStatus
} from "@mobile-mechanic/types";
import { smsProviderTestResultStatuses } from "@mobile-mechanic/types";

import type { CommunicationDeliveryWebhookInput } from "../delivery-webhooks";
import { toJsonObject } from "./types";

function asJsonRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return toJsonObject(value);
}

function getString(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStatus(value: Json | undefined): SmsProviderTestResultStatus | null {
  return typeof value === "string" &&
    smsProviderTestResultStatuses.includes(value as SmsProviderTestResultStatus)
    ? (value as SmsProviderTestResultStatus)
    : null;
}

function normalizeIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeOccurredAt(value?: string | null): string {
  return normalizeIsoTimestamp(value) ?? new Date().toISOString();
}

function buildMergedProviderMetadata(
  current: SmsProviderLastTestResult,
  input: CommunicationDeliveryWebhookInput,
  occurredAt: string
): Json {
  const currentMetadata = asJsonRecord(current.providerMetadata);

  return {
    ...currentMetadata,
    ...((input.providerMetadata ?? {}) as Record<string, Json | undefined>),
    lastDeliveryWebhook: {
      provider: input.provider,
      status: input.status,
      occurredAt,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null
    }
  } as Json;
}

export function buildSmsProviderTestResult(input: {
  bodyText: string;
  deliveredAt?: string | null | undefined;
  errorMessage?: string | null | undefined;
  failedAt?: string | null | undefined;
  phoneNumber: string;
  providerMessageId: string | null;
  providerMetadata?: Json | null | undefined;
  requestedAt?: string | null | undefined;
  sentAt?: string | null | undefined;
  status: SmsProviderTestResultStatus;
}): SmsProviderLastTestResult {
  const requestedAt = normalizeOccurredAt(input.requestedAt);

  return {
    bodyText: input.bodyText.trim(),
    deliveredAt: normalizeIsoTimestamp(input.deliveredAt),
    errorMessage: input.errorMessage?.trim() || null,
    failedAt: normalizeIsoTimestamp(input.failedAt),
    phoneNumber: input.phoneNumber.trim(),
    providerMessageId: input.providerMessageId?.trim() || null,
    providerMetadata: input.providerMetadata ?? null,
    requestedAt,
    sentAt: normalizeIsoTimestamp(input.sentAt),
    status: input.status
  };
}

export function getSmsProviderLastTestResult(
  value: Pick<SmsProviderAccount, "settingsJson"> | Json | null | undefined
): SmsProviderLastTestResult | null {
  const settings =
    value && typeof value === "object" && "settingsJson" in value
      ? asJsonRecord(value.settingsJson)
      : asJsonRecord(value as Json | null | undefined);
  const rawResult = settings.lastTestResult;

  if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
    return null;
  }

  const result = rawResult as Record<string, Json | undefined>;
  const bodyText = getString(result.bodyText);
  const phoneNumber = getString(result.phoneNumber);
  const requestedAt = normalizeIsoTimestamp(getString(result.requestedAt));
  const status = getStatus(result.status);

  if (!bodyText || !phoneNumber || !requestedAt || !status) {
    return null;
  }

  return {
    bodyText,
    deliveredAt: normalizeIsoTimestamp(getString(result.deliveredAt)),
    errorMessage: getString(result.errorMessage),
    failedAt: normalizeIsoTimestamp(getString(result.failedAt)),
    phoneNumber,
    providerMessageId: getString(result.providerMessageId),
    providerMetadata: (result.providerMetadata as Json | undefined) ?? null,
    requestedAt,
    sentAt: normalizeIsoTimestamp(getString(result.sentAt)),
    status
  };
}

export function setSmsProviderLastTestResult(
  settingsJson: Json | null | undefined,
  result: SmsProviderLastTestResult | null
): Json {
  const settings = asJsonRecord(settingsJson);

  return {
    ...settings,
    lastTestResult: result
      ? ({
          bodyText: result.bodyText,
          deliveredAt: result.deliveredAt,
          errorMessage: result.errorMessage,
          failedAt: result.failedAt,
          phoneNumber: result.phoneNumber,
          providerMessageId: result.providerMessageId,
          providerMetadata: result.providerMetadata,
          requestedAt: result.requestedAt,
          sentAt: result.sentAt,
          status: result.status
        } satisfies Record<string, Json | undefined>)
      : null
  } satisfies Record<string, Json | undefined>;
}

export function getSmsProviderTestDeliveredAt(result: SmsProviderLastTestResult | null) {
  if (!result || result.status !== "delivered") {
    return null;
  }

  return result.deliveredAt ?? result.sentAt ?? result.requestedAt;
}

export function applySmsProviderTestDeliveryUpdate(
  current: SmsProviderLastTestResult,
  input: CommunicationDeliveryWebhookInput
): SmsProviderLastTestResult {
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const providerMetadata = buildMergedProviderMetadata(current, input, occurredAt);

  if (input.status === "delivered") {
    return {
      ...current,
      deliveredAt: current.deliveredAt ?? occurredAt,
      errorMessage: null,
      failedAt: null,
      providerMetadata,
      sentAt: current.sentAt ?? occurredAt,
      status: "delivered"
    };
  }

  if (input.status === "failed") {
    if (current.status === "delivered") {
      return {
        ...current,
        providerMetadata
      };
    }

    return {
      ...current,
      errorMessage: input.errorMessage ?? current.errorMessage ?? "Delivery failed.",
      failedAt: current.failedAt ?? occurredAt,
      providerMetadata,
      status: "failed"
    };
  }

  if (current.status === "delivered" || current.status === "failed") {
    return {
      ...current,
      providerMetadata
    };
  }

  return {
    ...current,
    errorMessage: null,
    failedAt: null,
    providerMetadata,
    sentAt: current.sentAt ?? occurredAt,
    status: "sent"
  };
}
