import { mobileEnv } from "../../env";
import { clientStorage } from "../../lib/client-storage";
import { supabase } from "../../lib/supabase";
import { loadQueuedAttachmentUploads } from "../attachments/offline-attachment-store";
import { loadQueuedAssignedInspectionMutations } from "../inspections/offline-inspection-store";

const trackedCloseoutSyncJobsStorageKey = "tracked-closeout-sync-jobs";

type QueuedInspectionMutation = {
  jobId: string;
};

type QueuedAttachmentUpload = {
  jobId: string;
};

function getMobileWebAppUrl() {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim() ?? "";

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/g, "");
}

async function getSupabaseAccessToken() {
  const sessionResult = await supabase.auth.getSession();
  return sessionResult.data.session?.access_token ?? null;
}

async function loadTrackedCloseoutSyncJobs() {
  const raw = await clientStorage.getItem(trackedCloseoutSyncJobsStorageKey);

  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

async function saveTrackedCloseoutSyncJobs(jobIds: string[]) {
  const nextJobIds = Array.from(new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean)));

  if (!nextJobIds.length) {
    await clientStorage.removeItem(trackedCloseoutSyncJobsStorageKey);
    return;
  }

  await clientStorage.setItem(trackedCloseoutSyncJobsStorageKey, JSON.stringify(nextJobIds));
}

async function trackCloseoutSyncJob(jobId: string) {
  const trackedJobIds = await loadTrackedCloseoutSyncJobs();

  if (trackedJobIds.includes(jobId)) {
    return trackedJobIds;
  }

  const nextTrackedJobIds = [...trackedJobIds, jobId];
  await saveTrackedCloseoutSyncJobs(nextTrackedJobIds);
  return nextTrackedJobIds;
}

async function untrackCloseoutSyncJob(jobId: string) {
  const trackedJobIds = await loadTrackedCloseoutSyncJobs();
  const nextTrackedJobIds = trackedJobIds.filter((trackedJobId) => trackedJobId !== jobId);
  await saveTrackedCloseoutSyncJobs(nextTrackedJobIds);
}

async function getJobCloseoutSyncState(jobId: string) {
  const [inspectionQueue, attachmentQueue] = await Promise.all([
    loadQueuedAssignedInspectionMutations<QueuedInspectionMutation>(),
    loadQueuedAttachmentUploads<QueuedAttachmentUpload>()
  ]);
  const pendingInspectionCount = inspectionQueue.filter((entry) => entry.jobId === jobId).length;
  const pendingAttachmentCount = attachmentQueue.filter((entry) => entry.jobId === jobId).length;

  return {
    hasPendingAttachmentSync: pendingAttachmentCount > 0,
    hasPendingInspectionSync: pendingInspectionCount > 0
  };
}

export async function syncJobCloseoutSyncState(jobId: string) {
  await trackCloseoutSyncJob(jobId);

  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();

  if (!baseUrl || !accessToken) {
    return { synced: false as const };
  }

  const state = await getJobCloseoutSyncState(jobId);
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/closeout-sync`, {
    body: JSON.stringify(state),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    return { synced: false as const };
  }

  if (!state.hasPendingAttachmentSync && !state.hasPendingInspectionSync) {
    await untrackCloseoutSyncJob(jobId);
  }

  return {
    ...state,
    synced: true as const
  };
}

export async function syncTrackedCloseoutSyncStates() {
  const trackedJobIds = await loadTrackedCloseoutSyncJobs();
  let syncedCount = 0;
  let remainingCount = 0;

  for (const jobId of trackedJobIds) {
    const result = await syncJobCloseoutSyncState(jobId);

    if (result.synced) {
      syncedCount += 1;
    } else {
      remainingCount += 1;
    }
  }

  return {
    remainingCount,
    syncedCount
  };
}
