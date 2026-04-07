import type { AppRole } from "./auth";
import type { CustomerCommunicationLogEntry } from "./communication";
import type { Customer, CustomerAddress } from "./customer";
import type { TimestampFields, UUID } from "./common";
import type { Vehicle } from "./vehicle";

export const jobStatuses = [
  "new",
  "scheduled",
  "dispatched",
  "en_route",
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "in_progress",
  "completed",
  "canceled"
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const jobPriorities = ["low", "normal", "high", "urgent"] as const;

export type JobPriority = (typeof jobPriorities)[number];

export const jobSources = ["office", "phone", "web"] as const;

export type JobSource = (typeof jobSources)[number];

export const technicianAllowedStatuses = [
  "en_route",
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "completed"
] as const;

export type TechnicianAllowedStatus = (typeof technicianAllowedStatuses)[number];

export interface Job extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  vehicleId: UUID;
  serviceSiteId?: UUID | null | undefined;
  status: JobStatus;
  title: string;
  description: string | null;
  customerConcern: string | null;
  internalSummary: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  assignedTechnicianUserId: UUID | null;
  priority: JobPriority;
  source: JobSource;
  isActive: boolean;
  createdByUserId: UUID;
}

export interface JobListItem {
  id: UUID;
  status: JobStatus;
  title: string;
  customerDisplayName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicleDisplayName: string;
  assignedTechnicianUserId: UUID | null;
  assignedTechnicianName: string | null;
  scheduledStartAt: string | null;
  arrivalWindowStartAt: string | null;
  priority: JobPriority;
  isActive: boolean;
}

export interface JobNote extends TimestampFields {
  id: UUID;
  jobId: UUID;
  companyId: UUID;
  authorUserId: UUID;
  body: string;
  isInternal: boolean;
}

export interface JobStatusHistoryEntry {
  id: UUID;
  jobId: UUID;
  companyId: UUID;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  changedByUserId: UUID;
  reason: string | null;
  createdAt: string;
}

export interface JobDetail {
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  notes: JobNote[];
  statusHistory: JobStatusHistoryEntry[];
}

export interface TechnicianJobListItem {
  id: UUID;
  status: JobStatus;
  title: string;
  customerDisplayName: string;
  vehicleDisplayName: string;
  scheduledStartAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  priority: JobPriority;
  customerPhone: string | null;
  addressSummary: string | null;
  serviceSiteSummary: string | null;
  stopSeed?: TechnicianJobSeed | undefined;
  isActive: boolean;
}

export interface TechnicianJobSeed {
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  serviceSite: CustomerAddress | null;
  primaryAddress: CustomerAddress | null;
}

export interface TechnicianJobDetail {
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  serviceSite: CustomerAddress | null;
  primaryAddress: CustomerAddress | null;
  communications: CustomerCommunicationLogEntry[];
  notes: JobNote[];
  statusHistory: JobStatusHistoryEntry[];
}

export interface TechnicianJobSummary {
  assignedTodayCount: number;
  inProgressCount: number;
  upcomingCount: number;
}

export interface AssignableTechnicianOption {
  userId: UUID;
  displayName: string;
  email: string | null;
  role: AppRole;
}

export interface CreateJobInput {
  companyId: UUID;
  customerId: UUID;
  vehicleId: UUID;
  serviceSiteId?: UUID | null | undefined;
  title: string;
  description?: string | null | undefined;
  customerConcern?: string | null | undefined;
  internalSummary?: string | null | undefined;
  scheduledStartAt?: string | null | undefined;
  scheduledEndAt?: string | null | undefined;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
  assignedTechnicianUserId?: UUID | null | undefined;
  priority?: JobPriority | undefined;
  source?: JobSource | undefined;
  isActive?: boolean | undefined;
  createdByUserId: UUID;
}

export interface UpdateJobInput {
  customerId: UUID;
  vehicleId: UUID;
  serviceSiteId?: UUID | null | undefined;
  title: string;
  description?: string | null | undefined;
  customerConcern?: string | null | undefined;
  internalSummary?: string | null | undefined;
  scheduledStartAt?: string | null | undefined;
  scheduledEndAt?: string | null | undefined;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
  assignedTechnicianUserId?: UUID | null | undefined;
  priority?: JobPriority | undefined;
  source?: JobSource | undefined;
  isActive?: boolean | undefined;
}

export interface CreateJobNoteInput {
  jobId: UUID;
  companyId: UUID;
  authorUserId: UUID;
  body: string;
  isInternal?: boolean | undefined;
}

export interface UpdateJobNoteInput {
  body: string;
  isInternal?: boolean | undefined;
}

export interface ChangeJobStatusInput {
  toStatus: JobStatus;
  reason?: string | null | undefined;
}

export interface AssignJobTechnicianInput {
  assignedTechnicianUserId?: UUID | null | undefined;
}

export interface JobListQuery {
  query?: string | undefined;
  status?: JobStatus | undefined;
  assignedTechnicianUserId?: UUID | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  includeInactive?: boolean | undefined;
}

export interface TechnicianJobListQuery {
  status?: JobStatus | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}
