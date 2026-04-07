import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import {
  mapResendWebhookToDeliveryInput,
  reconcileCommunicationDelivery
} from "../../../../../lib/communications/delivery-webhooks";
import { getResendWebhookSecret } from "../../../../../lib/server-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getResendWebhookSecret();

  if (!secret) {
    return NextResponse.json(
      { error: "Missing required server environment variable: RESEND_WEBHOOK_SECRET" },
      { status: 503 }
    );
  }

  const headerStore = await headers();
  const svixId = headerStore.get("svix-id");
  const svixTimestamp = headerStore.get("svix-timestamp");
  const svixSignature = headerStore.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Resend webhook signature headers." }, { status: 400 });
  }

  const body = await request.text();

  try {
    new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid Resend webhook signature."
      },
      { status: 400 }
    );
  }

  const payload = JSON.parse(body) as Parameters<typeof mapResendWebhookToDeliveryInput>[0];
  const deliveryInput = mapResendWebhookToDeliveryInput(payload);

  if (!deliveryInput) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const result = await reconcileCommunicationDelivery(deliveryInput);
  return NextResponse.json({ received: true, matched: result.matched });
}