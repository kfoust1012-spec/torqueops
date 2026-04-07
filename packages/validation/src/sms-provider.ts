import { z } from "zod";

import {
  smsProviderAccountStatuses,
  smsProviders
} from "@mobile-mechanic/types";

import { emptyStringToNull, optionalNullableStringSchema, uuidSchema } from "./common";

const trimmedString = z.string().trim().min(1);
const jsonRecordSchema = z.record(z.string(), z.unknown());
const e164PhoneSchema = trimmedString.regex(/^\+[1-9][0-9]{1,14}$/, "Use E.164 format.");

export const smsProviderSchema = z.enum(smsProviders);
export const smsProviderAccountStatusSchema = z.enum(smsProviderAccountStatuses);
export const smsProviderDisplayNameSchema = trimmedString.max(120);
export const smsProviderUsernameSchema = trimmedString.max(160);
export const smsProviderSecretSchema = trimmedString.max(240);
export const smsProviderPublicKeySchema = trimmedString.max(4096);
export const smsProviderPhoneSchema = e164PhoneSchema;
export const smsProviderJsonSchema = jsonRecordSchema;

const upsertTwilioSmsProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: z.literal("twilio"),
  displayName: smsProviderDisplayNameSchema,
  fromNumber: smsProviderPhoneSchema,
  accountSid: smsProviderUsernameSchema,
  authToken: smsProviderSecretSchema,
  isDefault: z.boolean().optional()
});

const upsertTelnyxSmsProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: z.literal("telnyx"),
  displayName: smsProviderDisplayNameSchema,
  fromNumber: smsProviderPhoneSchema,
  apiKey: smsProviderSecretSchema,
  messagingProfileId: z.preprocess(emptyStringToNull, optionalNullableStringSchema),
  webhookSigningPublicKey: smsProviderPublicKeySchema,
  isDefault: z.boolean().optional()
});

export const upsertSmsProviderAccountInputSchema = z.discriminatedUnion("provider", [
  upsertTwilioSmsProviderAccountInputSchema,
  upsertTelnyxSmsProviderAccountInputSchema
]);

export const verifySmsProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: smsProviderSchema
});

export const disconnectSmsProviderAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: smsProviderSchema
});
