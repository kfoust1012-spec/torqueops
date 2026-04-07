import * as FileSystem from "expo-file-system/legacy";

export type LocationPingPayload = {
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  capturedAt: string;
  companyId: string;
  headingDegrees: number | null;
  latitude: number;
  longitude: number;
  speedMetersPerSecond: number | null;
  technicianUserId: string;
};

const MAX_QUEUED_PINGS = 60;
const QUEUE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}fleet-location-ping-queue.json`
  : null;

async function saveQueue(queue: LocationPingPayload[]) {
  if (!QUEUE_FILE_URI) {
    return;
  }

  const nextQueue = queue.slice(-MAX_QUEUED_PINGS);

  if (!nextQueue.length) {
    await FileSystem.deleteAsync(QUEUE_FILE_URI, { idempotent: true });
    return;
  }

  await FileSystem.writeAsStringAsync(QUEUE_FILE_URI, JSON.stringify(nextQueue), {
    encoding: FileSystem.EncodingType.UTF8
  });
}

export async function loadQueuedLocationPings() {
  if (!QUEUE_FILE_URI) {
    return [];
  }

  try {
    const contents = await FileSystem.readAsStringAsync(QUEUE_FILE_URI, {
      encoding: FileSystem.EncodingType.UTF8
    });
    const parsed = JSON.parse(contents);

    return Array.isArray(parsed) ? (parsed as LocationPingPayload[]) : [];
  } catch {
    return [];
  }
}

export async function enqueueLocationPing(payload: LocationPingPayload) {
  const queue = await loadQueuedLocationPings();
  const lastQueuedPing = queue.at(-1) ?? null;

  if (
    lastQueuedPing &&
    lastQueuedPing.technicianUserId === payload.technicianUserId &&
    lastQueuedPing.latitude === payload.latitude &&
    lastQueuedPing.longitude === payload.longitude &&
    lastQueuedPing.capturedAt === payload.capturedAt
  ) {
    return queue.length;
  }

  queue.push(payload);
  await saveQueue(queue);
  return Math.min(queue.length, MAX_QUEUED_PINGS);
}

export async function flushQueuedLocationPings(
  persistPing: (payload: LocationPingPayload) => Promise<void>
) {
  const queue = await loadQueuedLocationPings();

  if (!queue.length) {
    return {
      flushedCount: 0,
      remainingCount: 0
    };
  }

  let flushedCount = 0;

  for (const payload of queue) {
    try {
      await persistPing(payload);
      flushedCount += 1;
    } catch {
      break;
    }
  }

  const remainingQueue = queue.slice(flushedCount);
  await saveQueue(remainingQueue);

  return {
    flushedCount,
    remainingCount: remainingQueue.length
  };
}

export async function clearQueuedLocationPings() {
  if (!QUEUE_FILE_URI) {
    return;
  }

  await FileSystem.deleteAsync(QUEUE_FILE_URI, { idempotent: true });
}
