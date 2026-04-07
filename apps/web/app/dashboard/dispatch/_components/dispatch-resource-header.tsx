import type { CSSProperties } from "react";
import type { DispatchCalendarResource } from "@mobile-mechanic/types";

import { cx } from "../../../../components/ui";
import type { DispatchLaneFollowThroughSummary } from "../../../../lib/dispatch/follow-through";
import { getDispatchLaneLoadState } from "../../../../lib/dispatch/lane-health";

import { DispatchConflictIndicator } from "./dispatch-conflict-indicator";

type DispatchResourceHeaderProps = {
  className?: string | undefined;
  isFocusedScope?: boolean | undefined;
  keyboardRouteAction?:
    | {
        ariaLabel: string;
        buttonLabel: string;
        disabled?: boolean;
        isCurrentPlacement: boolean;
        note: string;
        onRoute: () => void;
      }
    | null
    | undefined;
  onConflictClick?: (() => void) | undefined;
  onFocusLane?: (() => void) | undefined;
  routeSnapshot: {
    detail: string;
    headline: string;
    note: string;
  };
  resource: DispatchCalendarResource;
  summary: {
    availabilityBlockCount: number;
    blockedPercent: number;
    conflictCount: number;
    followThrough?: DispatchLaneFollowThroughSummary | undefined;
    scheduledCount: number;
    scheduledMinutes: number;
    utilizationPercent: number;
  };
  threadContextActions?:
    | Array<{
        disabled?: boolean | undefined;
        key: string;
        label: string;
        onClick: () => void;
        tone: "primary" | "secondary";
      }>
    | undefined;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
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

function formatBookedHours(minutes: number) {
  const hours = minutes / 60;

  if (!hours) {
    return "Open";
  }

  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h booked`;
}

export function DispatchResourceHeader({
  className,
  isFocusedScope,
  keyboardRouteAction,
  onConflictClick,
  onFocusLane,
  routeSnapshot,
  resource,
  summary,
  threadContextActions
}: DispatchResourceHeaderProps) {
  const laneState = getDispatchLaneLoadState({
    availabilityCount: summary.availabilityBlockCount,
    blockedPercent: summary.blockedPercent,
    conflictCount: summary.conflictCount,
    utilizationPercent: summary.utilizationPercent
  });
  const primaryMetric = summary.scheduledCount
    ? `${summary.scheduledCount} stop${summary.scheduledCount === 1 ? "" : "s"}`
    : formatBookedHours(summary.scheduledMinutes);
  const metrics = [
    primaryMetric,
    resource.backlogCount ? `${resource.backlogCount} waiting` : null,
    summary.availabilityBlockCount ? `${summary.availabilityBlockCount} block${summary.availabilityBlockCount === 1 ? "" : "s"}` : null
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  const capacitySummary = summary.blockedPercent
    ? `${formatPercent(summary.utilizationPercent)} booked · ${formatPercent(summary.blockedPercent)} blocked`
    : `${formatPercent(summary.utilizationPercent)} booked`;
  const showRouteNote =
    !keyboardRouteAction && !summary.followThrough?.attentionCount && !threadContextActions?.length;
  const showKeyboardNote = Boolean(keyboardRouteAction && !threadContextActions?.length);

  return (
    <div
      className={cx("dispatch-lane-header", className)}
      data-pressure={laneState.tone}
      style={
        resource.laneColor
          ? ({ "--dispatch-lane-accent": resource.laneColor } as CSSProperties)
          : undefined
      }
      >
      <div className="dispatch-lane-header__bar" />

      <div className="dispatch-lane-header__main">
        <div className="dispatch-lane-header__identity">
          <span className="dispatch-lane-header__avatar">{getInitials(resource.displayName)}</span>
          <div className="dispatch-lane-header__copy">
            <strong>{resource.displayName}</strong>
          </div>
        </div>

        <div className="dispatch-lane-header__actions">
          {keyboardRouteAction ? (
            <button
              aria-label={keyboardRouteAction.ariaLabel}
              className={cx(
                "dispatch-lane-header__route-button",
                keyboardRouteAction.isCurrentPlacement &&
                  "dispatch-lane-header__route-button--current"
              )}
              disabled={keyboardRouteAction.disabled}
              onClick={keyboardRouteAction.onRoute}
              type="button"
            >
              {keyboardRouteAction.isCurrentPlacement ? "Placed" : keyboardRouteAction.buttonLabel}
            </button>
          ) : null}
          {!threadContextActions?.length && isFocusedScope ? (
            <span className="dispatch-lane-header__focus-state">Focused</span>
          ) : !threadContextActions?.length && onFocusLane ? (
            <button className="dispatch-lane-header__focus-button" onClick={onFocusLane} type="button">
              Focus
            </button>
          ) : null}
          <DispatchConflictIndicator count={summary.conflictCount} onClick={onConflictClick} />
        </div>
      </div>

      <div className="dispatch-lane-header__capacity">
        <span
          className={`dispatch-lane-header__status dispatch-lane-header__status--${laneState.tone}`}
        >
          {laneState.label}
        </span>
        <div className="dispatch-lane-header__capacity-meta">
          <strong>{capacitySummary}</strong>
        </div>

        <div className="dispatch-lane-header__loadbar">
          <span
            className="dispatch-lane-header__loadbar-segment dispatch-lane-header__loadbar-segment--scheduled"
            style={{ width: `${summary.utilizationPercent}%` }}
          />
          {summary.blockedPercent ? (
            <span
              className="dispatch-lane-header__loadbar-segment dispatch-lane-header__loadbar-segment--blocked"
              style={{ width: `${summary.blockedPercent}%` }}
            />
          ) : null}
        </div>
      </div>

      <div className="dispatch-lane-header__route">
        <div className="dispatch-lane-header__route-headline">{routeSnapshot.headline}</div>
        <div className="dispatch-lane-header__route-detail" title={routeSnapshot.detail}>
          {routeSnapshot.detail}
        </div>
        {summary.followThrough?.attentionCount ? (
          <div className="dispatch-lane-header__follow-through">
            <span
              className={cx(
                "dispatch-lane-header__follow-through-badge",
                summary.followThrough.highestRiskTone === "danger" &&
                  "dispatch-lane-header__follow-through-badge--danger",
                summary.followThrough.highestRiskTone === "warning" &&
                  "dispatch-lane-header__follow-through-badge--warning"
              )}
            >
              {summary.followThrough.attentionCount} timing risk
              {summary.followThrough.attentionCount === 1 ? "" : "s"}
            </span>
            <span className="dispatch-lane-header__follow-through-copy">
              {summary.followThrough.staleLabel}
            </span>
          </div>
        ) : null}
        {showRouteNote ? (
          <div className="dispatch-lane-header__route-note">{routeSnapshot.note}</div>
        ) : null}
        {showKeyboardNote ? (
          <div className="dispatch-lane-header__route-keyboard-note">
            {keyboardRouteAction?.note}
          </div>
        ) : null}
        {threadContextActions?.length ? (
          <div className="dispatch-lane-header__thread-actions">
            {threadContextActions.map((action) => (
              <button
                className={cx(
                  "dispatch-lane-header__thread-action",
                  action.tone === "primary"
                    ? "dispatch-lane-header__thread-action--primary"
                    : "dispatch-lane-header__thread-action--secondary"
                )}
                disabled={action.disabled}
                key={action.key}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="dispatch-lane-header__metrics">
        {metrics.map((metric, index) => (
          <span
            className={cx(
              "dispatch-lane-header__metric",
              index === 0 && "dispatch-lane-header__metric--primary"
            )}
            key={metric}
          >
            {metric}
          </span>
        ))}
      </div>
    </div>
  );
}
