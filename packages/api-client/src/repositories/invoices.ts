import {
  calculateInvoiceLineSubtotalCents,
  calculateInvoiceTotals,
  canTransitionInvoiceStatus,
  getCustomerDisplayName,
  getVehicleDisplayName,
  normalizeInvoiceInput,
  normalizeInvoiceLineItemInput
} from "@mobile-mechanic/core";
import type {
  ChangeInvoiceStatusInput,
  CreateInvoiceFromEstimateInput,
  CreateInvoiceInput,
  CreateInvoiceLineItemInput,
  Database,
  Invoice,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceListQuery,
  InvoiceSummary,
  UpdateInvoiceInput,
  UpdateInvoiceLineItemInput
} from "@mobile-mechanic/types";
import {
  changeInvoiceStatusInputSchema,
  createInvoiceFromEstimateInputSchema,
  createInvoiceInputSchema,
  createInvoiceLineItemInputSchema,
  invoiceListQuerySchema,
  updateInvoiceInputSchema,
  updateInvoiceLineItemInputSchema
} from "@mobile-mechanic/validation";

import { getCustomerById } from "./customers";
import { getEstimateById } from "./estimates";
import { getJobById } from "./jobs";
import { listPaymentsByInvoice } from "./payments";
import { getVehicleById } from "./vehicles";
import type { AppSupabaseClient } from "../supabase/types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceLineItemRow = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type EstimateLineItemRow = Database["public"]["Tables"]["estimate_line_items"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    status: row.status,
    invoiceNumber: row.invoice_number,
    title: row.title,
    notes: row.notes,
    terms: row.terms,
    currencyCode: row.currency_code as Invoice["currencyCode"],
    paymentUrl: row.payment_url,
    paymentUrlExpiresAt: row.payment_url_expires_at,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    taxRateBasisPoints: row.tax_rate_basis_points,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    balanceDueCents: row.balance_due_cents,
    dueAt: row.due_at,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceLineItemRow(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    actualCostCents: row.actual_cost_cents,
    id: row.id,
    invoiceId: row.invoice_id,
    companyId: row.company_id,
    jobId: row.job_id,
    partRequestLineId: row.part_request_line_id,
    position: row.position,
    itemType: row.item_type as InvoiceLineItem["itemType"],
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

function mapInvoiceSummary(
  row: InvoiceRow,
  jobsById: Map<string, JobRow>,
  customersById: Map<string, CustomerRow>,
  vehiclesById: Map<string, VehicleRow>
): InvoiceSummary {
  const job = jobsById.get(row.job_id);
  const customer = job ? customersById.get(job.customer_id) : undefined;
  const vehicle = job ? vehiclesById.get(job.vehicle_id) : undefined;
  const titleParts = [
    row.title,
    customer
      ? getCustomerDisplayName({
          companyName: customer.company_name,
          firstName: customer.first_name,
          lastName: customer.last_name,
          relationshipType: customer.relationship_type
        })
      : null,
    vehicle
      ? getVehicleDisplayName({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model
        })
      : null
  ].filter(Boolean);

  return {
    invoiceId: row.id,
    jobId: row.job_id,
    status: row.status,
    invoiceNumber: row.invoice_number,
    title: titleParts.join(" · "),
    totalCents: row.total_cents,
    balanceDueCents: row.balance_due_cents,
    updatedAt: row.updated_at
  };
}

export async function getInvoiceById(client: AppSupabaseClient, invoiceId: string) {
  const result = await client.from("invoices").select("*").eq("id", invoiceId).single<InvoiceRow>();

  return {
    ...result,
    data: result.data ? mapInvoiceRow(result.data) : null
  };
}

export async function getInvoiceByJobId(client: AppSupabaseClient, jobId: string) {
  const result = await client
    .from("invoices")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle<InvoiceRow>();

  return {
    ...result,
    data: result.data ? mapInvoiceRow(result.data) : null
  };
}

export async function listInvoiceLineItems(client: AppSupabaseClient, invoiceId: string) {
  const result = await client
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true })
    .returns<InvoiceLineItemRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInvoiceLineItemRow) : null
  };
}

export async function recalculateInvoiceTotals(client: AppSupabaseClient, invoiceId: string) {
  const rpcResult = await client.rpc("recalculate_invoice_totals", {
    target_invoice_id: invoiceId
  });

  if (rpcResult.error) {
    throw rpcResult.error;
  }

  const result = await client.from("invoices").select("*").eq("id", invoiceId).single<InvoiceRow>();

  return {
    ...result,
    data: result.data ? mapInvoiceRow(result.data) : null
  };
}

export async function createInvoice(client: AppSupabaseClient, input: CreateInvoiceInput) {
  const parsed = createInvoiceInputSchema.parse(input);
  const normalized = normalizeInvoiceInput(parsed);
  const existingInvoiceResult = await getInvoiceByJobId(client, normalized.jobId);

  if (existingInvoiceResult.error) {
    throw existingInvoiceResult.error;
  }

  if (existingInvoiceResult.data) {
    return existingInvoiceResult;
  }

  const result = await client
    .from("invoices")
    .insert({
      company_id: normalized.companyId,
      job_id: normalized.jobId,
      estimate_id: normalized.estimateId,
      status: "draft",
      invoice_number: normalized.invoiceNumber,
      title: normalized.title,
      notes: normalized.notes,
      terms: normalized.terms,
      currency_code: "USD",
      tax_rate_basis_points: normalized.taxRateBasisPoints,
      subtotal_cents: 0,
      discount_cents: normalized.discountCents,
      tax_cents: 0,
      total_cents: 0,
      amount_paid_cents: 0,
      balance_due_cents: 0,
      due_at: normalized.dueAt,
      created_by_user_id: normalized.createdByUserId
    })
    .select("*")
    .single<InvoiceRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  try {
    const recalculated = await recalculateInvoiceTotals(client, result.data.id);

    if (recalculated.error || !recalculated.data) {
      throw recalculated.error ?? new Error("Failed to initialize invoice totals.");
    }

    return recalculated;
  } catch (error) {
    await client.from("invoices").delete().eq("id", result.data.id);
    throw error;
  }
}

export async function createInvoiceFromEstimate(
  client: AppSupabaseClient,
  input: CreateInvoiceFromEstimateInput
) {
  const parsed = createInvoiceFromEstimateInputSchema.parse(input);
  const [existingInvoiceResult, estimateResult] = await Promise.all([
    getInvoiceByJobId(client, parsed.jobId),
    getEstimateById(client, parsed.estimateId)
  ]);

  if (existingInvoiceResult.error) {
    throw existingInvoiceResult.error;
  }

  if (existingInvoiceResult.data) {
    return existingInvoiceResult;
  }

  if (estimateResult.error || !estimateResult.data) {
    return {
      ...estimateResult,
      data: null
    };
  }

  if (
    estimateResult.data.companyId !== parsed.companyId ||
    estimateResult.data.jobId !== parsed.jobId ||
    estimateResult.data.status !== "accepted"
  ) {
    throw new Error("Only accepted estimates for the same job can be converted into invoices.");
  }

  const estimateLineItemsResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", parsed.estimateId)
    .order("position", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  if (estimateLineItemsResult.error) {
    throw estimateLineItemsResult.error;
  }

  const invoiceResult = await client
    .from("invoices")
    .insert({
      company_id: parsed.companyId,
      job_id: parsed.jobId,
      estimate_id: parsed.estimateId,
      status: "draft",
      invoice_number: parsed.invoiceNumber.trim(),
      title: estimateResult.data.title,
      notes: estimateResult.data.notes,
      terms: estimateResult.data.terms,
      currency_code: "USD",
      tax_rate_basis_points: estimateResult.data.taxRateBasisPoints,
      subtotal_cents: 0,
      discount_cents: estimateResult.data.discountCents,
      tax_cents: 0,
      total_cents: 0,
      amount_paid_cents: 0,
      balance_due_cents: 0,
      due_at: null,
      created_by_user_id: parsed.createdByUserId
    })
    .select("*")
    .single<InvoiceRow>();

  if (invoiceResult.error || !invoiceResult.data) {
    return {
      ...invoiceResult,
      data: null
    };
  }

  try {
    const lineItems = (estimateLineItemsResult.data ?? []).map((lineItem) => ({
      actual_cost_cents: lineItem.actual_cost_cents,
      invoice_id: invoiceResult.data.id,
      company_id: parsed.companyId,
      job_id: parsed.jobId,
      position: lineItem.position,
      item_type: lineItem.item_type,
      name: lineItem.name,
      description: lineItem.description,
      estimated_cost_cents: lineItem.estimated_cost_cents,
      part_request_line_id: lineItem.part_request_line_id,
      quantity: lineItem.quantity,
      unit_price_cents: lineItem.unit_price_cents,
      line_subtotal_cents: lineItem.line_subtotal_cents,
      taxable: lineItem.taxable
    }));

    if (lineItems.length) {
      const insertResult = await client.from("invoice_line_items").insert(lineItems);

      if (insertResult.error) {
        throw insertResult.error;
      }
    }

    const recalculated = await recalculateInvoiceTotals(client, invoiceResult.data.id);

    if (recalculated.error || !recalculated.data) {
      throw recalculated.error ?? new Error("Failed to initialize invoice totals.");
    }

    return recalculated;
  } catch (error) {
    await client.from("invoices").delete().eq("id", invoiceResult.data.id);
    throw error;
  }
}

export async function updateInvoice(client: AppSupabaseClient, invoiceId: string, input: UpdateInvoiceInput) {
  const parsed = updateInvoiceInputSchema.parse(input);
  const normalized = normalizeInvoiceInput(parsed);

  const result = await client
    .from("invoices")
    .update({
      invoice_number: normalized.invoiceNumber,
      title: normalized.title,
      notes: normalized.notes,
      terms: normalized.terms,
      tax_rate_basis_points: normalized.taxRateBasisPoints,
      discount_cents: normalized.discountCents,
      due_at: normalized.dueAt
    })
    .eq("id", invoiceId)
    .select("*")
    .single<InvoiceRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  return recalculateInvoiceTotals(client, invoiceId);
}

export async function createInvoiceLineItem(
  client: AppSupabaseClient,
  invoiceId: string,
  input: CreateInvoiceLineItemInput
) {
  const parsed = createInvoiceLineItemInputSchema.parse(input);
  const normalized = normalizeInvoiceLineItemInput(parsed);
  const [invoiceResult, lineItemsResult] = await Promise.all([
    getInvoiceById(client, invoiceId),
    listInvoiceLineItems(client, invoiceId)
  ]);

  if (invoiceResult.error || !invoiceResult.data) {
    return {
      ...invoiceResult,
      data: null
    };
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const nextPosition =
    (lineItemsResult.data ?? []).reduce((max, item) => Math.max(max, item.position), -1) + 1;
  const lineSubtotalCents = calculateInvoiceLineSubtotalCents(
    normalized.quantity,
    normalized.unitPriceCents
  );

  const result = await client
    .from("invoice_line_items")
    .insert({
      invoice_id: invoiceId,
      company_id: invoiceResult.data.companyId,
      job_id: invoiceResult.data.jobId,
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
    .single<InvoiceLineItemRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  await recalculateInvoiceTotals(client, invoiceId);

  return {
    ...result,
    data: mapInvoiceLineItemRow(result.data)
  };
}

export async function updateInvoiceLineItem(
  client: AppSupabaseClient,
  lineItemId: string,
  input: UpdateInvoiceLineItemInput
) {
  const parsed = updateInvoiceLineItemInputSchema.parse(input);
  const normalized = normalizeInvoiceLineItemInput(parsed);
  const existingResult = await client
    .from("invoice_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<InvoiceLineItemRow>();

  if (existingResult.error || !existingResult.data) {
    return {
      ...existingResult,
      data: null
    };
  }

  const lineSubtotalCents = calculateInvoiceLineSubtotalCents(
    normalized.quantity,
    normalized.unitPriceCents
  );

  const result = await client
    .from("invoice_line_items")
    .update({
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
    .single<InvoiceLineItemRow>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  await recalculateInvoiceTotals(client, existingResult.data.invoice_id);

  return {
    ...result,
    data: mapInvoiceLineItemRow(result.data)
  };
}

export async function deleteInvoiceLineItem(client: AppSupabaseClient, lineItemId: string) {
  const existingResult = await client
    .from("invoice_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<InvoiceLineItemRow>();

  if (existingResult.error || !existingResult.data) {
    return {
      ...existingResult,
      data: null
    };
  }

  const result = await client.from("invoice_line_items").delete().eq("id", lineItemId);

  if (result.error) {
    return {
      data: null,
      error: result.error
    };
  }

  const remainingResult = await client
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", existingResult.data.invoice_id)
    .order("position", { ascending: true })
    .returns<InvoiceLineItemRow[]>();

  if (remainingResult.error) {
    throw remainingResult.error;
  }

  const remainingItems = remainingResult.data ?? [];

  for (const [index, item] of remainingItems.entries()) {
    if (item.position !== index) {
      await client.from("invoice_line_items").update({ position: index }).eq("id", item.id);
    }
  }

  await recalculateInvoiceTotals(client, existingResult.data.invoice_id);

  return {
    data: null,
    error: null
  };
}

export async function changeInvoiceStatus(
  client: AppSupabaseClient,
  invoiceId: string,
  input: ChangeInvoiceStatusInput
) {
  const parsed = changeInvoiceStatusInputSchema.parse(input);
  const currentInvoiceResult = await getInvoiceById(client, invoiceId);

  if (currentInvoiceResult.error || !currentInvoiceResult.data) {
    return currentInvoiceResult;
  }

  if (!canTransitionInvoiceStatus(currentInvoiceResult.data.status, parsed.status)) {
    throw new Error(
      `Invalid invoice status transition from ${currentInvoiceResult.data.status} to ${parsed.status}.`
    );
  }

  const result = await client
    .from("invoices")
    .update({ status: parsed.status })
    .eq("id", invoiceId)
    .select("*")
    .single<InvoiceRow>();

  return {
    ...result,
    data: result.data ? mapInvoiceRow(result.data) : null
  };
}

export async function listInvoicesByCompany(
  client: AppSupabaseClient,
  companyId: string,
  query: InvoiceListQuery = {}
) {
  const parsed = invoiceListQuerySchema.parse(query);
  let builder = client
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (parsed.status) {
    builder = builder.eq("status", parsed.status);
  }

  if (parsed.query) {
    const search = `%${parsed.query}%`;
    builder = builder.or(`invoice_number.ilike.${search},title.ilike.${search},notes.ilike.${search}`);
  }

  const result = await builder.returns<InvoiceRow[]>();

  if (result.error || !result.data) {
    return {
      ...result,
      data: null
    };
  }

  const jobIds = [...new Set(result.data.map((invoice) => invoice.job_id))];
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
    data: result.data.map((row) => mapInvoiceSummary(row, jobsById, customersById, vehiclesById))
  };
}

export async function getInvoiceDetailById(client: AppSupabaseClient, invoiceId: string) {
  const invoiceResult = await getInvoiceById(client, invoiceId);

  if (invoiceResult.error || !invoiceResult.data) {
    return {
      ...invoiceResult,
      data: null
    };
  }

  const [jobResult, lineItemsResult, paymentsResult] = await Promise.all([
    getJobById(client, invoiceResult.data.jobId),
    listInvoiceLineItems(client, invoiceId),
    listPaymentsByInvoice(client, invoiceId)
  ]);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Job not found.");
  }

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  if (paymentsResult.error) {
    throw paymentsResult.error;
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

  const estimateResult = invoiceResult.data.estimateId
    ? await getEstimateById(client, invoiceResult.data.estimateId)
    : { data: null, error: null };

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  const lineItems = lineItemsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  return {
    error: null,
    data: {
      invoice: invoiceResult.data,
      job: jobResult.data,
      customer: customerResult.data,
      vehicle: vehicleResult.data,
      estimate: estimateResult.data ?? null,
      lineItems,
      payments,
      totals: calculateInvoiceTotals({
        lineItems,
        discountCents: invoiceResult.data.discountCents,
        taxRateBasisPoints: invoiceResult.data.taxRateBasisPoints,
        amountPaidCents: invoiceResult.data.amountPaidCents
      })
    } satisfies InvoiceDetail
  };
}

export async function getAssignedJobInvoiceSummary(
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

  const invoiceResult = await getInvoiceByJobId(client, jobId);

  if (invoiceResult.error || !invoiceResult.data) {
    return {
      ...invoiceResult,
      data: null
    };
  }

  return getInvoiceDetailById(client, invoiceResult.data.id);
}
