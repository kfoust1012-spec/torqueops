import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@mobile-mechanic/types";

import {
  removeTechnicianProfilePhoto,
  uploadTechnicianProfilePhoto
} from "./api";

const {
  updateProfileMock,
  uploadTechnicianProfilePhotoFileMock,
  removeTechnicianProfilePhotoFileMock
} = vi.hoisted(() => ({
  updateProfileMock: vi.fn(),
  uploadTechnicianProfilePhotoFileMock: vi.fn(),
  removeTechnicianProfilePhotoFileMock: vi.fn()
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { mocked: true }
}));

vi.mock("expo-image-picker", () => ({
  MediaTypeOptions: {
    Images: "Images"
  },
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn()
}));

vi.mock("@mobile-mechanic/core", () => ({
  TECHNICIAN_PROFILE_PHOTOS_BUCKET: "technician-profile-photos",
  buildTechnicianProfilePhotoStoragePath: ({ userId }: { userId: string }) => `${userId}/profile-photo`
}));

vi.mock("@mobile-mechanic/api-client", () => ({
  createProfilePhotoSignedUrl: vi.fn(),
  mapProfileRowToTechnicianProfile: vi.fn(),
  removeTechnicianProfilePhotoFile: removeTechnicianProfilePhotoFileMock,
  updateProfile: updateProfileMock,
  updateTechnicianProfile: vi.fn(),
  uploadTechnicianProfilePhotoFile: uploadTechnicianProfilePhotoFileMock
}));

function createProfile(
  overrides: Partial<Database["public"]["Tables"]["profiles"]["Row"]> = {}
): Database["public"]["Tables"]["profiles"]["Row"] {
  return {
    id: "user-1",
    email: "tech@example.com",
    full_name: "Alex Tech",
    phone: null,
    default_company_id: "company-1",
    technician_bio: null,
    technician_certifications: [],
    years_experience: null,
    meet_your_mechanic_enabled: false,
    profile_photo_bucket: null,
    profile_photo_path: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    ...overrides
  } as Database["public"]["Tables"]["profiles"]["Row"];
}

describe("technician profile photo api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => new Blob(["file-bytes"], { type: "image/jpeg" })
      }))
    );
  });

  it("reuses the deterministic storage path on replacement without deleting the current object", async () => {
    uploadTechnicianProfilePhotoFileMock.mockResolvedValue({
      data: { path: "user-1/profile-photo" },
      error: null
    });
    updateProfileMock.mockResolvedValue({
      data: createProfile({
        profile_photo_bucket: "technician-profile-photos",
        profile_photo_path: "user-1/profile-photo"
      }),
      error: null
    });

    await uploadTechnicianProfilePhoto(
      "user-1",
      createProfile({
        profile_photo_bucket: "technician-profile-photos",
        profile_photo_path: "user-1/profile-photo"
      }),
      {
        fileName: "headshot.jpg",
        fileSizeBytes: 123,
        mimeType: "image/jpeg",
        uri: "file:///tmp/headshot.jpg"
      }
    );

    expect(uploadTechnicianProfilePhotoFileMock).toHaveBeenCalledWith(
      expect.anything(),
      "technician-profile-photos",
      "user-1/profile-photo",
      expect.any(Blob),
      "image/jpeg",
      { upsert: true }
    );
    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(removeTechnicianProfilePhotoFileMock).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded file if the profile update fails after upload", async () => {
    uploadTechnicianProfilePhotoFileMock.mockResolvedValue({
      data: { path: "user-1/profile-photo" },
      error: null
    });
    updateProfileMock.mockResolvedValue({
      data: null,
      error: new Error("profile write failed")
    });
    removeTechnicianProfilePhotoFileMock.mockResolvedValue({
      data: [{ name: "profile-photo" }],
      error: null
    });

    await expect(
      uploadTechnicianProfilePhoto("user-1", createProfile(), {
        fileName: "headshot.jpg",
        fileSizeBytes: 123,
        mimeType: "image/jpeg",
        uri: "file:///tmp/headshot.jpg"
      })
    ).rejects.toThrow("profile write failed");

    expect(removeTechnicianProfilePhotoFileMock).toHaveBeenCalledWith(
      expect.anything(),
      "technician-profile-photos",
      "user-1/profile-photo"
    );
  });

  it("restores the profile reference if storage deletion fails during remove", async () => {
    updateProfileMock
      .mockResolvedValueOnce({
        data: createProfile({
          profile_photo_bucket: null,
          profile_photo_path: null
        }),
        error: null
      })
      .mockResolvedValueOnce({
        data: createProfile({
          profile_photo_bucket: "technician-profile-photos",
          profile_photo_path: "user-1/profile-photo"
        }),
        error: null
      });
    removeTechnicianProfilePhotoFileMock.mockResolvedValue({
      data: null,
      error: new Error("storage delete failed")
    });

    await expect(
      removeTechnicianProfilePhoto(
        "user-1",
        createProfile({
          profile_photo_bucket: "technician-profile-photos",
          profile_photo_path: "user-1/profile-photo"
        })
      )
    ).rejects.toThrow("storage delete failed");

    expect(updateProfileMock).toHaveBeenNthCalledWith(1, expect.anything(), "user-1", {
      profile_photo_bucket: null,
      profile_photo_path: null
    });
    expect(updateProfileMock).toHaveBeenNthCalledWith(2, expect.anything(), "user-1", {
      profile_photo_bucket: "technician-profile-photos",
      profile_photo_path: "user-1/profile-photo"
    });
  });
});