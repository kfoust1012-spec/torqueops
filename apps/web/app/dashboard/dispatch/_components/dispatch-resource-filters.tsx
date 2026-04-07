"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatDesignLabel,
  toDispatchDateTimeInput
} from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  CreateTechnicianAvailabilityBlockInput,
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarScope,
  DispatchCalendarSettings,
  DispatchResourcePreference,
  DispatchSavedView,
  TechnicianAvailabilityBlockType,
  UpdateTechnicianAvailabilityBlockInput
} from "@mobile-mechanic/types";

import { AppIcon, Button, Input, Select, buttonClassName, cx } from "../../../../components/ui";

type DispatchResourceFiltersProps = {
  defaultDayDate: string;
  includeUnassigned: boolean;
  onClearSelectedAvailabilityBlock: () => void;
  onClose: () => void;
  onCreateAvailabilityBlock: (
    input: Omit<CreateTechnicianAvailabilityBlockInput, "companyId" | "createdByUserId">
  ) => Promise<void>;
  onOpenSavedViewDialog: () => void;
  onRemoveAvailabilityBlock: (blockId: string) => Promise<void>;
  onSavedViewChange: (savedViewId: string) => void;
  onScopeChange: (scope: DispatchCalendarScope) => void;
  onSelectSingleTechnician: (technicianUserId: string) => void;
  onToggleIncludeUnassigned: (value: boolean) => void;
  onToggleSubsetTechnician: (technicianUserId: string) => void;
  onUpdateAvailabilityBlock: (
    blockId: string,
    input: UpdateTechnicianAvailabilityBlockInput
  ) => Promise<void>;
  pendingAvailabilityBlock: boolean;
  pendingAvailabilityBlockId: string | null;
  removingAvailabilityBlockId: string | null;
  resourcePreferences: DispatchResourcePreference[];
  savedViewId: string;
  savedViews: DispatchSavedView[];
  scope: DispatchCalendarScope;
  selectedAvailabilityBlock: DispatchCalendarAvailabilityEvent | null;
  selectedResourceUserIds: string[];
  settings: DispatchCalendarSettings;
  settingsHref: string;
  technicians: AssignableTechnicianOption[];
  timezone: string;
};

const availabilityBlockTypes: TechnicianAvailabilityBlockType[] = [
  "unavailable",
  "time_off",
  "break",
  "training"
];

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getDefaultAvailabilityWindow(dayDate: string, settings: DispatchCalendarSettings) {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = dayDate
    .split("-")
    .map((value) => Number(value));
  const fallbackDate = new Date();
  const safeYear = Number.isFinite(year) ? year : fallbackDate.getFullYear();
  const safeMonth = Number.isFinite(month) ? month : fallbackDate.getMonth() + 1;
  const safeDay = Number.isFinite(day) ? day : fallbackDate.getDate();
  const startDate = new Date(
    safeYear,
    safeMonth - 1,
    safeDay,
    settings.dayStartHour,
    0,
    0,
    0
  );
  const durationMinutes = Math.max(settings.slotMinutes * 2, 60);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  return {
    endsAt: formatLocalDateTime(endDate),
    startsAt: formatLocalDateTime(startDate)
  };
}

function sortTechnicians(
  technicians: AssignableTechnicianOption[],
  resourcePreferences: DispatchResourcePreference[]
) {
  const orderByTechnicianId = new Map(
    resourcePreferences.map((preference) => [preference.technicianUserId, preference.laneOrder])
  );

  return [...technicians].sort((left, right) => {
    const leftOrder = orderByTechnicianId.get(left.userId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByTechnicianId.get(right.userId) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((segment) => segment.trim()[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DispatchResourceFilters({
  defaultDayDate,
  includeUnassigned,
  onClearSelectedAvailabilityBlock,
  onClose,
  onCreateAvailabilityBlock,
  onOpenSavedViewDialog,
  onRemoveAvailabilityBlock,
  onSavedViewChange,
  onScopeChange,
  onSelectSingleTechnician,
  onToggleIncludeUnassigned,
  onToggleSubsetTechnician,
  onUpdateAvailabilityBlock,
  pendingAvailabilityBlock,
  pendingAvailabilityBlockId,
  removingAvailabilityBlockId,
  resourcePreferences,
  savedViewId,
  savedViews,
  scope,
  selectedAvailabilityBlock,
  selectedResourceUserIds,
  settings,
  settingsHref,
  technicians,
  timezone
}: DispatchResourceFiltersProps) {
  const sortedTechnicians = sortTechnicians(technicians, resourcePreferences);
  const selectedSingleTechnicianId = selectedResourceUserIds[0] ?? sortedTechnicians[0]?.userId ?? "";
  const scopeSummary =
    scope === "all_workers"
      ? "All lanes"
      : scope === "single_tech"
        ? "One lane"
        : `${selectedResourceUserIds.length} selected`;
  const [technicianUserId, setTechnicianUserId] = useState(selectedSingleTechnicianId);
  const [title, setTitle] = useState("Unavailable");
  const [blockType, setBlockType] = useState<TechnicianAvailabilityBlockType>("unavailable");
  const [startsAt, setStartsAt] = useState(getDefaultAvailabilityWindow(defaultDayDate, settings).startsAt);
  const [endsAt, setEndsAt] = useState(getDefaultAvailabilityWindow(defaultDayDate, settings).endsAt);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAvailabilityBlock) {
      setTechnicianUserId(selectedAvailabilityBlock.technicianUserId);
      setTitle(selectedAvailabilityBlock.title);
      setBlockType(selectedAvailabilityBlock.blockType);
      setStartsAt(toDispatchDateTimeInput(selectedAvailabilityBlock.startsAt, timezone));
      setEndsAt(toDispatchDateTimeInput(selectedAvailabilityBlock.endsAt, timezone));
      setNotes(selectedAvailabilityBlock.notes ?? "");
      setError(null);
      return;
    }

    const nextWindow = getDefaultAvailabilityWindow(defaultDayDate, settings);
    setTechnicianUserId((current) => current || selectedSingleTechnicianId);
    setTitle("Unavailable");
    setBlockType("unavailable");
    setStartsAt(nextWindow.startsAt);
    setEndsAt(nextWindow.endsAt);
    setNotes("");
    setError(null);
  }, [defaultDayDate, selectedAvailabilityBlock, selectedSingleTechnicianId, settings, timezone]);

  async function handleSaveAvailabilityBlock() {
    if (!technicianUserId) {
      setError("Select a technician lane.");
      return;
    }

    if (!startsAt || !endsAt) {
      setError("Start and end are required.");
      return;
    }

    if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
      setError("End must be after start.");
      return;
    }

    setError(null);
    const payload = {
      blockType,
      endsAt,
      isAllDay: false,
      notes: notes.trim() || null,
      startsAt,
      technicianUserId,
      title: title.trim() || formatDesignLabel(blockType)
    };

    try {
      if (selectedAvailabilityBlock) {
        await onUpdateAvailabilityBlock(selectedAvailabilityBlock.id, payload);
      } else {
        await onCreateAvailabilityBlock(payload);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Availability block could not be saved.");
    }
  }

  return (
    <section className="dispatch-utility-tray">
      <div className="dispatch-utility-tray__header">
        <div className="dispatch-utility-tray__header-copy">
          <p className="dispatch-utility-tray__eyebrow">
            <AppIcon className="dispatch-utility-tray__eyebrow-icon" name="settings" />
            <span>Dispatch controls</span>
          </p>
          <h3 className="dispatch-utility-tray__title">Controls drawer</h3>
          <p className="dispatch-utility-tray__subline">
            Adjust lane focus, saved board views, and technician blocks without leaving dispatch.
          </p>
        </div>
        <Button onClick={onClose} size="sm" tone="tertiary" type="button">
          Close
        </Button>
      </div>

      <div className="dispatch-utility-tray__grid">
        <section className="dispatch-utility-tray__section dispatch-utility-tray__section--compact">
          <div className="dispatch-utility-tray__section-header">
            <div className="dispatch-utility-tray__section-copy">
              <h4 className="dispatch-utility-tray__section-title">
                <AppIcon className="dispatch-utility-tray__section-icon" name="team" />
                <span>Lane scope</span>
              </h4>
              <p className="dispatch-utility-tray__section-detail">Focus the board on the lanes you want to route.</p>
            </div>
            <span className="dispatch-utility-tray__section-meta">{scopeSummary}</span>
          </div>

          <div className="dispatch-utility-tray__segment" role="tablist" aria-label="Dispatch scope">
            <button
              aria-selected={scope === "all_workers"}
              className={cx(scope === "all_workers" && "dispatch-utility-tray__segment-button--active")}
              onClick={() => onScopeChange("all_workers")}
              role="tab"
              tabIndex={scope === "all_workers" ? 0 : -1}
              type="button"
            >
              All lanes
            </button>
            <button
              aria-selected={scope === "single_tech"}
              className={cx(scope === "single_tech" && "dispatch-utility-tray__segment-button--active")}
              onClick={() => onScopeChange("single_tech")}
              role="tab"
              tabIndex={scope === "single_tech" ? 0 : -1}
              type="button"
            >
              Single lane
            </button>
            <button
              aria-selected={scope === "subset"}
              className={cx(scope === "subset" && "dispatch-utility-tray__segment-button--active")}
              onClick={() => onScopeChange("subset")}
              role="tab"
              tabIndex={scope === "subset" ? 0 : -1}
              type="button"
            >
              Subset
            </button>
          </div>

          {scope === "single_tech" ? (
            <label className="dispatch-utility-tray__field">
              <span>Focused lane</span>
              <Select
                onChange={(event) => onSelectSingleTechnician(event.currentTarget.value)}
                value={selectedSingleTechnicianId}
              >
                {sortedTechnicians.map((technician) => (
                  <option key={technician.userId} value={technician.userId}>
                    {technician.displayName}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {scope === "subset" ? (
            <div className="dispatch-utility-tray__chip-list">
              {sortedTechnicians.map((technician) => {
                const selected = selectedResourceUserIds.includes(technician.userId);

                return (
                  <button
                    className={cx(
                      "dispatch-utility-tray__tech-chip",
                      selected && "dispatch-utility-tray__tech-chip--active"
                    )}
                    disabled={selected && selectedResourceUserIds.length === 1}
                    key={technician.userId}
                    onClick={() => onToggleSubsetTechnician(technician.userId)}
                    type="button"
                  >
                    <span className="dispatch-utility-tray__tech-avatar">
                      {getInitials(technician.displayName)}
                    </span>
                    <span className="dispatch-utility-tray__tech-copy">
                      <strong>{technician.displayName}</strong>
                      <span>{technician.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="dispatch-utility-tray__section dispatch-utility-tray__section--compact">
          <div className="dispatch-utility-tray__section-header">
            <div className="dispatch-utility-tray__section-copy">
              <h4 className="dispatch-utility-tray__section-title">
                <AppIcon className="dispatch-utility-tray__section-icon" name="dashboard" />
                <span>Board view</span>
              </h4>
              <p className="dispatch-utility-tray__section-detail">Save the crew scope and board layout you dispatch from.</p>
            </div>
            <span className="dispatch-utility-tray__section-meta">{savedViews.length} saved</span>
          </div>

          <label className="dispatch-utility-tray__field">
            <span>Saved view</span>
            <Select onChange={(event) => onSavedViewChange(event.currentTarget.value)} value={savedViewId}>
              <option value="">Live board</option>
              {savedViews.map((savedView) => (
                <option key={savedView.id} value={savedView.id}>
                  {savedView.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="dispatch-utility-tray__switch">
            <span>Queue drawer</span>
            <input
              checked={includeUnassigned}
              onChange={(event) => onToggleIncludeUnassigned(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>{includeUnassigned ? "Visible" : "Hidden"}</span>
          </label>

          <div className="dispatch-utility-tray__actions">
            <Button onClick={onOpenSavedViewDialog} size="sm" tone="secondary" type="button">
              Save view
            </Button>
            <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={settingsHref}>
              Rules
            </Link>
          </div>
        </section>

        <section className="dispatch-utility-tray__section">
          <div className="dispatch-utility-tray__section-header">
            <div className="dispatch-utility-tray__section-copy">
              <h4 className="dispatch-utility-tray__section-title">
                <AppIcon className="dispatch-utility-tray__section-icon" name="today" />
                <span>{selectedAvailabilityBlock ? "Edit lane block" : "Lane block"}</span>
              </h4>
              <p className="dispatch-utility-tray__section-detail">Shape a lane when a technician is unavailable, on break, or in training.</p>
            </div>
            {selectedAvailabilityBlock ? (
              <button
                className="dispatch-utility-tray__inline-action"
                onClick={onClearSelectedAvailabilityBlock}
                type="button"
              >
                Clear form
              </button>
            ) : null}
          </div>

          <label className="dispatch-utility-tray__field">
            <span>Lane owner</span>
            <Select onChange={(event) => setTechnicianUserId(event.currentTarget.value)} value={technicianUserId}>
              {sortedTechnicians.map((technician) => (
                <option key={technician.userId} value={technician.userId}>
                  {technician.displayName}
                </option>
              ))}
            </Select>
          </label>

          <div className="dispatch-utility-tray__field-row">
            <label className="dispatch-utility-tray__field">
              <span>Block type</span>
              <Select
                onChange={(event) => setBlockType(event.currentTarget.value as TechnicianAvailabilityBlockType)}
                value={blockType}
              >
                {availabilityBlockTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatDesignLabel(value)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="dispatch-utility-tray__field">
              <span>Title</span>
              <Input onChange={(event) => setTitle(event.currentTarget.value)} value={title} />
            </label>
          </div>

          <div className="dispatch-utility-tray__field-row">
            <label className="dispatch-utility-tray__field">
              <span>Start</span>
              <Input
                onChange={(event) => setStartsAt(event.currentTarget.value)}
                type="datetime-local"
                value={startsAt}
              />
            </label>
            <label className="dispatch-utility-tray__field">
              <span>End</span>
              <Input
                onChange={(event) => setEndsAt(event.currentTarget.value)}
                type="datetime-local"
                value={endsAt}
              />
            </label>
          </div>

          <label className="dispatch-utility-tray__field">
            <span>Notes</span>
            <textarea
              className="ui-textarea"
              onChange={(event) => setNotes(event.currentTarget.value)}
              rows={3}
              value={notes}
            />
          </label>

          {error ? <p className="ui-field__error">{error}</p> : null}

          <div className="dispatch-utility-tray__actions">
            <Button
              loading={
                selectedAvailabilityBlock
                  ? pendingAvailabilityBlockId === selectedAvailabilityBlock.id
                  : pendingAvailabilityBlock
              }
              onClick={() => void handleSaveAvailabilityBlock()}
              size="sm"
              type="button"
            >
              {selectedAvailabilityBlock ? "Save block" : "Add block"}
            </Button>
            {selectedAvailabilityBlock ? (
              <Button
                loading={removingAvailabilityBlockId === selectedAvailabilityBlock.id}
                onClick={() => void onRemoveAvailabilityBlock(selectedAvailabilityBlock.id)}
                size="sm"
                tone="danger"
                type="button"
              >
                Remove
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
