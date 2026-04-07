import type { SmsProviderAccount } from "@mobile-mechanic/types";
import { describe, expect, it } from "vitest";

import { buildSmsOnboardingSteps, getSmsOnboardingPrimaryAction } from "./onboarding";
import type { CommunicationOnboardingProfileSummary } from "./onboarding-profile";
import type { CommunicationReadiness } from "./readiness";

function createReadiness(
  overrides: Partial<CommunicationReadiness> = {}
): CommunicationReadiness {
  return {
    blockReason: "Blocked",
    checklist: [],
    enabledAutomationCount: 0,
    enabledAutomationKeys: [],
    isComplianceProfileComplete: false,
    isReadyForLiveAutomation: false,
    lastDeliveredSmsAt: null,
    lastVerifiedAt: null,
    state: "not_ready",
    summary: "Not ready",
    ...overrides
  };
}

function createOnboardingSummary(
  overrides: Partial<CommunicationOnboardingProfileSummary> = {}
): CommunicationOnboardingProfileSummary {
  return {
    completeFieldCount: 0,
    hasAnyValue: false,
    isComplete: false,
    missingFields: ["legalBusinessName"],
    totalFieldCount: 14,
    ...overrides
  };
}

function createAccount(overrides: Partial<SmsProviderAccount> = {}): SmsProviderAccount {
  return {
    id: "account-1",
    companyId: "company-1",
    provider: "twilio",
    status: "connected",
    displayName: "Twilio",
    fromNumber: "+15555550123",
    isDefault: true,
    credentialHint: "********1234",
    settingsJson: {},
    capabilitiesJson: {},
    lastVerifiedAt: "2026-03-23T12:00:00.000Z",
    lastErrorMessage: null,
    username: "account-sid",
    createdAt: "2026-03-23T12:00:00.000Z",
    updatedAt: "2026-03-23T12:00:00.000Z",
    ...overrides
  };
}

describe("sms onboarding helpers", () => {
  it("starts at provider selection when no account is configured", () => {
    const action = getSmsOnboardingPrimaryAction({
      defaultAccount: null,
      onboardingProfileSummary: createOnboardingSummary(),
      readiness: createReadiness()
    });

    expect(action).toEqual({
      href: "/dashboard/settings/communications/onboarding/provider",
      label: "Continue: Choose provider"
    });
  });

  it("marks all steps complete once delivery and automation are enabled", () => {
    const steps = buildSmsOnboardingSteps({
      defaultAccount: createAccount(),
      onboardingProfileSummary: createOnboardingSummary({
        completeFieldCount: 14,
        isComplete: true,
        missingFields: [],
        totalFieldCount: 14
      }),
      readiness: createReadiness({
        enabledAutomationCount: 2,
        enabledAutomationKeys: ["dispatchEnRouteSmsEnabled", "invoicePaymentReminderSmsEnabled"],
        isComplianceProfileComplete: true,
        isReadyForLiveAutomation: true,
        lastDeliveredSmsAt: "2026-03-23T13:00:00.000Z",
        lastVerifiedAt: "2026-03-23T12:00:00.000Z",
        state: "ready_for_live",
        summary: "Ready"
      })
    });

    expect(steps.every((step) => step.status === "complete")).toBe(true);
  });

  it("keeps test delivery in progress until a delivered sms exists", () => {
    const testStep = buildSmsOnboardingSteps({
      defaultAccount: createAccount(),
      onboardingProfileSummary: createOnboardingSummary({
        completeFieldCount: 14,
        isComplete: true,
        missingFields: [],
        totalFieldCount: 14
      }),
      readiness: createReadiness({
        isComplianceProfileComplete: true,
        lastVerifiedAt: "2026-03-23T12:00:00.000Z",
        state: "ready_for_test",
        summary: "Ready for test"
      })
    }).find((step) => step.id === "test");

    expect(testStep?.status).toBe("in_progress");
  });

  it("keeps compliance in progress until the profile is complete", () => {
    const complianceStep = buildSmsOnboardingSteps({
      defaultAccount: createAccount(),
      onboardingProfileSummary: createOnboardingSummary({
        completeFieldCount: 4,
        hasAnyValue: true,
        missingFields: ["supportEmail"]
      }),
      readiness: createReadiness()
    }).find((step) => step.id === "compliance");

    expect(complianceStep?.status).toBe("in_progress");
  });
});
