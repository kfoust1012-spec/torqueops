import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const optionalNullableStringSchema = z.string().trim().min(1).nullable().optional();

export function emptyStringToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
