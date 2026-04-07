import {
  createInvoiceLineItem,
  getAssignedJobInvoiceSummary
} from "@mobile-mechanic/api-client";
import { createInvoiceLineItemInputSchema } from "@mobile-mechanic/validation";
import { NextResponse } from "next/server";

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

async function ensureAssignedDraftInvoice(
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

  if (assignedInvoiceResult.data.invoice.status !== "draft") {
    throw new Error("Only draft invoices can be edited from the field.");
  }

  return assignedInvoiceResult.data.invoice.id;
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    );
  }

  try {
    const { jobId } = await params;
    const invoiceId = await ensureAssignedDraftInvoice(
      context.companyId,
      context.currentUserId,
      jobId,
      context.supabase
    );
    const parsed = createInvoiceLineItemInputSchema.parse(body);
    const serviceRole = getServiceRoleSupabaseClient() as any;
    const result = await createInvoiceLineItem(serviceRole, invoiceId, parsed);

    if (result.error || !result.data) {
      throw result.error ?? new Error("Invoice line item could not be created.");
    }

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        lineItem: result.data
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Invoice line item could not be created.";

    return withMobileCors(request, NextResponse.json({ error: message }, { status: 400 }));
  }
}
