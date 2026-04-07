import {
  clearInvoicePaymentLink,
  getInvoiceById,
  recordStripeInvoicePayment
} from "@mobile-mechanic/api-client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { completeInvoiceAccessLinkAfterPayment } from "../../../../lib/customer-documents/service";
import {
  buildAutoResolvedTechnicianPaymentHandoffNote,
  resolveOpenTechnicianPaymentHandoffsByInvoiceId
} from "../../../../lib/invoices/payment-handoffs";
import { applyJobWorkflowAutomation } from "../../../../lib/jobs/field-status-automation";
import { getServerEnv } from "../../../../lib/server-env";
import { getStripeClient } from "../../../../lib/stripe";
import { getServiceRoleSupabaseClient } from "../../../../lib/supabase/service-role";

export const runtime = "nodejs";

function getStringMetadata(
  metadata: Record<string, string> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isInvoiceAlreadyReconciled(invoice: {
  status: string;
  balanceDueCents: number;
}): boolean {
  return invoice.status === "paid" && invoice.balanceDueCents === 0;
}

async function completeCustomerInvoiceLink(customerDocumentLinkId: string | null) {
  if (!customerDocumentLinkId) {
    return;
  }

  try {
    await completeInvoiceAccessLinkAfterPayment(customerDocumentLinkId);
  } catch (error) {
    console.error("Failed to complete customer invoice link after payment.", {
      customerDocumentLinkId,
      error: error instanceof Error ? error.message : error
    });
  }
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, getServerEnv().STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid Stripe webhook signature."
      },
      { status: 400 }
    );
  }

  const supabase = getServiceRoleSupabaseClient();

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;

    if (checkoutSession.mode === "payment" && checkoutSession.payment_status === "paid") {
      const invoiceId = getStringMetadata(checkoutSession.metadata, "invoiceId");
      const companyId = getStringMetadata(checkoutSession.metadata, "companyId");
      const jobId = getStringMetadata(checkoutSession.metadata, "jobId");
      const customerDocumentLinkId = getStringMetadata(checkoutSession.metadata, "customerDocumentLinkId");
      const amountCents = checkoutSession.amount_total ?? 0;

      if (!invoiceId || !companyId || !jobId) {
        return NextResponse.json(
          { error: "Stripe session metadata is incomplete for invoice reconciliation." },
          { status: 400 }
        );
      }

      if (amountCents <= 0) {
        return NextResponse.json(
          { error: "Stripe session amount_total must be positive for invoice reconciliation." },
          { status: 400 }
        );
      }

      if (checkoutSession.currency !== "usd") {
        return NextResponse.json(
          { error: "Stripe session currency must be USD for invoice reconciliation." },
          { status: 400 }
        );
      }

      const [invoiceResult, existingPaymentResult] = await Promise.all([
        getInvoiceById(supabase, invoiceId),
        supabase
          .from("payments")
          .select("id")
          .eq("stripe_checkout_session_id", checkoutSession.id)
          .maybeSingle()
      ]);

      if (invoiceResult.error || !invoiceResult.data) {
        return NextResponse.json(
          { error: "Invoice not found for reconciliation." },
          { status: 404 }
        );
      }

      if (existingPaymentResult.error) {
        throw existingPaymentResult.error;
      }

      if (existingPaymentResult.data) {
        return NextResponse.json({ received: true });
      }

      if (isInvoiceAlreadyReconciled(invoiceResult.data)) {
        await completeCustomerInvoiceLink(customerDocumentLinkId);
        return NextResponse.json({ received: true });
      }

      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id ?? null;

      let chargeId: string | null = null;
      let receiptUrl: string | null = null;

      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"]
        });

        const latestCharge =
          typeof paymentIntent.latest_charge === "string" ? null : paymentIntent.latest_charge;

        chargeId = latestCharge?.id ?? null;
        receiptUrl = latestCharge?.receipt_url ?? null;
      }

      const paymentResult = await recordStripeInvoicePayment(supabase, {
        companyId,
        jobId,
        invoiceId,
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
        stripeEventId: event.id,
        amountCents,
        currencyCode: "USD",
        receiptUrl,
        paidAt: new Date(event.created * 1000).toISOString()
      });

      if (paymentResult.error) {
        const refreshedInvoiceResult = await getInvoiceById(supabase, invoiceId);

        if (!refreshedInvoiceResult.error && refreshedInvoiceResult.data && isInvoiceAlreadyReconciled(refreshedInvoiceResult.data)) {
          await completeCustomerInvoiceLink(customerDocumentLinkId);
          return NextResponse.json({ received: true });
        }

        throw paymentResult.error;
      }

      if (!paymentResult.data) {
        await completeCustomerInvoiceLink(customerDocumentLinkId);
        return NextResponse.json({ received: true });
      }

      await resolveOpenTechnicianPaymentHandoffsByInvoiceId(
        supabase,
        invoiceId,
        null,
        {
          resolutionNote: buildAutoResolvedTechnicianPaymentHandoffNote({
            amountCents: paymentResult.data.amountCents,
            provider: "stripe"
          })
        }
      );

      const refreshedInvoiceResult = await getInvoiceById(supabase, invoiceId);

      if (!refreshedInvoiceResult.error && refreshedInvoiceResult.data) {
        await applyJobWorkflowAutomation({
          jobId,
          signal: {
            balanceDueCents: refreshedInvoiceResult.data.balanceDueCents,
            invoiceStatus: refreshedInvoiceResult.data.status,
            kind: "invoice_settled"
          },
          supabase
        });
      }

      await completeCustomerInvoiceLink(customerDocumentLinkId);
    }
  }

  if (event.type === "checkout.session.expired") {
    const checkoutSession = event.data.object;
    const invoiceId = getStringMetadata(checkoutSession.metadata, "invoiceId");

    if (invoiceId) {
      const invoiceResult = await getInvoiceById(supabase, invoiceId);

      if (
        !invoiceResult.error &&
        invoiceResult.data &&
        invoiceResult.data.stripeCheckoutSessionId === checkoutSession.id
      ) {
        await clearInvoicePaymentLink(supabase, invoiceId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
