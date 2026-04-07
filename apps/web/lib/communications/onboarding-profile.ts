import type { CommunicationOnboardingProfile } from "@mobile-mechanic/types";

export const communicationOnboardingRequiredFields = [
  "legalBusinessName",
  "businessAddress",
  "businessPhone",
  "websiteUrl",
  "privacyPolicyUrl",
  "supportEmail",
  "optInWorkflow",
  "preferredSenderType",
  "campaignDescription",
  "sampleOnTheWayMessage",
  "sampleRunningLateMessage",
  "sampleInvoiceReminderMessage",
  "helpReplyText",
  "stopReplyText"
] as const;

export type CommunicationOnboardingRequiredField =
  (typeof communicationOnboardingRequiredFields)[number];

export const communicationOnboardingFieldLabels: Record<
  CommunicationOnboardingRequiredField,
  string
> = {
  legalBusinessName: "Legal business name",
  businessAddress: "Business address",
  businessPhone: "Business phone",
  websiteUrl: "Website URL",
  privacyPolicyUrl: "Privacy policy URL",
  supportEmail: "Support email",
  optInWorkflow: "Opt-in workflow",
  preferredSenderType: "Preferred sender type",
  campaignDescription: "Campaign description",
  sampleOnTheWayMessage: "Sample on-the-way message",
  sampleRunningLateMessage: "Sample running-late message",
  sampleInvoiceReminderMessage: "Sample invoice reminder message",
  helpReplyText: "HELP reply text",
  stopReplyText: "STOP reply text"
};

export type CommunicationOnboardingProfileSummary = {
  completeFieldCount: number;
  hasAnyValue: boolean;
  isComplete: boolean;
  missingFields: CommunicationOnboardingRequiredField[];
  totalFieldCount: number;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasProfileFieldValue(
  profile: CommunicationOnboardingProfile | null,
  field: CommunicationOnboardingRequiredField
) {
  if (!profile) {
    return false;
  }

  if (field === "preferredSenderType") {
    return profile.preferredSenderType === "local_10dlc" || profile.preferredSenderType === "toll_free";
  }

  return hasValue(profile[field]);
}

function getProfileFieldEntries(profile: CommunicationOnboardingProfile | null) {
  if (!profile) {
    return [];
  }

  return [
    profile.legalBusinessName,
    profile.doingBusinessAs,
    profile.businessAddress,
    profile.businessPhone,
    profile.websiteUrl,
    profile.privacyPolicyUrl,
    profile.termsUrl,
    profile.supportEmail,
    profile.optInWorkflow,
    profile.preferredSenderType,
    profile.campaignDescription,
    profile.sampleOnTheWayMessage,
    profile.sampleRunningLateMessage,
    profile.sampleInvoiceReminderMessage,
    profile.helpReplyText,
    profile.stopReplyText
  ];
}

export function summarizeCommunicationOnboardingProfile(
  profile: CommunicationOnboardingProfile | null
): CommunicationOnboardingProfileSummary {
  const missingFields = communicationOnboardingRequiredFields.filter(
    (field) => !hasProfileFieldValue(profile, field)
  );
  const completeFieldCount =
    communicationOnboardingRequiredFields.length - missingFields.length;

  return {
    completeFieldCount,
    hasAnyValue: getProfileFieldEntries(profile).some((value) =>
      typeof value === "string" ? hasValue(value) : Boolean(value)
    ),
    isComplete: missingFields.length === 0,
    missingFields,
    totalFieldCount: communicationOnboardingRequiredFields.length
  };
}
