import type { TimestampFields, UUID } from "./common";

export const attachmentCategories = [
  "general",
  "before",
  "after",
  "issue",
  "inspection"
] as const;

export type AttachmentCategory = (typeof attachmentCategories)[number];

export const attachmentMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm"
] as const;

export type AttachmentMimeType = (typeof attachmentMimeTypes)[number];

export const maxAttachmentFileSizeBytes = 50 * 1024 * 1024;

export interface Attachment extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  inspectionId: UUID | null;
  inspectionItemId: UUID | null;
  uploadedByUserId: UUID;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: AttachmentMimeType;
  fileSizeBytes: number;
  category: AttachmentCategory;
  caption: string | null;
}

export type AttachmentListItem = Attachment;

export interface JobAttachmentGallery {
  jobId: UUID;
  attachments: Attachment[];
}

export interface CreateAttachmentInput {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  inspectionId?: UUID | null;
  inspectionItemId?: UUID | null;
  uploadedByUserId: UUID;
  fileName: string;
  mimeType: AttachmentMimeType;
  fileSizeBytes: number;
  category: AttachmentCategory;
  caption?: string | null;
}

export interface UpdateAttachmentInput {
  category?: AttachmentCategory;
  caption?: string | null;
}

export interface AttachmentListQuery {
  inspectionId?: UUID;
  inspectionItemId?: UUID;
  category?: AttachmentCategory;
}
