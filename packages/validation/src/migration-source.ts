import { z } from "zod";

import {
  migrationSourceAccountStatuses,
  migrationSourceProviders
} from "@mobile-mechanic/types";

import { uuidSchema } from "./common";

const trimmedString = z.string().trim().min(1);
const jsonRecordSchema = z.record(z.string(), z.unknown());

export const migrationSourceProviderSchema = z.enum(migrationSourceProviders);
export const migrationSourceAccountStatusSchema = z.enum(
  migrationSourceAccountStatuses
);
export const migrationSourceDisplayNameSchema = trimmedString.max(120);
export const migrationSourceSecretSchema = trimmedString.max(512);
export const migrationSourceJsonSchema = jsonRecordSchema;

export const upsertMigrationSourceAccountInputSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      companyId: uuidSchema,
      provider: z.literal("shopmonkey"),
      displayName: migrationSourceDisplayNameSchema,
      apiKey: migrationSourceSecretSchema
    })
  ]
);

export const verifyMigrationSourceAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: migrationSourceProviderSchema
});

export const disconnectMigrationSourceAccountInputSchema = z.object({
  companyId: uuidSchema,
  provider: migrationSourceProviderSchema
});
