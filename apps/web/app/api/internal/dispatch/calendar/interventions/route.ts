import {
  type AppSupabaseClient,
  enqueueAppointmentConfirmation,
  enqueueDispatchUpdate,
  enqueueEstimateNotification,
  enqueuePaymentReminder,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  quickEditDispatchJob
} from "@mobile-mechanic/api-client";
import {
  isInvoiceEligibleForReminder,
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import { resolveTechnicianPaymentHandoffInputSchema } from "@mobile-mechanic/validation";
import type { ResolveTechnicianPaymentHandoffInput } from "@mobile-mechanic/types";
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
import { resolveOpenTechnicianPaymentHandoffsByInvoiceId } from "../../../../../../lib/invoices/payment-handoffs";
import {
  getFollowUpCommunicationAction,
  getVisitFollowUpSummary
} from "../../../../../../lib/jobs/follow-up";
import { getTechnicianProfilePreview } from "../../../../../../lib/technician-profiles/service";
import { parseJsonRequest, requireDispatchApiContext } from "../_shared";

export const runtime = "nodejs";

type BatchInterventionRequestBody = {
  action:
    | "notify_promise_risk"
    | "notify_stale_approvals"
    | "notify_stale_returns"
    | "defer_low_confidence"
    | "notify_closeout_risk"
    | "resolve_closeout_handoff";
  jobIds?: string[];
  resolutionDisposition?: string | null;
  resolutionNote?: string | null;
};

async function queuePromiseRiskCommunication(input: {
  actorUserId: string;
  companyId: string;
  jobId: string;
  supabase: AppSupabaseClient;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  const latestJob = latestJobResult.data;

  if (latestJob.status === "completed" || latestJob.status === "canceled") {
    return false;
  }

  if (latestJob.status === "scheduled" && latestJob.scheduledStartAt) {
    const preview = await getTechnicianProfilePreview(
      input.supabase,
      latestJob.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureJobVisitAccessLink({
          actorUserId: input.actorUserId,
          jobId: input.jobId
        })
      : null;
    const result = await enqueueAppointmentConfirmation(input.supabase, {
      actorUserId: input.actorUserId,
      jobId: input.jobId,
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
        input.actorUserId
      );
    }

    return true;
  }

  if (!latestJob.assignedTechnicianUserId || latestJob.status === "new") {
    return false;
  }

  const preview = await getTechnicianProfilePreview(
    input.supabase,
    latestJob.assignedTechnicianUserId
  );
  const visitLink = preview.isReady
    ? await ensureJobVisitAccessLink({
        actorUserId: input.actorUserId,
        jobId: input.jobId
      })
    : null;
  const result = await enqueueDispatchUpdate(input.supabase, {
    actorUserId: input.actorUserId,
    jobId: input.jobId,
    resend: true,
    updateType: isTechnicianTravelJobStatus(latestJob.status) ? "en_route" : "dispatched",
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
      input.actorUserId
    );
  }

  return true;
}

async function queueStaleApprovalCommunication(input: {
  actorUserId: string;
  companyId: string;
  jobId: string;
  supabase: AppSupabaseClient;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  const estimateResult = await getEstimateByJobId(input.supabase, input.jobId);

  if (estimateResult.error || !estimateResult.data || estimateResult.data.status !== "sent") {
    return false;
  }

  const linkSummary = await ensureEstimateAccessLink({
    actorUserId: input.actorUserId,
    estimateId: estimateResult.data.id,
    rotate: true
  });
  const result = await enqueueEstimateNotification(input.supabase, {
    actorUserId: input.actorUserId,
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
    input.actorUserId
  );

  return true;
}

async function queueStaleReturnCommunication(input: {
  actorUserId: string;
  companyId: string;
  jobId: string;
  supabase: AppSupabaseClient;
  timeZone: string;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  if (latestJobResult.data.status === "completed" || latestJobResult.data.status === "canceled") {
    return false;
  }

  const [communicationsResult, notesResult, invoiceResult] = await Promise.all([
    input.supabase
      .from("customer_communications")
      .select("communication_type, created_at")
      .eq("job_id", input.jobId)
      .order("created_at", { ascending: false })
      .limit(5),
    input.supabase
      .from("job_notes")
      .select("body")
      .eq("job_id", input.jobId)
      .order("created_at", { ascending: false }),
    getInvoiceByJobId(input.supabase, input.jobId)
  ]);

  if (communicationsResult.error || notesResult.error || invoiceResult.error) {
    return false;
  }

  const followUpSummary = getVisitFollowUpSummary({
    assignedTechnicianUserId: latestJobResult.data.assignedTechnicianUserId,
    communications: (communicationsResult.data ?? []).map((entry) => ({
      communicationType: entry.communication_type,
      createdAt: entry.created_at
    })),
    createdAt: latestJobResult.data.createdAt,
    invoiceStarted: Boolean(invoiceResult.data),
    job: latestJobResult.data,
    notes: (notesResult.data ?? []).map((note) => ({
      body: note.body
    })),
    promisedAt:
      latestJobResult.data.arrivalWindowStartAt ??
      latestJobResult.data.scheduledStartAt ??
      null
  });
  const communicationAction = getFollowUpCommunicationAction(followUpSummary);

  if (!communicationAction) {
    return false;
  }

  const result = await enqueueFollowUpCustomerCommunication({
    action: communicationAction.action,
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    jobId: input.jobId,
    resend: true,
    supabase: input.supabase,
    timeZone: input.timeZone
  });

  await processCommunicationMutationResult(
    result,
    "Failed to queue follow-up communication."
  );

  return true;
}

async function deferLowConfidenceJob(input: {
  companyId: string;
  jobId: string;
  supabase: AppSupabaseClient;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  const latestJob = latestJobResult.data;

  if (
    latestJob.status === "completed" ||
    latestJob.status === "canceled" ||
    isTechnicianOnSiteJobStatus(latestJob.status)
  ) {
    return false;
  }

  if (!latestJob.scheduledStartAt && !latestJob.arrivalWindowStartAt) {
    return false;
  }

  const result = await quickEditDispatchJob(input.supabase, input.companyId, {
    arrivalWindowEndAt: null,
    arrivalWindowStartAt: null,
    jobId: input.jobId,
    scheduledEndAt: null,
    scheduledStartAt: null,
    status: latestJob.status === "new" ? "new" : "scheduled"
  });

  if (result.error || !result.data) {
    return false;
  }

  return true;
}

async function queueCloseoutRiskCommunication(input: {
  actorUserId: string;
  companyId: string;
  jobId: string;
  supabase: AppSupabaseClient;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  const invoiceResult = await getInvoiceByJobId(input.supabase, input.jobId);

  if (
    invoiceResult.error ||
    !invoiceResult.data ||
    !isInvoiceEligibleForReminder({
      balanceDueCents: invoiceResult.data.balanceDueCents,
      dueAt: invoiceResult.data.dueAt,
      status: invoiceResult.data.status
    })
  ) {
    return false;
  }

  const linkSummary = await ensureInvoiceAccessLink({
    actorUserId: input.actorUserId,
    invoiceId: invoiceResult.data.id
  });
  const result = await enqueuePaymentReminder(input.supabase, {
    actorUserId: input.actorUserId,
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
    input.actorUserId
  );

  return true;
}

async function resolveCloseoutHandoff(input: {
  actorUserId: string;
  companyId: string;
  jobId: string;
  resolutionInput?: ResolveTechnicianPaymentHandoffInput | null;
  supabase: AppSupabaseClient;
}) {
  const latestJobResult = await getJobById(input.supabase, input.jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== input.companyId
  ) {
    return false;
  }

  const invoiceResult = await getInvoiceByJobId(input.supabase, input.jobId);

  if (invoiceResult.error || !invoiceResult.data) {
    return false;
  }

  const resolvedCount = await resolveOpenTechnicianPaymentHandoffsByInvoiceId(
    input.supabase as any,
    invoiceResult.data.id,
    input.actorUserId,
    input.resolutionInput ?? undefined
  );

  return resolvedCount > 0;
}

export async function POST(request: Request) {
  const { context, response } = await requireDispatchApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<BatchInterventionRequestBody>(request);

  if (
    !body?.action ||
    ![
      "notify_promise_risk",
      "notify_stale_approvals",
      "notify_stale_returns",
      "defer_low_confidence",
      "notify_closeout_risk",
      "resolve_closeout_handoff"
    ].includes(body.action) ||
    !Array.isArray(body.jobIds)
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const uniqueJobIds = [...new Set(body.jobIds.filter((jobId): jobId is string => Boolean(jobId)))];
  const resolutionInput =
    body.action === "resolve_closeout_handoff"
      ? resolveTechnicianPaymentHandoffInputSchema.safeParse({
          resolutionDisposition: body.resolutionDisposition,
          resolutionNote: body.resolutionNote?.trim() || null
        })
      : null;

  if (body.action === "resolve_closeout_handoff" && !resolutionInput?.success) {
    return NextResponse.json(
      {
        error:
          resolutionInput?.error.issues[0]?.message ??
          "Select how the field billing handoff was resolved."
      },
      { status: 400 }
    );
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const jobId of uniqueJobIds) {
    try {
      const processed =
        body.action === "notify_promise_risk"
          ? await queuePromiseRiskCommunication({
              actorUserId: context.currentUserId,
              companyId: context.companyId,
              jobId,
              supabase: context.supabase
            })
          : body.action === "notify_stale_approvals"
            ? await queueStaleApprovalCommunication({
                actorUserId: context.currentUserId,
                companyId: context.companyId,
                jobId,
                supabase: context.supabase
              })
            : body.action === "notify_stale_returns"
              ? await queueStaleReturnCommunication({
                  actorUserId: context.currentUserId,
                  companyId: context.companyId,
                  jobId,
                  supabase: context.supabase,
                  timeZone: context.company.timezone
                })
              : body.action === "defer_low_confidence"
                ? await deferLowConfidenceJob({
                    companyId: context.companyId,
                    jobId,
                    supabase: context.supabase
                  })
                : body.action === "notify_closeout_risk"
                  ? await queueCloseoutRiskCommunication({
                      actorUserId: context.currentUserId,
                      companyId: context.companyId,
                      jobId,
                      supabase: context.supabase
                    })
                  : await resolveCloseoutHandoff({
                      actorUserId: context.currentUserId,
                      companyId: context.companyId,
                      jobId,
                      resolutionInput:
                        resolutionInput?.success ? resolutionInput.data : null,
                      supabase: context.supabase
                    });

      if (processed) {
        processedCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch {
      skippedCount += 1;
    }
  }

  return NextResponse.json({
    action: body.action,
    ok: true,
    processedCount,
    skippedCount
  });
}
