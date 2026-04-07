import type {
  DefaultInspectionTemplate,
  InspectionItem,
  InspectionSection
} from "@mobile-mechanic/types";

import { DEFAULT_INSPECTION_TEMPLATE } from "./default-template";

function formatFallbackSectionTitle(sectionKey: string) {
  return sectionKey
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function groupInspectionItemsBySection(
  items: InspectionItem[],
  template: DefaultInspectionTemplate = DEFAULT_INSPECTION_TEMPLATE
): InspectionSection[] {
  const itemsBySection = new Map<string, InspectionItem[]>();

  for (const item of items) {
    const currentItems = itemsBySection.get(item.sectionKey) ?? [];
    currentItems.push(item);
    itemsBySection.set(item.sectionKey, currentItems);
  }

  const knownSections = template.sections.map((section) => ({
    sectionKey: section.key,
    title: section.title,
    position: section.position,
    items: (itemsBySection.get(section.key) ?? []).sort(
      (left, right) => left.position - right.position
    )
  }));

  const unknownSections = [...itemsBySection.entries()]
    .filter(([sectionKey]) => !template.sections.some((section) => section.key === sectionKey))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([sectionKey, sectionItems], index) => ({
      sectionKey,
      title: formatFallbackSectionTitle(sectionKey),
      position: template.sections.length + index,
      items: sectionItems.sort((left, right) => left.position - right.position)
    }));

  return [...knownSections, ...unknownSections].filter((section) => section.items.length > 0);
}
