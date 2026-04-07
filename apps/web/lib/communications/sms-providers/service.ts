import type { AppSupabaseClient } from "@mobile-mechanic/api-client";
import {
  disconnectSmsProviderAccount,
  getSmsProviderAccountById,
  getDefaultSmsProviderAccountByCompany,
  getSmsProviderAccountByProvider,
  listSmsProviderAccountsByCompany,
  updateSmsProviderAccountSettingsJson,
  updateSmsProviderAccountStatus,
  upsertSmsProviderAccount
} from "@mobile-mechanic/api-client";
import type {
  Database,
  Json,
  SmsProvider,
  SmsProviderLastTestResult,
  TelnyxSmsProviderSettings,
  TwilioSmsProviderSettings,
  UpsertSmsProviderAccountInput
} from "@mobile-mechanic/types";
import {
  disconnectSmsProviderAccountInputSchema,
  smsProviderPhoneSchema,
  upsertSmsProviderAccountInputSchema,
  verifySmsProviderAccountInputSchema
} from "@mobile-mechanic/validation";

import { buildAppUrl } from "../../server-env";
import type { CommunicationDeliveryWebhookInput } from "../delivery-webhooks";
import {
  applySmsProviderTestDeliveryUpdate,
  buildSmsProviderTestResult,
  getSmsProviderLastTestResult,
  setSmsProviderLastTestResult
} from "./test-state";
import {
  buildCredentialHint,
  decryptProviderCredential,
  encryptProviderCredential
} from "./credentials";
import { getSmsProviderAdapter } from "./registry";
import type { SmsProviderAdapterAccount } from "./types";

type SmsProviderAccountRow = Database["public"]["Tables"]["sms_provider_accounts"]["Row"];

function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function normalizeTwilioInput(input: UpsertSmsProviderAccountInput) {
  const parsed = upsertSmsProviderAccountInputSchema.parse(input);

  if (parsed.provider !== "twilio") {
    throw new Error("Expected a Twilio SMS provider input.");
  }

  return {
    ...parsed,
    accountSid: parsed.accountSid.trim(),
    authToken: parsed.authToken.trim(),
    displayName: parsed.displayName.trim(),
    fromNumber: parsed.fromNumber.trim()
  };
}

function normalizeTelnyxInput(input: UpsertSmsProviderAccountInput) {
  const parsed = upsertSmsProviderAccountInputSchema.parse(input);

  if (parsed.provider !== "telnyx") {
    throw new Error("Expected a Telnyx SMS provider input.");
  }

  return {
    ...parsed,
    apiKey: parsed.apiKey.trim(),
    displayName: parsed.displayName.trim(),
    fromNumber: parsed.fromNumber.trim(),
    messagingProfileId: parsed.messagingProfileId?.trim() || null,
    webhookSigningPublicKey: parsed.webhookSigningPublicKey.trim()
  };
}

async function getSmsProviderAccountRow(
  client: AppSupabaseClient,
  companyId: string,
  provider: SmsProvider
) {
  const result = await client
    .from("sms_provider_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle<SmsProviderAccountRow>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? null;
}

function buildTwilioSettingsJson(input: ReturnType<typeof normalizeTwilioInput>) {
  const settings: TwilioSmsProviderSettings = {
    accountSidHint: buildCredentialHint(input.accountSid)
  };

  return settings as unknown as Json;
}

function buildTelnyxSettingsJson(input: ReturnType<typeof normalizeTelnyxInput>) {
  const settings: TelnyxSmsProviderSettings = {
    apiKeyHint: buildCredentialHint(input.apiKey),
    messagingProfileId: input.messagingProfileId,
    webhookSigningPublicKey: input.webhookSigningPublicKey,
    webhookSigningPublicKeyHint: buildCredentialHint(input.webhookSigningPublicKey)
  };

  return settings as unknown as Json;
}

function buildTwilioAdapterAccount(row: SmsProviderAccountRow): SmsProviderAdapterAccount {
  const decryptedAuthToken = row.credential_ciphertext
    ? decryptProviderCredential(row.credential_ciphertext)
    : null;

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    fromNumber: row.from_number,
    status: row.status,
    username: row.username,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    credentials:
      row.username && decryptedAuthToken
        ? {
            accountSid: row.username,
            authToken: decryptedAuthToken
          }
        : null
  };
}

function buildTelnyxAdapterAccount(row: SmsProviderAccountRow): SmsProviderAdapterAccount {
  const settingsJson = toJsonObject(row.settings_json);
  const decryptedApiKey = row.credential_ciphertext
    ? decryptProviderCredential(row.credential_ciphertext)
    : null;
  const webhookSigningPublicKey =
    typeof settingsJson.webhookSigningPublicKey === "string"
      ? settingsJson.webhookSigningPublicKey
      : null;

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    fromNumber: row.from_number,
    status: row.status,
    username: row.username,
    settingsJson: row.settings_json,
    capabilitiesJson: row.capabilities_json,
    credentials:
      decryptedApiKey || webhookSigningPublicKey
        ? {
            apiKey: decryptedApiKey,
            webhookSigningPublicKey
          }
        : null
  };
}

export function buildSmsProviderWebhookPath(provider: SmsProvider, providerAccountId: string) {
  return `api/webhooks/communications/${provider}/${providerAccountId}`;
}

export function buildSmsProviderWebhookUrl(provider: SmsProvider, providerAccountId: string) {
  return buildAppUrl(buildSmsProviderWebhookPath(provider, providerAccountId));
}

export function buildTwilioWebhookPath(providerAccountId: string) {
  return buildSmsProviderWebhookPath("twilio", providerAccountId);
}

export function buildTwilioWebhookUrl(providerAccountId: string) {
  return buildSmsProviderWebhookUrl("twilio", providerAccountId);
}

export function buildTelnyxWebhookPath(providerAccountId: string) {
  return buildSmsProviderWebhookPath("telnyx", providerAccountId);
}

export function buildTelnyxWebhookUrl(providerAccountId: string) {
  return buildSmsProviderWebhookUrl("telnyx", providerAccountId);
}

function getProviderSettingsJsonWithLastTestResult(
  settingsJson: Json | null | undefined,
  result: SmsProviderLastTestResult
) {
  return setSmsProviderLastTestResult(settingsJson, result);
}

function getSendTestFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "The SMS test send failed.";
}

export function buildSmsProviderTestMessageText(companyName: string) {
  const normalizedCompanyName = companyName.trim() || "Your shop";

  return `${normalizedCompanyName}: this is a customer texting setup test. Outbound SMS is working if this message arrives.`;
}

export async function getCommunicationsSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [accountsResult, defaultAccountResult] = await Promise.all([
    listSmsProviderAccountsByCompany(client, companyId),
    getDefaultSmsProviderAccountByCompany(client, companyId)
  ]);

  if (accountsResult.error) {
    throw accountsResult.error;
  }

  if (defaultAccountResult.error) {
    throw defaultAccountResult.error;
  }

  return {
    accounts: accountsResult.data ?? [],
    defaultAccount: defaultAccountResult.data ?? null
  };
}

export async function getTwilioSmsProviderSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [workspace, accountResult] = await Promise.all([
    getCommunicationsSettingsWorkspace(client, companyId),
    getSmsProviderAccountByProvider(client, companyId, "twilio")
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }

  return {
    ...workspace,
    account: accountResult.data ?? null
  };
}

export async function getTelnyxSmsProviderSettingsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const [workspace, accountResult] = await Promise.all([
    getCommunicationsSettingsWorkspace(client, companyId),
    getSmsProviderAccountByProvider(client, companyId, "telnyx")
  ]);

  if (accountResult.error) {
    throw accountResult.error;
  }

  return {
    ...workspace,
    account: accountResult.data ?? null
  };
}

export async function saveTwilioSmsProviderAccountSettings(
  client: AppSupabaseClient,
  input: UpsertSmsProviderAccountInput
) {
  const normalizedInput = normalizeTwilioInput(input);
  const [existingAccountResult, defaultAccountResult] = await Promise.all([
    getSmsProviderAccountByProvider(client, normalizedInput.companyId, "twilio"),
    getDefaultSmsProviderAccountByCompany(client, normalizedInput.companyId)
  ]);

  if (existingAccountResult.error) {
    throw existingAccountResult.error;
  }

  if (defaultAccountResult.error) {
    throw defaultAccountResult.error;
  }

  const shouldBeDefault =
    normalizedInput.isDefault ??
    existingAccountResult.data?.isDefault ??
    !defaultAccountResult.data;

  const accountResult = await upsertSmsProviderAccount(client, {
    capabilitiesJson: getSmsProviderAdapter("twilio").getCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext: encryptProviderCredential(normalizedInput.authToken),
    credentialHint: buildCredentialHint(normalizedInput.authToken),
    displayName: normalizedInput.displayName,
    fromNumber: normalizedInput.fromNumber,
    isDefault: shouldBeDefault,
    provider: "twilio",
    settingsJson: buildTwilioSettingsJson(normalizedInput),
    status: "action_required",
    username: normalizedInput.accountSid
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("Twilio settings could not be saved.");
  }

  return verifyTwilioSmsProviderConnection(client, normalizedInput.companyId);
}

export async function saveTelnyxSmsProviderAccountSettings(
  client: AppSupabaseClient,
  input: UpsertSmsProviderAccountInput
) {
  const normalizedInput = normalizeTelnyxInput(input);
  const [existingAccountResult, defaultAccountResult] = await Promise.all([
    getSmsProviderAccountByProvider(client, normalizedInput.companyId, "telnyx"),
    getDefaultSmsProviderAccountByCompany(client, normalizedInput.companyId)
  ]);

  if (existingAccountResult.error) {
    throw existingAccountResult.error;
  }

  if (defaultAccountResult.error) {
    throw defaultAccountResult.error;
  }

  const shouldBeDefault =
    normalizedInput.isDefault ??
    existingAccountResult.data?.isDefault ??
    !defaultAccountResult.data;

  const accountResult = await upsertSmsProviderAccount(client, {
    capabilitiesJson: getSmsProviderAdapter("telnyx").getCapabilities(),
    companyId: normalizedInput.companyId,
    credentialCiphertext: encryptProviderCredential(normalizedInput.apiKey),
    credentialHint: buildCredentialHint(normalizedInput.apiKey),
    displayName: normalizedInput.displayName,
    fromNumber: normalizedInput.fromNumber,
    isDefault: shouldBeDefault,
    provider: "telnyx",
    settingsJson: buildTelnyxSettingsJson(normalizedInput),
    status: "action_required",
    username: normalizedInput.messagingProfileId
  });

  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("Telnyx settings could not be saved.");
  }

  return verifyTelnyxSmsProviderConnection(client, normalizedInput.companyId);
}

export async function verifyTwilioSmsProviderConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  verifySmsProviderAccountInputSchema.parse({ companyId, provider: "twilio" });
  const rawAccountRow = await getSmsProviderAccountRow(client, companyId, "twilio");

  if (!rawAccountRow) {
    throw new Error("Configure the Twilio account before verifying the connection.");
  }

  const adapter = getSmsProviderAdapter("twilio");
  const verificationResult = await adapter.verifyConnection(buildTwilioAdapterAccount(rawAccountRow));
  const statusResult = await updateSmsProviderAccountStatus(client, rawAccountRow.id, {
    capabilitiesJson: verificationResult.capabilities,
    lastErrorMessage: verificationResult.lastErrorMessage ?? null,
    lastVerifiedAt: new Date().toISOString(),
    status: verificationResult.status
  });

  if (statusResult.error || !statusResult.data) {
    throw statusResult.error ?? new Error("Twilio account status could not be updated.");
  }

  return statusResult.data;
}

export async function verifyTelnyxSmsProviderConnection(
  client: AppSupabaseClient,
  companyId: string
) {
  verifySmsProviderAccountInputSchema.parse({ companyId, provider: "telnyx" });
  const rawAccountRow = await getSmsProviderAccountRow(client, companyId, "telnyx");

  if (!rawAccountRow) {
    throw new Error("Configure the Telnyx account before verifying the connection.");
  }

  const adapter = getSmsProviderAdapter("telnyx");
  const verificationResult = await adapter.verifyConnection(buildTelnyxAdapterAccount(rawAccountRow));
  const statusResult = await updateSmsProviderAccountStatus(client, rawAccountRow.id, {
    capabilitiesJson: verificationResult.capabilities,
    lastErrorMessage: verificationResult.lastErrorMessage ?? null,
    lastVerifiedAt: new Date().toISOString(),
    status: verificationResult.status
  });

  if (statusResult.error || !statusResult.data) {
    throw statusResult.error ?? new Error("Telnyx account status could not be updated.");
  }

  return statusResult.data;
}

export async function disconnectTwilioSmsProviderAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  disconnectSmsProviderAccountInputSchema.parse({ companyId, provider: "twilio" });
  const disconnectedAccountResult = await disconnectSmsProviderAccount(client, companyId, "twilio");

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("Twilio could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}

export async function disconnectTelnyxSmsProviderAccount(
  client: AppSupabaseClient,
  companyId: string
) {
  disconnectSmsProviderAccountInputSchema.parse({ companyId, provider: "telnyx" });
  const disconnectedAccountResult = await disconnectSmsProviderAccount(client, companyId, "telnyx");

  if (disconnectedAccountResult.error || !disconnectedAccountResult.data) {
    throw disconnectedAccountResult.error ?? new Error("Telnyx could not be disconnected.");
  }

  return disconnectedAccountResult.data;
}

export async function getSmsProviderRuntimeAccount(
  client: AppSupabaseClient,
  companyId: string,
  provider: SmsProvider
): Promise<SmsProviderAdapterAccount | null> {
  const rawAccountRow = await getSmsProviderAccountRow(client, companyId, provider);

  if (!rawAccountRow || rawAccountRow.status === "disconnected") {
    return null;
  }

  if (provider === "twilio") {
    return buildTwilioAdapterAccount(rawAccountRow);
  }

  if (provider === "telnyx") {
    return buildTelnyxAdapterAccount(rawAccountRow);
  }

  return null;
}

export async function sendSmsProviderTestMessage(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    companyName: string;
    phoneNumber: string;
  }
) {
  const phoneNumber = smsProviderPhoneSchema.parse(input.phoneNumber);
  const defaultAccountResult = await getDefaultSmsProviderAccountByCompany(client, input.companyId);

  if (defaultAccountResult.error) {
    throw defaultAccountResult.error;
  }

  if (!defaultAccountResult.data) {
    throw new Error("Choose a default SMS provider before sending a test message.");
  }

  if (
    defaultAccountResult.data.status !== "connected" ||
    !defaultAccountResult.data.lastVerifiedAt
  ) {
    throw new Error("Verify the default SMS provider before sending a test message.");
  }

  const runtimeAccount = await getSmsProviderRuntimeAccount(
    client,
    input.companyId,
    defaultAccountResult.data.provider
  );

  if (!runtimeAccount) {
    throw new Error("The default SMS provider could not be loaded.");
  }

  const adapter = getSmsProviderAdapter(runtimeAccount.provider);
  const requestedAt = new Date().toISOString();
  const bodyText = buildSmsProviderTestMessageText(input.companyName);

  try {
    const deliveryResult = await adapter.sendMessage(runtimeAccount, {
      bodyText,
      statusCallbackUrl: buildSmsProviderWebhookUrl(runtimeAccount.provider, runtimeAccount.id),
      to: phoneNumber
    });

    if (!deliveryResult.providerMessageId) {
      throw new Error("The SMS provider did not return a message ID for the test send.");
    }

    const testResult = buildSmsProviderTestResult({
      bodyText,
      phoneNumber,
      providerMessageId: deliveryResult.providerMessageId,
      providerMetadata: deliveryResult.providerMetadata as Json,
      requestedAt,
      sentAt: requestedAt,
      status: "sent"
    });
    const updatedAccountResult = await updateSmsProviderAccountSettingsJson(
      client,
      defaultAccountResult.data.id,
      getProviderSettingsJsonWithLastTestResult(defaultAccountResult.data.settingsJson, testResult)
    );

    if (updatedAccountResult.error || !updatedAccountResult.data) {
      throw updatedAccountResult.error ?? new Error("The SMS test result could not be saved.");
    }

    return {
      account: updatedAccountResult.data,
      testResult
    };
  } catch (error) {
    const failedTestResult = buildSmsProviderTestResult({
      bodyText,
      errorMessage: getSendTestFailureMessage(error),
      failedAt: requestedAt,
      phoneNumber,
      providerMessageId: null,
      requestedAt,
      status: "failed"
    });
    const failedSaveResult = await updateSmsProviderAccountSettingsJson(
      client,
      defaultAccountResult.data.id,
      getProviderSettingsJsonWithLastTestResult(
        defaultAccountResult.data.settingsJson,
        failedTestResult
      )
    );

    if (failedSaveResult.error) {
      throw failedSaveResult.error;
    }

    throw error;
  }
}

export async function reconcileSmsProviderTestDelivery(
  client: AppSupabaseClient,
  providerAccountId: string,
  input: CommunicationDeliveryWebhookInput
) {
  if (input.provider === "resend") {
    return {
      account: null,
      matched: false,
      testResult: null,
      updated: false
    };
  }

  const accountResult = await getSmsProviderAccountById(client, providerAccountId);

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (!accountResult.data) {
    return {
      account: null,
      matched: false,
      testResult: null,
      updated: false
    };
  }

  const currentTestResult = getSmsProviderLastTestResult(accountResult.data);

  if (!currentTestResult || currentTestResult.providerMessageId !== input.providerMessageId) {
    return {
      account: accountResult.data,
      matched: false,
      testResult: null,
      updated: false
    };
  }

  const nextTestResult = applySmsProviderTestDeliveryUpdate(currentTestResult, input);
  const updatedAccountResult = await updateSmsProviderAccountSettingsJson(
    client,
    providerAccountId,
    getProviderSettingsJsonWithLastTestResult(accountResult.data.settingsJson, nextTestResult)
  );

  if (updatedAccountResult.error || !updatedAccountResult.data) {
    throw updatedAccountResult.error ?? new Error("The SMS test result could not be updated.");
  }

  return {
    account: updatedAccountResult.data,
    matched: true,
    testResult: nextTestResult,
    updated: true
  };
}
