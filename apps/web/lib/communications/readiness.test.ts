import { describe, expect, it } from "vitest";

import { deriveCommunicationReadiness } from "./readiness";

describe("communication readiness", () => {
  it("blocks readiness when no default provider exists", () => {
    const readiness = deriveCommunicationReadiness({
      automationSettings: {
        dispatchEnRouteSmsEnabled: false,
        dispatchRunningLateSmsEnabled: false,
        invoicePaymentReminderSmsEnabled: false
      },
      defaultAccount: null,
      isComplianceProfileComplete: false,
      lastDeliveredSmsAt: null
    });

    expect(readiness.state).toBe("not_ready");
    expect(readiness.isReadyForLiveAutomation).toBe(false);
  });

  it("requires verification before live activation", () => {
    const readiness = deriveCommunicationReadiness({
      automationSettings: {
        dispatchEnRouteSmsEnabled: true,
        dispatchRunningLateSmsEnabled: false,
        invoicePaymentReminderSmsEnabled: false
      },
      defaultAccount: {
        id: "provider-1",
        companyId: "company-1",
        provider: "twilio",
        status: "action_required",
        displayName: "Twilio",
        username: "AC123",
        fromNumber: "+15555550123",
        isDefault: true,
        credentialHint: "abcd",
        settingsJson: {},
        capabilitiesJson: {},
        lastVerifiedAt: null,
        lastErrorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      isComplianceProfileComplete: true,
      lastDeliveredSmsAt: null
    });

    expect(readiness.state).toBe("verification_pending");
    expect(readiness.enabledAutomationCount).toBe(1);
  });

  it("requires a delivered sms before live activation", () => {
    const readiness = deriveCommunicationReadiness({
      automationSettings: {
        dispatchEnRouteSmsEnabled: false,
        dispatchRunningLateSmsEnabled: false,
        invoicePaymentReminderSmsEnabled: false
      },
      defaultAccount: {
        id: "provider-1",
        companyId: "company-1",
        provider: "telnyx",
        status: "connected",
        displayName: "Telnyx",
        username: null,
        fromNumber: "+15555550123",
        isDefault: true,
        credentialHint: "abcd",
        settingsJson: {},
        capabilitiesJson: {},
        lastVerifiedAt: "2026-01-02T00:00:00.000Z",
        lastErrorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      isComplianceProfileComplete: true,
      lastDeliveredSmsAt: null
    });

    expect(readiness.state).toBe("ready_for_test");
    expect(readiness.isReadyForLiveAutomation).toBe(false);
  });

  it("becomes ready when the default provider is connected and a delivery has been observed", () => {
    const readiness = deriveCommunicationReadiness({
      automationSettings: {
        dispatchEnRouteSmsEnabled: true,
        dispatchRunningLateSmsEnabled: true,
        invoicePaymentReminderSmsEnabled: false
      },
      defaultAccount: {
        id: "provider-1",
        companyId: "company-1",
        provider: "twilio",
        status: "connected",
        displayName: "Twilio",
        username: "AC123",
        fromNumber: "+15555550123",
        isDefault: true,
        credentialHint: "abcd",
        settingsJson: {},
        capabilitiesJson: {},
        lastVerifiedAt: "2026-01-02T00:00:00.000Z",
        lastErrorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      isComplianceProfileComplete: true,
      lastDeliveredSmsAt: "2026-01-03T00:00:00.000Z"
    });

    expect(readiness.state).toBe("ready_for_live");
    expect(readiness.enabledAutomationCount).toBe(2);
    expect(readiness.isReadyForLiveAutomation).toBe(true);
  });

  it("blocks readiness when the compliance profile is incomplete", () => {
    const readiness = deriveCommunicationReadiness({
      automationSettings: {
        dispatchEnRouteSmsEnabled: false,
        dispatchRunningLateSmsEnabled: false,
        invoicePaymentReminderSmsEnabled: false
      },
      defaultAccount: {
        id: "provider-1",
        companyId: "company-1",
        provider: "twilio",
        status: "connected",
        displayName: "Twilio",
        username: "AC123",
        fromNumber: "+15555550123",
        isDefault: true,
        credentialHint: "abcd",
        settingsJson: {},
        capabilitiesJson: {},
        lastVerifiedAt: "2026-01-02T00:00:00.000Z",
        lastErrorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      isComplianceProfileComplete: false,
      lastDeliveredSmsAt: null
    });

    expect(readiness.state).toBe("not_ready");
    expect(readiness.blockReason).toContain("compliance");
  });
});
