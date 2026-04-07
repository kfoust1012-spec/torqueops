import type { AppSupabaseClient } from "@mobile-mechanic/api-client";
import {
  getCommunicationAutomationSettings,
  getCommunicationOnboardingProfile,
  getLatestDeliveredSmsCommunicationByProvider
} from "@mobile-mechanic/api-client";
import type { CommunicationAutomationSettings, SmsProviderAccount } from "@mobile-mechanic/types";

import { summarizeCommunicationOnboardingProfile } from "./onboarding-profile";
import { getSmsProviderLastTestResult, getSmsProviderTestDeliveredAt } from "./sms-providers/test-state";
import { getCommunicationsSettingsWorkspace } from "./sms-providers/service";

export type CommunicationAutomationKey =
  | "dispatchEnRouteSmsEnabled"
  | "dispatchRunningLateSmsEnabled"
  | "invoicePaymentReminderSmsEnabled";

export type CommunicationChecklistStatus = "complete" | "in_progress" | "blocked";
export type CommunicationReadinessState =
  | "not_ready"
  | "verification_pending"
  | "ready_for_test"
  | "ready_for_live";

export type CommunicationReadinessChecklistItem = {
  description: string;
  href: string | null;
  id: string;
  label: string;
  status: CommunicationChecklistStatus;
};

export type CommunicationReadiness = {
  blockReason: string | null;
  checklist: CommunicationReadinessChecklistItem[];
  enabledAutomationCount: number;
  enabledAutomationKeys: CommunicationAutomationKey[];
  isComplianceProfileComplete: boolean;
  isReadyForLiveAutomation: boolean;
  lastDeliveredSmsAt: string | null;
  lastVerifiedAt: string | null;
  state: CommunicationReadinessState;
  summary: string;
};

export function buildDefaultCommunicationAutomationSettings(
  companyId: string,
  updatedByUserId: string
): CommunicationAutomationSettings {
  const now = new Date().toISOString();

  return {
    companyId,
    dispatchEnRouteSmsEnabled: false,
    dispatchRunningLateSmsEnabled: false,
    invoicePaymentReminderSmsEnabled: false,
    updatedByUserId,
    createdAt: now,
    updatedAt: now
  };
}

export function deriveCommunicationReadiness(input: {
  automationSettings: Pick<
    CommunicationAutomationSettings,
    | "dispatchEnRouteSmsEnabled"
    | "dispatchRunningLateSmsEnabled"
    | "invoicePaymentReminderSmsEnabled"
  >;
  defaultAccount: SmsProviderAccount | null;
  isComplianceProfileComplete: boolean;
  lastDeliveredSmsAt: string | null;
}) {
  const senderNumberSaved = Boolean(input.defaultAccount?.fromNumber?.trim());
  const providerVerified =
    input.defaultAccount?.status === "connected" && Boolean(input.defaultAccount.lastVerifiedAt);
  const enabledAutomationKeys = (
    [
      input.automationSettings.dispatchEnRouteSmsEnabled && "dispatchEnRouteSmsEnabled",
      input.automationSettings.dispatchRunningLateSmsEnabled && "dispatchRunningLateSmsEnabled",
      input.automationSettings.invoicePaymentReminderSmsEnabled &&
        "invoicePaymentReminderSmsEnabled"
    ] as const
  ).filter((value): value is CommunicationAutomationKey => Boolean(value));
  const checklist: CommunicationReadinessChecklistItem[] = [
    {
      id: "default-provider",
      label: "Default provider selected",
      description: "A shop-level SMS provider must be selected before automation can run.",
      href: "/dashboard/settings/communications",
      status: input.defaultAccount ? "complete" : "blocked"
    },
    {
      id: "compliance-profile",
      label: "Compliance profile saved",
      description: "Save the shop identity, consent flow, and sample message details before live activation.",
      href: "/dashboard/settings/communications/onboarding/compliance",
      status: input.isComplianceProfileComplete
        ? "complete"
        : input.defaultAccount
          ? "blocked"
          : "in_progress"
    },
    {
      id: "sender-number",
      label: "Sender number saved",
      description: "The default provider must have a valid outbound sender number.",
      href: input.defaultAccount
        ? `/dashboard/settings/communications/${input.defaultAccount.provider}`
        : "/dashboard/settings/communications",
      status: senderNumberSaved ? "complete" : input.defaultAccount ? "blocked" : "in_progress"
    },
    {
      id: "provider-verified",
      label: "Provider verified",
      description: "The provider account must be connected and recently verified from settings.",
      href: input.defaultAccount
        ? `/dashboard/settings/communications/${input.defaultAccount.provider}`
        : "/dashboard/settings/communications",
      status: providerVerified ? "complete" : input.defaultAccount ? "blocked" : "in_progress"
    },
    {
      id: "delivery-observed",
      label: "Delivered SMS observed",
      description: "At least one delivered SMS on the default provider is required before live activation.",
      href: "/dashboard/settings/communications",
      status: input.lastDeliveredSmsAt ? "complete" : providerVerified ? "blocked" : "in_progress"
    }
  ];

  let state: CommunicationReadinessState = "ready_for_live";
  let summary = "Customer SMS is ready for live automation.";
  let blockReason: string | null = null;

  if (!input.defaultAccount || !senderNumberSaved) {
    state = "not_ready";
    summary = "Connect a supported SMS provider and save a sender number first.";
    blockReason = "Select a default SMS provider and save a sender number first.";
  } else if (!input.isComplianceProfileComplete) {
    state = "not_ready";
    summary = "Save the shop compliance and consent profile before live activation.";
    blockReason = "Complete the compliance preparation step before enabling automations.";
  } else if (!providerVerified) {
    state = "verification_pending";
    summary = "The default SMS provider still needs verification.";
    blockReason = "Verify the default SMS provider before enabling automations.";
  } else if (!input.lastDeliveredSmsAt) {
    state = "ready_for_test";
    summary = "Provider setup is complete, but a delivered SMS has not been observed yet.";
    blockReason = "Send and deliver at least one SMS on the default provider before enabling automations.";
  }

  return {
    blockReason,
    checklist,
    enabledAutomationCount: enabledAutomationKeys.length,
    enabledAutomationKeys,
    isComplianceProfileComplete: input.isComplianceProfileComplete,
    isReadyForLiveAutomation: state === "ready_for_live",
    lastDeliveredSmsAt: input.lastDeliveredSmsAt,
    lastVerifiedAt: input.defaultAccount?.lastVerifiedAt ?? null,
    state,
    summary
  } satisfies CommunicationReadiness;
}

export async function getCommunicationsDashboardWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  currentUserId: string
) {
  const workspace = await getCommunicationsSettingsWorkspace(client, companyId);
  const [automationSettingsResult, deliveredSmsResult, onboardingProfileResult] = await Promise.all([
    getCommunicationAutomationSettings(client, companyId),
    workspace.defaultAccount
      ? getLatestDeliveredSmsCommunicationByProvider(
          client,
          companyId,
          workspace.defaultAccount.provider
        )
      : Promise.resolve({
          data: null,
          error: null
        }),
    getCommunicationOnboardingProfile(client, companyId)
  ]);

  if (automationSettingsResult.error) {
    throw automationSettingsResult.error;
  }

  if (deliveredSmsResult.error) {
    throw deliveredSmsResult.error;
  }

  if (onboardingProfileResult.error) {
    throw onboardingProfileResult.error;
  }

  const automationSettings =
    automationSettingsResult.data ??
    buildDefaultCommunicationAutomationSettings(companyId, currentUserId);
  const onboardingProfile = onboardingProfileResult.data ?? null;
  const onboardingProfileSummary = summarizeCommunicationOnboardingProfile(onboardingProfile);
  const lastProviderTestResult = workspace.defaultAccount
    ? getSmsProviderLastTestResult(workspace.defaultAccount)
    : null;
  const deliveredCommunicationAt =
    deliveredSmsResult.data?.deliveredAt ?? deliveredSmsResult.data?.createdAt ?? null;
  const deliveredTestAt = getSmsProviderTestDeliveredAt(lastProviderTestResult);
  const observedDeliveredAt =
    deliveredCommunicationAt && deliveredTestAt
      ? new Date(deliveredCommunicationAt) >= new Date(deliveredTestAt)
        ? deliveredCommunicationAt
        : deliveredTestAt
      : deliveredCommunicationAt ?? deliveredTestAt ?? null;
  const readiness = deriveCommunicationReadiness({
    automationSettings,
    defaultAccount: workspace.defaultAccount,
    isComplianceProfileComplete: onboardingProfileSummary.isComplete,
    lastDeliveredSmsAt: observedDeliveredAt
  });

  return {
    ...workspace,
    automationSettings,
    lastProviderTestResult,
    onboardingProfile,
    onboardingProfileSummary,
    readiness
  };
}
