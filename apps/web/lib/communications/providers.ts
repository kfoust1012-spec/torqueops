import type { AppSupabaseClient } from "@mobile-mechanic/api-client";
import type { CustomerCommunicationLogEntry } from "@mobile-mechanic/types";

import { buildAppUrl, getCommunicationDeliveryEnv } from "../server-env";
import {
  buildSmsProviderWebhookUrl,
  getSmsProviderRuntimeAccount
} from "./sms-providers/service";
import { getSmsProviderAdapter } from "./sms-providers/registry";
import {
  fetchWithTimeout,
  getProviderRequestError,
  readProviderPayload
} from "./provider-requests";

type DeliveryResult = {
  providerMessageId: string | null;
  providerMetadata: Record<string, unknown>;
};

async function sendEmailCommunication(
  communication: Pick<CustomerCommunicationLogEntry, "recipientEmail" | "recipientName" | "subject" | "bodyText" | "bodyHtml">
): Promise<DeliveryResult> {
  const env = getCommunicationDeliveryEnv();

  if (!env.RESEND_API_KEY || !env.COMMUNICATIONS_FROM_EMAIL) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and COMMUNICATIONS_FROM_EMAIL.");
  }

  try {
    const response = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.COMMUNICATIONS_FROM_EMAIL,
        to: [communication.recipientEmail],
        subject: communication.subject ?? "Customer communication",
        text: communication.bodyText,
        html: communication.bodyHtml ?? `<pre>${communication.bodyText}</pre>`,
        reply_to: env.COMMUNICATIONS_REPLY_TO_EMAIL ?? undefined,
        tags: [
          { name: "category", value: "customer-communication" },
          { name: "recipient", value: communication.recipientName }
        ]
      })
    });

    const payload = (await readProviderPayload(response)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "Failed to send email communication.");
    }

    return {
      providerMessageId: payload?.id ?? null,
      providerMetadata: {
        provider: "resend",
        responseName: payload?.name ?? null
      }
    };
  } catch (error) {
    throw getProviderRequestError("email", error);
  }
}

async function sendLegacyTwilioSmsCommunication(
  communication: Pick<CustomerCommunicationLogEntry, "recipientPhone" | "bodyText">
): Promise<DeliveryResult> {
  const env = getCommunicationDeliveryEnv();

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.COMMUNICATIONS_FROM_PHONE) {
    throw new Error(
      "SMS delivery is not configured. Connect a company SMS provider or set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and COMMUNICATIONS_FROM_PHONE."
    );
  }

  const params = new URLSearchParams({
    From: env.COMMUNICATIONS_FROM_PHONE,
    To: communication.recipientPhone ?? "",
    Body: communication.bodyText,
    StatusCallback: buildAppUrl("api/webhooks/communications/twilio"),
    StatusCallbackMethod: "POST"
  });
  const authToken = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

  try {
    const response = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
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
        twilioStatus: payload?.status ?? null,
        legacyProviderConfig: true
      }
    };
  } catch (error) {
    throw getProviderRequestError("sms", error);
  }
}

async function sendSmsCommunication(
  client: AppSupabaseClient,
  communication: Pick<
    CustomerCommunicationLogEntry,
    "bodyText" | "companyId" | "provider" | "recipientPhone"
  >
): Promise<DeliveryResult> {
  if (communication.provider !== "twilio" && communication.provider !== "telnyx") {
    throw new Error(`Unsupported SMS provider: ${communication.provider}.`);
  }

  const runtimeAccount = await getSmsProviderRuntimeAccount(
    client,
    communication.companyId,
    communication.provider
  );

  if (!runtimeAccount) {
    if (communication.provider === "twilio") {
      return sendLegacyTwilioSmsCommunication(communication);
    }

    throw new Error(`No configured ${communication.provider} account is available for this company.`);
  }

  const adapter = getSmsProviderAdapter(runtimeAccount.provider);

  return adapter.sendMessage(runtimeAccount, {
    bodyText: communication.bodyText,
    statusCallbackUrl: buildSmsProviderWebhookUrl(runtimeAccount.provider, runtimeAccount.id),
    to: communication.recipientPhone ?? ""
  });
}

export async function sendCommunication(
  client: AppSupabaseClient,
  communication: Pick<
    CustomerCommunicationLogEntry,
    | "bodyHtml"
    | "bodyText"
    | "channel"
    | "companyId"
    | "provider"
    | "recipientEmail"
    | "recipientName"
    | "recipientPhone"
    | "subject"
  >
): Promise<DeliveryResult> {
  if (communication.channel === "email") {
    return sendEmailCommunication(communication);
  }

  return sendSmsCommunication(client, communication);
}
