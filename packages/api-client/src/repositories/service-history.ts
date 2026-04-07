import { getInspectionSummary } from "@mobile-mechanic/core";
import type {
  Database,
  Estimate,
  Invoice,
  Inspection,
  InspectionItem,
  Job,
  Payment,
  ServiceHistoryInspectionSummary,
  ServiceHistoryQuery
} from "@mobile-mechanic/types";
import { serviceHistoryQuerySchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InspectionRow = Database["public"]["Tables"]["inspections"]["Row"];
type InspectionItemRow = Database["public"]["Tables"]["inspection_items"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"] & {
  manual_reference_note: string | null;
  manual_tender_type: Payment["manualTenderType"];
  recorded_by_user_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_event_id: string | null;
};

export interface ServiceHistoryInspectionRecord {
  inspection: Inspection;
  summary: ServiceHistoryInspectionSummary;
}

function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    vehicleId: row.vehicle_id,
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

function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    invoiceId: row.invoice_id,
    provider: row.provider as Payment["provider"],
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeChargeId: row.stripe_charge_id,
    stripeEventId: row.stripe_event_id,
    manualTenderType: row.manual_tender_type,
    manualReferenceNote: row.manual_reference_note,
    recordedByUserId: row.recorded_by_user_id,
    amountCents: row.amount_cents,
    currencyCode: row.currency_code as Payment["currencyCode"],
    receiptUrl: row.receipt_url,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listServiceHistoryJobsForCustomer(
  client: AppSupabaseClient,
  companyId: string,
  customerId: string,
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);
  let builder = client
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("scheduled_start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (parsed.vehicleId) {
    builder = builder.eq("vehicle_id", parsed.vehicleId);
  }

  if (parsed.jobStatuses?.length) {
    builder = builder.in("status", parsed.jobStatuses);
  }

  const result = await builder.returns<JobRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapJobRow) : null
  };
}

export async function listServiceHistoryJobsForVehicle(
  client: AppSupabaseClient,
  companyId: string,
  vehicleId: string,
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);
  let builder = client
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("vehicle_id", vehicleId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("scheduled_start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (parsed.jobStatuses?.length) {
    builder = builder.in("status", parsed.jobStatuses);
  }

  const result = await builder.returns<JobRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapJobRow) : null
  };
}

export async function listServiceHistoryEstimatesByJobIds(
  client: AppSupabaseClient,
  companyId: string,
  jobIds: string[],
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);

  if (!jobIds.length) {
    return { data: [] as Estimate[], error: null };
  }

  let builder = client.from("estimates").select("*").eq("company_id", companyId).in("job_id", jobIds);

  if (parsed.estimateStatuses?.length) {
    builder = builder.in("status", parsed.estimateStatuses);
  }

  const result = await builder.returns<EstimateRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapEstimateRow) : null
  };
}

export async function listServiceHistoryInvoicesByJobIds(
  client: AppSupabaseClient,
  companyId: string,
  jobIds: string[],
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);

  if (!jobIds.length) {
    return { data: [] as Invoice[], error: null };
  }

  let builder = client.from("invoices").select("*").eq("company_id", companyId).in("job_id", jobIds);

  if (parsed.invoiceStatuses?.length) {
    builder = builder.in("status", parsed.invoiceStatuses);
  }

  const result = await builder.returns<InvoiceRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapInvoiceRow) : null
  };
}

export async function listServiceHistoryPaymentsByInvoiceIds(
  client: AppSupabaseClient,
  companyId: string,
  invoiceIds: string[],
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);

  if (!invoiceIds.length) {
    return { data: [] as Payment[], error: null };
  }

  let builder = client
    .from("payments")
    .select("*")
    .eq("company_id", companyId)
    .in("invoice_id", invoiceIds)
    .order("paid_at", { ascending: false });

  if (parsed.paymentStatuses?.length) {
    builder = builder.in("status", parsed.paymentStatuses);
  }

  const result = await builder.returns<PaymentRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapPaymentRow) : null
  };
}

export async function listServiceHistoryInspectionsByJobIds(
  client: AppSupabaseClient,
  companyId: string,
  jobIds: string[],
  query: ServiceHistoryQuery = {}
) {
  const parsed = serviceHistoryQuerySchema.parse(query);

  if (!jobIds.length) {
    return { data: [] as ServiceHistoryInspectionRecord[], error: null };
  }

  let inspectionBuilder = client
    .from("inspections")
    .select("*")
    .eq("company_id", companyId)
    .in("job_id", jobIds);

  if (parsed.inspectionStatuses?.length) {
    inspectionBuilder = inspectionBuilder.in("status", parsed.inspectionStatuses);
  }

  const inspectionsResult = await inspectionBuilder.returns<InspectionRow[]>();

  if (inspectionsResult.error || !inspectionsResult.data?.length) {
    return {
      ...inspectionsResult,
      data: inspectionsResult.data ? [] : null
    };
  }

  const inspections = inspectionsResult.data.map(mapInspectionRow);
  const inspectionIds = inspections.map((inspection) => inspection.id);
  const itemsResult = await client
    .from("inspection_items")
    .select("*")
    .eq("company_id", companyId)
    .in("inspection_id", inspectionIds)
    .returns<InspectionItemRow[]>();

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const itemsByInspectionId = new Map<string, InspectionItem[]>();

  for (const item of (itemsResult.data ?? []).map(mapInspectionItemRow)) {
    const current = itemsByInspectionId.get(item.inspectionId) ?? [];
    current.push(item);
    itemsByInspectionId.set(item.inspectionId, current);
  }

  return {
    error: null,
    data: inspections.map((inspection) => ({
      inspection,
      summary: {
        ...getInspectionSummary(
          inspection.id,
          inspection.jobId,
          inspection.status,
          inspection.completedAt,
          itemsByInspectionId.get(inspection.id) ?? []
        ),
        startedAt: inspection.startedAt
      }
    }))
  };
}
