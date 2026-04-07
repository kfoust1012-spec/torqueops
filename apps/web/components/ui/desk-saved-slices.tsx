"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonClassName } from "./button";
import { cx } from "./utils";

type DeskSavedSliceTone = "ghost" | "primary" | "secondary" | "tertiary";
type DeskSavedSliceDesk = "dispatch" | "visits";

type DeskSavedSliceLink = {
  href: string;
  id: string;
  label: string;
  tone?: DeskSavedSliceTone;
};

type StoredDeskSavedSlice = {
  href: string;
  id: string;
  label: string;
};

type DeskSavedSlicesProps = {
  className?: string;
  currentSlice: {
    href: string;
    label: string;
  };
  desk: DeskSavedSliceDesk;
  operatorRole: string | undefined;
  pinCurrentLabel?: string;
  suggestedSlices: DeskSavedSliceLink[];
};

const maxPinnedSlices = 4;
const collapsedVisibleSliceCount = 3;

function normalizeDeskRole(role: string | undefined) {
  return role?.trim() ? role.trim() : "office";
}

function getDeskSavedSlicesStorageKey(desk: DeskSavedSliceDesk, role: string | undefined) {
  return `mobile-mechanic:web:${desk}:saved-slices:${normalizeDeskRole(role)}`;
}

function readDeskSavedSlices(storage: Storage, desk: DeskSavedSliceDesk, role: string | undefined) {
  try {
    const rawValue = storage.getItem(getDeskSavedSlicesStorageKey(desk, role));

    if (!rawValue) {
      return [] as StoredDeskSavedSlice[];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as StoredDeskSavedSlice[];
    }

    return parsed
      .filter((entry): entry is StoredDeskSavedSlice => {
        if (!entry || typeof entry !== "object") {
          return false;
        }

        const candidate = entry as Partial<StoredDeskSavedSlice>;
        return (
          typeof candidate.href === "string" &&
          candidate.href.length > 0 &&
          typeof candidate.id === "string" &&
          candidate.id.length > 0 &&
          typeof candidate.label === "string" &&
          candidate.label.length > 0
        );
      })
      .slice(0, maxPinnedSlices);
  } catch {
    return [] as StoredDeskSavedSlice[];
  }
}

function writeDeskSavedSlices(
  storage: Storage,
  desk: DeskSavedSliceDesk,
  role: string | undefined,
  slices: StoredDeskSavedSlice[]
) {
  storage.setItem(
    getDeskSavedSlicesStorageKey(desk, role),
    JSON.stringify(slices.slice(0, maxPinnedSlices))
  );
}

export function DeskSavedSlices({
  className,
  currentSlice,
  desk,
  operatorRole,
  pinCurrentLabel = "Pin current",
  suggestedSlices
}: DeskSavedSlicesProps) {
  const [pinnedSlices, setPinnedSlices] = useState<StoredDeskSavedSlice[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setPinnedSlices(readDeskSavedSlices(window.localStorage, desk, operatorRole));
    } catch {
      setPinnedSlices([]);
    }
  }, [desk, operatorRole]);

  useEffect(() => {
    setExpanded(false);
  }, [desk, operatorRole, currentSlice.href]);

  const isCurrentPinned = pinnedSlices.some((slice) => slice.href === currentSlice.href);
  const mergedSlices = useMemo(() => {
    const items: Array<
      DeskSavedSliceLink & {
        source: "pinned" | "suggested";
      }
    > = [];
    const seenHrefs = new Set<string>();

    for (const slice of pinnedSlices) {
      items.push({
        href: slice.href,
        id: slice.id,
        label: slice.label,
        source: "pinned",
        tone: "secondary"
      });
      seenHrefs.add(slice.href);
    }

    for (const slice of suggestedSlices) {
      if (seenHrefs.has(slice.href)) {
        continue;
      }

      items.push({
        ...slice,
        source: "suggested"
      });
      seenHrefs.add(slice.href);
    }

    return items;
  }, [pinnedSlices, suggestedSlices]);
  const visibleSlices = useMemo(() => {
    if (expanded || mergedSlices.length <= collapsedVisibleSliceCount) {
      return mergedSlices;
    }

    const collapsed = mergedSlices.slice(0, collapsedVisibleSliceCount);

    if (collapsed.some((slice) => slice.href === currentSlice.href)) {
      return collapsed;
    }

    const currentItem = mergedSlices.find((slice) => slice.href === currentSlice.href);

    if (!currentItem) {
      return collapsed;
    }

    return [...collapsed.slice(0, collapsedVisibleSliceCount - 1), currentItem];
  }, [currentSlice.href, expanded, mergedSlices]);
  const hiddenSliceCount = Math.max(mergedSlices.length - visibleSlices.length, 0);

  function handleToggleCurrentSlice() {
    try {
      const currentStoredSlices = readDeskSavedSlices(window.localStorage, desk, operatorRole);
      const nextSlices = currentStoredSlices.some((slice) => slice.href === currentSlice.href)
        ? currentStoredSlices.filter((slice) => slice.href !== currentSlice.href)
        : [{ href: currentSlice.href, id: currentSlice.href, label: currentSlice.label }, ...currentStoredSlices].slice(
            0,
            maxPinnedSlices
          );

      writeDeskSavedSlices(window.localStorage, desk, operatorRole, nextSlices);
      setPinnedSlices(nextSlices);
    } catch {
      setPinnedSlices((current) =>
        current.some((slice) => slice.href === currentSlice.href)
          ? current.filter((slice) => slice.href !== currentSlice.href)
          : [{ href: currentSlice.href, id: currentSlice.href, label: currentSlice.label }, ...current].slice(
              0,
              maxPinnedSlices
            )
      );
    }
  }

  if (!mergedSlices.length && !currentSlice.href) {
    return null;
  }

  return (
    <div className={cx("desk-saved-slices", className)}>
      <div className="desk-saved-slices__rail" role="navigation" aria-label={`${desk} saved slices`}>
        <button
          className={buttonClassName({ size: "sm", tone: isCurrentPinned ? "secondary" : "ghost" })}
          onClick={handleToggleCurrentSlice}
          type="button"
        >
          {isCurrentPinned ? "Pinned current" : pinCurrentLabel}
        </button>
        {visibleSlices.map((slice) => (
          <Link
            className={cx(
              buttonClassName({
                size: "sm",
                tone:
                  slice.href === currentSlice.href
                    ? "secondary"
                    : slice.tone ?? (slice.source === "pinned" ? "secondary" : "ghost")
              }),
              "desk-saved-slices__pill",
              slice.source === "pinned" && "desk-saved-slices__pill--pinned",
              slice.href === currentSlice.href && "desk-saved-slices__pill--active"
            )}
            href={slice.href}
            key={slice.id}
            scroll={false}
            title={
              slice.source === "pinned"
                ? `${slice.label} (pinned for ${normalizeDeskRole(operatorRole)})`
                : slice.label
            }
          >
            {slice.label}
          </Link>
        ))}
        {hiddenSliceCount > 0 ? (
          <button
            className={buttonClassName({ size: "sm", tone: "ghost" })}
            onClick={() => setExpanded(true)}
            type="button"
          >
            {`More ${hiddenSliceCount}`}
          </button>
        ) : null}
        {expanded && mergedSlices.length > collapsedVisibleSliceCount ? (
          <button
            className={buttonClassName({ size: "sm", tone: "ghost" })}
            onClick={() => setExpanded(false)}
            type="button"
          >
            Less
          </button>
        ) : null}
      </div>
    </div>
  );
}
