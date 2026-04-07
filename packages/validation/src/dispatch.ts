import {
  dispatchCalendarConflictTypes,
  dispatchCalendarScopes,
  dispatchCalendarViews,
  dispatchBoardViews,
  technicianAvailabilityBlockTypes
} from "@mobile-mechanic/types";
import { z } from "zod";

import { jobPrioritySchema, jobStatusSchema } from "./job";
import { jobDateTimeSchema } from "./job";
import { optionalNullableStringSchema, uuidSchema } from "./common";

const localDateTimeSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const offsetDateTimeSchema = z.string().datetime({ offset: true });
const requiredDateTimeSchema = z.union([offsetDateTimeSchema, localDateTimeSchema]);
const dispatchNameSchema = z.string().trim().min(1).max(80);
const dispatchColorSchemaBase = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export const dispatchBoardViewSchema = z.enum(dispatchBoardViews);
export const dispatchCalendarViewSchema = z.enum(dispatchCalendarViews);
export const dispatchCalendarScopeSchema = z.enum(dispatchCalendarScopes);
export const dispatchConflictTypeSchema = z.enum(dispatchCalendarConflictTypes);
export const dispatchBoardDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
export const companyTimezoneSchema = z.string().trim().min(1).max(80);
export const technicianAvailabilityBlockTypeSchema = z.enum(technicianAvailabilityBlockTypes);
export const technicianAvailabilityBlockTitleSchema = z.string().trim().min(1).max(120);
export const dispatchSlotMinutesSchema = z.union([z.literal(15), z.literal(30), z.literal(60)]);
export const dispatchWeekStartSchema = z.number().int().min(0).max(6);
export const dispatchColorSchema = dispatchColorSchemaBase.nullable();

export const dispatchBoardQuerySchema = z.object({
  view: dispatchBoardViewSchema.optional(),
  date: dispatchBoardDateSchema,
  technicianUserId: uuidSchema.optional(),
  includeUnscheduled: z.boolean().optional()
});

export const dispatchCalendarQuerySchema = z.object({
  date: dispatchBoardDateSchema,
  view: dispatchCalendarViewSchema.optional(),
  scope: dispatchCalendarScopeSchema.optional(),
  savedViewId: uuidSchema.optional(),
  resourceUserIds: z.array(uuidSchema).optional(),
  includeUnassigned: z.boolean().optional()
});

export const quickAssignDispatchJobInputSchema = z.object({
  assignedTechnicianUserId: uuidSchema.nullable().optional()
});

export const quickRescheduleDispatchJobInputSchema = z
  .object({
    scheduledStartAt: requiredDateTimeSchema,
    scheduledEndAt: jobDateTimeSchema,
    arrivalWindowStartAt: jobDateTimeSchema,
    arrivalWindowEndAt: jobDateTimeSchema
  })
  .superRefine((value, ctx) => {
    if (
      value.scheduledEndAt &&
      new Date(value.scheduledEndAt).getTime() < new Date(value.scheduledStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled end must be after scheduled start.",
        path: ["scheduledEndAt"]
      });
    }

    if (value.arrivalWindowEndAt && !value.arrivalWindowStartAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window start is required when arrival window end is provided.",
        path: ["arrivalWindowStartAt"]
      });
    }

    if (
      value.arrivalWindowStartAt &&
      value.arrivalWindowEndAt &&
      new Date(value.arrivalWindowEndAt).getTime() <
        new Date(value.arrivalWindowStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window end must be after arrival window start.",
        path: ["arrivalWindowEndAt"]
      });
    }
  });

export const createTechnicianAvailabilityBlockInputSchema = z
  .object({
    companyId: uuidSchema,
    technicianUserId: uuidSchema,
    blockType: technicianAvailabilityBlockTypeSchema,
    title: technicianAvailabilityBlockTitleSchema,
    startsAt: requiredDateTimeSchema,
    endsAt: requiredDateTimeSchema,
    isAllDay: z.boolean().optional(),
    notes: optionalNullableStringSchema,
    createdByUserId: uuidSchema
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Availability block end must be after start.",
        path: ["endsAt"]
      });
    }
  });

export const updateTechnicianAvailabilityBlockInputSchema = z
  .object({
    blockType: technicianAvailabilityBlockTypeSchema,
    title: technicianAvailabilityBlockTitleSchema,
    startsAt: requiredDateTimeSchema,
    endsAt: requiredDateTimeSchema,
    isAllDay: z.boolean().optional(),
    notes: optionalNullableStringSchema
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Availability block end must be after start.",
        path: ["endsAt"]
      });
    }
  });

export const moveDispatchJobInputSchema = quickRescheduleDispatchJobInputSchema.extend({
  jobId: uuidSchema,
  assignedTechnicianUserId: uuidSchema.nullable().optional()
});

export const resizeDispatchJobInputSchema = z
  .object({
    jobId: uuidSchema,
    scheduledEndAt: requiredDateTimeSchema,
    arrivalWindowStartAt: jobDateTimeSchema,
    arrivalWindowEndAt: jobDateTimeSchema
  })
  .superRefine((value, ctx) => {
    if (value.arrivalWindowEndAt && !value.arrivalWindowStartAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window start is required when arrival window end is provided.",
        path: ["arrivalWindowStartAt"]
      });
    }

    if (
      value.arrivalWindowStartAt &&
      value.arrivalWindowEndAt &&
      new Date(value.arrivalWindowEndAt).getTime() <
        new Date(value.arrivalWindowStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window end must be after arrival window start.",
        path: ["arrivalWindowEndAt"]
      });
    }
  });

export const quickEditDispatchJobInputSchema = z
  .object({
    jobId: uuidSchema,
    assignedTechnicianUserId: uuidSchema.nullable().optional(),
    scheduledStartAt: jobDateTimeSchema,
    scheduledEndAt: jobDateTimeSchema,
    arrivalWindowStartAt: jobDateTimeSchema,
    arrivalWindowEndAt: jobDateTimeSchema,
    status: jobStatusSchema.optional(),
    priority: jobPrioritySchema.optional()
  })
  .superRefine((value, ctx) => {
    if (
      value.scheduledStartAt &&
      value.scheduledEndAt &&
      new Date(value.scheduledEndAt).getTime() < new Date(value.scheduledStartAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled end must be after scheduled start.",
        path: ["scheduledEndAt"]
      });
    }

    if (value.arrivalWindowEndAt && !value.arrivalWindowStartAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival window start is required when arrival window end is provided.",
        path: ["arrivalWindowStartAt"]
      });
    }
  });

export const createDispatchSavedViewInputSchema = z.object({
  companyId: uuidSchema,
  createdByUserId: uuidSchema,
  name: dispatchNameSchema,
  scope: dispatchCalendarScopeSchema,
  includeUnassigned: z.boolean().optional(),
  view: dispatchCalendarViewSchema,
  isDefault: z.boolean().optional()
});

export const updateDispatchSavedViewInputSchema = z.object({
  name: dispatchNameSchema,
  scope: dispatchCalendarScopeSchema,
  includeUnassigned: z.boolean().optional(),
  view: dispatchCalendarViewSchema,
  isDefault: z.boolean().optional()
});

export const replaceDispatchSavedViewMembersInputSchema = z.object({
  companyId: uuidSchema,
  savedViewId: uuidSchema,
  technicianUserIds: z.array(uuidSchema)
});

export const updateDispatchCalendarSettingsInputSchema = z
  .object({
    companyId: uuidSchema,
    weekStartsOn: dispatchWeekStartSchema,
    dayStartHour: z.number().int().min(0).max(23),
    dayEndHour: z.number().int().min(1).max(24),
    slotMinutes: dispatchSlotMinutesSchema,
    showSaturday: z.boolean().optional(),
    showSunday: z.boolean().optional(),
    defaultView: dispatchCalendarViewSchema,
    updatedByUserId: uuidSchema
  })
  .superRefine((value, ctx) => {
    if (value.dayEndHour <= value.dayStartHour) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day end hour must be after the day start hour.",
        path: ["dayEndHour"]
      });
    }
  });

export const upsertDispatchResourcePreferenceInputSchema = z.object({
  companyId: uuidSchema,
  technicianUserId: uuidSchema,
  laneOrder: z.number().int().min(0).optional(),
  laneColor: dispatchColorSchema.optional(),
  isVisibleByDefault: z.boolean().optional()
});
