import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createProfilePhotoSignedUrlMock,
  hasPublicTechnicianProfileMock,
  listProfilesByIdsMock,
  mapProfileRowToTechnicianProfileMock
} = vi.hoisted(() => ({
  createProfilePhotoSignedUrlMock: vi.fn(),
  hasPublicTechnicianProfileMock: vi.fn(),
  listProfilesByIdsMock: vi.fn(),
  mapProfileRowToTechnicianProfileMock: vi.fn()
}));

vi.mock("@mobile-mechanic/api-client", () => ({
  createProfilePhotoSignedUrl: createProfilePhotoSignedUrlMock,
  listProfilesByIds: listProfilesByIdsMock,
  mapProfileRowToTechnicianProfile: mapProfileRowToTechnicianProfileMock
}));

vi.mock("@mobile-mechanic/core", () => ({
  getPublicTechnicianProfileMissingFields: vi.fn(() => ["bio"]),
  hasPublicTechnicianProfile: hasPublicTechnicianProfileMock,
  toPublicTechnicianProfile: vi.fn((profile, photoUrl) => ({
    ...profile,
    photoUrl
  }))
}));

import { getTechnicianProfilePreview } from "./service";

describe("getTechnicianProfilePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProfilePhotoSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://example.com/photo.jpg" },
      error: null
    });
    hasPublicTechnicianProfileMock.mockReturnValue(false);
    mapProfileRowToTechnicianProfileMock.mockImplementation((row) => row);
  });

  it("degrades gracefully when the assigned technician profile row is missing", async () => {
    listProfilesByIdsMock.mockResolvedValue({
      data: [],
      error: null
    });

    await expect(getTechnicianProfilePreview({} as never, "user-123")).resolves.toEqual({
      isReady: false,
      missingFields: ["assigned technician profile"],
      profile: null,
      technicianName: "user-123"
    });

    expect(listProfilesByIdsMock).toHaveBeenCalledWith({}, ["user-123"]);
    expect(createProfilePhotoSignedUrlMock).not.toHaveBeenCalled();
  });
});
