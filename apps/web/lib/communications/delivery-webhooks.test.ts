import type { CustomerCommunicationLogEntry } from "@mobile-mechanic/types";
import { describe, expect, it } from "vitest";

import {
  buildDeliveryStatusUpdate,
  mapTelnyxWebhookToDeliveryInput,
  mapResendWebhookToDeliveryInput,
  mapTwilioWebhookToDeliveryInput
} from "./delivery-webhooks";

function createCommunication(
  overrides: Partial<CustomerCommunicationLogEntry> = {}
): CustomerCommunicationLogEntry {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    companyId: "22222222-2222-2222-2222-222222222222",
    customerId: "33333333-3333-3333-3333-333333333333",
    jobId: null,
    estimateId: null,
    invoiceId: null,
    paymentId: null,
    eventId: null,
    communicationType: "invoice_notification",
    channel: "email",
    status: "sent",
    recipientName: "Jamie Carter",
    recipientEmail: "jamie@example.com",
    recipientPhone: null,
    subject: "Invoice ready",
    bodyText: "Your invoice is ready.",
    bodyHtml: null,
    provider: "resend",
    providerMessageId: "message-123",
    providerMetadata: { provider: "resend" },
    errorCode: null,
    errorMessage: null,
    queuedAt: "2026-01-01T00:00:00.000Z",
    sentAt: "2026-01-01T00:01:00.000Z",
    deliveredAt: null,
    failedAt: null,
    createdByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    ...overrides
  };
}

describe("delivery webhook mapping", () => {
  it("maps Resend delivered events", () => {
    const result = mapResendWebhookToDeliveryInput({
      type: "email.delivered",
      created_at: "2026-01-02T10:00:00.000Z",
      data: {
        email_id: "email-123",
        to: ["jamie@example.com"],
        subject: "Invoice ready"
      }
    });

    expect(result).toMatchObject({
      provider: "resend",
      providerMessageId: "email-123",
      status: "delivered"
    });
  });

  it("maps Twilio failure statuses", () => {
    const result = mapTwilioWebhookToDeliveryInput({
      MessageSid: "SM123",
      MessageStatus: "undelivered",
      ErrorCode: "30003",
      To: "+15555550123",
      From: "+15555550999"
    });

    expect(result).toMatchObject({
      provider: "twilio",
      providerMessageId: "SM123",
      status: "failed",
      errorCode: "30003"
    });
  });

  it("maps Telnyx finalized delivery failures", () => {
    const result = mapTelnyxWebhookToDeliveryInput({
      data: {
        event_type: "message.finalized",
        id: "event-123",
        occurred_at: "2026-01-02T10:00:00.000Z",
        payload: {
          id: "telnyx-message-123",
          from: { phone_number: "+15555550999" },
          to: [
            {
              phone_number: "+15555550123",
              status: "delivery_failed",
              updated_at: "2026-01-02T10:00:01.000Z"
            }
          ],
          errors: [
            {
              code: "40300",
              detail: "Destination handset is unavailable."
            }
          ]
        }
      },
      meta: {
        attempt: 1,
        delivered_to: "https://example.com/webhooks/telnyx"
      }
    });

    expect(result).toMatchObject({
      provider: "telnyx",
      providerMessageId: "telnyx-message-123",
      status: "failed",
      errorCode: "40300"
    });
  });
});

describe("delivery webhook reconciliation updates", () => {
  it("promotes delivered status and clears delivery errors", () => {
    const update = buildDeliveryStatusUpdate(
      createCommunication({ status: "sent", errorCode: "delivery_failed", errorMessage: "old error" }),
      {
        provider: "resend",
        providerMessageId: "message-123",
        status: "delivered",
        occurredAt: "2026-01-02T10:00:00.000Z",
        providerMetadata: { resendEventType: "email.delivered" }
      }
    );

    expect(update.status).toBe("delivered");
    expect(update.errorCode).toBeNull();
    expect(update.errorMessage).toBeNull();
    expect(update.deliveredAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it("does not regress delivered communications back to failed", () => {
    const update = buildDeliveryStatusUpdate(
      createCommunication({ status: "delivered", deliveredAt: "2026-01-02T09:00:00.000Z" }),
      {
        provider: "twilio",
        providerMessageId: "message-123",
        status: "failed",
        errorCode: "30005",
        errorMessage: "Unknown destination handset"
      }
    );

    expect(update.status).toBe("delivered");
    expect(update.errorCode).toBeUndefined();
    expect(update.failedAt).toBeUndefined();
  });
});
