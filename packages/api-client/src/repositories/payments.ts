import { normalizePaymentUrl, normalizeStripeReference } from "@mobile-mechanic/core";
import type {
  Database,
  Invoice,
  Payment,
  RecordManualInvoicePaymentInput,
  RecordStripeInvoicePaymentInput,
  UpdateInvoicePaymentLinkInput
} from "@mobile-mechanic/types";
import {
  recordManualInvoicePaymentInputSchema,
  recordStripeInvoicePaymentInputSchema,
  updateInvoicePaymentLinkInputSchema
} from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"] & {
  manual_reference_note: string | null;
  manual_tender_type: Payment["manualTenderType"];
  recorded_by_user_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_event_id: string | null;
};

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

export async function getPaymentById(client: AppSupabaseClient, paymentId: string) {
  const result = await client.from("payments").select("*").eq("id", paymentId).single<PaymentRow>();

  return {
    ...result,
    data: result.data ? mapPaymentRow(result.data) : null
  };
}

export async function listPaymentsByInvoice(client: AppSupabaseClient, invoiceId: string) {
  const result = await client
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false })
    .returns<PaymentRow[]>();

  return {
    ...result,
    data: result.data ? result.data.map(mapPaymentRow) : null
  };
}

export async function updateInvoicePaymentLink(
  client: AppSupabaseClient,
  invoiceId: string,
  input: UpdateInvoicePaymentLinkInput
) {
  const parsed = updateInvoicePaymentLinkInputSchema.parse(input);

  const result = await client
    .from("invoices")
    .update({
      payment_url: normalizePaymentUrl(parsed.paymentUrl),
      payment_url_expires_at: parsed.paymentUrlExpiresAt,
      stripe_checkout_session_id: normalizeStripeReference(parsed.stripeCheckoutSessionId)
    })
    .eq("id", invoiceId)
    .select("*")
    .single<InvoiceRow>();

  return {
    ...result,
    data: result.data ? mapInvoiceRow(result.data) : null
  };
}

export async function clearInvoicePaymentLink(client: AppSupabaseClient, invoiceId: string) {
  return updateInvoicePaymentLink(client, invoiceId, {
    paymentUrl: null,
    paymentUrlExpiresAt: null,
    stripeCheckoutSessionId: null
  });
}

export async function recordStripeInvoicePayment(
  client: AppSupabaseClient,
  input: RecordStripeInvoicePaymentInput
) {
  const parsed = recordStripeInvoicePaymentInputSchema.parse(input);

  const normalizedPaymentIntentId = normalizeStripeReference(parsed.stripePaymentIntentId);
  const normalizedChargeId = normalizeStripeReference(parsed.stripeChargeId);
  const normalizedEventId = normalizeStripeReference(parsed.stripeEventId) ?? parsed.stripeEventId;
  const normalizedReceiptUrl = normalizePaymentUrl(parsed.receiptUrl);
  const rpcArgs: Database["public"]["Functions"]["record_stripe_invoice_payment"]["Args"] = {
    target_company_id: parsed.companyId,
    target_job_id: parsed.jobId,
    target_invoice_id: parsed.invoiceId,
    target_stripe_checkout_session_id: parsed.stripeCheckoutSessionId,
    target_amount_cents: parsed.amountCents,
    target_currency_code: parsed.currencyCode,
    target_stripe_event_id: normalizedEventId,
    ...(normalizedPaymentIntentId ? { target_stripe_payment_intent_id: normalizedPaymentIntentId } : {}),
    ...(normalizedChargeId ? { target_stripe_charge_id: normalizedChargeId } : {}),
    ...(normalizedReceiptUrl ? { target_receipt_url: normalizedReceiptUrl } : {}),
    ...(parsed.paidAt ? { target_paid_at: parsed.paidAt } : {})
  };

  const rpcResult = await client.rpc("record_stripe_invoice_payment", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getPaymentById(client, rpcResult.data);
}

export async function recordManualInvoicePayment(
  client: AppSupabaseClient,
  input: RecordManualInvoicePaymentInput
) {
  const parsed = recordManualInvoicePaymentInputSchema.parse(input);
  const rpcArgs: {
    target_amount_cents: number;
    target_company_id: string;
    target_currency_code: "USD";
    target_invoice_id: string;
    target_job_id: string;
    target_manual_tender_type: string;
    target_paid_at?: string;
    target_manual_reference_note?: string;
    target_recorded_by_user_id?: string;
  } = {
    target_company_id: parsed.companyId,
    target_job_id: parsed.jobId,
    target_invoice_id: parsed.invoiceId,
    target_manual_tender_type: parsed.tenderType,
    target_amount_cents: parsed.amountCents,
    target_currency_code: parsed.currencyCode,
    ...(parsed.note ? { target_manual_reference_note: parsed.note } : {}),
    ...(parsed.recordedByUserId ? { target_recorded_by_user_id: parsed.recordedByUserId } : {}),
    ...(parsed.paidAt ? { target_paid_at: parsed.paidAt } : {})
  };

  const rpcResult = await (client as any).rpc("record_manual_invoice_payment", rpcArgs);

  if (rpcResult.error || !rpcResult.data) {
    return {
      ...rpcResult,
      data: null
    };
  }

  return getPaymentById(client, rpcResult.data);
}
