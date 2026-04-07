import {
  getInvoiceById,
  listMembershipsForUser
} from "@mobile-mechanic/api-client";
import { canEditCustomerRecords, canInvoiceAcceptPayments } from "@mobile-mechanic/core";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "../../../../lib/auth";
import {
  createInvoiceCheckoutForOffice,
  isInvoiceCheckoutRotationError,
  isInvoiceCheckoutPendingError
} from "../../../../lib/customer-documents/service";
import { buildAppUrl } from "../../../../lib/server-env";
import { isStripeUnavailableError } from "../../../../lib/stripe";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const invoiceId = formData.get("invoiceId");

  if (typeof invoiceId !== "string" || !invoiceId.trim()) {
    return NextResponse.json({ error: "Invoice id is required." }, { status: 400 });
  }

  const invoiceResult = await getInvoiceById(supabase, invoiceId);

  if (invoiceResult.error || !invoiceResult.data) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const invoiceSummary = invoiceResult.data;

  const membershipsResult = await listMembershipsForUser(supabase, user.id);

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const membership = (membershipsResult.data ?? []).find(
    (candidate) =>
      candidate.company_id === invoiceSummary.companyId &&
      candidate.is_active &&
      canEditCustomerRecords(candidate.role)
  );

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = invoiceSummary;

  if (!canInvoiceAcceptPayments(invoice.status)) {
    return NextResponse.json({ error: "This invoice cannot accept payments." }, { status: 400 });
  }

  if (invoice.balanceDueCents <= 0) {
    return NextResponse.json({ error: "This invoice has no balance due." }, { status: 400 });
  }

  try {
    const checkoutUrl = await createInvoiceCheckoutForOffice({
      invoiceId: invoice.id
    });

    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    if (isInvoiceCheckoutPendingError(error)) {
      return NextResponse.redirect(
        buildAppUrl(`dashboard/visits/${invoice.jobId}/invoice?checkout=success`),
        303
      );
    }

    if (isInvoiceCheckoutRotationError(error)) {
      return NextResponse.redirect(
        buildAppUrl(`dashboard/visits/${invoice.jobId}/invoice?checkout=unavailable`),
        303
      );
    }

    if (!isStripeUnavailableError(error)) {
      throw error;
    }

    return NextResponse.redirect(
      buildAppUrl(`dashboard/visits/${invoice.jobId}/invoice?checkout=unavailable`),
      303
    );
  }
}
