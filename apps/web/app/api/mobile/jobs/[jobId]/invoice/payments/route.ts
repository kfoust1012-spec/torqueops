import {
  getAssignedJobInvoiceSummary,
  getInvoiceById,
  recordManualInvoicePayment
} from "@mobile-mechanic/api-client";
import { canInvoiceAcceptPayments } from "@mobile-mechanic/core";
import type { RecordManualInvoicePaymentInput } from "@mobile-mechanic/types";
import { recordManualInvoicePaymentInputSchema } from "@mobile-mechanic/validation";
import { NextResponse } from "next/server";

import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../../../lib/mobile-api-context";
import {
  buildAutoResolvedTechnicianPaymentHandoffNote,
  resolveOpenTechnicianPaymentHandoffsByInvoiceId
} from "../../../../../../../lib/invoices/payment-handoffs";
import { applyJobWorkflowAutomation } from "../../../../../../../lib/jobs/field-status-automation";
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

async function ensureAssignedInvoiceDetail(
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

  return assignedInvoiceResult.data;
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as
    | Omit<RecordManualInvoicePaymentInput, "companyId" | "invoiceId" | "jobId">
    | null;

  if (!body) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    );
  }

  try {
    const { jobId } = await params;
    const detail = await ensureAssignedInvoiceDetail(
      context.companyId,
      context.currentUserId,
      jobId,
      context.supabase
    );

    if (!canInvoiceAcceptPayments(detail.invoice.status)) {
      throw new Error("Issue the invoice before recording a field payment.");
    }

    if (detail.totals.balanceDueCents <= 0) {
      throw new Error("This invoice has no balance due.");
    }

    const parsed = recordManualInvoicePaymentInputSchema.parse({
      amountCents: body.amountCents,
      companyId: context.companyId,
      currencyCode: "USD",
      invoiceId: detail.invoice.id,
      jobId,
      note: body.note,
      paidAt: body.paidAt,
      recordedByUserId: context.currentUserId,
      tenderType: body.tenderType
    });
    const serviceRole = getServiceRoleSupabaseClient() as any;
    const result = await recordManualInvoicePayment(serviceRole, parsed);

    if (result.error || !result.data) {
      throw result.error ?? new Error("Field payment could not be recorded.");
    }

    await resolveOpenTechnicianPaymentHandoffsByInvoiceId(
      serviceRole,
      detail.invoice.id,
      context.currentUserId,
      {
        resolutionNote: buildAutoResolvedTechnicianPaymentHandoffNote({
          amountCents: result.data.amountCents,
          provider: "manual"
        })
      }
    );

    const refreshedInvoiceResult = await getInvoiceById(serviceRole, detail.invoice.id);

    if (!refreshedInvoiceResult.error && refreshedInvoiceResult.data) {
      await applyJobWorkflowAutomation({
        jobId,
        signal: {
          balanceDueCents: refreshedInvoiceResult.data.balanceDueCents,
          invoiceStatus: refreshedInvoiceResult.data.status,
          kind: "invoice_settled"
        },
        supabase: serviceRole
      });
    }

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        payment: result.data
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Field payment could not be recorded.";
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
