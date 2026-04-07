import {
  enqueueAppointmentConfirmation,
  enqueueDispatchUpdate,
  enqueueEstimateNotification,
  enqueueInvoiceNotification,
  enqueuePaymentReminder,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById
} from "@mobile-mechanic/api-client";
import { isInvoiceEligibleForReminder } from "@mobile-mechanic/core";
import { NextResponse } from "next/server";

import { processCommunicationMutationResult } from "../../../../../../lib/communications/actions";
import { enqueueFollowUpCustomerCommunication } from "../../../../../../lib/communications/follow-up";
import {
  ensureEstimateAccessLink,
  ensureInvoiceAccessLink,
  ensureJobVisitAccessLink,
  markEstimateAccessLinkSent,
  markInvoiceAccessLinkSent,
  markJobVisitAccessLinkSent
} from "../../../../../../lib/customer-documents/service";
import { getTechnicianProfilePreview } from "../../../../../../lib/technician-profiles/service";
import { parseJsonRequest, requireVisitsWorkboardApiContext } from "../../_shared";

export const runtime = "nodejs";

type CommunicationRequestBody =
  | {
      action: "appointment_confirmation";
    }
  | {
      action: "dispatch_update";
      updateType?: "dispatched" | "en_route";
    }
  | {
      action: "estimate_notification";
    }
  | {
      action: "invoice_notification";
    }
  | {
      action: "payment_reminder";
    }
  | {
      action:
        | "follow_up_awaiting_parts"
        | "follow_up_booked"
        | "follow_up_rescheduled"
        | "follow_up_status_update";
    };

export async function POST(
  request: Request,
  { params }: { params: Promise<unknown> }
) {
  const { context, response } = await requireVisitsWorkboardApiContext();

  if (!context) {
    return response;
  }

  const { jobId } = (await params) as { jobId: string };
  const body = await parseJsonRequest<CommunicationRequestBody>(request);

  if (!body?.action) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const latestJobResult = await getJobById(context.supabase, jobId);

  if (latestJobResult.error || !latestJobResult.data) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  if (latestJobResult.data.companyId !== context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "appointment_confirmation") {
    const preview = await getTechnicianProfilePreview(
      context.supabase,
      latestJobResult.data.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureJobVisitAccessLink({
          actorUserId: context.currentUserId,
          jobId
        })
      : null;
    const result = await enqueueAppointmentConfirmation(context.supabase, {
      actorUserId: context.currentUserId,
      jobId,
      resend: true,
      visitUrl: visitLink?.publicUrl ?? null
    });

    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue appointment confirmation."
    );

    if (visitLink) {
      await markJobVisitAccessLinkSent(
        visitLink.linkId,
        communication.id,
        context.currentUserId
      );
    }

    return NextResponse.json({ communicationType: "appointment_confirmation", ok: true });
  }

  if (body.action === "estimate_notification") {
    const estimateResult = await getEstimateByJobId(context.supabase, jobId);

    if (estimateResult.error || !estimateResult.data || estimateResult.data.status !== "sent") {
      return NextResponse.json({ error: "Sent estimate not found." }, { status: 400 });
    }

    const linkSummary = await ensureEstimateAccessLink({
      actorUserId: context.currentUserId,
      estimateId: estimateResult.data.id,
      rotate: true
    });
    const result = await enqueueEstimateNotification(context.supabase, {
      actorUserId: context.currentUserId,
      actionUrl: linkSummary.publicUrl,
      estimateId: estimateResult.data.id,
      resend: true
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue estimate notification."
    );

    await markEstimateAccessLinkSent(
      linkSummary.linkId,
      communication.id,
      context.currentUserId
    );

    return NextResponse.json({ communicationType: "estimate_notification", ok: true });
  }

  if (
    body.action === "follow_up_awaiting_parts" ||
    body.action === "follow_up_booked" ||
    body.action === "follow_up_rescheduled" ||
    body.action === "follow_up_status_update"
  ) {
    const result = await enqueueFollowUpCustomerCommunication({
      action: body.action,
      actorUserId: context.currentUserId,
      companyId: context.companyId,
      jobId,
      resend: true,
      supabase: context.supabase,
      timeZone: context.company.timezone
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue follow-up communication."
    );

    return NextResponse.json({
      communicationId: communication.id,
      communicationType:
        body.action === "follow_up_booked" || body.action === "follow_up_rescheduled"
          ? "appointment_confirmation"
          : "dispatch_update",
      ok: true
    });
  }

  if (body.action === "invoice_notification" || body.action === "payment_reminder") {
    const invoiceResult = await getInvoiceByJobId(context.supabase, jobId);

    if (
      invoiceResult.error ||
      !invoiceResult.data ||
      !["issued", "partially_paid"].includes(invoiceResult.data.status)
    ) {
      return NextResponse.json({ error: "Issued invoice not found." }, { status: 400 });
    }

    const linkSummary = await ensureInvoiceAccessLink({
      actorUserId: context.currentUserId,
      invoiceId: invoiceResult.data.id,
      rotate: body.action === "invoice_notification"
    });

    if (body.action === "invoice_notification") {
      const result = await enqueueInvoiceNotification(context.supabase, {
        actorUserId: context.currentUserId,
        actionUrl: linkSummary.publicUrl,
        invoiceId: invoiceResult.data.id,
        resend: true
      });
      const communication = await processCommunicationMutationResult(
        result,
        "Failed to queue invoice notification."
      );

      await markInvoiceAccessLinkSent(
        linkSummary.linkId,
        communication.id,
        context.currentUserId
      );

      return NextResponse.json({ communicationType: "invoice_notification", ok: true });
    }

    if (
      !isInvoiceEligibleForReminder({
        balanceDueCents: invoiceResult.data.balanceDueCents,
        dueAt: invoiceResult.data.dueAt,
        status: invoiceResult.data.status
      })
    ) {
      return NextResponse.json({ error: "Invoice is not eligible for reminder." }, { status: 400 });
    }

    const result = await enqueuePaymentReminder(context.supabase, {
      actorUserId: context.currentUserId,
      actionUrl: linkSummary.publicUrl,
      invoiceId: invoiceResult.data.id,
      resend: true
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue payment reminder."
    );

    await markInvoiceAccessLinkSent(
      linkSummary.linkId,
      communication.id,
      context.currentUserId
    );

    return NextResponse.json({ communicationType: "payment_reminder", ok: true });
  }

  if (body.action !== "dispatch_update") {
    return NextResponse.json({ error: "Unsupported communication action." }, { status: 400 });
  }

  if (!body.updateType || !["dispatched", "en_route"].includes(body.updateType)) {
    return NextResponse.json({ error: "Dispatch update type is required." }, { status: 400 });
  }

  const preview = await getTechnicianProfilePreview(
    context.supabase,
    latestJobResult.data.assignedTechnicianUserId
  );
  const visitLink = preview.isReady
    ? await ensureJobVisitAccessLink({
        actorUserId: context.currentUserId,
        jobId
      })
    : null;
  const result = await enqueueDispatchUpdate(context.supabase, {
    actorUserId: context.currentUserId,
    jobId,
    resend: true,
    updateType: body.updateType,
    visitUrl: visitLink?.publicUrl ?? null
  });

  const communication = await processCommunicationMutationResult(
    result,
    "Failed to queue dispatch update."
  );

  if (visitLink) {
    await markJobVisitAccessLinkSent(
      visitLink.linkId,
      communication.id,
      context.currentUserId
    );
  }

  return NextResponse.json({ communicationType: "dispatch_update", ok: true });
}
