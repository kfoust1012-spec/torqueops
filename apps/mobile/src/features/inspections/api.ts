import {
  completeAssignedInspection,
  createInspectionForAssignedJob,
  getAssignedJobInspectionDetail,
  updateAssignedInspectionItem
} from "@mobile-mechanic/api-client";
import type {
  Inspection,
  InspectionDetail,
  InspectionItem,
  UpdateInspectionItemInput
} from "@mobile-mechanic/types";

import {
  loadCachedAssignedInspection,
  loadQueuedAssignedInspectionMutations,
  saveCachedAssignedInspection,
  saveQueuedAssignedInspectionMutations
} from "./offline-inspection-store";
import { syncJobCloseoutSyncState } from "../jobs/closeout-sync";
import { supabase } from "../../lib/supabase";

export type AssignedInspectionDetail = InspectionDetail & {
  pendingMutationCount?: number | undefined;
};

type QueuedInspectionMutation =
  | {
      createdAt: string;
      inspectionId: string;
      inspectionItemId: string;
      input: UpdateInspectionItemInput;
      jobId: string;
      mutationId: string;
      mutationType: "item";
    }
  | {
      createdAt: string;
      inspectionId: string;
      jobId: string;
      mutationId: string;
      mutationType: "complete";
    };

function buildOfflineEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isOfflineQueueableInspectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("network request failed") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("offline")
  );
}

function withPendingMutationCount(
  detail: InspectionDetail,
  pendingMutationCount: number
): AssignedInspectionDetail {
  return {
    ...detail,
    pendingMutationCount
  };
}

async function loadAssignedInspectionRemote(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const result = await getAssignedJobInspectionDetail(supabase, companyId, technicianUserId, jobId);

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function countQueuedInspectionMutations(jobId: string) {
  const queue = await loadQueuedAssignedInspectionMutations<QueuedInspectionMutation>();
  return queue.filter((entry) => entry.jobId === jobId).length;
}

async function enqueueInspectionMutation(entry: QueuedInspectionMutation) {
  const queue = await loadQueuedAssignedInspectionMutations<QueuedInspectionMutation>();
  queue.push(entry);
  await saveQueuedAssignedInspectionMutations(queue);
  return queue.filter((candidate) => candidate.jobId === entry.jobId).length;
}

function applyInspectionItemUpdate(detail: InspectionDetail, inspectionItemId: string, input: UpdateInspectionItemInput) {
  return {
    ...detail,
    sections: detail.sections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === inspectionItemId
          ? {
              ...item,
              findingSeverity: input.findingSeverity ?? null,
              recommendation: input.recommendation ?? null,
              status: input.status,
              technicianNotes: input.technicianNotes ?? null,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    }))
  } satisfies InspectionDetail;
}

function applyInspectionCompletion(detail: InspectionDetail) {
  const completedAt = new Date().toISOString();

  return {
    ...detail,
    inspection: {
      ...detail.inspection,
      completedAt,
      status: "completed",
      updatedAt: completedAt
    }
  } satisfies InspectionDetail;
}

async function flushQueuedInspectionMutations(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const queue = await loadQueuedAssignedInspectionMutations<QueuedInspectionMutation>();

  if (!queue.length) {
    return { flushedCount: 0, remainingCount: 0 };
  }

  const remainingQueue: QueuedInspectionMutation[] = [];
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
      if (entry.mutationType === "item") {
        const result = await updateAssignedInspectionItem(
          supabase,
          companyId,
          technicianUserId,
          entry.inspectionItemId,
          entry.input
        );

        if (result.error) {
          throw result.error;
        }
      }

      if (entry.mutationType === "complete") {
        const result = await completeAssignedInspection(
          supabase,
          companyId,
          technicianUserId,
          entry.inspectionId
        );

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

  await saveQueuedAssignedInspectionMutations(remainingQueue);
  await syncJobCloseoutSyncState(jobId).catch(() => undefined);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === jobId).length
  };
}

export async function syncAllQueuedInspectionMutations(companyId: string, technicianUserId: string) {
  const queue = await loadQueuedAssignedInspectionMutations<QueuedInspectionMutation>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedInspectionMutations(companyId, technicianUserId, jobId);
    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

export async function ensureAssignedInspection(
  companyId: string,
  technicianUserId: string,
  jobId: string
): Promise<InspectionDetail> {
  const cachedDetail = await loadCachedAssignedInspection<AssignedInspectionDetail>(jobId);

  await flushQueuedInspectionMutations(companyId, technicianUserId, jobId);
  const pendingMutationCount = await countQueuedInspectionMutations(jobId);
  const existingResult = await getAssignedJobInspectionDetail(supabase, companyId, technicianUserId, jobId);

  if (existingResult.error) {
    if (cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    throw existingResult.error;
  }

  if (existingResult.data) {
    await saveCachedAssignedInspection(jobId, existingResult.data);
    return withPendingMutationCount(
      existingResult.data,
      pendingMutationCount
    );
  }

  const createdResult = await createInspectionForAssignedJob(
    supabase,
    companyId,
    technicianUserId,
    jobId
  );

  if (
    createdResult.error ||
    !createdResult.data ||
    !("inspection" in createdResult.data)
  ) {
    throw createdResult.error ?? new Error("Inspection could not be created for this job.");
  }

  await saveCachedAssignedInspection(jobId, createdResult.data);
  return withPendingMutationCount(
    createdResult.data,
    pendingMutationCount
  );
}

export async function loadAssignedInspection(
  companyId: string,
  technicianUserId: string,
  jobId: string
): Promise<InspectionDetail | null> {
  const cachedDetail = await loadCachedAssignedInspection<AssignedInspectionDetail>(jobId);

  await flushQueuedInspectionMutations(companyId, technicianUserId, jobId);
  const pendingMutationCount = await countQueuedInspectionMutations(jobId);

  try {
    const result = await loadAssignedInspectionRemote(companyId, technicianUserId, jobId);

    if (!result) {
      return cachedDetail ? withPendingMutationCount(cachedDetail, pendingMutationCount) : null;
    }

    if (pendingMutationCount > 0 && cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    await saveCachedAssignedInspection(jobId, result);
    return withPendingMutationCount(result, pendingMutationCount);
  } catch (error) {
    if (cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    throw error;
  }
}

export async function submitInspectionItemUpdate(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  inspectionItemId: string,
  input: UpdateInspectionItemInput
): Promise<{ item: InspectionItem | null; queued: boolean }> {
  try {
    await flushQueuedInspectionMutations(companyId, technicianUserId, jobId);
    const result = await updateAssignedInspectionItem(
      supabase,
      companyId,
      technicianUserId,
      inspectionItemId,
      input
    );

    if (result.error) {
      throw result.error;
    }

    const refreshedDetail = await loadAssignedInspectionRemote(companyId, technicianUserId, jobId);

    if (refreshedDetail) {
      await saveCachedAssignedInspection(jobId, refreshedDetail);
    }

    return { item: result.data, queued: false };
  } catch (error) {
    if (!isOfflineQueueableInspectionError(error)) {
      throw error;
    }

    const cachedDetail = await loadCachedAssignedInspection<InspectionDetail>(jobId);

    if (!cachedDetail) {
      throw new Error("Inspection changes need one successful inspection load before they can queue offline.");
    }

    const optimisticDetail = applyInspectionItemUpdate(cachedDetail, inspectionItemId, input);
    const pendingMutationCount = await enqueueInspectionMutation({
      createdAt: new Date().toISOString(),
      inspectionId: cachedDetail.inspection.id,
      inspectionItemId,
      input,
      jobId,
      mutationId: buildOfflineEntityId("inspection-mutation"),
      mutationType: "item"
    });
    await syncJobCloseoutSyncState(jobId).catch(() => undefined);
    await saveCachedAssignedInspection(jobId, withPendingMutationCount(optimisticDetail, pendingMutationCount));

    const optimisticItem =
      optimisticDetail.sections.flatMap((section) => section.items).find((item) => item.id === inspectionItemId) ??
      null;

    return { item: optimisticItem, queued: true };
  }
}

export async function submitInspectionCompletion(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  inspectionId: string
): Promise<{ inspection: Inspection | null; queued: boolean }> {
  try {
    await flushQueuedInspectionMutations(companyId, technicianUserId, jobId);
    const result = await completeAssignedInspection(
      supabase,
      companyId,
      technicianUserId,
      inspectionId
    );

    if (result.error) {
      throw result.error;
    }

    const refreshedDetail = await loadAssignedInspectionRemote(companyId, technicianUserId, jobId);

    if (refreshedDetail) {
      await saveCachedAssignedInspection(jobId, refreshedDetail);
    }

    return { inspection: result.data, queued: false };
  } catch (error) {
    if (!isOfflineQueueableInspectionError(error)) {
      throw error;
    }

    const cachedDetail = await loadCachedAssignedInspection<InspectionDetail>(jobId);

    if (!cachedDetail) {
      throw new Error("Inspection completion needs one successful inspection load before it can queue offline.");
    }

    const optimisticDetail = applyInspectionCompletion(cachedDetail);
    const pendingMutationCount = await enqueueInspectionMutation({
      createdAt: new Date().toISOString(),
      inspectionId,
      jobId,
      mutationId: buildOfflineEntityId("inspection-mutation"),
      mutationType: "complete"
    });
    await syncJobCloseoutSyncState(jobId).catch(() => undefined);
    await saveCachedAssignedInspection(jobId, withPendingMutationCount(optimisticDetail, pendingMutationCount));

    return { inspection: optimisticDetail.inspection, queued: true };
  }
}
