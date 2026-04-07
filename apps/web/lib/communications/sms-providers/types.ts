import type { Json, SmsProvider, SmsProviderAccount, SmsProviderCapabilities } from "@mobile-mechanic/types";

export type SmsDeliveryResult = {
  providerMessageId: string | null;
  providerMetadata: Record<string, unknown>;
};

export type SmsProviderVerificationResult = {
  capabilities: SmsProviderCapabilities;
  lastErrorMessage?: string | null | undefined;
  message: string;
  status: SmsProviderAccount["status"];
};

export type SmsProviderAdapterAccount = Pick<
  SmsProviderAccount,
  "capabilitiesJson" | "displayName" | "fromNumber" | "id" | "provider" | "settingsJson" | "status" | "username"
> & {
  credentials:
    | {
        accountSid?: string | null | undefined;
        authToken?: string | null | undefined;
        apiKey?: string | null | undefined;
        webhookSigningPublicKey?: string | null | undefined;
      }
    | null;
};

export type SmsProviderSendInput = {
  bodyText: string;
  statusCallbackUrl: string;
  to: string;
};

export interface SmsProviderAdapter {
  provider: SmsProvider;
  getCapabilities(): SmsProviderCapabilities;
  sendMessage(
    account: SmsProviderAdapterAccount,
    input: SmsProviderSendInput
  ): Promise<SmsDeliveryResult>;
  verifyConnection(account: SmsProviderAdapterAccount): Promise<SmsProviderVerificationResult>;
}

export function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}
