import {
  createProfilePhotoSignedUrl,
  mapProfileRowToTechnicianProfile,
  removeTechnicianProfilePhotoFile,
  updateProfile,
  updateTechnicianProfile,
  uploadTechnicianProfilePhotoFile
} from "@mobile-mechanic/api-client";
import {
  buildTechnicianProfilePhotoStoragePath,
  TECHNICIAN_PROFILE_PHOTOS_BUCKET
} from "@mobile-mechanic/core";
import type {
  Database,
  TechnicianProfilePhotoMimeType,
  UpdateTechnicianProfileInput
} from "@mobile-mechanic/types";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../lib/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type PickedProfilePhotoAsset = {
  fileName: string;
  fileSizeBytes: number;
  mimeType: TechnicianProfilePhotoMimeType;
  uri: string;
};

function inferMimeType(
  uri: string,
  fallback: string | null | undefined
): TechnicianProfilePhotoMimeType | null {
  if (fallback === "image/jpeg" || fallback === "image/png" || fallback === "image/webp") {
    return fallback;
  }

  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedUri.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedUri.endsWith(".heic") || normalizedUri.endsWith(".heif")) {
    return null;
  }

  return "image/jpeg";
}

function normalizePickedAsset(asset: ImagePicker.ImagePickerAsset): PickedProfilePhotoAsset {
  const mimeType = inferMimeType(asset.uri, asset.mimeType);

  if (!mimeType) {
    throw new Error("This image format is not supported yet. Use JPEG, PNG, or WEBP.");
  }

  const extension = mimeType.split("/")[1] ?? "jpg";

  return {
    fileName: asset.fileName?.trim() || `technician-profile-${Date.now()}.${extension}`,
    fileSizeBytes: asset.fileSize ?? 1,
    mimeType,
    uri: asset.uri
  };
}

async function pickProfileImage(source: "camera" | "library"): Promise<PickedProfilePhotoAsset | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Camera permission is required to take a profile photo.");
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Media library permission is required to select a profile photo.");
    }
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8
        });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset) {
    return null;
  }

  return normalizePickedAsset(asset);
}

export async function pickCameraProfilePhoto() {
  return pickProfileImage("camera");
}

export async function pickLibraryProfilePhoto() {
  return pickProfileImage("library");
}

export async function loadTechnicianProfilePhotoUrl(profile: ProfileRow | null) {
  if (!profile?.profile_photo_bucket || !profile.profile_photo_path) {
    return null;
  }

  const signedUrlResult = await createProfilePhotoSignedUrl(
    supabase,
    mapProfileRowToTechnicianProfile(profile)
  );

  if (signedUrlResult.error) {
    throw signedUrlResult.error;
  }

  return signedUrlResult.data?.signedUrl ?? null;
}

export async function saveTechnicianPublicProfile(
  userId: string,
  input: UpdateTechnicianProfileInput
) {
  const result = await updateTechnicianProfile(supabase, userId, input);

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function uploadTechnicianProfilePhoto(
  userId: string,
  profile: ProfileRow,
  asset: PickedProfilePhotoAsset
) {
  const response = await fetch(asset.uri);
  const file = await response.blob();
  const nextPath = buildTechnicianProfilePhotoStoragePath({
    userId
  });
  const previousBucket = profile.profile_photo_bucket;
  const previousPath = profile.profile_photo_path;

  const uploadResult = await uploadTechnicianProfilePhotoFile(
    supabase,
    TECHNICIAN_PROFILE_PHOTOS_BUCKET,
    nextPath,
    file,
    asset.mimeType,
    {
      upsert: true
    }
  );

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const profileResult = await updateProfile(supabase, userId, {
    profile_photo_bucket: TECHNICIAN_PROFILE_PHOTOS_BUCKET,
    profile_photo_path: nextPath
  });

  if (profileResult.error || !profileResult.data) {
    await removeTechnicianProfilePhotoFile(supabase, TECHNICIAN_PROFILE_PHOTOS_BUCKET, nextPath);
    throw profileResult.error ?? new Error("Profile photo could not be saved.");
  }

  if (previousBucket && previousPath && (previousBucket !== TECHNICIAN_PROFILE_PHOTOS_BUCKET || previousPath !== nextPath)) {
    await removeTechnicianProfilePhotoFile(supabase, previousBucket, previousPath);
  }

  return profileResult.data;
}

export async function removeTechnicianProfilePhoto(userId: string, profile: ProfileRow) {
  const previousBucket = profile.profile_photo_bucket;
  const previousPath = profile.profile_photo_path;

  const clearedProfileResult = await updateProfile(supabase, userId, {
    profile_photo_bucket: null,
    profile_photo_path: null
  });

  if (clearedProfileResult.error || !clearedProfileResult.data) {
    throw clearedProfileResult.error ?? new Error("Profile photo could not be removed.");
  }

  if (previousBucket && previousPath) {
    const deleteResult = await removeTechnicianProfilePhotoFile(supabase, previousBucket, previousPath);

    if (deleteResult.error) {
      const restoreResult = await updateProfile(supabase, userId, {
        profile_photo_bucket: previousBucket,
        profile_photo_path: previousPath
      });

      if (restoreResult.error || !restoreResult.data) {
        throw restoreResult.error ?? new Error("Profile photo removal could not be rolled back after storage deletion failed.");
      }

      throw deleteResult.error;
    }
  }

  return clearedProfileResult.data;
}