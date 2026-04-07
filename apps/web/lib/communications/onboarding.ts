import type { SmsProviderAccount } from "@mobile-mechanic/types";

import type { CommunicationOnboardingProfileSummary } from "./onboarding-profile";
import type { CommunicationReadiness } from "./readiness";

export const smsOnboardingStepIds = [
  "provider",
  "compliance",
  "connect",
  "test",
  "review"
] as const;

export type SmsOnboardingStepId = (typeof smsOnboardingStepIds)[number];
export type SmsOnboardingStepStatus = "not_started" | "in_progress" | "blocked" | "complete";

export type SmsOnboardingStep = {
  description: string;
  href: string;
  id: SmsOnboardingStepId;
  label: string;
  status: SmsOnboardingStepStatus;
};

type SmsOnboardingInput = {
  defaultAccount: SmsProviderAccount | null;
  onboardingProfileSummary: CommunicationOnboardingProfileSummary;
  readiness: CommunicationReadiness;
};

function resolveProviderStepStatus(input: SmsOnboardingInput): SmsOnboardingStepStatus {
  return input.defaultAccount ? "complete" : "in_progress";
}

function resolveComplianceStepStatus(input: SmsOnboardingInput): SmsOnboardingStepStatus {
  if (!input.defaultAccount) {
    return "not_started";
  }

  if (input.onboardingProfileSummary.isComplete) {
    return "complete";
  }

  return input.onboardingProfileSummary.hasAnyValue ? "in_progress" : "not_started";
}

function resolveConnectStepStatus(input: SmsOnboardingInput): SmsOnboardingStepStatus {
  if (!input.defaultAccount) {
    return "not_started";
  }

  if (input.defaultAccount.status === "connected" && input.defaultAccount.lastVerifiedAt) {
    return "complete";
  }

  if (
    input.defaultAccount.status === "action_required" ||
    input.defaultAccount.status === "error"
  ) {
    return "blocked";
  }

  return "in_progress";
}

function resolveTestStepStatus(input: SmsOnboardingInput): SmsOnboardingStepStatus {
  if (!input.defaultAccount) {
    return "not_started";
  }

  if (input.readiness.lastDeliveredSmsAt) {
    return "complete";
  }

  return input.defaultAccount.status === "connected" ? "in_progress" : "blocked";
}

function resolveReviewStepStatus(input: SmsOnboardingInput): SmsOnboardingStepStatus {
  if (input.readiness.enabledAutomationCount > 0) {
    return "complete";
  }

  return input.readiness.isReadyForLiveAutomation ? "in_progress" : "blocked";
}

export function buildSmsOnboardingSteps(input: SmsOnboardingInput): SmsOnboardingStep[] {
  return [
    {
      id: "provider",
      label: "Choose provider",
      description: "Pick Twilio or Telnyx as the company default SMS transport.",
      href: "/dashboard/settings/communications/onboarding/provider",
      status: resolveProviderStepStatus(input)
    },
    {
      id: "compliance",
      label: "Prepare compliance",
      description: "Gather business identity, consent flow, and sample-message details for the provider portal.",
      href: "/dashboard/settings/communications/onboarding/compliance",
      status: resolveComplianceStepStatus(input)
    },
    {
      id: "connect",
      label: "Connect provider",
      description: "Save credentials, sender number, and verify the provider connection.",
      href: "/dashboard/settings/communications/onboarding/connect",
      status: resolveConnectStepStatus(input)
    },
    {
      id: "test",
      label: "Run test delivery",
      description: "Deliver one real SMS so live automations can be safely unlocked.",
      href: "/dashboard/settings/communications/onboarding/test",
      status: resolveTestStepStatus(input)
    },
    {
      id: "review",
      label: "Review and enable",
      description: "Confirm readiness and turn on the live automation toggles you want.",
      href: "/dashboard/settings/communications/onboarding/review",
      status: resolveReviewStepStatus(input)
    }
  ];
}

export function getSmsOnboardingPrimaryAction(input: SmsOnboardingInput) {
  const firstIncomplete = buildSmsOnboardingSteps(input).find((step) => step.status !== "complete");

  return {
    href: firstIncomplete?.href ?? "/dashboard/settings/communications/onboarding/review",
    label: firstIncomplete ? `Continue: ${firstIncomplete.label}` : "Review onboarding"
  };
}
