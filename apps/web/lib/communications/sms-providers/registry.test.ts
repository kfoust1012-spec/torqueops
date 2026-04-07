import { describe, expect, it } from "vitest";

import { getSmsProviderAdapter } from "./registry";

describe("sms provider registry", () => {
  it("returns the Twilio adapter", () => {
    expect(getSmsProviderAdapter("twilio").provider).toBe("twilio");
  });

  it("returns the Telnyx adapter", () => {
    expect(getSmsProviderAdapter("telnyx").provider).toBe("telnyx");
  });
});
