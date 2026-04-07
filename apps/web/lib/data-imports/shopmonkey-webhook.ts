import { createHmac, timingSafeEqual } from "node:crypto";

export const SHOPMONKEY_WEBHOOK_TOLERANCE_SECONDS = 300;

export type ShopmonkeyWebhookBody = {
  data: Record<string, unknown>;
  operation: string | null;
  table: string | null;
};

export type ShopmonkeyDeltaRunInput = {
  companyId: string;
  customerId?: string;
  operation?: string;
  orderId?: string;
  startedByUserId: string;
  table?: string;
  vehicleId?: string;
  webhookId?: string;
  webhookReceivedAt?: string;
};

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function listV1Signatures(signatureHeader: string) {
  return signatureHeader
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      if (entry.startsWith("v1,")) {
        const signature = entry.slice(3).trim();
        return signature ? [signature] : [];
      }

      if (entry.startsWith("v1=")) {
        const signature = entry.slice(3).trim();
        return signature ? [signature] : [];
      }

      return [];
    });
}

export function getShopmonkeyWebhookHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

export function isShopmonkeyWebhookTimestampFresh(
  timestamp: string,
  now = Date.now(),
  toleranceSeconds = SHOPMONKEY_WEBHOOK_TOLERANCE_SECONDS
) {
  const timestampSeconds = Number(timestamp);

  return (
    Number.isFinite(timestampSeconds) &&
    Math.abs(now - timestampSeconds * 1000) <= toleranceSeconds * 1000
  );
}

export function verifyShopmonkeyWebhookSignature(input: {
  payload: string;
  secret: string;
  signatureHeader: string;
  timestamp: string;
  webhookId: string;
}) {
  const expected = createHmac("sha256", input.secret)
    .update(`${input.webhookId}.${input.timestamp}.${input.payload}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return listV1Signatures(input.signatureHeader).some((signature) => {
    const providedBuffer = Buffer.from(signature, "utf8");

    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  });
}

export function parseShopmonkeyWebhookBody(payload: string) {
  try {
    const parsed = JSON.parse(payload) as unknown;
    const body = toObject(parsed);

    if (!body) {
      return null;
    }

    return {
      data: toObject(body.data) ?? {},
      operation: toOptionalString(body.operation),
      table: toOptionalString(body.table)
    } satisfies ShopmonkeyWebhookBody;
  } catch {
    return null;
  }
}

export function buildShopmonkeyDeltaRunInput(input: {
  body: ShopmonkeyWebhookBody;
  companyId: string;
  startedByUserId: string;
  webhookId: string;
  webhookReceivedAt: string;
}) {
  const record = input.body.data;
  const runInput: ShopmonkeyDeltaRunInput = {
    companyId: input.companyId,
    startedByUserId: input.startedByUserId,
    webhookId: input.webhookId,
    webhookReceivedAt: input.webhookReceivedAt
  };
  const customerId =
    toOptionalString(record.customerId) ??
    (input.body.table === "customer" ? toOptionalString(record.id) : null);

  if (customerId) {
    runInput.customerId = customerId;
  }

  if (input.body.operation) {
    runInput.operation = input.body.operation;
  }

  if (input.body.table) {
    runInput.table = input.body.table;
  }

  if (input.body.table === "order") {
    const orderId = toOptionalString(record.id);

    if (orderId) {
      runInput.orderId = orderId;
    }
  }

  if (input.body.table === "vehicle") {
    const vehicleId = toOptionalString(record.id);

    if (vehicleId) {
      runInput.vehicleId = vehicleId;
    }
  }

  return runInput;
}
