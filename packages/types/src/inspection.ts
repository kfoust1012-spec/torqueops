import type { Customer } from "./customer";
import type { TimestampFields, UUID } from "./common";
import type { Job } from "./job";
import type { Vehicle } from "./vehicle";

export const inspectionStatuses = ["draft", "in_progress", "completed"] as const;

export type InspectionStatus = (typeof inspectionStatuses)[number];

export const inspectionItemStatuses = ["pass", "attention", "fail", "not_checked"] as const;

export type InspectionItemStatus = (typeof inspectionItemStatuses)[number];

export const findingSeverities = ["low", "medium", "high", "critical"] as const;

export type FindingSeverity = (typeof findingSeverities)[number];

export interface Inspection extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  status: InspectionStatus;
  templateVersion: string;
  startedByUserId: UUID;
  completedByUserId: UUID | null;
  startedAt: string;
  completedAt: string | null;
}

export interface InspectionItem extends TimestampFields {
  id: UUID;
  inspectionId: UUID;
  companyId: UUID;
  jobId: UUID;
  sectionKey: string;
  itemKey: string;
  label: string;
  position: number;
  status: InspectionItemStatus;
  findingSeverity: FindingSeverity | null;
  technicianNotes: string | null;
  recommendation: string | null;
  isRequired: boolean;
}

export interface InspectionTemplateItem {
  key: string;
  label: string;
  position: number;
  isRequired: boolean;
}

export interface InspectionTemplateSection {
  key: string;
  title: string;
  position: number;
  items: InspectionTemplateItem[];
}

export interface DefaultInspectionTemplate {
  version: string;
  sections: InspectionTemplateSection[];
}

export interface InspectionSection {
  sectionKey: string;
  title: string;
  position: number;
  items: InspectionItem[];
}

export interface InspectionProgressSummary {
  completedCount: number;
  failCount: number;
  requiredRemainingCount: number;
  totalCount: number;
}

export interface InspectionDetail {
  inspection: Inspection;
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  sections: InspectionSection[];
}

export interface InspectionSummary {
  inspectionId: UUID;
  jobId: UUID;
  status: InspectionStatus;
  completedAt: string | null;
  criticalCount: number;
  highCount: number;
  recommendationCount: number;
}

export interface CreateInspectionInput {
  companyId: UUID;
  jobId: UUID;
  startedByUserId: UUID;
  templateVersion: string;
}

export interface UpdateInspectionStatusInput {
  status: InspectionStatus;
}

export interface UpdateInspectionItemInput {
  status: InspectionItemStatus;
  findingSeverity?: FindingSeverity | null | undefined;
  technicianNotes?: string | null | undefined;
  recommendation?: string | null | undefined;
}
