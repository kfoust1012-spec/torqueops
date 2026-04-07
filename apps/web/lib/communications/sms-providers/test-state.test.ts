import type { SmsProviderLastTestResult } from "@mobile-mechanic/types";
import { describe, expect, it } from "vitest";

import {
  applySmsProviderTestDeliveryUpdate,
  buildSmsProviderTestResult,
  getSmsProviderLastTestResult,
  getSmsProviderTestDeliveredAt,
  setSmsProviderLastTestResult
} from "./test-state";

function createTestResult(
  overrides: Partial<SmsProviderLastTestResult> = {}
): SmsProviderLastTestResult {
  return {
    bodyText: "Test",
    deliveredAt: null,
    errorMessage: null,
    failedAt: null,
    phoneNumber: "+15555550123",
    providerMessageId: "message-123",
    providerMetadata: {
      provider: "twilio"
    },
    requestedAt: "2026-03-23T12:00:00.000Z",
    sentAt: "2026-03-23T12:00:00.000Z",
    status: "sent",
    ...overrides
  };
}

describe("sms provider test state", () => {
  it("stores and reloads the last test result from settings json", () => {
    const settingsJson = setSmsProviderLastTestResult({}, createTestResult());
    const parsed = getSmsProviderLastTestResult(settingsJson);

    expect(parsed?.phoneNumber).toBe("+15555550123");
    expect(parsed?.providerMessageId).toBe("message-123");
  });

  it("promotes a sent test result to delivered", () => {
    const delivered = applySmsProviderTestDeliveryUpdate(createTestResult(), {
      provider: "twilio",
      providerMessageId: "message-123",
      status: "delivered",
      occurredAt: "2026-03-23T12:05:00.000Z",
      providerMetadata: {
        twilioStatus: "delivered"
      }
    });

    expect(delivered.status).toBe("delivered");
    expect(getSmsProviderTestDeliveredAt(delivered)).toBe("2026-03-23T12:05:00.000Z");
  });

  it("can build a failed test result directly", () => {
    const failed = buildSmsProviderTestResult({
      bodyText: "Test",
      errorMessage: "Rejected",
      failedAt: "2026-03-23T12:01:00.000Z",
      phoneNumber: "+15555550123",
      providerMessageId: null,
      requestedAt: "2026-03-23T12:00:00.000Z",
      status: "failed"
    });

    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toBe("Rejected");
  });
});
