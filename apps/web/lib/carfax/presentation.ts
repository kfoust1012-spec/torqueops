import { formatDateTime } from "@mobile-mechanic/core";
import type {
  CarfaxHistoryFlag,
  CarfaxMaintenanceHighlight,
  CarfaxReportSummary,
  VehicleCarfaxSummary
} from "@mobile-mechanic/types";

const carfaxDateOnlyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric"
});

export function hasReadyCarfaxSummary(
  summary: VehicleCarfaxSummary | null
): summary is VehicleCarfaxSummary & { status: "ready"; summary: CarfaxReportSummary } {
  return Boolean(summary && summary.status === "ready" && summary.summary);
}

export function getTopCarfaxHistoryFlags(
  summary: CarfaxReportSummary,
  limit = 3
): CarfaxHistoryFlag[] {
  return summary.historyFlags.slice(0, limit);
}

export function getTopCarfaxMaintenanceHighlights(
  summary: CarfaxReportSummary,
  limit = 3
): CarfaxMaintenanceHighlight[] {
  return summary.maintenanceHighlights.slice(0, limit);
}

export function getCarfaxStatusLabel(summary: VehicleCarfaxSummary | null): string {
  if (!summary) {
    return "Not pulled";
  }

  return summary.status.replaceAll("_", " ");
}

export function formatCarfaxDate(value: string | null): string {
  if (!value) {
    return "Not reported";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearPart, monthPart, dayPart] = value.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);
    return carfaxDateOnlyFormatter.format(new Date(Date.UTC(year, month - 1, day)));
  }

  return formatDateTime(value, { includeTimeZoneName: false, fallback: "Not reported" });
}
