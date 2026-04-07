import { createPublicKey, verify as verifySignature } from "node:crypto";

import { NextResponse } from "next/server";
import { getSmsProviderAccountById } from "@mobile-mechanic/api-client";

import {
  mapTelnyxWebhookToDeliveryInput,
  reconcileCommunicationDelivery
} from "../../../../../../lib/communications/delivery-webhooks";
import {
  getSmsProviderRuntimeAccount,
  reconcileSmsProviderTestDelivery
} from "../../../../../../lib/communications/sms-providers/service";
import { getServiceRoleSupabaseClient } from "../../../../../../lib/supabase/service-role";

const TELNYX_WEBHOOK_TOLERANCE_SECONDS = 300;
const TELNYX_ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const runtime = "nodejs";

function decodeBase64Value(value: string) {
  return Buffer.from(value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function createTelnyxPublicKey(publicKey: string) {
  const normalized = publicKey.trim();

  if (normalized.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(normalized);
  }

  const keyBytes = decodeBase64Value(normalized);
  const derKey =
    keyBytes.length === 32
      ? Buffer.concat([TELNYX_ED25519_SPKI_PREFIX, keyBytes])
      : keyBytes;

  return createPublicKey({
    key: derKey,
    format: "der",
    type: "spki"
  });
}

function isFreshTelnyxTimestamp(timestamp: string) {
  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  return Math.abs(Date.now() - timestampSeconds * 1000) <= TELNYX_WEBHOOK_TOLERANCE_SECONDS * 1000;
}

function isValidTelnyxSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
) {
  if (!isFreshTelnyxTimestamp(timestamp)) {
    return false;
  }

  try {
    return verifySignature(
      null,
      Buffer.from(`${timestamp}|${body}`),
      createTelnyxPublicKey(publicKey),
      decodeBase64Value(signature)
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ providerAccountId: string }> }
) {
  const { providerAccountId } = await context.params;
  const signature = request.headers.get("telnyx-signature-ed25519");
  const timestamp = request.headers.get("telnyx-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: "Missing Telnyx webhook signature headers." },
      { status: 400 }
    );
  }

  const client = getServiceRoleSupabaseClient();
  const accountResult = await getSmsProviderAccountById(client, providerAccountId);

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (!accountResult.data || accountResult.data.provider !== "telnyx") {
    return NextResponse.json({ error: "Telnyx provider account not found." }, { status: 404 });
  }

  const runtimeAccount = await getSmsProviderRuntimeAccount(
    client,
    accountResult.data.companyId,
    "telnyx"
  );
  const publicKey = runtimeAccount?.credentials?.webhookSigningPublicKey?.trim();

  if (!publicKey) {
    return NextResponse.json(
      { error: "Telnyx provider account is missing a webhook signing public key." },
      { status: 503 }
    );
  }

  const body = await request.text();

  if (!isValidTelnyxSignature(body, signature, timestamp, publicKey)) {
    return NextResponse.json({ error: "Invalid Telnyx webhook signature." }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid Telnyx webhook payload." }, { status: 400 });
  }

  const deliveryInput = mapTelnyxWebhookToDeliveryInput(
    payload as Parameters<typeof mapTelnyxWebhookToDeliveryInput>[0]
  );

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
