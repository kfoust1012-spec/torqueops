import type { SmsProviderAdapter, SmsProviderAdapterAccount } from "../types";
import { toJsonObject } from "../types";
import {
  fetchWithTimeout,
  getProviderRequestError,
  readProviderPayload
} from "../../provider-requests";

type TelnyxError = {
  code?: string;
  detail?: string;
  title?: string;
};

type TelnyxMessagePayload = {
  data?: {
    id?: string;
    messaging_profile_id?: string | null;
    to?: Array<{
      phone_number?: string;
      status?: string;
    }>;
  };
  errors?: TelnyxError[];
  message?: string;
};

type TelnyxWhoAmIPayload = {
  data?: {
    organization_id?: string;
    user_email?: string;
  };
  errors?: TelnyxError[];
  message?: string;
};

function getApiKey(account: SmsProviderAdapterAccount) {
  const apiKey = account.credentials?.apiKey?.trim() || "";

  if (!apiKey) {
    throw new Error("Telnyx API key is incomplete.");
  }

  return apiKey;
}

function getAccountSettings(account: SmsProviderAdapterAccount) {
  const settings = toJsonObject(account.settingsJson);
  const messagingProfileId =
    typeof settings.messagingProfileId === "string" && settings.messagingProfileId.trim()
      ? settings.messagingProfileId.trim()
      : account.username?.trim() || null;
  const webhookSigningPublicKey =
    account.credentials?.webhookSigningPublicKey?.trim() ||
    (typeof settings.webhookSigningPublicKey === "string" && settings.webhookSigningPublicKey.trim()
      ? settings.webhookSigningPublicKey.trim()
      : null);

  return {
    messagingProfileId,
    webhookSigningPublicKey
  };
}

function getTelnyxErrorMessage(payload: { errors?: TelnyxError[]; message?: string } | null) {
  const firstError = payload?.errors?.[0];

  return (
    firstError?.detail ||
    firstError?.title ||
    payload?.message ||
    "Telnyx rejected the request."
  );
}

function getTelnyxVerificationError(account: SmsProviderAdapterAccount) {
  const { webhookSigningPublicKey } = getAccountSettings(account);

  if (!account.fromNumber?.trim()) {
    return "Add a sender number before using Telnyx for customer SMS.";
  }

  if (!webhookSigningPublicKey) {
    return "Add the Telnyx webhook signing public key to verify delivery callbacks.";
  }

  return null;
}

export const telnyxSmsProviderAdapter: SmsProviderAdapter = {
  provider: "telnyx",
  getCapabilities() {
    return {
      supportsDeliveryWebhooks: true,
      supportsInboundWebhooks: false,
      requiresManualRegistration: true
    };
  },
  async sendMessage(account, input) {
    const apiKey = getApiKey(account);
    const fromNumber = account.fromNumber?.trim();
    const settings = getAccountSettings(account);

    if (!fromNumber) {
      throw new Error("Telnyx sender number is missing.");
    }

    try {
      const response = await fetchWithTimeout("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromNumber,
          to: input.to,
          text: input.bodyText,
          webhook_url: input.statusCallbackUrl,
          use_profile_webhooks: false,
          ...(settings.messagingProfileId
            ? { messaging_profile_id: settings.messagingProfileId }
            : {})
        })
      });

      const payload = (await readProviderPayload(response)) as TelnyxMessagePayload | null;

      if (!response.ok) {
        throw new Error(getTelnyxErrorMessage(payload));
      }

      return {
        providerMessageId: payload?.data?.id ?? null,
        providerMetadata: {
          provider: "telnyx",
          telnyxStatus: payload?.data?.to?.[0]?.status ?? null,
          telnyxMessagingProfileId:
            payload?.data?.messaging_profile_id ?? settings.messagingProfileId ?? null
        }
      };
    } catch (error) {
      throw getProviderRequestError("sms", error);
    }
  },
  async verifyConnection(account) {
    try {
      const apiKey = getApiKey(account);
      const response = await fetchWithTimeout("https://api.telnyx.com/v2/whoami", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      const payload = (await readProviderPayload(response)) as TelnyxWhoAmIPayload | null;

      if (!response.ok) {
        return {
          capabilities: this.getCapabilities(),
          lastErrorMessage: getTelnyxErrorMessage(payload),
          message: "Telnyx connection needs attention.",
          status: "action_required"
        };
      }

      const verificationError = getTelnyxVerificationError(account);

      return {
        capabilities: this.getCapabilities(),
        lastErrorMessage: verificationError,
        message: verificationError
          ? "Telnyx is authenticated, but the connection still needs provider details."
          : `Connected to Telnyx ${payload?.data?.organization_id ?? payload?.data?.user_email ?? "account"}.`,
        status: verificationError ? "action_required" : "connected"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telnyx verification failed.";

      return {
        capabilities: this.getCapabilities(),
        lastErrorMessage: message,
        message: "Telnyx verification failed.",
        status: "error"
      };
    }
  }
};
