import type { CommunicationOnboardingProfile } from "@mobile-mechanic/types";
import { describe, expect, it } from "vitest";

import { summarizeCommunicationOnboardingProfile } from "./onboarding-profile";

function createProfile(
  overrides: Partial<CommunicationOnboardingProfile> = {}
): CommunicationOnboardingProfile {
  return {
    companyId: "company-1",
    legalBusinessName: "Mobile Mechanic Co",
    doingBusinessAs: "Mobile Mechanic",
    businessAddress: "123 Main Street",
    businessPhone: "(555) 555-0123",
    websiteUrl: "https://example.com",
    privacyPolicyUrl: "https://example.com/privacy",
    termsUrl: "https://example.com/terms",
    supportEmail: "help@example.com",
    optInWorkflow: "Customers opt in during booking.",
    preferredSenderType: "local_10dlc",
    campaignDescription: "Dispatch updates and invoice reminders.",
    sampleOnTheWayMessage: "We are on the way.",
    sampleRunningLateMessage: "We are running late.",
    sampleInvoiceReminderMessage: "Your invoice is due.",
    helpReplyText: "Reply HELP for assistance.",
    stopReplyText: "Reply STOP to opt out.",
    updatedByUserId: "user-1",
    createdAt: "2026-03-23T12:00:00.000Z",
    updatedAt: "2026-03-23T12:00:00.000Z",
    ...overrides
  };
}

describe("communication onboarding profile summary", () => {
  it("treats a complete profile as complete", () => {
    const summary = summarizeCommunicationOnboardingProfile(createProfile());

    expect(summary.isComplete).toBe(true);
    expect(summary.completeFieldCount).toBe(summary.totalFieldCount);
  });

  it("tracks missing required fields", () => {
    const summary = summarizeCommunicationOnboardingProfile(
      createProfile({
        supportEmail: null,
        sampleRunningLateMessage: "   "
      })
    );

    expect(summary.isComplete).toBe(false);
    expect(summary.missingFields).toContain("supportEmail");
    expect(summary.missingFields).toContain("sampleRunningLateMessage");
  });
});
