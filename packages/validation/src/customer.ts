import { customerAddressLabels, customerRelationshipTypes } from "@mobile-mechanic/types";
import { z } from "zod";

import { optionalNullableStringSchema, uuidSchema } from "./common";

export const customerNameSchema = z.string().trim().min(1).max(100);
export const customerPhoneSchema = z.string().trim().min(7).max(30).nullable().optional();
export const customerEmailSchema = z.string().trim().email().nullable().optional();
export const addressLabelSchema = z.enum(customerAddressLabels);
export const customerRelationshipTypeSchema = z.enum(customerRelationshipTypes);
export const usStateSchema = z.string().trim().length(2).transform((value) => value.toUpperCase());
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}(?:-\d{4})?$/, "Postal code must be a valid US ZIP or ZIP+4.");

export const createCustomerInputSchema = z.object({
  companyId: uuidSchema,
  relationshipType: customerRelationshipTypeSchema.optional(),
  companyName: optionalNullableStringSchema,
  firstName: customerNameSchema,
  lastName: customerNameSchema,
  email: customerEmailSchema,
  phone: customerPhoneSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
}).superRefine((value, ctx) => {
  if (value.relationshipType === "fleet_account" && !value.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fleet accounts need an account or fleet name.",
      path: ["companyName"]
    });
  }
});

export const updateCustomerInputSchema = z.object({
  relationshipType: customerRelationshipTypeSchema.optional(),
  companyName: optionalNullableStringSchema,
  firstName: customerNameSchema,
  lastName: customerNameSchema,
  email: customerEmailSchema,
  phone: customerPhoneSchema,
  notes: optionalNullableStringSchema,
  isActive: z.boolean().optional()
}).superRefine((value, ctx) => {
  if (value.relationshipType === "fleet_account" && !value.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fleet accounts need an account or fleet name.",
      path: ["companyName"]
    });
  }
});

export const createCustomerAddressInputSchema = z.object({
  customerId: uuidSchema,
  companyId: uuidSchema,
  label: addressLabelSchema.optional(),
  siteName: optionalNullableStringSchema,
  serviceContactName: optionalNullableStringSchema,
  serviceContactPhone: customerPhoneSchema,
  accessWindowNotes: optionalNullableStringSchema,
  line1: z.string().trim().min(1).max(120),
  line2: optionalNullableStringSchema,
  city: z.string().trim().min(1).max(120),
  state: usStateSchema,
  postalCode: postalCodeSchema,
  country: z.string().trim().min(2).max(2).default("US").transform((value) => value.toUpperCase()),
  gateCode: optionalNullableStringSchema,
  parkingNotes: optionalNullableStringSchema,
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export const updateCustomerAddressInputSchema = z.object({
  label: addressLabelSchema.optional(),
  siteName: optionalNullableStringSchema,
  serviceContactName: optionalNullableStringSchema,
  serviceContactPhone: customerPhoneSchema,
  accessWindowNotes: optionalNullableStringSchema,
  line1: z.string().trim().min(1).max(120),
  line2: optionalNullableStringSchema,
  city: z.string().trim().min(1).max(120),
  state: usStateSchema,
  postalCode: postalCodeSchema,
  country: z.string().trim().min(2).max(2).default("US").transform((value) => value.toUpperCase()),
  gateCode: optionalNullableStringSchema,
  parkingNotes: optionalNullableStringSchema,
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export const customerSearchSchema = z.string().trim().min(1).max(120);

export const customerListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  includeInactive: z.boolean().optional()
});
