import type {
  CompleteCustomerDocumentLinkInput,
  CreateCustomerDocumentLinkInput,
  CustomerDocumentLink,
  CustomerDocumentLinkEvent,
  Database,
  ExpireCustomerDocumentLinkInput,
  Json,
  RecordCustomerDocumentLinkEventInput,
  RevokeCustomerDocumentLinkInput,
  UpdateCustomerDocumentLinkSentInput,
  UpdateCustomerDocumentLinkViewInput
} from "@mobile-mechanic/types";
import {
  completeCustomerDocumentLinkInputSchema,
  createCustomerDocumentLinkInputSchema,
  expireCustomerDocumentLinkInputSchema,
  recordCustomerDocumentLinkEventInputSchema,
  revokeCustomerDocumentLinkInputSchema,
  updateCustomerDocumentLinkSentInputSchema,
  updateCustomerDocumentLinkViewInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CustomerDocumentLinkRow = Database["public"]["Tables"]["customer_document_links"]["Row"];
type CustomerDocumentLinkEventRow = Database["public"]["Tables"]["customer_document_link_events"]["Row"];

function asJson(value: unknown): Json {
  return (value ?? {}) as Json;
}

function mapCustomerDocumentLinkRow(row: CustomerDocumentLinkRow): CustomerDocumentLink {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    jobId: row.job_id,
    documentKind: row.document_kind,
    estimateId: row.estimate_id,
    invoiceId: row.invoice_id,
    accessTokenHash: row.access_token_hash,
    status: row.status,
    expiresAt: row.expires_at,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count,
    sentAt: row.sent_at,
    completedAt: row.completed_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    lastSentCommunicationId: row.last_sent_communication_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCustomerDocumentLinkEventRow(
  row: CustomerDocumentLinkEventRow
): CustomerDocumentLinkEvent {
  return {
    id: row.id,
    linkId: row.link_id,
    companyId: row.company_id,
    customerId: row.customer_id,
    jobId: row.job_id,
    documentKind: row.document_kind,
    estimateId: row.estimate_id,
    invoiceId: row.invoice_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    ipAddress: row.ip_address as string | null,
    userAgent: row.user_agent as string | null,
    metadata: asJson(row.metadata),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  };
}

export async function createCustomerDocumentLink(
  client: AppSupabaseClient,
  input: CreateCustomerDocumentLinkInput
) {
  const parsed = createCustomerDocumentLinkInputSchema.parse(input);
  const result = await client
    .from("customer_document_links")
    .insert({
      ...(parsed.id ? { id: parsed.id } : {}),
      company_id: parsed.companyId,
      customer_id: parsed.customerId,
      job_id: parsed.jobId,
      document_kind: parsed.documentKind,
      estimate_id: parsed.estimateId ?? null,
      invoice_id: parsed.invoiceId ?? null,
      access_token_hash: parsed.accessTokenHash,
      expires_at: parsed.expiresAt,
      created_by_user_id: parsed.createdByUserId
    })
    .select("*")
    .single<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getCustomerDocumentLinkById(client: AppSupabaseClient, linkId: string) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("id", linkId)
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getCustomerDocumentLinkByTokenHash(
  client: AppSupabaseClient,
  accessTokenHash: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("access_token_hash", accessTokenHash)
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getActiveCustomerDocumentLinkForEstimate(
  client: AppSupabaseClient,
  estimateId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "estimate")
    .eq("estimate_id", estimateId)
    .eq("status", "active")
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getLatestCustomerDocumentLinkForEstimate(
  client: AppSupabaseClient,
  estimateId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "estimate")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getActiveCustomerDocumentLinkForInvoice(
  client: AppSupabaseClient,
  invoiceId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "invoice")
    .eq("invoice_id", invoiceId)
    .eq("status", "active")
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getLatestCustomerDocumentLinkForInvoice(
  client: AppSupabaseClient,
  invoiceId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "invoice")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getActiveCustomerDocumentLinkForJobVisit(
  client: AppSupabaseClient,
  jobId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "job_visit")
    .eq("job_id", jobId)
    .eq("status", "active")
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function getLatestCustomerDocumentLinkForJobVisit(
  client: AppSupabaseClient,
  jobId: string
) {
  const result = await client
    .from("customer_document_links")
    .select("*")
    .eq("document_kind", "job_visit")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function expireCustomerDocumentLink(
  client: AppSupabaseClient,
  linkId: string,
  input: ExpireCustomerDocumentLinkInput = {}
) {
  expireCustomerDocumentLinkInputSchema.parse(input);

  const result = await client
    .from("customer_document_links")
    .update({
      status: "expired"
    })
    .eq("id", linkId)
    .eq("status", "active")
    .select("*")
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function markCustomerDocumentLinkViewed(
  client: AppSupabaseClient,
  linkId: string,
  input: UpdateCustomerDocumentLinkViewInput = {}
) {
  const parsed = updateCustomerDocumentLinkViewInputSchema.parse(input);
  const viewedAt = parsed.viewedAt ?? new Date().toISOString();
  const result = await client.rpc("increment_customer_document_link_view", {
    target_link_id: linkId,
    target_viewed_at: viewedAt
  });

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data as CustomerDocumentLinkRow) : null
  };
}

export async function markCustomerDocumentLinkSent(
  client: AppSupabaseClient,
  linkId: string,
  input: UpdateCustomerDocumentLinkSentInput = {}
) {
  const parsed = updateCustomerDocumentLinkSentInputSchema.parse(input);
  const result = await client
    .from("customer_document_links")
    .update({
      sent_at: parsed.sentAt ?? new Date().toISOString(),
      last_sent_communication_id: parsed.communicationId ?? null
    })
    .eq("id", linkId)
    .select("*")
    .single<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function completeCustomerDocumentLink(
  client: AppSupabaseClient,
  linkId: string,
  input: CompleteCustomerDocumentLinkInput = {}
) {
  const parsed = completeCustomerDocumentLinkInputSchema.parse(input);
  const completedAt = parsed.completedAt ?? new Date().toISOString();
  const result = await client
    .from("customer_document_links")
    .update({
      status: "completed",
      completed_at: completedAt
    })
    .eq("id", linkId)
    .select("*")
    .single<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function revokeCustomerDocumentLink(
  client: AppSupabaseClient,
  linkId: string,
  input: RevokeCustomerDocumentLinkInput = {}
) {
  const parsed = revokeCustomerDocumentLinkInputSchema.parse(input);
  const revokedAt = parsed.revokedAt ?? new Date().toISOString();
  const result = await client
    .from("customer_document_links")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_reason: parsed.reason ?? null
    })
    .eq("id", linkId)
    .in("status", ["active", "expired"])
    .select("*")
    .maybeSingle<CustomerDocumentLinkRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkRow(result.data) : null
  };
}

export async function revokeActiveCustomerDocumentLinksForEstimate(
  client: AppSupabaseClient,
  estimateId: string,
  input: RevokeCustomerDocumentLinkInput = {}
) {
  const parsed = revokeCustomerDocumentLinkInputSchema.parse(input);
  const revokedAt = parsed.revokedAt ?? new Date().toISOString();
  const result = await client
    .from("customer_document_links")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_reason: parsed.reason ?? null
    })
    .eq("document_kind", "estimate")
    .eq("estimate_id", estimateId)
    .eq("status", "active")
    .select("*")
    .returns<CustomerDocumentLinkRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerDocumentLinkRow) : null
  };
}

export async function revokeActiveCustomerDocumentLinksForInvoice(
  client: AppSupabaseClient,
  invoiceId: string,
  input: RevokeCustomerDocumentLinkInput = {}
) {
  const parsed = revokeCustomerDocumentLinkInputSchema.parse(input);
  const revokedAt = parsed.revokedAt ?? new Date().toISOString();
  const result = await client
    .from("customer_document_links")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_reason: parsed.reason ?? null
    })
    .eq("document_kind", "invoice")
    .eq("invoice_id", invoiceId)
    .eq("status", "active")
    .select("*")
    .returns<CustomerDocumentLinkRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerDocumentLinkRow) : null
  };
}

export async function revokeActiveCustomerDocumentLinksForJobVisit(
  client: AppSupabaseClient,
  jobId: string,
  input: RevokeCustomerDocumentLinkInput = {}
) {
  const parsed = revokeCustomerDocumentLinkInputSchema.parse(input);
  const revokedAt = parsed.revokedAt ?? new Date().toISOString();
  const result = await client
    .from("customer_document_links")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_reason: parsed.reason ?? null
    })
    .eq("document_kind", "job_visit")
    .eq("job_id", jobId)
    .eq("status", "active")
    .select("*")
    .returns<CustomerDocumentLinkRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapCustomerDocumentLinkRow) : null
  };
}

export async function recordCustomerDocumentLinkEvent(
  client: AppSupabaseClient,
  input: RecordCustomerDocumentLinkEventInput
) {
  const parsed = recordCustomerDocumentLinkEventInputSchema.parse(input);
  const result = await client
    .from("customer_document_link_events")
    .insert({
      link_id: parsed.linkId,
      company_id: parsed.companyId,
      customer_id: parsed.customerId,
      job_id: parsed.jobId,
      document_kind: parsed.documentKind,
      estimate_id: parsed.estimateId ?? null,
      invoice_id: parsed.invoiceId ?? null,
      event_type: parsed.eventType,
      occurred_at: parsed.occurredAt ?? new Date().toISOString(),
      ip_address: parsed.ipAddress ?? null,
      user_agent: parsed.userAgent ?? null,
      metadata: asJson(parsed.metadata),
      created_by_user_id: parsed.createdByUserId ?? null
    })
    .select("*")
    .single<CustomerDocumentLinkEventRow>();

  return {
    ...result,
    data: result.data ? mapCustomerDocumentLinkEventRow(result.data) : null
  };
}
