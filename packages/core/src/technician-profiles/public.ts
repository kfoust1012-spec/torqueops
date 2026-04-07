import type { PublicTechnicianProfile, TechnicianProfile } from "@mobile-mechanic/types";

export function hasPublicTechnicianProfile(
  profile:
    | Pick<
        TechnicianProfile,
        | "fullName"
        | "technicianBio"
        | "technicianCertifications"
        | "yearsExperience"
        | "meetYourMechanicEnabled"
        | "profilePhotoPath"
      >
    | null
    | undefined
): boolean {
  if (!profile?.meetYourMechanicEnabled || !profile.fullName) {
    return false;
  }

  return Boolean(
    profile.technicianBio ||
      profile.technicianCertifications.length ||
      profile.yearsExperience !== null ||
      profile.profilePhotoPath
  );
}

export function getPublicTechnicianProfileMissingFields(
  profile:
    | Pick<
        TechnicianProfile,
        | "fullName"
        | "technicianBio"
        | "technicianCertifications"
        | "yearsExperience"
        | "meetYourMechanicEnabled"
        | "profilePhotoPath"
      >
    | null
    | undefined
): string[] {
  if (!profile) {
    return ["assigned technician profile"];
  }

  const missing: string[] = [];

  if (!profile.meetYourMechanicEnabled) {
    missing.push("public profile sharing");
  }

  if (!profile.fullName) {
    missing.push("full name");
  }

  if (
    !profile.technicianBio &&
    !profile.technicianCertifications.length &&
    profile.yearsExperience === null &&
    !profile.profilePhotoPath
  ) {
    missing.push("at least one trust detail");
  }

  return missing;
}

export function toPublicTechnicianProfile(
  profile:
    | Pick<
        TechnicianProfile,
        | "id"
        | "fullName"
        | "technicianBio"
        | "technicianCertifications"
        | "yearsExperience"
      >
    | null,
  photoUrl: string | null
): PublicTechnicianProfile | null {
  if (!profile?.fullName) {
    return null;
  }

  return {
    userId: profile.id,
    fullName: profile.fullName,
    bio: profile.technicianBio,
    certifications: profile.technicianCertifications,
    yearsExperience: profile.yearsExperience,
    photoUrl
  };
}