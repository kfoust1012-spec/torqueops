import {
  calculateEstimateLineSubtotalCents,
  calculateEstimateTotals,
  canEstimateBeApproved,
  canTransitionEstimateStatus,
  getCustomerDisplayName,
  getVehicleDisplayName,
  normalizeVin,
  normalizeEstimateInput,
  normalizeEstimateLineItemInput
} from "@mobile-mechanic/core";
import type {
  ChangeEstimateStatusInput,
  CreateEstimateInput,
  CreateEstimateLineItemInput,
  CreateEstimateSectionInput,
  Database,
  Estimate,
  EstimateDetail,
  EstimateLineItem,
  EstimateSection,
  EstimateListQuery,
  EstimateSummary,
  MoveEstimateLineItemInput,
  Signature,
  UpdateEstimateInput,
  UpdateEstimateLineItemInput,
  UpdateEstimateSectionInput
} from "@mobile-mechanic/types";
import {
  changeEstimateStatusInputSchema,
  createEstimateInputSchema,
  createEstimateLineItemInputSchema,
  createEstimateSectionInputSchema,
  estimateListQuerySchema,
  moveEstimateLineItemInputSchema,
  updateEstimateInputSchema,
  updateEstimateLineItemInputSchema,
  updateEstimateSectionInputSchema
} from "@mobile-mechanic/validation";

import { getCustomerById } from "./customers";
import { getJobById } from "./jobs";
import { getSignatureByEstimateId } from "./signatures";
import { getVehicleById } from "./vehicles";
import type { AppSupabaseClient } from "../supabase/types";

type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type EstimateLineItemRow = Database["public"]["Tables"]["estimate_line_items"]["Row"];
type EstimateSectionRow = Database["public"]["Tables"]["estimate_sections"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type JobLookupRow = Pick<JobRow, "id">;

function buildEstimateListBaseQuery(
  client: AppSupabaseClient,
  companyId: string,
  status?: EstimateListQuery["status"]
) {
  let builder = client
    .from("estimates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status) {
    builder = builder.eq("status", status);
  }

  return builder;
}

function compareEstimateRows(left: EstimateRow, right: EstimateRow) {
  return right.created_at.localeCompare(left.created_at);
}

function mapEstimateRow(row: EstimateRow): Estimate {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    status: row.status,
    estimateNumber: row.estimate_number,
    title: row.title,
    notes: row.notes,
    terms: row.terms,
    currencyCode: row.currency_code as Estimate["currencyCode"],
    taxRateBasisPoints: row.tax_rate_basis_points,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    voidedAt: row.voided_at,
    approvedSignatureId: row.approved_signature_id,
    approvedByName: row.approved_by_name,
    approvalStatement: row.approval_statement,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEstimateLineItemRow(row: EstimateLineItemRow): EstimateLineItem {
  return {
    actualCostCents: row.actual_cost_cents,
    id: row.id,
    estimateId: row.estimate_id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateSectionId: row.estimate_section_id,
    partRequestLineId: row.part_request_line_id,
    position: row.position,
    itemType: row.item_type as EstimateLineItem["itemType"],
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    lineSubtotalCents: row.line_subtotal_cents,
    estimatedCostCents: row.estimated_cost_cents,
    taxable: row.taxable,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEstimateSectionRow(row: EstimateSectionRow): EstimateSection {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    companyId: row.company_id,
    jobId: row.job_id,
    position: row.position,
    title: row.title,
    description: row.description,
    notes: row.notes,
    source: row.source,
    sourceRef: row.source_ref,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEstimateSummary(
  row: EstimateRow,
  jobsById: Map<string, JobRow>,
  customersById: Map<string, CustomerRow>,
  vehiclesById: Map<string, VehicleRow>
): EstimateSummary {
  const job = jobsById.get(row.job_id);
  const customer = job ? customersById.get(job.customer_id) : undefined;
  const vehicle = job ? vehiclesById.get(job.vehicle_id) : undefined;
  const customerName = customer
    ? getCustomerDisplayName({
        companyName: customer.company_name,
        firstName: customer.first_name,
        lastName: customer.last_name,
        relationshipType: customer.relationship_type
      })
    : null;
  const vehicleLabel = vehicle
    ? getVehicleDisplayName({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model
      })
    : null;

  return {
    estimateId: row.id,
    jobId: row.job_id,
    status: row.status,
    estimateNumber: row.estimate_number,
    title: row.title,
    customerName,
    vehicleLabel,
    totalCents: row.total_cents,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    voidedAt: row.voided_at,
    updatedAt: row.updated_at
  };
}

export async function getEstimateById(client: AppSupabaseClient, estimateId: string) {
  const result = await client
    .from("estimates")
    .select("*")
    .eq("id", estimateId)
    .single<EstimateRow>();

  return {
    ...result,
    data: result.data ? mapEstimateRow(result.data) : null
  };
}

export async function getEstimateByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("estimates")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle<EstimateRow>();

  return {
    ...result,
    data: result.data ? mapEstimateRow(result.data) : null
  };
}

export async function listEstimateLineItems(client: AppSupabaseClient, estimateId: string) {
  const result = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("position", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapEstimateLineItemRow) : null
  };
}

export async function listEstimateSections(client: AppSupabaseClient, estimateId: string) {
  const result = await client
    .from("estimate_sections")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("position", { ascending: true })
    .returns<EstimateSectionRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapEstimateSectionRow) : null
  };
}

export async function recalculateEstimateTotals(client: AppSupabaseClient, estimateId: string) {
  const [estimateResult, lineItemsResult] = await Promise.all([
    getEstimateById(client, estimateId),
    listEstimateLineItems(client, estimateId)
  ]);

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const totals = calculateEstimateTotals({
    lineItems: lineItemsResult.data ?? [],
    discountCents: estimateResult.data.discountCents,
    taxRateBasisPoints: estimateResult.data.taxRateBasisPoints
  });

  const result = await client
    .from("estimates")
    .update({
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents
    })
    .eq("id", estimateId)
    .select("*")
    .single<EstimateRow>();

  return {
    ...result,
    data: result.data ? mapEstimateRow(result.data) : null
  };
}

export async function createEstimate(client: AppSupabaseClient, input: CreateEstimateInput) {
  const parsed = createEstimateInputSchema.parse(input);
  const normalized = normalizeEstimateInput(parsed);
  const existingEstimateResult = await getEstimateByJobId(client, normalized.jobId);

  if (existingEstimateResult.error) {
    throw existingEstimateResult.error;
  }

  if (existingEstimateResult.data) {
    return existingEstimateResult;
  }

  const result = await client
    .from("estimates")
    .insert({
      company_id: normalized.companyId,
      job_id: normalized.jobId,
      status: "draft",
      estimate_number: normalized.estimateNumber,
      title: normalized.title,
      notes: normalized.notes,
      terms: normalized.terms,
      currency_code: "USD",
      tax_rate_basis_points: normalized.taxRateBasisPoints,
      subtotal_cents: 0,
      discount_cents: normalized.discountCents,
      tax_cents: 0,
      total_cents: 0,
      created_by_user_id: normalized.createdByUserId
    })
    .select("*")
    .single<EstimateRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  return recalculateEstimateTotals(client, result.data.id);
}

export async function updateEstimate(
  client: AppSupabaseClient,
  estimateId: string,
  input: UpdateEstimateInput
) {
  const parsed = updateEstimateInputSchema.parse(input);
  const normalized = normalizeEstimateInput(parsed);

  const result = await client
    .from("estimates")
    .update({
      estimate_number: normalized.estimateNumber,
      title: normalized.title,
      notes: normalized.notes,
      terms: normalized.terms,
      tax_rate_basis_points: normalized.taxRateBasisPoints,
      discount_cents: normalized.discountCents
    })
    .eq("id", estimateId)
    .select("*")
    .single<EstimateRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  return recalculateEstimateTotals(client, estimateId);
}

export async function createEstimateLineItem(
  client: AppSupabaseClient,
  estimateId: string,
  input: CreateEstimateLineItemInput
) {
  const parsed = createEstimateLineItemInputSchema.parse(input);
  const normalized = normalizeEstimateLineItemInput(parsed);
  const [estimateResult, lineItemsResult] = await Promise.all([
    getEstimateById(client, estimateId),
    listEstimateLineItems(client, estimateId)
  ]);

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const nextPosition =
    (lineItemsResult.data ?? []).reduce((max, item) => Math.max(max, item.position), -1) + 1;
  const lineSubtotalCents = calculateEstimateLineSubtotalCents(
    normalized.quantity,
    normalized.unitPriceCents
  );

  const result = await client
    .from("estimate_line_items")
    .insert({
      estimate_id: estimateId,
      company_id: estimateResult.data.companyId,
      job_id: estimateResult.data.jobId,
      estimate_section_id: normalized.estimateSectionId ?? null,
      position: nextPosition,
      item_type: normalized.itemType,
      name: normalized.name,
      description: normalized.description,
      quantity: normalized.quantity,
      unit_price_cents: normalized.unitPriceCents,
      line_subtotal_cents: lineSubtotalCents,
      taxable: normalized.taxable
    })
    .select("*")
    .single<EstimateLineItemRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  await recalculateEstimateTotals(client, estimateId);

  return {
    ...result,
    data: mapEstimateLineItemRow(result.data)
  };
}

export async function createEstimateLineItems(
  client: AppSupabaseClient,
  estimateId: string,
  inputs: CreateEstimateLineItemInput[]
) {
  if (!inputs.length) {
    return {
      data: [] as EstimateLineItem[],
      error: null
    };
  }

  const normalizedInputs = inputs.map((input) =>
    normalizeEstimateLineItemInput(createEstimateLineItemInputSchema.parse(input))
  );
  const [estimateResult, lineItemsResult] = await Promise.all([
    getEstimateById(client, estimateId),
    listEstimateLineItems(client, estimateId)
  ]);

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const estimate = estimateResult.data;
  const nextPosition =
    (lineItemsResult.data ?? []).reduce((max, item) => Math.max(max, item.position), -1) + 1;
  const result = await client
    .from("estimate_line_items")
    .insert(
      normalizedInputs.map((input, index) => ({
        estimate_id: estimateId,
        company_id: estimate.companyId,
        job_id: estimate.jobId,
        estimate_section_id: input.estimateSectionId ?? null,
        position: nextPosition + index,
        item_type: input.itemType,
        name: input.name,
        description: input.description,
        quantity: input.quantity,
        unit_price_cents: input.unitPriceCents,
        line_subtotal_cents: calculateEstimateLineSubtotalCents(
          input.quantity,
          input.unitPriceCents
        ),
        taxable: input.taxable
      }))
    )
    .select("*")
    .returns<EstimateLineItemRow[]>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  await recalculateEstimateTotals(client, estimateId);

  return {
    ...result,
    data: result.data
      .map(mapEstimateLineItemRow)
      .sort((left, right) => left.position - right.position)
  };
}

export async function updateEstimateLineItem(
  client: AppSupabaseClient,
  lineItemId: string,
  input: UpdateEstimateLineItemInput
) {
  const parsed = updateEstimateLineItemInputSchema.parse(input);
  const normalized = normalizeEstimateLineItemInput(parsed);
  const existingResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<EstimateLineItemRow>();

  if (existingResult.error || !existingResult.data) {
    return {
      ...existingResult,
      data: null
    };
  }

  const lineSubtotalCents = calculateEstimateLineSubtotalCents(
    normalized.quantity,
    normalized.unitPriceCents
  );

  const result = await client
    .from("estimate_line_items")
    .update({
      estimate_section_id: normalized.estimateSectionId ?? null,
      item_type: normalized.itemType,
      name: normalized.name,
      description: normalized.description,
      quantity: normalized.quantity,
      unit_price_cents: normalized.unitPriceCents,
      line_subtotal_cents: lineSubtotalCents,
      taxable: normalized.taxable
    })
    .eq("id", lineItemId)
    .select("*")
    .single<EstimateLineItemRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  await recalculateEstimateTotals(client, existingResult.data.estimate_id);

  return {
    ...result,
    data: mapEstimateLineItemRow(result.data)
  };
}

export async function moveEstimateLineItem(
  client: AppSupabaseClient,
  lineItemId: string,
  input: MoveEstimateLineItemInput
) {
  const parsed = moveEstimateLineItemInputSchema.parse(input);
  const existingResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<EstimateLineItemRow>();

  if (existingResult.error || !existingResult.data) {
    return {
      ...existingResult,
      data: null
    };
  }

  const result = await client
    .from("estimate_line_items")
    .update({
      estimate_section_id: parsed.estimateSectionId ?? null,
      position: parsed.position
    })
    .eq("id", lineItemId)
    .select("*")
    .single<EstimateLineItemRow>();

  return {
    ...result,
    data: result.data ? mapEstimateLineItemRow(result.data) : null
  };
}

export async function deleteEstimateLineItem(client: AppSupabaseClient, lineItemId: string) {
  const existingResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<EstimateLineItemRow>();

  if (existingResult.error || !existingResult.data) {
    return {
      ...existingResult,
      data: null
    };
  }

  const result = await client.from("estimate_line_items").delete().eq("id", lineItemId);

  if (result.error) {
    return {
      data: null,
      error: result.error
    };
  }

  const remainingResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", existingResult.data.estimate_id)
    .order("position", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  if (remainingResult.error) {
    throw remainingResult.error;
  }

  const remainingItems = remainingResult.data ?? [];

  for (const [index, item] of remainingItems.entries()) {
    if (item.position !== index) {
      await client.from("estimate_line_items").update({ position: index }).eq("id", item.id);
    }
  }

  await recalculateEstimateTotals(client, existingResult.data.estimate_id);

  return {
    data: null,
    error: null
  };
}

export async function createEstimateSection(
  client: AppSupabaseClient,
  input: CreateEstimateSectionInput
) {
  const parsed = createEstimateSectionInputSchema.parse(input);
  const sectionsResult = await listEstimateSections(client, parsed.estimateId);

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  const nextPosition =
    (sectionsResult.data ?? []).reduce((max, section) => Math.max(max, section.position), -1) + 1;
  const result = await client
    .from("estimate_sections")
    .insert({
      estimate_id: parsed.estimateId,
      company_id: parsed.companyId,
      job_id: parsed.jobId,
      position: nextPosition,
      title: parsed.title.trim(),
      description: parsed.description ?? null,
      notes: parsed.notes ?? null,
      source: parsed.source ?? "manual",
      source_ref: parsed.sourceRef ?? null,
      created_by_user_id: parsed.createdByUserId
    })
    .select("*")
    .single<EstimateSectionRow>();

  return {
    ...result,
    data: result.data ? mapEstimateSectionRow(result.data) : null
  };
}

export async function updateEstimateSection(
  client: AppSupabaseClient,
  sectionId: string,
  input: UpdateEstimateSectionInput
) {
  const parsed = updateEstimateSectionInputSchema.parse(input);
  const updatePayload: {
    description: string | null;
    notes: string | null;
    position?: number;
    title: string;
  } = {
    title: parsed.title.trim(),
    description: parsed.description ?? null,
    notes: parsed.notes ?? null
  };

  if (typeof parsed.position === "number") {
    updatePayload.position = parsed.position;
  }

  const result = await client
    .from("estimate_sections")
    .update(updatePayload)
    .eq("id", sectionId)
    .select("*")
    .single<EstimateSectionRow>();

  return {
    ...result,
    data: result.data ? mapEstimateSectionRow(result.data) : null
  };
}

export async function deleteEstimateSection(client: AppSupabaseClient, sectionId: string) {
  const existingSectionResult = await client
    .from("estimate_sections")
    .select("*")
    .eq("id", sectionId)
    .single<EstimateSectionRow>();

  if (existingSectionResult.error || !existingSectionResult.data) {
    return {
      ...existingSectionResult,
      data: null
    };
  }

  await client
    .from("estimate_line_items")
    .update({ estimate_section_id: null })
    .eq("estimate_section_id", sectionId);

  const result = await client.from("estimate_sections").delete().eq("id", sectionId);

  if (result.error) {
    return {
      data: null,
      error: result.error
    };
  }

  const remainingSectionsResult = await client
    .from("estimate_sections")
    .select("*")
    .eq("estimate_id", existingSectionResult.data.estimate_id)
    .order("position", { ascending: true })
    .returns<EstimateSectionRow[]>();

  if (remainingSectionsResult.error) {
    throw remainingSectionsResult.error;
  }

  for (const [index, section] of (remainingSectionsResult.data ?? []).entries()) {
    if (section.position !== index) {
      await client.from("estimate_sections").update({ position: index }).eq("id", section.id);
    }
  }

  return {
    data: null,
    error: null
  };
}

export async function changeEstimateStatus(
  client: AppSupabaseClient,
  estimateId: string,
  input: ChangeEstimateStatusInput
) {
  const parsed = changeEstimateStatusInputSchema.parse(input);
  const currentEstimateResult = await getEstimateById(client, estimateId);

  if (currentEstimateResult.error || !currentEstimateResult.data) {
    return currentEstimateResult;
  }

  if (!canTransitionEstimateStatus(currentEstimateResult.data.status, parsed.status)) {
    throw new Error(
      `Invalid estimate status transition from ${currentEstimateResult.data.status} to ${parsed.status}.`
    );
  }

  if (parsed.status === "accepted" && canEstimateBeApproved(currentEstimateResult.data.status)) {
    throw new Error("Use the approval workflow to accept an estimate.");
  }

  const result = await client
    .from("estimates")
    .update({ status: parsed.status })
    .eq("id", estimateId)
    .select("*")
    .single<EstimateRow>();

  return {
    ...result,
    data: result.data ? mapEstimateRow(result.data) : null
  };
}

export async function listEstimatesByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: EstimateListQuery = {}
) {
  const parsed = estimateListQuerySchema.parse(query);
  const baseBuilder = buildEstimateListBaseQuery(client, companyId, parsed.status);

  const result = parsed.query
      ? await (async () => {
        const search = `%${parsed.query}%`;
        const normalizedVin = normalizeVin(parsed.query);
        const vehicleSearchConditions = [
          `make.ilike.${search}`,
          `model.ilike.${search}`,
          `license_plate.ilike.${search}`,
          normalizedVin ? `vin.ilike.%${normalizedVin}%` : null
        ]
          .filter(Boolean)
          .join(",");
        const [estimateFieldResult, customerLookupResult, vehicleLookupResult] = await Promise.all([
          buildEstimateListBaseQuery(client, companyId, parsed.status)
            .or(`estimate_number.ilike.${search},title.ilike.${search},notes.ilike.${search}`)
            .returns<EstimateRow[]>(),
          client
            .from("customers")
            .select("id")
            .eq("company_id", companyId)
            .or(`first_name.ilike.${search},last_name.ilike.${search},email.ilike.${search},phone.ilike.${search}`)
            .returns<Array<Pick<CustomerRow, "id">>>(),
          (() => {
            const vehicleBuilder = client
              .from("vehicles")
              .select("id")
              .eq("company_id", companyId)
              .or(vehicleSearchConditions);

            return vehicleBuilder.returns<Array<Pick<VehicleRow, "id">>>();
          })()
        ]);

        if (estimateFieldResult.error) {
          return {
            ...estimateFieldResult,
            data: null
          };
        }

        if (customerLookupResult.error) {
          return {
            ...customerLookupResult,
            data: null
          };
        }

        if (vehicleLookupResult.error) {
          return {
            ...vehicleLookupResult,
            data: null
          };
        }

        const matchingCustomerIds = [...new Set((customerLookupResult.data ?? []).map((row) => row.id))];
        const matchingVehicleIds = [...new Set((vehicleLookupResult.data ?? []).map((row) => row.id))];
        const [customerJobLookupResult, vehicleJobLookupResult] = await Promise.all([
          matchingCustomerIds.length
            ? client
                .from("jobs")
                .select("id")
                .eq("company_id", companyId)
                .in("customer_id", matchingCustomerIds)
                .returns<JobLookupRow[]>()
            : Promise.resolve({ data: [] as JobLookupRow[], error: null }),
          matchingVehicleIds.length
            ? client
                .from("jobs")
                .select("id")
                .eq("company_id", companyId)
                .in("vehicle_id", matchingVehicleIds)
                .returns<JobLookupRow[]>()
            : Promise.resolve({ data: [] as JobLookupRow[], error: null })
        ]);

        if (customerJobLookupResult.error) {
          return {
            ...customerJobLookupResult,
            data: null
          };
        }

        if (vehicleJobLookupResult.error) {
          return {
            ...vehicleJobLookupResult,
            data: null
          };
        }

        const matchingJobIds = [
          ...new Set([
            ...(customerJobLookupResult.data ?? []).map((row) => row.id),
            ...(vehicleJobLookupResult.data ?? []).map((row) => row.id)
          ])
        ];
        const relatedEstimateResult = matchingJobIds.length
          ? await buildEstimateListBaseQuery(client, companyId, parsed.status)
              .in("job_id", matchingJobIds)
              .returns<EstimateRow[]>()
          : { data: [] as EstimateRow[], error: null };

        if (relatedEstimateResult.error) {
          return {
            ...relatedEstimateResult,
            data: null
          };
        }

        const rows = [...(estimateFieldResult.data ?? []), ...(relatedEstimateResult.data ?? [])];
        const dedupedRows = [...new Map(rows.map((row) => [row.id, row])).values()].sort(compareEstimateRows);

        return {
          ...estimateFieldResult,
          data: dedupedRows
        };
      })()
    : await baseBuilder.returns<EstimateRow[]>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  const jobIds = [...new Set(result.data.map((estimate) => estimate.job_id))];
  const jobsResult = jobIds.length
    ? await client.from("jobs").select("*").in("id", jobIds).returns<JobRow[]>()
    : { data: [] as JobRow[], error: null };

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  const customerIds = [...new Set((jobsResult.data ?? []).map((job) => job.customer_id))];
  const vehicleIds = [...new Set((jobsResult.data ?? []).map((job) => job.vehicle_id))];

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

  const jobsById = new Map((jobsResult.data ?? []).map((job) => [job.id, job]));
  const customersById = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehiclesById = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));

  return {
    ...result,
    data: result.data.map((row) => mapEstimateSummary(row, jobsById, customersById, vehiclesById))
  };
}

export async function getEstimateDetailById(client: AppSupabaseClient, estimateId: string) {
  const estimateResult = await getEstimateById(client, estimateId);

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  const [jobResult, lineItemsResult] = await Promise.all([
    getJobById(client, estimateResult.data.jobId),
    listEstimateLineItems(client, estimateId)
  ]);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Job not found.");
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const [customerResult, vehicleResult] = await Promise.all([
    getCustomerById(client, jobResult.data.customerId),
    getVehicleById(client, jobResult.data.vehicleId)
  ]);

  const signatureResult = estimateResult.data.approvedSignatureId
    ? await getSignatureByEstimateId(client, estimateId)
    : { data: null as Signature | null, error: null };

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  if (signatureResult.error) {
    throw signatureResult.error;
  }

  const lineItems = lineItemsResult.data ?? [];

  return {
    error: null,
    data: {
      estimate: estimateResult.data,
      job: jobResult.data,
      customer: customerResult.data,
      vehicle: vehicleResult.data,
      lineItems,
      totals: calculateEstimateTotals({
        lineItems,
        discountCents: estimateResult.data.discountCents,
        taxRateBasisPoints: estimateResult.data.taxRateBasisPoints
      }),
      signature: signatureResult.data ?? null
    } satisfies EstimateDetail
  };
}

export async function getAssignedJobEstimateSummary(
  client: AppSupabaseClient,
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
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

  const estimateResult = await getEstimateByJobId(client, jobId);

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  return getEstimateDetailById(client, estimateResult.data.id);
}
