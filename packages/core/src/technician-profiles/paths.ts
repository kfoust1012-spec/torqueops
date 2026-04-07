type BuildTechnicianProfilePhotoStoragePathInput = {
  userId: string;
};

export const TECHNICIAN_PROFILE_PHOTOS_BUCKET = "technician-profile-photos";

export function buildTechnicianProfilePhotoStoragePath(
  input: BuildTechnicianProfilePhotoStoragePathInput
): string {
  return `${input.userId}/profile-photo`;
}