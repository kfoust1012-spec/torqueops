import type { SmsProviderAdapter, SmsProviderAdapterAccount } from "../types";
import {
  fetchWithTimeout,
  getProviderRequestError,
  readProviderPayload
} from "../../provider-requests";

function getCredentials(account: SmsProviderAdapterAccount) {
  const accountSid = account.credentials?.accountSid?.trim() || account.username?.trim() || "";
  const authToken = account.credentials?.authToken?.trim() || "";

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are incomplete.");
  }

  return {
    accountSid,
    authToken
  };
}

export const twilioSmsProviderAdapter: SmsProviderAdapter = {
  provider: "twilio",
  getCapabilities() {
    return {
      supportsDeliveryWebhooks: true,
      supportsInboundWebhooks: false,
      requiresManualRegistration: true
    };
  },
  async sendMessage(account, input) {
    const credentials = getCredentials(account);
    const fromNumber = account.fromNumber?.trim();

    if (!fromNumber) {
      throw new Error("Twilio sender number is missing.");
    }

    const params = new URLSearchParams({
      From: fromNumber,
      To: input.to,
      Body: input.bodyText,
      StatusCallback: input.statusCallbackUrl,
      StatusCallbackMethod: "POST"
    });
    const authToken = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64");

    try {
      const response = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authToken}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        }
      );

      const payload = (await readProviderPayload(response)) as {
        sid?: string;
        message?: string;
        status?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to send SMS communication.");
      }

      return {
        providerMessageId: payload?.sid ?? null,
        providerMetadata: {
          provider: "twilio",
          twilioStatus: payload?.status ?? null
        }
      };
    } catch (error) {
      throw getProviderRequestError("sms", error);
    }
  },
  async verifyConnection(account) {
    try {
      const credentials = getCredentials(account);
      const authToken = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64");
      const response = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${authToken}`
          }
        }
      );

      const payload = (await readProviderPayload(response)) as {
        friendly_name?: string;
        message?: string;
        sid?: string;
        status?: string;
      } | null;

      if (!response.ok) {
        return {
          capabilities: this.getCapabilities(),
          lastErrorMessage: payload?.message ?? "Twilio credentials were rejected.",
          message: "Twilio connection needs attention.",
          status: "action_required"
        };
      }

      return {
        capabilities: this.getCapabilities(),
        message: `Connected to Twilio account ${payload?.friendly_name ?? payload?.sid ?? credentials.accountSid}.`,
        status: account.fromNumber ? "connected" : "action_required"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Twilio verification failed.";

      return {
        capabilities: this.getCapabilities(),
        lastErrorMessage: message,
        message: "Twilio verification failed.",
        status: "error"
      };
    }
  }
};
