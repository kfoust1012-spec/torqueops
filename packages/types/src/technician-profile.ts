import type { UserProfile } from "./auth";
import type { UUID } from "./common";

export const technicianProfilePhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type TechnicianProfilePhotoMimeType = (typeof technicianProfilePhotoMimeTypes)[number];

export interface TechnicianProfile extends UserProfile {
  technicianBio: string | null;
  technicianCertifications: string[];
  yearsExperience: number | null;
  meetYourMechanicEnabled: boolean;
  profilePhotoBucket: string | null;
  profilePhotoPath: string | null;
}

export interface PublicTechnicianProfile {
  userId: UUID;
  fullName: string;
  bio: string | null;
  certifications: string[];
  yearsExperience: number | null;
  photoUrl: string | null;
}

export interface UpdateTechnicianProfileInput {
  fullName?: string | null | undefined;
  phone?: string | null | undefined;
  technicianBio?: string | null | undefined;
  technicianCertifications?: string[] | null | undefined;
  yearsExperience?: number | null | undefined;
  meetYourMechanicEnabled?: boolean | undefined;
}