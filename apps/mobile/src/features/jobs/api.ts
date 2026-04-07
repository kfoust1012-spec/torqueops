import {
  changeAssignedJobStatus,
  createTechnicianJobNote,
  getAssignedJobEstimateSummary,
  getAssignedJobInspectionDetail,
  getAssignedJobInvoiceSummary,
  getAssignedJobDetailForTechnician,
  getTechnicianDashboardSummary,
  listAssignedJobAttachments,
  listAssignedJobsForTechnician
} from "@mobile-mechanic/api-client";
import type {
  ChangeJobStatusInput,
  InvoiceDetail,
  JobStatusHistoryEntry,
  TechnicianJobDetail,
  TechnicianJobListQuery
} from "@mobile-mechanic/types";

import {
  loadCachedAssignedJobDetail,
  loadQueuedAssignedJobMutations,
  saveCachedAssignedJobDetail,
  saveQueuedAssignedJobMutations
} from "./offline-job-store";
import { saveTechnicianJobSeedToCache } from "./seed-cache";
import {
  loadCachedAssignedInvoice,
  saveCachedAssignedInvoice
} from "../invoices/offline-invoice-store";
import { supabase } from "../../lib/supabase";

type OfflineTechnicianJobDetail = TechnicianJobDetail & {
  pendingMutationCount?: number | undefined;
};

type QueuedJobMutation =
  | {
      body: string;
      createdAt: string;
      jobId: string;
      mutationId: string;
      mutationType: "note";
    }
  | {
      createdAt: string;
      input: ChangeJobStatusInput;
      jobId: string;
      mutationId: string;
      mutationType: "status";
    };

function buildOfflineEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function withPendingMutationCount(
  detail: TechnicianJobDetail,
  pendingMutationCount: number
): OfflineTechnicianJobDetail {
  return {
    ...detail,
    pendingMutationCount
  };
}

async function loadTechnicianJobDetailRemote(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const result = await getAssignedJobDetailForTechnician(supabase, companyId, technicianUserId, jobId);

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Assigned job not found.");
  }

  return result.data;
}

async function countQueuedJobMutations(jobId: string) {
  const queue = await loadQueuedAssignedJobMutations<QueuedJobMutation>();
  return queue.filter((entry) => entry.jobId === jobId).length;
}

async function enqueueQueuedJobMutation(entry: QueuedJobMutation) {
  const queue = await loadQueuedAssignedJobMutations<QueuedJobMutation>();
  queue.push(entry);
  await saveQueuedAssignedJobMutations(queue);
  return queue.filter((candidate) => candidate.jobId === entry.jobId).length;
}

function applyQueuedStatusChange(detail: TechnicianJobDetail, input: ChangeJobStatusInput, technicianUserId: string) {
  const historyEntry = {
    id: buildOfflineEntityId("offline-status"),
    changedByUserId: technicianUserId,
    companyId: detail.job.companyId,
    createdAt: new Date().toISOString(),
    fromStatus: detail.job.status,
    jobId: detail.job.id,
    reason: input.reason ?? null,
    toStatus: input.toStatus
  } satisfies JobStatusHistoryEntry;

  return {
    ...detail,
    job: {
      ...detail.job,
      completedAt: input.toStatus === "completed" ? historyEntry.createdAt : detail.job.completedAt,
      startedAt:
        input.toStatus !== "completed" &&
        detail.job.startedAt === null &&
        ["diagnosing", "repairing", "ready_for_payment", "waiting_approval", "waiting_parts"].includes(
          input.toStatus
        )
          ? historyEntry.createdAt
          : detail.job.startedAt,
      status: input.toStatus
    },
    statusHistory: [historyEntry, ...detail.statusHistory]
  } satisfies TechnicianJobDetail;
}

function applyQueuedNote(detail: TechnicianJobDetail, body: string, technicianUserId: string) {
  const createdAt = new Date().toISOString();

  return {
    ...detail,
    notes: [
      {
        authorUserId: technicianUserId,
        body,
        companyId: detail.job.companyId,
        createdAt,
        id: buildOfflineEntityId("offline-note"),
        isInternal: true,
        jobId: detail.job.id,
        updatedAt: createdAt
      },
      ...detail.notes
    ]
  } satisfies TechnicianJobDetail;
}

async function flushQueuedJobMutations(companyId: string, technicianUserId: string, jobId: string) {
  const queue = await loadQueuedAssignedJobMutations<QueuedJobMutation>();

  if (!queue.length) {
    return { flushedCount: 0, remainingCount: 0 };
  }

  const remainingQueue: QueuedJobMutation[] = [];
  let flushedCount = 0;
  let isBlocked = false;

  for (const entry of queue) {
    if (entry.jobId !== jobId) {
      remainingQueue.push(entry);
      continue;
    }

    if (isBlocked) {
      remainingQueue.push(entry);
      continue;
    }

    try {
      if (entry.mutationType === "status") {
        const result = await changeAssignedJobStatus(supabase, companyId, technicianUserId, jobId, entry.input);

        if (result.error) {
          throw result.error;
        }
      }

      if (entry.mutationType === "note") {
        const result = await createTechnicianJobNote(supabase, companyId, technicianUserId, {
          jobId,
          body: entry.body
        });

        if (result.error) {
          throw result.error;
        }
      }

      flushedCount += 1;
    } catch {
      isBlocked = true;
      remainingQueue.push(entry);
    }
  }

  await saveQueuedAssignedJobMutations(remainingQueue);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === jobId).length
  };
}

export async function syncAllQueuedJobMutations(companyId: string, technicianUserId: string) {
  const queue = await loadQueuedAssignedJobMutations<QueuedJobMutation>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedJobMutations(companyId, technicianUserId, jobId);
    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

export async function loadTechnicianHomeData(companyId: string, technicianUserId: string) {
  const [summaryResult, jobsResult] = await Promise.all([
    getTechnicianDashboardSummary(supabase, companyId, technicianUserId),
    listAssignedJobsForTechnician(supabase, companyId, technicianUserId)
  ]);

  if (summaryResult.error) {
    throw summaryResult.error;
  }

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  return {
    jobs: jobsResult.data ?? [],
    summary: summaryResult.data ?? {
      assignedTodayCount: 0,
      inProgressCount: 0,
      upcomingCount: 0
    }
  };
}

export async function loadTechnicianJobs(
  companyId: string,
  technicianUserId: string,
  query: TechnicianJobListQuery = {}
) {
  const result = await listAssignedJobsForTechnician(supabase, companyId, technicianUserId, query);

  if (result.error) {
    throw result.error;
  }

  const jobs = result.data ?? [];

  await Promise.all(
    jobs.map((job) =>
      job.stopSeed ? saveTechnicianJobSeedToCache(job.stopSeed).catch(() => undefined) : undefined
    )
  );

  return jobs;
}

export async function loadTechnicianJobDetail(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const cachedDetail = await loadCachedAssignedJobDetail<OfflineTechnicianJobDetail>(jobId);

  await flushQueuedJobMutations(companyId, technicianUserId, jobId);
  const pendingMutationCount = await countQueuedJobMutations(jobId);

  try {
    const detail = await loadTechnicianJobDetailRemote(companyId, technicianUserId, jobId);

    if (pendingMutationCount > 0 && cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    await saveCachedAssignedJobDetail(jobId, detail);
    return withPendingMutationCount(detail, pendingMutationCount);
  } catch (error) {
    if (cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    throw error;
  }
}

export async function loadTechnicianJobWorkflowSnapshot(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const [inspectionResult, estimateResult, invoiceResult, attachmentsResult] = await Promise.allSettled([
    getAssignedJobInspectionDetail(supabase, companyId, technicianUserId, jobId),
    getAssignedJobEstimateSummary(supabase, companyId, technicianUserId, jobId),
    getAssignedJobInvoiceSummary(supabase, companyId, technicianUserId, jobId),
    listAssignedJobAttachments(supabase, companyId, technicianUserId, jobId)
  ]);
  const cachedInvoice = await loadCachedAssignedInvoice<InvoiceDetail>(jobId);
  let invoice: InvoiceDetail | null = null;

  if (invoiceResult.status === "fulfilled" && !invoiceResult.value.error) {
    invoice = invoiceResult.value.data ?? cachedInvoice?.detail ?? null;

    if (invoiceResult.value.data) {
      await saveCachedAssignedInvoice(jobId, invoiceResult.value.data);
    }
  } else {
    invoice = cachedInvoice?.detail ?? null;
  }

  const hadPartialFailure = [inspectionResult, estimateResult, invoiceResult, attachmentsResult].some(
    (result) => {
      if (result.status === "rejected") {
        return true;
      }

      return Boolean(result.value.error);
    }
  );

  return {
    estimate:
      estimateResult.status === "fulfilled" && !estimateResult.value.error
        ? estimateResult.value.data ?? null
        : null,
    hadPartialFailure,
    inspection:
      inspectionResult.status === "fulfilled" && !inspectionResult.value.error
        ? inspectionResult.value.data ?? null
        : null,
    invoice:
      invoice,
    photoCount:
      attachmentsResult.status === "fulfilled" && !attachmentsResult.value.error
        ? attachmentsResult.value.data?.length ?? 0
        : null
  };
}

export async function submitTechnicianStatusChange(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  input: ChangeJobStatusInput
) {
  try {
    await flushQueuedJobMutations(companyId, technicianUserId, jobId);
    const result = await changeAssignedJobStatus(supabase, companyId, technicianUserId, jobId, input);

    if (result.error) {
      throw result.error;
    }

    const refreshedDetail = await loadTechnicianJobDetailRemote(companyId, technicianUserId, jobId);
    await saveCachedAssignedJobDetail(jobId, refreshedDetail);

    return {
      data: result.data,
      queued: false as const
    };
  } catch {
    const cachedDetail = await loadCachedAssignedJobDetail<TechnicianJobDetail>(jobId);

    if (!cachedDetail) {
      throw new Error("Status changes need one successful job load before they can queue offline.");
    }

    const optimisticDetail = applyQueuedStatusChange(cachedDetail, input, technicianUserId);
    const pendingMutationCount = await enqueueQueuedJobMutation({
      createdAt: new Date().toISOString(),
      input,
      jobId,
      mutationId: buildOfflineEntityId("job-mutation"),
      mutationType: "status"
    });
    await saveCachedAssignedJobDetail(jobId, withPendingMutationCount(optimisticDetail, pendingMutationCount));

    return {
      data: null,
      queued: true as const
    };
  }
}

export async function submitTechnicianNote(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  body: string
) {
  try {
    await flushQueuedJobMutations(companyId, technicianUserId, jobId);
    const result = await createTechnicianJobNote(supabase, companyId, technicianUserId, {
      jobId,
      body
    });

    if (result.error) {
      throw result.error;
    }

    const refreshedDetail = await loadTechnicianJobDetailRemote(companyId, technicianUserId, jobId);
    await saveCachedAssignedJobDetail(jobId, refreshedDetail);

    return {
      data: result.data,
      queued: false as const
    };
  } catch {
    const cachedDetail = await loadCachedAssignedJobDetail<TechnicianJobDetail>(jobId);

    if (!cachedDetail) {
      throw new Error("Notes need one successful job load before they can queue offline.");
    }

    const optimisticDetail = applyQueuedNote(cachedDetail, body, technicianUserId);
    const pendingMutationCount = await enqueueQueuedJobMutation({
      body,
      createdAt: new Date().toISOString(),
      jobId,
      mutationId: buildOfflineEntityId("job-mutation"),
      mutationType: "note"
    });
    await saveCachedAssignedJobDetail(jobId, withPendingMutationCount(optimisticDetail, pendingMutationCount));

    return {
      data: null,
      queued: true as const
    };
  }
}
