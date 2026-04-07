export function normalizeAttachmentCaption(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function isInspectionAttachment(
  category: string,
  inspectionId: string | null | undefined,
  inspectionItemId: string | null | undefined
): boolean {
  return category === "inspection" || Boolean(inspectionId || inspectionItemId);
}
