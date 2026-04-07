"use client";

import { useEffect, useState } from "react";
import type {
  AssignableTechnicianOption,
  DispatchCalendarScope,
  DispatchCalendarView,
  DispatchSavedView
} from "@mobile-mechanic/types";

import { Button, Input, Select, cx } from "../../../../components/ui";

type DispatchSavedViewDialogProps = {
  currentVisibleTechnicianIds: string[];
  currentView: DispatchCalendarView;
  includeUnassigned: boolean;
  onClose: () => void;
  onDelete: (savedViewId: string) => Promise<void>;
  onSave: (input: {
    includeUnassigned: boolean;
    isDefault: boolean;
    mode: "create" | "update";
    name: string;
    scope: DispatchCalendarScope;
    technicianUserIds: string[];
    view: DispatchCalendarView;
  }) => Promise<void>;
  open: boolean;
  savedView: DispatchSavedView | null;
  scope: DispatchCalendarScope;
  technicians: AssignableTechnicianOption[];
};

export function DispatchSavedViewDialog({
  currentVisibleTechnicianIds,
  currentView,
  includeUnassigned,
  onClose,
  onDelete,
  onSave,
  open,
  savedView,
  scope,
  technicians
}: DispatchSavedViewDialogProps) {
  const [name, setName] = useState(savedView?.name ?? "");
  const [dialogScope, setDialogScope] = useState<DispatchCalendarScope>(savedView?.scope ?? scope);
  const [dialogView, setDialogView] = useState<DispatchCalendarView>(savedView?.view ?? currentView);
  const [dialogIncludeUnassigned, setDialogIncludeUnassigned] = useState(
    savedView?.includeUnassigned ?? includeUnassigned
  );
  const [technicianUserIds, setTechnicianUserIds] = useState<string[]>(currentVisibleTechnicianIds);
  const [isDefault, setIsDefault] = useState(savedView?.isDefault ?? false);
  const [pendingMode, setPendingMode] = useState<"create" | "update" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(savedView?.name ?? "");
    setDialogScope(savedView?.scope ?? scope);
    setDialogView(savedView?.view ?? currentView);
    setDialogIncludeUnassigned(savedView?.includeUnassigned ?? includeUnassigned);
    setTechnicianUserIds(currentVisibleTechnicianIds);
    setIsDefault(savedView?.isDefault ?? false);
    setPendingMode(null);
    setError(null);
  }, [
    currentView,
    currentVisibleTechnicianIds,
    includeUnassigned,
    open,
    savedView,
    scope
  ]);

  if (!open) {
    return null;
  }

  async function handleSave(mode: "create" | "update") {
    if (!name.trim()) {
      setError("A saved view name is required.");
      return;
    }

    if (dialogScope !== "all_workers" && technicianUserIds.length === 0) {
      setError("Select at least one technician for this saved view.");
      return;
    }

    if (dialogScope === "single_tech" && technicianUserIds.length !== 1) {
      setError("Single-tech views must include exactly one technician.");
      return;
    }

    setPendingMode(mode);
    setError(null);

    try {
      await onSave({
        includeUnassigned: dialogIncludeUnassigned,
        isDefault,
        mode,
        name: name.trim(),
        scope: dialogScope,
        technicianUserIds:
          dialogScope === "single_tech" ? technicianUserIds.slice(0, 1) : technicianUserIds,
        view: dialogView
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Saved view could not be saved.");
    } finally {
      setPendingMode(null);
    }
  }

  async function handleDelete() {
    if (!savedView) {
      return;
    }

    setPendingMode("delete");
    setError(null);

    try {
      await onDelete(savedView.id);
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Saved view could not be deleted."
      );
    } finally {
      setPendingMode(null);
    }
  }

  function toggleTechnician(technicianUserId: string) {
    setTechnicianUserIds((current) => {
      if (dialogScope === "single_tech") {
        return [technicianUserId];
      }

      return current.includes(technicianUserId)
        ? current.filter((value) => value !== technicianUserId)
        : [...current, technicianUserId];
    });
  }

  return (
    <div className="dispatch-dialog">
      <button aria-label="Close saved view dialog" className="dispatch-dialog__backdrop" onClick={onClose} type="button" />
      <div className="dispatch-dialog__panel" role="dialog" aria-modal="true">
        <div className="dispatch-dialog__header">
          <div>
            <p className="dispatch-toolbar__eyebrow">Saved view</p>
            <h3 className="dispatch-toolbar__title">
              {savedView ? "Update saved view" : "Save current calendar"}
            </h3>
          </div>
          <Button onClick={onClose} tone="tertiary" type="button">
            Close
          </Button>
        </div>

        <div className="dispatch-dialog__body">
          <label className="dispatch-filters__field">
            <span>Name</span>
            <Input onChange={(event) => setName(event.currentTarget.value)} value={name} />
          </label>

          <div className="ui-form-row">
            <label className="dispatch-filters__field">
              <span>Scope</span>
              <Select
                onChange={(event) => {
                  const nextScope = event.currentTarget.value as DispatchCalendarScope;

                  setDialogScope(nextScope);
                  setTechnicianUserIds((current) => {
                    if (nextScope === "all_workers") {
                      return current;
                    }

                    if (nextScope === "single_tech") {
                      const selectedTechnician =
                        current[0] ?? currentVisibleTechnicianIds[0] ?? technicians[0]?.userId ?? "";
                      return selectedTechnician ? [selectedTechnician] : [];
                    }

                    return current.length
                      ? current
                      : currentVisibleTechnicianIds.length
                        ? currentVisibleTechnicianIds
                        : technicians[0]?.userId
                          ? [technicians[0].userId]
                          : [];
                  });
                }}
                value={dialogScope}
              >
                <option value="all_workers">All workers</option>
                <option value="single_tech">Single tech</option>
                <option value="subset">Subset</option>
              </Select>
            </label>
            <label className="dispatch-filters__field">
              <span>View</span>
              <Select
                onChange={(event) => setDialogView(event.currentTarget.value as DispatchCalendarView)}
                value={dialogView}
              >
                <option value="day">Day view</option>
                <option value="week">Week view</option>
                <option value="month">Month view</option>
              </Select>
            </label>
          </div>

          <label className="dispatch-filters__checkbox">
            <input
              checked={dialogIncludeUnassigned}
              onChange={(event) => setDialogIncludeUnassigned(event.currentTarget.checked)}
              type="checkbox"
            />
            Include unassigned work rail
          </label>

          <label className="dispatch-filters__checkbox">
            <input
              checked={isDefault}
              onChange={(event) => setIsDefault(event.currentTarget.checked)}
              type="checkbox"
            />
            Make this the default dispatch view
          </label>

          {dialogScope !== "all_workers" ? (
            <div className="dispatch-dialog__resource-picker">
              {technicians.map((technician) => {
                const selected = technicianUserIds.includes(technician.userId);

                return (
                  <button
                    className={cx(
                      "dispatch-filter-chip",
                      selected && "dispatch-filter-chip--active"
                    )}
                    key={technician.userId}
                    onClick={() => toggleTechnician(technician.userId)}
                    type="button"
                  >
                    {technician.displayName}
                  </button>
                );
              })}
            </div>
          ) : null}

          {error ? <p className="ui-field__error">{error}</p> : null}
        </div>

        <div className="dispatch-dialog__footer">
          {savedView ? (
            <>
              <Button
                loading={pendingMode === "delete"}
                onClick={handleDelete}
                tone="danger"
                type="button"
              >
                Delete view
              </Button>
              <Button
                loading={pendingMode === "update"}
                onClick={() => void handleSave("update")}
                tone="primary"
                type="button"
              >
                Update view
              </Button>
              <Button
                loading={pendingMode === "create"}
                onClick={() => void handleSave("create")}
                tone="secondary"
                type="button"
              >
                Save as new
              </Button>
            </>
          ) : (
            <Button
              loading={pendingMode === "create"}
              onClick={() => void handleSave("create")}
              tone="primary"
              type="button"
            >
              Save view
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
