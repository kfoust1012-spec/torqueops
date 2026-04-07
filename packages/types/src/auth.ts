import type { TimestampFields, UUID } from "./common";

export const appRoles = ["owner", "admin", "dispatcher", "technician"] as const;

export type AppRole = (typeof appRoles)[number];

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserProfile extends TimestampFields {
  id: UUID;
  email: string;
  fullName: string | null;
  phone: string | null;
  defaultCompanyId: UUID | null;
  technicianBio: string | null;
  technicianCertifications: string[];
  yearsExperience: number | null;
  meetYourMechanicEnabled: boolean;
  profilePhotoBucket: string | null;
  profilePhotoPath: string | null;
}

export interface AuthUserSummary {
  id: UUID;
  email: string | null;
}
