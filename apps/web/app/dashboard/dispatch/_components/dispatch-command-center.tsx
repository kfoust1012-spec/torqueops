"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getDispatchLocalDate,
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus,
  toDispatchDateTimeInput,
  zonedLocalDateTimeToUtc
} from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  CreateTechnicianAvailabilityBlockInput,
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarData,
  DispatchCalendarConflict,
  DispatchCalendarScope,
  DispatchCalendarView,
  DispatchBoardJobItem,
  JobStatus,
  DispatchResourcePreference,
  DispatchSavedView,
  TechnicianPaymentResolutionDisposition,
  MoveDispatchJobInput,
  QuickEditDispatchJobInput,
  ResizeDispatchJobInput,
  UpdateTechnicianAvailabilityBlockInput
} from "@mobile-mechanic/types";
import { Badge, Button, Callout, Input, Select, buttonClassName, cx, type ButtonTone } from "../../../../components/ui";
import { DeskSavedSlices } from "../../../../components/ui/desk-saved-slices";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import {
  buildDispatchOnBoardFollowThroughItems,
  getDispatchOnBoardFollowThroughActionLabel,
  getDispatchLaneFollowThroughPressureScore,
  needsDispatchPromiseIntervention,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "../../../../lib/dispatch/follow-through";
import { getDispatchConflictSummary } from "../../../../lib/dispatch/service";
import {
  emitHotThreadTargetEvent,
  hotThreadTargetEventName,
  pinnedHotThreadStorageKey,
  readPinnedHotThread,
  type HotThreadTargetEventDetail
} from "../../../../lib/hot-thread/shared";
import type { RouteConfidenceSnapshot } from "../../../../lib/service-thread/continuity";
import {
  buildVisitPartsHref,
  buildVisitThreadHref
} from "../../../../lib/visits/workspace";
import {
  getDispatchQueueLabel,
  getDispatchQueueState,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone
} from "../../../../lib/jobs/workflow";
import {
  type OperationalFocusAction,
  type OperationalFocusBadge,
  type OperationalFocusItem
} from "../../_components/operational-focus-panel";

import { buildDispatchCalendarHref, shiftDispatchCalendarHref } from "../calendar-query";
import { buildMoveDispatchInput, DispatchCalendarGrid } from "./dispatch-calendar-grid";
import {
  getDispatchVisitOperationalSignal,
  getDispatchVisitSupportingText
} from "./dispatch-calendar-signals";
import { DispatchConflictPanel } from "./dispatch-conflict-panel";
import { DispatchQuickEditPanel } from "./dispatch-quick-edit-panel";
import { DispatchResourceFilters } from "./dispatch-resource-filters";
import { DispatchSavedViewDialog } from "./dispatch-saved-view-dialog";
import type {
  DispatchInterventionAction,
  DispatchInterventionSummaryItem
} from "./dispatch-intervention-model";
import { DispatchToolbar } from "./dispatch-toolbar";
import { DispatchMonthCalendar } from "./dispatch-month-calendar";
import { DispatchCommandDeck } from "./dispatch-command-deck";
import { DispatchHandoffResolutionControl } from "./dispatch-handoff-resolution-control";
import { DispatchOperationsRail } from "./dispatch-operations-rail";
import { type DispatchThreadBoardContext } from "./dispatch-thread-board-context";
import { DispatchUnassignedPanel } from "./dispatch-unassigned-panel";
import { DispatchWeekCalendar } from "./dispatch-week-calendar";

type DispatchCommandCenterProps = {
  backHref: string;
  calendar: DispatchCalendarData;
  currentState: {
    date: string;
    focusMode: boolean;
    includeUnassigned: boolean;
    jobId: string;
    resourceUserIds: string[];
    savedViewId: string;
    scope: DispatchCalendarScope;
    view: DispatchCalendarView;
  };
  operatorRole?: string;
  operatorFocusMode?: boolean;
  pageDescription: string;
  pageTitle: string;
  renderedAt: string;
  resourcePreferences: DispatchResourcePreference[];
  savedViews: DispatchSavedView[];
  settingsHref: string;
  approvedReleaseJobIds: string[];
  closeoutRiskCount: number;
  closeoutRiskJobIds: string[];
  closeoutRiskItems: Array<{
    balanceDueCents: number;
    customerDisplayName: string;
    handoffCopy: string | null;
    handoffLabel: string | null;
    handoffResolutionDisposition: TechnicianPaymentResolutionDisposition | null;
    invoiceId: string | null;
    jobId: string;
    lastCustomerUpdateLabel: string;
    nextActionLabel: string;
    openPaymentHandoffCount: number;
    title: string;
    trustCopy: string;
    trustLabel: string;
    trustTone: "brand" | "danger" | "neutral" | "success" | "warning";
    vehicleDisplayName: string;
  }>;
  lowConfidenceCount: number;
  lowConfidenceJobIds: string[];
  lowConfidenceItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  supplyBlockedCount: number;
  supplyBlockedItems: Array<{
    customerDisplayName: string;
    jobId: string;
    supplyBlockerCount: number;
    title: string;
    vehicleDisplayName: string;
  }>;
  sameDayInsertionSuggestions: Array<{
    jobId: string;
    queueLabel: string;
    suggestions: Array<{
      continuityLabel: string | null;
      copy: string;
      distanceLabel: string | null;
      readinessSummary: {
        copy: string;
        facts: Array<{
          label: string;
          tone: "brand" | "danger" | "neutral" | "success" | "warning";
        }>;
        label: string;
        tone: "brand" | "danger" | "neutral" | "success" | "warning";
      };
      routeConfidence: RouteConfidenceSnapshot;
      technicianName: string;
      technicianUserId: string;
      trackingLabel: string;
      trackingTone: "danger" | "neutral" | "success" | "warning";
    }>;
    visit: DispatchBoardJobItem;
  }>;
  staleApprovalJobIds: string[];
  staleApprovalItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  staleApprovalCount: number;
  staleFollowUpJobIds: string[];
  staleFollowUpItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  followUpVisitCount: number;
  staleFollowUpVisitCount: number;
  technicians: AssignableTechnicianOption[];
  promiseSummaries: Array<{
    jobId: string;
    summary: DispatchOnBoardPromiseSummary;
  }>;
  trustScores: Array<{
    jobId: string;
    score: number;
  }>;
};

type DispatchHandoffResolutionInput = {
  resolutionDisposition: TechnicianPaymentResolutionDisposition;
  resolutionNote: string | null;
};

type OfficeOperatorRole = "owner" | "admin" | "dispatcher" | "technician";
type DispatchSurfaceMode = "board" | "follow_through" | "recovery" | "release_runway";
type DispatchSameDayInsertionSuggestion = DispatchCommandCenterProps["sameDayInsertionSuggestions"][number];
type DispatchCrewReadinessSummary =
  DispatchCommandCenterProps["sameDayInsertionSuggestions"][number]["suggestions"][number]["readinessSummary"];

function buildFinanceFileHref(invoiceId: string | null) {
  if (!invoiceId) {
    return "/dashboard/finance";
  }

  const params = new URLSearchParams();
  params.set("invoiceId", invoiceId);
  return `/dashboard/finance?${params.toString()}`;
}

function normalizeOfficeOperatorRole(role: string | undefined): OfficeOperatorRole | "office" {
  if (role === "owner" || role === "admin" || role === "dispatcher" || role === "technician") {
    return role;
  }

  return "office";
}

function buildDispatchRoleFocus(input: {
  currentState: DispatchCommandCenterProps["currentState"];
  operatorRole: string | undefined;
  selectedVisitId?: string | null;
  selectedSingleTechnicianId: string;
}) {
  const buildVisitsScopeHref = (scope: string) =>
    buildDashboardAliasHref("/dashboard/visits", {
      jobId: input.selectedVisitId ?? "",
      scope
    });
  const recoveryBoardHref = buildDispatchCalendarHref(input.currentState, {
    includeUnassigned: true,
    resourceUserIds: [],
    savedViewId: "",
    scope: "all_workers",
    view: "day"
  });
  const crewOverviewHref = buildDispatchCalendarHref(input.currentState, {
    includeUnassigned: true,
    resourceUserIds: [],
    savedViewId: "",
    scope: "all_workers",
    view: "week"
  });
  const focusedLaneHref = input.selectedSingleTechnicianId
    ? buildDispatchCalendarHref(input.currentState, {
        includeUnassigned: true,
        resourceUserIds: [input.selectedSingleTechnicianId],
        savedViewId: "",
        scope: "single_tech",
        view: "day"
      })
    : recoveryBoardHref;

  switch (normalizeOfficeOperatorRole(input.operatorRole)) {
    case "dispatcher":
      return {
        links: [
          { href: recoveryBoardHref, label: "Recovery board", tone: "primary" as const },
          { href: focusedLaneHref, label: "Focused lane", tone: "secondary" as const },
          {
            href: buildVisitsScopeHref("needs_assignment"),
            label: "Assignment queue",
            tone: "tertiary" as const
          }
        ],
        title: "Dispatcher defaults"
      };
    case "admin":
      return {
        links: [
          { href: crewOverviewHref, label: "Crew overview", tone: "primary" as const },
          {
            href: buildVisitsScopeHref("stale_approval"),
            label: "Approval follow-up",
            tone: "secondary" as const
          },
          { href: "/dashboard/finance?stage=reminder_due", label: "Reminder due", tone: "tertiary" as const }
        ],
        title: "Admin follow-through"
      };
    case "owner":
      return {
        links: [
          { href: "/dashboard", label: "Today brief", tone: "primary" as const },
          { href: "/dashboard/finance?stage=aged_risk", label: "Aged risk", tone: "secondary" as const },
          { href: crewOverviewHref, label: "Weekly board", tone: "tertiary" as const }
        ],
        title: "Owner oversight"
      };
    default:
      return null;
  }
}

type JsonResponse<T> = {
  error?: string;
  ok?: boolean;
} & T;

async function requestJson<TResponse>(
  url: string,
  input?: {
    body?: object;
    method?: "POST" | "PATCH" | "DELETE";
  }
): Promise<JsonResponse<TResponse>> {
  const requestInit: RequestInit = {
    method: input?.method ?? "POST"
  };

  if (input?.body) {
    requestInit.body = JSON.stringify(input.body);
    requestInit.headers = { "Content-Type": "application/json" };
  }

  const response = await fetch(url, requestInit);
  const payload = (await response.json().catch(() => null)) as JsonResponse<TResponse> | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Dispatch action could not be completed.");
  }

  if (!payload) {
    throw new Error("Dispatch action returned no response payload.");
  }

  return payload;
}

function buildCurrentDateLabel(calendar: DispatchCalendarData) {
  if (calendar.range.view === "month") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: calendar.timezone,
      month: "long",
      year: "numeric"
    }).format(zonedLocalDateTimeToUtc(`${calendar.range.date}T12:00`, calendar.timezone));
  }

  const [firstDay] = calendar.range.visibleDays;
  const lastDay = calendar.range.visibleDays[calendar.range.visibleDays.length - 1];

  if (!firstDay || !lastDay) {
    return "Dispatch calendar";
  }

  if (calendar.range.view === "day" || firstDay.date === lastDay.date) {
    return firstDay.columnLabel;
  }

  return `${firstDay.label} – ${lastDay.label}`;
}

function compareDispatchBoardJobs(
  left: DispatchBoardJobItem,
  right: DispatchBoardJobItem,
  trustScoresByJobId?: Map<string, number>
) {
  const leftTrustScore = trustScoresByJobId?.get(left.id) ?? Number.MAX_SAFE_INTEGER;
  const rightTrustScore = trustScoresByJobId?.get(right.id) ?? Number.MAX_SAFE_INTEGER;

  if (leftTrustScore !== rightTrustScore) {
    return leftTrustScore - rightTrustScore;
  }

  const leftStart = left.scheduledStartAt ? new Date(left.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightStart = right.scheduledStartAt ? new Date(right.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function compareDispatchCalendarEvents(left: DispatchCalendarData["jobs"][number], right: DispatchCalendarData["jobs"][number]) {
  const leftStart = new Date(left.eventStartAt).getTime();
  const rightStart = new Date(right.eventStartAt).getTime();

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function rebuildDispatchResourceSummaries(calendar: DispatchCalendarData) {
  const scheduledByResource = new Map<string, number>();
  const scheduledMinutesByResource = new Map<string, number>();
  const backlogByResource = new Map<string, number>();
  const availabilityByResource = new Map<string, number>();
  const conflictsByResource = new Map<string, number>();

  for (const job of calendar.jobs) {
    if (!job.resourceTechnicianUserId) {
      continue;
    }

    scheduledByResource.set(
      job.resourceTechnicianUserId,
      (scheduledByResource.get(job.resourceTechnicianUserId) ?? 0) + 1
    );
    scheduledMinutesByResource.set(
      job.resourceTechnicianUserId,
      (scheduledMinutesByResource.get(job.resourceTechnicianUserId) ?? 0) + job.durationMinutes
    );
  }

  for (const job of calendar.backlogJobs) {
    if (!job.assignedTechnicianUserId) {
      continue;
    }

    backlogByResource.set(
      job.assignedTechnicianUserId,
      (backlogByResource.get(job.assignedTechnicianUserId) ?? 0) + 1
    );
  }

  for (const block of calendar.availability) {
    availabilityByResource.set(
      block.technicianUserId,
      (availabilityByResource.get(block.technicianUserId) ?? 0) + 1
    );
  }

  for (const conflict of calendar.conflicts) {
    if (!conflict.technicianUserId) {
      continue;
    }

    conflictsByResource.set(
      conflict.technicianUserId,
      (conflictsByResource.get(conflict.technicianUserId) ?? 0) + 1
    );
  }

  return {
    ...calendar,
    resources: calendar.resources.map((resource) => ({
      ...resource,
      scheduledCount: scheduledByResource.get(resource.technicianUserId) ?? 0,
      scheduledMinutes: scheduledMinutesByResource.get(resource.technicianUserId) ?? 0,
      backlogCount: backlogByResource.get(resource.technicianUserId) ?? 0,
      availabilityBlockCount: availabilityByResource.get(resource.technicianUserId) ?? 0,
      conflictCount: conflictsByResource.get(resource.technicianUserId) ?? 0
    }))
  };
}

function buildOptimisticDispatchJobEvent(input: {
  job: DispatchBoardJobItem;
  timezone: string;
  slotMinutes: number;
}) {
  if (!input.job.scheduledStartAt) {
    return null;
  }

  const scheduledEndAt =
    input.job.scheduledEndAt ??
    new Date(
      new Date(input.job.scheduledStartAt).getTime() + Math.max(input.slotMinutes * 2, 60) * 60_000
    ).toISOString();
  const durationMinutes = Math.max(
    Math.round(
      (new Date(scheduledEndAt).getTime() - new Date(input.job.scheduledStartAt).getTime()) / 60_000
    ),
    input.slotMinutes
  );

  return {
    ...input.job,
    dayDate: getDispatchLocalDate(input.job.scheduledStartAt, input.timezone),
    eventStartAt: input.job.scheduledStartAt,
    eventEndAt: scheduledEndAt,
    durationMinutes,
    trackIndex: 0,
    trackCount: 1,
    resourceTechnicianUserId: input.job.assignedTechnicianUserId,
    overlapsAvailability: false,
    overlapsOtherJobs: false,
    isOutsideVisibleHours: false
  };
}

function applyOptimisticMove(input: {
  calendar: DispatchCalendarData;
  move: MoveDispatchJobInput;
  technicianNamesById: Map<string, string>;
  trustScoresByJobId: Map<string, number>;
}) {
  const currentJob =
    input.calendar.jobs.find((job) => job.id === input.move.jobId) ??
    input.calendar.unassignedScheduledJobs.find((job) => job.id === input.move.jobId) ??
    input.calendar.backlogJobs.find((job) => job.id === input.move.jobId);

  if (!currentJob) {
    return input.calendar;
  }

  const visibleResourceIds = new Set(
    input.calendar.resources.map((resource) => resource.technicianUserId)
  );
  const updatedJob: DispatchBoardJobItem = {
    ...currentJob,
    assignedTechnicianUserId: input.move.assignedTechnicianUserId ?? null,
    assignedTechnicianName: input.move.assignedTechnicianUserId
      ? input.technicianNamesById.get(input.move.assignedTechnicianUserId) ?? currentJob.assignedTechnicianName
      : null,
    scheduledStartAt: input.move.scheduledStartAt,
    scheduledEndAt: input.move.scheduledEndAt ?? null,
    arrivalWindowStartAt: input.move.arrivalWindowStartAt ?? null,
    arrivalWindowEndAt: input.move.arrivalWindowEndAt ?? null,
    status: currentJob.status === "new" ? "scheduled" : currentJob.status
  };
  const nextCalendar = {
    ...input.calendar,
    jobs: input.calendar.jobs.filter((job) => job.id !== input.move.jobId),
    unassignedScheduledJobs: input.calendar.unassignedScheduledJobs.filter(
      (job) => job.id !== input.move.jobId
    ),
    backlogJobs: input.calendar.backlogJobs.filter((job) => job.id !== input.move.jobId)
  };
  const optimisticEvent = buildOptimisticDispatchJobEvent({
    job: updatedJob,
    slotMinutes: input.calendar.settings.slotMinutes,
    timezone: input.calendar.timezone
  });

  if (updatedJob.scheduledStartAt) {
    if (
      updatedJob.assignedTechnicianUserId &&
      visibleResourceIds.has(updatedJob.assignedTechnicianUserId) &&
      optimisticEvent
    ) {
      nextCalendar.jobs = [...nextCalendar.jobs, optimisticEvent].sort(compareDispatchCalendarEvents);
    } else if (!updatedJob.assignedTechnicianUserId) {
      nextCalendar.unassignedScheduledJobs = [...nextCalendar.unassignedScheduledJobs, updatedJob].sort(
        (left, right) => compareDispatchBoardJobs(left, right, input.trustScoresByJobId)
      );
    }
  } else if (
    !updatedJob.assignedTechnicianUserId ||
    visibleResourceIds.has(updatedJob.assignedTechnicianUserId)
  ) {
    nextCalendar.backlogJobs = [...nextCalendar.backlogJobs, updatedJob].sort((left, right) =>
      compareDispatchBoardJobs(left, right, input.trustScoresByJobId)
    );
  }

  return rebuildDispatchResourceSummaries(nextCalendar);
}

function applyOptimisticDeferToQueue(input: {
  calendar: DispatchCalendarData;
  jobId: string;
  trustScoresByJobId: Map<string, number>;
}) {
  const currentJob =
    input.calendar.jobs.find((job) => job.id === input.jobId) ??
    input.calendar.unassignedScheduledJobs.find((job) => job.id === input.jobId) ??
    input.calendar.backlogJobs.find((job) => job.id === input.jobId);

  if (!currentJob) {
    return input.calendar;
  }

  const updatedJob: DispatchBoardJobItem = {
    ...currentJob,
    arrivalWindowEndAt: null,
    arrivalWindowStartAt: null,
    scheduledEndAt: null,
    scheduledStartAt: null,
    status: currentJob.status === "new" ? "new" : "scheduled"
  };
  const nextCalendar = {
    ...input.calendar,
    jobs: input.calendar.jobs.filter((job) => job.id !== input.jobId),
    unassignedScheduledJobs: input.calendar.unassignedScheduledJobs.filter(
      (job) => job.id !== input.jobId
    ),
    backlogJobs: [...input.calendar.backlogJobs.filter((job) => job.id !== input.jobId), updatedJob].sort(
      (left, right) => compareDispatchBoardJobs(left, right, input.trustScoresByJobId)
    )
  };

  return rebuildDispatchResourceSummaries(nextCalendar);
}

function buildOptimisticQueuedPromiseSummary(
  summary: DispatchOnBoardPromiseSummary,
  now: Date
): DispatchOnBoardPromiseSummary {
  const updateLabel = getDispatchOnBoardFollowThroughActionLabel(summary.recommendedAction);

  return {
    ...summary,
    breachRisk: summary.breachRisk === "high" ? "watch" : summary.breachRisk,
    confidencePercent: Math.max(summary.confidencePercent, 82),
    copy: `${updateLabel} queued from Dispatch just now.`,
    label: "Customer update queued",
    lastCustomerUpdateAt: now.toISOString(),
    lastCustomerUpdateLabel: "Updated just now",
    nextUpdateLabel: "Queued just now",
    recommendedAction: null,
    tone: "brand"
  };
}

function applyOptimisticResize(input: {
  calendar: DispatchCalendarData;
  resize: ResizeDispatchJobInput;
}) {
  const nextCalendar = {
    ...input.calendar,
    jobs: input.calendar.jobs.map((job) => {
      if (job.id !== input.resize.jobId) {
        return job;
      }

      const scheduledEndAt = input.resize.scheduledEndAt;
      const durationMinutes = Math.max(
        Math.round(
          (new Date(scheduledEndAt).getTime() - new Date(job.eventStartAt).getTime()) / 60_000
        ),
        input.calendar.settings.slotMinutes
      );

      return {
        ...job,
        scheduledEndAt,
        arrivalWindowStartAt: input.resize.arrivalWindowStartAt ?? job.arrivalWindowStartAt,
        arrivalWindowEndAt: input.resize.arrivalWindowEndAt ?? job.arrivalWindowEndAt,
        eventEndAt: scheduledEndAt,
        durationMinutes
      };
    })
  };

  return rebuildDispatchResourceSummaries(nextCalendar);
}

function DispatchCrewReadinessStrip({ summary }: { summary: DispatchCrewReadinessSummary }) {
  return (
    <div className="dispatch-recovery-band__readiness">
      <div className="dispatch-recovery-band__readiness-header">
        <Badge tone={summary.tone}>{summary.label}</Badge>
        <div className="dispatch-recovery-band__readiness-facts">
          {summary.facts.map((fact) => (
            <Badge key={`${summary.label}:${fact.label}`} tone={fact.tone}>
              {fact.label}
            </Badge>
          ))}
        </div>
      </div>
      <p className="dispatch-recovery-band__readiness-copy">{summary.copy}</p>
    </div>
  );
}

function buildLaneCrewReadinessSummary(input: {
  lane: DispatchCalendarData["resources"][number] | null;
  laneCopy: string;
  laneFollowThrough: ReturnType<typeof summarizeDispatchLaneFollowThrough> | null;
  liveJobTitle: string | null;
  valueLabel: string;
}): DispatchCrewReadinessSummary {
  if (!input.lane) {
    return {
      copy: "No clear lane is standing out right now. Open the board and hand-place this visit instead of trusting a blind release.",
      facts: [
        { label: "Manual review", tone: "warning" },
        { label: "Lane open required", tone: "neutral" }
      ],
      label: "Needs lane decision",
      tone: "warning"
    };
  }

  const attentionCount = input.laneFollowThrough?.attentionCount ?? 0;
  const dangerCount = input.laneFollowThrough?.dangerCount ?? 0;
  const facts: DispatchCrewReadinessSummary["facts"] = [
    {
      label:
        input.lane.scheduledCount === 0
          ? "Open lane"
          : `${input.lane.scheduledCount} scheduled`,
      tone: input.lane.scheduledCount <= 1 ? "success" : "neutral"
    }
  ];

  if (input.liveJobTitle) {
    facts.push({
      label: "Live stop active",
      tone: "warning"
    });
  } else if (input.lane.backlogCount > 0) {
    facts.push({
      label: `${input.lane.backlogCount} waiting`,
      tone: "warning"
    });
  }

  if (attentionCount > 0) {
    facts.push({
      label: `${attentionCount} follow-through`,
      tone: dangerCount > 0 ? "danger" : "warning"
    });
  } else if (input.lane.availabilityBlockCount > 0) {
    facts.push({
      label: `${input.lane.availabilityBlockCount} shaped window`,
      tone: "neutral"
    });
  }

  if (input.lane.conflictCount > 0) {
    return {
      copy: "This lane is already conflicted. Do not release into it until the collision is resolved from the board.",
      facts: [
        { label: `${input.lane.conflictCount} conflict`, tone: "danger" },
        ...facts.slice(0, 2)
      ],
      label: "Blocked lane",
      tone: "danger"
    };
  }

  if (attentionCount > 0 || input.liveJobTitle) {
    return {
      copy: attentionCount > 0
        ? "The lane can still take the visit, but customer timing debt is already live. Release with a deliberate promise and fast follow-through."
        : "The technician is already live on another stop. Release here only if the arrival promise can absorb the active route load.",
      facts: facts.slice(0, 3),
      label: "Use with care",
      tone: "warning"
    };
  }

  return {
    copy:
      input.laneCopy || "Crew load and lane posture support a clean release from Dispatch.",
    facts: ([
      { label: input.valueLabel, tone: "brand" },
      ...facts.slice(0, 2)
    ] satisfies DispatchCrewReadinessSummary["facts"]).slice(0, 3),
    label: "Crew ready",
    tone: "success"
  };
}

type DispatchSameDayFitCardProps = {
  onFocusSingleLane: (technicianUserId: string) => void;
  onOpenVisit: (jobId: string) => void;
  onQuickEditSave: (input: QuickEditDispatchJobInput) => Promise<void>;
  suggestion: DispatchSameDayInsertionSuggestion;
  technicians: AssignableTechnicianOption[];
  timezone: string;
};

function DispatchSameDayFitCard({
  onFocusSingleLane,
  onOpenVisit,
  onQuickEditSave,
  suggestion,
  technicians,
  timezone
}: DispatchSameDayFitCardProps) {
  const primarySuggestion = suggestion.suggestions[0] ?? null;
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState(
    () => suggestion.visit.assignedTechnicianUserId ?? primarySuggestion?.technicianUserId ?? ""
  );
  const [scheduledStartAt, setScheduledStartAt] = useState(() =>
    toDispatchDateTimeInput(
      suggestion.visit.scheduledStartAt ?? suggestion.visit.arrivalWindowStartAt,
      timezone
    )
  );
  const [pendingAction, setPendingAction] = useState<"owner" | "promise" | "release" | null>(null);

  useEffect(() => {
    setAssignedTechnicianUserId(
      suggestion.visit.assignedTechnicianUserId ?? primarySuggestion?.technicianUserId ?? ""
    );
  }, [primarySuggestion?.technicianUserId, suggestion.visit.assignedTechnicianUserId, suggestion.visit.id]);

  useEffect(() => {
    setScheduledStartAt(
      toDispatchDateTimeInput(
        suggestion.visit.scheduledStartAt ?? suggestion.visit.arrivalWindowStartAt,
        timezone
      )
    );
  }, [
    suggestion.visit.arrivalWindowStartAt,
    suggestion.visit.id,
    suggestion.visit.scheduledStartAt,
    timezone
  ]);

  const hasScheduledPromise = Boolean(
    scheduledStartAt || suggestion.visit.scheduledStartAt || suggestion.visit.arrivalWindowStartAt
  );

  const runAction = async (
    action: "owner" | "promise" | "release",
    input: QuickEditDispatchJobInput
  ) => {
    setPendingAction(action);

    try {
      await onQuickEditSave(input);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <article className="dispatch-recovery-band__card">
      <div className="dispatch-recovery-band__card-topline">
        <p className="dispatch-recovery-band__card-title">{suggestion.visit.title}</p>
        <div className="dispatch-recovery-band__card-badges">
          <Badge tone="brand">{suggestion.queueLabel}</Badge>
          {primarySuggestion ? <Badge tone="success">Best fit</Badge> : null}
        </div>
      </div>
      <p className="dispatch-recovery-band__card-meta">
        {suggestion.visit.customerDisplayName} · {suggestion.visit.vehicleDisplayName}
      </p>
      <p className="dispatch-recovery-band__card-copy">
        {getDispatchVisitSupportingText(suggestion.visit, timezone)}
      </p>
      {primarySuggestion ? (
        <>
          <div className="dispatch-recovery-band__lane-detail">
            <span className="dispatch-recovery-band__lane-label">Best nearby lane</span>
            <strong>{primarySuggestion.technicianName}</strong>
          </div>
          <div className="dispatch-recovery-band__fit-badges">
            {primarySuggestion.distanceLabel ? (
              <Badge tone="neutral">{primarySuggestion.distanceLabel}</Badge>
            ) : null}
            <Badge tone={primarySuggestion.trackingTone}>{primarySuggestion.trackingLabel}</Badge>
            <Badge tone={primarySuggestion.routeConfidence.tone}>
              {primarySuggestion.routeConfidence.label} ·{" "}
              {primarySuggestion.routeConfidence.confidencePercent}%
            </Badge>
            {primarySuggestion.continuityLabel ? (
              <Badge tone="neutral">{primarySuggestion.continuityLabel}</Badge>
            ) : null}
          </div>
          <p className="dispatch-recovery-band__card-copy">{primarySuggestion.copy}</p>
          <DispatchCrewReadinessStrip summary={primarySuggestion.readinessSummary} />
        </>
      ) : null}
      {primarySuggestion &&
      (suggestion.suggestions.length > 1 || primarySuggestion.routeConfidence.copy) ? (
        <details className="dispatch-command-card__details">
          <summary className={buttonClassName({ size: "sm", tone: "ghost" })}>More lane detail</summary>
          <div className="dispatch-command-card__details-body">
            <p className="dispatch-recovery-band__card-copy">
              {primarySuggestion.routeConfidence.copy}
            </p>
            {suggestion.suggestions.length > 1 ? (
              <div className="dispatch-recovery-band__fit-alternates">
                <span className="dispatch-recovery-band__lane-label">Alternates</span>
                <div className="dispatch-recovery-band__fit-alternate-list">
                  {suggestion.suggestions.slice(1).map((alternate) => (
                    <span
                      className="dispatch-recovery-band__fit-alternate-chip"
                      key={`${suggestion.jobId}:${alternate.technicianUserId}`}
                    >
                      {alternate.technicianName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
      <div className="dispatch-command-card__inline-controls">
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Owner</span>
            <Select
              aria-label={`${suggestion.visit.title} same-day owner`}
              onChange={(event) => setAssignedTechnicianUserId(event.target.value)}
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
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("owner", {
                assignedTechnicianUserId: assignedTechnicianUserId || null,
                jobId: suggestion.visit.id
              })
            }
            type="button"
          >
            {pendingAction === "owner" ? "Saving…" : "Save owner"}
          </button>
        </div>
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Promise time</span>
            <Input
              aria-label={`${suggestion.visit.title} same-day promise`}
              onChange={(event) => setScheduledStartAt(event.target.value)}
              type="datetime-local"
              value={scheduledStartAt}
            />
          </label>
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("promise", {
                arrivalWindowEndAt: scheduledStartAt || null,
                arrivalWindowStartAt: scheduledStartAt || null,
                jobId: suggestion.visit.id,
                status: suggestion.visit.status
              })
            }
            type="button"
          >
            {pendingAction === "promise" ? "Saving…" : "Save promise"}
          </button>
        </div>
      </div>
      <div className="ui-table-actions">
        {primarySuggestion ? (
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            onClick={() => onFocusSingleLane(primarySuggestion.technicianUserId)}
            type="button"
          >
            Focus lane
          </button>
        ) : null}
        <button
          className={buttonClassName({ size: "sm", tone: "secondary" })}
          disabled={!hasScheduledPromise || pendingAction !== null}
          onClick={() =>
            void runAction("release", {
              arrivalWindowEndAt:
                scheduledStartAt ||
                suggestion.visit.arrivalWindowEndAt ||
                suggestion.visit.arrivalWindowStartAt ||
                null,
              arrivalWindowStartAt:
                scheduledStartAt || suggestion.visit.arrivalWindowStartAt || null,
              assignedTechnicianUserId: assignedTechnicianUserId || null,
              jobId: suggestion.visit.id,
              scheduledStartAt:
                scheduledStartAt ||
                suggestion.visit.scheduledStartAt ||
                suggestion.visit.arrivalWindowStartAt ||
                null,
              status: "scheduled"
            })
          }
          type="button"
        >
          {pendingAction === "release" ? "Placing…" : "Place on board"}
        </button>
        <button
          className={buttonClassName({ size: "sm", tone: "ghost" })}
          onClick={() => onOpenVisit(suggestion.visit.id)}
          type="button"
        >
          Open drawer
        </button>
      </div>
    </article>
  );
}

type DispatchApprovedReleaseRunwayCardProps = {
  candidate: {
    lane: DispatchCalendarData["resources"][number] | null;
    laneCopy: string;
    promiseCopy: string;
    readinessSummary: DispatchCrewReadinessSummary;
    value: string;
    visit: DispatchBoardJobItem;
  };
  onFocusSingleLane: (technicianUserId: string) => void;
  onOpenVisit: (jobId: string) => void;
  onQuickEditSave: (input: QuickEditDispatchJobInput) => Promise<void>;
  technicians: AssignableTechnicianOption[];
  timezone: string;
};

function DispatchApprovedReleaseRunwayCard({
  candidate,
  onFocusSingleLane,
  onOpenVisit,
  onQuickEditSave,
  technicians,
  timezone
}: DispatchApprovedReleaseRunwayCardProps) {
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState(
    () => candidate.visit.assignedTechnicianUserId ?? candidate.lane?.technicianUserId ?? ""
  );
  const [scheduledStartAt, setScheduledStartAt] = useState(() =>
    toDispatchDateTimeInput(
      candidate.visit.scheduledStartAt ?? candidate.visit.arrivalWindowStartAt,
      timezone
    )
  );
  const [pendingAction, setPendingAction] = useState<"owner" | "promise" | "release" | null>(null);

  useEffect(() => {
    setAssignedTechnicianUserId(
      candidate.visit.assignedTechnicianUserId ?? candidate.lane?.technicianUserId ?? ""
    );
  }, [candidate.lane?.technicianUserId, candidate.visit.assignedTechnicianUserId, candidate.visit.id]);

  useEffect(() => {
    setScheduledStartAt(
      toDispatchDateTimeInput(
        candidate.visit.scheduledStartAt ?? candidate.visit.arrivalWindowStartAt,
        timezone
      )
    );
  }, [candidate.visit.arrivalWindowStartAt, candidate.visit.id, candidate.visit.scheduledStartAt, timezone]);

  const hasScheduledPromise = Boolean(
    scheduledStartAt || candidate.visit.scheduledStartAt || candidate.visit.arrivalWindowStartAt
  );

  const runAction = async (
    action: "owner" | "promise" | "release",
    input: QuickEditDispatchJobInput
  ) => {
    setPendingAction(action);

    try {
      await onQuickEditSave(input);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <article className="dispatch-recovery-band__card">
      <div className="dispatch-recovery-band__card-topline">
        <p className="dispatch-recovery-band__card-title">{candidate.visit.title}</p>
        <div className="dispatch-recovery-band__card-badges">
          <Badge tone="success">Approved release</Badge>
          <Badge tone={candidate.lane ? "brand" : "warning"}>{candidate.value}</Badge>
        </div>
      </div>
      <p className="dispatch-recovery-band__card-meta">
        {candidate.visit.customerDisplayName} · {candidate.visit.vehicleDisplayName}
      </p>
      <p className="dispatch-recovery-band__card-copy">{candidate.promiseCopy}</p>
      <div className="dispatch-recovery-band__lane-detail">
        <span className="dispatch-recovery-band__lane-label">Suggested lane</span>
        <strong>{candidate.lane?.displayName ?? "Manual placement review"}</strong>
      </div>
      <p className="dispatch-recovery-band__card-copy">{candidate.laneCopy}</p>
      <DispatchCrewReadinessStrip summary={candidate.readinessSummary} />
      <div className="dispatch-command-card__inline-controls">
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Owner</span>
            <Select
              aria-label={`${candidate.visit.title} release owner`}
              onChange={(event) => setAssignedTechnicianUserId(event.target.value)}
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
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("owner", {
                assignedTechnicianUserId: assignedTechnicianUserId || null,
                jobId: candidate.visit.id
              })
            }
            type="button"
          >
            {pendingAction === "owner" ? "Saving…" : "Save owner"}
          </button>
        </div>
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Promise time</span>
            <Input
              aria-label={`${candidate.visit.title} release promise`}
              onChange={(event) => setScheduledStartAt(event.target.value)}
              type="datetime-local"
              value={scheduledStartAt}
            />
          </label>
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("promise", {
                arrivalWindowEndAt: scheduledStartAt || null,
                arrivalWindowStartAt: scheduledStartAt || null,
                jobId: candidate.visit.id,
                status: candidate.visit.status
              })
            }
            type="button"
          >
            {pendingAction === "promise" ? "Saving…" : "Save promise"}
          </button>
        </div>
      </div>
      <div className="ui-table-actions">
        <button
          className={buttonClassName({ size: "sm", tone: "secondary" })}
          disabled={!hasScheduledPromise || pendingAction !== null}
          onClick={() =>
            void runAction("release", {
              arrivalWindowEndAt:
                scheduledStartAt ||
                candidate.visit.arrivalWindowEndAt ||
                candidate.visit.arrivalWindowStartAt ||
                null,
              arrivalWindowStartAt:
                scheduledStartAt || candidate.visit.arrivalWindowStartAt || null,
              assignedTechnicianUserId:
                assignedTechnicianUserId || candidate.lane?.technicianUserId || null,
              jobId: candidate.visit.id,
              scheduledStartAt:
                scheduledStartAt ||
                candidate.visit.scheduledStartAt ||
                candidate.visit.arrivalWindowStartAt ||
                null,
              status: "scheduled"
            })
          }
          type="button"
        >
          {pendingAction === "release" ? "Placing…" : "Release to board"}
        </button>
        {candidate.lane ? (
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            onClick={() => onFocusSingleLane(candidate.lane!.technicianUserId)}
            type="button"
          >
            Focus lane
          </button>
        ) : null}
        <button
          className={buttonClassName({ size: "sm", tone: "ghost" })}
          onClick={() => onOpenVisit(candidate.visit.id)}
          type="button"
        >
          Open drawer
        </button>
      </div>
    </article>
  );
}

type DispatchCloseoutRecoveryCardProps = {
  item: DispatchCommandCenterProps["closeoutRiskItems"][number];
  onNotifyCloseoutRisk: (jobId: string) => void;
  onResolveCloseoutHandoff: (jobId: string, input: DispatchHandoffResolutionInput) => void;
  onOpenVisit: (jobId: string) => void;
  reminderPending: boolean;
};

function getDispatchCloseoutCardCopy(
  item: DispatchCommandCenterProps["closeoutRiskItems"][number]
): string {
  if (item.openPaymentHandoffCount > 0) {
    return "Dispatch only needs to steady the live visit here. Finance should reconcile the field billing outcome next.";
  }
  if (item.balanceDueCents > 0) {
    return "Dispatch only needs the last customer touch here. Finance owns the rest of the closeout.";
  }
  return item.trustCopy;
}

function DispatchCloseoutRecoveryCard({
  item,
  onNotifyCloseoutRisk,
  onResolveCloseoutHandoff,
  onOpenVisit,
  reminderPending
}: DispatchCloseoutRecoveryCardProps) {
  return (
    <article className="dispatch-recovery-band__card dispatch-recovery-band__card--closeout">
      <div className="dispatch-recovery-band__card-topline">
        <p className="dispatch-recovery-band__card-title">{item.title}</p>
        <div className="dispatch-recovery-band__card-badges">
          <Badge tone="brand">
            {item.openPaymentHandoffCount > 0
              ? item.handoffLabel ?? `${item.openPaymentHandoffCount} field handoff${item.openPaymentHandoffCount === 1 ? "" : "s"}`
              : item.balanceDueCents > 0
                ? `$${(item.balanceDueCents / 100).toFixed(2)}`
                : "Balance review"}
          </Badge>
          <Badge tone={item.trustTone}>{item.trustLabel}</Badge>
        </div>
      </div>
      <p className="dispatch-recovery-band__card-meta">
        {item.customerDisplayName} · {item.vehicleDisplayName}
      </p>
      <p className="dispatch-recovery-band__card-copy">{getDispatchCloseoutCardCopy(item)}</p>
      <div className="dispatch-recovery-band__guided-steps">
        <div className="dispatch-recovery-band__guided-step">
          <span className="dispatch-recovery-band__lane-label">Last update</span>
          <strong>{item.lastCustomerUpdateLabel}</strong>
        </div>
        <div className="dispatch-recovery-band__guided-step">
          <span className="dispatch-recovery-band__lane-label">Next move</span>
          <strong>{item.nextActionLabel}</strong>
        </div>
      </div>
      <div className="ui-table-actions">
        <a
          className={buttonClassName({ size: "sm", tone: "secondary" })}
          href={buildFinanceFileHref(item.invoiceId)}
        >
          {item.openPaymentHandoffCount > 0 ? "Resolve in finance" : "Finance file"}
        </a>
        {item.openPaymentHandoffCount > 0 && item.handoffResolutionDisposition ? (
          <DispatchHandoffResolutionControl
            defaultDisposition={item.handoffResolutionDisposition}
            disabled={reminderPending}
            jobTitle={item.title}
            loading={reminderPending}
            onResolve={(input) => {
              void onResolveCloseoutHandoff(item.jobId, input);
            }}
          />
        ) : (
          <button
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            disabled={reminderPending}
            onClick={() => {
              void onNotifyCloseoutRisk(item.jobId);
            }}
            type="button"
          >
            {reminderPending ? "Saving..." : "Queue reminder"}
          </button>
        )}
        <button
          className={buttonClassName({ size: "sm", tone: "ghost" })}
          onClick={() => onOpenVisit(item.jobId)}
          type="button"
        >
          Visit thread
        </button>
      </div>
    </article>
  );
}

export function DispatchCommandCenter({
  backHref,
  calendar,
  currentState,
  operatorRole,
  operatorFocusMode = false,
  pageDescription,
  pageTitle,
  renderedAt,
  resourcePreferences,
  savedViews,
  settingsHref,
  approvedReleaseJobIds,
  closeoutRiskCount,
  closeoutRiskJobIds,
  closeoutRiskItems,
  lowConfidenceCount,
  lowConfidenceJobIds,
  lowConfidenceItems,
  supplyBlockedCount,
  supplyBlockedItems,
  sameDayInsertionSuggestions,
  staleApprovalJobIds,
  staleApprovalItems,
  staleApprovalCount,
  staleFollowUpJobIds,
  staleFollowUpItems,
  followUpVisitCount,
  staleFollowUpVisitCount,
  technicians,
  promiseSummaries,
  trustScores
}: DispatchCommandCenterProps) {
  const router = useRouter();
  const initialQueueCount = calendar.unassignedScheduledJobs.length + calendar.backlogJobs.length;
  const initialApprovedReleaseJobIdSet = new Set(approvedReleaseJobIds);
  const initialReleaseRunwayCount = [
    ...calendar.unassignedScheduledJobs,
    ...calendar.backlogJobs
  ].filter((job) => initialApprovedReleaseJobIdSet.has(job.id)).length;
  const initialPromiseRiskCount = [
    ...calendar.jobs,
    ...calendar.unassignedScheduledJobs,
    ...calendar.backlogJobs
  ].filter((job) => {
    if (["completed", "canceled"].includes(job.status) || isTechnicianOnSiteJobStatus(job.status)) {
      return false;
    }

    const promiseAt = job.scheduledStartAt ?? job.arrivalWindowStartAt;

    if (!promiseAt) {
      return false;
    }

    const promiseTime = Date.parse(promiseAt);

    if (Number.isNaN(promiseTime)) {
      return false;
    }

    return promiseTime <= new Date(renderedAt).getTime();
  }).length;
  const [activeCalendar, setActiveCalendar] = useState(calendar);
  const [draggingVisitId, setDraggingVisitId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [utilityTrayOpen, setUtilityTrayOpen] = useState(false);
  const [conflictPanelOpen, setConflictPanelOpen] = useState(false);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);
  const [operationsRailOpen, setOperationsRailOpen] = useState(false);
  const [surfaceMode, setSurfaceMode] = useState<DispatchSurfaceMode>("board");
  const [zoomPresets, setZoomPresets] = useState<{
    day: "overview" | "comfortable" | "detail";
    week: "overview" | "comfortable" | "detail";
  }>({
    day: "comfortable",
    week: "overview"
  });
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(currentState.jobId || null);
  const [sharedPinnedVisitId, setSharedPinnedVisitId] = useState<string | null>(null);
  const [placementHighlightVisitId, setPlacementHighlightVisitId] = useState<string | null>(null);
  const [selectedAvailabilityBlockId, setSelectedAvailabilityBlockId] = useState<string | null>(null);
  const [focusedConflictTechnicianUserId, setFocusedConflictTechnicianUserId] = useState<string | null>(null);
  const [removingAvailabilityBlockId, setRemovingAvailabilityBlockId] = useState<string | null>(null);
  const [creatingAvailabilityBlock, setCreatingAvailabilityBlock] = useState(false);
  const [savingAvailabilityBlockId, setSavingAvailabilityBlockId] = useState<string | null>(null);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [hasAutoOpenedCompactQueue, setHasAutoOpenedCompactQueue] = useState(false);
  const [batchInterventionPending, setBatchInterventionPending] = useState<
    | "notify_promise_risk"
    | "notify_stale_approvals"
    | "notify_stale_returns"
    | "defer_low_confidence"
    | "notify_closeout_risk"
    | "resolve_closeout_handoff"
    | null
  >(null);
  const [batchInterventionFeedback, setBatchInterventionFeedback] = useState<string | null>(null);
  const [pendingVisitIds, setPendingVisitIds] = useState<string[]>([]);
  const [optimisticPromiseSummariesByJobId, setOptimisticPromiseSummariesByJobId] = useState<
    Record<string, DispatchOnBoardPromiseSummary>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date(renderedAt));
  const [isRouting, startRouting] = useTransition();
  const conflictSummary = getDispatchConflictSummary(activeCalendar.conflicts);
  const currentDateLabel = buildCurrentDateLabel(activeCalendar);
  const approvedReleaseJobIdSet = new Set(approvedReleaseJobIds);
  const scheduledButUnassignedCount = activeCalendar.unassignedScheduledJobs.length;
  const approvedReleaseBacklogCount = activeCalendar.backlogJobs.filter((job) =>
    approvedReleaseJobIdSet.has(job.id)
  ).length;
  const assignedBacklogCount = activeCalendar.backlogJobs.filter(
    (job) => job.assignedTechnicianUserId
  ).length;
  const unscheduledIntakeCount = activeCalendar.backlogJobs.length - assignedBacklogCount;
  const openQueueCount = scheduledButUnassignedCount + activeCalendar.backlogJobs.length;
  const readyQueueCount = scheduledButUnassignedCount + approvedReleaseBacklogCount;
  const activeZoomPreset = currentState.view === "week" ? zoomPresets.week : zoomPresets.day;
  const dispatchReturnHref = buildDispatchCalendarHref(currentState, {});
  const currentDispatchSliceHref = buildDispatchCalendarHref(currentState, {
    jobId: ""
  });
  const todayHref = buildDispatchCalendarHref(currentState, {
    date: getDispatchLocalDate(clockNow, activeCalendar.timezone)
  });
  const previousHref = shiftDispatchCalendarHref(currentState, -1);
  const nextHref = shiftDispatchCalendarHref(currentState, 1);
  const focusToggleHref = buildDispatchCalendarHref(currentState, {
    focusMode: !operatorFocusMode
  });
  const selectedSavedView = currentState.savedViewId
    ? savedViews.find((savedView) => savedView.id === currentState.savedViewId) ?? null
    : null;
  const crewOverviewHref = buildDispatchCalendarHref(currentState, {
    includeUnassigned: true,
    jobId: "",
    resourceUserIds: [],
    savedViewId: "",
    scope: "all_workers",
    view: "week"
  });
  const selectedVisit =
    activeCalendar.jobs.find((job) => job.id === selectedVisitId) ??
    activeCalendar.unassignedScheduledJobs.find((job) => job.id === selectedVisitId) ??
    activeCalendar.backlogJobs.find((job) => job.id === selectedVisitId) ??
    null;
  const selectedVisitJobId = selectedVisit?.id ?? "";
  const buildVisitsScopeHref = (scope: string) =>
    buildDashboardAliasHref("/dashboard/visits", {
      jobId: selectedVisitJobId,
      scope
    });
  const visitsNeedsAssignmentHref = buildVisitsScopeHref("needs_assignment");
  const visitsPromiseRiskHref = buildVisitsScopeHref("promise_risk");
  const visitsReturnVisitHref = buildVisitsScopeHref("return_visit");
  const visitsStaleReturnVisitHref = buildVisitsScopeHref("stale_return_visit");
  const visitsReadyDispatchHref = buildVisitsScopeHref("ready_dispatch");
  const visitsStaleApprovalHref = buildVisitsScopeHref("stale_approval");
  const selectedScheduledVisit =
    activeCalendar.jobs.find((job) => job.id === selectedVisitId) ?? null;
  const selectedAvailabilityBlock =
    activeCalendar.availability.find((block) => block.id === selectedAvailabilityBlockId) ?? null;
  const technicianNamesById = new Map(
    technicians.map((technician) => [technician.userId, technician.displayName])
  );
  const promiseSummariesByJobId = new Map(
    promiseSummaries.map((entry) => [entry.jobId, entry.summary] as const)
  );
  for (const [jobId, summary] of Object.entries(optimisticPromiseSummariesByJobId)) {
    promiseSummariesByJobId.set(jobId, summary);
  }
  const effectivePromiseSummaries = [...promiseSummariesByJobId.entries()].map(([jobId, summary]) => ({
    jobId,
    summary
  }));
  const hasPromiseIntervention = (job: {
    arrivalWindowStartAt: string | null;
    id: string;
    scheduledStartAt: string | null;
    status: string;
  }) => {
    const promiseSummary = promiseSummariesByJobId.get(job.id) ?? null;

    if (promiseSummary) {
      return needsDispatchPromiseIntervention(promiseSummary);
    }

    if (
      ["canceled", "completed"].includes(job.status) ||
      isTechnicianOnSiteJobStatus(job.status as JobStatus)
    ) {
      return false;
    }

    const promiseAt = job.scheduledStartAt ?? job.arrivalWindowStartAt;

    if (!promiseAt) {
      return false;
    }

    const promiseTime = Date.parse(promiseAt);

    if (Number.isNaN(promiseTime)) {
      return false;
    }

    return promiseTime <= clockNow.getTime();
  };
  const promiseRiskJobs = [
    ...activeCalendar.jobs,
    ...activeCalendar.unassignedScheduledJobs,
    ...activeCalendar.backlogJobs
  ].filter((job) => hasPromiseIntervention(job));
  const promiseRiskCount = promiseRiskJobs.length;
  const trustScoresByJobId = new Map(trustScores.map((entry) => [entry.jobId, entry.score]));
  const laneFollowThroughByResourceId = new Map(
    activeCalendar.resources.map((resource) => {
      const laneFollowThrough = summarizeDispatchLaneFollowThrough(
        buildDispatchOnBoardFollowThroughItems({
          jobs: activeCalendar.jobs.filter(
            (job) => job.resourceTechnicianUserId === resource.technicianUserId
          ),
          now: clockNow,
          promiseSummariesByJobId
        })
      );

      return [resource.technicianUserId, laneFollowThrough] as const;
    })
  );
  const orderedBoardResources = [...activeCalendar.resources].sort((left, right) => {
    if (currentState.scope === "single_tech") {
      return left.displayName.localeCompare(right.displayName);
    }

    const leftJobs = activeCalendar.jobs.filter(
      (job) => job.resourceTechnicianUserId === left.technicianUserId
    );
    const rightJobs = activeCalendar.jobs.filter(
      (job) => job.resourceTechnicianUserId === right.technicianUserId
    );
    const leftFollowThrough = laneFollowThroughByResourceId.get(left.technicianUserId) ?? {
      attentionCount: 0,
      dangerCount: 0,
      highestRiskTone: "neutral" as const,
      staleLabel: "No follow-through due",
      staleMinutes: null
    };
    const rightFollowThrough = laneFollowThroughByResourceId.get(right.technicianUserId) ?? {
      attentionCount: 0,
      dangerCount: 0,
      highestRiskTone: "neutral" as const,
      staleLabel: "No follow-through due",
      staleMinutes: null
    };
    const leftLive = leftJobs.some((job) => isTechnicianActiveFieldJobStatus(job.status));
    const rightLive = rightJobs.some((job) => isTechnicianActiveFieldJobStatus(job.status));
    const leftScore =
      left.conflictCount * 1000 +
      getDispatchLaneFollowThroughPressureScore(leftFollowThrough) +
      left.backlogCount * 140 +
      (leftLive ? 40 : 0) +
      left.scheduledCount;
    const rightScore =
      right.conflictCount * 1000 +
      getDispatchLaneFollowThroughPressureScore(rightFollowThrough) +
      right.backlogCount * 140 +
      (rightLive ? 40 : 0) +
      right.scheduledCount;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.displayName.localeCompare(right.displayName);
  });
  const dispatchSurfaceCalendar = {
    ...activeCalendar,
    resources: orderedBoardResources
  };
  const visibleVisitIds = new Set(
    [
      ...activeCalendar.jobs.map((job) => job.id),
      ...activeCalendar.unassignedScheduledJobs.map((job) => job.id),
      ...activeCalendar.backlogJobs.map((job) => job.id)
    ]
  );
  const visibleTechnicianIds = dispatchSurfaceCalendar.resources.map(
    (resource) => resource.technicianUserId
  );

  useEffect(() => {
    setActiveCalendar(calendar);
    setPendingVisitIds([]);
    setOptimisticPromiseSummariesByJobId({});
  }, [calendar]);

  useEffect(() => {
    setClockNow(new Date(renderedAt));
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [renderedAt]);

  useEffect(() => {
    try {
      const pinnedTarget = readPinnedHotThread(window.localStorage);
      setSharedPinnedVisitId(pinnedTarget?.kind === "visit" ? pinnedTarget.id : null);
    } catch {
      setSharedPinnedVisitId(null);
    }

    const handleHotThreadTarget = (event: Event) => {
      const detail = (event as CustomEvent<HotThreadTargetEventDetail>).detail;
      const nextVisitId = detail?.target?.kind === "visit" ? detail.target.id : null;
      setSharedPinnedVisitId(nextVisitId);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== pinnedHotThreadStorageKey) {
        return;
      }

      try {
        const pinnedTarget = readPinnedHotThread(window.localStorage);
        setSharedPinnedVisitId(pinnedTarget?.kind === "visit" ? pinnedTarget.id : null);
      } catch {
        setSharedPinnedVisitId(null);
      }
    };

    window.addEventListener(hotThreadTargetEventName, handleHotThreadTarget as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(hotThreadTargetEventName, handleHotThreadTarget as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const nextVisitId =
      currentState.jobId || (sharedPinnedVisitId && visibleVisitIds.has(sharedPinnedVisitId) ? sharedPinnedVisitId : "") || "";

    setSelectedVisitId((current) => (current === (nextVisitId || null) ? current : nextVisitId || null));
  }, [currentState.jobId, sharedPinnedVisitId, visibleVisitIds]);

  useEffect(() => {
    const nextJobId = selectedVisitId ?? "";

    if (nextJobId === currentState.jobId) {
      return;
    }

    startRouting(() => {
      router.replace(buildDispatchCalendarHref(currentState, { jobId: nextJobId }), {
        scroll: false
      });
    });
  }, [currentState, router, selectedVisitId, startRouting]);

  useEffect(() => {
    if (!selectedVisitId) {
      return;
    }

    const stillExists = visibleVisitIds.has(selectedVisitId);

    if (!stillExists) {
      if (selectedVisitId === currentState.jobId || selectedVisitId === sharedPinnedVisitId) {
        return;
      }

      syncSelectedVisit(null);
    }
  }, [currentState.jobId, selectedVisitId, sharedPinnedVisitId, visibleVisitIds]);

  useEffect(() => {
    if (!placementHighlightVisitId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPlacementHighlightVisitId((current) =>
        current === placementHighlightVisitId ? null : current
      );
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [placementHighlightVisitId]);

  useEffect(() => {
    if (!placementHighlightVisitId) {
      return;
    }

    const isPlacedVisitVisible = activeCalendar.jobs.some((job) => job.id === placementHighlightVisitId);

    if (!isPlacedVisitVisible) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(`dispatch-job-${placementHighlightVisitId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeCalendar.jobs, placementHighlightVisitId]);

  useEffect(() => {
    if (!selectedAvailabilityBlockId) {
      return;
    }

    const stillExists = activeCalendar.availability.some(
      (block) => block.id === selectedAvailabilityBlockId
    );

    if (!stillExists) {
      setSelectedAvailabilityBlockId(null);
    }
  }, [activeCalendar.availability, selectedAvailabilityBlockId]);

  useEffect(() => {
    if (selectedAvailabilityBlock) {
      setUtilityTrayOpen(true);
    }
  }, [selectedAvailabilityBlock]);

  useEffect(() => {
    if (!currentState.includeUnassigned) {
      setQueuePanelOpen(false);
    }
  }, [currentState.includeUnassigned]);

  useEffect(() => {
    if (openQueueCount === 0 && queuePanelOpen) {
      setQueuePanelOpen(false);
    }
  }, [openQueueCount, queuePanelOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncViewport = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!isCompactViewport) {
      setHasAutoOpenedCompactQueue(false);
      return;
    }

    setOperationsRailOpen(false);
  }, [isCompactViewport]);

  useEffect(() => {
    if (!isCompactViewport || !currentState.includeUnassigned || hasAutoOpenedCompactQueue) {
      return;
    }

    setQueuePanelOpen(true);
    setHasAutoOpenedCompactQueue(true);
  }, [currentState.includeUnassigned, hasAutoOpenedCompactQueue, isCompactViewport]);

  const visibleTechnicians = technicians.filter((technician) =>
    visibleTechnicianIds.includes(technician.userId)
  );
  const orderedTechnicians = [...technicians].sort((left, right) => {
    const leftVisibleIndex = visibleTechnicianIds.indexOf(left.userId);
    const rightVisibleIndex = visibleTechnicianIds.indexOf(right.userId);

    if (leftVisibleIndex !== -1 || rightVisibleIndex !== -1) {
      const safeLeftIndex = leftVisibleIndex === -1 ? Number.MAX_SAFE_INTEGER : leftVisibleIndex;
      const safeRightIndex = rightVisibleIndex === -1 ? Number.MAX_SAFE_INTEGER : rightVisibleIndex;

      if (safeLeftIndex !== safeRightIndex) {
        return safeLeftIndex - safeRightIndex;
      }
    }

    return left.displayName.localeCompare(right.displayName);
  });
  const selectedSingleTechnicianId =
    currentState.resourceUserIds[0] ??
    visibleTechnicianIds[0] ??
    orderedTechnicians[0]?.userId ??
    "";
  const roleFocus = buildDispatchRoleFocus({
    currentState,
    operatorRole,
    selectedVisitId: selectedVisitId,
    selectedSingleTechnicianId
  });
  const dispatchSavedSliceSuggestions = [
    {
      href: currentDispatchSliceHref,
      id: "live-board",
      label:
        currentState.scope === "single_tech"
          ? "Focused lane"
          : currentState.view === "week"
            ? "Weekly board"
            : "Recovery board",
      tone: "ghost" as const
    },
    {
      href: crewOverviewHref,
      id: "crew-overview",
      label: "Crew overview",
      tone: "ghost" as const
    },
    ...(roleFocus?.links.map((link) => ({
      href: link.href,
      id: `role:${link.label}`,
      label: link.label,
      tone: link.tone
    })) ?? []),
    ...savedViews.slice(0, 4).map((savedView) => ({
      href: buildDispatchCalendarHref(currentState, {
        includeUnassigned: savedView.includeUnassigned,
        jobId: "",
        resourceUserIds: [],
        savedViewId: savedView.id,
        scope: savedView.scope,
        view: savedView.view
      }),
      id: `saved:${savedView.id}`,
      label: savedView.name,
      tone: "ghost" as const
    }))
  ].filter(
    (slice, index, collection) =>
      collection.findIndex((candidate) => candidate.href === slice.href) === index
  );
  const currentDispatchSliceLabel =
    selectedSavedView?.name ??
    (currentState.scope === "single_tech"
      ? "Focused lane"
      : currentState.view === "week"
        ? "Weekly board"
        : "Recovery board");
  const selectedConflictScope = focusedConflictTechnicianUserId
    ? activeCalendar.conflicts.filter(
        (conflict) => conflict.technicianUserId === focusedConflictTechnicianUserId
      )
    : activeCalendar.conflicts;
  const focusedResourceUserId =
    currentState.scope === "single_tech"
      ? selectedSingleTechnicianId || null
      : selectedScheduledVisit?.resourceTechnicianUserId ?? null;
  const focusedResource =
    focusedResourceUserId
      ? dispatchSurfaceCalendar.resources.find(
          (resource) => resource.technicianUserId === focusedResourceUserId
        ) ?? null
      : null;
  const focusedTechnician =
    selectedSingleTechnicianId
      ? orderedTechnicians.find((technician) => technician.userId === selectedSingleTechnicianId) ?? null
      : null;
  const selectedVisitSignal = selectedVisit
    ? getDispatchVisitOperationalSignal(selectedVisit, activeCalendar.timezone, clockNow)
    : null;
  const selectedVisitSupportingText = selectedVisit
    ? getDispatchVisitSupportingText(selectedVisit, activeCalendar.timezone)
    : null;
  const selectedVisitPromiseSummary = selectedVisit
    ? promiseSummariesByJobId.get(selectedVisit.id) ?? null
    : null;
  const createInterventionSummaryItem = (item: DispatchInterventionSummaryItem) => item;
  const createInterventionAction = (item: DispatchInterventionAction) => item;
  const dispatchInterventionSummaryItems: DispatchInterventionSummaryItem[] = [
    conflictSummary.total
      ? createInterventionSummaryItem({
          count: conflictSummary.total,
          id: "conflicts",
          label: `${conflictSummary.total} conflict${conflictSummary.total === 1 ? "" : "s"}`,
          onClick: handleToggleConflicts,
          score: conflictSummary.total * 1000,
          secondary: conflictSummary.dangerCount
            ? `${conflictSummary.dangerCount} danger`
            : `${conflictSummary.warningCount} warning`,
          tone: "danger" as const
        })
      : null,
    promiseRiskCount
      ? createInterventionSummaryItem({
          count: promiseRiskCount,
          href: visitsPromiseRiskHref,
          id: "promise_risk",
          label: `${promiseRiskCount} promise risk`,
          score: promiseRiskCount * 100,
          secondary: "needs follow-through",
          tone: "danger" as const
        })
      : null,
    readyQueueCount
      ? createInterventionSummaryItem({
          count: readyQueueCount,
          href: visitsReadyDispatchHref,
          id: "ready_release",
          label: `${readyQueueCount} ready to release`,
          score: readyQueueCount * 90,
          secondary: "to route",
          tone: "brand" as const
        })
      : null,
    staleApprovalCount
      ? createInterventionSummaryItem({
          count: staleApprovalCount,
          href: visitsStaleApprovalHref,
          id: "stale_approval",
          label: `${staleApprovalCount} stale approval${staleApprovalCount === 1 ? "" : "s"}`,
          score: staleApprovalCount * 88,
          secondary: "need follow-up",
          tone: "warning" as const
        })
      : null,
    staleFollowUpVisitCount
      ? createInterventionSummaryItem({
          count: staleFollowUpVisitCount,
          href: visitsStaleReturnVisitHref,
          id: "stale_return",
          label: `${staleFollowUpVisitCount} stale return${staleFollowUpVisitCount === 1 ? "" : "s"}`,
          score: staleFollowUpVisitCount * 84,
          secondary: "need recovery",
          tone: "brand" as const
        })
      : null,
    supplyBlockedCount
      ? createInterventionSummaryItem({
          count: supplyBlockedCount,
          href: "/dashboard/supply",
          id: "supply_blocked",
          label: `${supplyBlockedCount} supply blocked`,
          score: supplyBlockedCount * 80,
          secondary: "need sourcing",
          tone: "warning" as const
        })
      : null,
    closeoutRiskCount
      ? createInterventionSummaryItem({
          count: closeoutRiskCount,
          href: "/dashboard/finance",
          id: "closeout_risk",
          label: `${closeoutRiskCount} finance follow-up`,
          score: closeoutRiskCount * 76,
          secondary: "awaiting collection",
          tone: "brand" as const
        })
      : null,
    lowConfidenceCount
      ? createInterventionSummaryItem({
          count: lowConfidenceCount,
          href: visitsPromiseRiskHref,
          id: "low_confidence",
          label: `${lowConfidenceCount} weak promise${lowConfidenceCount === 1 ? "" : "s"}`,
          score: lowConfidenceCount * 72,
          secondary: "should defer",
          tone: "warning" as const
        })
      : null,
    openQueueCount
      ? createInterventionSummaryItem({
          count: openQueueCount,
          href: visitsNeedsAssignmentHref,
          id: "queue_waiting",
          label: `${openQueueCount} waiting`,
          score: openQueueCount * 60,
          secondary: "need route decisions",
          tone: "warning" as const
        })
      : null
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const dispatchDominantInterventionAction: DispatchInterventionAction | null = [
    promiseRiskCount
      ? createInterventionAction({
          copy: "Push timing recovery from Dispatch before the next promised stop slips further.",
          id: "promise_risk",
          kind: "batch" as const,
          label: "Queue risk updates",
          onClick: () => {
            void handleNotifyPromiseRiskBatch();
          },
          pending: batchInterventionPending === "notify_promise_risk",
          score: promiseRiskCount * 100,
          title: `${promiseRiskCount} promised stop${promiseRiskCount === 1 ? "" : "s"} need a next move`
        })
      : null,
    readyQueueCount
      ? createInterventionAction({
          copy: "Commercially ready work should move into lane placement from Dispatch, not wait in a side desk.",
          href: visitsReadyDispatchHref,
          id: "ready_release",
          kind: "link" as const,
          label: "Open release runway",
          score: readyQueueCount * 90,
          title: `${readyQueueCount} visit${readyQueueCount === 1 ? "" : "s"} ready for lane placement`
        })
      : null,
    staleApprovalCount
      ? createInterventionAction({
          copy: "Keep estimate follow-up visible here when approvals are the hottest blocker.",
          id: "stale_approval",
          kind: "batch" as const,
          label: "Queue approval reminders",
          onClick: () => {
            void handleNotifyStaleApprovalsBatch();
          },
          pending: batchInterventionPending === "notify_stale_approvals",
          score: staleApprovalCount * 88,
          title: `${staleApprovalCount} sent estimate${staleApprovalCount === 1 ? "" : "s"} need follow-up`
        })
      : null,
    staleFollowUpVisitCount
      ? createInterventionAction({
          copy: "Keep return-work recovery visible here when second-trip work is slipping.",
          id: "stale_return",
          kind: "batch" as const,
          label: "Queue return updates",
          onClick: () => {
            void handleNotifyStaleReturnsBatch();
          },
          pending: batchInterventionPending === "notify_stale_returns",
          score: staleFollowUpVisitCount * 84,
          title: `${staleFollowUpVisitCount} return visit${staleFollowUpVisitCount === 1 ? "" : "s"} need recovery`
        })
      : null,
    supplyBlockedCount
      ? createInterventionAction({
          copy: "Approved or scheduled work is still waiting on sourcing or stock recovery. Keep those blockers visible from Dispatch.",
          href: "/dashboard/supply",
          id: "supply_blocked",
          kind: "link" as const,
          label: "Open supply blockers",
          score: supplyBlockedCount * 80,
          title: `${supplyBlockedCount} visit${supplyBlockedCount === 1 ? "" : "s"} are still blocked by supply`
        })
      : null,
    closeoutRiskCount
      ? createInterventionAction({
          copy: "Push payment follow-through from Dispatch when open-balance threads are cooling off.",
          id: "closeout_risk",
          kind: "batch" as const,
          label: "Queue payment nudges",
          onClick: () => {
            void handleNotifyCloseoutRiskBatch();
          },
          pending: batchInterventionPending === "notify_closeout_risk",
          score: closeoutRiskCount * 76,
          title: `${closeoutRiskCount} money thread${closeoutRiskCount === 1 ? "" : "s"} need closeout follow-through`
        })
      : null,
    lowConfidenceCount
      ? createInterventionAction({
          copy: "Pull uncertain promised stops back out of the live board before the crew burns time on weak timing commitments.",
          id: "low_confidence",
          kind: "batch" as const,
          label: "Pull weak promises",
          onClick: () => {
            void handleDeferLowConfidenceBatch();
          },
          pending: batchInterventionPending === "defer_low_confidence",
          score: lowConfidenceCount * 72,
          title: `${lowConfidenceCount} stop${lowConfidenceCount === 1 ? "" : "s"} should move back for replanning`
        })
      : null
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.score - left.score)[0] ?? null;
  const activeThreadBoardContext: DispatchThreadBoardContext = selectedVisit
    ? {
        dayDate:
          selectedScheduledVisit?.dayDate ??
          (selectedVisit.scheduledStartAt
            ? getDispatchLocalDate(selectedVisit.scheduledStartAt, activeCalendar.timezone)
            : null),
        resourceTechnicianUserId:
          selectedScheduledVisit?.resourceTechnicianUserId ??
          selectedVisit.assignedTechnicianUserId ??
          null,
        visitId: selectedVisit.id
      }
    : null;
  const dispatchCommandBadges: OperationalFocusBadge[] = dispatchInterventionSummaryItems.length
    ? dispatchInterventionSummaryItems.slice(0, 1).map((item) => ({
        label: item.label,
        tone: item.tone
      }))
    : [
        {
          label:
            currentState.view === "month"
              ? "Route planning"
              : currentState.view === "week"
                ? "Weekly board"
                : "Live board",
          tone: "brand"
        },
      ];
  const dispatchCommandBlockers: OperationalFocusItem[] = [
    conflictSummary.total
      ? {
          detail: conflictSummary.dangerCount
            ? `${conflictSummary.dangerCount} danger conflict${conflictSummary.dangerCount === 1 ? "" : "s"} need lane recovery before more work moves.`
            : `${conflictSummary.warningCount} warning conflict${conflictSummary.warningCount === 1 ? "" : "s"} are still reducing dispatch confidence.`,
          label: "Lane conflicts",
          tone: "danger" as const,
          value: `${conflictSummary.total} active`
        }
      : null,
    promiseRiskCount
      ? {
          detail: `${promiseRiskCount} promised stop${promiseRiskCount === 1 ? "" : "s"} are at or beyond their timing commitment and should be owned from Dispatch first.`,
          label: "Promise risk",
          tone: "danger" as const,
          value: `${promiseRiskCount} late`
        }
      : null,
    staleApprovalCount
      ? {
          detail: `${staleApprovalCount} estimate follow-up thread${staleApprovalCount === 1 ? "" : "s"} are still holding work movement back.`,
          label: "Approvals",
          tone: "warning" as const,
          value: `${staleApprovalCount} waiting`
        }
      : null,
    supplyBlockedCount
      ? {
          detail: `${supplyBlockedCount} visit${supplyBlockedCount === 1 ? "" : "s"} are commercially ready or scheduled but still blocked by parts or stock recovery.`,
          label: "Supply blockers",
          tone: "warning" as const,
          value: `${supplyBlockedCount} blocked`
        }
      : null,
    lowConfidenceCount
      ? {
          detail: `${lowConfidenceCount} stop${lowConfidenceCount === 1 ? "" : "s"} still carry weak promise confidence and may need to come back out of the live board.`,
          label: "Weak promises",
          tone: "warning" as const,
          value: `${lowConfidenceCount} low confidence`
        }
      : null
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);
  const dispatchCommandFollowThrough: OperationalFocusItem[] = [
    readyQueueCount
      ? {
          detail: `${readyQueueCount} visit${readyQueueCount === 1 ? "" : "s"} are commercially ready and should move into lane placement from this board, not get buried in Visits.`,
          label: "Release runway",
          value: `${readyQueueCount} ready`
        }
      : null,
    closeoutRiskCount
      ? {
          detail: `${closeoutRiskCount} money thread${closeoutRiskCount === 1 ? "" : "s"} still need customer nudges or finance ownership after field execution is done.`,
          label: "Closeout follow-through",
          value: `${closeoutRiskCount} active`
        }
      : null,
    staleFollowUpVisitCount
      ? {
          detail: `${staleFollowUpVisitCount} return visit${staleFollowUpVisitCount === 1 ? "" : "s"} still need recovery ownership before the day closes cleanly.`,
          label: "Return work",
          value: `${staleFollowUpVisitCount} stale`
        }
      : null,
    focusedResource
      ? {
          detail: `${focusedResource.displayName} is currently the active lane context on this board.`,
          label: "Lane in focus",
          value: focusedResource.displayName
        }
      : focusedTechnician
        ? {
            detail: `${focusedTechnician.displayName} is the current single-lane focus for dispatch decisions.`,
            label: "Lane in focus",
            value: focusedTechnician.displayName
          }
        : null
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);
  const dispatchCommandActions: OperationalFocusAction[] = [
    openQueueCount
      ? {
          href: visitsNeedsAssignmentHref,
          label: "Open visit queue",
          tone: "secondary" as const
        }
      : null,
    readyQueueCount
      ? {
          href: visitsReadyDispatchHref,
          label: "Open release runway",
          tone: "secondary" as const
        }
      : null,
    roleFocus?.links[0]
      ? {
          href: roleFocus.links[0].href,
          label: roleFocus.links[0].label,
          tone: roleFocus.links[0].tone as ButtonTone
        }
      : null,
    {
      href: crewOverviewHref,
      label: "Weekly crew view",
      tone: "tertiary" as const
    }
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 4);
  const topSameDayInsertionSuggestion = sameDayInsertionSuggestions[0] ?? null;
  const topPromiseRiskJob = promiseRiskJobs[0] ?? null;
  const topPromiseRiskDispatchHref = topPromiseRiskJob
    ? buildDispatchCalendarHref(currentState, {
        jobId: topPromiseRiskJob.id
      })
    : null;
  const topPromiseConfidenceSummary = topPromiseRiskJob
    ? promiseSummariesByJobId.get(topPromiseRiskJob.id) ?? null
    : null;
  const topSameDayInsertionDispatchHref = topSameDayInsertionSuggestion
    ? buildDispatchCalendarHref(currentState, {
        includeUnassigned: true,
        jobId: topSameDayInsertionSuggestion.jobId
      })
    : null;
  const topRouteConfidence =
    topSameDayInsertionSuggestion?.suggestions[0]?.routeConfidence ?? null;
  const dispatchFocusSignals: OperationalFocusItem[] = [
    topPromiseConfidenceSummary
      ? {
          detail: topPromiseConfidenceSummary.copy,
          label: "Promise confidence",
          tone: topPromiseConfidenceSummary.tone,
          value: `${topPromiseConfidenceSummary.confidencePercent}% · ${topPromiseConfidenceSummary.confidenceLabel}`
        }
      : null,
    topRouteConfidence
      ? {
          detail: topRouteConfidence.copy,
          label: "Route confidence",
          tone: topRouteConfidence.tone,
          value: `${topRouteConfidence.confidencePercent}% · ${topRouteConfidence.label}`
        }
      : null,
    dispatchCommandBlockers[0] ?? null,
    dispatchCommandFollowThrough[0] ?? null,
    topSameDayInsertionSuggestion
      ? {
          detail: "Dispatch already has a ranked lane fit for waiting same-day work.",
          label: "Same-day fit",
          tone: "brand" as const,
          value: `${sameDayInsertionSuggestions.length} waiting`
        }
      : null,
    ...dispatchCommandBlockers.slice(1),
    ...dispatchCommandFollowThrough.slice(1)
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, operatorFocusMode ? 1 : 2);
  const dispatchNextMove = selectedVisit
    ? {
        actionHref: buildVisitThreadHref(selectedVisit.id, {
          returnLabel: "Back to dispatch",
          returnTo: dispatchReturnHref
        }),
        actionLabel: "Open visit thread",
        detail: `${selectedVisit.customerDisplayName} · ${selectedVisit.vehicleDisplayName}. ${selectedVisitSupportingText ?? "Keep the selected visit tied to lane decisions, customer timing, and follow-through."}`,
        label: selectedVisitSignal
          ? `${selectedVisit.title} · ${selectedVisitSignal.label}`
          : selectedVisit.title,
        tone: "primary" as const
      }
    : conflictSummary.total
      ? {
          actionHref: buildDispatchCalendarHref(currentState, {
            includeUnassigned: true,
            resourceUserIds: [],
            savedViewId: "",
            scope: "all_workers",
            view: "day"
          }),
          actionLabel: "Open recovery",
          detail: "Lane conflicts are outranking routine routing. Clear the highest-risk overlap before placing more work.",
          label: `${conflictSummary.total} lane conflict${conflictSummary.total === 1 ? "" : "s"} need cleanup`,
          tone: "primary" as const
        }
      : promiseRiskCount
        ? {
            actionHref: topPromiseRiskDispatchHref ?? visitsPromiseRiskHref,
            actionLabel: "Recover top risk",
            detail: "Customer timing recovery is the hottest operational problem on the board right now.",
            label: `${promiseRiskCount} promise-risk stop${promiseRiskCount === 1 ? "" : "s"} need intervention`,
            tone: "primary" as const
          }
        : topSameDayInsertionSuggestion
        ? {
            actionHref: topSameDayInsertionDispatchHref,
            actionLabel: "Open top fit",
            detail: topSameDayInsertionSuggestion.suggestions[0]
              ? `${topSameDayInsertionSuggestion.suggestions[0].routeConfidence.label} · ${topSameDayInsertionSuggestion.suggestions[0].routeConfidence.copy}`
              : "Dispatch already has a ranked same-day insertion target. Confirm the thread and place it from the recovery surface before it cools off.",
            label: `${sameDayInsertionSuggestions.length} same-day insert${
              sameDayInsertionSuggestions.length === 1 ? "" : "s"
            } already fit a lane`,
              tone: "primary" as const
            }
        : readyQueueCount
          ? {
              actionHref: visitsReadyDispatchHref,
              actionLabel: "Open release runway",
              detail: "Commercially ready work is waiting for lane placement and should move from Visits into Dispatch now.",
              label: `${readyQueueCount} visit${readyQueueCount === 1 ? "" : "s"} ready for lane placement`,
              tone: "primary" as const
            }
          : openQueueCount
            ? {
                actionHref: visitsNeedsAssignmentHref,
                actionLabel: "Open visit queue",
                detail: "Unassigned or unscheduled work is the next best source of board movement.",
                label: `${openQueueCount} visit${openQueueCount === 1 ? "" : "s"} waiting for route decisions`,
                tone: "primary" as const
              }
            : {
                actionHref: buildDispatchCalendarHref(currentState, {
                  includeUnassigned: true,
                  resourceUserIds: [],
                  savedViewId: "",
                  scope: "all_workers",
                  view: "day"
                }),
                actionLabel: "Open day board",
                detail: "No single blocker is dominating Dispatch. Use the board to protect route quality and keep future capacity clean.",
                label: focusedTechnician ? `Review ${focusedTechnician.displayName}'s lane` : "Keep the board steady",
                tone: "secondary" as const
              };
  const laneRecoveryCards = activeCalendar.resources
    .map((resource) => {
      const laneJobs = activeCalendar.jobs
        .filter((job) => job.resourceTechnicianUserId === resource.technicianUserId)
        .sort((left, right) => Date.parse(left.eventStartAt) - Date.parse(right.eventStartAt));
      const atRiskJobs = laneJobs.filter(
        (job) => getDispatchVisitOperationalSignal(job, activeCalendar.timezone, clockNow).tone === "danger"
      );
      const liveJob =
        laneJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status)) ?? null;
      const laneFollowThrough = laneFollowThroughByResourceId.get(resource.technicianUserId) ?? {
        attentionCount: 0,
        dangerCount: 0,
        highestRiskTone: "neutral" as const,
        staleLabel: "No follow-through due",
        staleMinutes: null
      };
      const followThroughPressure = getDispatchLaneFollowThroughPressureScore(laneFollowThrough);
      const score =
        resource.conflictCount * 1000 +
        followThroughPressure +
        resource.backlogCount * 180 +
        atRiskJobs.length * 160 +
        (liveJob ? 40 : 0);

      return {
        copy:
          resource.conflictCount > 0
            ? `${resource.conflictCount} conflict${resource.conflictCount === 1 ? "" : "s"} are weakening lane confidence right now.`
            : laneFollowThrough.attentionCount > 0
              ? `${laneFollowThrough.attentionCount} live timing thread${
                  laneFollowThrough.attentionCount === 1 ? "" : "s"
                } still need follow-through here. ${laneFollowThrough.staleLabel}.`
            : atRiskJobs[0]
              ? `${atRiskJobs[0].title} is slipping inside ${resource.displayName}'s lane and needs recovery ownership.`
              : resource.backlogCount > 0
                ? `${resource.backlogCount} backlog stop${resource.backlogCount === 1 ? "" : "s"} are still riding behind active work in this lane.`
                : liveJob
                  ? `${resource.displayName} is live on ${liveJob.title} and needs a cleaner next move before more work is inserted.`
                  : "This lane needs a deliberate review before Dispatch trusts it again.",
        leadJob: atRiskJobs[0] ?? liveJob ?? laneJobs[0] ?? null,
        leadPromiseSummary:
          (atRiskJobs[0] ?? liveJob ?? laneJobs[0] ?? null)
            ? promiseSummariesByJobId.get((atRiskJobs[0] ?? liveJob ?? laneJobs[0])!.id) ?? null
            : null,
        resource,
        score,
        tone:
          resource.conflictCount > 0
            ? ("danger" as const)
            : laneFollowThrough.highestRiskTone === "danger"
              ? ("danger" as const)
              : laneFollowThrough.attentionCount || atRiskJobs.length
              ? ("warning" as const)
              : ("brand" as const),
        value:
          resource.conflictCount > 0
            ? `${resource.conflictCount} conflict${resource.conflictCount === 1 ? "" : "s"}`
            : laneFollowThrough.attentionCount
              ? `${laneFollowThrough.attentionCount} timing risk`
              : atRiskJobs.length
                ? `${atRiskJobs.length} promise risk`
                : `${resource.backlogCount} backlog`
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const releaseLaneCandidates = activeCalendar.resources
    .map((resource) => {
      const laneJobs = activeCalendar.jobs.filter(
        (job) => job.resourceTechnicianUserId === resource.technicianUserId
      );
      const liveJob =
        laneJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status)) ?? null;
      const laneFollowThrough = laneFollowThroughByResourceId.get(resource.technicianUserId) ?? {
        attentionCount: 0,
        dangerCount: 0,
        highestRiskTone: "neutral" as const,
        staleLabel: "No follow-through due",
        staleMinutes: null
      };
      const score =
        resource.conflictCount === 0 && resource.backlogCount === 0
          ? Math.max(
              0,
              320 -
                resource.scheduledCount * 90 -
                (liveJob ? 110 : 0) -
                getDispatchLaneFollowThroughPressureScore(laneFollowThrough)
            )
          : 0;

      return {
        copy:
          laneFollowThrough.attentionCount > 0
            ? `${resource.displayName} still has ${laneFollowThrough.attentionCount} live timing thread${
                laneFollowThrough.attentionCount === 1 ? "" : "s"
              } to stabilize. ${laneFollowThrough.staleLabel}.`
            : liveJob
              ? `${resource.displayName} is still live on ${liveJob.title}, so release here only if the promise window can absorb it.`
              : resource.scheduledCount === 0
                ? "Clean open lane for same-day insertion."
                : resource.scheduledCount === 1
                  ? "Only one scheduled stop is holding this lane."
              : `${resource.scheduledCount} scheduled stops are already committed in this lane.`,
        laneFollowThrough,
        liveJob,
        resource,
        score,
        value:
          laneFollowThrough.attentionCount > 0
            ? `${laneFollowThrough.attentionCount} timing risk`
            : resource.scheduledCount === 0
              ? "Open lane"
              : `${resource.scheduledCount} scheduled stop${resource.scheduledCount === 1 ? "" : "s"}`
      };
    })
    .sort((left, right) => right.score - left.score);
  const laneReleaseCards =
    readyQueueCount || openQueueCount
      ? releaseLaneCandidates.filter((candidate) => candidate.score > 0).slice(0, 3)
      : [];
  const approvedReleaseRunwayVisits = [
    ...activeCalendar.backlogJobs.filter((job) => approvedReleaseJobIdSet.has(job.id)),
    ...activeCalendar.unassignedScheduledJobs.filter((job) => approvedReleaseJobIdSet.has(job.id))
  ]
    .filter(
      (job, index, jobs) => jobs.findIndex((candidate) => candidate.id === job.id) === index
    )
    .sort((left, right) => {
      const leftPriority =
        left.priority === "urgent" ? 4 : left.priority === "high" ? 3 : left.priority === "normal" ? 2 : 1;
      const rightPriority =
        right.priority === "urgent" ? 4 : right.priority === "high" ? 3 : right.priority === "normal" ? 2 : 1;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftTime = left.scheduledStartAt
        ? Date.parse(left.scheduledStartAt)
        : left.arrivalWindowStartAt
          ? Date.parse(left.arrivalWindowStartAt)
          : Number.MAX_SAFE_INTEGER;
      const rightTime = right.scheduledStartAt
        ? Date.parse(right.scheduledStartAt)
        : right.arrivalWindowStartAt
          ? Date.parse(right.arrivalWindowStartAt)
          : Number.MAX_SAFE_INTEGER;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 3);
  const approvedReleaseLaneSuggestions = releaseLaneCandidates
    .filter((candidate) => candidate.score > 0)
    .map((candidate) => candidate.resource);
  const approvedReleaseFallbackLanes = [
    ...approvedReleaseLaneSuggestions,
    ...releaseLaneCandidates
      .filter((candidate) => candidate.score === 0)
      .map((candidate) => candidate.resource)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  ];
  const usedApprovedReleaseLaneIds = new Set<string>();
  const approvedReleaseRunwayCards = approvedReleaseRunwayVisits.map((visit) => {
    const assignedLane = visit.assignedTechnicianUserId
      ? activeCalendar.resources.find(
          (resource) => resource.technicianUserId === visit.assignedTechnicianUserId
        ) ?? null
      : null;
    const nextSuggestedLane =
      approvedReleaseFallbackLanes.find(
        (resource) => !usedApprovedReleaseLaneIds.has(resource.technicianUserId)
      ) ??
      approvedReleaseFallbackLanes[0] ??
      null;
    const lane = assignedLane ?? nextSuggestedLane;

    if (lane) {
      usedApprovedReleaseLaneIds.add(lane.technicianUserId);
    }

    const laneSuggestion = lane
      ? releaseLaneCandidates.find((candidate) => candidate.resource.technicianUserId === lane.technicianUserId) ??
        null
      : null;

    return {
      lane,
      laneCopy:
        laneSuggestion?.copy ??
        (lane
          ? `${lane.displayName} is the best visible owner lane for this release.`
          : "No clean lane is visible right now. Open the release runway and place this deliberately."),
      promiseCopy: getDispatchVisitSupportingText(visit, activeCalendar.timezone),
      readinessSummary: buildLaneCrewReadinessSummary({
        lane,
        laneCopy:
          laneSuggestion?.copy ??
          (lane
            ? `${lane.displayName} is the best visible owner lane for this release.`
            : "Manual placement review"),
        laneFollowThrough: laneSuggestion?.laneFollowThrough ?? null,
        liveJobTitle: laneSuggestion?.liveJob?.title ?? null,
        valueLabel: laneSuggestion?.value ?? (lane ? "Manual lane review" : "Needs placement review")
      }),
      value: laneSuggestion?.value ?? (lane ? "Manual lane review" : "Needs placement review"),
      visit
    };
  });
  const activeQueueJobsById = new Map(
    [...activeCalendar.unassignedScheduledJobs, ...activeCalendar.backlogJobs].map(
      (job) => [job.id, job] as const
    )
  );
  const visibleSameDayInsertionSuggestions = sameDayInsertionSuggestions
    .map((suggestion) => {
      const activeQueueVisit = activeQueueJobsById.get(suggestion.jobId);

      if (!activeQueueVisit) {
        return null;
      }

      return {
        ...suggestion,
        visit: activeQueueVisit
      };
    })
    .filter((suggestion): suggestion is DispatchSameDayInsertionSuggestion => Boolean(suggestion));
  const selectedVisitApprovedReleaseCard = selectedVisit
    ? approvedReleaseRunwayCards.find((candidate) => candidate.visit.id === selectedVisit.id) ?? null
    : null;
  const selectedVisitSameDayFitSuggestion = selectedVisit
    ? visibleSameDayInsertionSuggestions.find((candidate) => candidate.visit.id === selectedVisit.id) ?? null
    : null;
  const selectedVisitSupplyBlock = selectedVisit
    ? supplyBlockedItems.find((item) => item.jobId === selectedVisit.id) ?? null
    : null;
  const selectedVisitCloseoutRiskItem = selectedVisit
    ? closeoutRiskItems.find((item) => item.jobId === selectedVisit.id) ?? null
    : null;
  const recoveryCloseoutItems = selectedVisitCloseoutRiskItem
    ? [
        selectedVisitCloseoutRiskItem,
        ...closeoutRiskItems.filter((item) => item.jobId !== selectedVisitCloseoutRiskItem.jobId)
      ]
    : closeoutRiskItems;
  const visibleRecoveryCloseoutItems = recoveryCloseoutItems.slice(
    0,
    operatorFocusMode ? 1 : 2
  );
  const overflowRecoveryCloseoutItems = recoveryCloseoutItems.slice(operatorFocusMode ? 1 : 2);
  const selectedVisitWorkflowState = selectedVisit ? getVisitWorkflowState(selectedVisit) : null;
  const selectedVisitQueueState = selectedVisit ? getDispatchQueueState(selectedVisit) : null;
  const selectedVisitFocusLaneId =
    selectedScheduledVisit?.resourceTechnicianUserId ??
    selectedVisit?.assignedTechnicianUserId ??
    selectedVisitApprovedReleaseCard?.lane?.technicianUserId ??
    selectedVisitSameDayFitSuggestion?.suggestions[0]?.technicianUserId ??
    null;
  const selectedVisitFocusLane =
    (selectedVisitFocusLaneId
      ? dispatchSurfaceCalendar.resources.find(
          (resource) => resource.technicianUserId === selectedVisitFocusLaneId
        ) ?? null
      : null) ??
    (selectedVisitFocusLaneId
      ? orderedTechnicians.find((technician) => technician.userId === selectedVisitFocusLaneId)
        ? {
            displayName:
              orderedTechnicians.find((technician) => technician.userId === selectedVisitFocusLaneId)?.displayName ??
              "Focused lane",
            technicianUserId: selectedVisitFocusLaneId
          }
        : null
      : null);
  const selectedVisitThreadAlerts = selectedVisit
    ? [
        hasPromiseIntervention(selectedVisit)
          ? {
              copy:
                selectedVisitPromiseSummary?.copy ??
                selectedVisitSupportingText ??
                "Customer timing is already at risk and needs a Dispatch-owned recovery move.",
              label: "Promise risk",
              tone:
                selectedVisitPromiseSummary?.tone === "warning" ? ("warning" as const) : ("danger" as const),
              value: selectedVisitPromiseSummary?.label ?? selectedVisitSignal?.label ?? "Timing at risk"
            }
          : null,
        selectedVisitApprovedReleaseCard
          ? {
              copy: selectedVisitApprovedReleaseCard.laneCopy,
              label: "Approved release",
              tone: "brand" as const,
              value: selectedVisitApprovedReleaseCard.value
            }
          : null,
        staleApprovalJobIds.includes(selectedVisit.id)
          ? {
              copy: "Estimate approval follow-up is still blocking clean route movement for this visit.",
              label: "Approval follow-up",
              tone: "warning" as const,
              value: "Reminder due"
            }
          : null,
        selectedVisitSupplyBlock
          ? {
              copy: `${selectedVisitSupplyBlock.supplyBlockerCount} supply blocker${
                selectedVisitSupplyBlock.supplyBlockerCount === 1 ? "" : "s"
              } are still holding this visit back.`,
              label: "Supply blocker",
              tone: "warning" as const,
              value: `${selectedVisitSupplyBlock.supplyBlockerCount} open`
            }
          : null,
        selectedVisitCloseoutRiskItem
          ? {
              copy: "Field execution is moving, but the cash thread still needs ownership.",
              label: "Closeout risk",
              tone: "warning" as const,
              value: new Intl.NumberFormat("en-US", {
                currency: "USD",
                style: "currency"
              }).format(selectedVisitCloseoutRiskItem.balanceDueCents / 100)
            }
          : null,
        lowConfidenceJobIds.includes(selectedVisit.id)
          ? {
              copy: "This visit is still carrying weak promise confidence and may need to come back off the board.",
              label: "Weak promise",
              tone: "warning" as const,
              value: "Low confidence"
            }
          : null,
        staleFollowUpJobIds.includes(selectedVisit.id)
          ? {
              copy: "A return-work or follow-up thread is still aging against this visit.",
              label: "Return work",
              tone: "warning" as const,
              value: "Stale follow-up"
            }
          : null
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3)
    : [];
  const selectedVisitThreadSummaryBadges = [
    selectedVisitSignal
      ? { label: selectedVisitSignal.label, tone: selectedVisitSignal.tone }
      : null,
    selectedVisitQueueState
      ? {
          label: getDispatchQueueLabel(selectedVisitQueueState),
          tone: selectedVisitQueueState === "ready_now" ? "warning" : "brand"
        }
      : null,
    selectedVisitWorkflowState
      ? {
          label: getVisitWorkflowLabel(selectedVisitWorkflowState),
          tone: getVisitWorkflowTone(selectedVisitWorkflowState)
        }
      : null
  ].filter((item): item is { label: string; tone: "brand" | "danger" | "info" | "neutral" | "progress" | "success" | "warning" } => Boolean(item)).slice(0, 2);
  const collapseSelectedVisitThreadExtras = operatorFocusMode || queuePanelOpen || conflictPanelOpen;
  const showSelectedVisitThreadSummaryBadges =
    !collapseSelectedVisitThreadExtras && selectedVisitThreadSummaryBadges.length > 0;
  const showSelectedVisitThreadAlerts =
    !collapseSelectedVisitThreadExtras && selectedVisitThreadAlerts.length > 0;
  const showSelectedVisitThreadUtilities =
    !collapseSelectedVisitThreadExtras && Boolean(selectedVisitFocusLaneId || selectedVisitSupplyBlock);
  const selectedVisitBoardThreadNeighbors = selectedScheduledVisit?.resourceTechnicianUserId
    ? (() => {
        const selectedLaneIndex = dispatchSurfaceCalendar.resources.findIndex(
          (resource) => resource.technicianUserId === selectedScheduledVisit.resourceTechnicianUserId
        );

        if (selectedLaneIndex === -1) {
          return [];
        }

        return [-1, 1]
          .map((offset) => {
            const resource = dispatchSurfaceCalendar.resources[selectedLaneIndex + offset];

            if (!resource) {
              return null;
            }

            return {
              label: offset < 0 ? "Route to previous lane" : "Route to next lane",
              resource
            };
          })
          .filter((item): item is { label: string; resource: DispatchCalendarData["resources"][number] } =>
            Boolean(item)
          );
      })()
    : [];
  const selectedVisitBoardCanSendUpdate = Boolean(
    selectedVisitPromiseSummary?.recommendedAction &&
      selectedVisitPromiseSummary.recommendedAction !== "set_promise"
  );
  const selectedVisitBoardCanReroute = Boolean(
    selectedScheduledVisit &&
      selectedScheduledVisit.resourceTechnicianUserId &&
      selectedScheduledVisit.status !== "completed" &&
      selectedScheduledVisit.status !== "canceled" &&
      !isTechnicianOnSiteJobStatus(selectedScheduledVisit.status)
  );
  const selectedVisitBoardCanDefer = Boolean(
    selectedVisit &&
      selectedVisit.status !== "completed" &&
      selectedVisit.status !== "canceled" &&
      !isTechnicianOnSiteJobStatus(selectedVisit.status) &&
      (selectedVisit.scheduledStartAt || selectedVisit.arrivalWindowStartAt)
  );
  const selectedVisitThreadLaneActions =
    selectedScheduledVisit && activeThreadBoardContext
      ? {
          canDefer: selectedVisitBoardCanDefer,
          canSendUpdate: selectedVisitBoardCanSendUpdate,
          deferPending: savingQuickEdit,
          onDefer: () => {
            void handleThreadBoardDefer();
          },
          onSendUpdate: () => {
            void handleNotifyPromiseRisk(selectedScheduledVisit.id);
          },
          onTakeLane: (technicianUserId: string) => {
            void handleThreadBoardReroute(technicianUserId);
          },
          reroutePending: pendingVisitIds.includes(selectedScheduledVisit.id),
          sendUpdatePending: batchInterventionPending === "notify_promise_risk",
          sendUpdateLabel: selectedVisitPromiseSummary?.recommendedAction
            ? getDispatchOnBoardFollowThroughActionLabel(
                selectedVisitPromiseSummary.recommendedAction
              )
            : "Send timing update"
        }
      : null;
  const remainingApprovedReleaseRunwayCards = selectedVisit
    ? approvedReleaseRunwayCards.filter((candidate) => candidate.visit.id !== selectedVisit.id)
    : approvedReleaseRunwayCards;
  const remainingSameDayInsertionSuggestions = selectedVisit
    ? visibleSameDayInsertionSuggestions.filter((candidate) => candidate.visit.id !== selectedVisit.id)
    : visibleSameDayInsertionSuggestions;
  const interventionCardLimit = operatorFocusMode || queuePanelOpen ? 1 : 2;
  const visibleApprovedReleaseRunwayCards = remainingApprovedReleaseRunwayCards.slice(0, interventionCardLimit);
  const overflowApprovedReleaseRunwayCards = remainingApprovedReleaseRunwayCards.slice(interventionCardLimit);
  const visibleSameDayInsertionCards = remainingSameDayInsertionSuggestions.slice(0, interventionCardLimit);
  const overflowSameDayInsertionCards = remainingSameDayInsertionSuggestions.slice(interventionCardLimit);
  const visibleLaneRecoveryCards = laneRecoveryCards.slice(0, interventionCardLimit);
  const overflowLaneRecoveryCards = laneRecoveryCards.slice(interventionCardLimit);
  const compactRecoverySections =
    operatorFocusMode ||
    queuePanelOpen ||
    conflictPanelOpen ||
    operationsRailOpen ||
    (currentState.view === "day" && !selectedVisitId);
  const primaryRecoverySection = remainingSameDayInsertionSuggestions.length
    ? surfaceMode === "release_runway" && remainingApprovedReleaseRunwayCards.length
      ? "approved_release"
      : "same_day"
    : remainingApprovedReleaseRunwayCards.length
      ? "approved_release"
      : laneRecoveryCards.length
        ? "lane_recovery"
        : recoveryCloseoutItems.length
          ? "closeout"
          : laneReleaseCards.length
            ? "lane_release"
            : null;
  const collapseSameDayInsertionSection =
    remainingSameDayInsertionSuggestions.length > 0 &&
    (compactRecoverySections || Boolean(selectedVisit) || primaryRecoverySection !== "same_day");
  const collapseApprovedReleaseSection =
    remainingApprovedReleaseRunwayCards.length > 0 &&
    (compactRecoverySections || Boolean(selectedVisit) || primaryRecoverySection !== "approved_release");
  const collapseRecoveryCloseoutSection =
    recoveryCloseoutItems.length > 0 &&
    (compactRecoverySections || Boolean(selectedVisit) || primaryRecoverySection !== "closeout");
  const collapseLaneRecoverySection =
    laneRecoveryCards.length > 0 &&
    (compactRecoverySections || Boolean(selectedVisit) || primaryRecoverySection !== "lane_recovery");
  const collapseLaneReleaseCards =
    laneReleaseCards.length > 0 &&
    (compactRecoverySections || Boolean(selectedVisit) || primaryRecoverySection !== "lane_release");

  function navigate(patch: Partial<typeof currentState>) {
    setError(null);
    setBatchInterventionFeedback(null);
    const href = buildDispatchCalendarHref(currentState, patch);
    startRouting(() => {
      router.push(href, { scroll: false });
    });
  }

  function syncSelectedVisit(jobId: string | null) {
    setSelectedVisitId(jobId);

    if (!jobId) {
      return;
    }

    setSharedPinnedVisitId(jobId);
    emitHotThreadTargetEvent(
      {
        id: jobId,
        kind: "visit"
      },
      {
        pin: true,
        source: "dispatch"
      }
    );
  }

  function refreshCalendar() {
    router.refresh();
  }

  function handleToggleQueue() {
    setError(null);
    setBatchInterventionFeedback(null);
    setConflictPanelOpen(false);
    setUtilityTrayOpen(false);
    setQueuePanelOpen((current) => {
      const next = !current;

      if (next && !isCompactViewport) {
        setOperationsRailOpen(false);
        setSurfaceMode("board");
      }

      return next;
    });
  }

  function handleToggleOperationsRail() {
    setError(null);
    setBatchInterventionFeedback(null);
    setConflictPanelOpen(false);
    setUtilityTrayOpen(false);

    if (selectedVisitId) {
      syncSelectedVisit(null);
      setOperationsRailOpen(true);
      setSurfaceMode("follow_through");
      return;
    }

    setOperationsRailOpen((current) => {
      const next = !current;

      if (next && !isCompactViewport && queuePanelOpen) {
        setQueuePanelOpen(false);
      }

      setSurfaceMode(next ? "follow_through" : "board");

      return next;
    });
  }

  function handleToggleConflicts() {
    if (!activeCalendar.conflicts.length) {
      return;
    }

    syncSelectedVisit(null);
    setUtilityTrayOpen(false);

    if (!isCompactViewport) {
      setQueuePanelOpen(false);
    }

    setConflictPanelOpen((current) => !current);
  }

  function handleToggleUtilities() {
    syncSelectedVisit(null);
    setConflictPanelOpen(false);

    if (!isCompactViewport) {
      setQueuePanelOpen(false);
    }

    setUtilityTrayOpen((current) => !current);
  }

  async function handleBatchIntervention(input: {
    action:
      | "notify_promise_risk"
      | "notify_stale_approvals"
      | "notify_stale_returns"
      | "defer_low_confidence"
      | "notify_closeout_risk"
      | "resolve_closeout_handoff";
    emptyMessage: string;
    jobIds: string[];
    resolutionDisposition?: TechnicianPaymentResolutionDisposition | undefined;
    resolutionNote?: string | null | undefined;
    successCopy: string;
  }) {
    if (!input.jobIds.length) {
      return;
    }

    setError(null);
    setBatchInterventionFeedback(null);
    setBatchInterventionPending(input.action);

    try {
      const payload = await requestJson<{ processedCount: number; skippedCount: number }>(
        "/api/internal/dispatch/calendar/interventions",
        {
          body: {
            action: input.action,
            jobIds: input.jobIds,
            resolutionDisposition: input.resolutionDisposition ?? null,
            resolutionNote: input.resolutionNote ?? null
          }
        }
      );

      setBatchInterventionFeedback(
        payload.processedCount > 0
          ? `${input.action === "resolve_closeout_handoff" ? "Resolved" : "Queued"} ${payload.processedCount} ${input.successCopy}${
              payload.processedCount === 1 ? "" : "s"
            } from dispatch${payload.skippedCount ? `. Skipped ${payload.skippedCount}.` : "."}`
          : input.emptyMessage
      );
      refreshCalendar();
    } catch (interventionError) {
      setError(
        interventionError instanceof Error
          ? interventionError.message
          : "Batch dispatch intervention could not be completed."
      );
    } finally {
      setBatchInterventionPending(null);
    }
  }

  async function handleNotifyPromiseRiskBatch() {
    await handleBatchIntervention({
      action: "notify_promise_risk",
      emptyMessage: "No eligible promise-risk stops were available for a batch update.",
      jobIds: promiseRiskJobs.map((job) => job.id),
      successCopy: "promise-risk update"
    });
  }

  async function handleNotifyPromiseRisk(jobId: string) {
    const previousSummary = promiseSummariesByJobId.get(jobId) ?? null;

    if (previousSummary) {
      setOptimisticPromiseSummariesByJobId((current) => ({
        ...current,
        [jobId]: buildOptimisticQueuedPromiseSummary(previousSummary, new Date())
      }));
    }

    setError(null);
    setBatchInterventionFeedback(null);
    setBatchInterventionPending("notify_promise_risk");

    try {
      const payload = await requestJson<{ processedCount: number; skippedCount: number }>(
        "/api/internal/dispatch/calendar/interventions",
        {
          body: {
            action: "notify_promise_risk",
            jobIds: [jobId]
          }
        }
      );

      if (!payload.processedCount && previousSummary) {
        setOptimisticPromiseSummariesByJobId((current) => {
          const next = { ...current };
          next[jobId] = previousSummary;
          return next;
        });
      }

      setBatchInterventionFeedback(
        payload.processedCount > 0
          ? `Queued ${payload.processedCount} promise-risk update${
              payload.processedCount === 1 ? "" : "s"
            } from dispatch${payload.skippedCount ? `. Skipped ${payload.skippedCount}.` : "."}`
          : "This at-risk visit is not eligible for a customer update right now."
      );
      refreshCalendar();
    } catch (interventionError) {
      if (previousSummary) {
        setOptimisticPromiseSummariesByJobId((current) => {
          const next = { ...current };
          next[jobId] = previousSummary;
          return next;
        });
      }
      setError(
        interventionError instanceof Error
          ? interventionError.message
          : "Batch dispatch intervention could not be completed."
      );
    } finally {
      setBatchInterventionPending(null);
    }
  }

  async function handleNotifyStaleApprovalsBatch() {
    await handleBatchIntervention({
      action: "notify_stale_approvals",
      emptyMessage: "No eligible stale approvals were available for a batch follow-up.",
      jobIds: staleApprovalJobIds,
      successCopy: "stale-approval follow-up"
    });
  }

  async function handleNotifyStaleReturnsBatch() {
    await handleBatchIntervention({
      action: "notify_stale_returns",
      emptyMessage: "No eligible stale return visits were available for a batch update.",
      jobIds: staleFollowUpJobIds,
      successCopy: "return-work update"
    });
  }

  async function handleDeferLowConfidenceBatch() {
    await handleBatchIntervention({
      action: "defer_low_confidence",
      emptyMessage: "No low-confidence stops were available to move back for replanning.",
      jobIds: lowConfidenceJobIds,
      successCopy: "low-confidence stop moved back for replanning"
    });
  }

  async function handleDeferLowConfidence(jobId: string) {
    await handleBatchIntervention({
      action: "defer_low_confidence",
      emptyMessage: "This visit is not eligible to move back for replanning right now.",
      jobIds: [jobId],
      successCopy: "low-confidence stop moved back for replanning"
    });
  }

  async function handleNotifyCloseoutRiskBatch() {
    await handleBatchIntervention({
      action: "notify_closeout_risk",
      emptyMessage: "No closeout-risk threads were eligible for a payment reminder.",
      jobIds: closeoutRiskJobIds,
      successCopy: "closeout reminder"
    });
  }

  async function handleNotifyStaleApproval(jobId: string) {
    await handleBatchIntervention({
      action: "notify_stale_approvals",
      emptyMessage: "This approval thread is not eligible for a reminder right now.",
      jobIds: [jobId],
      successCopy: "stale-approval follow-up"
    });
  }

  async function handleNotifyStaleReturn(jobId: string) {
    await handleBatchIntervention({
      action: "notify_stale_returns",
      emptyMessage: "This return visit is not eligible for a recovery update right now.",
      jobIds: [jobId],
      successCopy: "return-work update"
    });
  }

  async function handleNotifyCloseoutRisk(jobId: string) {
    await handleBatchIntervention({
      action: "notify_closeout_risk",
      emptyMessage: "This closeout thread is not eligible for a payment reminder right now.",
      jobIds: [jobId],
      successCopy: "closeout reminder"
    });
  }

  async function handleResolveCloseoutHandoff(jobId: string, input: DispatchHandoffResolutionInput) {
    await handleBatchIntervention({
      action: "resolve_closeout_handoff",
      emptyMessage: "This closeout thread does not have an open technician handoff to resolve right now.",
      jobIds: [jobId],
      resolutionDisposition: input.resolutionDisposition,
      resolutionNote: input.resolutionNote,
      successCopy: "closeout handoff resolution"
    });
  }

  function getScopeResourceUserIds(scope: DispatchCalendarScope) {
    if (scope === "single_tech") {
      return [
        currentState.resourceUserIds[0] ??
          visibleTechnicianIds[0] ??
          orderedTechnicians[0]?.userId ??
          ""
      ].filter(Boolean);
    }

    if (scope === "subset") {
      return visibleTechnicianIds.length
        ? visibleTechnicianIds
        : orderedTechnicians.map((technician) => technician.userId);
    }

    return [];
  }

  function handleScopeChange(scope: DispatchCalendarScope) {
    navigate({
      resourceUserIds: getScopeResourceUserIds(scope),
      savedViewId: "",
      scope
    });
  }

  function handleSelectSingleTechnician(technicianUserId: string) {
    navigate({
      resourceUserIds: [technicianUserId],
      savedViewId: "",
      scope: "single_tech"
    });
  }

  function focusSingleLane(technicianUserId: string) {
    handleSelectSingleTechnician(technicianUserId);
  }

  function openDayBoard(dayDate: string) {
    navigate({
      date: dayDate,
      savedViewId: "",
      view: "day"
    });
  }

  function focusDispatchTarget(conflict: DispatchCalendarConflict) {
    setFocusedConflictTechnicianUserId(null);
    setConflictPanelOpen(true);

    if (conflict.jobId) {
      setSelectedAvailabilityBlockId(null);
      syncSelectedVisit(conflict.jobId);
      window.requestAnimationFrame(() => {
        document.getElementById(`dispatch-job-${conflict.jobId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });
      });
      return;
    }

    if (conflict.availabilityBlockId) {
      syncSelectedVisit(null);
      setSelectedAvailabilityBlockId(conflict.availabilityBlockId);
      window.requestAnimationFrame(() => {
        document.getElementById(`dispatch-availability-${conflict.availabilityBlockId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });
      });
    }
  }

  function focusResourceConflicts(technicianUserId: string) {
    const technicianConflicts = activeCalendar.conflicts.filter(
      (conflict) => conflict.technicianUserId === technicianUserId
    );

    if (!technicianConflicts.length) {
      return;
    }

    setFocusedConflictTechnicianUserId(technicianUserId);
    setConflictPanelOpen(true);
  }

  async function handleThreadBoardReroute(targetTechnicianUserId: string) {
    if (!selectedScheduledVisit || !selectedScheduledVisit.resourceTechnicianUserId) {
      return;
    }

    if (
      selectedScheduledVisit.status === "completed" ||
      selectedScheduledVisit.status === "canceled" ||
      isTechnicianOnSiteJobStatus(selectedScheduledVisit.status) ||
      targetTechnicianUserId === selectedScheduledVisit.resourceTechnicianUserId
    ) {
      return;
    }

    setPlacementHighlightVisitId(selectedScheduledVisit.id);
    await handleMoveJob(
      buildMoveDispatchInput({
        job: selectedScheduledVisit,
        resourceUserId: targetTechnicianUserId,
        scheduledStartAt: selectedScheduledVisit.eventStartAt,
        settings: activeCalendar.settings,
        timeZone: activeCalendar.timezone
      })
    );
  }

  async function handleThreadBoardDefer() {
    if (
      !selectedVisit ||
      selectedVisit.status === "completed" ||
      selectedVisit.status === "canceled" ||
      isTechnicianOnSiteJobStatus(selectedVisit.status)
    ) {
      return;
    }

    setError(null);
    setSavingQuickEdit(true);
    setPendingVisitIds((current) => [...new Set([...current, selectedVisit.id])]);
    const previousCalendar = activeCalendar;

    setActiveCalendar((current) =>
      applyOptimisticDeferToQueue({
        calendar: current,
        jobId: selectedVisit.id,
        trustScoresByJobId
      })
    );

    try {
      await requestJson<{ job: unknown }>("/api/internal/dispatch/calendar/quick-edit", {
        body: {
          arrivalWindowEndAt: null,
          arrivalWindowStartAt: null,
          jobId: selectedVisit.id,
          scheduledEndAt: null,
          scheduledStartAt: null,
          status: selectedVisit.status === "new" ? "new" : "scheduled"
        }
      });
      refreshCalendar();
    } catch (quickEditError) {
      setActiveCalendar(previousCalendar);
      setError(
        quickEditError instanceof Error
          ? quickEditError.message
          : "Dispatch changes could not be saved."
      );
    } finally {
      setPendingVisitIds((current) => current.filter((value) => value !== selectedVisit.id));
      setSavingQuickEdit(false);
    }
  }

  async function handleMoveJob(input: MoveDispatchJobInput) {
    setError(null);
    setPendingVisitIds((current) => [...new Set([...current, input.jobId])]);
    setActiveCalendar((current) =>
      applyOptimisticMove({
        calendar: current,
        move: input,
        technicianNamesById,
        trustScoresByJobId
      })
    );

    try {
      await requestJson<{ job: unknown }>("/api/internal/dispatch/calendar/move", { body: input });
      refreshCalendar();
    } catch (moveError) {
      setActiveCalendar(calendar);
      setPendingVisitIds((current) => current.filter((value) => value !== input.jobId));
      setError(moveError instanceof Error ? moveError.message : "Visit could not be moved.");
    }
  }

  async function handleResizeJob(input: ResizeDispatchJobInput) {
    setError(null);
    setPendingVisitIds((current) => [...new Set([...current, input.jobId])]);
    setActiveCalendar((current) =>
      applyOptimisticResize({
        calendar: current,
        resize: input
      })
    );

    try {
      await requestJson<{ job: unknown }>("/api/internal/dispatch/calendar/resize", { body: input });
      refreshCalendar();
    } catch (resizeError) {
      setActiveCalendar(calendar);
      setPendingVisitIds((current) => current.filter((value) => value !== input.jobId));
      setError(
        resizeError instanceof Error ? resizeError.message : "Visit duration could not be updated."
      );
    }
  }

  async function handleQuickEditSave(input: QuickEditDispatchJobInput) {
    setError(null);
    setSavingQuickEdit(true);
    const previousCalendar = activeCalendar;
    const currentJob =
      previousCalendar.jobs.find((job) => job.id === input.jobId) ??
      previousCalendar.unassignedScheduledJobs.find((job) => job.id === input.jobId) ??
      previousCalendar.backlogJobs.find((job) => job.id === input.jobId) ??
      null;
    const shouldOptimisticallyPlace =
      Boolean(currentJob) &&
      Boolean(input.scheduledStartAt) &&
      (input.status === "scheduled" || currentJob?.status === "new");
    const targetTechnicianUserId =
      input.assignedTechnicianUserId ?? currentJob?.assignedTechnicianUserId ?? null;

    if (shouldOptimisticallyPlace && currentJob) {
      const scheduledStartAt = input.scheduledStartAt;

      if (!scheduledStartAt) {
        setSavingQuickEdit(false);
        return;
      }

      setPendingVisitIds((current) => [...new Set([...current, input.jobId])]);
      setActiveCalendar((current) =>
        applyOptimisticMove({
          calendar: current,
          move: {
            arrivalWindowEndAt:
              input.arrivalWindowEndAt ?? currentJob.arrivalWindowEndAt ?? currentJob.arrivalWindowStartAt ?? null,
            arrivalWindowStartAt:
              input.arrivalWindowStartAt ?? currentJob.arrivalWindowStartAt ?? null,
            assignedTechnicianUserId:
              input.assignedTechnicianUserId ?? currentJob.assignedTechnicianUserId ?? null,
            jobId: input.jobId,
            scheduledEndAt: input.scheduledEndAt ?? currentJob.scheduledEndAt ?? null,
            scheduledStartAt
          },
          technicianNamesById,
          trustScoresByJobId
        })
      );
      if (targetTechnicianUserId) {
        setPlacementHighlightVisitId(input.jobId);
      }
    }

    try {
      await requestJson<{ job: unknown }>("/api/internal/dispatch/calendar/quick-edit", {
        body: input
      });
      refreshCalendar();
    } catch (quickEditError) {
      if (shouldOptimisticallyPlace) {
        setActiveCalendar(previousCalendar);
        setPlacementHighlightVisitId(null);
      }
      setError(
        quickEditError instanceof Error
          ? quickEditError.message
          : "Dispatch changes could not be saved."
      );
    } finally {
      if (shouldOptimisticallyPlace) {
        setPendingVisitIds((current) => current.filter((value) => value !== input.jobId));
      }
      setSavingQuickEdit(false);
    }
  }

  async function handleCreateAvailabilityBlock(
    input: Omit<CreateTechnicianAvailabilityBlockInput, "companyId" | "createdByUserId">
  ) {
    setError(null);
    setCreatingAvailabilityBlock(true);

    try {
      await requestJson<{ block: unknown }>("/api/internal/dispatch/calendar/availability", {
        body: input
      });
      refreshCalendar();
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Availability block could not be created."
      );
      throw blockError;
    } finally {
      setCreatingAvailabilityBlock(false);
    }
  }

  async function handleUpdateAvailabilityBlock(
    blockId: string,
    input: UpdateTechnicianAvailabilityBlockInput
  ) {
    setError(null);
    setSavingAvailabilityBlockId(blockId);

    try {
      await requestJson<{ block: DispatchCalendarAvailabilityEvent }>(
        `/api/internal/dispatch/calendar/availability/${blockId}`,
        {
          body: input,
          method: "PATCH"
        }
      );
      refreshCalendar();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Availability block could not be updated."
      );
      throw updateError;
    } finally {
      setSavingAvailabilityBlockId(null);
    }
  }

  async function handleRemoveAvailabilityBlock(blockId: string) {
    setError(null);
    setRemovingAvailabilityBlockId(blockId);

    try {
      await requestJson(`/api/internal/dispatch/calendar/availability/${blockId}`, {
        method: "DELETE"
      });
      if (selectedAvailabilityBlockId === blockId) {
        setSelectedAvailabilityBlockId(null);
      }
      refreshCalendar();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Availability block could not be removed."
      );
    } finally {
      setRemovingAvailabilityBlockId(null);
    }
  }

  async function handleSaveView(input: {
    includeUnassigned: boolean;
    isDefault: boolean;
    mode: "create" | "update";
    name: string;
    scope: DispatchCalendarScope;
    technicianUserIds: string[];
    view: DispatchCalendarView;
  }) {
    setError(null);
    const method = input.mode === "create" ? "POST" : "PATCH";
    const url =
      input.mode === "create" || !selectedSavedView
        ? "/api/internal/dispatch/calendar/saved-views"
        : `/api/internal/dispatch/calendar/saved-views/${selectedSavedView.id}`;
    const payload = await requestJson<{ savedView: DispatchSavedView }>(url, {
      body: {
        includeUnassigned: input.includeUnassigned,
        isDefault: input.isDefault,
        name: input.name,
        scope: input.scope,
        technicianUserIds: input.technicianUserIds,
        view: input.view
      },
      method
    });
    const savedView = payload.savedView;

    if (!savedView) {
      throw new Error("Saved view could not be persisted.");
    }

    navigate({
      includeUnassigned: savedView.includeUnassigned,
      resourceUserIds: [],
      savedViewId: savedView.id,
      scope: savedView.scope,
      view: savedView.view
    });
  }

  async function handleDeleteView(savedViewId: string) {
    setError(null);
    await requestJson(`/api/internal/dispatch/calendar/saved-views/${savedViewId}`, {
      method: "DELETE"
    });

    if (currentState.savedViewId === savedViewId) {
      navigate({
        savedViewId: "",
        scope: "all_workers"
      });
      return;
    }

    refreshCalendar();
  }

  function handleSavedViewChange(savedViewId: string) {
    if (!savedViewId) {
      navigate({ savedViewId: "" });
      return;
    }

    const savedView = savedViews.find((view) => view.id === savedViewId);

    if (!savedView) {
      return;
    }

    navigate({
      includeUnassigned: savedView.includeUnassigned,
      resourceUserIds: [],
      savedViewId: savedView.id,
      scope: savedView.scope,
      view: savedView.view
    });
  }

  const savedViewForDialog = selectedSavedView ?? null;
  const showRecoverySurface = !selectedAvailabilityBlockId && surfaceMode === "recovery";
  const showReleaseRunwaySurface =
    !selectedAvailabilityBlockId && surfaceMode === "release_runway";
  const showInterventionSurface = showRecoverySurface || showReleaseRunwaySurface;
  const supportPlanningView = currentState.view !== "day";
  const showCommandDeck =
    !selectedAvailabilityBlockId &&
    surfaceMode === "recovery" &&
    !operatorFocusMode &&
    !supportPlanningView &&
    !selectedVisitId &&
    !queuePanelOpen;
  const showSavedSlices =
    !operatorFocusMode &&
    !supportPlanningView &&
    !selectedVisitId &&
    !queuePanelOpen &&
    surfaceMode === "board" &&
    dispatchInterventionSummaryItems.length === 0;
  const showInterventionPane = showInterventionSurface || showCommandDeck;
  const compactInterventionMode =
    operatorFocusMode ||
    queuePanelOpen ||
    conflictPanelOpen ||
    operationsRailOpen ||
    (showInterventionPane && currentState.view === "day");
  const collapseDispatchSliceUtility =
    showSavedSlices &&
    (showInterventionPane || currentState.scope === "single_tech" || currentState.view === "week");
  const showOperationsRail =
    (surfaceMode === "follow_through" ||
      (!operatorFocusMode && operationsRailOpen && surfaceMode === "board")) &&
    !supportPlanningView &&
    !selectedVisitId &&
    !showInterventionPane;
  const rightPanelVisible = utilityTrayOpen || conflictPanelOpen || showOperationsRail;
  const queueDocked =
    currentState.includeUnassigned &&
    queuePanelOpen &&
    !isCompactViewport &&
    !rightPanelVisible &&
    !showInterventionPane;
  const overlayQueueOpen =
    currentState.includeUnassigned &&
    queuePanelOpen &&
    !queueDocked;
  const prioritizeQueueOnCompactViewport =
    isCompactViewport &&
    overlayQueueOpen &&
    !selectedVisitId &&
    !selectedAvailabilityBlockId &&
    !utilityTrayOpen &&
    !conflictPanelOpen;
  const releaseRunwaySurfaceCount = approvedReleaseRunwayCards.length;
  const recoverySurfaceCount =
    conflictSummary.total +
    promiseRiskCount +
    remainingSameDayInsertionSuggestions.length +
    laneRecoveryCards.length;
  const followThroughSurfaceCount =
    closeoutRiskCount + staleApprovalCount + staleFollowUpVisitCount;
  const dispatchSurfacePresets: Array<{
    count: string;
    label: string;
    value: DispatchSurfaceMode;
  }> = [
    {
      count: `${activeCalendar.jobs.length}`,
      label:
        currentState.view === "week"
          ? "Week support"
          : currentState.view === "month"
            ? "Month support"
            : "Board",
      value: "board"
    },
    ...(releaseRunwaySurfaceCount
      ? [
          {
            count: `${releaseRunwaySurfaceCount}`,
            label: "Release runway",
            value: "release_runway" as const
          }
        ]
      : []),
    ...(recoverySurfaceCount
      ? [
          {
            count: `${recoverySurfaceCount}`,
            label: "Recovery",
            value: "recovery" as const
          }
        ]
      : []),
    ...(followThroughSurfaceCount
      ? [
          {
            count: `${followThroughSurfaceCount}`,
            label: "Follow-through",
            value: "follow_through" as const
          }
        ]
      : [])
  ];
  const activeDispatchSurfacePreset =
    dispatchSurfacePresets.find((preset) => preset.value === surfaceMode) ??
    dispatchSurfacePresets[0] ??
    null;
  const dispatchFocusActions = dispatchCommandActions
    .filter(
      (action) =>
        action.href !== dispatchNextMove.actionHref || action.label !== dispatchNextMove.actionLabel
    )
    .slice(
      0,
      operatorFocusMode || supportPlanningView
        ? 0
        : showInterventionPane || queuePanelOpen || showOperationsRail
          ? 0
          : 1
    );

  useEffect(() => {
    if (!operatorFocusMode) {
      return;
    }

    setUtilityTrayOpen(false);
  }, [operatorFocusMode]);

  useEffect(() => {
    if (dispatchSurfacePresets.some((preset) => preset.value === surfaceMode)) {
      return;
    }

    setSurfaceMode("board");
    setOperationsRailOpen(false);
  }, [dispatchSurfacePresets, surfaceMode]);

  return (
    <div
      className={cx(
        "dispatch-command-center",
        operatorFocusMode && "dispatch-command-center--focus-mode"
      )}
    >
      <DispatchToolbar
        backlogCount={assignedBacklogCount}
        backHref={backHref}
        closeoutRiskCount={closeoutRiskCount}
        conflictsOpen={conflictPanelOpen}
        currentDateLabel={currentDateLabel}
        dominantInterventionAction={dispatchDominantInterventionAction}
        focusMode={operatorFocusMode}
        focusToggleHref={focusToggleHref}
        intakeCount={unscheduledIntakeCount}
        interventionSummaryItems={dispatchInterventionSummaryItems}
        nextHref={nextHref}
        operationsRailOpen={showOperationsRail}
        onRefresh={refreshCalendar}
        onToggleOperationsRail={handleToggleOperationsRail}
        onSelectSingleTechnician={handleSelectSingleTechnician}
        onToggleQueue={handleToggleQueue}
        onScopeChange={handleScopeChange}
        onToggleUtilities={handleToggleUtilities}
        onViewChange={(view) =>
          navigate({
            savedViewId: "",
            view
          })
        }
        onZoomPresetChange={(preset) =>
          setZoomPresets((current) =>
            currentState.view === "week"
              ? { ...current, week: preset }
              : { ...current, day: preset }
          )
        }
        previousHref={previousHref}
        queueCount={openQueueCount}
        queueOpen={queuePanelOpen}
        readyQueueCount={readyQueueCount}
        roleFocus={roleFocus}
        pageTitle={pageTitle}
        scope={currentState.scope}
        selectedSingleTechnicianId={selectedSingleTechnicianId}
        selectedSavedViewName={selectedSavedView?.name ?? null}
        showQueueToggle={
          currentState.includeUnassigned &&
          (openQueueCount > 0 || queuePanelOpen)
        }
        technicians={orderedTechnicians}
        timeZoneLabel={activeCalendar.timezone}
        totalTechnicianCount={orderedTechnicians.length}
        todayHref={todayHref}
        utilitiesOpen={utilityTrayOpen}
        view={currentState.view}
        visibleResourceCount={visibleTechnicianIds.length}
        visitsNeedsAssignmentHref={visitsNeedsAssignmentHref}
        visitsReturnVisitHref={visitsReturnVisitHref}
        visitsStaleReturnVisitHref={visitsStaleReturnVisitHref}
        visitsReadyDispatchHref={visitsReadyDispatchHref}
        visitsStaleApprovalHref={visitsStaleApprovalHref}
        financeHref="/dashboard/finance"
        followUpVisitCount={followUpVisitCount}
        staleFollowUpVisitCount={staleFollowUpVisitCount}
        staleApprovalCount={staleApprovalCount}
        working={isRouting}
        zoomPreset={activeZoomPreset}
      />
      {showSavedSlices ? (
        collapseDispatchSliceUtility ? (
          <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
            <summary className="dispatch-recovery-band__overflow-summary">
              Board slices · {currentDispatchSliceLabel}
            </summary>
            <DeskSavedSlices
              className="dispatch-command-center__saved-slices"
              currentSlice={{
                href: currentDispatchSliceHref,
                label: currentDispatchSliceLabel
              }}
              desk="dispatch"
              operatorRole={operatorRole}
              pinCurrentLabel="Pin board"
              suggestedSlices={dispatchSavedSliceSuggestions}
            />
          </details>
        ) : (
          <DeskSavedSlices
            className="dispatch-command-center__saved-slices"
            currentSlice={{
              href: currentDispatchSliceHref,
              label: currentDispatchSliceLabel
            }}
            desk="dispatch"
            operatorRole={operatorRole}
            pinCurrentLabel="Pin board"
            suggestedSlices={dispatchSavedSliceSuggestions}
          />
        )
      ) : null}

      {(error || isRouting || batchInterventionFeedback) ? (
        <div className="dispatch-command-center__feedback">
          {error ? (
            <Callout tone="danger" title="Dispatch action needs attention">
              <p className="ui-section-copy">{error}</p>
            </Callout>
          ) : null}

          {batchInterventionFeedback ? (
            <Callout tone="success" title="Batch intervention queued">
              <p className="ui-section-copy">{batchInterventionFeedback}</p>
            </Callout>
          ) : null}

          {isRouting ? (
            <Callout tone="warning" title="Refreshing board">
              <p className="ui-section-copy">Updating lanes, queue pressure, and conflict checks.</p>
            </Callout>
          ) : null}
        </div>
      ) : null}

      <section className="dispatch-command-center__focus-bar" aria-label="Dispatch next move">
        <div className="dispatch-command-center__focus-bar-copy">
          {dispatchCommandBadges.length ? (
            <div className="dispatch-command-center__focus-bar-badges">
              {dispatchCommandBadges.slice(0, 1).map((badge) => (
                <Badge key={`${badge.label}-${badge.tone}`} tone={badge.tone}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="dispatch-command-center__focus-bar-heading">
            <strong>{dispatchNextMove.label}</strong>
            <span>{dispatchNextMove.detail}</span>
          </div>

          {dispatchFocusSignals.length && !compactInterventionMode ? (
            <div className="dispatch-command-center__focus-bar-signals">
              {dispatchFocusSignals.map((item) => (
                <div
                  className={cx(
                    "dispatch-command-center__focus-bar-signal",
                    item.tone === "danger"
                      ? "dispatch-command-center__focus-bar-signal--danger"
                      : item.tone === "warning"
                        ? "dispatch-command-center__focus-bar-signal--warning"
                        : item.tone === "success"
                          ? "dispatch-command-center__focus-bar-signal--success"
                          : "dispatch-command-center__focus-bar-signal--neutral"
                  )}
                  key={`${item.label}-${item.value}`}
                >
                  <span className="dispatch-command-center__focus-bar-signal-label">{item.label}</span>
                  <strong className="dispatch-command-center__focus-bar-signal-value">{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="dispatch-command-center__focus-bar-actions">
          {dispatchNextMove.actionHref && dispatchNextMove.actionLabel ? (
            <a
              className={buttonClassName({ size: "sm", tone: dispatchNextMove.tone ?? "primary" })}
              href={dispatchNextMove.actionHref}
            >
              {dispatchNextMove.actionLabel}
            </a>
          ) : null}
          {dispatchFocusActions.length
            ? operatorFocusMode || showInterventionPane || queuePanelOpen || showOperationsRail
              ? (
                <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                  <summary className="dispatch-recovery-band__overflow-summary">More</summary>
                  <div className="ui-table-actions dispatch-recovery-band__utility-actions">
                    {dispatchFocusActions.map((action) => (
                      <a
                        className={buttonClassName({ size: "sm", tone: action.tone ?? "secondary" })}
                        href={action.href}
                        key={`${action.label}-${action.href}`}
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                </details>
              )
              : dispatchFocusActions.map((action) => (
                <a
                  className={buttonClassName({ size: "sm", tone: action.tone ?? "secondary" })}
                  href={action.href}
                  key={`${action.label}-${action.href}`}
                >
                  {action.label}
                </a>
              ))
            : null}
        </div>
      </section>

      {!selectedAvailabilityBlockId &&
      !selectedVisitId &&
      !queuePanelOpen &&
      dispatchSurfacePresets.length > 1 ? (
        <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
          <summary className="dispatch-recovery-band__overflow-summary">
            Surface mode · {activeDispatchSurfacePreset?.label ?? "Board"}
          </summary>
          <section className="dispatch-command-center__surface-strip" aria-label="Dispatch surface modes">
            <div className="dispatch-command-center__surface-strip-tabs">
              {dispatchSurfacePresets.map((preset) => (
                <button
                  className={cx(
                    "dispatch-command-center__surface-tab",
                    surfaceMode === preset.value && "dispatch-command-center__surface-tab--active"
                  )}
                  key={preset.value}
                  onClick={() => {
                    setSurfaceMode(preset.value);
                    setOperationsRailOpen(preset.value === "follow_through");

                    if (preset.value !== "board" && !isCompactViewport && queuePanelOpen) {
                      setQueuePanelOpen(false);
                    }
                  }}
                  type="button"
                >
                  <strong>{preset.label}</strong>
                  <span className="dispatch-command-center__surface-tab-count">{preset.count}</span>
                  </button>
                ))}
            </div>
          </section>
        </details>
      ) : null}

      <div
        className={cx(
          "dispatch-command-center__layout",
          showInterventionPane && "dispatch-command-center__layout--intervention-open",
          conflictPanelOpen && "dispatch-command-center__layout--conflicts-open",
          queueDocked && "dispatch-command-center__layout--queue-docked",
          !rightPanelVisible && "dispatch-command-center__layout--rail-hidden"
        )}
      >
        {showInterventionPane ? (
          <aside className="dispatch-command-center__intervention-pane">
            {showInterventionSurface ? (
              <section className="dispatch-recovery-band dispatch-recovery-band--pane">
                {selectedVisit ? (
                  <article className="dispatch-recovery-band__summary dispatch-recovery-band__summary--thread">
                    <div className="dispatch-recovery-band__summary-copy">
                      <p className="dispatch-recovery-band__eyebrow">Active thread</p>
                      <h2 className="dispatch-recovery-band__title">{selectedVisit.title}</h2>
                      <p className="dispatch-recovery-band__description">
                        {[selectedVisit.customerDisplayName, selectedVisit.vehicleDisplayName]
                          .filter(Boolean)
                          .join(" · ")}
                        {selectedVisitSupportingText ? ` · ${selectedVisitSupportingText}` : ""}
                      </p>
                    </div>
                    {showSelectedVisitThreadSummaryBadges && !compactInterventionMode ? (
                      <div className="dispatch-recovery-band__summary-badges">
                        {selectedVisitThreadSummaryBadges.map((badge) => (
                          <Badge key={`${selectedVisit.id}:${badge.label}`} tone={badge.tone}>
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {showSelectedVisitThreadAlerts && !compactInterventionMode ? (
                      <div className="dispatch-recovery-band__thread-alerts">
                        {selectedVisitThreadAlerts.map((item) => (
                          <div
                            className={cx(
                              "dispatch-recovery-band__thread-alert",
                              `dispatch-recovery-band__thread-alert--${item.tone}`
                            )}
                            key={`${selectedVisit.id}:${item.label}`}
                          >
                            <span className="dispatch-recovery-band__thread-alert-label">{item.label}</span>
                            <strong className="dispatch-recovery-band__thread-alert-value">{item.value}</strong>
                            <p className="dispatch-recovery-band__thread-alert-copy">{item.copy}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="ui-table-actions">
                      <a
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={buildVisitThreadHref(selectedVisit.id, {
                          returnLabel: "Back to dispatch",
                          returnTo: dispatchReturnHref
                        })}
                      >
                        Open visit thread
                      </a>
                      {selectedVisitFocusLaneId ? (
                        <button
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          onClick={() => focusSingleLane(selectedVisitFocusLaneId)}
                          type="button"
                        >
                          Focus {selectedVisitFocusLane?.displayName ?? "lane"}
                        </button>
                      ) : null}
                      {selectedVisitSupplyBlock && !selectedVisitFocusLaneId ? (
                        <a
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          href={buildVisitPartsHref(selectedVisit.id, {
                            returnLabel: "Back to dispatch",
                            returnTo: dispatchReturnHref
                          })}
                        >
                          Open parts
                        </a>
                      ) : null}
                      {!compactInterventionMode && showSelectedVisitThreadUtilities ? (
                        <button
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          onClick={() => syncSelectedVisit(null)}
                          type="button"
                        >
                          Clear thread focus
                        </button>
                      ) : null}
                    </div>
                  </article>
                ) : showReleaseRunwaySurface ? (
                  <article className="dispatch-recovery-band__summary">
                    <div className="dispatch-recovery-band__summary-copy">
                      <p className="dispatch-recovery-band__eyebrow">Release runway</p>
                      <h2 className="dispatch-recovery-band__title">Place approved visits onto live lanes</h2>
                      <p className="dispatch-recovery-band__description">
                        Keep approval, owner, promise, readiness, and board placement on one dispatch handoff.
                      </p>
                    </div>
                    <div className="dispatch-recovery-band__summary-badges">
                      {releaseRunwaySurfaceCount ? (
                        <>
                          <Badge tone="brand">
                            {releaseRunwaySurfaceCount} release move
                            {releaseRunwaySurfaceCount === 1 ? "" : "s"}
                          </Badge>
                          <Badge tone="success">Board placement live</Badge>
                        </>
                      ) : (
                        <Badge tone="success">Release runway clear</Badge>
                      )}
                    </div>
                    {showReleaseRunwaySurface ? null : (
                      <div className="ui-table-actions">
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={visitsReadyDispatchHref}
                        >
                          Open release runway
                        </a>
                      </div>
                    )}
                  </article>
                ) : (
                  <article className="dispatch-recovery-band__summary">
                    <div className="dispatch-recovery-band__summary-copy">
                      <p className="dispatch-recovery-band__eyebrow">Recovery</p>
                      <h2 className="dispatch-recovery-band__title">Recover lanes and place ready work</h2>
                      <p className="dispatch-recovery-band__description">
                        Run recovery, same-day insertion, and promise control from this board.
                      </p>
                    </div>
                    <div className="dispatch-recovery-band__summary-badges">
                      {dispatchInterventionSummaryItems.length ? (
                        dispatchInterventionSummaryItems.slice(0, operatorFocusMode ? 1 : 2).map((item) => (
                          <Badge key={item.id} tone={item.tone}>
                            {item.label}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="success">Intervention lane clear</Badge>
                      )}
                    </div>
                  </article>
                )}

                {compactInterventionMode &&
                (selectedVisitApprovedReleaseCard ||
                  selectedVisitSameDayFitSuggestion ||
                  remainingApprovedReleaseRunwayCards.length ||
                  remainingSameDayInsertionSuggestions.length ||
                  laneRecoveryCards.length ||
                  recoveryCloseoutItems.length ||
                  laneReleaseCards.length) ? (
                  <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                    <summary className="dispatch-recovery-band__overflow-summary">More lane detail</summary>
                    <div className="ui-table-actions dispatch-recovery-band__utility-actions">
                      {selectedVisit ? (
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={buildVisitThreadHref(selectedVisit.id, {
                            returnLabel: "Back to dispatch",
                            returnTo: dispatchReturnHref
                          })}
                        >
                          Open visit thread
                        </a>
                      ) : null}
                      {(selectedVisitApprovedReleaseCard || remainingApprovedReleaseRunwayCards.length) ? (
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={visitsReadyDispatchHref}
                        >
                          Open release runway
                        </a>
                      ) : null}
                      {(selectedVisitSameDayFitSuggestion || remainingSameDayInsertionSuggestions.length) ? (
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={visitsNeedsAssignmentHref}
                        >
                          Open visit queue
                        </a>
                      ) : null}
                      {recoveryCloseoutItems.length ? (
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href="/dashboard/finance"
                        >
                          Open finance desk
                        </a>
                      ) : null}
                    </div>
                  </details>
                ) : null}

                {!compactInterventionMode && showReleaseRunwaySurface && selectedVisitApprovedReleaseCard ? (
                  <article className="dispatch-recovery-band__section dispatch-recovery-band__section--thread">
                    <div className="dispatch-recovery-band__section-header">
                      <div className="dispatch-recovery-band__section-copy">
                        <p className="dispatch-recovery-band__eyebrow">Selected release move</p>
                        <h3 className="dispatch-recovery-band__section-title">Stage this approved visit</h3>
                      </div>
                    </div>
                    <div className="dispatch-recovery-band__grid">
                      <DispatchApprovedReleaseRunwayCard
                        candidate={selectedVisitApprovedReleaseCard}
                        key={`approved-release:selected:${selectedVisitApprovedReleaseCard.visit.id}`}
                        onFocusSingleLane={focusSingleLane}
                        onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                        onQuickEditSave={handleQuickEditSave}
                        technicians={orderedTechnicians}
                        timezone={activeCalendar.timezone}
                      />
                    </div>
                  </article>
                ) : !compactInterventionMode && selectedVisitSameDayFitSuggestion ? (
                  <article className="dispatch-recovery-band__section dispatch-recovery-band__section--thread">
                    <div className="dispatch-recovery-band__section-header">
                      <div className="dispatch-recovery-band__section-copy">
                        <p className="dispatch-recovery-band__eyebrow">Selected fit</p>
                        <h3 className="dispatch-recovery-band__section-title">Place this visit now</h3>
                      </div>
                    </div>
                    <div className="dispatch-recovery-band__grid">
                      <DispatchSameDayFitCard
                        key={`same-day-fit:selected:${selectedVisitSameDayFitSuggestion.jobId}`}
                        onFocusSingleLane={focusSingleLane}
                        onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                        onQuickEditSave={handleQuickEditSave}
                        suggestion={selectedVisitSameDayFitSuggestion}
                        technicians={orderedTechnicians}
                        timezone={activeCalendar.timezone}
                      />
                    </div>
                  </article>
                ) : null}

                {remainingApprovedReleaseRunwayCards.length ? (
                  collapseApprovedReleaseSection ? (
                    <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                      <summary className="dispatch-recovery-band__overflow-summary">
                        Release runway mode · {remainingApprovedReleaseRunwayCards.length} move
                        {remainingApprovedReleaseRunwayCards.length === 1 ? "" : "s"}
                      </summary>
                      <div className="ui-table-actions dispatch-recovery-band__utility-actions">
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={visitsReadyDispatchHref}
                        >
                          Open release runway
                        </a>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {remainingApprovedReleaseRunwayCards.map((candidate) => (
                          <DispatchApprovedReleaseRunwayCard
                            candidate={candidate}
                            key={`approved-release:collapsed:${candidate.visit.id}`}
                            onFocusSingleLane={focusSingleLane}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            onQuickEditSave={handleQuickEditSave}
                            technicians={orderedTechnicians}
                            timezone={activeCalendar.timezone}
                          />
                        ))}
                      </div>
                    </details>
                  ) : (
                    <article className="dispatch-recovery-band__section">
                      <div className="dispatch-recovery-band__section-header">
                        <div className="dispatch-recovery-band__section-copy">
                          <p className="dispatch-recovery-band__eyebrow">
                            {showReleaseRunwaySurface ? "Release runway" : "Approved release runway"}
                          </p>
                          <h3 className="dispatch-recovery-band__section-title">
                            {showReleaseRunwaySurface
                              ? "Place approved visits onto live lanes"
                              : "Place approved work onto lanes"}
                          </h3>
                        </div>
                        {showReleaseRunwaySurface ? null : (
                          <div className="ui-table-actions">
                            <a
                              className={buttonClassName({ size: "sm", tone: "secondary" })}
                              href={visitsReadyDispatchHref}
                            >
                              Open release runway
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {visibleApprovedReleaseRunwayCards.map((candidate) => (
                          <DispatchApprovedReleaseRunwayCard
                            candidate={candidate}
                            key={`approved-release:${candidate.visit.id}`}
                            onFocusSingleLane={focusSingleLane}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            onQuickEditSave={handleQuickEditSave}
                            technicians={orderedTechnicians}
                            timezone={activeCalendar.timezone}
                          />
                        ))}
                      </div>
                      {overflowApprovedReleaseRunwayCards.length ? (
                        <details className="dispatch-recovery-band__overflow">
                          <summary className="dispatch-recovery-band__overflow-summary">
                            Show {overflowApprovedReleaseRunwayCards.length} more release move
                            {overflowApprovedReleaseRunwayCards.length === 1 ? "" : "s"}
                          </summary>
                          <div className="dispatch-recovery-band__grid">
                            {overflowApprovedReleaseRunwayCards.map((candidate) => (
                              <DispatchApprovedReleaseRunwayCard
                                candidate={candidate}
                                key={`approved-release:overflow:${candidate.visit.id}`}
                                onFocusSingleLane={focusSingleLane}
                                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                                onQuickEditSave={handleQuickEditSave}
                                technicians={orderedTechnicians}
                                timezone={activeCalendar.timezone}
                              />
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  )
                ) : null}

                {remainingSameDayInsertionSuggestions.length ? (
                  collapseSameDayInsertionSection ? (
                    <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                      <summary className="dispatch-recovery-band__overflow-summary">
                        Same-day fit · {remainingSameDayInsertionSuggestions.length} option
                        {remainingSameDayInsertionSuggestions.length === 1 ? "" : "s"}
                      </summary>
                      <div className="ui-table-actions dispatch-recovery-band__utility-actions">
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={visitsNeedsAssignmentHref}
                        >
                          Open visit queue
                        </a>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {remainingSameDayInsertionSuggestions.map((candidate) => (
                          <DispatchSameDayFitCard
                            key={`same-day-fit:collapsed:${candidate.jobId}`}
                            onFocusSingleLane={focusSingleLane}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            onQuickEditSave={handleQuickEditSave}
                            suggestion={candidate}
                            technicians={orderedTechnicians}
                            timezone={activeCalendar.timezone}
                          />
                        ))}
                      </div>
                    </details>
                  ) : (
                    <article className="dispatch-recovery-band__section">
                      <div className="dispatch-recovery-band__section-header">
                        <div className="dispatch-recovery-band__section-copy">
                          <p className="dispatch-recovery-band__eyebrow">Same-day fit</p>
                          <h3 className="dispatch-recovery-band__section-title">
                            Insert same-day work
                          </h3>
                        </div>
                        <div className="ui-table-actions">
                          <a
                            className={buttonClassName({ size: "sm", tone: "secondary" })}
                            href={visitsNeedsAssignmentHref}
                          >
                            Open visit queue
                          </a>
                        </div>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {visibleSameDayInsertionCards.map((candidate) => (
                          <DispatchSameDayFitCard
                            key={`same-day-fit:${candidate.jobId}`}
                            onFocusSingleLane={focusSingleLane}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            onQuickEditSave={handleQuickEditSave}
                            suggestion={candidate}
                            technicians={orderedTechnicians}
                            timezone={activeCalendar.timezone}
                          />
                        ))}
                      </div>
                      {overflowSameDayInsertionCards.length ? (
                        <details className="dispatch-recovery-band__overflow">
                          <summary className="dispatch-recovery-band__overflow-summary">
                            Show {overflowSameDayInsertionCards.length} more same-day fit
                            {overflowSameDayInsertionCards.length === 1 ? "" : "s"}
                          </summary>
                          <div className="dispatch-recovery-band__grid">
                            {overflowSameDayInsertionCards.map((candidate) => (
                              <DispatchSameDayFitCard
                                key={`same-day-fit:overflow:${candidate.jobId}`}
                                onFocusSingleLane={focusSingleLane}
                                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                                onQuickEditSave={handleQuickEditSave}
                                suggestion={candidate}
                                technicians={orderedTechnicians}
                                timezone={activeCalendar.timezone}
                              />
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  )
                ) : null}

                {laneRecoveryCards.length ? (
                  collapseLaneRecoverySection ? (
                    <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                      <summary className="dispatch-recovery-band__overflow-summary">
                        Lane recovery · {laneRecoveryCards.length} lane
                        {laneRecoveryCards.length === 1 ? "" : "s"}
                      </summary>
                      <div className="dispatch-recovery-band__grid">
                        {laneRecoveryCards.map((candidate) => (
                          <article className="dispatch-recovery-band__card" key={`recover:collapsed:${candidate.resource.technicianUserId}`}>
                            <div className="dispatch-recovery-band__card-topline">
                              <p className="dispatch-recovery-band__card-title">{candidate.resource.displayName}</p>
                              <div className="dispatch-recovery-band__card-badges">
                                <Badge tone={candidate.tone}>{candidate.value}</Badge>
                                {candidate.leadPromiseSummary?.recommendedAction &&
                                needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                                  <Badge tone="warning">
                                    {getDispatchOnBoardFollowThroughActionLabel(
                                      candidate.leadPromiseSummary.recommendedAction
                                    )}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <p className="dispatch-recovery-band__card-copy">{candidate.copy}</p>
                            <div className="ui-table-actions">
                              <button
                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                onClick={() => {
                                  if (candidate.resource.conflictCount > 0) {
                                    focusResourceConflicts(candidate.resource.technicianUserId);
                                    return;
                                  }

                                  focusSingleLane(candidate.resource.technicianUserId);
                                }}
                                type="button"
                              >
                                {candidate.resource.conflictCount > 0 ? "Open conflicts" : "Focus lane"}
                              </button>
                              {candidate.leadJob ? (
                                <button
                                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                                  onClick={() => syncSelectedVisit(candidate.leadJob!.id)}
                                  type="button"
                                >
                                  Open visit
                                </button>
                              ) : null}
                              {candidate.leadJob &&
                              candidate.leadPromiseSummary?.recommendedAction &&
                              needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                                <button
                                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                                  disabled={batchInterventionPending === "notify_promise_risk"}
                                  onClick={() => {
                                    void handleNotifyPromiseRisk(candidate.leadJob!.id);
                                  }}
                                  type="button"
                                >
                                  {batchInterventionPending === "notify_promise_risk"
                                    ? "Sending…"
                                    : getDispatchOnBoardFollowThroughActionLabel(
                                        candidate.leadPromiseSummary.recommendedAction
                                      )}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <article className="dispatch-recovery-band__section">
                      <div className="dispatch-recovery-band__section-header">
                        <div className="dispatch-recovery-band__section-copy">
                          <p className="dispatch-recovery-band__eyebrow">Lane recovery</p>
                          <h3 className="dispatch-recovery-band__section-title">Rescue the weakest lane first</h3>
                        </div>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                      {visibleLaneRecoveryCards.map((candidate) => (
                        <article className="dispatch-recovery-band__card" key={`recover:${candidate.resource.technicianUserId}`}>
                          <div className="dispatch-recovery-band__card-topline">
                            <p className="dispatch-recovery-band__card-title">{candidate.resource.displayName}</p>
                            <div className="dispatch-recovery-band__card-badges">
                              <Badge tone={candidate.tone}>{candidate.value}</Badge>
                              {candidate.leadPromiseSummary?.recommendedAction &&
                              needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                                <Badge tone="warning">
                                  {getDispatchOnBoardFollowThroughActionLabel(
                                    candidate.leadPromiseSummary.recommendedAction
                                  )}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <p className="dispatch-recovery-band__card-copy">{candidate.copy}</p>
                          <div className="ui-table-actions">
                            <button
                              className={buttonClassName({ size: "sm", tone: "secondary" })}
                              onClick={() => {
                                if (candidate.resource.conflictCount > 0) {
                                  focusResourceConflicts(candidate.resource.technicianUserId);
                                  return;
                                }

                                focusSingleLane(candidate.resource.technicianUserId);
                              }}
                              type="button"
                            >
                              {candidate.resource.conflictCount > 0 ? "Open conflicts" : "Focus lane"}
                            </button>
                            {candidate.leadJob ? (
                              <button
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                onClick={() => syncSelectedVisit(candidate.leadJob!.id)}
                                type="button"
                              >
                                Open visit
                              </button>
                            ) : null}
                            {candidate.leadJob &&
                            candidate.leadPromiseSummary?.recommendedAction &&
                            needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                              <button
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                disabled={batchInterventionPending === "notify_promise_risk"}
                                onClick={() => {
                                  void handleNotifyPromiseRisk(candidate.leadJob!.id);
                                }}
                                type="button"
                              >
                                {batchInterventionPending === "notify_promise_risk"
                                  ? "Sending…"
                                  : getDispatchOnBoardFollowThroughActionLabel(
                                      candidate.leadPromiseSummary.recommendedAction
                                    )}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                      </div>
                      {overflowLaneRecoveryCards.length ? (
                        <details className="dispatch-recovery-band__overflow">
                          <summary className="dispatch-recovery-band__overflow-summary">
                            Show {overflowLaneRecoveryCards.length} more lane recovery move
                            {overflowLaneRecoveryCards.length === 1 ? "" : "s"}
                          </summary>
                          <div className="dispatch-recovery-band__grid">
                            {overflowLaneRecoveryCards.map((candidate) => (
                              <article
                                className="dispatch-recovery-band__card"
                                key={`recover:overflow:${candidate.resource.technicianUserId}`}
                              >
                                <div className="dispatch-recovery-band__card-topline">
                                  <p className="dispatch-recovery-band__card-title">{candidate.resource.displayName}</p>
                                  <div className="dispatch-recovery-band__card-badges">
                                    <Badge tone={candidate.tone}>{candidate.value}</Badge>
                                    {candidate.leadPromiseSummary?.recommendedAction &&
                                    needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                                      <Badge tone="warning">
                                        {getDispatchOnBoardFollowThroughActionLabel(
                                          candidate.leadPromiseSummary.recommendedAction
                                        )}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="dispatch-recovery-band__card-copy">{candidate.copy}</p>
                                <div className="ui-table-actions">
                                  <button
                                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                                    onClick={() => {
                                      if (candidate.resource.conflictCount > 0) {
                                        focusResourceConflicts(candidate.resource.technicianUserId);
                                        return;
                                      }

                                      focusSingleLane(candidate.resource.technicianUserId);
                                    }}
                                    type="button"
                                  >
                                    {candidate.resource.conflictCount > 0 ? "Open conflicts" : "Focus lane"}
                                  </button>
                                  {candidate.leadJob ? (
                                    <button
                                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                                      onClick={() => syncSelectedVisit(candidate.leadJob!.id)}
                                      type="button"
                                    >
                                      Open visit
                                    </button>
                                  ) : null}
                                  {candidate.leadJob &&
                                  candidate.leadPromiseSummary?.recommendedAction &&
                                  needsDispatchPromiseIntervention(candidate.leadPromiseSummary) ? (
                                    <button
                                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                                      disabled={batchInterventionPending === "notify_promise_risk"}
                                      onClick={() => {
                                        void handleNotifyPromiseRisk(candidate.leadJob!.id);
                                      }}
                                      type="button"
                                    >
                                      {batchInterventionPending === "notify_promise_risk"
                                        ? "Sending…"
                                        : getDispatchOnBoardFollowThroughActionLabel(
                                            candidate.leadPromiseSummary.recommendedAction
                                          )}
                                    </button>
                                  ) : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  )
                ) : null}

                {recoveryCloseoutItems.length ? (
                  collapseRecoveryCloseoutSection ? (
                    <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                      <summary className="dispatch-recovery-band__overflow-summary">
                        Closeout recovery · {recoveryCloseoutItems.length} thread
                        {recoveryCloseoutItems.length === 1 ? "" : "s"}
                      </summary>
                      <div className="ui-table-actions dispatch-recovery-band__utility-actions">
                        <a
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href="/dashboard/finance"
                        >
                          Open finance desk
                        </a>
                        <button
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          disabled={batchInterventionPending === "notify_closeout_risk"}
                          onClick={() => {
                            void handleNotifyCloseoutRiskBatch();
                          }}
                          type="button"
                        >
                          {batchInterventionPending === "notify_closeout_risk"
                            ? "Queueing…"
                            : "Queue payment nudges"}
                        </button>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {recoveryCloseoutItems.map((item) => (
                          <DispatchCloseoutRecoveryCard
                            item={item}
                            key={`closeout:collapsed:${item.jobId}`}
                            onNotifyCloseoutRisk={handleNotifyCloseoutRisk}
                            onResolveCloseoutHandoff={handleResolveCloseoutHandoff}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            reminderPending={
                              batchInterventionPending === "notify_closeout_risk" ||
                              batchInterventionPending === "resolve_closeout_handoff"
                            }
                          />
                        ))}
                      </div>
                    </details>
                  ) : (
                    <article className="dispatch-recovery-band__section">
                      <div className="dispatch-recovery-band__section-header">
                        <div className="dispatch-recovery-band__section-copy">
                          <p className="dispatch-recovery-band__eyebrow">Closeout recovery</p>
                          <h3 className="dispatch-recovery-band__section-title">
                            Keep money threads attached to the service day
                          </h3>
                        </div>
                        <div className="ui-table-actions">
                          <a
                            className={buttonClassName({ size: "sm", tone: "secondary" })}
                            href="/dashboard/finance"
                          >
                            Open finance desk
                          </a>
                          <button
                            className={buttonClassName({ size: "sm", tone: "ghost" })}
                            disabled={batchInterventionPending === "notify_closeout_risk"}
                            onClick={() => {
                              void handleNotifyCloseoutRiskBatch();
                            }}
                            type="button"
                          >
                            {batchInterventionPending === "notify_closeout_risk"
                              ? "Queueing…"
                              : "Queue payment nudges"}
                          </button>
                        </div>
                      </div>
                      <div className="dispatch-recovery-band__grid">
                        {visibleRecoveryCloseoutItems.map((item) => (
                          <DispatchCloseoutRecoveryCard
                            item={item}
                            key={`closeout:${item.jobId}`}
                            onNotifyCloseoutRisk={handleNotifyCloseoutRisk}
                            onResolveCloseoutHandoff={handleResolveCloseoutHandoff}
                            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                            reminderPending={
                              batchInterventionPending === "notify_closeout_risk" ||
                              batchInterventionPending === "resolve_closeout_handoff"
                            }
                          />
                        ))}
                      </div>
                      {overflowRecoveryCloseoutItems.length ? (
                        <details className="dispatch-recovery-band__overflow">
                          <summary className="dispatch-recovery-band__overflow-summary">
                            Show {overflowRecoveryCloseoutItems.length} more closeout thread
                            {overflowRecoveryCloseoutItems.length === 1 ? "" : "s"}
                          </summary>
                          <div className="dispatch-recovery-band__grid">
                            {overflowRecoveryCloseoutItems.map((item) => (
                              <DispatchCloseoutRecoveryCard
                                item={item}
                                key={`closeout:overflow:${item.jobId}`}
                                onNotifyCloseoutRisk={handleNotifyCloseoutRisk}
                                onResolveCloseoutHandoff={handleResolveCloseoutHandoff}
                                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                                reminderPending={
                                  batchInterventionPending === "notify_closeout_risk" ||
                                  batchInterventionPending === "resolve_closeout_handoff"
                                }
                              />
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  )
                ) : null}

                {laneReleaseCards.length ? (
                  collapseLaneReleaseCards ? (
                    <details className="dispatch-recovery-band__overflow dispatch-recovery-band__overflow--utility">
                      <summary className="dispatch-recovery-band__overflow-summary">
                        Lane release posture · {laneReleaseCards.length} lane
                        {laneReleaseCards.length === 1 ? "" : "s"}
                      </summary>
                      <div className="dispatch-recovery-band__grid">
                        {laneReleaseCards.map((candidate) => (
                          <article className="dispatch-recovery-band__card" key={`release:${candidate.resource.technicianUserId}`}>
                            <div className="dispatch-recovery-band__card-topline">
                              <p className="dispatch-recovery-band__card-title">{candidate.resource.displayName}</p>
                              <Badge tone="brand">{candidate.value}</Badge>
                            </div>
                            <p className="dispatch-recovery-band__card-copy">{candidate.copy}</p>
                            <DispatchCrewReadinessStrip
                              summary={buildLaneCrewReadinessSummary({
                                lane: candidate.resource,
                                laneCopy: candidate.copy,
                                laneFollowThrough: candidate.laneFollowThrough,
                                liveJobTitle: candidate.liveJob?.title ?? null,
                                valueLabel: candidate.value
                              })}
                            />
                            <div className="ui-table-actions">
                              <button
                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                onClick={() => focusSingleLane(candidate.resource.technicianUserId)}
                                type="button"
                              >
                                Open lane
                              </button>
                              <a
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                href={readyQueueCount ? visitsReadyDispatchHref : visitsNeedsAssignmentHref}
                              >
                                {readyQueueCount ? "Release runway" : "Visit queue"}
                              </a>
                            </div>
                          </article>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <div className="dispatch-recovery-band__grid">
                      {laneReleaseCards.map((candidate) => (
                        <article className="dispatch-recovery-band__card" key={`release:${candidate.resource.technicianUserId}`}>
                          <div className="dispatch-recovery-band__card-topline">
                            <p className="dispatch-recovery-band__card-title">{candidate.resource.displayName}</p>
                            <Badge tone="brand">{candidate.value}</Badge>
                          </div>
                          <p className="dispatch-recovery-band__card-copy">{candidate.copy}</p>
                          <DispatchCrewReadinessStrip
                            summary={buildLaneCrewReadinessSummary({
                              lane: candidate.resource,
                              laneCopy: candidate.copy,
                              laneFollowThrough: candidate.laneFollowThrough,
                              liveJobTitle: candidate.liveJob?.title ?? null,
                              valueLabel: candidate.value
                            })}
                          />
                          <div className="ui-table-actions">
                            <button
                              className={buttonClassName({ size: "sm", tone: "secondary" })}
                              onClick={() => focusSingleLane(candidate.resource.technicianUserId)}
                              type="button"
                            >
                              Open lane
                            </button>
                            <a
                              className={buttonClassName({ size: "sm", tone: "ghost" })}
                              href={readyQueueCount ? visitsReadyDispatchHref : visitsNeedsAssignmentHref}
                            >
                              {readyQueueCount ? "Release runway" : "Visit queue"}
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : null}
              </section>
            ) : null}

            {showCommandDeck ? (
              <DispatchCommandDeck
                approvedReleaseJobIds={approvedReleaseJobIds}
                backlogJobs={activeCalendar.backlogJobs}
                batchDeferLowConfidencePending={batchInterventionPending === "defer_low_confidence"}
                batchNotifyCloseoutRiskPending={
                  batchInterventionPending === "notify_closeout_risk" ||
                  batchInterventionPending === "resolve_closeout_handoff"
                }
                batchNotifyPromiseRiskPending={batchInterventionPending === "notify_promise_risk"}
                batchNotifyStaleApprovalsPending={batchInterventionPending === "notify_stale_approvals"}
                batchNotifyStaleReturnsPending={batchInterventionPending === "notify_stale_returns"}
                closeoutRiskItems={closeoutRiskItems}
                dominantInterventionAction={dispatchDominantInterventionAction}
                financeHref="/dashboard/finance"
                interventionSummaryItems={dispatchInterventionSummaryItems}
                jobs={activeCalendar.jobs}
                lowConfidenceItems={lowConfidenceItems}
                onDeferLowConfidence={(jobId) => {
                  void handleDeferLowConfidence(jobId);
                }}
                onFocusResourceConflicts={focusResourceConflicts}
                onFocusSingleLane={focusSingleLane}
                onNotifyCloseoutRisk={(jobId) => {
                  void handleNotifyCloseoutRisk(jobId);
                }}
                onResolveCloseoutHandoff={(jobId, input) => {
                  void handleResolveCloseoutHandoff(jobId, input);
                }}
                onNotifyPromiseRisk={(jobId) => {
                  void handleNotifyPromiseRisk(jobId);
                }}
                onNotifyStaleApproval={(jobId) => {
                  void handleNotifyStaleApproval(jobId);
                }}
                onNotifyStaleReturn={(jobId) => {
                  void handleNotifyStaleReturn(jobId);
                }}
                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                onQuickEditReleaseVisit={handleQuickEditSave}
                promiseRiskJobs={promiseRiskJobs}
                resources={dispatchSurfaceCalendar.resources}
                returnToHref={dispatchReturnHref}
                returnToLabel="Back to dispatch"
                staleApprovalItems={staleApprovalItems}
                staleFollowUpItems={staleFollowUpItems}
                supplyBlockedItems={supplyBlockedItems}
                supplyHref="/dashboard/supply"
                technicians={orderedTechnicians}
                timezone={activeCalendar.timezone}
                unassignedScheduledJobs={activeCalendar.unassignedScheduledJobs}
                visitsNeedsAssignmentHref={visitsNeedsAssignmentHref}
                visitsReadyDispatchHref={visitsReadyDispatchHref}
              />
            ) : null}
          </aside>
        ) : null}

        {queueDocked ? (
          <aside className="dispatch-command-center__queue-sidebar">
            <DispatchUnassignedPanel
              backlogJobs={activeCalendar.backlogJobs}
              draggingVisitId={draggingVisitId}
              onClose={() => setQueuePanelOpen(false)}
              onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
              onStartDraggingVisit={setDraggingVisitId}
              onStopDraggingVisit={() => setDraggingVisitId(null)}
              presentation="dock"
              timezone={activeCalendar.timezone}
              unassignedScheduledJobs={activeCalendar.unassignedScheduledJobs}
            />
          </aside>
        ) : null}

        <section
          className={cx(
            "dispatch-command-center__stage",
            overlayQueueOpen && "dispatch-command-center__stage--queue-open",
            currentState.view === "month" && "dispatch-command-center__stage--month"
          )}
        >
          {selectedScheduledVisit ? (
            <div className="dispatch-command-center__thread-board-bar">
              <div className="dispatch-command-center__thread-board-copy">
                <div className="dispatch-command-center__thread-board-heading">
                  <strong>{selectedScheduledVisit.title}</strong>
                  <span>
                    {selectedScheduledVisit.customerDisplayName} · {selectedScheduledVisit.vehicleDisplayName}
                  </span>
                </div>
                <div className="dispatch-command-center__thread-board-signals">
                  {selectedVisitFocusLane ? (
                    <Badge tone="brand">{selectedVisitFocusLane.displayName}</Badge>
                  ) : null}
                  {selectedVisitSignal ? (
                    <Badge tone={selectedVisitSignal.tone}>{selectedVisitSignal.label}</Badge>
                  ) : null}
                  {selectedVisitPromiseSummary?.recommendedAction ? (
                    <Badge
                      tone={
                        selectedVisitPromiseSummary.tone === "danger"
                          ? "danger"
                          : selectedVisitPromiseSummary.tone === "warning"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {getDispatchOnBoardFollowThroughActionLabel(
                        selectedVisitPromiseSummary.recommendedAction
                      )}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="dispatch-command-center__thread-board-actions">
                <a
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={buildVisitThreadHref(selectedScheduledVisit.id, {
                    returnLabel: "Back to dispatch",
                    returnTo: dispatchReturnHref
                  })}
                >
                  Open visit thread
                </a>
                {selectedVisitBoardCanSendUpdate ? (
                  <Button
                    loading={batchInterventionPending === "notify_promise_risk"}
                    onClick={() => {
                      void handleNotifyPromiseRisk(selectedScheduledVisit.id);
                    }}
                    size="sm"
                    tone="primary"
                    type="button"
                    >
                      {selectedVisitPromiseSummary?.recommendedAction
                        ? getDispatchOnBoardFollowThroughActionLabel(
                          selectedVisitPromiseSummary.recommendedAction
                        )
                        : "Send timing update"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            className={cx(
              "dispatch-command-center__canvas",
              prioritizeQueueOnCompactViewport && "dispatch-command-center__canvas--queue-priority"
            )}
          >
            {overlayQueueOpen ? (
              <aside
                className={cx(
                  "dispatch-command-center__queue-drawer",
                  "dispatch-command-center__queue-drawer--open"
                )}
              >
                <DispatchUnassignedPanel
                  backlogJobs={activeCalendar.backlogJobs}
                  draggingVisitId={draggingVisitId}
                  onClose={() => setQueuePanelOpen(false)}
                  onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                  onStartDraggingVisit={setDraggingVisitId}
                  onStopDraggingVisit={() => setDraggingVisitId(null)}
                  presentation="drawer"
                  timezone={activeCalendar.timezone}
                  unassignedScheduledJobs={activeCalendar.unassignedScheduledJobs}
                />
              </aside>
            ) : null}

            {currentState.view === "month" ? (
              <DispatchMonthCalendar
                activeThreadContext={activeThreadBoardContext}
                calendar={dispatchSurfaceCalendar}
                highlightedVisitId={placementHighlightVisitId}
                now={clockNow}
                onOpenDay={openDayBoard}
                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                selectedDate={currentState.date}
                selectedVisitId={selectedVisitId}
              />
            ) : currentState.view === "week" ? (
              <DispatchWeekCalendar
                activeThreadContext={activeThreadBoardContext}
                calendar={dispatchSurfaceCalendar}
                highlightedVisitId={placementHighlightVisitId}
                now={clockNow}
                onFocusResourceConflicts={focusResourceConflicts}
                onFocusSingleLane={focusSingleLane}
                onOpenDay={openDayBoard}
                onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
                promiseSummaries={effectivePromiseSummaries}
                selectedDate={currentState.date}
                selectedVisitId={selectedVisitId}
                threadLaneActions={selectedVisitThreadLaneActions}
                zoomPreset={activeZoomPreset}
              />
            ) : (
              <DispatchCalendarGrid
                activeThreadContext={activeThreadBoardContext}
                calendar={dispatchSurfaceCalendar}
                draggingVisitId={draggingVisitId}
                hasOpenQueue={overlayQueueOpen && openQueueCount > 0}
                highlightedVisitId={placementHighlightVisitId}
                now={clockNow}
                onAvailabilityClick={(blockId) => {
                  syncSelectedVisit(null);
                  setSelectedAvailabilityBlockId(blockId);
                  setConflictPanelOpen(false);
                  setUtilityTrayOpen(true);
                }}
                onFocusResourceConflicts={(technicianUserId) => {
                  focusResourceConflicts(technicianUserId);
                }}
                onFocusSingleLane={focusSingleLane}
                onVisitClick={(jobId) => syncSelectedVisit(jobId)}
                onVisitDragEnd={() => setDraggingVisitId(null)}
                onVisitDragStart={setDraggingVisitId}
                onMoveVisit={handleMoveJob}
                onRemoveAvailabilityBlock={handleRemoveAvailabilityBlock}
                onResizeVisit={handleResizeJob}
                pendingVisitIds={pendingVisitIds}
                promiseSummaries={effectivePromiseSummaries}
                removingAvailabilityBlockId={removingAvailabilityBlockId}
                selectedAvailabilityBlockId={selectedAvailabilityBlockId}
                selectedVisitId={selectedVisitId}
                threadLaneActions={selectedVisitThreadLaneActions}
                zoomPreset={activeZoomPreset}
              />
            )}
          </div>
        </section>

        {utilityTrayOpen ? (
          <DispatchResourceFilters
            defaultDayDate={currentState.date}
            includeUnassigned={currentState.includeUnassigned}
            onClearSelectedAvailabilityBlock={() => setSelectedAvailabilityBlockId(null)}
            onClose={() => setUtilityTrayOpen(false)}
            onCreateAvailabilityBlock={handleCreateAvailabilityBlock}
            onOpenSavedViewDialog={() => setDialogOpen(true)}
            onRemoveAvailabilityBlock={handleRemoveAvailabilityBlock}
            onSavedViewChange={handleSavedViewChange}
            onScopeChange={handleScopeChange}
            onSelectSingleTechnician={handleSelectSingleTechnician}
            onToggleIncludeUnassigned={(value) =>
              navigate({
                includeUnassigned: value,
                savedViewId: ""
              })
            }
            onToggleSubsetTechnician={(technicianUserId) => {
              const nextSelection = currentState.resourceUserIds.includes(technicianUserId)
                ? currentState.resourceUserIds.length === 1
                  ? currentState.resourceUserIds
                  : currentState.resourceUserIds.filter((value) => value !== technicianUserId)
                : [...currentState.resourceUserIds, technicianUserId];

              navigate({
                resourceUserIds: nextSelection,
                savedViewId: "",
                scope: "subset"
              });
            }}
            onUpdateAvailabilityBlock={handleUpdateAvailabilityBlock}
            pendingAvailabilityBlock={creatingAvailabilityBlock}
            pendingAvailabilityBlockId={savingAvailabilityBlockId}
            removingAvailabilityBlockId={removingAvailabilityBlockId}
            resourcePreferences={resourcePreferences}
            savedViewId={currentState.savedViewId}
            savedViews={savedViews}
            scope={currentState.scope}
            selectedAvailabilityBlock={selectedAvailabilityBlock}
            selectedResourceUserIds={
              currentState.scope === "all_workers" && !currentState.resourceUserIds.length
                ? visibleTechnicianIds
                : currentState.resourceUserIds
            }
            settings={activeCalendar.settings}
            settingsHref={settingsHref}
            technicians={visibleTechnicians.length ? visibleTechnicians : technicians}
            timezone={activeCalendar.timezone}
          />
        ) : conflictPanelOpen ? (
          <DispatchConflictPanel
            conflicts={selectedConflictScope}
            focusedTechnicianUserId={focusedConflictTechnicianUserId}
            onClearFocus={() => setFocusedConflictTechnicianUserId(null)}
            onClose={() => setConflictPanelOpen(false)}
            onOpenConflict={focusDispatchTarget}
            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
            technicians={visibleTechnicians.length ? visibleTechnicians : technicians}
          />
        ) : showOperationsRail ? (
          <DispatchOperationsRail
            batchDeferLowConfidencePending={batchInterventionPending === "defer_low_confidence"}
            batchNotifyCloseoutRiskPending={
              batchInterventionPending === "notify_closeout_risk" ||
              batchInterventionPending === "resolve_closeout_handoff"
            }
            batchNotifyPromiseRiskPending={batchInterventionPending === "notify_promise_risk"}
            batchNotifyStaleApprovalsPending={batchInterventionPending === "notify_stale_approvals"}
            batchNotifyStaleReturnsPending={batchInterventionPending === "notify_stale_returns"}
            closeoutRiskCount={closeoutRiskCount}
            closeoutRiskItems={closeoutRiskItems}
            compactMode={surfaceMode !== "follow_through"}
            conflicts={activeCalendar.conflicts}
            dominantInterventionAction={dispatchDominantInterventionAction}
            focusedResourceUserId={focusedResourceUserId}
            interventionSummaryItems={dispatchInterventionSummaryItems}
            jobs={activeCalendar.jobs}
            lowConfidenceCount={lowConfidenceCount}
            lowConfidenceItems={lowConfidenceItems}
            now={clockNow}
            onDeferLowConfidenceBatch={() => {
              void handleDeferLowConfidenceBatch();
            }}
            onDeferLowConfidence={(jobId) => {
              void handleDeferLowConfidence(jobId);
            }}
            onFocusResourceConflicts={focusResourceConflicts}
            onFocusSingleLane={focusSingleLane}
            onNotifyCloseoutRiskBatch={() => {
              void handleNotifyCloseoutRiskBatch();
            }}
            onNotifyCloseoutRisk={(jobId) => {
              void handleNotifyCloseoutRisk(jobId);
            }}
            onResolveCloseoutHandoff={(jobId, input) => {
              void handleResolveCloseoutHandoff(jobId, input);
            }}
            onNotifyPromiseRiskBatch={() => {
              void handleNotifyPromiseRiskBatch();
            }}
            onNotifyPromiseRisk={(jobId) => {
              void handleNotifyPromiseRisk(jobId);
            }}
            onNotifyStaleApproval={(jobId) => {
              void handleNotifyStaleApproval(jobId);
            }}
            onNotifyStaleApprovalsBatch={() => {
              void handleNotifyStaleApprovalsBatch();
            }}
            onNotifyStaleReturn={(jobId) => {
              void handleNotifyStaleReturn(jobId);
            }}
            onNotifyStaleReturnsBatch={() => {
              void handleNotifyStaleReturnsBatch();
            }}
            onOpenVisit={(jobId) => syncSelectedVisit(jobId)}
            promiseRiskCount={promiseRiskCount}
            promiseSummaries={effectivePromiseSummaries}
            queueCount={openQueueCount}
            resources={dispatchSurfaceCalendar.resources}
            readyQueueCount={readyQueueCount}
            returnToHref={dispatchReturnHref}
            returnToLabel="Back to dispatch"
            selectedVisit={selectedScheduledVisit}
            selectedVisitId={selectedVisitId}
            supplyBlockedCount={supplyBlockedCount}
            supplyBlockedItems={supplyBlockedItems}
            supplyHref="/dashboard/supply"
            staleApprovalItems={staleApprovalItems}
            staleApprovalCount={staleApprovalCount}
            followUpVisitCount={followUpVisitCount}
            staleFollowUpItems={staleFollowUpItems}
            staleFollowUpVisitCount={staleFollowUpVisitCount}
            timezone={activeCalendar.timezone}
            financeHref="/dashboard/finance"
            visitsNeedsAssignmentHref={visitsNeedsAssignmentHref}
            visitsPromiseRiskHref={visitsPromiseRiskHref}
            visitsReturnVisitHref={visitsReturnVisitHref}
            visitsStaleReturnVisitHref={visitsStaleReturnVisitHref}
            visitsStaleApprovalHref={visitsStaleApprovalHref}
          />
        ) : null}
      </div>

      <DispatchQuickEditPanel
        calendar={activeCalendar}
        visit={selectedVisit}
        onClose={() => syncSelectedVisit(null)}
        onSave={handleQuickEditSave}
        pending={savingQuickEdit}
        returnToHref={dispatchReturnHref}
        returnToLabel="Back to dispatch"
        settings={activeCalendar.settings}
        technicians={technicians}
        timezone={calendar.timezone}
      />

      <DispatchSavedViewDialog
        currentVisibleTechnicianIds={visibleTechnicianIds}
        currentView={currentState.view}
        includeUnassigned={currentState.includeUnassigned}
        onClose={() => setDialogOpen(false)}
        onDelete={handleDeleteView}
        onSave={handleSaveView}
        open={dialogOpen}
        savedView={savedViewForDialog}
        scope={currentState.scope}
        technicians={technicians}
      />
    </div>
  );
}
