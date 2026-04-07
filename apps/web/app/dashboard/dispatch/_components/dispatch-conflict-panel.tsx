"use client";

import { useEffect, useState } from "react";
import { formatDispatchConflictTypeLabel } from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  DispatchCalendarConflict
} from "@mobile-mechanic/types";

import { AppIcon, Badge, Button } from "../../../../components/ui";

function formatConflictDay(dayDate: string) {
  const date = new Date(`${dayDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dayDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

type DispatchConflictPanelProps = {
  conflicts: DispatchCalendarConflict[];
  focusedTechnicianUserId: string | null;
  onClearFocus: () => void;
  onClose: () => void;
  onOpenConflict: (conflict: DispatchCalendarConflict) => void;
  onOpenVisit: (jobId: string) => void;
  technicians: AssignableTechnicianOption[];
};

export function DispatchConflictPanel({
  conflicts,
  focusedTechnicianUserId,
  onClearFocus,
  onClose,
  onOpenConflict,
  onOpenVisit,
  technicians
}: DispatchConflictPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleConflicts = showAll ? conflicts : conflicts.slice(0, 8);
  const focusedTechnicianName = focusedTechnicianUserId
    ? technicians.find((technician) => technician.userId === focusedTechnicianUserId)?.displayName ??
      "Selected technician"
    : null;
  const dangerCount = conflicts.filter((conflict) => conflict.severity === "danger").length;
  const warningCount = conflicts.filter((conflict) => conflict.severity === "warning").length;
  const focusCopy = focusedTechnicianName
    ? `Showing only conflicts blocking ${focusedTechnicianName}.`
    : "Review board exceptions, jump to the lane, and open the visit only when the board alone is not enough.";

  useEffect(() => {
    setShowAll(false);
  }, [focusedTechnicianUserId]);

  return (
    <aside className="dispatch-conflict-panel">
      <div className="dispatch-conflict-panel__header">
        <div>
          <p className="dispatch-conflict-panel__eyebrow">
            <AppIcon className="dispatch-conflict-panel__eyebrow-icon" name="alert" />
            <span>Conflict file</span>
          </p>
          <h3 className="dispatch-conflict-panel__title">Resolve board exceptions</h3>
          <p className="dispatch-conflict-panel__header-copy">{focusCopy}</p>
        </div>
        <Button onClick={onClose} size="sm" tone="tertiary" type="button">
          Close
        </Button>
      </div>

      <div className="dispatch-conflict-panel__summary">
        <div className="dispatch-conflict-panel__summary-item dispatch-conflict-panel__summary-item--danger">
          <AppIcon className="dispatch-conflict-panel__summary-icon" name="alert" />
          <span>Danger</span>
          <strong>{dangerCount}</strong>
        </div>
        <div className="dispatch-conflict-panel__summary-item dispatch-conflict-panel__summary-item--warning">
          <AppIcon className="dispatch-conflict-panel__summary-icon" name="approval" />
          <span>Warning</span>
          <strong>{warningCount}</strong>
        </div>
      </div>

      {focusedTechnicianName ? (
        <div className="dispatch-conflict-panel__focus">
          <Badge tone="neutral">{focusedTechnicianName}</Badge>
          <Button onClick={onClearFocus} size="sm" tone="tertiary" type="button">
            Show all
          </Button>
        </div>
      ) : null}

      {visibleConflicts.length ? (
        <div className="dispatch-conflict-panel__list">
          {visibleConflicts.map((conflict) => (
            <article className="dispatch-conflict-panel__item" key={conflict.id}>
              <div className="dispatch-conflict-panel__item-header">
                <div className="dispatch-conflict-panel__item-copy">
                  <strong>{conflict.title}</strong>
                  <div className="dispatch-conflict-panel__item-meta">
                    <span>{formatConflictDay(conflict.dayDate)}</span>
                    {conflict.technicianUserId ? (
                      <span>
                        {technicians.find((technician) => technician.userId === conflict.technicianUserId)?.displayName ??
                          "Assigned lane"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="dispatch-conflict-panel__item-badges">
                  <Badge tone={conflict.severity === "danger" ? "danger" : "warning"}>
                    {conflict.severity === "danger" ? "Danger" : "Warning"}
                  </Badge>
                  <Badge tone="neutral">{formatDispatchConflictTypeLabel(conflict.conflictType)}</Badge>
                </div>
              </div>
              <p>{conflict.description}</p>
              <div className="dispatch-conflict-panel__item-actions">
                <Button onClick={() => onOpenConflict(conflict)} size="sm" tone="primary" type="button">
                  Reveal on board
                </Button>
                {conflict.jobId ? (
                  <Button onClick={() => onOpenVisit(conflict.jobId!)} size="sm" tone="secondary" type="button">
                    Open visit
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="dispatch-conflict-panel__empty">No conflicts in the current board scope.</p>
      )}

      {conflicts.length > visibleConflicts.length ? (
        <Button onClick={() => setShowAll((current) => !current)} size="sm" tone="tertiary" type="button">
          {showAll ? "Show less" : `Show all ${conflicts.length}`}
        </Button>
      ) : null}
    </aside>
  );
}
