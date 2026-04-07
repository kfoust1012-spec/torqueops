import { describe, expect, it } from "vitest";

import {
  buildTelnyxWebhookPath,
  buildTelnyxWebhookUrl,
  buildTwilioWebhookPath,
  buildTwilioWebhookUrl
} from "./service";

describe("twilio sms provider service", () => {
  it("builds the account-specific webhook path", () => {
    expect(buildTwilioWebhookPath("provider-account-123")).toBe(
      "api/webhooks/communications/twilio/provider-account-123"
    );
  });

  it("builds the account-specific webhook url against APP_URL", () => {
    process.env.APP_URL = "https://example.com/platform/";

    expect(buildTwilioWebhookUrl("provider-account-123")).toBe(
      "https://example.com/platform/api/webhooks/communications/twilio/provider-account-123"
    );
  });
});

describe("telnyx sms provider service", () => {
  it("builds the account-specific webhook path", () => {
    expect(buildTelnyxWebhookPath("provider-account-456")).toBe(
      "api/webhooks/communications/telnyx/provider-account-456"
    );
  });

  it("builds the account-specific webhook url against APP_URL", () => {
    process.env.APP_URL = "https://example.com/platform/";

    expect(buildTelnyxWebhookUrl("provider-account-456")).toBe(
      "https://example.com/platform/api/webhooks/communications/telnyx/provider-account-456"
    );
  });
});
