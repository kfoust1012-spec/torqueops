import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildShopmonkeyDeltaRunInput,
  isShopmonkeyWebhookTimestampFresh,
  parseShopmonkeyWebhookBody,
  verifyShopmonkeyWebhookSignature
} from "./shopmonkey-webhook";

function signWebhook(payload: string, secret: string, timestamp: string, webhookId: string) {
  return createHmac("sha256", secret)
    .update(`${webhookId}.${timestamp}.${payload}`)
    .digest("base64");
}

describe("shopmonkey webhook helpers", () => {
  it("accepts standard v1 webhook signatures", () => {
    const payload = JSON.stringify({
      data: {
        customerId: "customer-1",
        id: "order-1"
      },
      operation: "updated",
      table: "order"
    });
    const secret = "super-secret";
    const timestamp = "1710000000";
    const webhookId = "wh_123";
    const signature = signWebhook(payload, secret, timestamp, webhookId);

    expect(
      verifyShopmonkeyWebhookSignature({
        payload,
        secret,
        signatureHeader: `v1,bad-signature v1,${signature}`,
        timestamp,
        webhookId
      })
    ).toBe(true);
    expect(
      verifyShopmonkeyWebhookSignature({
        payload,
        secret,
        signatureHeader: "v1,bad-signature",
        timestamp,
        webhookId
      })
    ).toBe(false);
  });

  it("validates freshness, parses payloads, and maps order delta runs", () => {
    const payload = JSON.stringify({
      data: {
        customerId: "customer-1",
        id: "order-1"
      },
      operation: "updated",
      table: "order"
    });
    const body = parseShopmonkeyWebhookBody(payload);

    expect(isShopmonkeyWebhookTimestampFresh("1710000000", 1710000000 * 1000 + 299000)).toBe(
      true
    );
    expect(isShopmonkeyWebhookTimestampFresh("1710000000", 1710000000 * 1000 + 301000)).toBe(
      false
    );
    expect(body).toEqual({
      data: {
        customerId: "customer-1",
        id: "order-1"
      },
      operation: "updated",
      table: "order"
    });
    expect(
      buildShopmonkeyDeltaRunInput({
        body: body!,
        companyId: "company-1",
        startedByUserId: "user-1",
        webhookId: "wh_123",
        webhookReceivedAt: "2026-03-24T10:00:00.000Z"
      })
    ).toEqual({
      companyId: "company-1",
      customerId: "customer-1",
      operation: "updated",
      orderId: "order-1",
      startedByUserId: "user-1",
      table: "order",
      webhookId: "wh_123",
      webhookReceivedAt: "2026-03-24T10:00:00.000Z"
    });
  });

  it("maps customer and vehicle webhook payloads and rejects invalid json", () => {
    const customerBody = parseShopmonkeyWebhookBody(
      JSON.stringify({
        data: {
          id: "customer-99"
        },
        operation: "created",
        table: "customer"
      })
    );
    const vehicleBody = parseShopmonkeyWebhookBody(
      JSON.stringify({
        data: {
          customerId: "customer-99",
          id: "vehicle-10"
        },
        operation: "updated",
        table: "vehicle"
      })
    );

    expect(parseShopmonkeyWebhookBody("{")).toBeNull();
    expect(
      buildShopmonkeyDeltaRunInput({
        body: customerBody!,
        companyId: "company-1",
        startedByUserId: "user-1",
        webhookId: "wh_customer",
        webhookReceivedAt: "2026-03-24T10:00:00.000Z"
      })
    ).toMatchObject({
      companyId: "company-1",
      customerId: "customer-99",
      operation: "created",
      table: "customer"
    });
    expect(
      buildShopmonkeyDeltaRunInput({
        body: vehicleBody!,
        companyId: "company-1",
        startedByUserId: "user-1",
        webhookId: "wh_vehicle",
        webhookReceivedAt: "2026-03-24T10:00:00.000Z"
      })
    ).toMatchObject({
      companyId: "company-1",
      customerId: "customer-99",
      operation: "updated",
      table: "vehicle",
      vehicleId: "vehicle-10"
    });
  });
});
