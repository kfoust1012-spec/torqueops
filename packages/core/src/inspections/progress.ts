import type {
  InspectionItem,
  InspectionProgressSummary,
  InspectionSummary
} from "@mobile-mechanic/types";

export function getInspectionProgressSummary(items: InspectionItem[]): InspectionProgressSummary {
  return {
    completedCount: items.filter((item) => item.status !== "not_checked").length,
    failCount: items.filter((item) => item.status === "fail").length,
    requiredRemainingCount: items.filter(
      (item) => item.isRequired && item.status === "not_checked"
    ).length,
    totalCount: items.length
  };
}

export function canCompleteInspection(items: InspectionItem[]): boolean {
  return items.length > 0 && items.every((item) => !item.isRequired || item.status !== "not_checked");
}

export function getInspectionSummary(
  inspectionId: string,
  jobId: string,
  status: InspectionSummary["status"],
  completedAt: string | null,
  items: InspectionItem[]
): InspectionSummary {
  return {
    inspectionId,
    jobId,
    status,
    completedAt,
    criticalCount: items.filter((item) => item.findingSeverity === "critical").length,
    highCount: items.filter((item) => item.findingSeverity === "high").length,
    recommendationCount: items.filter((item) => Boolean(item.recommendation)).length
  };
}
