import * as FileSystem from "expo-file-system/legacy";

const CACHE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}assigned-invoice-cache.json`
  : null;
const QUEUE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}assigned-invoice-mutation-queue.json`
  : null;

type InvoiceCacheEntry<T> = {
  cachedAt: string;
  detail: T;
};

type InvoiceCacheRecord<T> = Record<string, InvoiceCacheEntry<T>>;

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

export async function loadCachedAssignedInvoice<T>(jobId: string) {
  const cache = await readJsonFile<InvoiceCacheRecord<T>>(CACHE_FILE_URI, {});
  return cache[jobId] ?? null;
}

export async function saveCachedAssignedInvoice<T>(jobId: string, detail: T) {
  const cache = await readJsonFile<InvoiceCacheRecord<T>>(CACHE_FILE_URI, {});
  cache[jobId] = {
    cachedAt: new Date().toISOString(),
    detail
  };
  await writeJsonFile(CACHE_FILE_URI, cache);
}

export async function loadQueuedAssignedInvoiceMutations<T>() {
  return readJsonFile<T[]>(QUEUE_FILE_URI, []);
}

export async function saveQueuedAssignedInvoiceMutations<T>(queue: T[]) {
  await writeJsonFile(QUEUE_FILE_URI, queue);
}
