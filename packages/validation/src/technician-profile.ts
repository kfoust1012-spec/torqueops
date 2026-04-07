import { technicianProfilePhotoMimeTypes } from "@mobile-mechanic/types";
import { z } from "zod";

export const technicianProfileNameSchema = z.string().trim().min(1).max(160);
export const technicianProfilePhoneSchema = z.string().trim().min(7).max(30).nullable();
export const technicianProfileBioSchema = z.string().trim().min(1).max(1200).nullable();
export const technicianProfileCertificationSchema = z.string().trim().min(1).max(80);
export const technicianProfileCertificationsSchema = z
  .array(technicianProfileCertificationSchema)
  .max(8)
  .superRefine((value, context) => {
    const seen = new Set<string>();

    for (const [index, item] of value.entries()) {
      const key = item.toLocaleLowerCase();

      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Certifications must be unique.",
          path: [index]
        });
      }

      seen.add(key);
    }
  });
export const technicianYearsExperienceSchema = z.number().int().min(0).max(60).nullable();
export const technicianProfilePhotoMimeTypeSchema = z.enum(technicianProfilePhotoMimeTypes);

export const updateTechnicianProfileInputSchema = z.object({
  fullName: technicianProfileNameSchema.nullable().optional(),
  phone: technicianProfilePhoneSchema.optional(),
  technicianBio: technicianProfileBioSchema.optional(),
  technicianCertifications: technicianProfileCertificationsSchema.nullable().optional(),
  yearsExperience: technicianYearsExperienceSchema.optional(),
  meetYourMechanicEnabled: z.boolean().optional()
});