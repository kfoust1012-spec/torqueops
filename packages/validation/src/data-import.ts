import { z } from "zod";

import { dataImportRunStatuses, migrationSourceProviders } from "@mobile-mechanic/types";

import { uuidSchema } from "./common";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const dataImportRunStatusSchema = z.enum(dataImportRunStatuses);

export const createDataImportRunInputSchema = z.object({
  companyId: uuidSchema,
  sourceAccountId: uuidSchema,
  provider: z.enum(migrationSourceProviders),
  startedByUserId: uuidSchema,
  optionsJson: jsonRecordSchema.optional()
});
