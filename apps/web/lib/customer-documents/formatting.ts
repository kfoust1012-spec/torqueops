import { formatDateRange, formatDateTime } from "@mobile-mechanic/core";

export function formatCustomerDocumentDateTime(value: string | null, timeZone: string, fallback = "Not set") {
  return formatDateTime(value, { fallback, timeZone });
}

export function formatCustomerDocumentDateRange(
  startAt: string | null,
  endAt: string | null,
  timeZone: string,
  fallback = "Not set"
) {
  return formatDateRange(startAt, endAt, { fallback, timeZone });
}
