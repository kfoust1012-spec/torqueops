import { attachmentMimeTypes } from "@mobile-mechanic/types";

const supportedAttachmentMimeTypes = new Set<string>(attachmentMimeTypes);

export function isSupportedAttachmentMimeType(mimeType: string): boolean {
  return supportedAttachmentMimeTypes.has(mimeType);
}

export function isVideoAttachmentMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function isImageAttachmentMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
