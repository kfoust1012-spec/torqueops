export type HotThreadTarget = {
  id: string;
  kind: "customer" | "invoice" | "visit";
  siteId?: string;
};

export type HotThreadTargetEventDetail = {
  pin?: boolean;
  source?: string;
  target: HotThreadTarget | null;
};

export const pinnedHotThreadStorageKey = "mobile-mechanic:web:hot-thread-pinned-target";
export const hotThreadTargetEventName = "mobile-mechanic:web:hot-thread-target";

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export function isHotThreadTarget(value: unknown): value is HotThreadTarget {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<HotThreadTarget>;

  return (
    isUuid(candidate.id) &&
    (candidate.kind === "customer" || candidate.kind === "invoice" || candidate.kind === "visit") &&
    (!candidate.siteId || isUuid(candidate.siteId))
  );
}

export function readPinnedHotThread(storage: Storage) {
  const raw = storage.getItem(pinnedHotThreadStorageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isHotThreadTarget(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePinnedHotThread(storage: Storage, target: HotThreadTarget | null) {
  if (!target) {
    storage.removeItem(pinnedHotThreadStorageKey);
    return;
  }

  storage.setItem(pinnedHotThreadStorageKey, JSON.stringify(target));
}

export function emitHotThreadTargetEvent(
  target: HotThreadTarget | null,
  input?: {
    pin?: boolean;
    source?: string;
  }
) {
  if (typeof window === "undefined") {
    return;
  }

  const detail: HotThreadTargetEventDetail = {
    target,
    ...(typeof input?.pin === "boolean" ? { pin: input.pin } : {}),
    ...(input?.source ? { source: input.source } : {})
  };

  window.dispatchEvent(
    new CustomEvent<HotThreadTargetEventDetail>(hotThreadTargetEventName, {
      detail
    })
  );
}
