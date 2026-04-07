import type { TimestampFields, UUID } from "./common";

export const communicationSmsSenderTypes = ["local_10dlc", "toll_free"] as const;
export type CommunicationSmsSenderType = (typeof communicationSmsSenderTypes)[number];

export interface CommunicationOnboardingProfile extends TimestampFields {
  companyId: UUID;
  legalBusinessName: string | null;
  doingBusinessAs: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  websiteUrl: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  supportEmail: string | null;
  optInWorkflow: string | null;
  preferredSenderType: CommunicationSmsSenderType | null;
  campaignDescription: string | null;
  sampleOnTheWayMessage: string | null;
  sampleRunningLateMessage: string | null;
  sampleInvoiceReminderMessage: string | null;
  helpReplyText: string | null;
  stopReplyText: string | null;
  updatedByUserId: UUID;
}

export interface UpsertCommunicationOnboardingProfileInput {
  companyId: UUID;
  legalBusinessName?: string | null | undefined;
  doingBusinessAs?: string | null | undefined;
  businessAddress?: string | null | undefined;
  businessPhone?: string | null | undefined;
  websiteUrl?: string | null | undefined;
  privacyPolicyUrl?: string | null | undefined;
  termsUrl?: string | null | undefined;
  supportEmail?: string | null | undefined;
  optInWorkflow?: string | null | undefined;
  preferredSenderType?: CommunicationSmsSenderType | null | undefined;
  campaignDescription?: string | null | undefined;
  sampleOnTheWayMessage?: string | null | undefined;
  sampleRunningLateMessage?: string | null | undefined;
  sampleInvoiceReminderMessage?: string | null | undefined;
  helpReplyText?: string | null | undefined;
  stopReplyText?: string | null | undefined;
  updatedByUserId: UUID;
}
