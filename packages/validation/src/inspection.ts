import {
  findingSeverities,
  inspectionItemStatuses,
  inspectionStatuses
} from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";

export const inspectionStatusSchema = z.enum(inspectionStatuses);
export const inspectionItemStatusSchema = z.enum(inspectionItemStatuses);
export const findingSeveritySchema = z.enum(findingSeverities);

export const inspectionTemplateItemSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(160),
  position: z.number().int().min(0),
  isRequired: z.boolean()
});

export const inspectionTemplateSectionSchema = z.object({
  key: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  position: z.number().int().min(0),
  items: z.array(inspectionTemplateItemSchema).min(1)
});

export const defaultInspectionTemplateSchema = z.object({
  version: z.string().trim().min(1).max(32),
  sections: z.array(inspectionTemplateSectionSchema).min(1)
});

export const createInspectionInputSchema = z.object({
  companyId: uuidSchema,
  jobId: uuidSchema,
  startedByUserId: uuidSchema,
  templateVersion: z.string().trim().min(1).max(32)
});

export const updateInspectionStatusInputSchema = z.object({
  status: inspectionStatusSchema
});

export const updateInspectionItemInputSchema = z
  .object({
    status: inspectionItemStatusSchema,
    findingSeverity: findingSeveritySchema.nullable().optional(),
    technicianNotes: optionalNullableStringSchema,
    recommendation: optionalNullableStringSchema
  })
  .superRefine((value, ctx) => {
    if (["attention", "fail"].includes(value.status) && !value.findingSeverity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Severity is required for attention and fail findings.",
        path: ["findingSeverity"]
      });
    }

    if (["pass", "not_checked"].includes(value.status) && value.findingSeverity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Severity is only allowed for attention or fail findings.",
        path: ["findingSeverity"]
      });
    }

    const hasContext = Boolean(value.technicianNotes?.trim() || value.recommendation?.trim());

    if (value.status === "fail" && !hasContext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fail findings require technician notes or a recommendation.",
        path: ["technicianNotes"]
      });
    }
  });
