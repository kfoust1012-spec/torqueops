import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { validateRequest } from "twilio";

import {
  mapTwilioWebhookToDeliveryInput,
  reconcileCommunicationDelivery
} from "../../../../../lib/communications/delivery-webhooks";
import { buildAppUrl, getCommunicationDeliveryEnv } from "../../../../../lib/server-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headerStore = await headers();
  const signature = headerStore.get("x-twilio-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Twilio signature." }, { status: 400 });
  }

  const env = getCommunicationDeliveryEnv();

  if (!env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "Missing required server environment variable: TWILIO_AUTH_TOKEN" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const formFields = Object.fromEntries(new URLSearchParams(body).entries());
  const canonicalWebhookUrl = buildAppUrl("api/webhooks/communications/twilio");
  const isValid =
    validateRequest(env.TWILIO_AUTH_TOKEN, signature, canonicalWebhookUrl, formFields) ||
    validateRequest(env.TWILIO_AUTH_TOKEN, signature, request.url, formFields);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid Twilio webhook signature." }, { status: 400 });
  }

  const deliveryInput = mapTwilioWebhookToDeliveryInput(formFields);

  if (!deliveryInput) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const result = await reconcileCommunicationDelivery(deliveryInput);
  return NextResponse.json({ received: true, matched: result.matched });
}
