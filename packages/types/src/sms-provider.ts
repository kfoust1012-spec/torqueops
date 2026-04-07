import type { Json, TimestampFields, UUID } from "./common";

export const smsProviders = ["twilio", "telnyx"] as const;
export type SmsProvider = (typeof smsProviders)[number];

export const smsProviderAccountStatuses = [
  "connected",
  "action_required",
  "error",
  "disconnected"
] as const;
export type SmsProviderAccountStatus = (typeof smsProviderAccountStatuses)[number];

export interface SmsProviderCapabilities {
  supportsDeliveryWebhooks: boolean;
  supportsInboundWebhooks: boolean;
  requiresManualRegistration: boolean;
}

export const smsProviderTestResultStatuses = ["pending", "sent", "delivered", "failed"] as const;
export type SmsProviderTestResultStatus = (typeof smsProviderTestResultStatuses)[number];

export interface SmsProviderLastTestResult {
  bodyText: string;
  deliveredAt: string | null;
  errorMessage: string | null;
  failedAt: string | null;
  phoneNumber: string;
  providerMessageId: string | null;
  providerMetadata: Json | null;
  requestedAt: string;
  sentAt: string | null;
  status: SmsProviderTestResultStatus;
}

export interface TwilioSmsProviderSettings {
  accountSidHint: string | null;
  lastTestResult?: SmsProviderLastTestResult | null | undefined;
}

export interface TelnyxSmsProviderSettings {
  apiKeyHint: string | null;
  lastTestResult?: SmsProviderLastTestResult | null | undefined;
  messagingProfileId: string | null;
  webhookSigningPublicKey: string | null;
  webhookSigningPublicKeyHint: string | null;
}

export interface SmsProviderAccount extends TimestampFields {
  id: UUID;
  companyId: UUID;
  provider: SmsProvider;
  status: SmsProviderAccountStatus;
  displayName: string;
  username: string | null;
  fromNumber: string;
  isDefault: boolean;
  credentialHint: string | null;
  settingsJson: Json;
  capabilitiesJson: Json;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
}

export type UpsertSmsProviderAccountInput =
  | {
      companyId: UUID;
      provider: "twilio";
      displayName: string;
      fromNumber: string;
      accountSid: string;
      authToken: string;
      isDefault?: boolean | undefined;
    }
  | {
      companyId: UUID;
      provider: "telnyx";
      displayName: string;
      fromNumber: string;
      apiKey: string;
      messagingProfileId?: string | null | undefined;
      webhookSigningPublicKey: string;
      isDefault?: boolean | undefined;
    };

export interface VerifySmsProviderAccountInput {
  companyId: UUID;
  provider: SmsProvider;
}

export interface DisconnectSmsProviderAccountInput {
  companyId: UUID;
  provider: SmsProvider;
}
