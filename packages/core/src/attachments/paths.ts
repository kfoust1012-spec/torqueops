type BuildJobAttachmentStoragePathInput = {
  attachmentId: string;
  companyId: string;
  fileName: string;
  jobId: string;
};

export const JOB_ATTACHMENTS_BUCKET = "job-attachments";

export function sanitizeAttachmentFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/^.*[\\/]/, "");
  const lastDotIndex = trimmed.lastIndexOf(".");
  const rawStem = lastDotIndex > 0 ? trimmed.slice(0, lastDotIndex) : trimmed;
  const rawExtension = lastDotIndex > 0 ? trimmed.slice(lastDotIndex).toLowerCase() : "";
  const stem = rawStem
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  const extension = rawExtension.replace(/[^.a-z0-9]+/g, "");

  return `${stem || "attachment"}${extension}`;
}

export function buildJobAttachmentStoragePath(input: BuildJobAttachmentStoragePathInput): string {
  return [
    "companies",
    input.companyId,
    "jobs",
    input.jobId,
    "attachments",
    input.attachmentId,
    sanitizeAttachmentFileName(input.fileName)
  ].join("/");
}
