import { formatDateTime, isVideoAttachmentMimeType } from "@mobile-mechanic/core";
import type { Attachment, AttachmentCategory } from "@mobile-mechanic/types";

export type AttachmentGalleryItem = Attachment & {
  pendingUpload?: boolean | undefined;
  signedUrl: string | null;
};

export function formatAttachmentCategoryLabel(category: AttachmentCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatAttachmentTimestamp(value: string): string {
  return formatDateTime(value, { includeTimeZoneName: false });
}

export function isVideoAttachment(item: Pick<Attachment, "mimeType">): boolean {
  return isVideoAttachmentMimeType(item.mimeType);
}

export function formatAttachmentKindLabel(item: Pick<Attachment, "mimeType">): string {
  return isVideoAttachment(item) ? "Video" : "Photo";
}
