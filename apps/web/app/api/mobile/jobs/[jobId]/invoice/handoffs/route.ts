import type {
  CreateTechnicianPaymentHandoffInput,
  TechnicianPaymentHandoff
} from "@mobile-mechanic/types";
import { createTechnicianPaymentHandoffInputSchema } from "@mobile-mechanic/validation";
import { getAssignedJobInvoiceSummary } from "@mobile-mechanic/api-client";
import { NextResponse } from "next/server";

import {
  listTechnicianPaymentHandoffsByInvoice,
  mapTechnicianPaymentHandoffRow
} from "../../../../../../../lib/invoices/payment-handoffs";
import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../../../lib/mobile-api-context";
import { getServiceRoleSupabaseClient } from "../../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function OPTIONS(request: Request) {
  return buildMobileCorsPreflightResponse(request);
}

async function ensureAssignedInvoice(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  client: any
) {
  const assignedInvoiceResult = await getAssignedJobInvoiceSummary(
    client,
    companyId,
    technicianUserId,
    jobId
  );

  if (assignedInvoiceResult.error || !assignedInvoiceResult.data) {
    throw assignedInvoiceResult.error ?? new Error("Assigned job invoice not found.");
  }

  return assignedInvoiceResult.data.invoice.id;
}

export async function GET(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  try {
    const { jobId } = await params;
    const invoiceId = await ensureAssignedInvoice(
      context.companyId,
      context.currentUserId,
      jobId,
      context.supabase
    );
    const serviceRole = getServiceRoleSupabaseClient() as any;
    const handoffs = await listTechnicianPaymentHandoffsByInvoice(serviceRole, invoiceId);

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        handoffs
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Payment handoffs could not be loaded.";

    return withMobileCors(request, NextResponse.json({ error: message }, { status: 400 }));
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as CreateTechnicianPaymentHandoffInput | null;

  if (!body) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    );
  }

  try {
    const { jobId } = await params;
    const invoiceId = await ensureAssignedInvoice(
      context.companyId,
      context.currentUserId,
      jobId,
      context.supabase
    );
    const parsed = createTechnicianPaymentHandoffInputSchema.parse(body);
    const serviceRole = getServiceRoleSupabaseClient() as any;
    const result = await serviceRole
      .from("technician_payment_handoffs")
      .insert({
        amount_cents: parsed.amountCents ?? null,
        company_id: context.companyId,
        customer_promise_at: parsed.customerPromiseAt ?? null,
        invoice_id: invoiceId,
        job_id: jobId,
        kind: parsed.kind,
        note: parsed.note?.trim() || null,
        technician_user_id: context.currentUserId,
        tender_type: parsed.tenderType ?? null
      })
      .select("*")
      .single();

    if (result.error || !result.data) {
      throw result.error ?? new Error("Payment handoff could not be recorded.");
    }

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        handoff: mapTechnicianPaymentHandoffRow(result.data as any)
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Payment handoff could not be recorded.";
    const normalized = message.toLowerCase();
    const status =
      normalized === "unauthorized"
        ? 401
        : normalized === "forbidden"
          ? 403
          : 400;

    return withMobileCors(request, NextResponse.json({ error: message }, { status }));
  }
}
