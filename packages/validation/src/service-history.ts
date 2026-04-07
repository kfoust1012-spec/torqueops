import {
  estimateStatuses,
  inspectionStatuses,
  invoiceStatuses,
  jobStatuses,
  paymentStatuses,
  serviceHistorySortFields
} from "@mobile-mechanic/types";
import { z } from "zod";

import { uuidSchema } from "./common";

const localDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const offsetDateTimeSchema = z.string().datetime({ offset: true });

export const serviceHistoryDateSchema = z.union([offsetDateTimeSchema, localDateSchema]);
export const serviceHistorySortFieldSchema = z.enum(serviceHistorySortFields);
export const serviceHistoryJobStatusSchema = z.enum(jobStatuses);
export const serviceHistoryInspectionStatusSchema = z.enum(inspectionStatuses);
export const serviceHistoryEstimateStatusSchema = z.enum(estimateStatuses);
export const serviceHistoryInvoiceStatusSchema = z.enum(invoiceStatuses);
export const serviceHistoryPaymentStatusSchema = z.enum(paymentStatuses);

const serviceHistoryQueryBaseSchema = z.object({
  dateFrom: serviceHistoryDateSchema.optional(),
  dateTo: serviceHistoryDateSchema.optional(),
  vehicleId: uuidSchema.optional(),
  jobStatuses: z.array(serviceHistoryJobStatusSchema).optional(),
  inspectionStatuses: z.array(serviceHistoryInspectionStatusSchema).optional(),
  estimateStatuses: z.array(serviceHistoryEstimateStatusSchema).optional(),
  invoiceStatuses: z.array(serviceHistoryInvoiceStatusSchema).optional(),
  paymentStatuses: z.array(serviceHistoryPaymentStatusSchema).optional(),
  sort: serviceHistorySortFieldSchema.optional()
});

export const serviceHistoryQuerySchema = z
  .object(serviceHistoryQueryBaseSchema.shape)
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date to must be after date from.",
        path: ["dateTo"]
      });
    }
  });

export const customerServiceHistoryQuerySchema = serviceHistoryQuerySchema;
export const vehicleServiceHistoryQuerySchema = z
  .object(serviceHistoryQueryBaseSchema.omit({ vehicleId: true }).shape)
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date to must be after date from.",
        path: ["dateTo"]
      });
    }
  });