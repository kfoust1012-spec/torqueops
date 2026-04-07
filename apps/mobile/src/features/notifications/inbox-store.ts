import { clientStorage } from "../../lib/client-storage";

const notificationInboxStorageKey = "mobile-notification-inbox";
const maxNotificationInboxEntries = 50;

export type TechnicianNotificationInboxEntry = {
  body: string;
  createdAt: string;
  id: string;
  jobId: string | null;
  path: string | null;
  readAt: string | null;
  title: string;
  type: "job_assigned" | "job_rescheduled" | "unknown";
};

type InboxListener = (entries: TechnicianNotificationInboxEntry[]) => void;

const inboxListeners = new Set<InboxListener>();

function sortEntries(entries: TechnicianNotificationInboxEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id.localeCompare(left.id);
  });
}

function normalizeEntry(input: unknown): TechnicianNotificationInboxEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const title = typeof record.title === "string" ? record.title : null;
  const body = typeof record.body === "string" ? record.body : null;
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : null;

  if (!id || !title || !body || !createdAt) {
    return null;
  }

  return {
    body,
    createdAt,
    id,
    jobId: typeof record.jobId === "string" ? record.jobId : null,
    path: typeof record.path === "string" ? record.path : null,
    readAt: typeof record.readAt === "string" ? record.readAt : null,
    title,
    type:
      record.type === "job_assigned" || record.type === "job_rescheduled"
        ? record.type
        : "unknown"
  };
}

async function readNotificationInboxEntries() {
  const raw = await clientStorage.getItem(notificationInboxStorageKey);

  if (!raw) {
    return [] as TechnicianNotificationInboxEntry[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    return sortEntries(parsed.map((entry) => normalizeEntry(entry)).filter(Boolean) as TechnicianNotificationInboxEntry[]);
  } catch {
    return [];
  }
}

async function writeNotificationInboxEntries(entries: TechnicianNotificationInboxEntry[]) {
  const nextEntries = sortEntries(entries).slice(0, maxNotificationInboxEntries);
  await clientStorage.setItem(notificationInboxStorageKey, JSON.stringify(nextEntries));

  for (const listener of inboxListeners) {
    listener(nextEntries);
  }

  return nextEntries;
}

export async function loadTechnicianNotificationInbox() {
  return readNotificationInboxEntries();
}

export async function saveTechnicianNotificationInboxEntry(
  entry: TechnicianNotificationInboxEntry
) {
  const existingEntries = await readNotificationInboxEntries();
  const existingIndex = existingEntries.findIndex((candidate) => candidate.id === entry.id);
  const nextEntries = [...existingEntries];

  if (existingIndex >= 0) {
    nextEntries[existingIndex] = {
      ...nextEntries[existingIndex],
      ...entry
    };
  } else {
    nextEntries.unshift(entry);
  }

  return writeNotificationInboxEntries(nextEntries);
}

export async function markTechnicianNotificationInboxEntryRead(entryId: string) {
  const existingEntries = await readNotificationInboxEntries();
  const nextEntries = existingEntries.map((entry) =>
    entry.id === entryId && !entry.readAt
      ? { ...entry, readAt: new Date().toISOString() }
      : entry
  );

  return writeNotificationInboxEntries(nextEntries);
}

export async function markAllTechnicianNotificationInboxEntriesRead() {
  const timestamp = new Date().toISOString();
  const existingEntries = await readNotificationInboxEntries();

  return writeNotificationInboxEntries(
    existingEntries.map((entry) => ({
      ...entry,
      readAt: entry.readAt ?? timestamp
    }))
  );
}

export function subscribeToTechnicianNotificationInbox(listener: InboxListener) {
  inboxListeners.add(listener);

  return () => {
    inboxListeners.delete(listener);
  };
}
