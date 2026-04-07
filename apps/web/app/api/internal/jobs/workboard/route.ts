import {
  assignJobTechnician,
  changeJobStatus,
  createJobNote,
  enqueueAppointmentConfirmation,
  enqueueDispatchUpdate,
  enqueueEstimateNotification,
  getEstimateByJobId,
  getJobById,
  updateJob
} from "@mobile-mechanic/api-client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { processCommunicationMutationResult } from "../../../../../lib/communications/actions";
import {
  ensureEstimateAccessLink,
  ensureJobVisitAccessLink,
  markEstimateAccessLinkSent,
  markJobVisitAccessLinkSent
} from "../../../../../lib/customer-documents/service";
import { sendTechnicianJobPushNotification } from "../../../../../lib/mobile-push-notifications";
import { getTechnicianProfilePreview } from "../../../../../lib/technician-profiles/service";
import { assessVisitWorkflowMove, isVisitWorkflowState } from "../../../../../lib/jobs/workflow";

import { parseJsonRequest, requireVisitsWorkboardApiContext } from "../_shared";

export const runtime = "nodejs";

type MoveRequestBody = {
  action: "move";
  jobId?: string;
  targetState?: string;
};

type NoteRequestBody = {
  action: "note";
  body?: string;
  jobId?: string;
  isInternal?: boolean;
};

type BulkAssignRequestBody = {
  action: "bulk_assign";
  assignedTechnicianUserId?: string | null;
  jobIds?: string[];
};

type BulkPromiseRequestBody = {
  action: "bulk_set_promise";
  jobIds?: string[];
  scheduledStartAt?: string | null;
};

type BulkCustomerUpdateRequestBody = {
  action: "bulk_customer_update";
  jobIds?: string[];
  updateAction?: "appointment_confirmation" | "dispatch_update";
  updateType?: "dispatched" | "en_route";
};

type BulkEstimateFollowUpRequestBody = {
  action: "bulk_estimate_follow_up";
  jobIds?: string[];
};

type BulkMarkCompletedRequestBody = {
  action: "bulk_mark_completed";
  jobIds?: string[];
};

type WorkboardRequestBody =
  | MoveRequestBody
  | NoteRequestBody
  | BulkAssignRequestBody
  | BulkPromiseRequestBody
  | BulkCustomerUpdateRequestBody
  | BulkEstimateFollowUpRequestBody
  | BulkMarkCompletedRequestBody;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

export async function POST(request: Request) {
  const { context, response } = await requireVisitsWorkboardApiContext();

  if (!context) {
    return response;
  }

  const body = await parseJsonRequest<WorkboardRequestBody>(request);

  if (!body || !isNonEmptyString(body.action)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    body.action === "bulk_assign" ||
    body.action === "bulk_set_promise" ||
    body.action === "bulk_customer_update" ||
    body.action === "bulk_estimate_follow_up" ||
    body.action === "bulk_mark_completed"
  ) {
    if (!isStringArray(body.jobIds) || body.jobIds.length === 0) {
      return NextResponse.json({ error: "Select at least one visit." }, { status: 400 });
    }

    const jobs = (
      await Promise.all(body.jobIds.map(async (jobId) => ({ jobId, result: await getJobById(context.supabase, jobId) })))
    )
      .map(({ result }) => result.data)
      .filter(
        (job): job is NonNullable<typeof job> =>
          Boolean(
            job &&
              job.companyId === context.companyId &&
              job.isActive &&
              job.status !== "canceled"
          )
      );

    if (!jobs.length) {
      return NextResponse.json({ error: "Selected visits could not be loaded." }, { status: 400 });
    }

    let processedCount = 0;

    for (const job of jobs) {
      try {
        if (body.action === "bulk_assign") {
          const result = await assignJobTechnician(context.supabase, job.id, {
            assignedTechnicianUserId: body.assignedTechnicianUserId ?? null
          });

          if (!result.error) {
            if (result.data) {
              await sendTechnicianJobPushNotification({
                companyId: context.companyId,
                companyTimeZone: context.company.timezone,
                nextJob: result.data,
                previousJob: job
              }).catch(() => undefined);
            }
            processedCount += 1;
          }

          continue;
        }

        if (body.action === "bulk_set_promise") {
          if (!body.scheduledStartAt) {
            continue;
          }

          const result = await updateJob(context.supabase, job.id, {
            assignedTechnicianUserId: job.assignedTechnicianUserId,
            arrivalWindowEndAt: null,
            arrivalWindowStartAt: null,
            customerConcern: job.customerConcern,
            customerId: job.customerId,
            description: job.description,
            internalSummary: job.internalSummary,
            isActive: job.isActive,
            priority: job.priority,
            scheduledEndAt: null,
            scheduledStartAt: body.scheduledStartAt,
            source: job.source,
            title: job.title,
            vehicleId: job.vehicleId
          });

          if (!result.error) {
            if (result.data) {
              await sendTechnicianJobPushNotification({
                companyId: context.companyId,
                companyTimeZone: context.company.timezone,
                nextJob: result.data,
                previousJob: job
              }).catch(() => undefined);
            }
            processedCount += 1;
          }

          continue;
        }

        if (body.action === "bulk_customer_update") {
          if (body.updateAction === "appointment_confirmation") {
            const preview = await getTechnicianProfilePreview(
              context.supabase,
              job.assignedTechnicianUserId
            );
            const visitLink = preview.isReady
              ? await ensureJobVisitAccessLink({
                  actorUserId: context.currentUserId,
                  jobId: job.id
                })
              : null;
            const result = await enqueueAppointmentConfirmation(context.supabase, {
              actorUserId: context.currentUserId,
              jobId: job.id,
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

            processedCount += 1;
            continue;
          }

          if (body.updateAction === "dispatch_update" && body.updateType) {
            const preview = await getTechnicianProfilePreview(
              context.supabase,
              job.assignedTechnicianUserId
            );
            const visitLink = preview.isReady
              ? await ensureJobVisitAccessLink({
                  actorUserId: context.currentUserId,
                  jobId: job.id
                })
              : null;
            const result = await enqueueDispatchUpdate(context.supabase, {
              actorUserId: context.currentUserId,
              jobId: job.id,
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

            processedCount += 1;
          }

          continue;
        }

        if (body.action === "bulk_estimate_follow_up") {
          const estimateResult = await getEstimateByJobId(context.supabase, job.id);

          if (estimateResult.error || !estimateResult.data || estimateResult.data.status !== "sent") {
            continue;
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

          processedCount += 1;
          continue;
        }

        if (body.action === "bulk_mark_completed") {
          if (job.status === "completed") {
            continue;
          }

          const result = await changeJobStatus(context.supabase, job.id, {
            reason: "Marked completed from visits bulk actions",
            toStatus: "completed"
          });

          if (!result.error) {
            processedCount += 1;
          }
        }
      } catch {
        // Skip individual failures so bulk work can continue.
      }
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");

    return NextResponse.json({
      ok: true,
      processedCount,
      skippedCount: Math.max(jobs.length - processedCount, 0)
    });
  }

  if (!isNonEmptyString(body.jobId)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const currentJobResult = await getJobById(context.supabase, body.jobId);

  if (currentJobResult.error || !currentJobResult.data) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  if (currentJobResult.data.companyId !== context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!currentJobResult.data.isActive || currentJobResult.data.status === "canceled") {
    return NextResponse.json({ error: "This job cannot be changed from the workboard." }, { status: 400 });
  }

  if (body.action === "move") {
    if (!isNonEmptyString(body.targetState) || !isVisitWorkflowState(body.targetState)) {
      return NextResponse.json({ error: "Target lane is required." }, { status: 400 });
    }

    const assessment = assessVisitWorkflowMove(currentJobResult.data, body.targetState);

    if (!assessment.allowed) {
      return NextResponse.json({ error: assessment.message }, { status: 400 });
    }

    try {
      if (assessment.plan.toStatus) {
        const statusResult = await changeJobStatus(context.supabase, currentJobResult.data.id, {
          toStatus: assessment.plan.toStatus,
          reason: `Moved to ${body.targetState} from the visits workboard`
        });

        if (statusResult.error) {
          return NextResponse.json({ error: statusResult.error.message }, { status: 400 });
        }
      }

      if (
        assessment.plan.clearSchedule ||
        Object.prototype.hasOwnProperty.call(assessment.plan, "assignedTechnicianUserId")
      ) {
        const updateResult = await updateJob(context.supabase, currentJobResult.data.id, {
          customerId: currentJobResult.data.customerId,
          vehicleId: currentJobResult.data.vehicleId,
          title: currentJobResult.data.title,
          description: currentJobResult.data.description,
          customerConcern: currentJobResult.data.customerConcern,
          internalSummary: currentJobResult.data.internalSummary,
          scheduledStartAt: assessment.plan.clearSchedule
            ? null
            : currentJobResult.data.scheduledStartAt,
          scheduledEndAt: assessment.plan.clearSchedule ? null : currentJobResult.data.scheduledEndAt,
          arrivalWindowStartAt: assessment.plan.clearSchedule
            ? null
            : currentJobResult.data.arrivalWindowStartAt,
          arrivalWindowEndAt: assessment.plan.clearSchedule
            ? null
            : currentJobResult.data.arrivalWindowEndAt,
          assignedTechnicianUserId:
            assessment.plan.assignedTechnicianUserId !== undefined
              ? assessment.plan.assignedTechnicianUserId
              : currentJobResult.data.assignedTechnicianUserId,
          priority: currentJobResult.data.priority,
          source: currentJobResult.data.source,
          isActive: currentJobResult.data.isActive
        });

        if (updateResult.error) {
          return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
        }

        if (updateResult.data) {
          await sendTechnicianJobPushNotification({
            companyId: context.companyId,
            companyTimeZone: context.company.timezone,
            nextJob: updateResult.data,
            previousJob: currentJobResult.data
          }).catch(() => undefined);
        }
      }

      revalidatePath("/dashboard/visits");
      revalidatePath(`/dashboard/visits/${currentJobResult.data.id}`);

      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message.trim()
              ? error.message
              : "Visit move could not be completed."
        },
        { status: 400 }
      );
    }
  }

  if (!isNonEmptyString(body.body)) {
    return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  }

  const noteResult = await createJobNote(context.supabase, {
    authorUserId: context.currentUserId,
    body: body.body,
    companyId: context.companyId,
    isInternal: body.isInternal ?? true,
    jobId: currentJobResult.data.id
  });

  if (noteResult.error) {
    return NextResponse.json({ error: noteResult.error.message }, { status: 400 });
  }

  revalidatePath("/dashboard/visits");
  revalidatePath(`/dashboard/visits/${currentJobResult.data.id}`);

  return NextResponse.json({ ok: true, note: noteResult.data });
}
