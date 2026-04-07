import type { AppRole } from "./auth";
import type { ISODateString, TimestampFields, UUID } from "./common";
import type { JobPriority, JobStatus } from "./job";

export const dispatchBoardViews = ["day", "week"] as const;

export type DispatchBoardView = (typeof dispatchBoardViews)[number];

export const technicianAvailabilityBlockTypes = [
  "unavailable",
  "time_off",
  "break",
  "training"
] as const;

export type TechnicianAvailabilityBlockType = (typeof technicianAvailabilityBlockTypes)[number];

export interface DispatchBoardVisibleDay {
  date: string;
  label: string;
  shortLabel: string;
  startAt: ISODateString;
  endAt: ISODateString;
}

export interface DispatchBoardRange {
  view: DispatchBoardView;
  date: string;
  rangeStartAt: ISODateString;
  rangeEndAt: ISODateString;
  visibleDays: DispatchBoardVisibleDay[];
}

export interface TechnicianAvailabilityBlock extends TimestampFields {
  id: UUID;
  companyId: UUID;
  technicianUserId: UUID;
  blockType: TechnicianAvailabilityBlockType;
  title: string;
  startsAt: ISODateString;
  endsAt: ISODateString;
  isAllDay: boolean;
  notes: string | null;
  createdByUserId: UUID;
}

export interface DispatchBoardJobItem {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  vehicleId: UUID;
  serviceSiteId?: UUID | null | undefined;
  title: string;
  status: JobStatus;
  priority: JobPriority;
  customerDisplayName: string;
  vehicleDisplayName: string;
  assignedTechnicianUserId: UUID | null;
  assignedTechnicianName: string | null;
  scheduledStartAt: ISODateString | null;
  scheduledEndAt: ISODateString | null;
  arrivalWindowStartAt: ISODateString | null;
  arrivalWindowEndAt: ISODateString | null;
  isActive: boolean;
}

export interface DispatchTechnicianLane {
  technicianUserId: UUID;
  displayName: string;
  email: string | null;
  role: AppRole;
  jobs: DispatchBoardJobItem[];
  unscheduledJobs: DispatchBoardJobItem[];
  availabilityBlocks: TechnicianAvailabilityBlock[];
}

export interface DispatchBoardData {
  view: DispatchBoardView;
  date: string;
  timezone: string;
  rangeStartAt: ISODateString;
  rangeEndAt: ISODateString;
  visibleDays: DispatchBoardVisibleDay[];
  technicians: DispatchTechnicianLane[];
  unassignedJobs: DispatchBoardJobItem[];
  unscheduledUnassignedJobs: DispatchBoardJobItem[];
}

export interface DispatchBoardQuery {
  view?: DispatchBoardView | undefined;
  date: string;
  technicianUserId?: UUID | undefined;
  includeUnscheduled?: boolean | undefined;
}

export const dispatchCalendarScopes = ["all_workers", "single_tech", "subset"] as const;
export type DispatchCalendarScope = (typeof dispatchCalendarScopes)[number];

export const dispatchCalendarViews = [...dispatchBoardViews, "month"] as const;
export type DispatchCalendarView = (typeof dispatchCalendarViews)[number];

export const dispatchCalendarConflictTypes = [
  "job_overlap",
  "availability_overlap",
  "outside_hours",
  "backlog_assigned"
] as const;

export type DispatchCalendarConflictType = (typeof dispatchCalendarConflictTypes)[number];

export interface DispatchCalendarSettings extends TimestampFields {
  companyId: UUID;
  weekStartsOn: number;
  dayStartHour: number;
  dayEndHour: number;
  slotMinutes: 15 | 30 | 60;
  showSaturday: boolean;
  showSunday: boolean;
  defaultView: DispatchCalendarView;
  updatedByUserId: UUID;
}

export interface DispatchSavedView extends TimestampFields {
  id: UUID;
  companyId: UUID;
  createdByUserId: UUID;
  name: string;
  scope: DispatchCalendarScope;
  includeUnassigned: boolean;
  view: DispatchCalendarView;
  isDefault: boolean;
}

export interface DispatchSavedViewMember extends TimestampFields {
  id: UUID;
  savedViewId: UUID;
  companyId: UUID;
  technicianUserId: UUID;
  displayOrder: number;
}

export interface DispatchResourcePreference extends TimestampFields {
  id: UUID;
  companyId: UUID;
  technicianUserId: UUID;
  laneOrder: number;
  laneColor: string | null;
  isVisibleByDefault: boolean;
}

export interface DispatchCalendarVisibleDay extends DispatchBoardVisibleDay {
  columnLabel: string;
}

export interface DispatchCalendarSlot {
  index: number;
  minutesFromDayStart: number;
  startsAt: ISODateString;
  endsAt: ISODateString;
  label: string;
  shortLabel: string;
}

export interface DispatchCalendarRange {
  view: DispatchCalendarView;
  date: string;
  rangeStartAt: ISODateString;
  rangeEndAt: ISODateString;
  visibleDays: DispatchCalendarVisibleDay[];
}

export interface DispatchCalendarResource {
  technicianUserId: UUID;
  displayName: string;
  email: string | null;
  role: AppRole;
  laneOrder: number;
  laneColor: string | null;
  isVisibleByDefault: boolean;
  scheduledCount: number;
  backlogCount: number;
  availabilityBlockCount: number;
  conflictCount: number;
  scheduledMinutes: number;
}

export interface DispatchCalendarJobEvent extends DispatchBoardJobItem {
  dayDate: string;
  eventStartAt: ISODateString;
  eventEndAt: ISODateString;
  durationMinutes: number;
  trackIndex: number;
  trackCount: number;
  resourceTechnicianUserId: UUID | null;
  overlapsAvailability: boolean;
  overlapsOtherJobs: boolean;
  isOutsideVisibleHours: boolean;
}

export interface DispatchCalendarAvailabilityEvent extends TechnicianAvailabilityBlock {
  dayDate: string;
  eventStartAt: ISODateString;
  eventEndAt: ISODateString;
  durationMinutes: number;
  trackIndex: number;
  trackCount: number;
  technicianDisplayName: string | null;
}

export interface DispatchCalendarConflict {
  id: string;
  conflictType: DispatchCalendarConflictType;
  severity: "warning" | "danger";
  title: string;
  description: string;
  dayDate: string;
  technicianUserId: UUID | null;
  jobId: UUID | null;
  availabilityBlockId: UUID | null;
}

export interface DispatchCalendarData {
  query: DispatchCalendarQuery;
  settings: DispatchCalendarSettings;
  timezone: string;
  range: DispatchCalendarRange;
  slots: DispatchCalendarSlot[];
  resources: DispatchCalendarResource[];
  jobs: DispatchCalendarJobEvent[];
  availability: DispatchCalendarAvailabilityEvent[];
  conflicts: DispatchCalendarConflict[];
  unassignedScheduledJobs: DispatchBoardJobItem[];
  backlogJobs: DispatchBoardJobItem[];
}

export interface DispatchCalendarQuery {
  date: string;
  view?: DispatchCalendarView | undefined;
  scope?: DispatchCalendarScope | undefined;
  savedViewId?: UUID | undefined;
  resourceUserIds?: UUID[] | undefined;
  includeUnassigned?: boolean | undefined;
}

export interface QuickAssignDispatchJobInput {
  assignedTechnicianUserId?: UUID | null | undefined;
}

export interface QuickRescheduleDispatchJobInput {
  scheduledStartAt: string;
  scheduledEndAt?: string | null | undefined;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
}

export interface CreateTechnicianAvailabilityBlockInput {
  companyId: UUID;
  technicianUserId: UUID;
  blockType: TechnicianAvailabilityBlockType;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean | undefined;
  notes?: string | null | undefined;
  createdByUserId: UUID;
}

export interface UpdateTechnicianAvailabilityBlockInput {
  blockType: TechnicianAvailabilityBlockType;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean | undefined;
  notes?: string | null | undefined;
}

export interface MoveDispatchJobInput {
  jobId: UUID;
  assignedTechnicianUserId?: UUID | null | undefined;
  scheduledStartAt: string;
  scheduledEndAt?: string | null | undefined;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
}

export interface ResizeDispatchJobInput {
  jobId: UUID;
  scheduledEndAt: string;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
}

export interface QuickEditDispatchJobInput {
  jobId: UUID;
  assignedTechnicianUserId?: UUID | null | undefined;
  scheduledStartAt?: string | null | undefined;
  scheduledEndAt?: string | null | undefined;
  arrivalWindowStartAt?: string | null | undefined;
  arrivalWindowEndAt?: string | null | undefined;
  status?: JobStatus | undefined;
  priority?: JobPriority | undefined;
}

export interface CreateDispatchSavedViewInput {
  companyId: UUID;
  createdByUserId: UUID;
  name: string;
  scope: DispatchCalendarScope;
  includeUnassigned?: boolean | undefined;
  view: DispatchCalendarView;
  isDefault?: boolean | undefined;
}

export interface UpdateDispatchSavedViewInput {
  name: string;
  scope: DispatchCalendarScope;
  includeUnassigned?: boolean | undefined;
  view: DispatchCalendarView;
  isDefault?: boolean | undefined;
}

export interface ReplaceDispatchSavedViewMembersInput {
  companyId: UUID;
  savedViewId: UUID;
  technicianUserIds: UUID[];
}

export interface UpdateDispatchCalendarSettingsInput {
  companyId: UUID;
  weekStartsOn: number;
  dayStartHour: number;
  dayEndHour: number;
  slotMinutes: 15 | 30 | 60;
  showSaturday?: boolean | undefined;
  showSunday?: boolean | undefined;
  defaultView: DispatchCalendarView;
  updatedByUserId: UUID;
}

export interface UpsertDispatchResourcePreferenceInput {
  companyId: UUID;
  technicianUserId: UUID;
  laneOrder?: number | undefined;
  laneColor?: string | null | undefined;
  isVisibleByDefault?: boolean | undefined;
}
