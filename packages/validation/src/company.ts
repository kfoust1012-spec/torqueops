import { z } from "zod";

import { appRoleSchema } from "./auth";
import { uuidSchema } from "./common";

export const companySlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only.");

export const createCompanyInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: companySlugSchema
});

export const companyMembershipSchema = z.object({
  id: uuidSchema,
  companyId: uuidSchema,
  userId: uuidSchema,
  role: appRoleSchema,
  isActive: z.boolean()
});
