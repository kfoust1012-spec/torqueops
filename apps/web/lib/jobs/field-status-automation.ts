import {
  getInspectionSummaryByJobId,
  getJobById,
  listAttachmentsByJob
} from "@mobile-mechanic/api-client";
import {
  canTransitionJobStatus,
  resolveJobWorkflowAutomationTarget,
  type JobWorkflowAutomationSignal
} from "@mobile-mechanic/core";
import { getTechnicianJobCloseoutSyncMarker } from "./closeout-sync-markers";

export async function applyJobWorkflowAutomation(input: {
  jobId: string;
  signal: JobWorkflowAutomationSignal;
  supabase: any;
}) {
  let signal = input.signal;

  if (input.signal.kind === "invoice_settled") {
    const [inspectionResult, attachmentsResult] = await Promise.all([
      getInspectionSummaryByJobId(input.supabase, input.jobId),
      listAttachmentsByJob(input.supabase, input.jobId)
    ]);

    signal = {
      ...input.signal,
      inspectionStatus: inspectionResult.error ? null : inspectionResult.data?.status ?? null,
      photoCount: attachmentsResult.error ? null : attachmentsResult.data?.length ?? 0
    };
  }

  const jobResult = await getJobById(input.supabase, input.jobId);

  if (jobResult.error || !jobResult.data) {
    return {
      applied: false as const,
      currentStatus: null,
      targetStatus: null
    };
  }

  if (signal.kind === "invoice_settled") {
    const closeoutSyncMarker = await getTechnicianJobCloseoutSyncMarker({
      jobId: input.jobId,
      supabase: input.supabase,
      technicianUserId: jobResult.data.assignedTechnicianUserId
    });

    signal = {
      ...signal,
      hasPendingCloseoutSync: closeoutSyncMarker?.hasPendingCloseoutSync ?? false
    };
  }

  const targetStatus = resolveJobWorkflowAutomationTarget({
    currentStatus: jobResult.data.status,
    signal
  });

  if (!targetStatus || !canTransitionJobStatus(jobResult.data.status, targetStatus)) {
    return {
      applied: false as const,
      currentStatus: jobResult.data.status,
      targetStatus
    };
  }

  const result = await input.supabase
    .from("jobs")
    .update({
      status: targetStatus
    })
    .eq("id", input.jobId)
    .select("id,status")
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Job workflow automation could not update the stop status.");
  }

  return {
    applied: true as const,
    currentStatus: jobResult.data.status,
    targetStatus
  };
}
