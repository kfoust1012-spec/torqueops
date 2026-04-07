import type {
  CreateInspectionInput,
  DefaultInspectionTemplate,
  UpdateInspectionItemInput
} from "@mobile-mechanic/types";

import { DEFAULT_INSPECTION_TEMPLATE } from "./default-template";

const inspectionTemplatesByVersion = new Map<string, DefaultInspectionTemplate>([
  [DEFAULT_INSPECTION_TEMPLATE.version, DEFAULT_INSPECTION_TEMPLATE]
]);

function assertTemplateIntegrity(template: DefaultInspectionTemplate) {
  const sectionKeys = new Set<string>();
  const itemKeys = new Set<string>();

  for (const section of template.sections) {
    if (sectionKeys.has(section.key)) {
      throw new Error(`Duplicate inspection section key: ${section.key}`);
    }

    sectionKeys.add(section.key);

    for (const item of section.items) {
      if (itemKeys.has(item.key)) {
        throw new Error(`Duplicate inspection item key: ${item.key}`);
      }

      itemKeys.add(item.key);
    }
  }
}

export function buildInspectionTemplateItemPayloads(
  companyId: string,
  jobId: string,
  template: DefaultInspectionTemplate = DEFAULT_INSPECTION_TEMPLATE
) {
  assertTemplateIntegrity(template);

  return template.sections.flatMap((section) =>
    section.items.map((item) => ({
      company_id: companyId,
      job_id: jobId,
      section_key: section.key,
      item_key: item.key,
      label: item.label,
      position: item.position,
      status: "not_checked" as const,
      finding_severity: null,
      technician_notes: null,
      recommendation: null,
      is_required: item.isRequired
    }))
  );
}

export function expandInspectionTemplateItems(
  inspectionId: string,
  companyId: string,
  jobId: string,
  template: DefaultInspectionTemplate = DEFAULT_INSPECTION_TEMPLATE
) {
  return buildInspectionTemplateItemPayloads(companyId, jobId, template).map((item) => ({
    inspection_id: inspectionId,
    ...item
  }));
}

export function normalizeInspectionItemInput(input: UpdateInspectionItemInput): UpdateInspectionItemInput {
  return {
    ...input,
    technicianNotes: input.technicianNotes?.trim() || null,
    recommendation: input.recommendation?.trim() || null
  };
}

export function resolveInspectionTemplateVersion(
  templateVersion: CreateInspectionInput["templateVersion"]
): DefaultInspectionTemplate {
  const template = inspectionTemplatesByVersion.get(templateVersion);

  if (!template) {
    throw new Error(`Unsupported inspection template version: ${templateVersion}`);
  }

  assertTemplateIntegrity(template);
  return template;
}

export function getInspectionTemplateByVersion(templateVersion: string): DefaultInspectionTemplate {
  return resolveInspectionTemplateVersion(templateVersion);
}
