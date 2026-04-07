import {
  canAccessTechnicianWorkflow,
  canTechnicianTransitionJobStatus,
  canTransitionJobStatus,
  getCustomerDisplayName,
  getDispatchLocalDate,
  getInitialJobStatus,
  isTechnicianLiveJobStatus,
  isTechnicianUpcomingJobStatus,
  getSafeTimeZone,
  getVehicleDisplayName,
  normalizeJobInput,
  normalizeJobNoteInput
} from "@mobile-mechanic/core";
import type {
  AssignJobTechnicianInput,
  AssignableTechnicianOption,
  ChangeJobStatusInput,
  CreateJobInput,
  CreateJobNoteInput,
  CustomerAddress,
  Database,
  Job,
  JobListItem,
  JobListQuery,
  JobNote,
  JobStatusHistoryEntry,
  TechnicianJobDetail,
  TechnicianJobListItem,
  TechnicianJobListQuery,
  TechnicianJobSummary,
  UpdateJobInput,
  UpdateJobNoteInput
} from "@mobile-mechanic/types";
import {
  assignJobTechnicianInputSchema,
  changeAssignedJobStatusInputSchema,
  changeJobStatusInputSchema,
  createJobInputSchema,
  createJobNoteInputSchema,
  jobListQuerySchema,
  technicianJobListQuerySchema,
  updateJobInputSchema,
  updateJobNoteInputSchema
} from "@mobile-mechanic/validation";

import { getCompanyById, listMembershipsByCompany } from "./companies";
import { listProfilesByIds } from "./profiles";
import type { AppSupabaseClient } from "../supabase/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type CustomerAddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];
type JobNoteRow = Database["public"]["Tables"]["job_notes"]["Row"];
type JobStatusHistoryRow = Database["public"]["Tables"]["job_status_history"]["Row"];

function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    vehicleId: row.vehicle_id,
    serviceSiteId: row.service_site_id,
    status: row.status,
    title: row.title,
    description: row.description,
    customerConcern: row.customer_concern,
    internalSummary: row.internal_summary,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    arrivalWindowStartAt: row.arrival_window_start_at,
    arrivalWindowEndAt: row.arrival_window_end_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    assignedTechnicianUserId: row.assigned_technician_user_id,
    priority: row.priority as Job["priority"],
    source: row.source as Job["source"],
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCustomerRow(row: CustomerRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    relationshipType: row.relationship_type,
    companyName: row.company_name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVehicleRow(row: VehicleRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    ownershipType: row.ownership_type,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    engine: row.engine,
    licensePlate: row.license_plate,
    licenseState: row.license_state,
    vin: row.vin,
    color: row.color,
    odometer: row.odometer,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCustomerAddressRow(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    label: row.label as CustomerAddress["label"],
    siteName: row.site_name,
    serviceContactName: row.service_contact_name,
    serviceContactPhone: row.service_contact_phone,
    accessWindowNotes: row.access_window_notes,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    gateCode: row.gate_code,
    parkingNotes: row.parking_notes,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJobNoteRow(row: JobNoteRow): JobNote {
  return {
    id: row.id,
    jobId: row.job_id,
    companyId: row.company_id,
    authorUserId: row.author_user_id,
    body: row.body,
    isInternal: row.is_internal,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJobStatusHistoryRow(row: JobStatusHistoryRow): JobStatusHistoryEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    companyId: row.company_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByUserId: row.changed_by_user_id,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function mapJobListItem(
  row: JobRow,
  customersById: Map<string, CustomerRow>,
  vehiclesById: Map<string, VehicleRow>,
  technicianNamesById: Map<string, string>
): JobListItem {
  const customer = customersById.get(row.customer_id);
  const vehicle = vehiclesById.get(row.vehicle_id);

  return {
    id: row.id,
    status: row.status,
    title: row.title,
    customerDisplayName: customer
      ? getCustomerDisplayName({
          companyName: customer.company_name,
          firstName: customer.first_name,
          lastName: customer.last_name,
          relationshipType: customer.relationship_type
        })
      : "Unknown customer",
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
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
    arrivalWindowStartAt: row.arrival_window_start_at,
    priority: row.priority as JobListItem["priority"],
    isActive: row.is_active
  };
}

function formatAddressSummary(address: CustomerAddressRow | undefined): string | null {
  if (!address) {
    return null;
  }

  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postal_code}`]
    .filter(Boolean)
    .join(", ");
}

function formatServiceSiteSummary(address: CustomerAddressRow | undefined): string | null {
  if (!address) {
    return null;
  }

  return [address.site_name, formatAddressSummary(address)].filter(Boolean).join(" · ");
}

function pickPrimaryAddress(addresses: CustomerAddressRow[]): CustomerAddressRow | undefined {
  return addresses.find((address) => address.is_primary) ?? addresses[0];
}

export function buildTechnicianDashboardSummary(
  jobs: Array<Pick<JobRow, "scheduled_start_at" | "status">>,
  timeZone: string,
  now: Date = new Date()
): TechnicianJobSummary {
  const today = getDispatchLocalDate(now, getSafeTimeZone(timeZone));

  return {
    assignedTodayCount: jobs.filter(
      (job) => job.scheduled_start_at && getDispatchLocalDate(job.scheduled_start_at, timeZone) === today
    ).length,
    inProgressCount: jobs.filter((job) => isTechnicianLiveJobStatus(job.status)).length,
    upcomingCount: jobs.filter((job) => isTechnicianUpcomingJobStatus(job.status)).length
  };
}

function mapTechnicianJobListItem(
  row: JobRow,
  customersById: Map<string, CustomerRow>,
  vehiclesById: Map<string, VehicleRow>,
  serviceSitesByJobId: Map<string, CustomerAddressRow | undefined>,
  primaryAddressesByCustomerId: Map<string, CustomerAddressRow | undefined>
): TechnicianJobListItem {
  const customer = customersById.get(row.customer_id);
  const vehicle = vehiclesById.get(row.vehicle_id);
  const serviceSite = serviceSitesByJobId.get(row.id);
  const primaryAddress = primaryAddressesByCustomerId.get(row.customer_id);

  return {
    id: row.id,
    status: row.status,
    title: row.title,
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
    scheduledStartAt: row.scheduled_start_at,
    arrivalWindowStartAt: row.arrival_window_start_at,
    arrivalWindowEndAt: row.arrival_window_end_at,
    priority: row.priority as TechnicianJobListItem["priority"],
    customerPhone: customer?.phone ?? null,
    addressSummary: formatAddressSummary(serviceSite),
    serviceSiteSummary: formatServiceSiteSummary(serviceSite),
    ...(customer && vehicle
      ? {
          stopSeed: {
            customer: mapCustomerRow(customer),
            job: mapJobRow(row),
            primaryAddress: primaryAddress ? mapCustomerAddressRow(primaryAddress) : null,
            serviceSite: serviceSite ? mapCustomerAddressRow(serviceSite) : null,
            vehicle: mapVehicleRow(vehicle)
          }
        }
      : {}),
    isActive: row.is_active
  };
}

const technicianQueueStatusOrder: Record<TechnicianJobListItem["status"], number> = {
  ready_for_payment: 0,
  repairing: 1,
  diagnosing: 2,
  arrived: 3,
  en_route: 4,
  waiting_approval: 5,
  waiting_parts: 6,
  dispatched: 7,
  scheduled: 8,
  new: 9,
  in_progress: 10,
  completed: 98,
  canceled: 99
};

const technicianQueuePriorityOrder: Record<TechnicianJobListItem["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3
};

function getTechnicianQueueTimeValue(job: TechnicianJobListItem) {
  const candidate = job.arrivalWindowStartAt ?? job.scheduledStartAt;

  if (!candidate) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(candidate).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function compareTechnicianQueueJobs(left: TechnicianJobListItem, right: TechnicianJobListItem) {
  const statusDelta =
    technicianQueueStatusOrder[left.status] - technicianQueueStatusOrder[right.status];

  if (statusDelta !== 0) {
    return statusDelta;
  }

  const timeDelta = getTechnicianQueueTimeValue(left) - getTechnicianQueueTimeValue(right);

  if (timeDelta !== 0) {
    return timeDelta;
  }

  const priorityDelta =
    technicianQueuePriorityOrder[left.priority] - technicianQueuePriorityOrder[right.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.title.localeCompare(right.title);
}

async function listAssignedJobRowsForTechnician(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  query: TechnicianJobListQuery = {}
) {
  const parsed = technicianJobListQuerySchema.parse(query);
  let builder = client
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .order("status", { ascending: true })
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.dateFrom) {
    builder = builder.gte("scheduled_start_at", new Date(parsed.dateFrom).toISOString());
  }

  if (parsed.dateTo) {
    builder = builder.lte("scheduled_start_at", new Date(parsed.dateTo).toISOString());
  }

  return builder.returns<JobRow[]>();
}

export async function createJob(client: AppSupabaseClient, input: CreateJobInput) {
  const parsed = createJobInputSchema.parse(input);
  const normalized = normalizeJobInput(parsed);
  const status = getInitialJobStatus(parsed);

  const result = await client
    .from("jobs")
    .insert({
      company_id: normalized.companyId,
      customer_id: normalized.customerId,
      vehicle_id: normalized.vehicleId,
      service_site_id: normalized.serviceSiteId,
      status,
      title: normalized.title,
      description: normalized.description,
      customer_concern: normalized.customerConcern,
      internal_summary: normalized.internalSummary,
      scheduled_start_at: normalized.scheduledStartAt,
      scheduled_end_at: normalized.scheduledEndAt,
      arrival_window_start_at: normalized.arrivalWindowStartAt,
      arrival_window_end_at: normalized.arrivalWindowEndAt,
      assigned_technician_user_id: normalized.assignedTechnicianUserId,
      priority: normalized.priority ?? "normal",
      source: normalized.source ?? "office",
      is_active: normalized.isActive ?? true,
      created_by_user_id: normalized.createdByUserId
    })
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ? mapJobRow(result.data) : null
  };
}

export async function updateJob(client: AppSupabaseClient, jobId: string, input: UpdateJobInput) {
  const parsed = updateJobInputSchema.parse(input);
  const normalized = normalizeJobInput(parsed);

  const result = await client
    .from("jobs")
    .update({
      customer_id: normalized.customerId,
      vehicle_id: normalized.vehicleId,
      service_site_id: normalized.serviceSiteId,
      title: normalized.title,
      description: normalized.description,
      customer_concern: normalized.customerConcern,
      internal_summary: normalized.internalSummary,
      scheduled_start_at: normalized.scheduledStartAt,
      scheduled_end_at: normalized.scheduledEndAt,
      arrival_window_start_at: normalized.arrivalWindowStartAt,
      arrival_window_end_at: normalized.arrivalWindowEndAt,
      assigned_technician_user_id: normalized.assignedTechnicianUserId,
      priority: normalized.priority ?? "normal",
      source: normalized.source ?? "office",
      is_active: normalized.isActive ?? true
    })
    .eq("id", jobId)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ? mapJobRow(result.data) : null
  };
}

export async function getJobById(client: AppSupabaseClient, jobId: string) {
  const result = await client.from("jobs").select("*").eq("id", jobId).single<JobRow>();

  return {
    ...result,
    data: result.data ? mapJobRow(result.data) : null
  };
}

export async function listJobsByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: JobListQuery = {}
) {
  const parsed = jobListQuerySchema.parse(query);
  let builder = client
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!parsed.includeInactive) {
    builder = builder.eq("is_active", true);
  }

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.assignedTechnicianUserId) {
    builder = builder.eq("assigned_technician_user_id", parsed.assignedTechnicianUserId);
  }

  if (parsed.dateFrom) {
    builder = builder.gte("scheduled_start_at", new Date(parsed.dateFrom).toISOString());
  }

  if (parsed.dateTo) {
    builder = builder.lte("scheduled_start_at", new Date(parsed.dateTo).toISOString());
  }

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    builder = builder.or(
      `title.ilike.${search},description.ilike.${search},customer_concern.ilike.${search},internal_summary.ilike.${search}`
    );
  }

  const result = await builder.returns<JobRow[]>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  const customerIds = [...new Set(result.data.map((job) => job.customer_id))];
  const vehicleIds = [...new Set(result.data.map((job) => job.vehicle_id))];
  const technicianIds = [
    ...new Set(
      result.data
        .map((job) => job.assigned_technician_user_id)
        .filter((userId): userId is string => Boolean(userId))
    )
  ];

  const [customersResult, vehiclesResult, profilesResult] = await Promise.all([
    customerIds.length
      ? client.from("customers").select("*").in("id", customerIds).returns<CustomerRow[]>()
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length
      ? client.from("vehicles").select("*").in("id", vehicleIds).returns<VehicleRow[]>()
      : Promise.resolve({ data: [] as VehicleRow[], error: null }),
    technicianIds.length
      ? listProfilesByIds(client, technicianIds)
      : Promise.resolve({
          data: [] as Database["public"]["Tables"]["profiles"]["Row"][],
          error: null
        })
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const customersById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehiclesById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const technicianNamesById = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name ?? profile.email ?? profile.id
    ])
  );

  return {
    ...result,
    data: result.data.map((row) =>
      mapJobListItem(row, customersById, vehiclesById, technicianNamesById)
    )
  };
}

export async function archiveJob(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("jobs")
    .update({ is_active: false })
    .eq("id", jobId)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ? mapJobRow(result.data) : null
  };
}

export async function changeJobStatus(
  client: AppSupabaseClient,
  jobId: string,
  input: ChangeJobStatusInput
) {
  const parsed = changeJobStatusInputSchema.parse(input);
  const currentJobResult = await getJobById(client, jobId);

  if (currentJobResult.error || !currentJobResult.data) {
    return currentJobResult;
  }

  if (!canTransitionJobStatus(currentJobResult.data.status, parsed.toStatus)) {
    throw new Error(
      `Invalid status transition from ${currentJobResult.data.status} to ${parsed.toStatus}.`
    );
  }

  const rpcArgs: Database["public"]["Functions"]["change_job_status"]["Args"] = {
    target_job_id: jobId,
    next_status: parsed.toStatus,
    ...(parsed.reason ? { change_reason: parsed.reason } : {})
  };

  const rpcResult = await client.rpc("change_job_status", rpcArgs);

  if (rpcResult.error) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getJobById(client, jobId);
}

export async function listJobStatusHistory(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("job_status_history")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<JobStatusHistoryRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapJobStatusHistoryRow) : null
  };
}

export async function createJobNote(client: AppSupabaseClient, input: CreateJobNoteInput) {
  const parsed = createJobNoteInputSchema.parse(input);
  const normalized = normalizeJobNoteInput(parsed);

  const result = await client
    .from("job_notes")
    .insert({
      job_id: normalized.jobId,
      company_id: normalized.companyId,
      author_user_id: normalized.authorUserId,
      body: normalized.body,
      is_internal: normalized.isInternal ?? true
    })
    .select("*")
    .single<JobNoteRow>();

  return {
    ...result,
    data: result.data ? mapJobNoteRow(result.data) : null
  };
}

export async function updateJobNote(
  client: AppSupabaseClient,
  noteId: string,
  input: UpdateJobNoteInput
) {
  const parsed = updateJobNoteInputSchema.parse(input);
  const normalized = normalizeJobNoteInput(parsed);
  const updates: Database["public"]["Tables"]["job_notes"]["Update"] = {
    body: normalized.body
  };

  if (normalized.isInternal !== undefined) {
    updates.is_internal = normalized.isInternal;
  }

  const result = await client
    .from("job_notes")
    .update(updates)
    .eq("id", noteId)
    .select("*")
    .single<JobNoteRow>();

  return {
    ...result,
    data: result.data ? mapJobNoteRow(result.data) : null
  };
}

export async function deleteJobNote(client: AppSupabaseClient, noteId: string) {
  return client.from("job_notes").delete().eq("id", noteId);
}

export async function listJobNotesByJob(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<JobNoteRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapJobNoteRow) : null
  };
}

export async function assignJobTechnician(
  client: AppSupabaseClient,
  jobId: string,
  input: AssignJobTechnicianInput
) {
  const parsed = assignJobTechnicianInputSchema.parse(input);

  const result = await client
    .from("jobs")
    .update({ assigned_technician_user_id: parsed.assignedTechnicianUserId ?? null })
    .eq("id", jobId)
    .select("*")
    .single<JobRow>();

  return {
    ...result,
    data: result.data ? mapJobRow(result.data) : null
  };
}

export async function clearJobTechnician(client: AppSupabaseClient, jobId: string) {
  return assignJobTechnician(client, jobId, {
    assignedTechnicianUserId: null
  });
}

export async function listAssignableTechniciansByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const membershipsResult = await listMembershipsByCompany(client, companyId);

  if (membershipsResult.error || !membershipsResult.data) {
    return {
      ...membershipsResult,
      data: null
    };
  }

  const memberships = membershipsResult.data.filter(
    (membership) => membership.is_active && canAccessTechnicianWorkflow(membership.role)
  );
  const userIds = [...new Set(memberships.map((membership) => membership.user_id))];
  const profilesResult = userIds.length
    ? await listProfilesByIds(client, userIds)
    : {
        data: [] as Database["public"]["Tables"]["profiles"]["Row"][],
        error: null
      };

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

  return {
    error: null,
    data: memberships
      .map<AssignableTechnicianOption>((membership) => {
        const profile = profilesById.get(membership.user_id);

        return {
          userId: membership.user_id,
          displayName:
            profile?.full_name?.trim() ||
            profile?.email?.trim() ||
            `Technician ${membership.user_id.slice(0, 6)}`,
          email: profile?.email ?? null,
          role: membership.role
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  };
}

export async function listAssignedJobsForTechnician(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  query: TechnicianJobListQuery = {}
) {
  const result = await listAssignedJobRowsForTechnician(client, companyId, technicianUserId, query);

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  const customerIds = [...new Set(result.data.map((job) => job.customer_id))];
  const vehicleIds = [...new Set(result.data.map((job) => job.vehicle_id))];
  const serviceSiteIds = [
    ...new Set(
      result.data
        .map((job) => job.service_site_id)
        .filter((serviceSiteId): serviceSiteId is string => Boolean(serviceSiteId))
    )
  ];

  const [customersResult, vehiclesResult, addressesResult] = await Promise.all([
    customerIds.length
      ? client.from("customers").select("*").in("id", customerIds).returns<CustomerRow[]>()
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length
      ? client.from("vehicles").select("*").in("id", vehicleIds).returns<VehicleRow[]>()
      : Promise.resolve({ data: [] as VehicleRow[], error: null }),
    customerIds.length || serviceSiteIds.length
      ? client
          .from("customer_addresses")
          .select("*")
          .or(
            [
              customerIds.length ? `customer_id.in.(${customerIds.join(",")})` : null,
              serviceSiteIds.length ? `id.in.(${serviceSiteIds.join(",")})` : null
            ]
              .filter(Boolean)
              .join(",")
          )
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true })
          .returns<CustomerAddressRow[]>()
      : Promise.resolve({ data: [] as CustomerAddressRow[], error: null })
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  if (addressesResult.error) {
    throw addressesResult.error;
  }

  const customersById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehiclesById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const addressesByCustomerId = new Map<string, CustomerAddressRow[]>();
  const addressesById = new Map<string, CustomerAddressRow>();

  for (const address of addressesResult.data ?? []) {
    const current = addressesByCustomerId.get(address.customer_id) ?? [];
    current.push(address);
    addressesByCustomerId.set(address.customer_id, current);
    addressesById.set(address.id, address);
  }

  const serviceSitesByJobId = new Map<string, CustomerAddressRow | undefined>(
    result.data.map((row) => [
      row.id,
      (row.service_site_id ? addressesById.get(row.service_site_id) : undefined) ??
        pickPrimaryAddress(addressesByCustomerId.get(row.customer_id) ?? [])
    ])
  );
  const primaryAddressesByCustomerId = new Map<string, CustomerAddressRow | undefined>(
    customerIds.map((customerId) => [
      customerId,
      pickPrimaryAddress(addressesByCustomerId.get(customerId) ?? [])
    ])
  );

  return {
    ...result,
    data: result.data
      .map((row) =>
        mapTechnicianJobListItem(
          row,
          customersById,
          vehiclesById,
          serviceSitesByJobId,
          primaryAddressesByCustomerId
        )
      )
      .sort(compareTechnicianQueueJobs)
  };
}

export async function getAssignedJobDetailForTechnician(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const { listJobCommunications } = await import("./communications");
  const jobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<JobRow>();

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  const [customerResult, vehicleResult, addressesResult, serviceSiteResult, notesResult, historyResult, communicationsResult] = await Promise.all([
    client.from("customers").select("*").eq("id", jobResult.data.customer_id).single<CustomerRow>(),
    client.from("vehicles").select("*").eq("id", jobResult.data.vehicle_id).single<VehicleRow>(),
    client
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", jobResult.data.customer_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<CustomerAddressRow[]>(),
    jobResult.data.service_site_id
      ? client
          .from("customer_addresses")
          .select("*")
          .eq("id", jobResult.data.service_site_id)
          .single<CustomerAddressRow>()
      : Promise.resolve({ data: null as CustomerAddressRow | null, error: null }),
    listJobNotesByJob(client, jobId),
    listJobStatusHistory(client, jobId),
    listJobCommunications(client, jobId, { limit: 8 })
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  if (addressesResult.error) {
    throw addressesResult.error;
  }

  if (serviceSiteResult.error) {
    throw serviceSiteResult.error;
  }

  if (notesResult.error) {
    throw notesResult.error;
  }

  if (historyResult.error) {
    throw historyResult.error;
  }

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }

  const primaryAddress = pickPrimaryAddress(addressesResult.data ?? []);
  const serviceSite = serviceSiteResult.data ?? primaryAddress ?? null;

  return {
    error: null,
    data: {
      job: mapJobRow(jobResult.data),
      customer: mapCustomerRow(customerResult.data),
      vehicle: mapVehicleRow(vehicleResult.data),
      serviceSite: serviceSite ? mapCustomerAddressRow(serviceSite) : null,
      primaryAddress: primaryAddress ? mapCustomerAddressRow(primaryAddress) : null,
      communications: communicationsResult.data ?? [],
      notes: notesResult.data ?? [],
      statusHistory: historyResult.data ?? []
    } satisfies TechnicianJobDetail
  };
}

export async function changeAssignedJobStatus(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string,
  input: ChangeJobStatusInput
) {
  const parsed = changeAssignedJobStatusInputSchema.parse(input);
  const currentJobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<JobRow>();

  if (currentJobResult.error || !currentJobResult.data) {
    return {
      ...currentJobResult,
      data: null
    };
  }

  if (!canTechnicianTransitionJobStatus(currentJobResult.data.status, parsed.toStatus)) {
    throw new Error(
      `Assigned technicians cannot move job status from ${currentJobResult.data.status} to ${parsed.toStatus}.`
    );
  }

  const rpcArgs: Database["public"]["Functions"]["change_assigned_job_status"]["Args"] = {
    target_job_id: jobId,
    next_status: parsed.toStatus,
    ...(parsed.reason ? { change_reason: parsed.reason } : {})
  };

  const rpcResult = await client.rpc("change_assigned_job_status", rpcArgs);

  if (rpcResult.error) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getAssignedJobDetailForTechnician(client, companyId, technicianUserId, jobId);
}

export async function createTechnicianJobNote(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  input: Pick<CreateJobNoteInput, "jobId" | "body">
) {
  const jobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", input.jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<JobRow>();

  if (jobResult.error || !jobResult.data) {
    return {
      ...jobResult,
      data: null
    };
  }

  return createJobNote(client, {
    jobId: input.jobId,
    companyId,
    authorUserId: technicianUserId,
    body: input.body,
    isInternal: true
  });
}

export async function getTechnicianDashboardSummary(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string
) {
  const [result, companyResult] = await Promise.all([
    listAssignedJobRowsForTechnician(client, companyId, technicianUserId),
    getCompanyById(client, companyId)
  ]);

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  if (companyResult.error || !companyResult.data) {
    return {
      error: companyResult.error ?? new Error("Company not found."),
      data: null
    };
  }

  const summary = buildTechnicianDashboardSummary(result.data, companyResult.data.timezone);

  return {
    error: null,
    data: summary
  };
}
