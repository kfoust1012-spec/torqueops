import {
  createInvoice,
  createInvoiceFromEstimate,
  getAssignedJobDetailForTechnician,
  getAssignedJobEstimateSummary,
  getAssignedJobInvoiceSummary,
  recalculateInvoiceTotals
} from "@mobile-mechanic/api-client";
import { getVehicleDisplayName } from "@mobile-mechanic/core";
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

function buildDefaultInvoiceSeed(input: {
  jobId: string;
  jobTitle: string;
  vehicleLabel: string;
}) {
  const todayToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const titleBase = input.vehicleLabel || input.jobTitle;

  return {
    invoiceNumber: `INV-${todayToken}-${input.jobId.slice(0, 4).toUpperCase()}`,
    title: `${titleBase} invoice`
  };
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  try {
    const { jobId } = await params;
    const [existingInvoiceResult, jobDetailResult, estimateResult] = await Promise.all([
      getAssignedJobInvoiceSummary(context.supabase, context.companyId, context.currentUserId, jobId),
      getAssignedJobDetailForTechnician(context.supabase, context.companyId, context.currentUserId, jobId),
      getAssignedJobEstimateSummary(context.supabase, context.companyId, context.currentUserId, jobId)
    ]);

    if (existingInvoiceResult.error) {
      throw existingInvoiceResult.error;
    }

    if (existingInvoiceResult.data) {
      return withMobileCors(
        request,
        NextResponse.json({
          ok: true,
          created: false,
          invoiceId: existingInvoiceResult.data.invoice.id,
          lineItemCount: existingInvoiceResult.data.lineItems.length,
          message: "This stop already has an invoice draft open.",
          title: "Invoice already exists"
        })
      );
    }

    if (jobDetailResult.error || !jobDetailResult.data) {
      throw jobDetailResult.error ?? new Error("Assigned job not found.");
    }

    if (estimateResult.error) {
      throw estimateResult.error;
    }

    if (!estimateResult.data) {
      throw new Error("Build the estimate before creating the invoice.");
    }

    if (!estimateResult.data.lineItems.length) {
      throw new Error("Add at least one billable line to the estimate before creating the invoice.");
    }

    const serviceRole = getServiceRoleSupabaseClient() as any;
    const jobDetail = jobDetailResult.data;
    const estimateDetail = estimateResult.data;
    const vehicleLabel = getVehicleDisplayName(jobDetail.vehicle);
    const seed = buildDefaultInvoiceSeed({
      jobId,
      jobTitle: jobDetail.job.title,
      vehicleLabel
    });

    let invoiceId: string;
    let lineItemCount = estimateDetail.lineItems.length;

    if (estimateDetail.estimate.status === "accepted") {
      const createdInvoiceResult = await createInvoiceFromEstimate(serviceRole, {
        companyId: context.companyId,
        createdByUserId: context.currentUserId,
        estimateId: estimateDetail.estimate.id,
        invoiceNumber: seed.invoiceNumber,
        jobId
      });

      if (createdInvoiceResult.error || !createdInvoiceResult.data) {
        throw createdInvoiceResult.error ?? new Error("Invoice draft could not be created.");
      }

      invoiceId = createdInvoiceResult.data.id;
    } else {
      const createdInvoiceResult = await createInvoice(serviceRole, {
        companyId: context.companyId,
        createdByUserId: context.currentUserId,
        discountCents: estimateDetail.estimate.discountCents,
        dueAt: null,
        estimateId: null,
        invoiceNumber: seed.invoiceNumber,
        jobId,
        notes: estimateDetail.estimate.notes,
        taxRateBasisPoints: estimateDetail.estimate.taxRateBasisPoints,
        terms: estimateDetail.estimate.terms,
        title: estimateDetail.estimate.title || seed.title
      });

      if (createdInvoiceResult.error || !createdInvoiceResult.data) {
        throw createdInvoiceResult.error ?? new Error("Invoice draft could not be created.");
      }

      invoiceId = createdInvoiceResult.data.id;
      const invoiceLineItems = estimateDetail.lineItems.map((lineItem) => ({
        actual_cost_cents: lineItem.actualCostCents,
        company_id: context.companyId,
        description: lineItem.description,
        estimated_cost_cents: lineItem.estimatedCostCents,
        invoice_id: invoiceId,
        item_type: lineItem.itemType,
        job_id: jobId,
        line_subtotal_cents: lineItem.lineSubtotalCents,
        name: lineItem.name,
        part_request_line_id: lineItem.partRequestLineId,
        position: lineItem.position,
        quantity: lineItem.quantity,
        taxable: lineItem.taxable,
        unit_price_cents: lineItem.unitPriceCents
      }));

      if (invoiceLineItems.length) {
        const insertResult = await serviceRole.from("invoice_line_items").insert(invoiceLineItems);

        if (insertResult.error) {
          throw insertResult.error;
        }
      }

      const recalculatedInvoiceResult = await recalculateInvoiceTotals(serviceRole, invoiceId);

      if (recalculatedInvoiceResult.error || !recalculatedInvoiceResult.data) {
        throw recalculatedInvoiceResult.error ?? new Error("Invoice totals could not be calculated.");
      }
    }

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        created: true,
        invoiceId,
        lineItemCount,
        message:
          estimateDetail.estimate.status === "accepted"
            ? "The invoice draft was created from the approved estimate."
            : "The invoice draft was created from the current estimate lines.",
        title: "Invoice draft created"
      })
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Invoice draft could not be created.";
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
