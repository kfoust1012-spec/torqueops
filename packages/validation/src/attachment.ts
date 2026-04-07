import {
  attachmentCategories,
  attachmentMimeTypes,
  maxAttachmentFileSizeBytes
} from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";

export const attachmentCategorySchema = z.enum(attachmentCategories);
export const attachmentMimeTypeSchema = z.enum(attachmentMimeTypes);

export const createAttachmentInputSchema = z
  .object({
    id: uuidSchema,
    companyId: uuidSchema,
    jobId: uuidSchema,
    inspectionId: uuidSchema.nullable().optional(),
    inspectionItemId: uuidSchema.nullable().optional(),
    uploadedByUserId: uuidSchema,
    fileName: z.string().trim().min(1).max(255),
    mimeType: attachmentMimeTypeSchema,
    fileSizeBytes: z.number().int().positive().max(maxAttachmentFileSizeBytes),
    category: attachmentCategorySchema,
    caption: z.string().trim().max(500).nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.inspectionItemId && !value.inspectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inspection item attachments must also include the parent inspection id.",
        path: ["inspectionId"]
      });
    }

    if (
      value.category === "inspection" &&
      !value.inspectionId &&
      !value.inspectionItemId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inspection attachments must be linked to an inspection or inspection item.",
        path: ["inspectionId"]
      });
    }
  });

export const updateAttachmentInputSchema = z
  .object({
    category: attachmentCategorySchema.optional(),
    caption: z.string().trim().max(500).nullable().optional()
  })
  .refine((value) => value.category !== undefined || value.caption !== undefined, {
    message: "Provide a category or caption update."
  });

export const attachmentListQuerySchema = z.object({
  inspectionId: uuidSchema.optional(),
  inspectionItemId: uuidSchema.optional(),
  category: attachmentCategorySchema.optional()
});
