import {
  changeInvoiceStatus,
  enqueueInvoiceNotification,
  enqueuePaymentReminder,
  getAssignedJobInvoiceSummary
} from "@mobile-mechanic/api-client";
import { canInvoiceAcceptPayments } from "@mobile-mechanic/core";
import { NextResponse } from "next/server";

import { processCommunicationMutationResult } from "../../../../../../../lib/communications/actions";
import {
  createInvoiceCheckoutForOffice,
  ensureInvoiceAccessLink,
  isInvoiceCheckoutPendingError,
  isInvoiceCheckoutRotationError,
  markInvoiceAccessLinkSent
} from "../../../../../../../lib/customer-documents/service";
import { applyJobWorkflowAutomation } from "../../../../../../../lib/jobs/field-status-automation";
import {
  buildMobileCorsPreflightResponse,
  requireMobileApiContext,
  withMobileCors
} from "../../../../../../../lib/mobile-api-context";
import { isStripeUnavailableError } from "../../../../../../../lib/stripe";
import { getServiceRoleSupabaseClient } from "../../../../../../../lib/supabase/service-role";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    jobId: string;
  }>;
};

const mobileInvoiceActions = [
  "issue_invoice",
  "refresh_payment_page",
  "send_invoice_link",
  "send_payment_reminder"
] as const;

type MobileInvoiceAction = (typeof mobileInvoiceActions)[number];

function isMobileInvoiceAction(value: unknown): value is MobileInvoiceAction {
  return (
    typeof value === "string" &&
    mobileInvoiceActions.includes(value as MobileInvoiceAction)
  );
}

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

async function sendInvoiceLink(input: {
  actorUserId: string;
  invoiceId: string;
  resend: boolean;
  serviceRole: any;
}) {
  const linkSummary = await ensureInvoiceAccessLink({
    invoiceId: input.invoiceId,
    actorUserId: input.actorUserId
  });
  const communication = await enqueueInvoiceNotification(input.serviceRole, {
    invoiceId: input.invoiceId,
    actorUserId: input.actorUserId,
    actionUrl: linkSummary.publicUrl,
    ...(input.resend ? { resend: true } : {})
  });
  const processed = await processCommunicationMutationResult(
    communication,
    "Failed to queue invoice notification."
  );

  await markInvoiceAccessLinkSent(linkSummary.linkId, processed.id, input.actorUserId);
  return linkSummary;
}

async function sendPaymentReminderLink(input: {
  actorUserId: string;
  invoiceId: string;
  serviceRole: any;
}) {
  const linkSummary = await ensureInvoiceAccessLink({
    invoiceId: input.invoiceId,
    actorUserId: input.actorUserId
  });
  const communication = await enqueuePaymentReminder(input.serviceRole, {
    invoiceId: input.invoiceId,
    actorUserId: input.actorUserId,
    actionUrl: linkSummary.publicUrl,
    resend: true
  });
  const processed = await processCommunicationMutationResult(
    communication,
    "Failed to queue payment reminder."
  );

  await markInvoiceAccessLinkSent(linkSummary.linkId, processed.id, input.actorUserId);
}

async function preparePaymentPage(invoiceId: string) {
  try {
    return {
      checkoutUrl: await createInvoiceCheckoutForOffice({ invoiceId }),
      tone: "success" as const,
      warningMessage: null
    };
  } catch (error) {
    if (isInvoiceCheckoutPendingError(error)) {
      return {
        checkoutUrl: null,
        tone: "warning" as const,
        warningMessage:
          "Payment was already submitted and is waiting for final reconciliation."
      };
    }

    if (isInvoiceCheckoutRotationError(error)) {
      throw new Error("The payment page could not be refreshed safely right now.");
    }

    if (isStripeUnavailableError(error)) {
      throw new Error("Online payment is not configured right now.");
    }

    throw error;
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const { context, response } = await requireMobileApiContext(request);

  if (!context) {
    return withMobileCors(request, response);
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (!isMobileInvoiceAction(action)) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "Invalid invoice action." }, { status: 400 })
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
    const serviceRole = getServiceRoleSupabaseClient() as any;

    switch (action) {
      case "issue_invoice": {
        let invoiceStatusAfterIssueAction = detail.invoice.status;
        let checkoutUrl: string | null = null;
        const followUpWarnings: string[] = [];
        let tone: "success" | "warning" = "success";

        if (detail.invoice.status === "draft") {
          const statusResult = await changeInvoiceStatus(serviceRole, detail.invoice.id, {
            status: "issued"
          });

          if (statusResult.error || !statusResult.data) {
            throw statusResult.error ?? new Error("Invoice could not be issued.");
          }

          invoiceStatusAfterIssueAction = statusResult.data.status;
        }

        await applyJobWorkflowAutomation({
          jobId,
          signal: {
            invoiceStatus: invoiceStatusAfterIssueAction,
            kind: "invoice_issued"
          },
          supabase: serviceRole
        });

        try {
          if (!["issued", "partially_paid", "paid"].includes(detail.invoice.status)) {
            await sendInvoiceLink({
              actorUserId: context.currentUserId,
              invoiceId: detail.invoice.id,
              resend: false,
              serviceRole
            });
          } else {
            await sendInvoiceLink({
              actorUserId: context.currentUserId,
              invoiceId: detail.invoice.id,
              resend: true,
              serviceRole
            });
          }
        } catch (error) {
          tone = "warning";
          followUpWarnings.push(
            error instanceof Error && error.message.trim()
              ? error.message
              : "The customer invoice link could not be sent from the field workflow."
          );
        }

        if (detail.totals.balanceDueCents > 0) {
          try {
            const paymentPage = await preparePaymentPage(detail.invoice.id);

            checkoutUrl = paymentPage.checkoutUrl;

            if (paymentPage.warningMessage) {
              tone = "warning";
              followUpWarnings.push(paymentPage.warningMessage);
            } else if (paymentPage.tone === "warning") {
              tone = "warning";
            }
          } catch (error) {
            tone = "warning";
            followUpWarnings.push(
              error instanceof Error && error.message.trim()
                ? error.message
                : "The payment page could not be prepared from the field workflow."
            );
          }
        }

        return withMobileCors(
          request,
          NextResponse.json({
            ok: true,
            action,
            checkoutUrl,
            message: followUpWarnings.length
              ? `The invoice is issued and the stop is ready for payment. ${followUpWarnings.join(" ")}`
              : checkoutUrl
                ? "The invoice is issued, the customer link was sent, and the payment page is ready."
                : "The invoice is issued and the customer link was sent.",
            title: followUpWarnings.length
              ? "Invoice issued with follow-up"
              : checkoutUrl
                ? "Invoice issued and ready"
                : "Invoice issued",
            tone
          })
        );
      }
      case "refresh_payment_page": {
        if (!canInvoiceAcceptPayments(detail.invoice.status)) {
          throw new Error("Issue the invoice before preparing the payment page.");
        }

        if (detail.totals.balanceDueCents <= 0) {
          throw new Error("This invoice has no balance due.");
        }

        const paymentPage = await preparePaymentPage(detail.invoice.id);

        return withMobileCors(
          request,
          NextResponse.json({
            ok: true,
            action,
            checkoutUrl: paymentPage.checkoutUrl,
            message:
              paymentPage.warningMessage ??
              "The live payment page is ready for customer checkout.",
            title:
              paymentPage.tone === "warning" ? "Payment already submitted" : "Payment page ready",
            tone: paymentPage.tone
          })
        );
      }
      case "send_invoice_link": {
        if (!["issued", "partially_paid", "paid"].includes(detail.invoice.status)) {
          throw new Error("Issue the invoice before sending the customer link.");
        }

        await sendInvoiceLink({
          actorUserId: context.currentUserId,
          invoiceId: detail.invoice.id,
          resend: true,
          serviceRole
        });

        return withMobileCors(
          request,
          NextResponse.json({
            ok: true,
            action,
            checkoutUrl: null,
            message: "The invoice link was sent again from the field workflow.",
            title: "Invoice link sent",
            tone: "success" as const
          })
        );
      }
      case "send_payment_reminder": {
        if (!canInvoiceAcceptPayments(detail.invoice.status)) {
          throw new Error("Issue the invoice before sending a payment reminder.");
        }

        if (detail.totals.balanceDueCents <= 0) {
          throw new Error("This invoice has no balance due.");
        }

        await sendPaymentReminderLink({
          actorUserId: context.currentUserId,
          invoiceId: detail.invoice.id,
          serviceRole
        });

        return withMobileCors(
          request,
          NextResponse.json({
            ok: true,
            action,
            checkoutUrl: null,
            message: "The customer payment reminder is queued from the mobile workflow.",
            title: "Payment reminder sent",
            tone: "success" as const
          })
        );
      }
      default:
        throw new Error("Invalid invoice action.");
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Invoice action could not be completed.";
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
