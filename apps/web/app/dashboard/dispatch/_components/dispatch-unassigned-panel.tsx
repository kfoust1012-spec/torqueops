"use client";

import { useRef } from "react";
import { formatDispatchDateTime } from "@mobile-mechanic/core";
import type { DispatchBoardJobItem } from "@mobile-mechanic/types";

import {
  AppIcon,
  Badge,
  Button,
  PriorityBadge,
  cx
} from "../../../../components/ui";
import {
  getDispatchQueueLabel,
  getDispatchQueueState,
  getVisitNextMove,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone
} from "../../../../lib/jobs/workflow";

type DispatchUnassignedPanelProps = {
  backlogJobs: DispatchBoardJobItem[];
  draggingVisitId: string | null;
  onClose?: (() => void) | undefined;
  onOpenVisit: (jobId: string) => void;
  onStartDraggingVisit: (jobId: string) => void;
  onStopDraggingVisit: () => void;
  presentation?: "dock" | "drawer";
  timezone: string;
  unassignedScheduledJobs: DispatchBoardJobItem[];
};

function DispatchQueueItem({
  draggingVisitId,
  visit,
  onOpenVisit,
  onStartDraggingVisit,
  onStopDraggingVisit,
  timezone
}: {
  draggingVisitId: string | null;
  visit: DispatchBoardJobItem;
  onOpenVisit: (jobId: string) => void;
  onStartDraggingVisit: (jobId: string) => void;
  onStopDraggingVisit: () => void;
  timezone: string;
}) {
  const suppressClickUntilRef = useRef(0);
  const workflowState = getVisitWorkflowState(visit);
  const queueState = getDispatchQueueState(visit);
  const scheduleLabel = visit.scheduledStartAt
    ? formatDispatchDateTime(visit.scheduledStartAt, timezone, {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "No slot yet";

  return (
    <article
      aria-grabbed={draggingVisitId === visit.id || undefined}
      className={cx(
        "dispatch-queue-item",
        draggingVisitId === visit.id && "dispatch-queue-item--dragging"
      )}
      draggable
      onDragEnd={onStopDraggingVisit}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", visit.id);
        suppressClickUntilRef.current = Date.now() + 300;
        onStartDraggingVisit(visit.id);
      }}
    >
      <button
        aria-label={`Open routing drawer for ${visit.title}`}
        className="dispatch-queue-item__button"
        onClick={() => {
          if (Date.now() < suppressClickUntilRef.current) {
            return;
          }

          onOpenVisit(visit.id);
        }}
        type="button"
      >
        <div className="dispatch-queue-item__header">
          <div className="dispatch-queue-item__identity">
            <strong>{visit.title}</strong>
            <p>
              {visit.customerDisplayName} · {visit.vehicleDisplayName}
            </p>
          </div>
          <div className="dispatch-queue-item__signals">
            {visit.priority === "high" || visit.priority === "urgent" ? (
              <PriorityBadge value={visit.priority} />
            ) : null}
            <Badge tone={getVisitWorkflowTone(workflowState)}>{getVisitWorkflowLabel(workflowState)}</Badge>
          </div>
        </div>

        <div className="dispatch-queue-item__meta">
          <span>{scheduleLabel}</span>
          <span>{visit.assignedTechnicianName ?? "Lane TBD"}</span>
          <span>{getDispatchQueueLabel(queueState)}</span>
        </div>

        <div className="dispatch-queue-item__footer">
          <span>{getVisitNextMove(visit)}</span>
        </div>
      </button>
    </article>
  );
}

export function DispatchUnassignedPanel({
  backlogJobs: backlogVisits,
  draggingVisitId,
  onClose,
  onOpenVisit,
  onStartDraggingVisit,
  onStopDraggingVisit,
  presentation = "drawer",
  timezone,
  unassignedScheduledJobs: unassignedScheduledVisits
}: DispatchUnassignedPanelProps) {
  const backlogAssignedVisits = backlogVisits.filter((visit) => visit.assignedTechnicianUserId);
  const intakeVisits = backlogVisits.filter((visit) => !visit.assignedTechnicianUserId);
  const queueSections = [
    {
      visits: unassignedScheduledVisits,
      key: "ready_now",
      label: "Ready to route"
    },
    {
      visits: backlogAssignedVisits,
      key: "needs_slot",
      label: "Needs slot"
    },
    {
      visits: intakeVisits,
      key: "intake_waiting",
      label: "Needs intake"
    }
  ];
  const visibleQueueSections = queueSections.filter((section) => section.visits.length > 0);
  const sectionsToRender = visibleQueueSections.length ? visibleQueueSections : queueSections.slice(0, 1);
  const totalQueueCount = unassignedScheduledVisits.length + backlogVisits.length;
  const title = presentation === "dock" ? "Release queue" : "Queue";

  return (
    <section className="dispatch-queue-rail">
      <div className="dispatch-queue-rail__header">
        <div>
          <p className="dispatch-queue-rail__eyebrow">
            <AppIcon className="dispatch-queue-rail__eyebrow-icon" name="jobs" />
            <span>Dispatch queue</span>
          </p>
          <h3 className="dispatch-queue-rail__title">{title}</h3>
        </div>
        <div className="dispatch-queue-rail__header-actions">
          <Badge tone="brand">{totalQueueCount}</Badge>
          {onClose ? (
            <Button onClick={onClose} size="sm" tone="tertiary" type="button">
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div className="dispatch-queue-rail__sections">
        {sectionsToRender.map((section) => (
          <section className="dispatch-queue-rail__section" key={section.key}>
            <div className="dispatch-queue-rail__section-header">
              <h4 className="dispatch-queue-rail__section-title">
                <AppIcon
                  className="dispatch-queue-rail__section-icon"
                  name={
                    section.key === "ready_now"
                      ? "approval"
                      : section.key === "needs_slot"
                        ? "dispatch"
                        : "alert"
                  }
                />
                <span>{section.label}</span>
              </h4>
              <Badge tone={section.key === "ready_now" ? "warning" : "neutral"}>
                {section.visits.length}
              </Badge>
            </div>

            {section.visits.length ? (
              <div className="dispatch-queue-rail__list">
                {section.visits.map((visit) => (
                  <DispatchQueueItem
                    draggingVisitId={draggingVisitId}
                    key={visit.id}
                    onOpenVisit={onOpenVisit}
                    onStartDraggingVisit={onStartDraggingVisit}
                    onStopDraggingVisit={onStopDraggingVisit}
                    timezone={timezone}
                    visit={visit}
                  />
                ))}
              </div>
            ) : (
              <p className="dispatch-queue-rail__empty">Clear for now.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
