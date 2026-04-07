import type {
  FindingSeverity,
  Inspection,
  InspectionItem,
  InspectionItemStatus
} from "@mobile-mechanic/types";

export function formatInspectionStatusLabel(status: Inspection["status"]) {
  return status.replace(/_/g, " ");
}

export function formatInspectionItemStatusLabel(status: InspectionItemStatus) {
  switch (status) {
    case "pass":
      return "Pass";
    case "attention":
      return "Attention";
    case "fail":
      return "Fail";
    case "not_checked":
      return "Not checked";
  }
}

export function getInspectionItemStatusColors(status: InspectionItemStatus) {
  switch (status) {
    case "pass":
      return {
        backgroundColor: "#dcfce7",
        textColor: "#166534"
      };
    case "attention":
      return {
        backgroundColor: "#fef3c7",
        textColor: "#92400e"
      };
    case "fail":
      return {
        backgroundColor: "#fee2e2",
        textColor: "#b91c1c"
      };
    case "not_checked":
      return {
        backgroundColor: "#e5e7eb",
        textColor: "#374151"
      };
  }
}

export function formatFindingSeverityLabel(severity: FindingSeverity | null) {
  if (!severity) {
    return "No severity";
  }

  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function getInspectionCompletionLabel(item: InspectionItem) {
  if (item.status === "not_checked") {
    return "Not checked";
  }

  if (item.status === "pass") {
    return "Passed";
  }

  return item.findingSeverity
    ? `${formatInspectionItemStatusLabel(item.status)} · ${formatFindingSeverityLabel(item.findingSeverity)}`
    : formatInspectionItemStatusLabel(item.status);
}
