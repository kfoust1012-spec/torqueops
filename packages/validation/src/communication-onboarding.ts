import { z } from "zod";

import { communicationSmsSenderTypes } from "@mobile-mechanic/types";

import { emptyStringToNull, uuidSchema } from "./common";

const trimmedNullableString = (maxLength: number) =>
  z.preprocess(
    emptyStringToNull,
    z.string().trim().max(maxLength).nullable().optional()
  );

const trimmedNullableUrl = z.preprocess(
  emptyStringToNull,
  z.string().trim().url().max(300).nullable().optional()
);

const trimmedNullableEmail = z.preprocess(
  emptyStringToNull,
  z.string().trim().email().max(160).nullable().optional()
);

export const communicationSmsSenderTypeSchema = z.enum(communicationSmsSenderTypes);

export const upsertCommunicationOnboardingProfileInputSchema = z.object({
  companyId: uuidSchema,
  legalBusinessName: trimmedNullableString(160),
  doingBusinessAs: trimmedNullableString(160),
  businessAddress: trimmedNullableString(500),
  businessPhone: trimmedNullableString(40),
  websiteUrl: trimmedNullableUrl,
  privacyPolicyUrl: trimmedNullableUrl,
  termsUrl: trimmedNullableUrl,
  supportEmail: trimmedNullableEmail,
  optInWorkflow: trimmedNullableString(2000),
  preferredSenderType: z.preprocess(
    emptyStringToNull,
    communicationSmsSenderTypeSchema.nullable().optional()
  ),
  campaignDescription: trimmedNullableString(2000),
  sampleOnTheWayMessage: trimmedNullableString(500),
  sampleRunningLateMessage: trimmedNullableString(500),
  sampleInvoiceReminderMessage: trimmedNullableString(500),
  helpReplyText: trimmedNullableString(500),
  stopReplyText: trimmedNullableString(500),
  updatedByUserId: uuidSchema
});
