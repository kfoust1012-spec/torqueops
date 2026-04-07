import { formatDateRange, formatDateTime } from "@mobile-mechanic/core";
import type { CustomerAddress, JobStatus, TechnicianJobListItem } from "@mobile-mechanic/types";

export function formatJobDateTime(value: string | null, timeZone?: string): string {
  return formatDateTime(value, {
    fallback: "Not scheduled",
    includeTimeZoneName: false,
    timeZone
  });
}

export function formatArrivalWindow(start: string | null, end: string | null, timeZone?: string): string | null {
  if (!start && !end) {
    return null;
  }

  return formatDateRange(start, end, {
    fallback: "Not scheduled",
    includeTimeZoneName: false,
    timeZone
  });
}

export function formatJobStatusLabel(status: JobStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatJobTitleWord(word: string): string {
  return word
    .split("-")
    .map((part, index, parts) => {
      if (!part) {
        return part;
      }

      if (/[0-9]/.test(part) || /^[A-Z]{2,5}$/.test(part)) {
        return part;
      }

      const lower = part.toLowerCase();
      const isConnector =
        index > 0 &&
        index < parts.length - 1 &&
        ["and", "at", "for", "in", "of", "on", "or", "the", "to"].includes(lower);

      if (isConnector) {
        return lower;
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("-");
}

export function formatJobTitleLabel(title: string): string {
  const normalized = title
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^e2e\b[:\-\s]*/i, "")
    .replace(/\s+\d{6,}$/g, "")
    .trim();

  if (!normalized) {
    return "Untitled job";
  }

  return normalized
    .split(" ")
    .map(formatJobTitleWord)
    .join(" ");
}

export function formatJobAssignmentSummary(input: {
  customerDisplayName: string;
  locationSummary: string | null | undefined;
  scheduledStartAt: string | null;
  timeZone: string | undefined;
  vehicleDisplayName: string;
}): string {
  return [
    `${input.customerDisplayName} · ${input.vehicleDisplayName}`,
    formatJobDateTime(input.scheduledStartAt, input.timeZone),
    input.locationSummary ?? "No service location"
  ].join("\n");
}

export function formatPriorityLabel(priority: TechnicianJobListItem["priority"]): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function formatAddressLabel(address: CustomerAddress | null): string {
  if (!address) {
    return "No service location";
  }

  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

export function formatPhoneLabel(phone: string | null): string {
  return phone ?? "No phone on file";
}
