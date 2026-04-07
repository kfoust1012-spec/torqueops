import { isSupportedAttachmentMimeType } from "@mobile-mechanic/core";
import { createAttachmentSignedUrl, listAssignedJobAttachments } from "@mobile-mechanic/api-client";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

import type { Attachment, AttachmentCategory, AttachmentMimeType } from "@mobile-mechanic/types";

import { loadCachedAttachmentGallery, loadQueuedAttachmentUploads, saveCachedAttachmentGallery, saveQueuedAttachmentUploads } from "./offline-attachment-store";
import { mobileEnv } from "../../env";
import { supabase } from "../../lib/supabase";
import type { AttachmentGalleryItem } from "./mappers";
import { syncJobCloseoutSyncState } from "../jobs/closeout-sync";

type PickedAttachmentAsset = {
  fileName: string;
  fileSizeBytes: number;
  mimeType: AttachmentMimeType;
  uri: string;
};

type AttachmentPickerMode = "camera-photo" | "camera-video" | "library";

type QueuedAttachmentUpload = {
  asset: PickedAttachmentAsset;
  caption: string;
  category: AttachmentCategory;
  createdAt: string;
  dedupeKey?: string;
  id: string;
  inspectionId?: string | null | undefined;
  inspectionItemId?: string | null | undefined;
  jobId: string;
  technicianUserId: string;
  uploadedByUserId: string;
};

const STAGED_ATTACHMENT_DIRECTORY_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}queued-attachments/`
  : null;

function buildOfflineEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAttachmentCaptionForDedupe(caption: string) {
  return caption.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAttachmentFileNameForMatch(fileName: string) {
  return fileName.trim().toLowerCase();
}

function buildAttachmentDedupeKeyFromHash(input: {
  asset: PickedAttachmentAsset;
  caption: string;
  category: AttachmentCategory;
  fileHash: string;
  inspectionId?: string | null;
  inspectionItemId?: string | null;
  jobId: string;
}) {
  return [
    input.jobId,
    input.category,
    normalizeAttachmentCaptionForDedupe(input.caption),
    input.inspectionId ?? "",
    input.inspectionItemId ?? "",
    input.asset.mimeType,
    input.fileHash
  ].join("|");
}

function buildAttachmentRemoteMatchKey(input: {
  caption: string;
  category: AttachmentCategory;
  fileName: string;
  fileSizeBytes: number;
  inspectionId?: string | null;
  inspectionItemId?: string | null;
  jobId: string;
  mimeType: AttachmentMimeType;
}) {
  return [
    input.jobId,
    input.category,
    normalizeAttachmentCaptionForDedupe(input.caption),
    input.inspectionId ?? "",
    input.inspectionItemId ?? "",
    input.mimeType,
    input.fileSizeBytes,
    normalizeAttachmentFileNameForMatch(input.fileName)
  ].join("|");
}

function buildQueuedAttachmentRemoteMatchKey(entry: QueuedAttachmentUpload) {
  return buildAttachmentRemoteMatchKey({
    caption: entry.caption,
    category: entry.category,
    fileName: entry.asset.fileName,
    fileSizeBytes: entry.asset.fileSizeBytes,
    inspectionId: entry.inspectionId ?? null,
    inspectionItemId: entry.inspectionItemId ?? null,
    jobId: entry.jobId,
    mimeType: entry.asset.mimeType
  });
}

function buildRemoteAttachmentMatchKey(entry: Attachment) {
  return buildAttachmentRemoteMatchKey({
    caption: entry.caption ?? "",
    category: entry.category,
    fileName: entry.fileName,
    fileSizeBytes: entry.fileSizeBytes,
    inspectionId: entry.inspectionId ?? null,
    inspectionItemId: entry.inspectionItemId ?? null,
    jobId: entry.jobId,
    mimeType: entry.mimeType
  });
}

function getAttachmentFileExtension(asset: PickedAttachmentAsset) {
  const fileNameExtension = asset.fileName.split(".").at(-1)?.trim().toLowerCase();

  if (fileNameExtension) {
    return fileNameExtension;
  }

  return asset.mimeType.split("/")[1] ?? "jpg";
}

async function ensureStagedAttachmentDirectory() {
  if (!STAGED_ATTACHMENT_DIRECTORY_URI) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(STAGED_ATTACHMENT_DIRECTORY_URI, {
    intermediates: true
  });

  return STAGED_ATTACHMENT_DIRECTORY_URI;
}

function isStagedAttachmentUri(uri: string) {
  return !!STAGED_ATTACHMENT_DIRECTORY_URI && uri.startsWith(STAGED_ATTACHMENT_DIRECTORY_URI);
}

async function stageAttachmentAsset(asset: PickedAttachmentAsset) {
  if (isStagedAttachmentUri(asset.uri)) {
    return asset;
  }

  const directoryUri = await ensureStagedAttachmentDirectory();

  if (!directoryUri) {
    return asset;
  }

  const stagedUri = `${directoryUri}${Crypto.randomUUID()}.${getAttachmentFileExtension(asset)}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: stagedUri
  });

  const stagedInfo = await FileSystem.getInfoAsync(stagedUri);

  return {
    ...asset,
    fileSizeBytes:
      asset.fileSizeBytes ||
      (stagedInfo.exists && typeof stagedInfo.size === "number" ? stagedInfo.size : 1),
    uri: stagedUri
  };
}

async function stageAttachmentAssetSafely(asset: PickedAttachmentAsset) {
  try {
    return await stageAttachmentAsset(asset);
  } catch {
    return asset;
  }
}

async function deleteStagedAttachmentAsset(asset: PickedAttachmentAsset) {
  if (!isStagedAttachmentUri(asset.uri)) {
    return;
  }

  await FileSystem.deleteAsync(asset.uri, {
    idempotent: true
  });
}

async function buildAttachmentDedupeKey(input: {
  asset: PickedAttachmentAsset;
  caption: string;
  category: AttachmentCategory;
  inspectionId?: string | null;
  inspectionItemId?: string | null;
  jobId: string;
}) {
  const stagedAsset = await stageAttachmentAssetSafely(input.asset);

  try {
    const base64 = await FileSystem.readAsStringAsync(stagedAsset.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    const fileHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);

    return buildAttachmentDedupeKeyFromHash({
      ...input,
      asset: stagedAsset,
      fileHash
    });
  } catch {
    return buildAttachmentDedupeKeyFromHash({
      ...input,
      asset: stagedAsset,
      fileHash: [
        stagedAsset.fileName.trim().toLowerCase(),
        stagedAsset.fileSizeBytes,
        stagedAsset.uri
      ].join("|")
    });
  }
}

async function normalizeQueuedAttachmentUploads(queue: QueuedAttachmentUpload[]) {
  const dedupedQueue: QueuedAttachmentUpload[] = [];
  const seenKeys = new Map<string, number>();

  for (const entry of queue) {
    const dedupeKey =
      entry.dedupeKey ??
      (await buildAttachmentDedupeKey({
        asset: entry.asset,
        caption: entry.caption,
        category: entry.category,
        inspectionId: entry.inspectionId ?? null,
        inspectionItemId: entry.inspectionItemId ?? null,
        jobId: entry.jobId
      }));

    const normalizedEntry = {
      ...entry,
      dedupeKey
    } satisfies QueuedAttachmentUpload;
    const existingIndex = seenKeys.get(dedupeKey);

    if (existingIndex !== undefined) {
      const existingEntry = dedupedQueue[existingIndex];
      if (existingEntry) {
        await deleteStagedAttachmentAsset(existingEntry.asset).catch(() => undefined);
      }
      dedupedQueue[existingIndex] = normalizedEntry;
      continue;
    }

    seenKeys.set(dedupeKey, dedupedQueue.length);
    dedupedQueue.push(normalizedEntry);
  }

  return dedupedQueue;
}

function buildOfflineAttachmentItem(input: {
  attachmentId: string;
  asset: PickedAttachmentAsset;
  caption: string;
  category: AttachmentCategory;
  companyId: string;
  inspectionId?: string | null | undefined;
  inspectionItemId?: string | null | undefined;
  jobId: string;
  uploadedByUserId: string;
}): AttachmentGalleryItem {
  const createdAt = new Date().toISOString();

  return {
    category: input.category,
    caption: input.caption || null,
    companyId: input.companyId,
    createdAt,
    fileName: input.asset.fileName,
    fileSizeBytes: input.asset.fileSizeBytes,
    id: input.attachmentId,
    inspectionId: input.inspectionId ?? null,
    inspectionItemId: input.inspectionItemId ?? null,
    jobId: input.jobId,
    mimeType: input.asset.mimeType,
    pendingUpload: true,
    signedUrl: input.asset.uri,
    storageBucket: "pending-upload",
    storagePath: input.asset.uri,
    updatedAt: createdAt,
    uploadedByUserId: input.uploadedByUserId
  } satisfies AttachmentGalleryItem;
}

async function countQueuedAttachmentUploads(jobId: string) {
  const queue = await loadQueuedAttachmentUploads<QueuedAttachmentUpload>();
  return queue.filter((entry) => entry.jobId === jobId).length;
}

async function enqueueAttachmentUpload(entry: QueuedAttachmentUpload) {
  const queue = await loadQueuedAttachmentUploads<QueuedAttachmentUpload>();
  const dedupeKey =
    entry.dedupeKey ??
    (await buildAttachmentDedupeKey({
      asset: entry.asset,
      caption: entry.caption,
      category: entry.category,
      inspectionId: entry.inspectionId ?? null,
      inspectionItemId: entry.inspectionItemId ?? null,
      jobId: entry.jobId
    }));
  const normalizedEntry = {
    ...entry,
    dedupeKey
  } satisfies QueuedAttachmentUpload;
  const existingIndex = queue.findIndex(
    (candidate) => candidate.jobId === entry.jobId && candidate.dedupeKey === dedupeKey
  );

  if (existingIndex >= 0) {
    const existingEntry = queue[existingIndex];
    if (existingEntry) {
      await deleteStagedAttachmentAsset(existingEntry.asset).catch(() => undefined);
    }
    queue[existingIndex] = normalizedEntry;
  } else {
    queue.push(normalizedEntry);
  }

  const normalizedQueue = await normalizeQueuedAttachmentUploads(queue);
  await saveQueuedAttachmentUploads(normalizedQueue);
  return normalizedQueue.filter((candidate) => candidate.jobId === entry.jobId).length;
}

async function uploadAssignedJobAttachmentRemote(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  input: {
    asset: PickedAttachmentAsset;
    caption: string;
    category: AttachmentCategory;
    inspectionId?: string | null;
    inspectionItemId?: string | null;
  }
) {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim().replace(/\/+$/g, "") ?? "";

  if (!baseUrl) {
    throw new Error("Configure EXPO_PUBLIC_WEB_APP_URL before mobile evidence can sync.");
  }

  const accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? null;

  if (!accessToken) {
    throw new Error("Sign in again before saving stop evidence.");
  }

  const stagedAsset = await stageAttachmentAssetSafely(input.asset);
  const formData = new FormData();
  formData.append("file", {
    name: stagedAsset.fileName,
    type: stagedAsset.mimeType,
    uri: stagedAsset.uri
  } as never);
  formData.append("category", input.category);

  if (input.caption.trim()) {
    formData.append("caption", input.caption.trim());
  }

  if (input.inspectionId) {
    formData.append("inspectionId", input.inspectionId);
  }

  if (input.inspectionItemId) {
    formData.append("inspectionItemId", input.inspectionItemId);
  }

  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/attachments`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | {
        attachment?: Attachment;
        error?: string;
        ok?: boolean;
      }
    | null;

  if (!response.ok || !body?.ok || !body.attachment) {
    throw new Error(body?.error ?? "The evidence could not be saved.");
  }

  await deleteStagedAttachmentAsset(stagedAsset);
  return body.attachment;
}

function isOfflineQueueableAttachmentError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("network request failed") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("request timed out") ||
    message.includes("socket") ||
    message.includes("offline") ||
    message.includes("temporarily unavailable")
  );
}

async function flushQueuedAttachmentUploads(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const rawQueue = await loadQueuedAttachmentUploads<QueuedAttachmentUpload>();

  const queue = await normalizeQueuedAttachmentUploads(rawQueue);
  await saveQueuedAttachmentUploads(queue);

  if (!queue.length) {
    return { flushedCount: 0, remainingCount: 0 };
  }

  const remainingQueue: QueuedAttachmentUpload[] = [];
  const remoteAttachmentResult = await listAssignedJobAttachments(
    supabase,
    companyId,
    technicianUserId,
    jobId
  ).catch(() => null);
  const remoteAttachmentKeys = new Set(
    remoteAttachmentResult?.data?.map(buildRemoteAttachmentMatchKey) ?? []
  );
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

    const remoteMatchKey = buildQueuedAttachmentRemoteMatchKey(entry);

    if (remoteAttachmentKeys.has(remoteMatchKey)) {
      await deleteStagedAttachmentAsset(entry.asset).catch(() => undefined);
      flushedCount += 1;
      continue;
    }

    try {
      await uploadAssignedJobAttachmentRemote(companyId, technicianUserId, jobId, {
        asset: entry.asset,
        caption: entry.caption,
        category: entry.category,
        inspectionId: entry.inspectionId ?? null,
        inspectionItemId: entry.inspectionItemId ?? null
      });
      await deleteStagedAttachmentAsset(entry.asset);
      remoteAttachmentKeys.add(remoteMatchKey);
      flushedCount += 1;
    } catch {
      isBlocked = true;
      remainingQueue.push(entry);
    }
  }

  await saveQueuedAttachmentUploads(remainingQueue);
  await syncJobCloseoutSyncState(jobId).catch(() => undefined);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === jobId).length
  };
}

export async function syncAllQueuedAttachmentUploads(companyId: string, technicianUserId: string) {
  const queue = await loadQueuedAttachmentUploads<QueuedAttachmentUpload>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedAttachmentUploads(companyId, technicianUserId, jobId);
    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

function inferMimeType(
  uri: string,
  fallback: string | null | undefined
): AttachmentMimeType | null {
  if (fallback && isSupportedAttachmentMimeType(fallback)) {
    return fallback as AttachmentMimeType;
  }

  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith(".heic") || normalizedUri.endsWith(".heif")) {
    return null;
  }

  if (normalizedUri.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedUri.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedUri.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (normalizedUri.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (normalizedUri.endsWith(".webm")) {
    return "video/webm";
  }

  return "image/jpeg";
}

function normalizePickedAsset(asset: ImagePicker.ImagePickerAsset): PickedAttachmentAsset {
  const mimeType = inferMimeType(asset.uri, asset.mimeType);

  if (!mimeType) {
    throw new Error("This file format is not supported yet. Use JPEG, PNG, WEBP, MP4, MOV, or WEBM.");
  }

  const extension = mimeType.split("/")[1] ?? "bin";

  return {
    fileName: asset.fileName?.trim() || `attachment-${Date.now()}.${extension}`,
    fileSizeBytes: asset.fileSize ?? 1,
    mimeType,
    uri: asset.uri
  };
}

async function pickAttachmentFromDevice(
  mode: AttachmentPickerMode
): Promise<PickedAttachmentAsset | null> {
  if (mode === "camera-photo" || mode === "camera-video") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Camera permission is required to capture evidence.");
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Media library permission is required to select evidence.");
    }
  }

  const result =
    mode === "camera-photo"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8
        })
      : mode === "camera-video"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.8,
            videoMaxDuration: 30
          })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8
        });

  if (result.canceled || !result.assets.length) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset) {
    return null;
  }

  return normalizePickedAsset(asset);
}

export async function pickCameraImage() {
  return pickAttachmentFromDevice("camera-photo");
}

export async function pickCameraVideo() {
  return pickAttachmentFromDevice("camera-video");
}

export async function pickMediaLibraryImage() {
  return pickAttachmentFromDevice("library");
}

export async function loadAssignedJobAttachmentGallery(
  companyId: string,
  technicianUserId: string,
  jobId: string
): Promise<AttachmentGalleryItem[]> {
  const cachedGallery = await loadCachedAttachmentGallery<AttachmentGalleryItem[]>(jobId);

  await flushQueuedAttachmentUploads(companyId, technicianUserId, jobId);
  const pendingUploadCount = await countQueuedAttachmentUploads(jobId);
  const result = await listAssignedJobAttachments(supabase, companyId, technicianUserId, jobId);

  if (result.error) {
    if (cachedGallery) {
      return cachedGallery;
    }

    throw result.error;
  }

  const attachments = result.data ?? [];
  const signedUrls = await Promise.all(
    attachments.map(async (attachment) => {
      const signedUrlResult = await createAttachmentSignedUrl(supabase, attachment);

      return {
        attachmentId: attachment.id,
        signedUrl: signedUrlResult.data?.signedUrl ?? null
      };
    })
  );

  const urlById = new Map(signedUrls.map((entry) => [entry.attachmentId, entry.signedUrl]));

  const gallery = attachments.map((attachment) => ({
    ...attachment,
    pendingUpload: false,
    signedUrl: urlById.get(attachment.id) ?? null
  }));

  if (pendingUploadCount > 0 && cachedGallery) {
    return cachedGallery;
  }

  await saveCachedAttachmentGallery(jobId, gallery);
  return gallery;
}

export async function uploadAssignedJobAttachment(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  input: {
    asset: PickedAttachmentAsset;
    caption: string;
    category: AttachmentCategory;
    inspectionId?: string | null;
    inspectionItemId?: string | null;
  }
) {
  try {
    await flushQueuedAttachmentUploads(companyId, technicianUserId, jobId);
    const data = await uploadAssignedJobAttachmentRemote(companyId, technicianUserId, jobId, input);
    const refreshedGallery = await loadAssignedJobAttachmentGallery(companyId, technicianUserId, jobId);
    await saveCachedAttachmentGallery(jobId, refreshedGallery);

    return {
      data,
      queued: false as const
    };
  } catch (error) {
    if (!isOfflineQueueableAttachmentError(error)) {
      throw error;
    }

    const stagedAsset = await stageAttachmentAssetSafely(input.asset);
    const dedupeKey = await buildAttachmentDedupeKey({
      asset: stagedAsset,
      caption: input.caption,
      category: input.category,
      inspectionId: input.inspectionId ?? null,
      inspectionItemId: input.inspectionItemId ?? null,
      jobId
    });
    const cachedGallery = (await loadCachedAttachmentGallery<AttachmentGalleryItem[]>(jobId)) ?? [];
    const offlineItem = buildOfflineAttachmentItem({
      attachmentId: buildOfflineEntityId("offline-attachment"),
      asset: stagedAsset,
      caption: input.caption,
      category: input.category,
      companyId,
      inspectionId: input.inspectionId,
      inspectionItemId: input.inspectionItemId,
      jobId,
      uploadedByUserId: technicianUserId
    });
    const pendingUploadCount = await enqueueAttachmentUpload({
      asset: stagedAsset,
      caption: input.caption,
      category: input.category,
      createdAt: offlineItem.createdAt,
      dedupeKey,
      id: offlineItem.id,
      inspectionId: input.inspectionId ?? null,
      inspectionItemId: input.inspectionItemId ?? null,
      jobId,
      technicianUserId,
      uploadedByUserId: technicianUserId
    });
    await syncJobCloseoutSyncState(jobId).catch(() => undefined);
    const dedupedGallery = [
      offlineItem,
      ...cachedGallery.filter((attachment) => attachment.id !== offlineItem.id)
    ].map((attachment, index) =>
      index < pendingUploadCount && attachment.pendingUpload !== false
        ? { ...attachment, pendingUpload: true }
        : attachment
    );
    await saveCachedAttachmentGallery(jobId, dedupedGallery);

    return {
      data: offlineItem as Attachment,
      queued: true as const
    };
  }
}
