import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSmsProviderAccountById } from "@mobile-mechanic/api-client";
import { validateRequest } from "twilio";

import {
  mapTwilioWebhookToDeliveryInput,
  reconcileCommunicationDelivery
} from "../../../../../../lib/communications/delivery-webhooks";
import {
  buildTwilioWebhookUrl,
  getSmsProviderRuntimeAccount,
  reconcileSmsProviderTestDelivery
} from "../../../../../../lib/communications/sms-providers/service";
import { getServiceRoleSupabaseClient } from "../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ providerAccountId: string }> }
) {
  const { providerAccountId } = await context.params;
  const headerStore = await headers();
  const signature = headerStore.get("x-twilio-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Twilio signature." }, { status: 400 });
  }

  const client = getServiceRoleSupabaseClient();
  const accountResult = await getSmsProviderAccountById(client, providerAccountId);

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (!accountResult.data || accountResult.data.provider !== "twilio") {
    return NextResponse.json({ error: "Twilio provider account not found." }, { status: 404 });
  }

  const runtimeAccount = await getSmsProviderRuntimeAccount(
    client,
    accountResult.data.companyId,
    "twilio"
  );

  const authToken = runtimeAccount?.credentials?.authToken?.trim();

  if (!authToken) {
    return NextResponse.json(
      { error: "Twilio provider account is missing an auth token." },
      { status: 503 }
    );
  }

  const body = await request.text();
  const formFields = Object.fromEntries(new URLSearchParams(body).entries());
  const canonicalWebhookUrl = buildTwilioWebhookUrl(providerAccountId);
  const isValid =
    validateRequest(authToken, signature, canonicalWebhookUrl, formFields) ||
    validateRequest(authToken, signature, request.url, formFields);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid Twilio webhook signature." }, { status: 400 });
  }

  const deliveryInput = mapTwilioWebhookToDeliveryInput(formFields);

  if (!deliveryInput) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const result = await reconcileCommunicationDelivery(deliveryInput);

  if (result.matched) {
    return NextResponse.json({ received: true, matched: true, testMatched: false });
  }

  const testResult = await reconcileSmsProviderTestDelivery(client, providerAccountId, deliveryInput);
  return NextResponse.json({
    received: true,
    matched: false,
    testMatched: testResult.matched
  });
}
