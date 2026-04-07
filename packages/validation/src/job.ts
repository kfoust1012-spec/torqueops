import {
  jobPriorities,
  jobSources,
  jobStatuses,
  technicianAllowedStatuses
} from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";

const localDateTimeSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const offsetDateTimeSchema = z.string().datetime({ offset: true });

export const jobDateTimeSchema = z.union([offsetDateTimeSchema, localDateTimeSchema]).nullable().optional();

export const jobStatusSchema = z.enum(jobStatuses);
export const jobPrioritySchema = z.enum(jobPriorities);
export const jobSourceSchema = z.enum(jobSources);
export const technicianJobStatusSchema = z.enum(technicianAllowedStatuses);

export const jobTitleSchema = z.string().trim().min(3).max(160);
export const jobDescriptionSchema = z.string().trim().min(1).max(4000).nullable().optional();
export const jobConcernSchema = z.string().trim().min(1).max(4000).nullable().optional();
export const jobNoteBodySchema = z.string().trim().min(1).max(4000);

function withScheduleValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const schedule = value as {
      scheduledStartAt?: string | null;
      scheduledEndAt?: string | null;
      arrivalWindowStartAt?: string | null;
      arrivalWindowEndAt?: string | null;
    };

    if (schedule.scheduledEndAt && !schedule.scheduledStartAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled start is required when scheduled end is provided.",
        path: ["scheduledStartAt"]
      });
    }

    if (schedule.arrivalWindowEndAt && !schedule.arrivalWindowStartAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window start is required when arrival window end is provided.",
        path: ["arrivalWindowStartAt"]
      });
    }

    if (
      schedule.scheduledStartAt &&
      schedule.scheduledEndAt &&
      new Date(schedule.scheduledEndAt).getTime() < new Date(schedule.scheduledStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled end must be after scheduled start.",
        path: ["scheduledEndAt"]
      });
    }

    if (
      schedule.arrivalWindowStartAt &&
      schedule.arrivalWindowEndAt &&
      new Date(schedule.arrivalWindowEndAt).getTime() <
        new Date(schedule.arrivalWindowStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window end must be after arrival window start.",
        path: ["arrivalWindowEndAt"]
      });
    }
  });
}

export const createJobInputSchema = withScheduleValidation(
  z.object({
    companyId: uuidSchema,
    customerId: uuidSchema,
    vehicleId: uuidSchema,
    serviceSiteId: uuidSchema.nullable().optional(),
    title: jobTitleSchema,
    description: jobDescriptionSchema,
    customerConcern: jobConcernSchema,
    internalSummary: jobDescriptionSchema,
    scheduledStartAt: jobDateTimeSchema,
    scheduledEndAt: jobDateTimeSchema,
    arrivalWindowStartAt: jobDateTimeSchema,
    arrivalWindowEndAt: jobDateTimeSchema,
    assignedTechnicianUserId: uuidSchema.nullable().optional(),
    priority: jobPrioritySchema.optional(),
    source: jobSourceSchema.optional(),
    isActive: z.boolean().optional(),
    createdByUserId: uuidSchema
  })
);

export const updateJobInputSchema = withScheduleValidation(
  z.object({
    customerId: uuidSchema,
    vehicleId: uuidSchema,
    serviceSiteId: uuidSchema.nullable().optional(),
    title: jobTitleSchema,
    description: jobDescriptionSchema,
    customerConcern: jobConcernSchema,
    internalSummary: jobDescriptionSchema,
    scheduledStartAt: jobDateTimeSchema,
    scheduledEndAt: jobDateTimeSchema,
    arrivalWindowStartAt: jobDateTimeSchema,
    arrivalWindowEndAt: jobDateTimeSchema,
    assignedTechnicianUserId: uuidSchema.nullable().optional(),
    priority: jobPrioritySchema.optional(),
    source: jobSourceSchema.optional(),
    isActive: z.boolean().optional()
  })
);

export const createJobNoteInputSchema = z.object({
  jobId: uuidSchema,
  companyId: uuidSchema,
  authorUserId: uuidSchema,
  body: jobNoteBodySchema,
  isInternal: z.boolean().optional()
});

export const updateJobNoteInputSchema = z.object({
  body: jobNoteBodySchema,
  isInternal: z.boolean().optional()
});

export const changeJobStatusInputSchema = z.object({
  toStatus: jobStatusSchema,
  reason: optionalNullableStringSchema
});

export const assignJobTechnicianInputSchema = z.object({
  assignedTechnicianUserId: uuidSchema.nullable().optional()
});

export const changeAssignedJobStatusInputSchema = z.object({
  toStatus: technicianJobStatusSchema,
  reason: optionalNullableStringSchema
});

export const jobListQuerySchema = z
  .object({
    query: z.string().trim().max(160).optional(),
    status: jobStatusSchema.optional(),
    assignedTechnicianUserId: uuidSchema.optional(),
    dateFrom: z.union([offsetDateTimeSchema, localDateTimeSchema]).optional(),
    dateTo: z.union([offsetDateTimeSchema, localDateTimeSchema]).optional(),
    includeInactive: z.boolean().optional()
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date to must be after date from.",
        path: ["dateTo"]
      });
    }
  });

export const technicianJobListQuerySchema = z
  .object({
    status: jobStatusSchema.optional(),
    dateFrom: z.union([offsetDateTimeSchema, localDateTimeSchema]).optional(),
    dateTo: z.union([offsetDateTimeSchema, localDateTimeSchema]).optional()
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date to must be after date from.",
        path: ["dateTo"]
      });
    }
  });
