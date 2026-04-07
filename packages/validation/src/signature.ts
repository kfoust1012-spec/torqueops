import { maxSignatureFileSizeBytes, signatureMimeTypes } from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";

export const signerNameSchema = z.string().trim().min(2).max(120);
export const approvalStatementSchema = z.string().trim().min(10).max(2000);
export const signatureMimeTypeSchema = z.enum(signatureMimeTypes);

export const approveEstimateInputSchema = z.object({
  signatureId: uuidSchema,
  estimateId: uuidSchema,
  companyId: uuidSchema,
  jobId: uuidSchema,
  signedByName: signerNameSchema,
  statement: approvalStatementSchema,
  capturedByUserId: uuidSchema.nullable().optional(),
  mimeType: signatureMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(maxSignatureFileSizeBytes)
});
