"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Input,
  Page,
  Select,
  buttonClassName,
  cx,
  type BadgeTone
} from "../../../../components/ui";
import { FieldCommandShell } from "../../_components/field-command-shell";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { getBrowserSupabaseClient } from "../../../../lib/supabase/browser";
import {
  derivePromiseConfidenceSnapshot,
  deriveRouteConfidenceSnapshot
} from "../../../../lib/service-thread/continuity";
import { buildVisitThreadHref } from "../../../../lib/visits/workspace";
import { FleetLiveMap } from "./fleet-live-map";
import {
  findLiveDeviceForTechnicianId,
  getTrackingStatusLabel,
  getTrackingTone,
  type FleetLiveDevice
} from "./fleet-live-tracking";
import {
  type FleetCrewReadinessPacket,
  formatFleetMiles,
  formatFleetMinutes,
  getFleetOperationalStatusLabel,
  getFleetPriorityLabel,
  getFleetRouteHealthTone,
  type FleetRouteMetrics,
  type FleetStopView,
  type FleetTechnicianView,
  type FleetWorkspaceData
} from "./fleet-types";
import type { WorkspaceBlockerSummary } from "../../../../lib/jobs/workspace-blockers";
import {
  getFieldLaneAttentionPriority,
  getFieldLaneCapacityScore,
  getFieldLaneCapacitySummary,
  getFieldLaneDriftSummary,
  getFieldLaneInspectorAction,
  getFieldLanePriorityCopy,
  getFieldLanePriorityLabel
} from "../../../../lib/dispatch/intelligence";

type FleetWorkspaceProps = {
  initialBlockers: WorkspaceBlockerSummary;
  initialData: FleetWorkspaceData;
};

type LiveFleetPayload = {
  refreshedAt: string;
  technicians: FleetLiveDevice[];
};

type NoticeTone = "default" | "warning" | "danger" | "success";

type Notice = {
  body: string;
  title: string;
  tone: NoticeTone;
};

type FleetCapacityCandidate = {
  score: number;
  summary: string;
  technician: FleetTechnicianView;
};

type FleetDriftCandidate = {
  summary: string;
  technician: FleetTechnicianView;
  tone: "danger" | "warning";
};

function getFleetSignalToneFromTracking(
  tone: ReturnType<typeof getTrackingTone>
): FleetCrewReadinessPacket["signals"][number]["tone"] {
  if (tone === "danger" || tone === "warning" || tone === "success") {
    return tone;
  }

  return "neutral";
}

function isValidDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatFleetClock(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function buildDispatchHref(date: string, technicianUserId?: string | null) {
  const params = new URLSearchParams({ date });

  if (technicianUserId) {
    params.set("resourceUserIds", technicianUserId);
  }

  return `/dashboard/dispatch?${params.toString()}`;
}

function formatTechnicianFilterLabel(technician: FleetTechnicianView) {
  if (technician.vehicleUnit) {
    return `${technician.name} • ${technician.vehicleUnit}`;
  }

  return technician.name;
}

function formatFleetVehicleLabel(technician: FleetTechnicianView) {
  return [technician.vehicleUnit, technician.vehicleLabel].filter(Boolean).join(" ") || "Service unit";
}

function getFleetPromiseConfidenceSummary(input: {
  routeMetrics: FleetRouteMetrics | null;
  technician: FleetTechnicianView;
}) {
  const { routeMetrics, technician } = input;
  const trafficDelayMinutes = routeMetrics?.available ? routeMetrics.trafficDelayMinutes : 0;

  if (
    technician.status === "delayed" ||
    technician.routeHealth === "issue" ||
    technician.routeStops.some((stop) => stop.isLate) ||
    trafficDelayMinutes >= 15
  ) {
    return {
      confidencePercent: 32,
      copy:
        technician.routeIssueCount > 0
          ? `${technician.routeIssueCount} route issue${technician.routeIssueCount === 1 ? "" : "s"} are already working against the current promise.`
          : "Traffic and route posture are no longer supporting the current promise cleanly.",
      recommendedAction: "set_promise" as const,
      tone: "danger" as const,
      value: "Weak"
    };
  }

  if (
    technician.routeHealth === "watch" ||
    Boolean(technician.activeAvailabilityTitle) ||
    trafficDelayMinutes >= 8
  ) {
    return {
      confidencePercent: 58,
      copy: routeMetrics?.available
        ? `${formatFleetMinutes(routeMetrics.travelMinutes)} of route time remains, so this lane should be watched before more work is committed.`
        : "Promise timing is still believable, but the lane is close enough to drift that it should be watched.",
      recommendedAction: "set_promise" as const,
      tone: "warning" as const,
      value: "Watch"
    };
  }

  if (!technician.nextStop && technician.status === "idle") {
    return {
      confidencePercent: 94,
      copy: "This lane is open enough to take same-day work without dragging a current promise behind it.",
      recommendedAction: null,
      tone: "success" as const,
      value: "Open"
    };
  }

  return {
    confidencePercent: 84,
    copy: routeMetrics?.available
      ? `${formatFleetMinutes(routeMetrics.travelMinutes)} of route time remains and no major drift signal is active.`
      : "Route timing is holding and no active drift signal is pulling this lane off promise.",
    recommendedAction: null,
    tone: "success" as const,
    value: "Steady"
  };
}

function getFleetLaneContinuity(input: {
  liveDevice: FleetLiveDevice | null;
  routeMetrics: FleetRouteMetrics | null;
  technician: FleetTechnicianView;
}) {
  const { liveDevice, routeMetrics, technician } = input;
  const promiseConfidence = getFleetPromiseConfidenceSummary({
    routeMetrics,
    technician
  });
  const routeConfidence = deriveRouteConfidenceSnapshot({
    hasLiveGps: Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null),
    hasPartsConfidence: technician.routeIssueCount === 0,
    hasServiceSitePlaybook: technician.routeStops.some((stop) => stop.hasServiceSitePlaybook),
    hasTechnicianReadiness: technician.status !== "offline" && !technician.activeAvailabilityTitle,
    laneSlackMinutes:
      technician.jobsRemaining === 0
        ? 120
        : technician.routeHealth === "healthy"
          ? 60
          : technician.routeHealth === "watch"
            ? 30
            : 10,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    routeIssueCount: technician.routeIssueCount
  });

  return {
    promiseConfidence,
    routeConfidence
  };
}

function getFleetUnitReadinessSignal(input: {
  hasLiveGps: boolean;
  technician: FleetTechnicianView;
}): FleetCrewReadinessPacket["signals"][number] {
  const { hasLiveGps, technician } = input;
  const unitLabel = formatFleetVehicleLabel(technician);

  if (technician.status === "offline") {
    return {
      detail: technician.activeAvailabilityTitle
        ? `${unitLabel} is blocked by ${technician.activeAvailabilityTitle.toLowerCase()}.`
        : `${unitLabel} is not currently ready to carry live work.`,
      label: "Unit readiness",
      tone: "danger",
      value: "Off road"
    };
  }

  if (technician.activeAvailabilityTitle) {
    return {
      detail: `${unitLabel} is tied up by ${technician.activeAvailabilityTitle.toLowerCase()}.`,
      label: "Unit readiness",
      tone: "warning",
      value: "Recover"
    };
  }

  if (!hasLiveGps) {
    return {
      detail: `${unitLabel} is missing enough live GPS confidence to trust the lane cleanly.`,
      label: "Unit readiness",
      tone: "warning",
      value: "Check GPS"
    };
  }

  return {
    detail: `${unitLabel} is available with live telemetry and no active readiness hold.`,
    label: "Unit readiness",
    tone: "success",
    value: "Ready"
  };
}

function formatFleetIssueSummary(technician: FleetTechnicianView) {
  if (!technician.routeIssueCount) {
    return technician.routeHealthLabel;
  }

  return `${technician.routeIssueCount} issue${technician.routeIssueCount === 1 ? "" : "s"}`;
}

function formatFleetUnitLabel(technician: FleetTechnicianView) {
  return technician.vehicleUnit ?? technician.vehicleLabel ?? "";
}

function getFleetAttentionHeadline({
  lateWorkCount,
  noGpsCount,
  routeIssueCount,
  waitingCount
}: {
  lateWorkCount: number;
  noGpsCount: number;
  routeIssueCount: number;
  waitingCount: number;
}) {
  if (lateWorkCount > 0) {
    return `${lateWorkCount} late stop${lateWorkCount === 1 ? "" : "s"} need intervention`;
  }

  if (routeIssueCount > 0) {
    return `${routeIssueCount} route${routeIssueCount === 1 ? "" : "s"} drifting off plan`;
  }

  if (noGpsCount > 0) {
    return `${noGpsCount} unit${noGpsCount === 1 ? "" : "s"} missing live GPS`;
  }

  if (waitingCount > 0) {
    return `${waitingCount} waiting visit${waitingCount === 1 ? "" : "s"} can be inserted`;
  }

  return "Board steady";
}

function getFleetAttentionPriority(technician: FleetTechnicianView, hasLiveDevice: boolean, waitingCount: number) {
  return getFieldLaneAttentionPriority(technician, hasLiveDevice, waitingCount);
}

function getFleetInsertionCapacityScore(
  technician: FleetTechnicianView,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  return getFieldLaneCapacityScore(technician, hasLiveDevice, waitingCount);
}

function getFleetInsertionCapacitySummary(technician: FleetTechnicianView) {
  return getFieldLaneCapacitySummary(technician);
}

function getFleetDriftSummary(technician: FleetTechnicianView, hasLiveDevice: boolean) {
  return getFieldLaneDriftSummary(technician, hasLiveDevice);
}

function formatFleetRosterHeadline(technician: FleetTechnicianView) {
  if (technician.status === "offline") {
    return "Offline and needs review";
  }

  if (technician.routeHealth === "issue") {
    return "Route needs attention";
  }

  if (technician.routeHealth === "watch") {
    return "Watch route timing";
  }

  if (technician.nextStop) {
    return technician.nextStop.title;
  }

  return "Open capacity";
}

function formatFleetRosterSupport(technician: FleetTechnicianView) {
  if (technician.nextStop) {
    return `${technician.nextStop.customerName} · ${technician.nextStop.windowLabel ?? "Time not set"}`;
  }

  return technician.currentLocationLabel;
}

function getFleetRosterPriorityLabel(
  technician: FleetTechnicianView,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  return getFieldLanePriorityLabel(technician, hasLiveDevice, waitingCount);
}

function getFleetRosterPriorityCopy(
  technician: FleetTechnicianView,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  return getFieldLanePriorityCopy(technician, hasLiveDevice, waitingCount);
}

function getFleetInspectorAction(
  technician: FleetTechnicianView,
  hasLiveDevice: boolean,
  waitingCount: number
) {
  return getFieldLaneInspectorAction(technician, hasLiveDevice, waitingCount);
}

function getSelectedStop(
  technician: FleetTechnicianView | null,
  queueJobs: FleetStopView[],
  selectedStopId: string | null
) {
  if (!selectedStopId) {
    return technician?.nextStop ?? technician?.currentStop ?? technician?.routeStops[0] ?? queueJobs[0] ?? null;
  }

  return (
    technician?.routeStops.find((stop) => stop.id === selectedStopId) ??
    queueJobs.find((stop) => stop.id === selectedStopId) ??
    technician?.nextStop ??
    technician?.currentStop ??
    technician?.routeStops[0] ??
    queueJobs[0] ??
    null
  );
}

function FleetStatusPill({ status }: { status: FleetTechnicianView["status"] }) {
  return (
    <span className={cx("fleet-status-pill", `fleet-status-pill--${status}`)}>
      <span className="fleet-status-pill__dot" />
      {getFleetOperationalStatusLabel(status)}
    </span>
  );
}

function FleetSignal({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="fleet-signal">
      <span className="fleet-signal__label">{label}</span>
      <strong className="fleet-signal__value">{value}</strong>
    </div>
  );
}

function FleetRosterItem({
  isSelected,
  liveDevice,
  onSelect,
  priorityRank,
  waitingCount,
  technician
}: {
  isSelected: boolean;
  liveDevice: FleetLiveDevice | null;
  onSelect: () => void;
  priorityRank: number;
  waitingCount: number;
  technician: FleetTechnicianView;
}) {
  const liveGpsAvailable = Boolean(
    liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null
  );
  const rosterAlert = (() => {
    if (technician.status === "offline") {
      return { label: "Offline", tone: "danger" as const };
    }

    if (technician.status === "delayed" || technician.routeHealth === "issue") {
      return { label: "Route risk", tone: "danger" as const };
    }

    if (!liveGpsAvailable) {
      return { label: "No GPS", tone: "warning" as const };
    }

    if ((technician.jobsRemaining === 0 || technician.status === "idle") && waitingCount > 0) {
      return { label: "Ready now", tone: "brand" as const };
    }

    if (technician.routeHealth === "watch") {
      return { label: "Watch timing", tone: "warning" as const };
    }

    return { label: "On track", tone: "neutral" as const };
  })();
  const priorityLabel = getFleetRosterPriorityLabel(technician, liveGpsAvailable, waitingCount);
  const priorityCopy = getFleetRosterPriorityCopy(technician, liveGpsAvailable, waitingCount);

  return (
    <button
      className={cx("fleet-roster-item", isSelected && "fleet-roster-item--selected")}
      onClick={onSelect}
      type="button"
    >
      <div className="fleet-roster-item__priority-row">
        <span className="fleet-roster-item__priority-rank">#{priorityRank}</span>
        <span className="fleet-roster-item__priority-label">{priorityLabel}</span>
      </div>

      <div className="fleet-roster-item__topline">
        <div className="fleet-roster-item__identity">
          <span className="fleet-roster-item__avatar">{technician.initials}</span>
          <div>
            <p className="fleet-roster-item__name">{technician.name}</p>
            {formatFleetUnitLabel(technician) ? (
              <p className="fleet-roster-item__vehicle">{formatFleetUnitLabel(technician)}</p>
            ) : null}
          </div>
        </div>
        <span className={cx("fleet-roster-item__alert", `fleet-roster-item__alert--${rosterAlert.tone}`)}>
          {rosterAlert.label}
        </span>
      </div>

      <div className="fleet-roster-item__route fleet-roster-item__route--summary">
        <p className="fleet-roster-item__value">{formatFleetRosterHeadline(technician)}</p>
        <p className="fleet-roster-item__subvalue">{formatFleetRosterSupport(technician)}</p>
      </div>

      <p className="fleet-roster-item__action-copy">{priorityCopy}</p>

      <div className="fleet-roster-item__facts">
        <div className="fleet-roster-item__fact">
          <span className="fleet-roster-item__fact-label">Status</span>
          <strong className="fleet-roster-item__fact-value">{getFleetOperationalStatusLabel(technician.status)}</strong>
        </div>
        <div className="fleet-roster-item__fact">
          <span className="fleet-roster-item__fact-label">GPS</span>
          <strong className="fleet-roster-item__fact-value">
            {liveDevice ? getTrackingStatusLabel(liveDevice.trackingState) : "Waiting"}
          </strong>
        </div>
        <div className="fleet-roster-item__fact">
          <span className="fleet-roster-item__fact-label">Board</span>
          <strong className="fleet-roster-item__fact-value">
            {technician.jobsRemaining} stop{technician.jobsRemaining === 1 ? "" : "s"} left
          </strong>
        </div>
      </div>

      <div className="fleet-roster-item__meta">
        <span>{formatFleetIssueSummary(technician)}</span>
        {technician.activeAvailabilityTitle ? <span>{technician.activeAvailabilityTitle}</span> : null}
      </div>
    </button>
  );
}

function FleetRouteStopRow({
  isSelected,
  onSelect,
  stop
}: {
  isSelected: boolean;
  onSelect: () => void;
  stop: FleetStopView;
}) {
  return (
    <button
      className={cx("fleet-route-stop", isSelected && "fleet-route-stop--selected")}
      onClick={onSelect}
      type="button"
    >
      <div className="fleet-route-stop__topline">
        <div>
          <p className="fleet-route-stop__eyebrow">
            {stop.jobId.slice(0, 6).toUpperCase()} · {getFleetPriorityLabel(stop.priority)}
          </p>
          <h3 className="fleet-route-stop__title">{stop.title}</h3>
        </div>
        <div className="fleet-route-stop__badges">
          {stop.isCurrent ? <Badge tone="success">On site</Badge> : null}
          {stop.isNext ? <Badge tone="brand">Next</Badge> : null}
          {stop.isLate ? <Badge tone="warning">Late</Badge> : null}
        </div>
      </div>

      <p className="fleet-route-stop__copy">
        {stop.customerName}, {stop.addressLabel}
      </p>
      <p className="fleet-route-stop__meta">
        {stop.windowLabel ?? "Time not set"} · {stop.cityStateLabel}
      </p>
    </button>
  );
}

function FleetQueueJobRow({
  disabled,
  isPending,
  onAssign,
  stop
}: {
  disabled: boolean;
  isPending: boolean;
  onAssign: () => void;
  stop: FleetStopView;
}) {
  return (
    <div className="fleet-queue-job">
      <div>
        <p className="fleet-route-stop__eyebrow">
          {stop.jobId.slice(0, 6).toUpperCase()} · {getFleetPriorityLabel(stop.priority)}
        </p>
        <h3 className="fleet-route-stop__title">{stop.title}</h3>
        <p className="fleet-route-stop__copy">
          {stop.customerName}, {stop.cityStateLabel}
        </p>
      </div>
      <Button disabled={disabled} loading={isPending} onClick={onAssign} size="sm" tone="secondary">
        Assign here
      </Button>
    </div>
  );
}

function getFleetServiceUnitStatus(
  technician: FleetTechnicianView,
  liveGpsAvailable: boolean,
  waitingCount: number
) {
  if (technician.activeAvailabilityTitle) {
    return {
      copy: `${technician.activeAvailabilityTitle} is blocking this service unit right now.`,
      label: "Unavailable",
      tone: "warning" as const
    };
  }

  if (technician.status === "offline") {
    return {
      copy: "Technician or unit is offline and needs contact before Dispatch should trust this lane.",
      label: "Needs contact",
      tone: "danger" as const
    };
  }

  if (!liveGpsAvailable) {
    return {
      copy: "Live location is missing, so this service unit cannot be treated as a clean insertion target.",
      label: "Restore GPS",
      tone: "warning" as const
    };
  }

  if (technician.status === "delayed" || technician.routeHealth === "issue") {
    return {
      copy: "Current route recovery should happen before this service unit takes more work.",
      label: "Route risk",
      tone: "danger" as const
    };
  }

  if ((technician.jobsRemaining === 0 || technician.status === "idle" || !technician.nextStop) && waitingCount > 0) {
    return {
      copy: "This is the cleanest visible service unit for same-day insertion right now.",
      label: "Best insert",
      tone: "brand" as const
    };
  }

  return {
    copy: "This service unit is visible, connected, and operationally steady.",
    label: "Ready",
    tone: "success" as const
  };
}

function FleetTeamDeskCard({
  dispatchHref,
  isSelected,
  liveDevice,
  onInspect,
  technician,
  waitingCount
}: {
  dispatchHref: string;
  isSelected: boolean;
  liveDevice: FleetLiveDevice | null;
  onInspect: () => void;
  technician: FleetTechnicianView;
  waitingCount: number;
}) {
  const liveGpsAvailable = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);
  const priorityCopy = getFleetRosterPriorityCopy(technician, liveGpsAvailable, waitingCount);
  const laneContinuity = getFleetLaneContinuity({
    liveDevice,
    routeMetrics: null,
    technician
  });

  return (
    <Card padding="compact" tone={isSelected ? "raised" : "subtle"}>
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Crew lane</CardEyebrow>
          <CardTitle>{technician.name}</CardTitle>
          <CardDescription>
            {formatFleetUnitLabel(technician) || "Internal unit not assigned"} · {priorityCopy}
          </CardDescription>
        </CardHeaderContent>
        <div className="ui-inline-meta">
          <Badge tone={laneContinuity.routeConfidence.tone}>
            {laneContinuity.routeConfidence.confidencePercent}% route
          </Badge>
          <Badge tone={laneContinuity.promiseConfidence.tone}>
            {laneContinuity.promiseConfidence.confidencePercent}% promise
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="ui-action-grid">
        <div className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Now</p>
            <p className="ui-detail-value">
              {technician.currentStop?.title ?? getFleetOperationalStatusLabel(technician.status)}
            </p>
            <p className="ui-card__description">
              {technician.currentStop
                ? `${technician.currentStop.customerName} · ${technician.currentLocationLabel}`
                : technician.currentLocationLabel}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Next</p>
            <p className="ui-detail-value">{technician.nextStop?.title ?? "Open for same-day work"}</p>
            <p className="ui-card__description">
              {technician.nextStop
                ? `${technician.nextStop.customerName} · ${technician.nextStop.windowLabel ?? "Time not set"}`
                : "No next stop scheduled"}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Lane facts</p>
            <p className="ui-detail-value">{laneContinuity.routeConfidence.label}</p>
            <p className="ui-card__description">
              GPS {liveDevice ? getTrackingStatusLabel(liveDevice.trackingState) : "Waiting"} ·{" "}
              {formatFleetIssueSummary(technician)}
            </p>
          </div>
        </div>
        <div className="ui-table-actions">
          <Button onClick={onInspect} size="sm" tone={isSelected ? "secondary" : "primary"} type="button">
            Open lane
          </Button>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={dispatchHref}>
            Open in dispatch
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function FleetServiceUnitCard({
  dispatchHref,
  isSelected,
  liveDevice,
  onInspect,
  technician,
  waitingCount
}: {
  dispatchHref: string;
  isSelected: boolean;
  liveDevice: FleetLiveDevice | null;
  onInspect: () => void;
  technician: FleetTechnicianView;
  waitingCount: number;
}) {
  const liveGpsAvailable = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);
  const serviceUnitStatus = getFleetServiceUnitStatus(technician, liveGpsAvailable, waitingCount);
  const unitLabel = formatFleetUnitLabel(technician) || "Service unit not assigned";
  const laneContinuity = getFleetLaneContinuity({
    liveDevice,
    routeMetrics: null,
    technician
  });

  return (
    <Card padding="compact" tone={isSelected ? "raised" : "subtle"}>
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Internal unit</CardEyebrow>
          <CardTitle>{unitLabel}</CardTitle>
          <CardDescription>
            Assigned lane: {technician.name}. Keep internal-unit readiness tied to live field capacity.
          </CardDescription>
        </CardHeaderContent>
        <div className="ui-inline-meta">
          <Badge tone={serviceUnitStatus.tone}>{serviceUnitStatus.label}</Badge>
          <Badge tone={laneContinuity.routeConfidence.tone}>
            {laneContinuity.routeConfidence.confidencePercent}% route
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="ui-action-grid">
        <div className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Readiness</p>
            <p className="ui-detail-value">{serviceUnitStatus.label}</p>
            <p className="ui-card__description">{serviceUnitStatus.copy}</p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Current field state</p>
            <p className="ui-detail-value">{laneContinuity.promiseConfidence.value}</p>
            <p className="ui-card__description">
              GPS {liveDevice ? getTrackingStatusLabel(liveDevice.trackingState) : "Waiting"} ·{" "}
              {technician.currentLocationLabel}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Workload</p>
            <p className="ui-detail-value">
              {technician.jobsRemaining} stop{technician.jobsRemaining === 1 ? "" : "s"} left
            </p>
            <p className="ui-card__description">
              {technician.nextStop ? `Next stop: ${technician.nextStop.title}` : "No next stop scheduled"}
            </p>
          </div>
        </div>
        <div className="ui-table-actions">
          <Button onClick={onInspect} size="sm" tone={isSelected ? "secondary" : "primary"} type="button">
            Open readiness
          </Button>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={dispatchHref}>
            Open in dispatch
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function FleetWorkspace({ initialBlockers, initialData }: FleetWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTechnicianId = searchParams.get("technicianId");
  const requestedPanel = searchParams.get("panel");
  const panel = requestedPanel === "team" || requestedPanel === "units" ? requestedPanel : "map";
  const [workspace, setWorkspace] = useState(initialData);
  const [liveDevices, setLiveDevices] = useState(initialData.liveDevices);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(
    initialData.technicians[0]?.id ?? null
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [trafficEnabled, setTrafficEnabled] = useState(initialData.tomTomConfigured);
  const [focusNonce, setFocusNonce] = useState(0);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorView, setInspectorView] = useState<"route" | "queue">("route");
  const [selectedRouteMetrics, setSelectedRouteMetrics] = useState<FleetRouteMetrics | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [liveFeedError, setLiveFeedError] = useState<string | null>(null);
  const [lastLiveRefreshAt, setLastLiveRefreshAt] = useState(initialData.generatedAt);
  const [mutationPending, setMutationPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mapPanelActive = panel === "map";
  const shouldOpenMapControls = false;

  useEffect(() => {
    setWorkspace(initialData);
    setLiveDevices(initialData.liveDevices);
    setLastLiveRefreshAt(initialData.generatedAt);
  }, [initialData]);

  useEffect(() => {
    const nextTechnicianId =
      requestedTechnicianId &&
      workspace.technicians.some((technician) => technician.id === requestedTechnicianId)
        ? requestedTechnicianId
        : null;

    setTechnicianFilter(nextTechnicianId ?? "all");

    if (nextTechnicianId) {
      setSelectedTechnicianId(nextTechnicianId);
    }
  }, [requestedTechnicianId, workspace.technicians]);

  const filteredTechnicians =
    technicianFilter === "all"
      ? workspace.technicians
      : workspace.technicians.filter((technician) => technician.id === technicianFilter);
  const visibleTechnicians = filteredTechnicians.length ? filteredTechnicians : workspace.technicians;
  const prioritizedTechnicians = [...visibleTechnicians].sort((left, right) => {
    const leftLiveDevice = findLiveDeviceForTechnicianId(left.id, liveDevices);
    const rightLiveDevice = findLiveDeviceForTechnicianId(right.id, liveDevices);
    const priorityDelta =
      getFleetAttentionPriority(right, Boolean(rightLiveDevice), workspace.queueJobs.length) -
      getFleetAttentionPriority(left, Boolean(leftLiveDevice), workspace.queueJobs.length);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.name.localeCompare(right.name);
  });
  const selectedTechnician =
    visibleTechnicians.find((technician) => technician.id === selectedTechnicianId) ??
    visibleTechnicians[0] ??
    null;
  const selectedLiveDevice = selectedTechnician
    ? findLiveDeviceForTechnicianId(selectedTechnician.id, liveDevices)
    : null;
  const selectedStop = getSelectedStop(selectedTechnician, workspace.queueJobs, selectedStopId);
  const visibleTechnicianLiveStates = visibleTechnicians.map((technician) => ({
    liveDevice: findLiveDeviceForTechnicianId(technician.id, liveDevices),
    technician
  }));
  const routeIssueCount = visibleTechnicians.filter(
    (technician) => technician.routeHealth === "issue" || technician.routeIssueCount > 0
  ).length;
  const lateWorkCount = visibleTechnicians.filter(
    (technician) =>
      technician.status === "delayed" ||
      Boolean(technician.nextStop?.isLate) ||
      technician.routeStops.some((stop) => stop.isLate)
  ).length;
  const routeDriftCount = visibleTechnicians.filter(
    (technician) =>
      technician.status === "offline" ||
      technician.status === "delayed" ||
      technician.routeHealth !== "healthy" ||
      technician.routeStops.some((stop) => stop.isLate)
  ).length;
  const noGpsCount = visibleTechnicianLiveStates.filter(({ liveDevice }) => {
    if (!liveDevice) {
      return true;
    }

    return liveDevice.latitude === null || liveDevice.longitude === null;
  }).length;
  const underpreparedUnitCount = visibleTechnicianLiveStates.filter(({ liveDevice, technician }) => {
    const liveGpsReady = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);
    return technician.status === "offline" || Boolean(technician.activeAvailabilityTitle) || !liveGpsReady;
  }).length;
  const idleOpportunityCount = visibleTechnicians.filter(
    (technician) =>
      technician.status === "idle" ||
      (!technician.nextStop && technician.status !== "offline") ||
      (technician.jobsRemaining === 0 && !technician.activeAvailabilityTitle)
  ).length;
  const attentionCount = workspace.technicians.filter(
    (technician) => technician.routeHealth !== "healthy" || technician.status === "offline"
  ).length;
  const waitingCount = workspace.queueJobs.length;
  const showMapRoster =
    !mapPanelActive &&
    (!isInspectorOpen &&
      prioritizedTechnicians.length > 2 &&
      (attentionCount > 0 || waitingCount > 0 || technicianFilter !== "all"));
  const insertionCandidates: FleetCapacityCandidate[] = visibleTechnicianLiveStates
    .map(({ liveDevice, technician }) => ({
      score: getFleetInsertionCapacityScore(
        technician,
        Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null),
        waitingCount
      ),
      summary: getFleetInsertionCapacitySummary(technician),
      technician
    }))
    .filter((candidate) => candidate.score > -40)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const driftWatch: FleetDriftCandidate[] = visibleTechnicianLiveStates
    .filter(({ liveDevice, technician }) => {
      const liveGpsReady = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);
      return (
        technician.status === "offline" ||
        technician.status === "delayed" ||
        technician.routeHealth !== "healthy" ||
        technician.routeStops.some((stop) => stop.isLate) ||
        !liveGpsReady
      );
    })
    .map(({ liveDevice, technician }) => {
      const liveGpsReady = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);
      const drift = getFleetDriftSummary(technician, liveGpsReady);

      return {
        summary: drift.summary,
        technician,
        tone: drift.tone
      };
    })
    .slice(0, 3);
  const bestInsertionCandidate = insertionCandidates[0] ?? null;
  const lastLiveRefreshLabel = formatFleetClock(lastLiveRefreshAt, workspace.companyTimeZone);
  const blockerItemsByJobId = new Map(initialBlockers.items.map((item) => [item.jobId, item]));
  const selectedWorkflowJobId = selectedStop?.jobId ?? selectedTechnician?.nextStop?.jobId ?? selectedTechnician?.currentStop?.jobId ?? null;
  const selectedWorkflowBlocker = selectedWorkflowJobId ? blockerItemsByJobId.get(selectedWorkflowJobId) ?? null : null;
  const leadFinanceBlocker = initialBlockers.financeBlockedItems[0] ?? null;
  const fleetWorkflowPressureTone = initialBlockers.supplyBlockedCount
    ? "warning"
    : initialBlockers.financeBlockedCount
      ? "brand"
      : initialBlockers.approvedReleaseCount
        ? "brand"
        : "success";
  const fleetWorkflowPressureTitle = initialBlockers.supplyBlockedCount
    ? "Supply is constraining visible routes"
    : initialBlockers.financeBlockedCount
      ? leadFinanceBlocker?.openPaymentHandoffCount
        ? "Field billing handoffs are still hanging on visible work"
        : "Closeout is still hanging on visible field work"
      : initialBlockers.approvedReleaseCount
        ? "Approved work is ready for dispatch handoff"
        : "No cross-desk blocker is dominating fleet right now";
  const fleetWorkflowPressureCopy = initialBlockers.supplyBlockedCount
    ? `${initialBlockers.supplyBlockedCount} visible visit${initialBlockers.supplyBlockedCount === 1 ? " is" : "s are"} waiting on parts or inventory recovery, so route decisions should avoid assuming those lanes are actually clear.`
    : initialBlockers.financeBlockedCount
      ? leadFinanceBlocker?.financeHandoffSummary?.copy ??
        `${initialBlockers.financeBlockedCount} visible visit${initialBlockers.financeBlockedCount === 1 ? " still needs" : "s still need"} finance follow-through, so field completion is not yet the same thing as operational closeout.`
      : initialBlockers.approvedReleaseCount
        ? `${initialBlockers.approvedReleaseCount} visible visit${initialBlockers.approvedReleaseCount === 1 ? " is" : "s are"} commercially ready and can move into dispatch without more estimate review.`
        : "Visible fleet lanes are primarily a routing and capacity problem right now, not a cross-desk blocker problem.";
  const topDriftCandidate = driftWatch[0] ?? null;
  const recommendedDispatchTarget =
    bestInsertionCandidate?.technician ??
    topDriftCandidate?.technician ??
    selectedTechnician ??
    null;
  const selectedDispatchHref = buildDispatchHref(workspace.date, selectedTechnician?.id);
  const recommendedDispatchHref = buildDispatchHref(
    workspace.date,
    recommendedDispatchTarget?.id ?? selectedTechnician?.id ?? null
  );
  const mapControlsSummary = `${workspace.dateLabel} · ${
    technicianFilter === "all"
      ? `${visibleTechnicians.length} visible lane${visibleTechnicians.length === 1 ? "" : "s"}`
      : "Filtered lane view"
  } · ${trafficEnabled ? "Traffic on" : "Traffic off"}`;
  const recommendedDispatchLabel = bestInsertionCandidate
    ? `Route with ${bestInsertionCandidate.technician.name}`
    : topDriftCandidate
      ? `Recover ${topDriftCandidate.technician.name}`
      : "Open dispatch";
  const attentionHeadline = getFleetAttentionHeadline({
    lateWorkCount,
    noGpsCount,
    routeIssueCount,
    waitingCount
  });
  const selectedInspectorAction = selectedTechnician
    ? getFleetInspectorAction(selectedTechnician, Boolean(selectedLiveDevice), waitingCount)
    : null;
  const fleetToolbarContent = (
    <div className="fleet-stage__toolbar-row">
      <div className="fleet-stage__command-core">
        {!mapPanelActive ? (
          <div className="fleet-stage__context-block">
            <div className="fleet-stage__context">
              <strong className="fleet-stage__title">{workspace.dateLabel}</strong>
              <p className="fleet-stage__context-copy">{attentionHeadline}</p>
            </div>
          </div>
        ) : null}

        <div className="fleet-stage__toolbar-main">
          <div className="fleet-stage__filters">
            <label className="fleet-toolbar__field">
              <span>Date</span>
              <Input onChange={handleDateChange} type="date" value={workspace.date} />
            </label>

            <label className="fleet-toolbar__field">
              <span>Technician</span>
              <Select onChange={(event) => setTechnicianFilter(event.currentTarget.value)} value={technicianFilter}>
                <option value="all">All techs</option>
                {workspace.technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {formatTechnicianFilterLabel(technician)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </div>

      <div className="fleet-stage__actions">
        <Button
          disabled={!workspace.tomTomConfigured}
          onClick={() => setTrafficEnabled((current) => !current)}
          size="sm"
          tone={trafficEnabled ? "secondary" : "ghost"}
        >
          {trafficEnabled ? "Traffic on" : "Traffic off"}
        </Button>
        <Button onClick={() => setFocusNonce((current) => current + 1)} size="sm" tone="ghost">
          Recenter map
        </Button>
      </div>
    </div>
  );
  const selectedRouteBlockerItems = selectedTechnician
    ? selectedTechnician.routeStops
        .map((stop) => blockerItemsByJobId.get(stop.jobId) ?? null)
        .filter((item): item is NonNullable<typeof selectedWorkflowBlocker> => Boolean(item))
    : [];
  const selectedRouteBlockedStopCount = selectedRouteBlockerItems.filter(
    (item) =>
      item.supplyBlockerCount > 0 ||
      item.openPaymentHandoffCount > 0 ||
      item.financeOwnership?.owner === "Finance" ||
      item.hasApprovedRelease
  ).length;
  const selectedRouteSupplyRiskCount = selectedRouteBlockerItems.reduce(
    (total, item) => total + item.supplyBlockerCount,
    0
  );
  const selectedReadyDispatchCount = selectedRouteBlockerItems.filter((item) => item.hasApprovedRelease).length;
  const selectedHasLiveGps = Boolean(
    selectedLiveDevice && selectedLiveDevice.latitude !== null && selectedLiveDevice.longitude !== null
  );
  const selectedHasServiceSitePlaybook = selectedTechnician
    ? selectedTechnician.routeStops.every((stop) => Boolean(stop.addressLabel))
    : false;
  const selectedTechnicianReady = selectedTechnician
    ? selectedTechnician.status !== "offline" && !selectedTechnician.activeAvailabilityTitle
    : false;
  const selectedPromiseSummary = selectedTechnician
    ? getFleetPromiseConfidenceSummary({
        routeMetrics: selectedRouteMetrics,
        technician: selectedTechnician
      })
    : null;
  const selectedPromiseConfidence =
    selectedPromiseSummary && selectedTechnician
      ? derivePromiseConfidenceSnapshot({
          hasServiceSitePlaybook: selectedHasServiceSitePlaybook,
          hasSupplyRisk: selectedRouteSupplyRiskCount > 0,
          promiseSummary: {
            confidencePercent: selectedPromiseSummary.confidencePercent,
            copy: selectedPromiseSummary.copy,
            recommendedAction: selectedPromiseSummary.recommendedAction
          },
          readinessSummary: {
            readyCount:
              Number(selectedHasLiveGps) +
              Number(selectedHasServiceSitePlaybook) +
              Number(selectedTechnicianReady) +
              Number(selectedRouteBlockedStopCount === 0),
            score: Math.round(
              ((Number(selectedHasLiveGps) +
                Number(selectedHasServiceSitePlaybook) +
                Number(selectedTechnicianReady) +
                Number(selectedRouteBlockedStopCount === 0)) /
                4) *
                100
            ),
            totalCount: 4
          },
          releaseRunwayState: null,
          trustSummary: {
            risk:
              selectedTechnician.status === "delayed" || selectedTechnician.routeHealth === "issue"
                ? "high"
                : selectedTechnician.routeHealth === "watch"
                  ? "watch"
                  : "none"
          }
        })
      : null;
  const selectedRouteConfidence = selectedTechnician
    ? deriveRouteConfidenceSnapshot({
        hasLiveGps: selectedHasLiveGps,
        hasPartsConfidence: selectedRouteSupplyRiskCount === 0,
        hasServiceSitePlaybook: selectedHasServiceSitePlaybook,
        hasTechnicianReadiness: selectedTechnicianReady,
        laneSlackMinutes:
          selectedTechnician.jobsRemaining === 0
            ? 120
            : selectedTechnician.routeHealth === "healthy"
              ? 60
              : 20,
        promiseConfidencePercent: selectedPromiseConfidence?.confidencePercent ?? 72,
        routeIssueCount: selectedTechnician.routeIssueCount
      })
    : null;
  const selectedStopThreadHref = selectedStop ? buildVisitThreadHref(selectedStop.jobId) : null;
  const selectedCustomerThreadHref = selectedStop
    ? buildCustomerWorkspaceHref(selectedStop.customerId)
    : null;
  const selectedSiteThreadHref = selectedStop
    ? buildCustomerWorkspaceHref(
        selectedStop.customerId,
        selectedStop.serviceSiteId
          ? { editAddressId: selectedStop.serviceSiteId, tab: "addresses" }
          : { tab: "addresses" }
      )
    : selectedCustomerThreadHref;
  const fleetReadinessPacket: FleetCrewReadinessPacket | null = selectedTechnician
    ? {
        currentLabel:
          selectedTechnician.currentStop?.title ?? getFleetOperationalStatusLabel(selectedTechnician.status),
        headline:
          selectedInspectorAction?.copy ??
          "Recovery beats utilization whenever this lane starts to drift.",
        nextAction: selectedInspectorAction?.title ?? "Hold lane",
        nextLabel: selectedTechnician.nextStop?.title ?? "Open for same-day work",
        promiseConfidence: selectedPromiseConfidence,
        routeConfidence: selectedRouteConfidence,
        signals: [
          {
            detail: selectedLiveDevice
              ? selectedLiveDevice.trackingSummary
              : "No active live device is feeding location confidence for this lane yet.",
            label: "GPS state",
            tone: selectedLiveDevice
              ? getFleetSignalToneFromTracking(getTrackingTone(selectedLiveDevice.trackingState))
              : "warning",
            value: selectedLiveDevice
              ? getTrackingStatusLabel(selectedLiveDevice.trackingState)
              : "Waiting"
          },
          getFleetUnitReadinessSignal({
            hasLiveGps: selectedHasLiveGps,
            technician: selectedTechnician
          }),
          {
            detail: selectedRouteBlockedStopCount
              ? `${selectedRouteBlockedStopCount} stop${selectedRouteBlockedStopCount === 1 ? "" : "s"} on this lane still carry supply, finance, or release friction.${selectedRouteSupplyRiskCount ? ` ${selectedRouteSupplyRiskCount} point to parts or inventory pressure.` : ""}${selectedReadyDispatchCount ? ` ${selectedReadyDispatchCount} are commercially ready for dispatch.` : ""}`
              : "No open cross-desk blockers are attached to the currently selected lane.",
            label: "Open blockers",
            tone: selectedRouteBlockedStopCount
              ? selectedReadyDispatchCount && !selectedRouteSupplyRiskCount
                ? "brand"
                : "warning"
              : "success",
            value: selectedRouteBlockedStopCount ? `${selectedRouteBlockedStopCount}` : "0"
          }
        ],
        technicianName: selectedTechnician.name,
        unitLabel: formatFleetVehicleLabel(selectedTechnician)
      }
    : null;
  const topAttentionTechnicians = prioritizedTechnicians.slice(0, 3);
  const fleetLensCards = prioritizedTechnicians.slice(0, panel === "map" ? 0 : 6);
  const unitReadyNowCount = visibleTechnicianLiveStates.filter(({ liveDevice, technician }) => {
    const liveGpsAvailable = Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null);

    return (
      !technician.activeAvailabilityTitle &&
      technician.status !== "offline" &&
      technician.routeHealth === "healthy" &&
      liveGpsAvailable
    );
  }).length;
  const mapCommandSummary: {
    copy: string;
    eyebrow: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
    title: string;
    tone: BadgeTone;
  } = attentionCount
    ? {
        copy: topDriftCandidate
          ? `${topDriftCandidate.technician.name} should get the next lane review now.`
          : "Route recovery should lead the next dispatch move.",
        eyebrow: "Route recovery",
        primaryHref: recommendedDispatchHref,
        primaryLabel: recommendedDispatchLabel,
        secondaryHref: "/dashboard/dispatch?surface=recovery",
        secondaryLabel: "Open recovery",
        title: `${attentionCount} flagged lane${attentionCount === 1 ? "" : "s"} need route attention`,
        tone: "warning"
      }
    : waitingCount
      ? {
        copy: bestInsertionCandidate
          ? `${bestInsertionCandidate.technician.name} is the cleanest current same-day fit.`
          : "Waiting work is live, but recovery should lead before another stop is placed.",
        eyebrow: "Same-day fit",
        primaryHref: recommendedDispatchHref,
        primaryLabel: recommendedDispatchLabel,
          secondaryHref: "/dashboard/dispatch?includeUnassigned=1",
          secondaryLabel: "Waiting queue",
          title: `${waitingCount} waiting visit${waitingCount === 1 ? "" : "s"} still need a field lane`,
          tone: bestInsertionCandidate ? "brand" : "warning"
        }
      : initialBlockers.blockedJobCount
        ? {
            copy: fleetWorkflowPressureCopy,
            eyebrow: "Thread blockers",
            primaryHref:
              initialBlockers.supplyBlockedCount > 0
                ? "/dashboard/visits?scope=supply_blocked"
                : initialBlockers.financeBlockedCount > 0
                  ? "/dashboard/visits?scope=billing_follow_up"
                  : "/dashboard/visits?scope=ready_dispatch",
            primaryLabel:
              initialBlockers.supplyBlockedCount > 0
                ? "Open supply-blocked visits"
                : initialBlockers.financeBlockedCount > 0
                  ? "Open finance follow-through"
                  : "Open release handoff",
            secondaryHref: recommendedDispatchHref,
            secondaryLabel: "Open dispatch",
            title: fleetWorkflowPressureTitle,
            tone: fleetWorkflowPressureTone as BadgeTone
          }
        : {
            copy: `${unitReadyNowCount} ready service unit${unitReadyNowCount === 1 ? "" : "s"} visible now.`,
            eyebrow: "Fleet steady",
            primaryHref: recommendedDispatchHref,
            primaryLabel: "Open dispatch",
            secondaryHref: "/dashboard/fleet?panel=team",
            secondaryLabel: "Crew lanes",
            title: "Map-first capacity is steady right now",
            tone: "success"
          };
  const fleetLensSummary =
    panel === "map"
      ? topDriftCandidate
        ? `${topDriftCandidate.technician.name} is the clearest live recovery lane. ${topDriftCandidate.summary}`
        : bestInsertionCandidate
          ? `${bestInsertionCandidate.technician.name} is the cleanest same-day fit. ${bestInsertionCandidate.summary}`
          : waitingCount
            ? `${waitingCount} waiting visit${waitingCount === 1 ? "" : "s"} still need field capacity, but no lane looks clearly safer than the board average.`
            : "Map first. No lane is currently demanding a stronger intervention posture than the rest of the visible fleet."
      : panel === "team"
        ? `${prioritizedTechnicians.length} visible crew lane${prioritizedTechnicians.length === 1 ? "" : "s"} sorted by intervention pressure.`
        : `${unitReadyNowCount} service unit${unitReadyNowCount === 1 ? "" : "s"} are ready now and ${underpreparedUnitCount} still need readiness recovery.`;

  useEffect(() => {
    if (!visibleTechnicians.length) {
      setSelectedTechnicianId(null);
      return;
    }

    if (
      !selectedTechnicianId ||
      !visibleTechnicians.some((technician) => technician.id === selectedTechnicianId)
    ) {
      setSelectedTechnicianId(visibleTechnicians[0]?.id ?? null);
    }
  }, [selectedTechnicianId, visibleTechnicians]);

  useEffect(() => {
    if (panel === "map") {
      return;
    }

    setIsInspectorOpen(true);
  }, [panel]);

  useEffect(() => {
    const validStopIds = new Set([
      ...(selectedTechnician?.routeStops.map((stop) => stop.id) ?? []),
      ...workspace.queueJobs.map((stop) => stop.id)
    ]);

    if (!validStopIds.size) {
      setSelectedStopId(null);
      return;
    }

    if (!selectedStopId || !validStopIds.has(selectedStopId)) {
      setSelectedStopId(
        selectedTechnician?.nextStop?.id ??
          selectedTechnician?.currentStop?.id ??
          selectedTechnician?.routeStops[0]?.id ??
          workspace.queueJobs[0]?.id ??
          null
      );
    }
  }, [selectedStopId, selectedTechnician, workspace.queueJobs]);

  useEffect(() => {
    setSelectedRouteMetrics(null);
  }, [selectedTechnicianId]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | null = null;
    let refreshTimeoutId: number | null = null;
    const supabase = getBrowserSupabaseClient();

    async function loadLiveDevices() {
      try {
        const response = await fetch("/api/fleet/live-locations", { cache: "no-store" });
        const payload = (await response.json()) as Partial<LiveFleetPayload> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Live GPS is not updating right now.");
        }

        if (!isMounted || !Array.isArray(payload.technicians)) {
          return;
        }

        setLiveDevices(payload.technicians);
        setLastLiveRefreshAt(payload.refreshedAt ?? new Date().toISOString());
        setLiveFeedError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLiveFeedError(error instanceof Error ? error.message : "Live GPS is not updating right now.");
      }
    }

    const channel = supabase
      .channel("fleet-live-location-pings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "technician_location_pings"
        },
        () => {
          if (!isMounted) {
            return;
          }

          if (refreshTimeoutId !== null) {
            window.clearTimeout(refreshTimeoutId);
          }

          refreshTimeoutId = window.setTimeout(() => {
            void loadLiveDevices();
          }, 350);
        }
      )
      .subscribe();

    intervalId = window.setInterval(() => {
      void loadLiveDevices();
    }, 45_000);

    return () => {
      isMounted = false;

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
      }

      void supabase.removeChannel(channel);
    };
  }, []);

  function pushNotice(nextNotice: Notice) {
    setNotice(nextNotice);
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDate = event.currentTarget.value;

    if (!isValidDateInputValue(nextDate)) {
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", nextDate);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function pushWorkspaceQuery(patch: { panel?: "map" | "team" | "units"; technicianId?: string | null }) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (patch.panel) {
        params.set("panel", patch.panel);
      }

      if (patch.technicianId) {
        params.set("technicianId", patch.technicianId);
      } else if (patch.technicianId === null) {
        params.delete("technicianId");
      }

      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function inspectTechnicianLane(technicianId: string) {
    setIsInspectorOpen(true);
    setInspectorView("route");
    setTechnicianFilter("all");
    setSelectedTechnicianId(technicianId);
  }

  function openQueueInspector() {
    setIsInspectorOpen(true);
    setInspectorView("queue");
    setTechnicianFilter("all");
  }

  async function handleAssignQueueJob(stop: FleetStopView) {
    if (!selectedTechnician) {
      return;
    }

    try {
      setMutationPending(true);
      const response = await fetch("/api/internal/dispatch/calendar/quick-edit", {
        body: JSON.stringify({
          assignedTechnicianUserId: selectedTechnician.id,
          jobId: stop.jobId
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "The visit could not be assigned from Fleet.");
        }

      pushNotice({
        body: `${stop.title} was assigned to ${selectedTechnician.name}. Fleet will refresh with the latest route state.`,
        title: "Visit assigned",
        tone: "success"
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      pushNotice({
        body: error instanceof Error ? error.message : "The visit could not be assigned from Fleet.",
        title: "Assignment failed",
        tone: "danger"
      });
    } finally {
      setMutationPending(false);
    }
  }

  async function handleBlockRestOfDay() {
    if (!selectedTechnician) {
      return;
    }

    if (!workspace.isTodayView) {
      pushNotice({
        body: "Blocking availability from Fleet is only supported on today's board. Open Dispatch to block a future day.",
        title: "Use Dispatch for future blocks",
        tone: "warning"
      });
      return;
    }

    try {
      setMutationPending(true);
      const response = await fetch("/api/internal/dispatch/calendar/availability", {
        body: JSON.stringify({
          blockType: "time_off",
          endsAt: `${workspace.date}T${String(workspace.dayEndHour).padStart(2, "0")}:00:00`,
          startsAt: new Date().toISOString(),
          technicianUserId: selectedTechnician.id,
          title: "Blocked from Fleet"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "The technician could not be blocked from Fleet.");
      }

      pushNotice({
        body: `${selectedTechnician.name} is blocked for the rest of today. Fleet will refresh with the updated dispatch state.`,
        title: "Technician blocked",
        tone: "warning"
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      pushNotice({
        body:
          error instanceof Error
            ? error.message
            : "The technician could not be blocked from Fleet.",
        title: "Block failed",
        tone: "danger"
      });
    } finally {
      setMutationPending(false);
    }
  }

  if (!workspace.technicians.length) {
    return (
      <Page className="fleet-page" layout="command">
        <FieldCommandShell
          actions={
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href="/dashboard/dispatch">
              Open dispatch
            </Link>
          }
          description=""
          mode="fleet"
          status={
            <>
              <Badge tone="neutral">Unit readiness</Badge>
            </>
          }
          title="Fleet"
        />

        <Card className="fleet-empty-state-card" padding="spacious" tone="raised">
          <EmptyState
            actions={
              <div className="ui-table-actions">
                <Link className={buttonClassName({ size: "sm", tone: "primary" })} href="/dashboard/fleet?panel=units">
                  Open unit readiness
                </Link>
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href="/dashboard/dispatch">
                  Return to dispatch
                </Link>
              </div>
            }
            description="Add internal units and route-ready technicians before Fleet can take live route intervention."
            eyebrow="Route control not ready"
            title="No active internal units or technician routes yet"
            tone="warning"
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page className="fleet-page" layout="command">
        <FieldCommandShell
          actions={
            <>
            <Link className={buttonClassName({ size: "sm", tone: "primary" })} href={recommendedDispatchHref}>
                {recommendedDispatchLabel}
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href="/dashboard/fleet?panel=units"
            >
              Open unit readiness
            </Link>
            </>
          }
          description=""
          mode="fleet"
        title="Fleet"
      />

      {notice ? (
        <Callout className="fleet-page__notice" title={notice.title} tone={notice.tone}>
          <p className="ui-section-copy">{notice.body}</p>
        </Callout>
      ) : null}

      {liveFeedError ? (
        <Callout className="fleet-page__notice" title="Live GPS is holding on last known positions" tone="warning">
          <p className="ui-section-copy">{liveFeedError}</p>
        </Callout>
      ) : null}

      <section
        className={cx("fleet-page__lens-strip", panel === "map" && "fleet-page__lens-strip--map")}
        aria-label="Fleet lenses"
      >
        <div className="fleet-page__lens-tabs" role="tablist" aria-label="Fleet lens">
            <button
              aria-selected={panel === "map"}
              className={buttonClassName({ size: "sm", tone: panel === "map" ? "primary" : "secondary" })}
              onClick={() => pushWorkspaceQuery({ panel: "map" })}
              role="tab"
              type="button"
            >
              Map
            </button>
            <button
              aria-selected={panel === "team"}
              className={buttonClassName({ size: "sm", tone: panel === "team" ? "primary" : "secondary" })}
              onClick={() => pushWorkspaceQuery({ panel: "team" })}
              role="tab"
              type="button"
            >
              Crew lanes
            </button>
            <button
              aria-selected={panel === "units"}
              className={buttonClassName({ size: "sm", tone: panel === "units" ? "primary" : "secondary" })}
              onClick={() => pushWorkspaceQuery({ panel: "units" })}
              role="tab"
              type="button"
            >
              Unit readiness
            </button>
        </div>
      </section>

      <Card
        className={cx("fleet-stage", !isInspectorOpen && "fleet-stage--inspector-collapsed")}
        padding="compact"
        tone="raised"
      >
        {panel !== "map" ? (
          <div className="fleet-stage__capacity-strip">
            <div className="fleet-stage__command-deck">
              {attentionCount || topAttentionTechnicians.length ? (
              <article className="fleet-stage__command-card">
                <div className="fleet-stage__command-card-header">
                  <div>
                    <p className="fleet-stage__eyebrow">Field exceptions</p>
                    <h2 className="fleet-section__title">Start where route pressure is real</h2>
                  </div>
                  <Badge tone={attentionCount ? "warning" : "success"}>{attentionCount} flagged</Badge>
                </div>
                {topAttentionTechnicians.length ? (
                  <div className="fleet-stage__command-list">
                    {topAttentionTechnicians.map((technician) => {
                      const liveDevice = findLiveDeviceForTechnicianId(technician.id, liveDevices);

                      return (
                        <button
                          className="fleet-stage__command-list-item"
                          key={technician.id}
                          onClick={() => setSelectedTechnicianId(technician.id)}
                          type="button"
                        >
                          <div>
                            <strong>{technician.name}</strong>
                            <span>
                              {getFleetRosterPriorityLabel(
                                technician,
                                Boolean(liveDevice && liveDevice.latitude !== null && liveDevice.longitude !== null),
                                waitingCount
                              )}
                            </span>
                          </div>
                          <span>{formatFleetIssueSummary(technician)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="fleet-stage__command-copy">
                    All visible lanes are steady enough to stay map-first.
                  </p>
                )}
                <div className="ui-button-grid">
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={recommendedDispatchHref}
                  >
                    {recommendedDispatchLabel}
                  </Link>
                </div>
              </article>
              ) : null}

              {waitingCount || idleOpportunityCount || underpreparedUnitCount ? (
              <article className="fleet-stage__command-card">
                <div className="fleet-stage__command-card-header">
                  <div>
                    <p className="fleet-stage__eyebrow">Insertion posture</p>
                    <h2 className="fleet-section__title">Where same-day work still fits</h2>
                  </div>
                </div>
                <div className="fleet-stage__command-metrics">
                  <div className="fleet-stage__command-metric">
                    <span>Waiting</span>
                    <strong>{waitingCount}</strong>
                  </div>
                  <div className="fleet-stage__command-metric">
                    <span>Open lanes</span>
                    <strong>{idleOpportunityCount}</strong>
                  </div>
                  <div className="fleet-stage__command-metric">
                    <span>Underprepared</span>
                    <strong>{underpreparedUnitCount}</strong>
                  </div>
                </div>
                <p className="fleet-stage__command-copy">
                  {bestInsertionCandidate
                    ? `${bestInsertionCandidate.technician.name} is the cleanest current insertion target. ${bestInsertionCandidate.summary}`
                    : waitingCount
                      ? "No clean insertion lane is visible right now, so recovery should lead capacity decisions."
                      : "No waiting work is asking for same-day fleet capacity."}
                </p>
                <div className="ui-button-grid">
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      tone: waitingCount ? "secondary" : "ghost"
                    })}
                    href={recommendedDispatchHref}
                  >
                    {waitingCount ? recommendedDispatchLabel : "Open dispatch"}
                  </Link>
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      tone: waitingCount ? "ghost" : "secondary"
                    })}
                    href="/dashboard/dispatch?includeUnassigned=1"
                  >
                    Waiting queue
                  </Link>
                </div>
              </article>
              ) : null}

              {initialBlockers.blockedJobCount || initialBlockers.approvedReleaseCount || initialBlockers.financeBlockedCount ? (
              <article className="fleet-stage__command-card">
                <div className="fleet-stage__command-card-header">
                  <div>
                    <p className="fleet-stage__eyebrow">Release and blockers</p>
                    <h2 className="fleet-section__title">{fleetWorkflowPressureTitle}</h2>
                  </div>
                  <Badge tone={fleetWorkflowPressureTone}>{initialBlockers.blockedJobCount} blocked</Badge>
                </div>
                <div className="fleet-stage__command-metrics">
                  <div className="fleet-stage__command-metric">
                    <span>Release</span>
                    <strong>{initialBlockers.approvedReleaseCount}</strong>
                  </div>
                  <div className="fleet-stage__command-metric">
                    <span>Supply</span>
                    <strong>{initialBlockers.supplyBlockedCount}</strong>
                  </div>
                  <div className="fleet-stage__command-metric">
                    <span>Finance</span>
                    <strong>{initialBlockers.financeBlockedCount}</strong>
                  </div>
                </div>
                <p className="fleet-stage__command-copy">{fleetWorkflowPressureCopy}</p>
                <div className="fleet-stage__command-actions">
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      tone: initialBlockers.supplyBlockedCount ? "secondary" : "ghost"
                    })}
                    href="/dashboard/visits?scope=supply_blocked"
                  >
                    Supply-blocked visits
                  </Link>
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      tone: initialBlockers.approvedReleaseCount ? "secondary" : "ghost"
                    })}
                    href="/dashboard/visits?scope=ready_dispatch"
                  >
                    Release handoff
                  </Link>
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      tone: initialBlockers.financeBlockedCount ? "secondary" : "ghost"
                    })}
                    href="/dashboard/visits?scope=billing_follow_up"
                  >
                    Finance closeout
                  </Link>
                </div>
              </article>
              ) : null}
              {!attentionCount &&
              !topAttentionTechnicians.length &&
              !waitingCount &&
              !idleOpportunityCount &&
              !underpreparedUnitCount &&
              !initialBlockers.blockedJobCount &&
              !initialBlockers.approvedReleaseCount &&
              !initialBlockers.financeBlockedCount ? (
                <p className="fleet-stage__command-copy">
                  Route pressure is stable enough that these support lenses can stay secondary to the live map.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="fleet-stage__map-frame">
          {panel === "map" ? (
            <>
              <div className="fleet-stage__map-command-bar">
                <div className="fleet-stage__map-command-copy">
                  <div className="fleet-stage__map-command-heading">
                    <p className="fleet-stage__eyebrow">{mapCommandSummary.eyebrow}</p>
                    <div className="fleet-stage__map-command-badges">
                      <Badge tone={mapCommandSummary.tone}>{mapCommandSummary.title}</Badge>
                      {selectedRouteConfidence ? (
                        <Badge tone={selectedRouteConfidence.tone}>
                          {selectedRouteConfidence.label} · {selectedRouteConfidence.confidencePercent}%
                        </Badge>
                      ) : selectedPromiseConfidence ? (
                        <Badge tone={selectedPromiseConfidence.tone}>
                          {selectedPromiseConfidence.label} · {selectedPromiseConfidence.confidencePercent}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="fleet-stage__map-command-summary">{mapCommandSummary.copy}</p>
                </div>
                <div className="fleet-stage__map-command-metrics">
                  <div className="fleet-stage__map-command-metric">
                    <span>Flagged</span>
                    <strong>{attentionCount}</strong>
                  </div>
                  <div className="fleet-stage__map-command-metric">
                    <span>Promise</span>
                    <strong>
                      {selectedPromiseConfidence
                        ? `${selectedPromiseConfidence.confidencePercent}%`
                        : attentionCount
                          ? "Watch"
                          : "Steady"}
                    </strong>
                  </div>
                </div>
                <div className="fleet-stage__map-command-actions">
                  <Link className={buttonClassName({ size: "sm", tone: "primary" })} href={mapCommandSummary.primaryHref}>
                    {mapCommandSummary.primaryLabel}
                  </Link>
                  {selectedStopThreadHref ? (
                    <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedStopThreadHref}>
                      Open visit thread
                    </Link>
                  ) : (
                    <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={mapCommandSummary.secondaryHref}>
                      {mapCommandSummary.secondaryLabel}
                    </Link>
                  )}
                </div>
              </div>
              <FleetLiveMap
                focusNonce={focusNonce}
                liveDevices={liveDevices}
                onRouteMetricsChange={setSelectedRouteMetrics}
                onSelectStop={setSelectedStopId}
                onSelectTechnician={setSelectedTechnicianId}
                queueJobs={workspace.queueJobs}
                readinessPacket={isInspectorOpen ? null : fleetReadinessPacket}
                selectedStopId={selectedStopId}
                selectedTechnicianId={selectedTechnician?.id ?? null}
                technicians={visibleTechnicians}
                trafficEnabled={trafficEnabled}
              />
            </>
          ) : (
            <div className="ui-card-list">
              <Card padding="compact" tone="subtle">
                <CardContent className="ui-action-grid">
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">
                      {panel === "team" ? "Crew lane view" : "Unit readiness view"}
                    </p>
                    <p className="ui-detail-value">
                      {panel === "team"
                        ? `${prioritizedTechnicians.length} visible technician lane${prioritizedTechnicians.length === 1 ? "" : "s"}`
                        : `${unitReadyNowCount} service unit${unitReadyNowCount === 1 ? "" : "s"} ready now`}
                    </p>
                  </div>
                  <div className="ui-detail-grid">
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Waiting work</p>
                      <p className="ui-detail-value">{waitingCount}</p>
                      <p className="ui-card__description">Unassigned or unscheduled visits still asking for field capacity.</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Route risk</p>
                      <p className="ui-detail-value">{attentionCount}</p>
                      <p className="ui-card__description">Visible lanes that should be reviewed before new work moves.</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">GPS gaps</p>
                      <p className="ui-detail-value">{noGpsCount}</p>
                      <p className="ui-card__description">Service units still missing enough live location confidence.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="ui-action-grid">
                {fleetLensCards.map((technician) => {
                  const liveDevice = findLiveDeviceForTechnicianId(technician.id, liveDevices);
                  const dispatchHref = buildDispatchHref(workspace.date, technician.id);
                  const handleInspect = () => {
                    setIsInspectorOpen(true);
                    setSelectedTechnicianId(technician.id);
                    setInspectorView("route");
                  };

                  return panel === "team" ? (
                    <FleetTeamDeskCard
                      dispatchHref={dispatchHref}
                      isSelected={technician.id === selectedTechnician?.id}
                      key={technician.id}
                      liveDevice={liveDevice}
                      onInspect={handleInspect}
                      technician={technician}
                      waitingCount={waitingCount}
                    />
                  ) : (
                    <FleetServiceUnitCard
                      dispatchHref={dispatchHref}
                      isSelected={technician.id === selectedTechnician?.id}
                      key={technician.id}
                      liveDevice={liveDevice}
                      onInspect={handleInspect}
                      technician={technician}
                      waitingCount={waitingCount}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {mapPanelActive ? (
          <details className="fleet-stage__toolbar fleet-stage__toolbar--collapsible" open={shouldOpenMapControls}>
            <summary className="fleet-stage__toolbar-summary">
              <span>Map controls</span>
              <small>{mapControlsSummary}</small>
            </summary>
            <div className="fleet-stage__toolbar-panel">{fleetToolbarContent}</div>
          </details>
        ) : (
          <div className="fleet-stage__toolbar">{fleetToolbarContent}</div>
        )}

        {showMapRoster ? (
        <div className="fleet-stage__roster" aria-label="Priority lanes">
          {mapPanelActive ? (
            <details className="fleet-stage__roster-details">
              <summary className="fleet-stage__roster-summary">
                <span>Priority lanes</span>
                <small>
                  {prioritizedTechnicians[0]
                    ? `${prioritizedTechnicians[0].name} leads · ${prioritizedTechnicians.length} visible`
                    : "No lanes visible"}
                </small>
              </summary>
              <div className="fleet-stage__roster-strip">
                {prioritizedTechnicians.map((technician, index) => (
                  <FleetRosterItem
                    isSelected={technician.id === selectedTechnician?.id}
                    key={technician.id}
                    liveDevice={findLiveDeviceForTechnicianId(technician.id, liveDevices)}
                    onSelect={() => setSelectedTechnicianId(technician.id)}
                    priorityRank={index + 1}
                    waitingCount={waitingCount}
                    technician={technician}
                  />
                ))}
              </div>
            </details>
          ) : (
            <div className="fleet-stage__roster-strip">
              {prioritizedTechnicians.map((technician, index) => (
                <FleetRosterItem
                  isSelected={technician.id === selectedTechnician?.id}
                  key={technician.id}
                  liveDevice={findLiveDeviceForTechnicianId(technician.id, liveDevices)}
                  onSelect={() => setSelectedTechnicianId(technician.id)}
                  priorityRank={index + 1}
                  waitingCount={waitingCount}
                  technician={technician}
                />
              ))}
            </div>
          )}
        </div>
        ) : null}

        <aside className={cx("fleet-stage__inspector", !isInspectorOpen && "fleet-stage__inspector--collapsed")}>
          <button
            className="fleet-stage__inspector-toggle"
            onClick={() => setIsInspectorOpen((current) => !current)}
            type="button"
          >
            {isInspectorOpen ? "Collapse" : "Details"}
          </button>

          {isInspectorOpen ? (
            selectedTechnician ? (
              <div className="fleet-stage__inspector-body">
                {selectedInspectorAction ? (
                  <Callout className="fleet-stage__inspector-callout" title={selectedInspectorAction.title} tone={selectedInspectorAction.tone}>
                    <p className="ui-section-copy">{selectedInspectorAction.copy}</p>
                  </Callout>
                ) : null}

                <div className="fleet-stage__inspector-topbar">
                  <div className="fleet-detail__header-main">
                    <p className="fleet-section__eyebrow">Selected capacity lane</p>
                    <h2 className="fleet-section__title">{selectedTechnician.name}</h2>
                    <p className="fleet-section__copy">{formatFleetVehicleLabel(selectedTechnician)}</p>
                  </div>
                  <div className="fleet-stage__inspector-topbar-meta">
                    <FleetStatusPill status={selectedTechnician.status} />
                  </div>
                </div>

                <div className="fleet-stage__inspector-summary">
                  <div className="fleet-detail__badges fleet-stage__inspector-badges">
                    <Badge tone={getFleetRouteHealthTone(selectedTechnician.routeHealth)}>
                      {selectedTechnician.routeHealthLabel}
                    </Badge>
                    {selectedRouteConfidence ? (
                      <Badge tone={selectedRouteConfidence.tone}>
                        {selectedRouteConfidence.label} ·{" "}
                        {selectedRouteConfidence.confidencePercent}%
                      </Badge>
                    ) : null}
                    <Badge tone="neutral">
                      {selectedTechnician.jobsRemaining} stop{selectedTechnician.jobsRemaining === 1 ? "" : "s"} left
                    </Badge>
                    {selectedLiveDevice ? (
                      <Badge tone={getTrackingTone(selectedLiveDevice.trackingState)}>
                        {selectedLiveDevice.trackingSummary}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Waiting for GPS</Badge>
                    )}
                    {selectedTechnician.activeAvailabilityTitle ? (
                      <Badge tone="warning">{selectedTechnician.activeAvailabilityTitle}</Badge>
                    ) : null}
                  </div>

                  <div className="fleet-stage__decision-strip">
                    <div className="fleet-stage__decision-card">
                      <span className="fleet-stage__decision-label">Recommended move</span>
                      <strong className="fleet-stage__decision-value">{selectedInspectorAction?.title ?? "Hold lane"}</strong>
                    </div>
                    <div className="fleet-stage__decision-card">
                      <span className="fleet-stage__decision-label">Promise confidence</span>
                      <strong className="fleet-stage__decision-value">
                        {selectedPromiseConfidence
                          ? `${selectedPromiseConfidence.confidencePercent}% · ${selectedPromiseConfidence.label}`
                          : "No live promise"}
                      </strong>
                    </div>
                  </div>

                  <div className="fleet-stage__summary-row">
                    <p className="fleet-stage__summary-label">Now</p>
                    <div className="fleet-stage__summary-body">
                      <strong className="fleet-stage__summary-value">
                        {selectedTechnician.currentStop?.title ?? getFleetOperationalStatusLabel(selectedTechnician.status)}
                      </strong>
                      <span className="fleet-stage__summary-copy">
                        {selectedTechnician.currentStop
                          ? `${selectedTechnician.currentStop.customerName} · ${selectedTechnician.currentLocationLabel}`
                          : selectedTechnician.currentLocationLabel}
                      </span>
                    </div>
                  </div>

                  <div className="fleet-stage__summary-row">
                    <p className="fleet-stage__summary-label">Next</p>
                    <div className="fleet-stage__summary-body">
                      <strong className="fleet-stage__summary-value">
                        {selectedTechnician.nextStop?.title ?? "Open for same-day work"}
                      </strong>
                      <span className="fleet-stage__summary-copy">
                        {selectedTechnician.nextStop
                          ? `${selectedTechnician.nextStop.customerName} · ${selectedTechnician.nextStop.windowLabel ?? "Time not set"}`
                          : "No next stop scheduled"}
                      </span>
                    </div>
                  </div>

                  {selectedStop ? (
                    <div className="fleet-stage__summary-row">
                      <p className="fleet-stage__summary-label">Site thread</p>
                      <div className="fleet-stage__summary-body">
                        <strong className="fleet-stage__summary-value">
                          {selectedStop.hasServiceSitePlaybook ? "Playbook ready" : "Needs site playbook"}
                        </strong>
                        <span className="fleet-stage__summary-copy">{selectedStop.addressLabel}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="fleet-stage__summary-metrics">
                    <FleetSignal
                      label="ETA left"
                      value={
                        selectedRouteMetrics?.available
                          ? formatFleetMinutes(selectedRouteMetrics.travelMinutes)
                          : "Syncing"
                      }
                    />
                    <FleetSignal label="Stops left" value={`${selectedTechnician.jobsRemaining}`} />
                    <FleetSignal
                      label="Miles left"
                      value={
                        selectedRouteMetrics?.available
                          ? formatFleetMiles(selectedRouteMetrics.distanceMiles)
                          : "--"
                      }
                    />
                    <FleetSignal
                      label="Traffic"
                      value={
                        selectedRouteMetrics?.available
                          ? selectedRouteMetrics.trafficDelayMinutes > 0
                            ? formatFleetMinutes(selectedRouteMetrics.trafficDelayMinutes)
                            : "Clear"
                          : "--"
                      }
                    />
                  </div>

                  <div className="fleet-stage__action-dock">
                    <div className="fleet-detail__actions fleet-detail__actions--primary">
                      <Link className={buttonClassName({ size: "sm", tone: "primary" })} href={selectedDispatchHref}>
                        Open in dispatch
                      </Link>
                    </div>

                    {selectedStopThreadHref ||
                    selectedWorkflowBlocker?.supplyBlockerCount ||
                    selectedWorkflowBlocker?.openPaymentHandoffCount ||
                    selectedWorkflowBlocker?.financeOwnership?.owner === "Finance" ||
                    selectedCustomerThreadHref ||
                    selectedTechnician.phone ||
                    workspace.isTodayView ? (
                      <div className="fleet-detail__actions fleet-detail__actions--support">
                        <details>
                          <summary className={buttonClassName({ size: "sm", tone: "ghost" })}>More</summary>
                          <div className="fleet-detail__actions fleet-detail__actions--support">
                            {selectedStopThreadHref ? (
                              <Link
                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                href={selectedStopThreadHref}
                              >
                                Open visit thread
                              </Link>
                            ) : null}
                            {selectedWorkflowBlocker?.supplyBlockerCount ? (
                              <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={`/dashboard/visits/${selectedWorkflowBlocker.jobId}/inventory`}>
                                Unblock supply
                              </Link>
                            ) : null}
                            {!selectedWorkflowBlocker?.supplyBlockerCount &&
                            (selectedWorkflowBlocker?.openPaymentHandoffCount ||
                              selectedWorkflowBlocker?.financeOwnership?.owner === "Finance") ? (
                              <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={`/dashboard/visits/${selectedWorkflowBlocker.jobId}/invoice`}>
                                {selectedWorkflowBlocker?.openPaymentHandoffCount ? "Review field handoff" : "Work closeout"}
                              </Link>
                            ) : null}
                            <Button
                              disabled={!workspace.isTodayView || Boolean(selectedTechnician.activeAvailabilityTitle)}
                              loading={mutationPending || isPending}
                              onClick={handleBlockRestOfDay}
                              size="sm"
                              tone="ghost"
                            >
                              {selectedTechnician.activeAvailabilityTitle ? "Already blocked" : "Block rest of today"}
                            </Button>
                            {selectedCustomerThreadHref ? (
                              <Link
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                href={selectedCustomerThreadHref}
                              >
                                Open customer thread
                              </Link>
                            ) : null}
                            {selectedSiteThreadHref ? (
                              <Link
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                href={selectedSiteThreadHref}
                              >
                                Open site thread
                              </Link>
                            ) : null}
                            {selectedTechnician.phone ? (
                              <a className={buttonClassName({ size: "sm", tone: "ghost" })} href={`sms:${selectedTechnician.phone}`}>
                                Message tech
                              </a>
                            ) : null}
                            {selectedTechnician.phone ? (
                              <a className={buttonClassName({ size: "sm", tone: "ghost" })} href={`tel:${selectedTechnician.phone}`}>
                                Call tech
                              </a>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="fleet-stage__inspector-switch" role="tablist" aria-label="Inspector views">
                  <button
                    aria-selected={inspectorView === "route"}
                    className={cx(
                      "fleet-stage__inspector-tab",
                      inspectorView === "route" && "fleet-stage__inspector-tab--active"
                    )}
                    onClick={() => setInspectorView("route")}
                    role="tab"
                    type="button"
                  >
                    Route
                    <span>{selectedTechnician.routeStops.length}</span>
                  </button>
                  <button
                    aria-selected={inspectorView === "queue"}
                    className={cx(
                      "fleet-stage__inspector-tab",
                      inspectorView === "queue" && "fleet-stage__inspector-tab--active"
                    )}
                    onClick={() => setInspectorView("queue")}
                    role="tab"
                    type="button"
                  >
                    Insert queue
                    <span>{workspace.queueJobs.length}</span>
                  </button>
                </div>

                <div className="fleet-detail__scroll">
                  {inspectorView === "route" ? (
                    <section className="fleet-detail__section">
                      <div className="fleet-detail__section-header">
                        <div>
                          <p className="fleet-section__eyebrow">Route timeline</p>
                          <h3 className="fleet-detail__section-title">Remaining route</h3>
                        </div>
                        <span className="fleet-detail__section-meta">
                          {selectedRouteMetrics?.source === "tomtom" ? "TomTom routed" : "Direct estimate"} ·{" "}
                          {selectedTechnician.routeStops.length} stop{selectedTechnician.routeStops.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="fleet-route-stop-list">
                        {selectedTechnician.routeStops.length ? (
                          selectedTechnician.routeStops.map((stop) => (
                            <FleetRouteStopRow
                              isSelected={selectedStop?.id === stop.id}
                              key={stop.id}
                              onSelect={() => setSelectedStopId(stop.id)}
                              stop={stop}
                            />
                          ))
                        ) : (
                          <EmptyState
                            description="This lane is clear. If same-day work is waiting, assign it here before opening a softer lane."
                            eyebrow="Route clear"
                            title="No remaining stops"
                            tone="success"
                          />
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className="fleet-detail__section">
                      <div className="fleet-detail__section-header">
                        <div>
                          <p className="fleet-section__eyebrow">Insert queue</p>
                          <h3 className="fleet-detail__section-title">Place waiting work into this lane</h3>
                        </div>
                        <span className="fleet-detail__section-meta">{workspace.queueJobs.length} waiting</span>
                      </div>

                      <Callout
                        className="fleet-detail__callout"
                        title={workspace.queueJobs.length ? "Queue needs a decision" : "Queue clear"}
                        tone={getFleetRouteHealthTone(selectedTechnician.routeHealth)}
                      >
                        <p className="ui-section-copy">
                          {workspace.queueJobs.length
                            ? bestInsertionCandidate && bestInsertionCandidate.technician.id === selectedTechnician.id
                              ? `${workspace.queueJobs.length} waiting. This lane is currently the cleanest insertion target, so confirm the promise window and place the next stop here first.`
                              : bestInsertionCandidate
                                ? `${workspace.queueJobs.length} waiting. ${bestInsertionCandidate.technician.name} currently has the cleanest insertion profile, so compare this lane against that route before assigning here.`
                                : `${workspace.queueJobs.length} waiting. Confirm the current stop first, then insert work here only if the promise window still holds.`
                            : "No unscheduled or unassigned work is waiting to be inserted right now."}
                        </p>
                      </Callout>

                      <div className="fleet-queue-job-list">
                        {workspace.queueJobs.length ? (
                          workspace.queueJobs.slice(0, 5).map((stop) => (
                            <FleetQueueJobRow
                              disabled={mutationPending || isPending || selectedTechnician.status === "offline"}
                              isPending={mutationPending || isPending}
                              key={stop.id}
                              onAssign={() => void handleAssignQueueJob(stop)}
                              stop={stop}
                            />
                          ))
                        ) : (
                          <EmptyState
                            description="No waiting visit is asking for insertion right now."
                            eyebrow="Queue clear"
                            title="No waiting visits"
                            tone="success"
                          />
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                description="Pick a lane to inspect route health, confirm the next stop, and take the next intervention move."
                eyebrow="Lane detail"
                title="Choose a capacity lane"
                tone="info"
              />
            )
          ) : null}
        </aside>
      </Card>
    </Page>
  );
}
