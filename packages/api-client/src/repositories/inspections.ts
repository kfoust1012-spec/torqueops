import {
  buildInspectionTemplateItemPayloads,
  canCompleteInspection,
  getInspectionTemplateByVersion,
  getInspectionSummary,
  groupInspectionItemsBySection,
  normalizeInspectionItemInput,
  resolveInspectionTemplateVersion
} from "@mobile-mechanic/core";
import type {
  CreateInspectionInput,
  Database,
  Inspection,
  InspectionDetail,
  InspectionItem,
  InspectionSummary,
  UpdateInspectionItemInput,
  UpdateInspectionStatusInput
} from "@mobile-mechanic/types";
import {
  createInspectionInputSchema,
  updateInspectionItemInputSchema,
  updateInspectionStatusInputSchema
} from "@mobile-mechanic/validation";

import { getCustomerById } from "./customers";
import { getJobById } from "./jobs";
import { getVehicleById } from "./vehicles";
import type { AppSupabaseClient } from "../supabase/types";

type InspectionRow = Database["public"]["Tables"]["inspections"]["Row"];
type InspectionItemRow = Database["public"]["Tables"]["inspection_items"]["Row"];

function mapInspectionRow(row: InspectionRow): Inspection {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    status: row.status,
    templateVersion: row.template_version,
    startedByUserId: row.started_by_user_id,
    completedByUserId: row.completed_by_user_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInspectionItemRow(row: InspectionItemRow): InspectionItem {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    companyId: row.company_id,
    jobId: row.job_id,
    sectionKey: row.section_key,
    itemKey: row.item_key,
    label: row.label,
    position: row.position,
    status: row.status,
    findingSeverity: row.finding_severity,
    technicianNotes: row.technician_notes,
    recommendation: row.recommendation,
    isRequired: row.is_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getInspectionItemById(client: AppSupabaseClient, inspectionItemId: string) {
  const result = await client
    .from("inspection_items")
    .select("*")
    .eq("id", inspectionItemId)
    .single<InspectionItemRow>();

  return {
    ...result,
    data: result.data ? mapInspectionItemRow(result.data) : null
  };
}

export async function createInspectionForJob(client: AppSupabaseClient, input: CreateInspectionInput) {
  const parsed = createInspectionInputSchema.parse(input);
  const template = resolveInspectionTemplateVersion(parsed.templateVersion);
  const existingInspectionResult = await getInspectionByJobId(client, parsed.jobId);

  if (existingInspectionResult.error) {
    throw existingInspectionResult.error;
  }

  if (existingInspectionResult.data) {
    return existingInspectionResult;
  }

  const items = buildInspectionTemplateItemPayloads(parsed.companyId, parsed.jobId, template);
  const rpcResult = await client.rpc("create_inspection_for_job", {
    target_company_id: parsed.companyId,
    target_job_id: parsed.jobId,
    target_template_version: template.version,
    target_started_by_user_id: parsed.startedByUserId,
    target_items: items
  });

  if (rpcResult.error || !rpcResult.data) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getInspectionById(client, rpcResult.data);
}

export async function getInspectionById(client: AppSupabaseClient, inspectionId: string) {
  const result = await client
    .from("inspections")
    .select("*")
    .eq("id", inspectionId)
    .single<InspectionRow>();

  return {
    ...result,
    data: result.data ? mapInspectionRow(result.data) : null
  };
}

export async function getInspectionByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("inspections")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle<InspectionRow>();

  return {
    ...result,
    data: result.data ? mapInspectionRow(result.data) : null
  };
}

export async function listInspectionItems(client: AppSupabaseClient, inspectionId: string) {
  const result = await client
    .from("inspection_items")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("section_key", { ascending: true })
    .order("position", { ascending: true })
    .returns<InspectionItemRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInspectionItemRow) : null
  };
}

export async function getInspectionDetailById(client: AppSupabaseClient, inspectionId: string) {
  const inspectionResult = await getInspectionById(client, inspectionId);

  if (inspectionResult.error || !inspectionResult.data) {
    return {
      ...inspectionResult,
      data: null
    };
  }

  const [jobResult, itemsResult] = await Promise.all([
    getJobById(client, inspectionResult.data.jobId),
    listInspectionItems(client, inspectionId)
  ]);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Job not found.");
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const [customerResult, vehicleResult] = await Promise.all([
    getCustomerById(client, jobResult.data.customerId),
    getVehicleById(client, jobResult.data.vehicleId)
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  const template = getInspectionTemplateByVersion(inspectionResult.data.templateVersion);

  return {
    error: null,
    data: {
      inspection: inspectionResult.data,
      job: jobResult.data,
      customer: customerResult.data,
      vehicle: vehicleResult.data,
      sections: groupInspectionItemsBySection(itemsResult.data ?? [], template)
    } satisfies InspectionDetail
  };
}

export async function updateInspectionItem(
  client: AppSupabaseClient,
  inspectionItemId: string,
  input: UpdateInspectionItemInput
) {
  const parsed = updateInspectionItemInputSchema.parse(input);
  const normalized = normalizeInspectionItemInput(parsed);

  const result = await client
    .from("inspection_items")
    .update({
      status: normalized.status,
      finding_severity: normalized.findingSeverity ?? null,
      technician_notes: normalized.technicianNotes ?? null,
      recommendation: normalized.recommendation ?? null
    })
    .eq("id", inspectionItemId)
    .select("*")
    .single<InspectionItemRow>();

  return {
    ...result,
    data: result.data ? mapInspectionItemRow(result.data) : null
  };
}

export async function updateInspectionStatus(
  client: AppSupabaseClient,
  inspectionId: string,
  input: UpdateInspectionStatusInput
) {
  const parsed = updateInspectionStatusInputSchema.parse(input);

  const result = await client
    .from("inspections")
    .update({ status: parsed.status })
    .eq("id", inspectionId)
    .select("*")
    .single<InspectionRow>();

  return {
    ...result,
    data: result.data ? mapInspectionRow(result.data) : null
  };
}

export async function completeInspection(
  client: AppSupabaseClient,
  inspectionId: string,
  completedByUserId: string
) {
  const [inspectionResult, itemsResult] = await Promise.all([
    getInspectionById(client, inspectionId),
    listInspectionItems(client, inspectionId)
  ]);

  if (inspectionResult.error || !inspectionResult.data) {
    return {
      ...inspectionResult,
      data: null
    };
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (!canCompleteInspection(itemsResult.data ?? [])) {
    throw new Error("All required inspection items must be checked before completion.");
  }

  const result = await client
    .from("inspections")
    .update({
      status: "completed",
      completed_by_user_id: completedByUserId
    })
    .eq("id", inspectionId)
    .select("*")
    .single<InspectionRow>();

  return {
    ...result,
    data: result.data ? mapInspectionRow(result.data) : null
  };
}

export async function getInspectionSummaryByJobId(client: AppSupabaseClient, jobId: string) {
  const inspectionResult = await getInspectionByJobId(client, jobId);

  if (inspectionResult.error || !inspectionResult.data) {
    return {
      ...inspectionResult,
      data: null
    };
  }

  const itemsResult = await listInspectionItems(client, inspectionResult.data.id);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  return {
    error: null,
    data: getInspectionSummary(
      inspectionResult.data.id,
      inspectionResult.data.jobId,
      inspectionResult.data.status,
      inspectionResult.data.completedAt,
      itemsResult.data ?? []
    )
  };
}

export async function getAssignedJobInspectionDetail(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const assignedJobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<Database["public"]["Tables"]["jobs"]["Row"]>();

  if (assignedJobResult.error || !assignedJobResult.data) {
    return {
      ...assignedJobResult,
      data: null
    };
  }

  const inspectionResult = await getInspectionByJobId(client, jobId);

  if (inspectionResult.error || !inspectionResult.data) {
    return {
      ...inspectionResult,
      data: null
    };
  }

  return getInspectionDetailById(client, inspectionResult.data.id);
}

export async function createInspectionForAssignedJob(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const assignedJobResult = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .eq("assigned_technician_user_id", technicianUserId)
    .eq("is_active", true)
    .single<Database["public"]["Tables"]["jobs"]["Row"]>();

  if (assignedJobResult.error || !assignedJobResult.data) {
    return {
      ...assignedJobResult,
      data: null
    };
  }

  const inspectionResult = await createInspectionForJob(client, {
    companyId,
    jobId,
    startedByUserId: technicianUserId,
    templateVersion: "v1"
  });

  if (inspectionResult.error || !inspectionResult.data) {
    return inspectionResult;
  }

  return getInspectionDetailById(client, inspectionResult.data.id);
}

export async function updateAssignedInspectionItem(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  inspectionItemId: string,
  input: UpdateInspectionItemInput
) {
  const parsed = updateInspectionItemInputSchema.parse(input);
  const normalized = normalizeInspectionItemInput(parsed);

  const itemResult = await getInspectionItemById(client, inspectionItemId);

  if (itemResult.error || !itemResult.data) {
    return {
      ...itemResult,
      data: null
    };
  }

  if (itemResult.data.companyId !== companyId) {
    throw new Error("Inspection item does not belong to the active company.");
  }

  const rpcArgs: Database["public"]["Functions"]["update_assigned_inspection_item"]["Args"] = {
    target_inspection_item_id: inspectionItemId,
    next_status: normalized.status,
    ...(normalized.findingSeverity ? { next_finding_severity: normalized.findingSeverity } : {}),
    ...(normalized.technicianNotes ? { next_technician_notes: normalized.technicianNotes } : {}),
    ...(normalized.recommendation ? { next_recommendation: normalized.recommendation } : {})
  };

  const rpcResult = await client.rpc("update_assigned_inspection_item", rpcArgs);

  if (rpcResult.error) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getInspectionItemById(client, inspectionItemId);
}

export async function completeAssignedInspection(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  inspectionId: string
) {
  const inspectionResult = await getInspectionById(client, inspectionId);

  if (inspectionResult.error || !inspectionResult.data) {
    return {
      ...inspectionResult,
      data: null
    };
  }

  if (inspectionResult.data.companyId !== companyId) {
    throw new Error("Inspection does not belong to the active company.");
  }

  const rpcResult = await client.rpc("complete_assigned_inspection", {
    target_inspection_id: inspectionId
  });

  if (rpcResult.error) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getInspectionById(client, inspectionId);
}
