import {
  createProfilePhotoSignedUrl,
  listProfilesByIds,
  mapProfileRowToTechnicianProfile,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import {
  getPublicTechnicianProfileMissingFields,
  hasPublicTechnicianProfile,
  toPublicTechnicianProfile
} from "@mobile-mechanic/core";
import type { PublicTechnicianProfile } from "@mobile-mechanic/types";

import { toServerError } from "../server-error";

export type TechnicianProfilePreview = {
  isReady: boolean;
  missingFields: string[];
  profile: PublicTechnicianProfile | null;
  technicianName: string | null;
};

export async function getTechnicianProfilePreview(
  client: AppSupabaseClient,
  userId: string | null
): Promise<TechnicianProfilePreview> {
  if (!userId) {
    return {
      isReady: false,
      missingFields: ["assigned technician"],
      profile: null,
      technicianName: null
    };
  }

  const profileResult = await listProfilesByIds(client, [userId]);

  if (profileResult.error) {
    throw toServerError(
      profileResult.error,
      "Assigned technician profile could not be loaded."
    );
  }

  const profileRow = profileResult.data?.[0];

  if (!profileRow) {
    return {
      isReady: false,
      missingFields: ["assigned technician profile"],
      profile: null,
      technicianName: userId
    };
  }

  const profile = mapProfileRowToTechnicianProfile(profileRow);
  const technicianName = profile.fullName ?? profile.email ?? userId;
  const isReady = hasPublicTechnicianProfile(profile);

  if (!isReady) {
    return {
      isReady,
      missingFields: getPublicTechnicianProfileMissingFields(profile),
      profile: null,
      technicianName
    };
  }

  const signedUrlResult = await createProfilePhotoSignedUrl(client, profile);

  if (signedUrlResult.error) {
    throw toServerError(
      signedUrlResult.error,
      "Technician photo preview could not be prepared."
    );
  }

  return {
    isReady,
    missingFields: [],
    profile: toPublicTechnicianProfile(profile, signedUrlResult.data?.signedUrl ?? null),
    technicianName
  };
}
