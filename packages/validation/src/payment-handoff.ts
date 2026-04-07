import {
  technicianPaymentHandoffKinds,
  technicianPaymentResolutionDispositions,
  technicianPaymentTenderTypes
} from "@mobile-mechanic/types";
import { z } from "zod";

export const technicianPaymentHandoffKindSchema = z.enum(technicianPaymentHandoffKinds);
export const technicianPaymentResolutionDispositionSchema = z.enum(
  technicianPaymentResolutionDispositions
);
export const technicianPaymentTenderTypeSchema = z.enum(technicianPaymentTenderTypes);

export const createTechnicianPaymentHandoffInputSchema = z
  .object({
    kind: technicianPaymentHandoffKindSchema,
    tenderType: technicianPaymentTenderTypeSchema.nullable().optional(),
    amountCents: z.number().int().positive().nullable().optional(),
    customerPromiseAt: z.string().datetime({ offset: true }).nullable().optional(),
    note: z.string().trim().min(1).max(1000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.kind === "manual_tender") {
      if (!value.tenderType) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select the tender type for a manual payment handoff.",
          path: ["tenderType"]
        });
      }

      if (!value.amountCents || value.amountCents <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the collected amount for a manual payment handoff.",
          path: ["amountCents"]
        });
      }
    }

    if (value.kind === "other" && !value.note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a note describing the payment handoff.",
        path: ["note"]
      });
    }
  });

export const resolveTechnicianPaymentHandoffInputSchema = z
  .object({
    resolutionDisposition: technicianPaymentResolutionDispositionSchema,
    resolutionNote: z.string().trim().min(1).max(1000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.resolutionDisposition === "other_resolved" && !value.resolutionNote) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a note describing how the billing handoff was resolved.",
        path: ["resolutionNote"]
      });
    }
  });
