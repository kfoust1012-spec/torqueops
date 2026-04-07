"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  AssignableTechnicianOption,
  DispatchCalendarData,
  DispatchBoardJobItem,
  DispatchCalendarSettings,
  DispatchCalendarJobEvent,
  JobPriority,
  JobStatus
} from "@mobile-mechanic/types";
import {
  formatDesignLabel,
  formatCurrencyFromCents,
  formatDateTime,
  formatDispatchDateTime,
  formatDesignStatusLabel,
  isInvoiceEligibleForReminder,
  isTechnicianActiveFieldJobStatus,
  isTechnicianTravelJobStatus,
  toDispatchDateTimeInput,
  zonedLocalDateTimeToUtc
} from "@mobile-mechanic/core";

import {
  Badge,
  Button,
  Callout,
  Input,
  PriorityBadge,
  Select,
  StatusBadge,
  buttonClassName
} from "../../../../components/ui";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import {
  getVisitNextMove,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone
} from "../../../../lib/jobs/workflow";
import type {
  PromiseConfidenceSnapshot,
  ReleaseRunwayState,
  RouteConfidenceSnapshot,
  ServiceSiteThreadSummary
} from "../../../../lib/service-thread/continuity";
import {
  buildVisitEstimateHref,
  buildVisitInspectionHref,
  buildVisitInvoiceHref,
  buildVisitPhotosHref,
  buildVisitThreadHref
} from "../../../../lib/visits/workspace";
import {
  getFollowUpCommunicationAction,
  type FollowUpCommunicationAction
} from "../../../../lib/jobs/follow-up";
import {
  getCollectionsExceptionOwnershipSummary,
  getEstimateExceptionOwnershipSummary
} from "../../../../lib/jobs/exception-ownership";
import { getDispatchVisitOperationalSignal } from "./dispatch-calendar-signals";

type DispatchQuickEditPanelProps = {
  calendar: DispatchCalendarData;
  visit: DispatchBoardJobItem | DispatchCalendarJobEvent | null;
  onClose: () => void;
  onSave: (input: {
    arrivalWindowEndAt: string | null;
    arrivalWindowStartAt: string | null;
    assignedTechnicianUserId: string | null;
    jobId: string;
    priority: JobPriority;
    scheduledEndAt: string | null;
    scheduledStartAt: string | null;
    status: JobStatus;
  }) => Promise<void>;
  pending?: boolean;
  returnToHref: string;
  returnToLabel: string;
  settings: DispatchCalendarSettings;
  technicians: AssignableTechnicianOption[];
  timezone: string;
};

type DispatchVisitSnapshot = {
  continuity: {
    promiseConfidence: PromiseConfidenceSnapshot;
    releaseRunway: ReleaseRunwayState;
    routeConfidence: RouteConfidenceSnapshot;
    serviceSiteThread: ServiceSiteThreadSummary;
  };
  communicationCount: number;
  estimate: {
    estimateNumber: string;
    status: string;
    totalCents: number;
  } | null;
  followUpSummary: {
    activeRelatedVisitCount: number;
    childJobId: string | null;
    childTitle: string | null;
    copy: string;
    customerCommunicationAction: "appointment_confirmation" | "dispatch_update" | null;
    customerStatus: "awaiting_parts" | "follow_up_booked" | "follow_up_in_progress" | "follow_up_rescheduled" | null;
    customerStatusCopy: string | null;
    hasChainContext: boolean;
    isFollowUpVisit: boolean;
    label: string;
    needsSourceCloseout: boolean;
    recommendedAction: "close_source" | "create_return_visit" | "monitor_return_visit" | null;
    recoveryOwner: "Dispatch" | "Finance" | "Service advisor" | "Supply";
    sourceJobId: string | null;
    sourceTitle: string | null;
    staleCopy: string | null;
    staleFollowUp: boolean;
    shouldCreateReturnVisit: boolean;
    tone: "brand" | "neutral" | "success" | "warning";
  };
  estimateLink: {
    publicUrl: string;
    sentAt: string | null;
    status: string;
  } | null;
  inspectionStatus: string | null;
  invoice: {
    balanceDueCents: number;
    dueAt: string | null;
    invoiceNumber: string;
    status: string;
    totalCents: number;
  } | null;
  invoiceLink: {
    publicUrl: string;
    sentAt: string | null;
    status: string;
  } | null;
  promiseSummary: {
    breachRisk: "high" | "none" | "watch";
    confidenceLabel: string;
    confidencePercent: number;
    copy: string;
    label: string;
    lastCustomerUpdateAt: string | null;
    lastCustomerUpdateLabel: string;
    nextUpdateDueAt: string | null;
    nextUpdateLabel: string;
    owner: "Closed" | "Dispatch" | "Service advisor";
    promisedAt: string | null;
    recommendedAction: "appointment_confirmation" | "dispatched" | "en_route" | "set_promise" | null;
    tone: "brand" | "danger" | "neutral" | "success" | "warning";
  };
  readinessSummary: {
    copy: string;
    items: Array<{
      detail: string;
      label: string;
      ready: boolean;
    }>;
    readyCount: number;
    score: number;
    tone: "brand" | "danger" | "neutral" | "success" | "warning";
    totalCount: number;
  };
  trustSummary: {
    copy: string;
    label: string;
    nextActionLabel: string;
    owner: "Dispatch" | "Finance" | "Service advisor";
    risk: "high" | "none" | "watch";
    score: number;
    tone: "brand" | "danger" | "neutral" | "success" | "warning";
  };
  lastCommunicationType: string | null;
  latestCommunications: Array<{
    channel: string;
    communicationType: string;
    createdAt: string;
    id: string;
    recipientEmail: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    status: string;
  }>;
  latestStatusHistory: Array<{
    createdAt: string;
    fromStatus: string | null;
    id: string;
    reason: string | null;
    toStatus: string;
  }>;
  latestNotes: Array<{
    body: string;
    createdAt: string;
    id: string;
    isInternal: boolean;
  }>;
  fitRecommendations: Array<{
    distanceMiles: number | null;
    repeatCustomerVisits: number;
    repeatVehicleVisits: number;
    specialtyMatches: string[];
    technicianName: string;
    technicianUserId: string;
    trackingState: string | null;
    yearsExperience: number | null;
  }>;
  noteCount: number;
  photoCount: number;
};

const dispatchStatuses: JobStatus[] = [
  "new",
  "scheduled",
  "dispatched",
  "en_route",
  "arrived",
  "diagnosing",
  "waiting_approval",
  "waiting_parts",
  "repairing",
  "ready_for_payment",
  "in_progress",
  "completed",
  "canceled"
];

const dispatchPriorities: JobPriority[] = ["low", "normal", "high", "urgent"];

function getInputMinutes(value: string) {
  const [, timePart] = value.split("T");

  if (!timePart) {
    return null;
  }

  const [hourText, minuteText] = timePart.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function getDispatchInputDate(value: string, timeZone: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  try {
    return zonedLocalDateTimeToUtc(normalized, timeZone);
  } catch {
    return null;
  }
}

function formatQuickEditDateTime(value: Date | null, timeZone: string) {
  if (!value) {
    return null;
  }

  return formatDispatchDateTime(value.toISOString(), timeZone, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "numeric"
  });
}

function formatQuickEditRange(
  startAt: Date | null,
  endAt: Date | null,
  timeZone: string,
  fallback: string
) {
  const startLabel = formatQuickEditDateTime(startAt, timeZone);

  if (!startLabel) {
    return fallback;
  }

  const endLabel = formatQuickEditDateTime(endAt, timeZone);

  if (!endLabel) {
    return startLabel;
  }

  return `${startLabel} - ${endLabel}`;
}

function shiftLocalDateTimeInput(value: string, timeZone: string, minutes: number) {
  const date = getDispatchInputDate(value, timeZone);

  if (!date) {
    return "";
  }

  return toDispatchDateTimeInput(new Date(date.getTime() + minutes * 60_000).toISOString(), timeZone);
}

function getEstimateSummary(snapshot: DispatchVisitSnapshot | null) {
  if (!snapshot?.estimate) {
    return {
      copy: "No estimate started",
      title: "Estimate",
      value: "Not started"
    };
  }

  return {
    copy: formatDesignStatusLabel(snapshot.estimate.status),
    title: "Estimate",
    value: `${snapshot.estimate.estimateNumber} · ${formatCurrencyFromCents(snapshot.estimate.totalCents)}`
  };
}

function getInvoiceSummary(snapshot: DispatchVisitSnapshot | null) {
  if (!snapshot?.invoice) {
    return {
      copy: "No invoice started",
      title: "Invoice",
      value: "Not started"
    };
  }

  const value =
    snapshot.invoice.balanceDueCents > 0
      ? formatCurrencyFromCents(snapshot.invoice.balanceDueCents)
      : formatCurrencyFromCents(snapshot.invoice.totalCents);

  return {
    copy: formatDesignStatusLabel(snapshot.invoice.status),
    title: "Invoice",
    value: `${snapshot.invoice.invoiceNumber} · ${value}`
  };
}

function getFieldSummary(snapshot: DispatchVisitSnapshot | null) {
  if (!snapshot) {
    return {
      copy: "Loading visit context",
      title: "Field",
      value: "Loading"
    };
  }

  const inspectionLabel = snapshot.inspectionStatus
    ? formatDesignStatusLabel(snapshot.inspectionStatus)
    : "Not started";

  return {
    copy: `${snapshot.photoCount} photo${snapshot.photoCount === 1 ? "" : "s"} · ${snapshot.noteCount} note${snapshot.noteCount === 1 ? "" : "s"}`,
    title: "Field",
    value: inspectionLabel
  };
}

function getCommunicationSummary(snapshot: DispatchVisitSnapshot | null) {
  if (!snapshot) {
    return {
      copy: "Loading visit context",
      title: "Comms",
      value: "Loading"
    };
  }

  return {
    copy:
      snapshot.lastCommunicationType
        ? formatDesignStatusLabel(snapshot.lastCommunicationType)
        : "No outbound updates yet",
    title: "Comms",
    value: snapshot.communicationCount
      ? `${snapshot.communicationCount} recent`
      : "Quiet"
  };
}

function getLaneRecommendationCopy(args: {
  distanceMiles: number | null;
  continuityCustomerCount: number;
  continuityVehicleCount: number;
  availabilityBlockCount: number;
  backlogCount: number;
  conflictCount: number;
  gapAfterMinutes: number | null;
  gapBeforeMinutes: number | null;
  hasLiveVisit: boolean;
  isCurrentLane: boolean;
  isTightAfter: boolean;
  isTightBefore: boolean;
  nextVisitTitle: string | null;
  previousVisitTitle: string | null;
  repeatCustomerVisits: number;
  repeatVehicleVisits: number;
  scheduledCount: number;
  specialtyMatches: string[];
  yearsExperience: number | null;
}) {
  if (args.repeatVehicleVisits > 0) {
    return `Handled this vehicle ${args.repeatVehicleVisits} time${args.repeatVehicleVisits === 1 ? "" : "s"}`;
  }

  if (args.repeatCustomerVisits > 0) {
    return `Worked with this customer ${args.repeatCustomerVisits} time${args.repeatCustomerVisits === 1 ? "" : "s"}`;
  }

  if (args.specialtyMatches.length > 0) {
    return `Profile match: ${args.specialtyMatches.join(", ")}`;
  }

  if (args.distanceMiles !== null && args.distanceMiles <= 12) {
    return `${args.distanceMiles.toFixed(1)} mi from this stop`;
  }

  if (args.isTightBefore && args.previousVisitTitle && args.gapBeforeMinutes !== null) {
    return `${args.gapBeforeMinutes}m after ${args.previousVisitTitle}`;
  }

  if (args.isTightAfter && args.nextVisitTitle && args.gapAfterMinutes !== null) {
    return `${args.gapAfterMinutes}m before ${args.nextVisitTitle}`;
  }

  if (
    args.gapBeforeMinutes !== null &&
    args.gapAfterMinutes !== null &&
    args.gapBeforeMinutes >= 45 &&
    args.gapAfterMinutes >= 45
  ) {
    return "Clean route window";
  }

  if (args.continuityVehicleCount > 0) {
    return "Already touching this vehicle today";
  }

  if (args.continuityCustomerCount > 0) {
    return "Already handling this customer today";
  }

  if (args.isCurrentLane && args.conflictCount === 0 && args.backlogCount === 0) {
    return "Current lane still fits";
  }

  if (args.conflictCount > 0) {
    return `${args.conflictCount} conflict${args.conflictCount === 1 ? "" : "s"} on lane`;
  }

  if (args.hasLiveVisit) {
    return "Technician is live on another stop";
  }

  if (args.backlogCount > 0) {
    return `${args.backlogCount} waiting stop${args.backlogCount === 1 ? "" : "s"}`;
  }

  if (args.scheduledCount === 0) {
    return "Open lane right now";
  }

  if (args.scheduledCount === 1) {
    return "Light board load";
  }

  if (args.availabilityBlockCount > 0) {
    return `${args.availabilityBlockCount} shaped block${args.availabilityBlockCount === 1 ? "" : "s"}`;
  }

  if (args.yearsExperience !== null && args.yearsExperience >= 5) {
    return `${args.yearsExperience} years in field`;
  }

  return `${args.scheduledCount} scheduled stops`;
}

function getMinutesSince(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(Math.round((Date.now() - timestamp) / 60_000), 0);
}

function getMinutesUntil(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.round((timestamp - Date.now()) / 60_000);
}

function getDurationMinutes(startAt: string, endAt: string) {
  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return null;
  }

  return Math.round((endTime - startTime) / 60_000);
}

function getLaneWindowFit(args: {
  draftEndAt: Date | null;
  draftStartAt: Date | null;
  events: DispatchCalendarJobEvent[];
}) {
  if (!args.draftStartAt || !args.draftEndAt) {
    return {
      gapAfterMinutes: null,
      gapBeforeMinutes: null,
      isCleanInsertion: false,
      isTightAfter: false,
      isTightBefore: false,
      nextJob: null,
      previousJob: null
    };
  }

  const orderedEvents = [...args.events].sort(
    (left, right) => Date.parse(left.eventStartAt) - Date.parse(right.eventStartAt)
  );
  const draftStartTime = args.draftStartAt.getTime();
  const draftEndTime = args.draftEndAt.getTime();
  let previousJob: DispatchCalendarJobEvent | null = null;
  let nextJob: DispatchCalendarJobEvent | null = null;

  for (const event of orderedEvents) {
    const eventStartTime = Date.parse(event.eventStartAt);
    const eventEndTime = Date.parse(event.eventEndAt);

    if (Number.isNaN(eventStartTime) || Number.isNaN(eventEndTime)) {
      continue;
    }

    if (eventEndTime <= draftStartTime) {
      previousJob = event;
      continue;
    }

    if (eventStartTime >= draftEndTime) {
      nextJob = event;
      break;
    }
  }

  const gapBeforeMinutes =
    previousJob ? getDurationMinutes(previousJob.eventEndAt, args.draftStartAt.toISOString()) : null;
  const gapAfterMinutes =
    nextJob ? getDurationMinutes(args.draftEndAt.toISOString(), nextJob.eventStartAt) : null;
  const isTightBefore = gapBeforeMinutes !== null && gapBeforeMinutes < 30;
  const isTightAfter = gapAfterMinutes !== null && gapAfterMinutes < 30;
  const isCleanInsertion =
    (gapBeforeMinutes === null || gapBeforeMinutes >= 45) &&
    (gapAfterMinutes === null || gapAfterMinutes >= 45);

  return {
    gapAfterMinutes,
    gapBeforeMinutes,
    isCleanInsertion,
    isTightAfter,
    isTightBefore,
    nextJob,
    previousJob
  };
}

export function DispatchQuickEditPanel({
  calendar,
  visit,
  onClose,
  onSave,
  pending,
  returnToHref,
  returnToLabel,
  settings,
  technicians,
  timezone
}: DispatchQuickEditPanelProps) {
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState<string>("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [arrivalWindowStartAt, setArrivalWindowStartAt] = useState("");
  const [arrivalWindowEndAt, setArrivalWindowEndAt] = useState("");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [status, setStatus] = useState<JobStatus>("new");
  const [communicationFeedback, setCommunicationFeedback] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [pendingCommunication, setPendingCommunication] = useState<
    | "appointment_confirmation"
    | "dispatched"
    | "en_route"
    | "estimate_notification"
    | "follow_up_awaiting_parts"
    | "follow_up_booked"
    | "follow_up_rescheduled"
    | "follow_up_status_update"
    | "invoice_notification"
    | "payment_reminder"
    | null
  >(null);
  const [pendingRecovery, setPendingRecovery] = useState<
    "defer_to_queue" | "notify_delay" | "notify_reassign" | null
  >(null);
  const [recoveryPlan, setRecoveryPlan] = useState<"best_lane" | "defer_to_queue" | "same_lane">(
    "same_lane"
  );
  const [recoveryDelayMinutes, setRecoveryDelayMinutes] = useState<"30" | "45" | "60">("45");
  const [recoveryResolved, setRecoveryResolved] = useState(false);
  const [recoveryResolution, setRecoveryResolution] = useState<{
    copy: string;
    title: string;
  } | null>(null);
  const [pendingNote, setPendingNote] = useState(false);
  const [snapshot, setSnapshot] = useState<DispatchVisitSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotRevision, setSnapshotRevision] = useState(0);

  useEffect(() => {
    if (!visit) {
      return;
    }

    setAssignedTechnicianUserId(visit.assignedTechnicianUserId ?? "");
    setScheduledStartAt(toDispatchDateTimeInput(visit.scheduledStartAt, timezone));
    setScheduledEndAt(toDispatchDateTimeInput(visit.scheduledEndAt, timezone));
    setArrivalWindowStartAt(toDispatchDateTimeInput(visit.arrivalWindowStartAt, timezone));
    setArrivalWindowEndAt(toDispatchDateTimeInput(visit.arrivalWindowEndAt, timezone));
    setPriority(visit.priority);
    setStatus(visit.status);
    setRecoveryDelayMinutes("45");
    setRecoveryResolved(false);
    setRecoveryResolution(null);
  }, [visit, timezone]);

  useEffect(() => {
    if (!visit) {
      setSnapshot(null);
      setCommunicationFeedback(null);
      setSnapshotError(null);
      setSnapshotLoading(false);
      return;
    }

    const controller = new AbortController();

    setSnapshotLoading(true);
    setCommunicationFeedback(null);
    setNoteBody("");
    setSnapshotError(null);

    fetch(`/api/internal/visits/${visit.id}/snapshot`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; snapshot?: DispatchVisitSnapshot }
          | null;

        if (!response.ok || !payload?.snapshot) {
          throw new Error(payload?.error ?? "Visit context could not be loaded.");
        }

        setSnapshot(payload.snapshot);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setSnapshot(null);
        setSnapshotError(error instanceof Error ? error.message : "Visit context could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSnapshotLoading(false);
        }
      });

    return () => controller.abort();
  }, [visit, snapshotRevision]);

  if (!visit) {
    return null;
  }

  const jobId = visit.id;
  const visitWorkspaceHref = buildVisitThreadHref(jobId, {
    returnLabel: returnToLabel,
    returnTo: returnToHref
  });
  const customerWorkspaceHref = buildCustomerWorkspaceHref(visit.customerId);
  const siteThreadHref = visit.serviceSiteId
    ? buildCustomerWorkspaceHref(visit.customerId, {
        editAddressId: visit.serviceSiteId,
        tab: "addresses"
      })
    : null;
  const promiseRiskQueueHref = buildDashboardAliasHref("/dashboard/visits", {
    jobId,
    scope: "promise_risk"
  });
  const returnVisitQueueHref = buildDashboardAliasHref("/dashboard/visits", {
    jobId,
    scope: "return_visit"
  });
  const staleReturnVisitQueueHref = buildDashboardAliasHref("/dashboard/visits", {
    jobId,
    scope: "stale_return_visit"
  });
  const sourceVisitWorkspaceHref = snapshot?.followUpSummary.sourceJobId
    ? buildVisitThreadHref(snapshot.followUpSummary.sourceJobId, {
        returnLabel: returnToLabel,
        returnTo: returnToHref
      })
    : null;
  const childVisitWorkspaceHref = snapshot?.followUpSummary.childJobId
    ? buildVisitThreadHref(snapshot.followUpSummary.childJobId, {
        returnLabel: returnToLabel,
        returnTo: returnToHref
      })
    : null;

  const hasAssignedTechnician = Boolean(assignedTechnicianUserId);
  const assignedTechnicianName = hasAssignedTechnician
    ? technicians.find((technician) => technician.userId === assignedTechnicianUserId)?.displayName ??
      visit.assignedTechnicianName ??
      "Assigned technician"
    : null;
  const assignedTechnicianLabel = assignedTechnicianName ?? "Unassigned";
  const workflowState = getVisitWorkflowState({
    ...visit,
    assignedTechnicianName,
    assignedTechnicianUserId: assignedTechnicianUserId || null,
    arrivalWindowStartAt: arrivalWindowStartAt || null,
    scheduledStartAt: scheduledStartAt || null,
    status
  });
  const draftScheduledStartAt = getDispatchInputDate(scheduledStartAt, timezone);
  const draftScheduledEndAt = getDispatchInputDate(scheduledEndAt, timezone);
  const draftArrivalWindowStartAt = getDispatchInputDate(arrivalWindowStartAt, timezone);
  const draftArrivalWindowEndAt = getDispatchInputDate(arrivalWindowEndAt, timezone);
  const draftVisit = {
    ...visit,
    assignedTechnicianName,
    assignedTechnicianUserId: assignedTechnicianUserId || null,
    arrivalWindowEndAt: draftArrivalWindowEndAt?.toISOString() ?? null,
    arrivalWindowStartAt: draftArrivalWindowStartAt?.toISOString() ?? null,
    scheduledEndAt: draftScheduledEndAt?.toISOString() ?? null,
    scheduledStartAt: draftScheduledStartAt?.toISOString() ?? null,
    status
  };
  const nextMove = getVisitNextMove(draftVisit);
  const draftOverlappingVisits =
    draftScheduledStartAt && draftScheduledEndAt && assignedTechnicianUserId
      ? calendar.jobs.filter((candidate) => {
          if (candidate.id === visit.id || candidate.resourceTechnicianUserId !== assignedTechnicianUserId) {
            return false;
          }

          return (
            draftScheduledStartAt.getTime() < new Date(candidate.eventEndAt).getTime() &&
            draftScheduledEndAt.getTime() > new Date(candidate.eventStartAt).getTime()
          );
        })
      : [];
  const draftAvailabilityConflicts =
    draftScheduledStartAt && draftScheduledEndAt && assignedTechnicianUserId
      ? calendar.availability.filter((block) => {
          if (block.technicianUserId !== assignedTechnicianUserId) {
            return false;
          }

          return (
            draftScheduledStartAt.getTime() < new Date(block.eventEndAt).getTime() &&
            draftScheduledEndAt.getTime() > new Date(block.eventStartAt).getTime()
          );
        })
      : [];
  const outsideHours =
    scheduledStartAt &&
    scheduledEndAt &&
    (() => {
      const startMinutes = getInputMinutes(scheduledStartAt);
      const endMinutes = getInputMinutes(scheduledEndAt);

      if (startMinutes === null || endMinutes === null) {
        return false;
      }

      return (
        startMinutes < settings.dayStartHour * 60 ||
        endMinutes > settings.dayEndHour * 60 ||
        scheduledStartAt.slice(0, 10) !== scheduledEndAt.slice(0, 10)
      );
    })();
  const validationError =
    draftScheduledStartAt &&
    draftScheduledEndAt &&
    draftScheduledEndAt.getTime() <= draftScheduledStartAt.getTime()
      ? "Scheduled end must be after scheduled start."
      : arrivalWindowEndAt && !arrivalWindowStartAt
        ? "Arrival window start is required when arrival window end is set."
        : arrivalWindowStartAt &&
            arrivalWindowEndAt &&
            (() => {
              if (!draftArrivalWindowStartAt || !draftArrivalWindowEndAt) {
                return false;
              }

              return draftArrivalWindowEndAt.getTime() < draftArrivalWindowStartAt.getTime();
            })()
          ? "Arrival window end must be after arrival window start."
          : null;
  const draftConflictMessage = validationError
    ? null
    : outsideHours
      ? "Draft sits outside dispatch hours."
      : draftOverlappingVisits.length
        ? `Draft overlaps ${draftOverlappingVisits.length} other stop${draftOverlappingVisits.length === 1 ? "" : "s"}.`
        : draftAvailabilityConflicts.length
          ? `Draft overlaps ${draftAvailabilityConflicts.length} availability block${draftAvailabilityConflicts.length === 1 ? "" : "s"}.`
          : null;
  const currentVisitConflictCount = calendar.conflicts.filter((conflict) => conflict.jobId === visit.id).length;
  const scheduleSnapshot = formatQuickEditRange(
    draftScheduledStartAt,
    draftScheduledEndAt,
    timezone,
    "Needs slot"
  );
  const boardStateLabel = validationError
    ? "Draft needs review"
    : draftConflictMessage
      ? "Risk on this lane"
      : currentVisitConflictCount
        ? `${currentVisitConflictCount} active conflict${currentVisitConflictCount === 1 ? "" : "s"}`
        : "Ready on board";
  const boardStateTone =
    validationError ? "danger" : draftConflictMessage || currentVisitConflictCount ? "warning" : "success";
  const estimateSummary = getEstimateSummary(snapshot);
  const invoiceSummary = getInvoiceSummary(snapshot);
  const fieldSummary = getFieldSummary(snapshot);
  const communicationSummary = getCommunicationSummary(snapshot);
  const draftOperationalSignal = getDispatchVisitOperationalSignal(draftVisit, timezone, new Date());
  const canSendReminder = Boolean(
    snapshot?.invoice &&
      isInvoiceEligibleForReminder({
        balanceDueCents: snapshot.invoice.balanceDueCents,
        dueAt: snapshot.invoice.dueAt,
        status: snapshot.invoice.status as "draft" | "issued" | "partially_paid" | "paid" | "void"
      })
  );
  const canSendEstimateNotification = snapshot?.estimate?.status === "sent";
  const canSendInvoiceNotification = Boolean(
    snapshot?.invoice && ["issued", "partially_paid"].includes(snapshot.invoice.status)
  );
  const followUpCommunication = snapshot?.followUpSummary
    ? getFollowUpCommunicationAction(snapshot.followUpSummary)
    : null;
  const estimateExceptionOwnership = snapshot?.estimate
    ? getEstimateExceptionOwnershipSummary({
        sentAt: snapshot.estimateLink?.sentAt ?? null,
        status: snapshot.estimate.status
      })
    : null;
  const collectionsExceptionOwnership = snapshot?.invoice
    ? getCollectionsExceptionOwnershipSummary({
        balanceDueCents: snapshot.invoice.balanceDueCents,
        status: snapshot.invoice.status,
        updatedAt:
          snapshot.invoiceLink?.sentAt ??
          snapshot.invoice.dueAt ??
          visit.arrivalWindowStartAt ??
          visit.scheduledStartAt ??
          new Date().toISOString()
      })
    : null;
  const fitRecommendationByTechnicianId = new Map(
    (snapshot?.fitRecommendations ?? []).map((recommendation) => [
      recommendation.technicianUserId,
      recommendation
    ])
  );
  const laneRecommendations = calendar.resources
    .map((resource) => {
      const laneEvents = calendar.jobs.filter(
        (candidate) =>
          candidate.id !== visit.id &&
          candidate.resourceTechnicianUserId === resource.technicianUserId
      );
      const laneVisits = [
        ...laneEvents,
        ...calendar.backlogJobs.filter(
          (candidate) =>
            candidate.id !== visit.id &&
            candidate.assignedTechnicianUserId === resource.technicianUserId
        )
      ];
      const continuityVehicleCount = laneVisits.filter(
        (candidate) => candidate.vehicleId === visit.vehicleId
      ).length;
      const continuityCustomerCount = laneVisits.filter(
        (candidate) => candidate.customerId === visit.customerId
      ).length;
      const hasLiveVisit = laneVisits.some(
        (candidate) => isTechnicianActiveFieldJobStatus(candidate.status)
      );
      const isCurrentLane = resource.technicianUserId === assignedTechnicianUserId;
      const fitSignal = fitRecommendationByTechnicianId.get(resource.technicianUserId) ?? null;
      const laneWindowFit = getLaneWindowFit({
        draftEndAt: draftScheduledEndAt,
        draftStartAt: draftScheduledStartAt,
        events: laneEvents
      });
      const score =
        resource.conflictCount * 100 +
        resource.backlogCount * 35 +
        resource.scheduledCount * 12 +
        resource.availabilityBlockCount * 6 +
        (hasLiveVisit ? 24 : 0) -
        (fitSignal?.repeatVehicleVisits ?? 0) * 90 -
        (fitSignal?.repeatCustomerVisits ?? 0) * 30 -
        (fitSignal?.specialtyMatches.length ?? 0) * 24 -
        Math.min(fitSignal?.yearsExperience ?? 0, 12) -
        (fitSignal?.distanceMiles !== null && fitSignal?.distanceMiles !== undefined
          ? Math.max(18 - fitSignal.distanceMiles, 0) * 2
          : 0) +
        (fitSignal?.trackingState === "offline" ? 18 : 0) +
        (fitSignal?.trackingState === "waiting" ? 12 : 0) -
        (laneWindowFit.isTightBefore ? 60 : 0) -
        (laneWindowFit.isTightAfter ? 60 : 0) +
        (laneWindowFit.isCleanInsertion ? 18 : 0) -
        continuityVehicleCount * 70 -
        continuityCustomerCount * 30 -
        (resource.scheduledCount === 0 ? 8 : 0) -
        (isCurrentLane ? 12 : 0);

      return {
        continuityCustomerCount,
        continuityVehicleCount,
        fitSignal,
        hasLiveVisit,
        isCurrentLane,
        laneWindowFit,
        resource,
        score
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.resource.displayName.localeCompare(right.resource.displayName);
    })
    .slice(0, 3);
  const latestAppointmentConfirmation = snapshot?.latestCommunications.find(
    (entry) => entry.communicationType === "appointment_confirmation"
  );
  const latestDispatchUpdate = snapshot?.latestCommunications.find(
    (entry) => entry.communicationType === "dispatch_update"
  );
  const latestDispatchUpdateAgeMinutes = getMinutesSince(latestDispatchUpdate?.createdAt);
  const latestAppointmentConfirmationAgeMinutes = getMinutesSince(
    latestAppointmentConfirmation?.createdAt
  );
  const hasUnsavedBoardChanges =
    assignedTechnicianUserId !== (visit.assignedTechnicianUserId ?? "") ||
    scheduledStartAt !== toDispatchDateTimeInput(visit.scheduledStartAt, timezone) ||
    scheduledEndAt !== toDispatchDateTimeInput(visit.scheduledEndAt, timezone) ||
    arrivalWindowStartAt !== toDispatchDateTimeInput(visit.arrivalWindowStartAt, timezone) ||
    arrivalWindowEndAt !== toDispatchDateTimeInput(visit.arrivalWindowEndAt, timezone) ||
    priority !== visit.priority ||
    status !== visit.status;
  const minutesUntilPromise = getMinutesUntil(
    draftVisit.arrivalWindowStartAt ?? draftVisit.scheduledStartAt
  );
  const hasAppointmentWindow = Boolean(
    draftVisit.arrivalWindowStartAt ?? draftVisit.scheduledStartAt
  );
  const customerUpdatePrompt = hasUnsavedBoardChanges
    ? null
    : draftOperationalSignal.tone === "danger" &&
        Boolean(visit.assignedTechnicianUserId) &&
        (latestDispatchUpdateAgeMinutes === null || latestDispatchUpdateAgeMinutes > 30)
      ? {
          body:
            latestDispatchUpdateAgeMinutes === null
              ? "The stop is slipping and no outbound dispatch update is logged yet."
              : `The stop is slipping and the last outbound dispatch update was ${latestDispatchUpdateAgeMinutes} minutes ago.`,
          recommendedAction: isTechnicianTravelJobStatus(status) ? "en_route" : "dispatched",
          title: "Customer should be updated now",
          tone: "danger" as const
        }
      : isTechnicianTravelJobStatus(status) &&
          Boolean(visit.assignedTechnicianUserId) &&
          minutesUntilPromise !== null &&
          minutesUntilPromise <= 20 &&
          (latestDispatchUpdateAgeMinutes === null || latestDispatchUpdateAgeMinutes > 20)
        ? {
            body:
              latestDispatchUpdateAgeMinutes === null
                ? "Arrival is close and no outbound dispatch update has been sent yet."
                : `Arrival is close and the last dispatch update was ${latestDispatchUpdateAgeMinutes} minutes ago.`,
            recommendedAction: "en_route" as const,
            title: "Send an en-route update",
            tone: "warning" as const
          }
        : status === "scheduled" &&
            hasAppointmentWindow &&
            minutesUntilPromise !== null &&
            minutesUntilPromise <= 90 &&
            (latestAppointmentConfirmationAgeMinutes === null ||
              latestAppointmentConfirmationAgeMinutes > 12 * 60)
          ? {
              body:
                latestAppointmentConfirmationAgeMinutes === null
                  ? "This visit is approaching its promise window and no appointment confirmation is logged yet."
                  : `The last appointment confirmation was ${latestAppointmentConfirmationAgeMinutes} minutes ago and this visit is now close.`,
              recommendedAction: "appointment_confirmation" as const,
              title: "Confirm promised timing",
              tone: "warning" as const
            }
          : null;
  const canSendAppointmentConfirmation = hasAppointmentWindow && !hasUnsavedBoardChanges;
  const canSendDispatchUpdates = Boolean(visit.assignedTechnicianUserId) && !hasUnsavedBoardChanges;
  const preferredRecoveryLane =
    laneRecommendations.find((recommendation) => !recommendation.isCurrentLane) ?? laneRecommendations[0] ?? null;
  const recommendedRecoveryPlan =
    preferredRecoveryLane && !preferredRecoveryLane.isCurrentLane ? "best_lane" : "same_lane";
  const canRunDelayRecovery =
    !pending &&
    !pendingCommunication &&
    !pendingNote &&
    !validationError &&
    Boolean(scheduledStartAt || arrivalWindowStartAt);
  const canRunReassignRecovery =
    canRunDelayRecovery && Boolean(preferredRecoveryLane?.resource.technicianUserId);
  const effectiveRecoveryPlan =
    recoveryPlan === "best_lane" && !canRunReassignRecovery ? "same_lane" : recoveryPlan;
  const recoveryDelayValue = Number.parseInt(recoveryDelayMinutes, 10);
  const recoveryPrimaryLabel =
    effectiveRecoveryPlan === "defer_to_queue"
      ? "Defer to visits queue"
      : effectiveRecoveryPlan === "best_lane"
        ? "Notify, reset ETA, and reassign"
        : "Notify and reset ETA";
  const recoveryPlanCopy =
    effectiveRecoveryPlan === "defer_to_queue"
      ? "Remove this stop from the live lane and return it to Visits for re-planning."
      : effectiveRecoveryPlan === "best_lane"
        ? preferredRecoveryLane
          ? `Reset timing by ${recoveryDelayMinutes} minutes and move this stop to ${preferredRecoveryLane.resource.displayName}.`
          : "No alternate lane is available right now."
        : `Reset timing by ${recoveryDelayMinutes} minutes and keep this stop on the current lane.`;
  const canRunSelectedRecovery =
    effectiveRecoveryPlan === "defer_to_queue"
      ? !pending && !pendingCommunication && !pendingNote
      : canRunDelayRecovery && !(effectiveRecoveryPlan === "best_lane" && !canRunReassignRecovery);

  function markRecoveryResolved(input?: { copy?: string; title?: string }) {
    setRecoveryResolved(true);
    setRecoveryResolution({
      copy:
        input?.copy ??
        "Dispatch has acknowledged this stop and can keep monitoring it from the live board.",
      title: input?.title ?? "Recovery marked complete"
    });
  }

  function getRecoveryCommunicationInput():
    | {
        action: "appointment_confirmation";
        successMessage: string;
      }
    | {
        action: "dispatch_update";
        successMessage: string;
        updateType: "dispatched" | "en_route";
      }
    | null {
    if (customerUpdatePrompt?.recommendedAction === "appointment_confirmation") {
      return {
        action: "appointment_confirmation" as const,
        successMessage: "Recovery confirmation queued."
      };
    }

    if (
      customerUpdatePrompt?.recommendedAction === "dispatched" ||
      customerUpdatePrompt?.recommendedAction === "en_route"
    ) {
      return {
        action: "dispatch_update" as const,
        successMessage:
          customerUpdatePrompt.recommendedAction === "en_route"
            ? "Recovery en-route update queued."
            : "Recovery dispatched update queued.",
        updateType: customerUpdatePrompt.recommendedAction
      };
    }

    if (status === "scheduled" && scheduledStartAt) {
      return {
        action: "appointment_confirmation" as const,
        successMessage: "Recovery confirmation queued."
      };
    }

    if ((assignedTechnicianUserId || visit?.assignedTechnicianUserId) && status !== "new") {
      return {
        action: "dispatch_update" as const,
        successMessage: "Recovery status update queued.",
        updateType: "en_route" as const
      };
    }

    return null;
  }

  async function runRecoveryAction(input: {
    action: "defer_to_queue" | "notify_delay" | "notify_reassign";
    delayMinutes?: number;
    nextStatus?: JobStatus;
    reassignTechnicianUserId?: string | null;
    clearBoardPlacement?: boolean;
  }) {
    const nextScheduledStartAt =
      input.clearBoardPlacement
        ? ""
        : scheduledStartAt && input.delayMinutes
          ? shiftLocalDateTimeInput(scheduledStartAt, timezone, input.delayMinutes)
          : "";
    const nextScheduledEndAt =
      input.clearBoardPlacement
        ? ""
        : scheduledEndAt && input.delayMinutes
          ? shiftLocalDateTimeInput(scheduledEndAt, timezone, input.delayMinutes)
          : "";
    const nextArrivalWindowStartAt =
      input.clearBoardPlacement
        ? ""
        : arrivalWindowStartAt && input.delayMinutes
          ? shiftLocalDateTimeInput(arrivalWindowStartAt, timezone, input.delayMinutes)
          : nextScheduledStartAt;
    const nextArrivalWindowEndAt =
      input.clearBoardPlacement
        ? ""
        : arrivalWindowEndAt && input.delayMinutes
          ? shiftLocalDateTimeInput(arrivalWindowEndAt, timezone, input.delayMinutes)
          : nextScheduledEndAt;
    const nextAssignedTechnicianUserId =
      input.clearBoardPlacement
        ? null
        : input.reassignTechnicianUserId !== undefined
        ? input.reassignTechnicianUserId
        : assignedTechnicianUserId || null;
    const communicationInput = input.clearBoardPlacement ? null : getRecoveryCommunicationInput();

    if (!input.clearBoardPlacement && !nextScheduledStartAt && !nextArrivalWindowStartAt) {
      setCommunicationFeedback("Recovery move needs a scheduled time or promise window first.");
      return;
    }

    setCommunicationFeedback(null);
    setPendingRecovery(input.action);

    try {
      await onSave({
        arrivalWindowEndAt: nextArrivalWindowEndAt || null,
        arrivalWindowStartAt: nextArrivalWindowStartAt || null,
        assignedTechnicianUserId: nextAssignedTechnicianUserId,
        jobId,
        priority,
        scheduledEndAt: nextScheduledEndAt || null,
        scheduledStartAt: nextScheduledStartAt || null,
        status: input.nextStatus ?? status
      });

      setAssignedTechnicianUserId(nextAssignedTechnicianUserId ?? "");
      setScheduledStartAt(nextScheduledStartAt);
      setScheduledEndAt(nextScheduledEndAt);
      setArrivalWindowStartAt(nextArrivalWindowStartAt);
      setArrivalWindowEndAt(nextArrivalWindowEndAt);
      setStatus(input.nextStatus ?? status);
      setSnapshotRevision((current) => current + 1);

      if (communicationInput) {
        await sendCommunication(communicationInput);
      }

      if (input.clearBoardPlacement) {
        setCommunicationFeedback(
          "Stop deferred to Visits. Customer follow-up can continue from the queue."
        );
        markRecoveryResolved({
          copy: "The stop left the live lane and is back in Visits for re-planning.",
          title: "Deferred to visits queue"
        });
      } else {
        setCommunicationFeedback(
          communicationInput ? communicationInput.successMessage : "Recovery move saved to the board."
        );
        markRecoveryResolved({
          copy:
            input.action === "notify_reassign" && nextAssignedTechnicianUserId
              ? `Timing moved by ${input.delayMinutes} minutes and the stop was rerouted to the selected lane.`
              : `Timing moved by ${input.delayMinutes} minutes and the stop stayed on the active lane.`,
          title:
            input.action === "notify_reassign"
              ? "Recovered with reassignment"
              : "Recovered on current lane"
        });
      }
    } catch (error) {
      setCommunicationFeedback(
        error instanceof Error ? error.message : "Recovery action could not be completed."
      );
    } finally {
      setPendingRecovery(null);
    }
  }

  async function runRecoveryFlow() {
    if (effectiveRecoveryPlan === "defer_to_queue") {
      await runRecoveryAction({
        action: "defer_to_queue",
        clearBoardPlacement: true,
        nextStatus: "new"
      });
      return;
    }

    if (!Number.isFinite(recoveryDelayValue) || recoveryDelayValue <= 0) {
      setCommunicationFeedback("Recovery timing must be set before this move can run.");
      return;
    }

    if (effectiveRecoveryPlan === "best_lane") {
      await runRecoveryAction({
        action: "notify_reassign",
        delayMinutes: recoveryDelayValue,
        reassignTechnicianUserId: preferredRecoveryLane?.resource.technicianUserId ?? null
      });
      return;
    }

    await runRecoveryAction({
      action: "notify_delay",
      delayMinutes: recoveryDelayValue
    });
  }

  async function sendCommunication(input: {
    action:
      | "appointment_confirmation"
      | "dispatch_update"
      | "estimate_notification"
      | FollowUpCommunicationAction
      | "invoice_notification"
      | "payment_reminder";
    successMessage: string;
    updateType?: "dispatched" | "en_route";
  }) {
    setCommunicationFeedback(null);
    setPendingCommunication(
      input.action === "dispatch_update" ? input.updateType ?? null : input.action
    );

    try {
      const response = await fetch(`/api/internal/visits/${jobId}/communications`, {
        body: JSON.stringify(
          input.action === "dispatch_update"
            ? { action: "dispatch_update", updateType: input.updateType }
            : { action: input.action }
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Action could not be queued.");
      }

      setCommunicationFeedback(input.successMessage);
      setSnapshotRevision((current) => current + 1);
    } catch (error) {
      setCommunicationFeedback(
        error instanceof Error ? error.message : "Action could not be queued."
      );
    } finally {
      setPendingCommunication(null);
    }
  }

  async function saveInternalNote() {
    const trimmedBody = noteBody.trim();

    if (!trimmedBody) {
      setCommunicationFeedback("Note body is required.");
      return;
    }

    setCommunicationFeedback(null);
    setPendingNote(true);

    try {
      const response = await fetch("/api/internal/visits/workboard", {
        body: JSON.stringify({
          action: "note",
          body: trimmedBody,
          isInternal: true,
          jobId
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Note could not be saved.");
      }

      setNoteBody("");
      setCommunicationFeedback("Internal note saved.");
      setSnapshotRevision((current) => current + 1);
    } catch (error) {
      setCommunicationFeedback(error instanceof Error ? error.message : "Note could not be saved.");
    } finally {
      setPendingNote(false);
    }
  }

  return (
    <aside className="dispatch-quick-edit">
      <div className="dispatch-quick-edit__header">
        <div className="dispatch-quick-edit__header-copy">
          <p className="dispatch-quick-edit__eyebrow">Visit intervention</p>
          <h3 className="dispatch-quick-edit__title">{visit.title}</h3>
          <p className="dispatch-quick-edit__subline">
            {visit.customerDisplayName} · {visit.vehicleDisplayName} · recover timing, trust, and release without leaving dispatch.
          </p>
        </div>
        <Button onClick={onClose} size="sm" tone="tertiary" type="button">
          Close
        </Button>
      </div>

      <div className="dispatch-quick-edit__summary">
        <StatusBadge status={status} />
        <PriorityBadge value={priority} />
        <Badge tone={getVisitWorkflowTone(workflowState)}>{getVisitWorkflowLabel(workflowState)}</Badge>
      </div>

      <div className="dispatch-quick-edit__thread-links">
        <div className="ui-button-grid">
          <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitWorkspaceHref}>
            Open visit thread
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={customerWorkspaceHref}>
            Open customer thread
          </Link>
          {siteThreadHref ? (
            <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={siteThreadHref}>
              Open site thread
            </Link>
          ) : null}
        </div>
        <span className="dispatch-quick-edit__thread-support">
          Carry one service thread, one site thread, and one continuity signal while recovery stays inside Dispatch.
        </span>
      </div>

      <div className="dispatch-quick-edit__hero">
        <div className="dispatch-quick-edit__hero-strip">
          <div className="dispatch-quick-edit__hero-callout dispatch-quick-edit__hero-callout--accent">
            <span className="dispatch-quick-edit__hero-callout-label">Next intervention</span>
            <strong className="dispatch-quick-edit__hero-callout-value">{nextMove}</strong>
          </div>

          <div
            className={`dispatch-quick-edit__hero-callout dispatch-quick-edit__hero-callout--${boardStateTone}`}
          >
            <span className="dispatch-quick-edit__hero-callout-label">Lane pressure</span>
            <strong className="dispatch-quick-edit__hero-callout-value">{boardStateLabel}</strong>
          </div>
        </div>

        <div className="dispatch-quick-edit__hero-grid">
          <div className="dispatch-quick-edit__hero-item">
            <span className="dispatch-quick-edit__hero-label">Live slot</span>
            <strong className="dispatch-quick-edit__hero-value">{scheduleSnapshot}</strong>
          </div>

          <div className="dispatch-quick-edit__hero-item">
            <span className="dispatch-quick-edit__hero-label">Lane owner</span>
            <strong className="dispatch-quick-edit__hero-value">{assignedTechnicianLabel}</strong>
          </div>
        </div>
      </div>

      {validationError ? (
        <Callout tone="danger" title="Review the draft">
          {validationError}
        </Callout>
      ) : draftConflictMessage ? (
        <Callout tone="warning" title="Scheduling risk">
          {draftConflictMessage}
        </Callout>
      ) : null}

      {snapshotError ? (
        <Callout tone="warning" title="Visit context unavailable">
          {snapshotError}
        </Callout>
      ) : null}

      {draftOperationalSignal.tone === "danger" ? (
        <Callout tone="danger" title="Intervention prompt">
          The promised timing has already slipped. Send a customer update now or reset the timing before this stop falls further behind.
        </Callout>
      ) : draftOperationalSignal.tone === "warning" ? (
        <Callout tone="warning" title="Watch timing">
          This stop is close enough to its promise window that the next move should be explicit: confirm lane timing, send an update, or tighten the schedule.
        </Callout>
      ) : null}

      {communicationFeedback ? (
        <Callout
          tone={pendingCommunication ? "warning" : communicationFeedback.includes("could not") ? "danger" : "success"}
          title={communicationFeedback.includes("could not") ? "Action needs attention" : "Action queued"}
        >
          {communicationFeedback}
        </Callout>
      ) : null}

      <div className="dispatch-quick-edit__body">
        {snapshot ? (
          <section className="dispatch-quick-edit__section">
            <div className="dispatch-quick-edit__section-header">
              <div className="dispatch-quick-edit__section-copy">
                <h4>Continuity, trust, and release runway</h4>
                <p>Work from the same promise, route, site, and release posture the carried case file already exposes.</p>
              </div>
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Promise confidence</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.continuity.promiseConfidence.label} ·{" "}
                  {snapshot.continuity.promiseConfidence.confidencePercent}%
                </strong>
                <span>{snapshot.continuity.promiseConfidence.copy}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Route confidence</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.continuity.routeConfidence.label} ·{" "}
                  {snapshot.continuity.routeConfidence.confidencePercent}%
                </strong>
                <span>{snapshot.continuity.routeConfidence.copy}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Release runway</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.continuity.releaseRunway.label}
                </strong>
                <span>{snapshot.continuity.releaseRunway.copy}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Site thread</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.continuity.serviceSiteThread.siteLabel}
                </strong>
                <span>{snapshot.continuity.serviceSiteThread.copy}</span>
              </div>
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Timing owner</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.promiseSummary.confidencePercent}% · {snapshot.promiseSummary.owner}
                </strong>
                <span>{snapshot.promiseSummary.confidenceLabel}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Customer timing</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.promiseSummary.nextUpdateLabel}
                </strong>
                <span>{snapshot.promiseSummary.lastCustomerUpdateLabel}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Trust state</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.trustSummary.score}% · {snapshot.trustSummary.owner}
                </strong>
                <span>{snapshot.trustSummary.nextActionLabel}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Readiness</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.readinessSummary.score}% ready
                </strong>
                <span>
                  {snapshot.readinessSummary.readyCount}/{snapshot.readinessSummary.totalCount} checks clear
                </span>
              </div>
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              {snapshot.readinessSummary.items.map((item) => (
                <div className="dispatch-quick-edit__hero-item" key={item.label}>
                  <span className="dispatch-quick-edit__hero-label">{item.label}</span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {item.ready ? "Ready" : "Needs attention"}
                  </strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Promise owner</span>
                <strong className="dispatch-quick-edit__hero-value">{snapshot.promiseSummary.owner}</strong>
                <span>{snapshot.promiseSummary.label}</span>
              </div>
              {estimateExceptionOwnership ? (
                <div className="dispatch-quick-edit__hero-item">
                  <span className="dispatch-quick-edit__hero-label">Approval owner</span>
                  <strong className="dispatch-quick-edit__hero-value">{estimateExceptionOwnership.owner}</strong>
                  <span>{estimateExceptionOwnership.label}</span>
                </div>
              ) : null}
              {collectionsExceptionOwnership ? (
                <div className="dispatch-quick-edit__hero-item">
                  <span className="dispatch-quick-edit__hero-label">Closeout owner</span>
                  <strong className="dispatch-quick-edit__hero-value">{collectionsExceptionOwnership.owner}</strong>
                  <span>{collectionsExceptionOwnership.label}</span>
                </div>
              ) : null}
              {snapshot.followUpSummary.hasChainContext ? (
                <div className="dispatch-quick-edit__hero-item">
                  <span className="dispatch-quick-edit__hero-label">Follow-up owner</span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {snapshot.followUpSummary.recoveryOwner}
                  </strong>
                  <span>{snapshot.followUpSummary.label}</span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {snapshot?.followUpSummary.hasChainContext ? (
          <section className="dispatch-quick-edit__section dispatch-quick-edit__section--secondary">
            <div className="dispatch-quick-edit__section-header">
              <div className="dispatch-quick-edit__section-copy">
                <h4>Follow-up lifecycle</h4>
                <p>Keep return-work chains visible from dispatch instead of treating them like disconnected stops.</p>
              </div>
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Follow-up state</span>
                <strong className="dispatch-quick-edit__hero-value">{snapshot.followUpSummary.label}</strong>
                <span>{snapshot.followUpSummary.copy}</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Recovery owner</span>
                <strong className="dispatch-quick-edit__hero-value">{snapshot.followUpSummary.recoveryOwner}</strong>
                <span>This role should carry the next return-work recovery move.</span>
              </div>
            </div>
            <div className="dispatch-quick-edit__hero-grid">
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Active thread</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.followUpSummary.activeRelatedVisitCount} open related visit
                  {snapshot.followUpSummary.activeRelatedVisitCount === 1 ? "" : "s"}
                </strong>
                <span>Keep unresolved same-vehicle work grouped before routing another stop.</span>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Customer status</span>
                <strong className="dispatch-quick-edit__hero-value">
                  {snapshot.followUpSummary.customerStatus
                    ? formatDesignLabel(snapshot.followUpSummary.customerStatus)
                    : "No update prompt"}
                </strong>
                <span>
                  {snapshot.followUpSummary.customerStatusCopy ??
                    "No extra customer-facing follow-up update is recommended right now."}
                </span>
              </div>
            </div>
            {snapshot.followUpSummary.staleFollowUp ? (
              <Callout tone="warning" title="Return-work recovery is slipping">
                {snapshot.followUpSummary.staleCopy}
              </Callout>
            ) : null}
            {snapshot.followUpSummary.needsSourceCloseout ? (
              <Callout tone="warning" title="Source closeout still open">
                A return visit is already linked, but the source visit still needs its own closeout motion.
              </Callout>
            ) : null}
            <div className="ui-button-grid">
              {sourceVisitWorkspaceHref ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={sourceVisitWorkspaceHref}
                >
                  Open source visit
                </Link>
              ) : null}
              {childVisitWorkspaceHref ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={childVisitWorkspaceHref}
                >
                  Open return visit
                </Link>
              ) : null}
              {snapshot.followUpSummary.needsSourceCloseout ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={
                    snapshot.invoice
                      ? buildVisitInvoiceHref(jobId, {
                          returnLabel: returnToLabel,
                          returnTo: returnToHref
                        })
                      : visitWorkspaceHref
                  }
                >
                  Finish source closeout
                </Link>
              ) : null}
              <Link
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                href={returnVisitQueueHref}
              >
                Open return-visit queue
              </Link>
              {snapshot.followUpSummary.staleFollowUp ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={staleReturnVisitQueueHref}
                >
                  Open stale return queue
                </Link>
              ) : null}
            </div>
            {followUpCommunication &&
            ((followUpCommunication.action === "follow_up_awaiting_parts" &&
              !hasUnsavedBoardChanges) ||
              ((followUpCommunication.action === "follow_up_booked" ||
                followUpCommunication.action === "follow_up_rescheduled") &&
                canSendAppointmentConfirmation) ||
              (followUpCommunication.action === "follow_up_status_update" &&
                canSendDispatchUpdates)) ? (
              <Button
                disabled={Boolean(pendingCommunication)}
                loading={pendingCommunication === followUpCommunication.action}
                onClick={() =>
                  void sendCommunication({
                    action: followUpCommunication.action,
                    successMessage: followUpCommunication.successMessage
                  })
                }
                size="sm"
                tone="secondary"
                type="button"
              >
                {followUpCommunication.label}
              </Button>
            ) : null}
          </section>
        ) : null}

        <section className="dispatch-quick-edit__section">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Commercial state</h4>
              <p>Keep estimate, invoice, field, and communication state visible before moving this stop again.</p>
            </div>
          </div>
          <div className="dispatch-quick-edit__hero-grid">
            <div className="dispatch-quick-edit__hero-item">
              <span className="dispatch-quick-edit__hero-label">{estimateSummary.title}</span>
              <strong className="dispatch-quick-edit__hero-value">
                {snapshotLoading ? "Loading..." : estimateSummary.value}
              </strong>
              <span>{estimateSummary.copy}</span>
            </div>
            <div className="dispatch-quick-edit__hero-item">
              <span className="dispatch-quick-edit__hero-label">{invoiceSummary.title}</span>
              <strong className="dispatch-quick-edit__hero-value">
                {snapshotLoading ? "Loading..." : invoiceSummary.value}
              </strong>
              <span>{invoiceSummary.copy}</span>
            </div>
            <div className="dispatch-quick-edit__hero-item">
              <span className="dispatch-quick-edit__hero-label">{fieldSummary.title}</span>
              <strong className="dispatch-quick-edit__hero-value">
                {snapshotLoading ? "Loading..." : fieldSummary.value}
              </strong>
              <span>{fieldSummary.copy}</span>
            </div>
            <div className="dispatch-quick-edit__hero-item">
              <span className="dispatch-quick-edit__hero-label">{communicationSummary.title}</span>
              <strong className="dispatch-quick-edit__hero-value">
                {snapshotLoading ? "Loading..." : communicationSummary.value}
              </strong>
              <span>{communicationSummary.copy}</span>
            </div>
          </div>
          <div className="ui-button-grid">
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={buildVisitEstimateHref(jobId, {
                returnLabel: returnToLabel,
                returnTo: returnToHref
              })}
            >
              {snapshot?.estimate?.status === "draft" ? "Open builder" : "Open estimate"}
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={buildVisitInvoiceHref(jobId, {
                returnLabel: returnToLabel,
                returnTo: returnToHref
              })}
            >
              {snapshot?.invoice ? "Open invoice" : "Start invoice"}
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={buildVisitInspectionHref(jobId, {
                returnLabel: returnToLabel,
                returnTo: returnToHref
              })}
            >
              Open inspection
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={buildVisitPhotosHref(jobId, {
                returnLabel: returnToLabel,
                returnTo: returnToHref
              })}
            >
              Open photos
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={`/dashboard/visits/new?customerId=${visit.customerId}&vehicleId=${visit.vehicleId}&followUpJobId=${jobId}`}
            >
              Create return visit
            </Link>
            <Link
              className={buttonClassName({ size: "sm", tone: "ghost" })}
              href={`/dashboard/customers/${visit.customerId}/vehicles/${visit.vehicleId}`}
            >
              Open vehicle history
            </Link>
          </div>
          {canSendReminder ? (
            <p className="dispatch-quick-edit__section-copy">
              Payment follow-through is still open on this visit. Finance can send a reminder without leaving the collections desk.
            </p>
          ) : null}
        </section>

        <section className="dispatch-quick-edit__section dispatch-quick-edit__section--secondary">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Next move</h4>
              <p>Push the next estimate or invoice action without leaving the board.</p>
            </div>
          </div>
          <div className="ui-button-grid">
            {canSendEstimateNotification ? (
              <>
                {snapshot?.estimateLink ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={snapshot.estimateLink.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open estimate link
                  </a>
                ) : null}
                <Button
                  disabled={Boolean(pendingCommunication)}
                  loading={pendingCommunication === "estimate_notification"}
                  onClick={() =>
                    void sendCommunication({
                      action: "estimate_notification",
                      successMessage: "Estimate notification queued."
                    })
                  }
                  size="sm"
                  tone="secondary"
                  type="button"
                >
                  Send estimate notification
                </Button>
              </>
            ) : null}
            {canSendInvoiceNotification ? (
              <>
                {snapshot?.invoiceLink ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={snapshot.invoiceLink.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open invoice link
                  </a>
                ) : null}
                <Button
                  disabled={Boolean(pendingCommunication)}
                  loading={pendingCommunication === "invoice_notification"}
                  onClick={() =>
                    void sendCommunication({
                      action: "invoice_notification",
                      successMessage: "Invoice notification queued."
                    })
                  }
                  size="sm"
                  tone="secondary"
                  type="button"
                >
                  Send invoice notification
                </Button>
              </>
            ) : null}
            {canSendReminder ? (
              <Button
                disabled={Boolean(pendingCommunication)}
                loading={pendingCommunication === "payment_reminder"}
                onClick={() =>
                  void sendCommunication({
                    action: "payment_reminder",
                    successMessage: "Payment reminder queued."
                  })
                }
                size="sm"
                tone="secondary"
                type="button"
              >
                Send payment reminder
              </Button>
            ) : null}
          </div>
          {!canSendEstimateNotification && !canSendInvoiceNotification && !canSendReminder ? (
            <p className="dispatch-quick-edit__section-copy">
              Estimate notifications appear once the estimate has been sent. Invoice nudges appear after billing has been issued.
            </p>
          ) : null}
        </section>

        <section className="dispatch-quick-edit__section dispatch-quick-edit__section--secondary">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Recovery actions</h4>
              <p>Recover a slipping promise without leaving dispatch.</p>
            </div>
          </div>
          {draftOperationalSignal.tone === "danger" ? (
            <>
              <Callout tone="danger" title="Promise recovery should happen now">
                This stop is already at risk. Reset the timing, route it to a better lane if needed,
                and push the customer update in one move.
              </Callout>
              {recoveryResolved && recoveryResolution ? (
                <Callout tone="success" title={recoveryResolution.title}>
                  {recoveryResolution.copy}
                </Callout>
              ) : null}
              <div className="dispatch-quick-edit__hero-grid">
                <div className="dispatch-quick-edit__hero-item">
                  <span className="dispatch-quick-edit__hero-label">Recommended move</span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {effectiveRecoveryPlan === "defer_to_queue"
                      ? "Defer to visits queue"
                      : recommendedRecoveryPlan === "best_lane" && preferredRecoveryLane
                      ? `Route to ${preferredRecoveryLane.resource.displayName}`
                      : scheduledStartAt || arrivalWindowStartAt
                        ? "Keep same lane"
                        : "Needs timing first"}
                  </strong>
                  <span>
                    {recommendedRecoveryPlan === "best_lane" && preferredRecoveryLane
                      ? "Reassign to the best-fit lane, shift timing forward, and send the customer update."
                      : "Keep the current lane, shift timing forward, and send the customer update."}
                  </span>
                </div>
                <div className="dispatch-quick-edit__hero-item">
                  <span className="dispatch-quick-edit__hero-label">Customer update</span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {customerUpdatePrompt?.title ?? "Recovery update ready"}
                  </strong>
                  <span>
                    {customerUpdatePrompt?.body ??
                      "The right customer-facing update will be sent when the recovery move is saved."}
                  </span>
                </div>
              </div>
              <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--double">
                <label className="dispatch-quick-edit__field">
                  <span>Recovery plan</span>
                  <Select
                    onChange={(event) =>
                      setRecoveryPlan(
                        event.currentTarget.value as "best_lane" | "defer_to_queue" | "same_lane"
                      )
                    }
                    value={effectiveRecoveryPlan}
                  >
                    <option value="same_lane">Keep current lane</option>
                    <option value="best_lane" disabled={!canRunReassignRecovery}>
                      {preferredRecoveryLane
                        ? `Reassign to ${preferredRecoveryLane.resource.displayName}`
                        : "Reassign to best-fit lane"}
                    </option>
                    <option value="defer_to_queue">Defer to visits queue</option>
                  </Select>
                </label>
                <label className="dispatch-quick-edit__field">
                  <span>ETA reset</span>
                  <Select
                    onChange={(event) =>
                      setRecoveryDelayMinutes(event.currentTarget.value as "30" | "45" | "60")
                    }
                    disabled={effectiveRecoveryPlan === "defer_to_queue"}
                    value={recoveryDelayMinutes}
                  >
                    <option value="30">Push 30 minutes</option>
                    <option value="45">Push 45 minutes</option>
                    <option value="60">Push 60 minutes</option>
                  </Select>
                </label>
              </div>
              <div className="dispatch-quick-edit__hero-item">
                <span className="dispatch-quick-edit__hero-label">Recovery preview</span>
                <strong className="dispatch-quick-edit__hero-value">{recoveryPrimaryLabel}</strong>
                <span>{recoveryPlanCopy}</span>
              </div>
              <div className="ui-button-grid">
                <Button
                  disabled={!canRunSelectedRecovery}
                  loading={pendingRecovery !== null}
                  onClick={() => void runRecoveryFlow()}
                  size="sm"
                  tone="primary"
                  type="button"
                >
                  {recoveryPrimaryLabel}
                </Button>
                <Button
                  disabled={pendingRecovery !== null}
                  onClick={() =>
                    markRecoveryResolved({
                      copy: "Dispatch acknowledged this stop and will keep monitoring it from the live board.",
                      title: "Recovery marked complete"
                    })
                  }
                  size="sm"
                  tone="secondary"
                  type="button"
                >
                  Mark recovered
                </Button>
                {recoveryResolved ? (
                  <Button
                    disabled={pendingRecovery !== null}
                    onClick={() => {
                      setRecoveryResolved(false);
                      setRecoveryResolution(null);
                    }}
                    size="sm"
                    tone="ghost"
                    type="button"
                  >
                    Reopen recovery
                  </Button>
                ) : null}
                {effectiveRecoveryPlan === "best_lane" && preferredRecoveryLane ? (
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={promiseRiskQueueHref}
                  >
                    Open promise risk queue
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
          {!draftOperationalSignal.tone || draftOperationalSignal.tone !== "danger" ? (
            <p className="dispatch-quick-edit__section-copy">
              Recovery planning appears when the selected stop is already slipping against its promise.
            </p>
          ) : null}
        </section>

        <section className="dispatch-quick-edit__section dispatch-quick-edit__section--secondary">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Customer updates</h4>
              <p>Use the same outbound controls available in the visits queue.</p>
            </div>
          </div>
          {customerUpdatePrompt ? (
            <Callout tone={customerUpdatePrompt.tone} title={customerUpdatePrompt.title}>
              {customerUpdatePrompt.body}
            </Callout>
          ) : null}
          <div className="ui-button-grid">
            <Button
              disabled={!canSendAppointmentConfirmation || Boolean(pendingCommunication)}
              loading={pendingCommunication === "appointment_confirmation"}
              onClick={() =>
                void sendCommunication({
                  action: "appointment_confirmation",
                  successMessage: "Appointment confirmation queued."
                })
              }
              size="sm"
              tone={
                customerUpdatePrompt?.recommendedAction === "appointment_confirmation"
                  ? "primary"
                  : "secondary"
              }
              type="button"
            >
              Send appointment confirmation
            </Button>
            <Button
              disabled={!canSendDispatchUpdates || Boolean(pendingCommunication)}
              loading={pendingCommunication === "dispatched"}
              onClick={() =>
                void sendCommunication({
                  action: "dispatch_update",
                  successMessage: "Dispatched update queued.",
                  updateType: "dispatched"
                })
              }
              size="sm"
              tone={
                customerUpdatePrompt?.recommendedAction === "dispatched"
                  ? "primary"
                  : "secondary"
              }
              type="button"
            >
              Send dispatched update
            </Button>
            <Button
              disabled={!canSendDispatchUpdates || Boolean(pendingCommunication)}
              loading={pendingCommunication === "en_route"}
              onClick={() =>
                void sendCommunication({
                  action: "dispatch_update",
                  successMessage: "En-route update queued.",
                  updateType: "en_route"
                })
              }
              size="sm"
              tone={
                customerUpdatePrompt?.recommendedAction === "en_route"
                  ? "primary"
                  : "secondary"
              }
              type="button"
            >
              Send en-route update
            </Button>
          </div>
          {hasUnsavedBoardChanges ? (
            <p className="dispatch-quick-edit__section-copy">
              Save lane edits before sending customer updates so the message reflects the current board state.
            </p>
          ) : !hasAppointmentWindow && !visit.assignedTechnicianUserId ? (
            <p className="dispatch-quick-edit__section-copy">
              Save a promise window to send an appointment confirmation, and assign a technician before sending dispatch updates.
            </p>
          ) : !hasAppointmentWindow ? (
            <p className="dispatch-quick-edit__section-copy">
              Save a promise window before sending an appointment confirmation.
            </p>
          ) : !visit.assignedTechnicianUserId ? (
            <p className="dispatch-quick-edit__section-copy">
              Assign a technician before sending dispatch updates.
            </p>
          ) : null}
        </section>

        <section className="dispatch-quick-edit__section">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Recent activity</h4>
              <p>Check the latest outbound messages before calling or sending another update.</p>
            </div>
          </div>
          {snapshot?.latestCommunications.length ? (
            <div className="dispatch-quick-edit__hero-grid">
              {snapshot.latestCommunications.map((entry) => (
                <div className="dispatch-quick-edit__hero-item" key={entry.id}>
                  <span className="dispatch-quick-edit__hero-label">
                    {formatDateTime(entry.createdAt, {
                      fallback: "Saved recently",
                      timeZone: timezone
                    })}
                  </span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {formatDesignStatusLabel(entry.communicationType)}
                  </strong>
                  <span>
                    {formatDesignStatusLabel(entry.status)} via {entry.channel.toUpperCase()} to{" "}
                    {entry.recipientName ?? entry.recipientEmail ?? entry.recipientPhone ?? "customer"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dispatch-quick-edit__section-copy">
              No customer-facing updates have been logged for this visit yet.
            </p>
          )}
        </section>

        <section className="dispatch-quick-edit__section">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Recent status movement</h4>
              <p>Keep the latest handoffs visible from dispatch before reopening the full visit history.</p>
            </div>
          </div>
          {snapshot?.latestStatusHistory.length ? (
            <div className="dispatch-quick-edit__hero-grid">
              {snapshot.latestStatusHistory.map((entry) => (
                <div className="dispatch-quick-edit__hero-item" key={entry.id}>
                  <span className="dispatch-quick-edit__hero-label">
                    {formatDateTime(entry.createdAt, {
                      fallback: "Saved recently",
                      timeZone: timezone
                    })}
                  </span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {entry.fromStatus
                      ? `${formatDesignStatusLabel(entry.fromStatus)} -> ${formatDesignStatusLabel(entry.toStatus)}`
                      : `Created in ${formatDesignStatusLabel(entry.toStatus)}`}
                  </strong>
                  <span>{entry.reason ?? "No handoff reason added."}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dispatch-quick-edit__section-copy">
              No status changes have been logged for this visit yet.
            </p>
          )}
        </section>

        <section className="dispatch-quick-edit__section">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Internal notes</h4>
              <p>Capture the same visit notes without leaving the live board.</p>
            </div>
          </div>
          <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--single">
            <label className="dispatch-quick-edit__field">
              <span>Note</span>
              <textarea
                className="ui-textarea"
                onChange={(event) => setNoteBody(event.currentTarget.value)}
                placeholder="Add an internal note for dispatch, service, or follow-through."
                rows={4}
                value={noteBody}
              />
            </label>
          </div>
          <div className="ui-button-grid">
            <Button
              disabled={!noteBody.trim() || pendingNote}
              loading={pendingNote}
              onClick={() => void saveInternalNote()}
              size="sm"
              tone="secondary"
              type="button"
            >
              Save internal note
            </Button>
          </div>
          {snapshot?.latestNotes.length ? (
            <div className="dispatch-quick-edit__hero-grid">
              {snapshot.latestNotes.map((note) => (
                <div className="dispatch-quick-edit__hero-item" key={note.id}>
                  <span className="dispatch-quick-edit__hero-label">
                    {formatDateTime(note.createdAt, {
                      fallback: "Saved recently",
                      timeZone: timezone
                    })}
                  </span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {note.isInternal ? "Internal note" : "Shared note"}
                  </strong>
                  <span>{note.body}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dispatch-quick-edit__section-copy">
              No internal notes have been captured for this visit yet.
            </p>
          )}
        </section>

        <section className="dispatch-quick-edit__section">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Lane dispatch</h4>
              <p>Assign lane owner, workflow state, and urgency.</p>
            </div>
          </div>
          <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--triple">
            <label className="dispatch-quick-edit__field">
              <span>Lane owner</span>
              <Select
                onChange={(event) => setAssignedTechnicianUserId(event.currentTarget.value)}
                value={assignedTechnicianUserId}
              >
                <option value="">Unassigned</option>
                {technicians.map((technician) => (
                  <option key={technician.userId} value={technician.userId}>
                    {technician.displayName}
                  </option>
                ))}
              </Select>
            </label>

            <label className="dispatch-quick-edit__field">
              <span>Status</span>
              <Select onChange={(event) => setStatus(event.currentTarget.value as JobStatus)} value={status}>
                {dispatchStatuses.map((value) => (
                  <option key={value} value={value}>
                    {formatDesignLabel(value)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="dispatch-quick-edit__field">
              <span>Priority</span>
              <Select onChange={(event) => setPriority(event.currentTarget.value as JobPriority)} value={priority}>
                {dispatchPriorities.map((value) => (
                  <option key={value} value={value}>
                    {formatDesignLabel(value)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {laneRecommendations.length ? (
            <div className="dispatch-quick-edit__hero-grid">
              {laneRecommendations.map((recommendation) => (
                <div
                  className="dispatch-quick-edit__hero-item"
                  key={recommendation.resource.technicianUserId}
                >
                  <span className="dispatch-quick-edit__hero-label">Suggested lane</span>
                  <strong className="dispatch-quick-edit__hero-value">
                    {recommendation.resource.displayName}
                  </strong>
                  <span>
                    {getLaneRecommendationCopy({
                      distanceMiles: recommendation.fitSignal?.distanceMiles ?? null,
                      availabilityBlockCount: recommendation.resource.availabilityBlockCount,
                      backlogCount: recommendation.resource.backlogCount,
                      conflictCount: recommendation.resource.conflictCount,
                      continuityCustomerCount: recommendation.continuityCustomerCount,
                      continuityVehicleCount: recommendation.continuityVehicleCount,
                      gapAfterMinutes: recommendation.laneWindowFit.gapAfterMinutes,
                      gapBeforeMinutes: recommendation.laneWindowFit.gapBeforeMinutes,
                      hasLiveVisit: recommendation.hasLiveVisit,
                      isCurrentLane: recommendation.isCurrentLane,
                      isTightAfter: recommendation.laneWindowFit.isTightAfter,
                      isTightBefore: recommendation.laneWindowFit.isTightBefore,
                      nextVisitTitle: recommendation.laneWindowFit.nextJob?.title ?? null,
                      previousVisitTitle: recommendation.laneWindowFit.previousJob?.title ?? null,
                      repeatCustomerVisits: recommendation.fitSignal?.repeatCustomerVisits ?? 0,
                      repeatVehicleVisits: recommendation.fitSignal?.repeatVehicleVisits ?? 0,
                      scheduledCount: recommendation.resource.scheduledCount,
                      specialtyMatches: recommendation.fitSignal?.specialtyMatches ?? [],
                      yearsExperience: recommendation.fitSignal?.yearsExperience ?? null
                    })}
                  </span>
                  <div className="ui-button-grid">
                    <Button
                      disabled={
                        pending ||
                        recommendation.resource.technicianUserId === assignedTechnicianUserId
                      }
                      onClick={() =>
                        setAssignedTechnicianUserId(recommendation.resource.technicianUserId)
                      }
                      size="sm"
                      tone={
                        recommendation.resource.technicianUserId === assignedTechnicianUserId
                          ? "secondary"
                          : "tertiary"
                      }
                      type="button"
                    >
                      {recommendation.resource.technicianUserId === assignedTechnicianUserId
                        ? "Assigned lane"
                        : "Use lane"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="dispatch-quick-edit__section dispatch-quick-edit__section--secondary">
          <div className="dispatch-quick-edit__section-header">
            <div className="dispatch-quick-edit__section-copy">
              <h4>Slot timing</h4>
              <p>Set the board slot and promise window.</p>
            </div>
          </div>
          <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--single">
            <label className="dispatch-quick-edit__field">
              <span>Scheduled start</span>
              <Input
                onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
                type="datetime-local"
                value={scheduledStartAt}
              />
            </label>
            <label className="dispatch-quick-edit__field">
              <span>Scheduled end</span>
              <Input
                onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
                type="datetime-local"
                value={scheduledEndAt}
              />
            </label>
          </div>

          <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--single">
            <label className="dispatch-quick-edit__field">
              <span>Arrival window start</span>
              <Input
                onChange={(event) => setArrivalWindowStartAt(event.currentTarget.value)}
                type="datetime-local"
                value={arrivalWindowStartAt}
              />
            </label>
            <label className="dispatch-quick-edit__field">
              <span>Arrival window end</span>
              <Input
                onChange={(event) => setArrivalWindowEndAt(event.currentTarget.value)}
                type="datetime-local"
                value={arrivalWindowEndAt}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="dispatch-quick-edit__footer">
        <p className="dispatch-quick-edit__footer-copy">
          Saves lane load and recalculates conflicts immediately.
        </p>
        <Button
          disabled={Boolean(validationError)}
          loading={pending}
          onClick={() =>
            void onSave({
              arrivalWindowEndAt: arrivalWindowEndAt || null,
              arrivalWindowStartAt: arrivalWindowStartAt || null,
              assignedTechnicianUserId: assignedTechnicianUserId || null,
              jobId,
              priority,
              scheduledEndAt: scheduledEndAt || null,
              scheduledStartAt: scheduledStartAt || null,
              status
            })
          }
          type="button"
        >
          Save to board
        </Button>
      </div>
    </aside>
  );
}
