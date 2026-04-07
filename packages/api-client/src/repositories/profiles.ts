import {
  normalizeTechnicianBio,
  normalizeTechnicianCertifications
} from "@mobile-mechanic/core";
import type {
  Database,
  TechnicianProfile,
  TechnicianProfilePhotoMimeType,
  UpdateTechnicianProfileInput
} from "@mobile-mechanic/types";
import { updateTechnicianProfileInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ProfileStorageUploadResult = {
  data: {
    fullPath?: string;
    path: string;
  } | null;
  error: Error | null;
};
type ProfileStorageDeleteResult = {
  data: Array<{
    name: string;
  }> | null;
  error: Error | null;
};
type ProfileSignedUrlResult = {
  data: {
    signedUrl: string;
  } | null;
  error: Error | null;
};

export function mapProfileRowToTechnicianProfile(row: ProfileRow): TechnicianProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    defaultCompanyId: row.default_company_id,
    technicianBio: row.technician_bio,
    technicianCertifications: row.technician_certifications,
    yearsExperience: row.years_experience,
    meetYourMechanicEnabled: row.meet_your_mechanic_enabled,
    profilePhotoBucket: row.profile_photo_bucket,
    profilePhotoPath: row.profile_photo_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getProfileById(client: AppSupabaseClient, userId: string) {
  return client.from("profiles").select("*").eq("id", userId).single<ProfileRow>();
}

export async function updateProfile(client: AppSupabaseClient, userId: string, patch: ProfileUpdate) {
  return client.from("profiles").update(patch).eq("id", userId).select("*").single<ProfileRow>();
}

export async function listProfilesByIds(
  client: AppSupabaseClient,
  userIds: string[]
): Promise<{ data: ProfileRow[] | null; error: unknown | null }> {
  if (!userIds.length) {
    return {
      data: [] as ProfileRow[],
      error: null
    };
  }

  const result = await client.from("profiles").select("*").in("id", userIds).returns<ProfileRow[]>();

  return {
    data: result.data ?? null,
    error: result.error
  };
}

export async function updateTechnicianProfile(
  client: AppSupabaseClient,
  userId: string,
  input: UpdateTechnicianProfileInput
) {
  const parsed = updateTechnicianProfileInputSchema.parse(input);
  const patch: ProfileUpdate = {};

  if (parsed.fullName !== undefined) {
    patch.full_name = parsed.fullName?.trim() ?? null;
  }

  if (parsed.phone !== undefined) {
    patch.phone = parsed.phone?.trim() ?? null;
  }

  if (parsed.technicianBio !== undefined) {
    patch.technician_bio = normalizeTechnicianBio(parsed.technicianBio);
  }

  if (parsed.technicianCertifications !== undefined) {
    patch.technician_certifications = normalizeTechnicianCertifications(
      parsed.technicianCertifications ?? []
    );
  }

  if (parsed.yearsExperience !== undefined) {
    patch.years_experience = parsed.yearsExperience;
  }

  if (parsed.meetYourMechanicEnabled !== undefined) {
    patch.meet_your_mechanic_enabled = parsed.meetYourMechanicEnabled;
  }

  return updateProfile(client, userId, patch);
}

export async function uploadTechnicianProfilePhotoFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string,
  file: Blob,
  mimeType: TechnicianProfilePhotoMimeType,
  options?: {
    upsert?: boolean | undefined;
  }
): Promise<ProfileStorageUploadResult> {
  const result = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: options?.upsert ?? false
  });

  return {
    data: result.data
      ? {
          fullPath: result.data.fullPath,
          path: result.data.path
        }
      : null,
    error: result.error
  };
}

export async function removeTechnicianProfilePhotoFile(
  client: AppSupabaseClient,
  bucket: string,
  path: string
): Promise<ProfileStorageDeleteResult> {
  const result = await client.storage.from(bucket).remove([path]);

  return {
    data: result.data ? result.data.map((entry) => ({ name: entry.name })) : null,
    error: result.error
  };
}

export async function createProfilePhotoSignedUrl(
  client: AppSupabaseClient,
  profile: Pick<TechnicianProfile, "profilePhotoBucket" | "profilePhotoPath">,
  expiresInSeconds = 3600
): Promise<ProfileSignedUrlResult> {
  if (!profile.profilePhotoBucket || !profile.profilePhotoPath) {
    return {
      data: null,
      error: null
    };
  }

  const result = await client.storage
    .from(profile.profilePhotoBucket)
    .createSignedUrl(profile.profilePhotoPath, expiresInSeconds);

  return {
    data: result.data
      ? {
          signedUrl: result.data.signedUrl
        }
      : null,
    error: result.error
  };
}
