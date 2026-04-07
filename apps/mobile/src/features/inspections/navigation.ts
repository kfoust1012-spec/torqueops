import type { InspectionDetail, InspectionItem, InspectionSection } from "@mobile-mechanic/types";

export function getInspectionSectionCounts(section: InspectionSection) {
  return {
    attentionCount: section.items.filter((item) => item.status === "attention").length,
    checkedCount: section.items.filter((item) => item.status !== "not_checked").length,
    failCount: section.items.filter((item) => item.status === "fail").length,
    requiredRemainingCount: section.items.filter(
      (item) => item.isRequired && item.status === "not_checked"
    ).length
  };
}

export function getNextInspectionSection(sections: InspectionSection[]) {
  return (
    sections.find((section) => getInspectionSectionCounts(section).requiredRemainingCount > 0) ??
    sections.find(
      (section) => getInspectionSectionCounts(section).checkedCount < section.items.length
    ) ??
    sections.find((section) => {
      const counts = getInspectionSectionCounts(section);
      return counts.failCount > 0 || counts.attentionCount > 0;
    }) ??
    sections[0] ??
    null
  );
}

export function getNextInspectionItem(section: InspectionSection | null) {
  if (!section) {
    return null;
  }

  return (
    section.items.find((item) => item.isRequired && item.status === "not_checked") ??
    section.items.find((item) => item.status === "not_checked") ??
    section.items.find((item) => item.status === "fail" || item.status === "attention") ??
    section.items[0] ??
    null
  );
}

export function getInspectionSectionFocusLabel(section: InspectionSection | null) {
  const nextItem = getNextInspectionItem(section);

  if (!section || !nextItem) {
    return null;
  }

  return nextItem.status === "not_checked"
    ? `Next item: ${nextItem.label}`
    : `Review: ${nextItem.label}`;
}

export function getInspectionRunPath(jobId: string, detail: Pick<InspectionDetail, "inspection" | "sections">) {
  if (detail.inspection.status === "completed") {
    return `/jobs/${jobId}/inspection`;
  }

  const nextSection = getNextInspectionSection(detail.sections);

  return nextSection
    ? `/jobs/${jobId}/inspection/${nextSection.sectionKey}`
    : `/jobs/${jobId}/inspection`;
}
