import {
  applyTrackPlacementToAvailability,
  applyTrackPlacementToJobs,
  buildDispatchTimeSlots,
  detectDispatchConflicts,
  getCustomerDisplayName,
  getDispatchCalendarRange,
  getDispatchDurationMinutes,
  getDispatchLocalDate,
  getDispatchRange,
  getSafeTimeZone,
  resolveDispatchResourcesForScope,
  summarizeLaneLoad,
  getVehicleDisplayName,
  zonedLocalDateTimeToUtc
} from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  CreateTechnicianAvailabilityBlockInput,
  CreateDispatchSavedViewInput,
  Database,
  DispatchCalendarData,
  DispatchCalendarJobEvent,
  DispatchCalendarQuery,
  DispatchCalendarResource,
  DispatchCalendarSettings,
  DispatchBoardData,
  DispatchBoardJobItem,
  DispatchBoardQuery,
  DispatchResourcePreference,
  DispatchSavedView,
  DispatchSavedViewMember,
  DispatchTechnicianLane,
  MoveDispatchJobInput,
  QuickEditDispatchJobInput,
  QuickAssignDispatchJobInput,
  QuickRescheduleDispatchJobInput,
  ResizeDispatchJobInput,
  TechnicianAvailabilityBlock,
  UpdateDispatchCalendarSettingsInput,
  UpdateDispatchSavedViewInput,
  UpdateTechnicianAvailabilityBlockInput
} from "@mobile-mechanic/types";
import {
  createTechnicianAvailabilityBlockInputSchema,
  createDispatchSavedViewInputSchema,
  dispatchCalendarQuerySchema,
  dispatchBoardQuerySchema,
  moveDispatchJobInputSchema,
  quickEditDispatchJobInputSchema,
  quickAssignDispatchJobInputSchema,
  quickRescheduleDispatchJobInputSchema,
  replaceDispatchSavedViewMembersInputSchema,
  resizeDispatchJobInputSchema,
  updateDispatchCalendarSettingsInputSchema,
  updateDispatchSavedViewInputSchema,
  upsertDispatchResourcePreferenceInputSchema,
  updateTechnicianAvailabilityBlockInputSchema
} from "@mobile-mechanic/validation";

import { getCompanyById } from "./companies";
import { getJobById, listAssignableTechniciansByCompany } from "./jobs";
import type { AppSupabaseClient } from "../supabase/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type TechnicianAvailabilityBlockRow = Database["public"]["Tables"]["technician_availability_blocks"]["Row"];
type DispatchCalendarSettingsRow = Database["public"]["Tables"]["dispatch_calendar_settings"]["Row"];
type DispatchSavedViewRow = Database["public"]["Tables"]["dispatch_saved_views"]["Row"];
type DispatchSavedViewMemberRow = Database["public"]["Tables"]["dispatch_saved_view_members"]["Row"];
type DispatchResourcePreferenceRow = Database["public"]["Tables"]["dispatch_resource_preferences"]["Row"];

const dispatchVisibleStatuses = ["new", "scheduled", "dispatched", "in_progress"] as const;

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeDispatchDateTimeInput(value: string | null | undefined, timeZone: string): string | null {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  if (/([+-]\d{2}:\d{2}|Z)$/i.test(normalized)) {
    return new Date(normalized).toISOString();
  }

  return zonedLocalDateTimeToUtc(normalized, timeZone).toISOString();
}

function normalizeRequiredDispatchDateTimeInput(value: string, timeZone: string): string {
  const normalized = normalizeDispatchDateTimeInput(value, timeZone);

  if (!normalized) {
    throw new Error("A dispatch datetime value is required.");
  }

  return normalized;
}

function overlapsDispatchRange(
  startAt: string | null,
  endAt: string | null,
  rangeStartAt: string,
  rangeEndAt: string
): boolean {
  if (!startAt) {
    return false;
  }

  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt ?? startAt).getTime();
  const rangeStartTime = new Date(rangeStartAt).getTime();
  const rangeEndTime = new Date(rangeEndAt).getTime();

  return startTime < rangeEndTime && endTime > rangeStartTime;
}

function compareDispatchJobs(left: DispatchBoardJobItem, right: DispatchBoardJobItem): number {
  const leftStart = left.scheduledStartAt ? new Date(left.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightStart = right.scheduledStartAt ? new Date(right.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function compareAvailabilityBlocks(
  left: TechnicianAvailabilityBlock,
  right: TechnicianAvailabilityBlock
): number {
  const leftStart = new Date(left.startsAt).getTime();
  const rightStart = new Date(right.startsAt).getTime();

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function mapDispatchBoardJobItem(
  row: JobRow,
  customersById: Map<string, CustomerRow>,
  vehiclesById: Map<string, VehicleRow>,
  technicianNamesById: Map<string, string>
): DispatchBoardJobItem {
  const customer = customersById.get(row.customer_id);
  const vehicle = vehiclesById.get(row.vehicle_id);

  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    vehicleId: row.vehicle_id,
    serviceSiteId: row.service_site_id,
    title: row.title,
    status: row.status,
    priority: row.priority as DispatchBoardJobItem["priority"],
    customerDisplayName: customer
      ? getCustomerDisplayName({
          companyName: customer.company_name,
          firstName: customer.first_name,
          lastName: customer.last_name,
          relationshipType: customer.relationship_type
        })
      : "Unknown customer",
    vehicleDisplayName: vehicle
      ? getVehicleDisplayName({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model
        })
      : "Unknown vehicle",
    assignedTechnicianUserId: row.assigned_technician_user_id,
    assignedTechnicianName: row.assigned_technician_user_id
      ? technicianNamesById.get(row.assigned_technician_user_id) ?? null
      : null,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    arrivalWindowStartAt: row.arrival_window_start_at,
    arrivalWindowEndAt: row.arrival_window_end_at,
    isActive: row.is_active
  };
}

function mapTechnicianAvailabilityBlockRow(
  row: TechnicianAvailabilityBlockRow
): TechnicianAvailabilityBlock {
  return {
    id: row.id,
    companyId: row.company_id,
    technicianUserId: row.technician_user_id,
    blockType: row.block_type as TechnicianAvailabilityBlock["blockType"],
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: row.is_all_day,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDispatchCalendarSettingsRow(
  row: DispatchCalendarSettingsRow
): DispatchCalendarSettings {
  return {
    companyId: row.company_id,
    weekStartsOn: row.week_starts_on,
    dayStartHour: row.day_start_hour,
    dayEndHour: row.day_end_hour,
    slotMinutes: row.slot_minutes as DispatchCalendarSettings["slotMinutes"],
    showSaturday: row.show_saturday,
    showSunday: row.show_sunday,
    defaultView: row.default_view as DispatchCalendarSettings["defaultView"],
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDispatchSavedViewRow(row: DispatchSavedViewRow): DispatchSavedView {
  return {
    id: row.id,
    companyId: row.company_id,
    createdByUserId: row.created_by_user_id,
    name: row.name,
    scope: row.scope as DispatchSavedView["scope"],
    includeUnassigned: row.include_unassigned,
    view: row.view as DispatchSavedView["view"],
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDispatchSavedViewMemberRow(
  row: DispatchSavedViewMemberRow
): DispatchSavedViewMember {
  return {
    id: row.id,
    savedViewId: row.saved_view_id,
    companyId: row.company_id,
    technicianUserId: row.technician_user_id,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDispatchResourcePreferenceRow(
  row: DispatchResourcePreferenceRow
): DispatchResourcePreference {
  return {
    id: row.id,
    companyId: row.company_id,
    technicianUserId: row.technician_user_id,
    laneOrder: row.lane_order,
    laneColor: row.lane_color,
    isVisibleByDefault: row.is_visible_by_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildDefaultDispatchCalendarSettings(
  companyId: string,
  updatedByUserId: string
): DispatchCalendarSettings {
  const now = new Date().toISOString();

  return {
    companyId,
    weekStartsOn: 1,
    dayStartHour: 7,
    dayEndHour: 19,
    slotMinutes: 30,
    showSaturday: true,
    showSunday: false,
    defaultView: "day",
    updatedByUserId,
    createdAt: now,
    updatedAt: now
  };
}

export function buildDispatchBoardData(input: {
  date: string;
  timezone: string;
  range: Pick<DispatchBoardData, "view" | "rangeStartAt" | "rangeEndAt" | "visibleDays">;
  technicians: Array<{
    userId: string;
    displayName: string;
    email: string | null;
    role: DispatchTechnicianLane["role"];
  }>;
  jobs: DispatchBoardJobItem[];
  availabilityBlocks: TechnicianAvailabilityBlock[];
  includeUnscheduled?: boolean | undefined;
}): DispatchBoardData {
  const lanes = new Map<string, DispatchTechnicianLane>(
    input.technicians.map((technician) => [
      technician.userId,
      {
        technicianUserId: technician.userId,
        displayName: technician.displayName,
        email: technician.email,
        role: technician.role,
        jobs: [],
        unscheduledJobs: [],
        availabilityBlocks: []
      }
    ])
  );
  const unassignedJobs: DispatchBoardJobItem[] = [];
  const unscheduledUnassignedJobs: DispatchBoardJobItem[] = [];

  for (const job of input.jobs) {
    const isInRange = overlapsDispatchRange(
      job.scheduledStartAt,
      job.scheduledEndAt,
      input.range.rangeStartAt,
      input.range.rangeEndAt
    );

    if (job.assignedTechnicianUserId && lanes.has(job.assignedTechnicianUserId)) {
      const lane = lanes.get(job.assignedTechnicianUserId);

      if (!lane) {
        continue;
      }

      if (job.scheduledStartAt && isInRange) {
        lane.jobs.push(job);
      } else if (!job.scheduledStartAt && input.includeUnscheduled !== false) {
        lane.unscheduledJobs.push(job);
      }

      continue;
    }

    if (job.scheduledStartAt && isInRange) {
      unassignedJobs.push(job);
    } else if (!job.scheduledStartAt && input.includeUnscheduled !== false) {
      unscheduledUnassignedJobs.push(job);
    }
  }

  for (const block of input.availabilityBlocks) {
    const lane = lanes.get(block.technicianUserId);

    if (lane) {
      lane.availabilityBlocks.push(block);
    }
  }

  for (const lane of lanes.values()) {
    lane.jobs.sort(compareDispatchJobs);
    lane.unscheduledJobs.sort(compareDispatchJobs);
    lane.availabilityBlocks.sort(compareAvailabilityBlocks);
  }

  unassignedJobs.sort(compareDispatchJobs);
  unscheduledUnassignedJobs.sort(compareDispatchJobs);

  return {
    view: input.range.view,
    date: input.date,
    timezone: input.timezone,
    rangeStartAt: input.range.rangeStartAt,
    rangeEndAt: input.range.rangeEndAt,
    visibleDays: input.range.visibleDays,
    technicians: [...lanes.values()],
    unassignedJobs,
    unscheduledUnassignedJobs
  };
}

async function getCompanyTimeZone(client: AppSupabaseClient, companyId: string): Promise<string> {
  const companyResult = await getCompanyById(client, companyId);

  if (companyResult.error || !companyResult.data) {
    throw companyResult.error ?? new Error("Company not found.");
  }

  return getSafeTimeZone(companyResult.data.timezone);
}

function createDispatchJobsBaseQuery(client: AppSupabaseClient, companyId: string) {
  return client
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("status", [...dispatchVisibleStatuses])
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
}

function applyDispatchAssignmentFilter(
  builder: ReturnType<typeof createDispatchJobsBaseQuery>,
  assignedTechnicianUserId: string | null | undefined
) {
  if (assignedTechnicianUserId === undefined) {
    return builder;
  }

  if (assignedTechnicianUserId === null) {
    return builder.is("assigned_technician_user_id", null);
  }

  return builder.eq("assigned_technician_user_id", assignedTechnicianUserId);
}

async function listDispatchScheduledJobRows(
  client: AppSupabaseClient,
  companyId: string,
  rangeStartAt: string,
  rangeEndAt: string,
  assignedTechnicianUserId?: string | null
) {
  const rangedBuilder = applyDispatchAssignmentFilter(
    createDispatchJobsBaseQuery(client, companyId),
    assignedTechnicianUserId
  )
    .not("scheduled_end_at", "is", null)
    .gt("scheduled_end_at", rangeStartAt)
    .lt("scheduled_start_at", rangeEndAt);
  const pointBuilder = applyDispatchAssignmentFilter(
    createDispatchJobsBaseQuery(client, companyId),
    assignedTechnicianUserId
  )
    .is("scheduled_end_at", null)
    .gte("scheduled_start_at", rangeStartAt)
    .lt("scheduled_start_at", rangeEndAt);

  const [rangedResult, pointResult] = await Promise.all([
    rangedBuilder.returns<JobRow[]>(),
    pointBuilder.returns<JobRow[]>()
  ]);

  if (rangedResult.error) {
    return {
      ...rangedResult,
      data: null
    };
  }

  if (pointResult.error) {
    return {
      ...pointResult,
      data: null
    };
  }

  return {
    error: null,
    data: [...(rangedResult.data ?? []), ...(pointResult.data ?? [])]
  };
}

async function listDispatchUnscheduledJobRows(
  client: AppSupabaseClient,
  companyId: string,
  assignedTechnicianUserId?: string | null
) {
  const builder = applyDispatchAssignmentFilter(
    createDispatchJobsBaseQuery(client, companyId),
    assignedTechnicianUserId
  ).is("scheduled_start_at", null);
  const result = await builder.returns<JobRow[]>();

  return {
    ...result,
    data: result.data ?? null
  };
}

export async function listTechnicianAvailabilityBlocks(
  client: AppSupabaseClient,
  companyId: string,
  rangeStartAt: string,
  rangeEndAt: string,
  technicianUserId?: string
) {
  let builder = client
    .from("technician_availability_blocks")
    .select("*")
    .eq("company_id", companyId)
    .lt("starts_at", rangeEndAt)
    .gt("ends_at", rangeStartAt)
    .order("starts_at", { ascending: true });

  if (technicianUserId) {
    builder = builder.eq("technician_user_id", technicianUserId);
  }

  const result = await builder.returns<TechnicianAvailabilityBlockRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapTechnicianAvailabilityBlockRow) : null
  };
}

export async function listDispatchBoard(
  client: AppSupabaseClient,
  companyId: string,
  query: DispatchBoardQuery
) {
  const parsed = dispatchBoardQuerySchema.parse(query);
  const [timeZone, techniciansResult] = await Promise.all([
    getCompanyTimeZone(client, companyId),
    listAssignableTechniciansByCompany(client, companyId)
  ]);
  const range = getDispatchRange(parsed.date, parsed.view ?? "day", timeZone);

  if (techniciansResult.error || !techniciansResult.data) {
    return {
      ...techniciansResult,
      data: null
    };
  }

  const scheduledJobRequests = parsed.technicianUserId
    ? [
        listDispatchScheduledJobRows(
          client,
          companyId,
          range.rangeStartAt,
          range.rangeEndAt,
          parsed.technicianUserId
        ),
        listDispatchScheduledJobRows(
          client,
          companyId,
          range.rangeStartAt,
          range.rangeEndAt,
          null
        )
      ]
    : [
        listDispatchScheduledJobRows(
          client,
          companyId,
          range.rangeStartAt,
          range.rangeEndAt
        )
      ];
  const unscheduledJobRequests = parsed.includeUnscheduled === false
    ? []
    : parsed.technicianUserId
      ? [
          listDispatchUnscheduledJobRows(client, companyId, parsed.technicianUserId),
          listDispatchUnscheduledJobRows(client, companyId, null)
        ]
      : [listDispatchUnscheduledJobRows(client, companyId)];
  const [availabilityBlocksResult, ...jobResults] = await Promise.all([
    listTechnicianAvailabilityBlocks(
      client,
      companyId,
      range.rangeStartAt,
      range.rangeEndAt,
      parsed.technicianUserId
    ),
    ...scheduledJobRequests,
    ...unscheduledJobRequests
  ]);

  if (availabilityBlocksResult.error) {
    throw availabilityBlocksResult.error;
  }

  const jobsError = jobResults.find((result) => result.error);

  if (jobsError) {
    return {
      error: jobsError.error,
      data: null
    };
  }

  const jobs = jobResults.flatMap((result) => result.data ?? []);

  const customerIds = [...new Set(jobs.map((job) => job.customer_id))];
  const vehicleIds = [...new Set(jobs.map((job) => job.vehicle_id))];

  const [customersResult, vehiclesResult] = await Promise.all([
    customerIds.length
      ? client.from("customers").select("*").in("id", customerIds).returns<CustomerRow[]>()
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length
      ? client.from("vehicles").select("*").in("id", vehicleIds).returns<VehicleRow[]>()
      : Promise.resolve({ data: [] as VehicleRow[], error: null })
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  const technicians = (parsed.technicianUserId
    ? techniciansResult.data.filter((technician) => technician.userId === parsed.technicianUserId)
    : techniciansResult.data
  ).sort((left, right) => left.displayName.localeCompare(right.displayName));

  const customersById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehiclesById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const technicianNamesById = new Map(
    techniciansResult.data.map((technician) => [technician.userId, technician.displayName])
  );
  const board = buildDispatchBoardData({
    date: parsed.date,
    timezone: timeZone,
    range,
    technicians,
    jobs: jobs.map((row) =>
      mapDispatchBoardJobItem(row, customersById, vehiclesById, technicianNamesById)
    ),
    availabilityBlocks: availabilityBlocksResult.data ?? [],
    includeUnscheduled: parsed.includeUnscheduled
  });

  return {
    error: null,
    data: {
      board,
      technicians: techniciansResult.data as AssignableTechnicianOption[]
    }
  };
}

export async function quickAssignDispatchJob(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string,
  input: QuickAssignDispatchJobInput
) {
  const parsed = quickAssignDispatchJobInputSchema.parse(input);
  const jobResult = await getJobById(client, jobId);

  if (jobResult.error || !jobResult.data) {
    return jobResult;
  }

  if (jobResult.data.companyId !== companyId || !jobResult.data.isActive) {
    throw new Error("Job is not available for dispatch assignment.");
  }

  const result = await client
    .from("jobs")
    .update({ assigned_technician_user_id: parsed.assignedTechnicianUserId ?? null })
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}

export async function quickRescheduleDispatchJob(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string,
  input: QuickRescheduleDispatchJobInput
) {
  const parsed = quickRescheduleDispatchJobInputSchema.parse(input);
  const [jobResult, timeZone] = await Promise.all([
    getJobById(client, jobId),
    getCompanyTimeZone(client, companyId)
  ]);

  if (jobResult.error || !jobResult.data) {
    return jobResult;
  }

  if (jobResult.data.companyId !== companyId || !jobResult.data.isActive) {
    throw new Error("Job is not available for dispatch rescheduling.");
  }

  if (!["new", "scheduled", "dispatched"].includes(jobResult.data.status)) {
    throw new Error("Only new, scheduled, or dispatched jobs can be rescheduled from dispatch.");
  }

  const nextStatus = jobResult.data.status === "new" ? "scheduled" : jobResult.data.status;
  const nextArrivalWindowStartAt =
    parsed.arrivalWindowStartAt === undefined
      ? jobResult.data.arrivalWindowStartAt
      : normalizeDispatchDateTimeInput(parsed.arrivalWindowStartAt, timeZone);
  const nextArrivalWindowEndAt =
    parsed.arrivalWindowEndAt === undefined
      ? jobResult.data.arrivalWindowEndAt
      : normalizeDispatchDateTimeInput(parsed.arrivalWindowEndAt, timeZone);
  const result = await client
    .from("jobs")
    .update({
      status: nextStatus,
      scheduled_start_at: normalizeDispatchDateTimeInput(parsed.scheduledStartAt, timeZone),
      scheduled_end_at: normalizeDispatchDateTimeInput(parsed.scheduledEndAt, timeZone),
      arrival_window_start_at: nextArrivalWindowStartAt,
      arrival_window_end_at: nextArrivalWindowEndAt
    })
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}

export async function createTechnicianAvailabilityBlock(
  client: AppSupabaseClient,
  input: CreateTechnicianAvailabilityBlockInput
) {
  const parsed = createTechnicianAvailabilityBlockInputSchema.parse(input);
  const timeZone = await getCompanyTimeZone(client, parsed.companyId);
  const result = await client
    .from("technician_availability_blocks")
    .insert({
      company_id: parsed.companyId,
      technician_user_id: parsed.technicianUserId,
      block_type: parsed.blockType,
      title: parsed.title.trim(),
      starts_at: normalizeRequiredDispatchDateTimeInput(parsed.startsAt, timeZone),
      ends_at: normalizeRequiredDispatchDateTimeInput(parsed.endsAt, timeZone),
      is_all_day: parsed.isAllDay ?? false,
      notes: normalizeOptionalText(parsed.notes),
      created_by_user_id: parsed.createdByUserId
    })
    .select("*")
    .single<TechnicianAvailabilityBlockRow>();

  return {
    ...result,
    data: result.data ? mapTechnicianAvailabilityBlockRow(result.data) : null
  };
}

export async function updateTechnicianAvailabilityBlock(
  client: AppSupabaseClient,
  companyId: string,
  blockId: string,
  input: UpdateTechnicianAvailabilityBlockInput
) {
  const parsed = updateTechnicianAvailabilityBlockInputSchema.parse(input);
  const timeZone = await getCompanyTimeZone(client, companyId);
  const result = await client
    .from("technician_availability_blocks")
    .update({
      block_type: parsed.blockType,
      title: parsed.title.trim(),
      starts_at: normalizeRequiredDispatchDateTimeInput(parsed.startsAt, timeZone),
      ends_at: normalizeRequiredDispatchDateTimeInput(parsed.endsAt, timeZone),
      is_all_day: parsed.isAllDay ?? false,
      notes: normalizeOptionalText(parsed.notes)
    })
    .eq("id", blockId)
    .eq("company_id", companyId)
    .select("*")
    .single<TechnicianAvailabilityBlockRow>();

  return {
    ...result,
    data: result.data ? mapTechnicianAvailabilityBlockRow(result.data) : null
  };
}

export async function deleteTechnicianAvailabilityBlock(
  client: AppSupabaseClient,
  companyId: string,
  blockId: string
) {
  return client
    .from("technician_availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("company_id", companyId);
}

export async function getDispatchCalendarSettings(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("dispatch_calendar_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle<DispatchCalendarSettingsRow>();

  if (result.error) {
    return {
      ...result,
      data: null
    };
  }

  return {
    error: null,
    data: result.data ? mapDispatchCalendarSettingsRow(result.data) : null
  };
}

export async function upsertDispatchCalendarSettings(
  client: AppSupabaseClient,
  input: UpdateDispatchCalendarSettingsInput
) {
  const parsed = updateDispatchCalendarSettingsInputSchema.parse(input);
  const result = await client
    .from("dispatch_calendar_settings")
    .upsert(
      {
        company_id: parsed.companyId,
        week_starts_on: parsed.weekStartsOn,
        day_start_hour: parsed.dayStartHour,
        day_end_hour: parsed.dayEndHour,
        slot_minutes: parsed.slotMinutes,
        show_saturday: parsed.showSaturday ?? true,
        show_sunday: parsed.showSunday ?? false,
        default_view: parsed.defaultView,
        updated_by_user_id: parsed.updatedByUserId
      },
      {
        onConflict: "company_id"
      }
    )
    .select("*")
    .single<DispatchCalendarSettingsRow>();

  return {
    ...result,
    data: result.data ? mapDispatchCalendarSettingsRow(result.data) : null
  };
}

export async function listDispatchSavedViews(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("dispatch_saved_views")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .returns<DispatchSavedViewRow[]>();

  return {
    ...result,
    data: result.data?.map(mapDispatchSavedViewRow) ?? null
  };
}

export async function getDispatchSavedViewById(
  client: AppSupabaseClient,
  companyId: string,
  savedViewId: string
) {
  const result = await client
    .from("dispatch_saved_views")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", savedViewId)
    .maybeSingle<DispatchSavedViewRow>();

  return {
    ...result,
    data: result.data ? mapDispatchSavedViewRow(result.data) : null
  };
}

export async function listDispatchSavedViewMembers(
  client: AppSupabaseClient,
  companyId: string,
  savedViewId: string
) {
  const result = await client
    .from("dispatch_saved_view_members")
    .select("*")
    .eq("company_id", companyId)
    .eq("saved_view_id", savedViewId)
    .order("display_order", { ascending: true })
    .returns<DispatchSavedViewMemberRow[]>();

  return {
    ...result,
    data: result.data?.map(mapDispatchSavedViewMemberRow) ?? null
  };
}

async function clearExistingDefaultDispatchSavedViews(
  client: AppSupabaseClient,
  companyId: string
) {
  return client
    .from("dispatch_saved_views")
    .update({ is_default: false })
    .eq("company_id", companyId)
    .eq("is_default", true);
}

export async function createDispatchSavedView(
  client: AppSupabaseClient,
  input: CreateDispatchSavedViewInput
) {
  const parsed = createDispatchSavedViewInputSchema.parse(input);

  if (parsed.isDefault) {
    const clearDefaultsResult = await clearExistingDefaultDispatchSavedViews(client, parsed.companyId);

    if (clearDefaultsResult.error) {
      return {
        error: clearDefaultsResult.error,
        data: null
      };
    }
  }

  const result = await client
    .from("dispatch_saved_views")
    .insert({
      company_id: parsed.companyId,
      created_by_user_id: parsed.createdByUserId,
      name: parsed.name.trim(),
      scope: parsed.scope,
      include_unassigned: parsed.includeUnassigned ?? true,
      view: parsed.view,
      is_default: parsed.isDefault ?? false
    })
    .select("*")
    .single<DispatchSavedViewRow>();

  return {
    ...result,
    data: result.data ? mapDispatchSavedViewRow(result.data) : null
  };
}

export async function updateDispatchSavedView(
  client: AppSupabaseClient,
  companyId: string,
  savedViewId: string,
  input: UpdateDispatchSavedViewInput
) {
  const parsed = updateDispatchSavedViewInputSchema.parse(input);

  if (parsed.isDefault) {
    const clearDefaultsResult = await clearExistingDefaultDispatchSavedViews(client, companyId);

    if (clearDefaultsResult.error) {
      return {
        error: clearDefaultsResult.error,
        data: null
      };
    }
  }

  const result = await client
    .from("dispatch_saved_views")
    .update({
      name: parsed.name.trim(),
      scope: parsed.scope,
      include_unassigned: parsed.includeUnassigned ?? true,
      view: parsed.view,
      is_default: parsed.isDefault ?? false
    })
    .eq("company_id", companyId)
    .eq("id", savedViewId)
    .select("*")
    .single<DispatchSavedViewRow>();

  return {
    ...result,
    data: result.data ? mapDispatchSavedViewRow(result.data) : null
  };
}

export async function replaceDispatchSavedViewMembers(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    savedViewId: string;
    technicianUserIds: string[];
  }
) {
  const parsed = replaceDispatchSavedViewMembersInputSchema.parse(input);
  const deleteResult = await client
    .from("dispatch_saved_view_members")
    .delete()
    .eq("company_id", parsed.companyId)
    .eq("saved_view_id", parsed.savedViewId);

  if (deleteResult.error) {
    return {
      error: deleteResult.error,
      data: null
    };
  }

  if (!parsed.technicianUserIds.length) {
    return {
      error: null,
      data: []
    };
  }

  const result = await client
    .from("dispatch_saved_view_members")
    .insert(
      parsed.technicianUserIds.map((technicianUserId, index) => ({
        company_id: parsed.companyId,
        saved_view_id: parsed.savedViewId,
        technician_user_id: technicianUserId,
        display_order: index
      }))
    )
    .select("*")
    .returns<DispatchSavedViewMemberRow[]>();

  return {
    ...result,
    data: result.data?.map(mapDispatchSavedViewMemberRow) ?? null
  };
}

export async function deleteDispatchSavedView(
  client: AppSupabaseClient,
  companyId: string,
  savedViewId: string
) {
  return client
    .from("dispatch_saved_views")
    .delete()
    .eq("company_id", companyId)
    .eq("id", savedViewId);
}

export async function listDispatchResourcePreferences(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("dispatch_resource_preferences")
    .select("*")
    .eq("company_id", companyId)
    .order("lane_order", { ascending: true })
    .returns<DispatchResourcePreferenceRow[]>();

  return {
    ...result,
    data: result.data?.map(mapDispatchResourcePreferenceRow) ?? null
  };
}

export async function upsertDispatchResourcePreference(
  client: AppSupabaseClient,
  input: {
    companyId: string;
    technicianUserId: string;
    laneOrder?: number | undefined;
    laneColor?: string | null | undefined;
    isVisibleByDefault?: boolean | undefined;
  }
) {
  const parsed = upsertDispatchResourcePreferenceInputSchema.parse(input);
  const result = await client
    .from("dispatch_resource_preferences")
    .upsert(
      {
        company_id: parsed.companyId,
        technician_user_id: parsed.technicianUserId,
        lane_order: parsed.laneOrder ?? 0,
        lane_color: parsed.laneColor ?? null,
        is_visible_by_default: parsed.isVisibleByDefault ?? true
      },
      {
        onConflict: "company_id,technician_user_id"
      }
    )
    .select("*")
    .single<DispatchResourcePreferenceRow>();

  return {
    ...result,
    data: result.data ? mapDispatchResourcePreferenceRow(result.data) : null
  };
}

function getDispatchJobEventBounds(
  job: DispatchBoardJobItem,
  settings: DispatchCalendarSettings
) {
  const startAt = job.scheduledStartAt;

  if (!startAt) {
    return null;
  }

  const defaultDurationMinutes = Math.max(settings.slotMinutes * 2, 60);
  const eventStartAt = startAt;
  const eventEndAt =
    job.scheduledEndAt ??
    new Date(new Date(startAt).getTime() + defaultDurationMinutes * 60_000).toISOString();

  return {
    eventStartAt,
    eventEndAt,
    durationMinutes: getDispatchDurationMinutes(eventStartAt, eventEndAt)
  };
}

function mapDispatchCalendarJobEvent(
  job: DispatchBoardJobItem,
  settings: DispatchCalendarSettings,
  timeZone: string
): Omit<DispatchCalendarJobEvent, "trackIndex" | "trackCount"> | null {
  const bounds = getDispatchJobEventBounds(job, settings);

  if (!bounds) {
    return null;
  }

  return {
    ...job,
    dayDate: getDispatchLocalDate(bounds.eventStartAt, timeZone),
    eventStartAt: bounds.eventStartAt,
    eventEndAt: bounds.eventEndAt,
    durationMinutes: bounds.durationMinutes,
    resourceTechnicianUserId: job.assignedTechnicianUserId,
    overlapsAvailability: false,
    overlapsOtherJobs: false,
    isOutsideVisibleHours: false
  };
}

function mapDispatchCalendarAvailabilityEvent(
  block: TechnicianAvailabilityBlock,
  technicianNamesById: Map<string, string>,
  timeZone: string
) {
  return {
    ...block,
    dayDate: getDispatchLocalDate(block.startsAt, timeZone),
    eventStartAt: block.startsAt,
    eventEndAt: block.endsAt,
    durationMinutes: getDispatchDurationMinutes(block.startsAt, block.endsAt),
    technicianDisplayName: technicianNamesById.get(block.technicianUserId) ?? null
  };
}

function applyDispatchTrackPlacement(input: {
  availability: TechnicianAvailabilityBlock[];
  jobs: DispatchBoardJobItem[];
  settings: DispatchCalendarSettings;
  technicianNamesById: Map<string, string>;
  timeZone: string;
}) {
  const groupedJobs = new Map<string, Omit<DispatchCalendarJobEvent, "trackIndex" | "trackCount">[]>();
  const groupedAvailability = new Map<
    string,
    Omit<ReturnType<typeof mapDispatchCalendarAvailabilityEvent>, "trackIndex" | "trackCount">[]
  >();

  for (const job of input.jobs) {
    const event = mapDispatchCalendarJobEvent(job, input.settings, input.timeZone);

    if (!event || !event.resourceTechnicianUserId) {
      continue;
    }

    const key = `${event.dayDate}:${event.resourceTechnicianUserId}`;
    const current = groupedJobs.get(key) ?? [];
    current.push(event);
    groupedJobs.set(key, current);
  }

  for (const block of input.availability) {
    const event = mapDispatchCalendarAvailabilityEvent(
      block,
      input.technicianNamesById,
      input.timeZone
    );
    const key = `${event.dayDate}:${event.technicianUserId}`;
    const current = groupedAvailability.get(key) ?? [];
    current.push(event);
    groupedAvailability.set(key, current);
  }

  const placedJobs: DispatchCalendarJobEvent[] = [];
  const placedAvailability: ReturnType<typeof applyTrackPlacementToAvailability> = [];

  for (const events of groupedJobs.values()) {
    placedJobs.push(...applyTrackPlacementToJobs(events));
  }

  for (const events of groupedAvailability.values()) {
    placedAvailability.push(...applyTrackPlacementToAvailability(events));
  }

  return {
    jobs: placedJobs,
    availability: placedAvailability
  };
}

function applyConflictFlags(input: {
  availability: ReturnType<typeof applyTrackPlacementToAvailability>;
  conflicts: ReturnType<typeof detectDispatchConflicts>;
  jobs: DispatchCalendarJobEvent[];
  settings: DispatchCalendarSettings;
  timeZone: string;
}) {
  const overlapJobIds = new Set(
    input.conflicts
      .filter((conflict) => conflict.conflictType === "job_overlap")
      .map((conflict) => conflict.jobId)
      .filter((value): value is string => Boolean(value))
  );
  const availabilityJobIds = new Set(
    input.conflicts
      .filter((conflict) => conflict.conflictType === "availability_overlap")
      .map((conflict) => conflict.jobId)
      .filter((value): value is string => Boolean(value))
  );
  const outsideHoursJobIds = new Set(
    input.conflicts
      .filter((conflict) => conflict.conflictType === "outside_hours")
      .map((conflict) => conflict.jobId)
      .filter((value): value is string => Boolean(value))
  );

  return input.jobs.map((job) => ({
    ...job,
    overlapsOtherJobs: overlapJobIds.has(job.id),
    overlapsAvailability: availabilityJobIds.has(job.id),
    isOutsideVisibleHours: outsideHoursJobIds.has(job.id)
  }));
}

export async function listDispatchCalendar(
  client: AppSupabaseClient,
  companyId: string,
  query: DispatchCalendarQuery,
  settings: DispatchCalendarSettings
) {
  const parsed = dispatchCalendarQuerySchema.parse(query);
  const [timeZone, techniciansResult, preferencesResult] = await Promise.all([
    getCompanyTimeZone(client, companyId),
    listAssignableTechniciansByCompany(client, companyId),
    listDispatchResourcePreferences(client, companyId)
  ]);

  if (techniciansResult.error || !techniciansResult.data) {
    return {
      error: techniciansResult.error ?? new Error("Assignable technicians could not be loaded."),
      data: null
    };
  }

  if (preferencesResult.error) {
    return {
      error: preferencesResult.error,
      data: null
    };
  }

  const savedViewMembersResult =
    parsed.savedViewId
      ? await listDispatchSavedViewMembers(client, companyId, parsed.savedViewId)
      : { error: null, data: [] as DispatchSavedViewMember[] };

  if (savedViewMembersResult.error) {
    return {
      error: savedViewMembersResult.error,
      data: null
    };
  }

  const resources = resolveDispatchResourcesForScope({
    query: parsed,
    savedViewMembers: savedViewMembersResult.data ?? [],
    technicians: techniciansResult.data,
    preferences: preferencesResult.data ?? []
  });

  const range = getDispatchCalendarRange({
    date: parsed.date,
    settings,
    timeZone,
    view: parsed.view ?? settings.defaultView
  });
  const selectedResourceIds = new Set(resources.map((resource) => resource.userId));
  const [scheduledRowsResult, unscheduledRowsResult, availabilityResult] = await Promise.all([
    listDispatchScheduledJobRows(client, companyId, range.rangeStartAt, range.rangeEndAt),
    listDispatchUnscheduledJobRows(client, companyId),
    listTechnicianAvailabilityBlocks(client, companyId, range.rangeStartAt, range.rangeEndAt)
  ]);

  const anyDataError =
    scheduledRowsResult.error ??
    unscheduledRowsResult.error ??
    availabilityResult.error;

  if (anyDataError) {
    return {
      error: anyDataError,
      data: null
    };
  }

  const scheduledRows = scheduledRowsResult.data ?? [];
  const unscheduledRows = unscheduledRowsResult.data ?? [];
  const availabilityBlocks = (availabilityResult.data ?? []).filter((block) =>
    selectedResourceIds.has(block.technicianUserId)
  );
  const jobs = [...scheduledRows, ...unscheduledRows];
  const customerIds = [...new Set(jobs.map((job) => job.customer_id))];
  const vehicleIds = [...new Set(jobs.map((job) => job.vehicle_id))];
  const [customersResult, vehiclesResult] = await Promise.all([
    customerIds.length
      ? client.from("customers").select("*").in("id", customerIds).returns<CustomerRow[]>()
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length
      ? client.from("vehicles").select("*").in("id", vehicleIds).returns<VehicleRow[]>()
      : Promise.resolve({ data: [] as VehicleRow[], error: null })
  ]);

  if (customersResult.error || vehiclesResult.error) {
    return {
      error: customersResult.error ?? vehiclesResult.error,
      data: null
    };
  }

  const customersById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehiclesById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const technicianNamesById = new Map(
    techniciansResult.data.map((technician) => [technician.userId, technician.displayName])
  );
  const mappedScheduledJobs = scheduledRows.map((row) =>
    mapDispatchBoardJobItem(row, customersById, vehiclesById, technicianNamesById)
  );
  const mappedUnscheduledJobs = unscheduledRows.map((row) =>
    mapDispatchBoardJobItem(row, customersById, vehiclesById, technicianNamesById)
  );
  const laneScheduledJobs = mappedScheduledJobs.filter(
    (job) => job.assignedTechnicianUserId && selectedResourceIds.has(job.assignedTechnicianUserId)
  );
  const unassignedScheduledJobs = mappedScheduledJobs.filter((job) => !job.assignedTechnicianUserId);
  const backlogJobs = mappedUnscheduledJobs.filter(
    (job) => !job.assignedTechnicianUserId || selectedResourceIds.has(job.assignedTechnicianUserId)
  );
  const trackPlacement = applyDispatchTrackPlacement({
    availability: availabilityBlocks,
    jobs: laneScheduledJobs,
    settings,
    technicianNamesById,
    timeZone
  });
  const conflicts = detectDispatchConflicts({
    availability: trackPlacement.availability,
    backlogJobs,
    jobs: trackPlacement.jobs,
    settings,
    timeZone
  });
  const calendarJobs = applyConflictFlags({
    availability: trackPlacement.availability,
    conflicts,
    jobs: trackPlacement.jobs,
    settings,
    timeZone
  });
  const jobsByResource = new Map<string, DispatchCalendarJobEvent[]>();

  for (const job of calendarJobs) {
    const key = job.resourceTechnicianUserId ?? "unassigned";
    const current = jobsByResource.get(key) ?? [];
    current.push(job);
    jobsByResource.set(key, current);
  }

  const availabilityByResource = new Map<string, TechnicianAvailabilityBlock[]>();

  for (const block of availabilityBlocks) {
    const current = availabilityByResource.get(block.technicianUserId) ?? [];
    current.push(block);
    availabilityByResource.set(block.technicianUserId, current);
  }

  const resourceConflictCounts = new Map<string, number>();

  for (const conflict of conflicts) {
    if (!conflict.technicianUserId) {
      continue;
    }

    resourceConflictCounts.set(
      conflict.technicianUserId,
      (resourceConflictCounts.get(conflict.technicianUserId) ?? 0) + 1
    );
  }

  const calendarResources: DispatchCalendarResource[] = resources.map((resource) => {
    const laneJobs = jobsByResource.get(resource.userId) ?? [];
    const laneBlocks = availabilityByResource.get(resource.userId) ?? [];
    const laneLoad = summarizeLaneLoad(laneJobs);
    const preference =
      preferencesResult.data?.find((item) => item.technicianUserId === resource.userId) ?? null;

    return {
      technicianUserId: resource.userId,
      displayName: resource.displayName,
      email: resource.email,
      role: resource.role,
      laneOrder: preference?.laneOrder ?? 0,
      laneColor: preference?.laneColor ?? null,
      isVisibleByDefault: preference?.isVisibleByDefault ?? true,
      scheduledCount: laneLoad.scheduledCount,
      backlogCount: backlogJobs.filter((job) => job.assignedTechnicianUserId === resource.userId).length,
      availabilityBlockCount: laneBlocks.length,
      conflictCount: resourceConflictCounts.get(resource.userId) ?? 0,
      scheduledMinutes: laneLoad.scheduledMinutes
    };
  });

  const calendar: DispatchCalendarData = {
    query: {
      ...parsed,
      view: parsed.view ?? settings.defaultView,
      scope: parsed.scope ?? "all_workers",
      includeUnassigned: parsed.includeUnassigned ?? true,
      resourceUserIds: parsed.resourceUserIds ?? []
    },
    settings,
    timezone: timeZone,
    range,
    slots: buildDispatchTimeSlots({
      date: range.visibleDays[0]?.date ?? parsed.date,
      settings,
      timeZone
    }),
    resources: calendarResources,
    jobs: calendarJobs,
    availability: trackPlacement.availability,
    conflicts,
    unassignedScheduledJobs,
    backlogJobs
  };

  return {
    error: null,
    data: {
      calendar,
      technicians: techniciansResult.data,
      preferences: preferencesResult.data ?? [],
      savedViewMembers: savedViewMembersResult.data ?? []
    }
  };
}

export async function moveDispatchJob(
  client: AppSupabaseClient,
  companyId: string,
  input: MoveDispatchJobInput
) {
  const parsed = moveDispatchJobInputSchema.parse(input);
  const [jobResult, timeZone] = await Promise.all([
    getJobById(client, parsed.jobId),
    getCompanyTimeZone(client, companyId)
  ]);

  if (jobResult.error || !jobResult.data) {
    return {
      error: jobResult.error ?? new Error("Job not found."),
      data: null
    };
  }

  if (jobResult.data.companyId !== companyId || !jobResult.data.isActive) {
    throw new Error("Job is not available for dispatch scheduling.");
  }

  const nextStatus = jobResult.data.status === "new" ? "scheduled" : jobResult.data.status;
  const result = await client
    .from("jobs")
    .update({
      assigned_technician_user_id: parsed.assignedTechnicianUserId ?? null,
      scheduled_start_at: normalizeRequiredDispatchDateTimeInput(parsed.scheduledStartAt, timeZone),
      scheduled_end_at: normalizeDispatchDateTimeInput(parsed.scheduledEndAt, timeZone),
      arrival_window_start_at: normalizeDispatchDateTimeInput(
        parsed.arrivalWindowStartAt,
        timeZone
      ),
      arrival_window_end_at: normalizeDispatchDateTimeInput(parsed.arrivalWindowEndAt, timeZone),
      status: nextStatus
    })
    .eq("id", parsed.jobId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}

export async function resizeDispatchJob(
  client: AppSupabaseClient,
  companyId: string,
  input: ResizeDispatchJobInput
) {
  const parsed = resizeDispatchJobInputSchema.parse(input);
  const [jobResult, timeZone] = await Promise.all([
    getJobById(client, parsed.jobId),
    getCompanyTimeZone(client, companyId)
  ]);

  if (jobResult.error || !jobResult.data) {
    return {
      error: jobResult.error ?? new Error("Job not found."),
      data: null
    };
  }

  const scheduledStartAt = jobResult.data.scheduledStartAt;

  if (!scheduledStartAt) {
    throw new Error("Only scheduled jobs can be resized on the dispatch calendar.");
  }

  const nextScheduledEndAt = normalizeRequiredDispatchDateTimeInput(parsed.scheduledEndAt, timeZone);

  if (new Date(nextScheduledEndAt).getTime() <= new Date(scheduledStartAt).getTime()) {
    throw new Error("Scheduled end must be after scheduled start.");
  }

  const result = await client
    .from("jobs")
    .update({
      scheduled_end_at: nextScheduledEndAt,
      arrival_window_start_at: normalizeDispatchDateTimeInput(
        parsed.arrivalWindowStartAt,
        timeZone
      ),
      arrival_window_end_at: normalizeDispatchDateTimeInput(parsed.arrivalWindowEndAt, timeZone)
    })
    .eq("id", parsed.jobId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}

export async function quickEditDispatchJob(
  client: AppSupabaseClient,
  companyId: string,
  input: QuickEditDispatchJobInput
) {
  const parsed = quickEditDispatchJobInputSchema.parse(input);
  const [jobResult, timeZone] = await Promise.all([
    getJobById(client, parsed.jobId),
    getCompanyTimeZone(client, companyId)
  ]);

  if (jobResult.error || !jobResult.data) {
    return {
      error: jobResult.error ?? new Error("Job not found."),
      data: null
    };
  }

  if (jobResult.data.companyId !== companyId || !jobResult.data.isActive) {
    throw new Error("Job is not available for dispatch editing.");
  }

  const nextScheduledStartAt =
    parsed.scheduledStartAt === undefined
      ? jobResult.data.scheduledStartAt
      : normalizeDispatchDateTimeInput(parsed.scheduledStartAt, timeZone);
  const nextScheduledEndAt =
    parsed.scheduledEndAt === undefined
      ? jobResult.data.scheduledEndAt
      : normalizeDispatchDateTimeInput(parsed.scheduledEndAt, timeZone);
  const nextStatus =
    parsed.status ??
    (jobResult.data.status === "new" && nextScheduledStartAt ? "scheduled" : jobResult.data.status);

  const result = await client
    .from("jobs")
    .update({
      assigned_technician_user_id:
        parsed.assignedTechnicianUserId === undefined
          ? jobResult.data.assignedTechnicianUserId
          : parsed.assignedTechnicianUserId,
      scheduled_start_at: nextScheduledStartAt,
      scheduled_end_at: nextScheduledEndAt,
      arrival_window_start_at:
        parsed.arrivalWindowStartAt === undefined
          ? jobResult.data.arrivalWindowStartAt
          : normalizeDispatchDateTimeInput(parsed.arrivalWindowStartAt, timeZone),
      arrival_window_end_at:
        parsed.arrivalWindowEndAt === undefined
          ? jobResult.data.arrivalWindowEndAt
          : normalizeDispatchDateTimeInput(parsed.arrivalWindowEndAt, timeZone),
      status: nextStatus,
      priority: parsed.priority ?? jobResult.data.priority
    })
    .eq("id", parsed.jobId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ?? null
  };
}
