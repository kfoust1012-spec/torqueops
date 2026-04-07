import { describe, expect, it } from "vitest";

import { buildAppUrl, getAppUrl, getCarfaxConfig, getServerEnv } from "./server-env";

describe("server env URL handling", () => {
  it("normalizes APP_URL without a trailing slash", () => {
    process.env.APP_URL = "https://staging.example.com/";

    expect(getAppUrl()).toBe("https://staging.example.com");
  });

  it("builds app URLs against an optional base path", () => {
    process.env.APP_URL = "https://example.com/platform/";

    expect(buildAppUrl("invoice/test-token")).toBe("https://example.com/platform/invoice/test-token");
    expect(buildAppUrl("/api/webhooks/communications/twilio")).toBe(
      "https://example.com/platform/api/webhooks/communications/twilio"
    );
  });

  it("normalizes optional absolute URLs in server env output", () => {
    process.env.APP_URL = "https://app.example.com/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.CUSTOMER_DOCUMENT_TOKEN_SECRET = "document-secret";
    process.env.STRIPE_SECRET_KEY = "stripe-secret";
    process.env.STRIPE_WEBHOOK_SECRET = "stripe-webhook-secret";
    process.env.CARFAX_API_KEY = "carfax-key";
    process.env.CARFAX_API_BASE_URL = "https://api.carfax.example.com/v1/";

    expect(getCarfaxConfig()).toEqual({
      apiKey: "carfax-key",
      baseUrl: "https://api.carfax.example.com/v1"
    });

    expect(getServerEnv().APP_URL).toBe("https://app.example.com");
    expect(getServerEnv().CARFAX_API_BASE_URL).toBe("https://api.carfax.example.com/v1");
  });
});
