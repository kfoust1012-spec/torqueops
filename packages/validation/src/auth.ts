import { appRoles } from "@mobile-mechanic/types";
import { z } from "zod";

export const appRoleSchema = z.enum(appRoles);

export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters.")
});
