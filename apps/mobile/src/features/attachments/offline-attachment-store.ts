import * as FileSystem from "expo-file-system/legacy";

const CACHE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}assigned-attachment-gallery-cache.json`
  : null;
const QUEUE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}assigned-attachment-upload-queue.json`
  : null;

type CacheRecord<T> = Record<string, T>;

async function readJsonFile<T>(fileUri: string | null, fallback: T): Promise<T> {
  if (!fileUri) {
    return fallback;
  }

  try {
    const contents = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8
    });
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(fileUri: string | null, value: unknown) {
  if (!fileUri) {
    return;
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !Object.keys(value as Record<string, unknown>).length
  ) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    return;
  }

  if (Array.isArray(value) && !value.length) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    return;
  }

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(value), {
    encoding: FileSystem.EncodingType.UTF8
  });
}

export async function loadCachedAttachmentGallery<T>(jobId: string) {
  const cache = await readJsonFile<CacheRecord<T>>(CACHE_FILE_URI, {});
  return cache[jobId] ?? null;
}

export async function saveCachedAttachmentGallery<T>(jobId: string, gallery: T) {
  const cache = await readJsonFile<CacheRecord<T>>(CACHE_FILE_URI, {});
  cache[jobId] = gallery;
  await writeJsonFile(CACHE_FILE_URI, cache);
}

export async function loadQueuedAttachmentUploads<T>() {
  return readJsonFile<T[]>(QUEUE_FILE_URI, []);
}

export async function saveQueuedAttachmentUploads<T>(queue: T[]) {
  await writeJsonFile(QUEUE_FILE_URI, queue);
}
