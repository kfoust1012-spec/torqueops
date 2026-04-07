import { useRef, type CSSProperties } from "react";
import type { DispatchCalendarJobEvent } from "@mobile-mechanic/types";
import {
  formatDispatchDateTime,
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus
} from "@mobile-mechanic/core";

import { cx } from "../../../../components/ui";
import {
  getDispatchOnBoardFollowThroughActionLabel,
  type DispatchOnBoardPromiseSummary
} from "../../../../lib/dispatch/follow-through";

import {
  formatDispatchDuration,
  formatDispatchArrivalWindow,
  getDispatchVisitOperationalSignal,
  getDispatchVisitTimelineProgress,
  getDispatchVisitSupportingText,
  shouldEmphasizePriority
} from "./dispatch-calendar-signals";

type DispatchVisitEventProps = {
  density?: "default" | "dense" | "tight";
  event: DispatchCalendarJobEvent;
  isFreshPlacement?: boolean;
  isDragging?: boolean;
  isThreadDimmed?: boolean;
  isThreadNeighbor?: boolean;
  keyboardMoveControls?:
    | {
        canMoveBackward: boolean;
        canMoveEarlier: boolean;
        canMoveForward: boolean;
        canMoveLater: boolean;
        canResizeLonger: boolean;
        canResizeShorter: boolean;
        hint: string;
        onMoveBackward: () => void;
        onMoveEarlier: () => void;
        onMoveForward: () => void;
        onMoveLater: () => void;
        onResizeLonger: () => void;
        onResizeShorter: () => void;
      }
    | null
    | undefined;
  isPendingMutation?: boolean;
  promiseSummary?: DispatchOnBoardPromiseSummary | null;
  isSelected?: boolean;
  now: Date;
  onClick: () => void;
  onDragEnd: () => void;
  onDragStart: () => void;
  onResizeStart: (input: { clientY: number; pointerId: number }) => void;
  style: CSSProperties;
  timezone: string;
};

function getEventFlags(event: DispatchCalendarJobEvent) {
  const flags: Array<{ label: string; tone: "warning" | "danger" }> = [];

  if (event.overlapsOtherJobs) {
    flags.push({ label: "Overlap", tone: "danger" });
  }

  if (event.overlapsAvailability) {
    flags.push({ label: "Availability", tone: "warning" });
  }

  if (event.isOutsideVisibleHours) {
    flags.push({ label: "Outside hours", tone: "warning" });
  }

  return flags;
}

function formatStatusLabel(status: DispatchCalendarJobEvent["status"]) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getStatusTone(status: DispatchCalendarJobEvent["status"]) {
  if (status === "completed") {
    return "success" as const;
  }

  if (status === "canceled") {
    return "neutral" as const;
  }

  if (isTechnicianOnSiteJobStatus(status)) {
    return "progress" as const;
  }

  if (isTechnicianActiveFieldJobStatus(status)) {
    return "info" as const;
  }

  return "brand" as const;
}

export function DispatchVisitEvent({
  density = "default",
  event,
  isFreshPlacement = false,
  isDragging,
  isThreadDimmed = false,
  isThreadNeighbor = false,
  keyboardMoveControls,
  isPendingMutation,
  promiseSummary = null,
  isSelected,
  now,
  onClick,
  onDragEnd,
  onDragStart,
  onResizeStart,
  style,
  timezone
}: DispatchVisitEventProps) {
  const suppressClickUntilRef = useRef(0);
  const flags = getEventFlags(event);
  const operationalSignal = getDispatchVisitOperationalSignal(event, timezone, now);
  const timelineProgress = getDispatchVisitTimelineProgress(event, now);
  const supportingText = getDispatchVisitSupportingText(event, timezone);
  const arrivalWindow = formatDispatchArrivalWindow(event, timezone);
  const statusLabel = formatStatusLabel(event.status);
  const routeLabel = arrivalWindow
    ? "Promise"
    : timelineProgress.isLive
      ? "Field"
      : "Next";
  const routeCopy = arrivalWindow ?? supportingText;
  const showOperationalChip =
    timelineProgress.isLive ||
    timelineProgress.isLate ||
    operationalSignal.tone === "danger" ||
    operationalSignal.tone === "warning" ||
    operationalSignal.tone === "progress";
  const showDuration = density !== "tight";
  const showSupportRow =
    density !== "tight" || timelineProgress.isLive || timelineProgress.isLate || Boolean(arrivalWindow);
  const followThroughNeedsAttention = Boolean(
    promiseSummary &&
      promiseSummary.recommendedAction &&
      (promiseSummary.tone === "warning" || promiseSummary.tone === "danger")
  );
  const followThroughChipLabel = followThroughNeedsAttention
    ? getDispatchOnBoardFollowThroughActionLabel(promiseSummary?.recommendedAction ?? null)
    : null;
  const showKeyboardHint = Boolean(isSelected && keyboardMoveControls && density !== "tight");
  const showKeyboardShortcutRow = Boolean(isSelected && keyboardMoveControls && density === "default");
  const keyboardHint = showKeyboardHint ? keyboardMoveControls?.hint ?? null : null;
  const primaryChipLabel = showOperationalChip ? operationalSignal.label : statusLabel;
  const primaryChipTone = showOperationalChip ? operationalSignal.tone : getStatusTone(event.status);
  const secondaryChip = flags[0]
    ? flags[0]
    : shouldEmphasizePriority(event.priority)
      ? {
          label: event.priority === "urgent" ? "Urgent" : "High priority",
          tone: event.priority === "urgent" ? "danger" : "warning"
        }
      : null;
  const formattedStartAt = formatDispatchDateTime(event.eventStartAt, timezone, {
    day: undefined,
    hour: "numeric",
    minute: "2-digit",
    month: undefined
  });
  const formattedEndAt = formatDispatchDateTime(event.eventEndAt, timezone, {
    day: undefined,
    hour: "numeric",
    minute: "2-digit",
    month: undefined
  });
  const showSecondaryChip = Boolean(secondaryChip && !followThroughChipLabel);
  const subtitleParts = [event.customerDisplayName, event.vehicleDisplayName].filter(Boolean);
  const compactTimeLabel = `${formattedStartAt} - ${formattedEndAt}${
    showDuration ? ` · ${formatDispatchDuration(event.durationMinutes)}` : ""
  }`;
  const supportCopy = followThroughNeedsAttention
    ? promiseSummary?.lastCustomerUpdateLabel ?? routeCopy
    : routeCopy;

  return (
    <article
      aria-grabbed={isDragging || undefined}
      className={cx(
        "dispatch-calendar__event",
        "dispatch-calendar__event--job",
        event.status === "new" && "dispatch-calendar__event--status-new",
        event.status === "scheduled" && "dispatch-calendar__event--status-scheduled",
        event.status === "dispatched" && "dispatch-calendar__event--status-dispatched",
        event.status === "in_progress" && "dispatch-calendar__event--status-in-progress",
        event.status === "completed" && "dispatch-calendar__event--status-completed",
        event.status === "canceled" && "dispatch-calendar__event--status-canceled",
        event.priority === "high" && "dispatch-calendar__event--priority-high",
        event.priority === "urgent" && "dispatch-calendar__event--priority-urgent",
        event.overlapsOtherJobs && "dispatch-calendar__event--danger",
        event.overlapsAvailability && "dispatch-calendar__event--warning",
        timelineProgress.isLive && "dispatch-calendar__event--live",
        timelineProgress.isLate && "dispatch-calendar__event--late",
        followThroughNeedsAttention && "dispatch-calendar__event--follow-through-attention",
        isFreshPlacement && "dispatch-calendar__event--placement-highlight",
        isThreadNeighbor && "dispatch-calendar__event--thread-neighbor",
        isThreadDimmed && "dispatch-calendar__event--thread-dimmed",
        isPendingMutation && "dispatch-calendar__event--pending",
        isSelected && "dispatch-calendar__event--selected",
        isDragging && "dispatch-calendar__event--dragging",
        density === "dense" && "dispatch-calendar__event--dense",
        density === "tight" && "dispatch-calendar__event--tight"
      )}
      draggable
      id={`dispatch-job-${event.id}`}
      onDragEnd={onDragEnd}
      onDragStart={(eventObject) => {
        eventObject.dataTransfer.effectAllowed = "move";
        eventObject.dataTransfer.setData("text/plain", event.id);
        suppressClickUntilRef.current = Date.now() + 300;
        onDragStart();
      }}
      style={style}
    >
      <div className="dispatch-calendar__event-accent" />
      <button
        aria-describedby={showKeyboardHint ? `dispatch-job-hint-${event.id}` : undefined}
        aria-keyshortcuts={
          keyboardMoveControls
            ? "ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown"
            : undefined
        }
        className="dispatch-calendar__event-body"
        onClick={() => {
          if (Date.now() < suppressClickUntilRef.current) {
            return;
          }

          onClick();
        }}
        onKeyDown={(keyboardEvent) => {
          if (!keyboardMoveControls) {
            return;
          }

          if (keyboardEvent.shiftKey && keyboardEvent.key === "ArrowUp" && keyboardMoveControls.canResizeShorter) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onResizeShorter();
            return;
          }

          if (keyboardEvent.shiftKey && keyboardEvent.key === "ArrowDown" && keyboardMoveControls.canResizeLonger) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onResizeLonger();
            return;
          }

          if (keyboardEvent.key === "ArrowUp" && keyboardMoveControls.canMoveEarlier) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onMoveEarlier();
            return;
          }

          if (keyboardEvent.key === "ArrowDown" && keyboardMoveControls.canMoveLater) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onMoveLater();
            return;
          }

          if (keyboardEvent.key === "ArrowLeft" && keyboardMoveControls.canMoveBackward) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onMoveBackward();
            return;
          }

          if (keyboardEvent.key === "ArrowRight" && keyboardMoveControls.canMoveForward) {
            keyboardEvent.preventDefault();
            keyboardMoveControls.onMoveForward();
          }
        }}
        type="button"
      >
        <div className="dispatch-calendar__event-topline">
          <span className="dispatch-calendar__event-time-pill">
            {timelineProgress.isLive ? (
              <span className="dispatch-calendar__event-live-dot" aria-hidden />
            ) : null}
            {compactTimeLabel}
          </span>
        </div>

        <div className="dispatch-calendar__event-heading">
          <strong>{event.title}</strong>
          <p>{subtitleParts.join(" · ")}</p>
        </div>

        <div className="dispatch-calendar__event-route-row">
          <span
            className={cx(
              "dispatch-calendar__event-workflow-chip",
              primaryChipTone === "danger" && "dispatch-calendar__event-workflow-chip--danger",
              primaryChipTone === "progress" && "dispatch-calendar__event-workflow-chip--progress",
              primaryChipTone === "success" && "dispatch-calendar__event-workflow-chip--success",
              primaryChipTone === "info" && "dispatch-calendar__event-workflow-chip--info",
              primaryChipTone === "brand" && "dispatch-calendar__event-workflow-chip--brand",
              primaryChipTone === "neutral" && "dispatch-calendar__event-workflow-chip--neutral",
              primaryChipTone === "warning" && "dispatch-calendar__event-workflow-chip--warning"
            )}
          >
            {primaryChipLabel}
          </span>
          {showSecondaryChip && secondaryChip ? (
            <span
              className={cx(
                "dispatch-calendar__event-flag",
                secondaryChip.tone === "warning" && "dispatch-calendar__event-flag--warning",
                secondaryChip.tone === "danger" && "dispatch-calendar__event-flag--danger"
              )}
            >
              {secondaryChip.label}
            </span>
          ) : null}
          {followThroughChipLabel ? (
            <span
              className={cx(
                "dispatch-calendar__event-follow-chip",
                promiseSummary?.tone === "danger"
                  ? "dispatch-calendar__event-follow-chip--danger"
                  : "dispatch-calendar__event-follow-chip--warning"
              )}
            >
              {followThroughChipLabel}
            </span>
          ) : null}
        </div>

        {showSupportRow ? (
          <p className="dispatch-calendar__event-support-row">
            <span className="dispatch-calendar__event-support-copy">
              {followThroughNeedsAttention ? `${routeLabel} · ${supportCopy}` : supportCopy}
            </span>
          </p>
        ) : null}

        {timelineProgress.progressPercent !== null ? (
          <div
            className={cx(
              "dispatch-calendar__event-progress",
              timelineProgress.isLate && "dispatch-calendar__event-progress--late"
            )}
          >
            <span
              className="dispatch-calendar__event-progress-fill"
              style={{ width: `${timelineProgress.progressPercent}%` }}
            />
          </div>
        ) : null}

        {showKeyboardShortcutRow ? (
          <div className="dispatch-calendar__event-shortcuts" aria-hidden>
            <span className="dispatch-calendar__event-shortcut">
              <span className="dispatch-calendar__event-shortcut-label">Move</span>
              <span className="dispatch-calendar__event-shortcut-keys">Arrows</span>
            </span>
            <span className="dispatch-calendar__event-shortcut">
              <span className="dispatch-calendar__event-shortcut-label">Resize</span>
              <span className="dispatch-calendar__event-shortcut-keys">Shift + Arrows</span>
            </span>
          </div>
        ) : null}

        {keyboardHint ? (
          <span className="dispatch-calendar__event-keyboard-hint" id={`dispatch-job-hint-${event.id}`}>
            {keyboardHint}
          </span>
        ) : null}
      </button>
      <button
        aria-label={`Resize ${event.title}`}
        className="dispatch-calendar__resize-handle"
        onPointerDown={(pointerEvent) => {
          pointerEvent.preventDefault();
          pointerEvent.stopPropagation();
          onResizeStart({
            clientY: pointerEvent.clientY,
            pointerId: pointerEvent.pointerId
          });
        }}
        type="button"
      />
    </article>
  );
}

export const DispatchJobEvent = DispatchVisitEvent;
