"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isTechnicianActiveFieldJobStatus, toDispatchDateTimeInput } from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  DispatchBoardJobItem,
  DispatchCalendarJobEvent,
  DispatchCalendarResource,
  QuickEditDispatchJobInput,
  TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";

import {
  AppIcon,
  Badge,
  Button,
  Input,
  PriorityBadge,
  Select,
  buttonClassName,
  type BadgeTone
} from "../../../../components/ui";
import { getDispatchResourceLaneState } from "../../../../lib/dispatch/lane-health";
import {
  getDispatchLaneOpportunityScore,
  getDispatchLanePressureScore,
  getDispatchLaneSuggestionCopy
} from "../../../../lib/dispatch/intelligence";
import {
  getDispatchQueueLabel,
  getDispatchQueueState,
  getVisitNextMove,
  getVisitWorkflowLabel,
  getVisitWorkflowTone,
  getVisitWorkflowState
} from "../../../../lib/jobs/workflow";
import { buildVisitPartsHref } from "../../../../lib/visits/workspace";

import {
  formatDispatchDuration,
  formatDispatchShortRange,
  getDispatchVisitOperationalSignal,
  getDispatchVisitSupportingText
} from "./dispatch-calendar-signals";
import type {
  DispatchInterventionAction,
  DispatchInterventionSummaryItem
} from "./dispatch-intervention-model";
import { DispatchHandoffResolutionControl } from "./dispatch-handoff-resolution-control";

type DispatchCommandDeckProps = {
  approvedReleaseJobIds: string[];
  backlogJobs: DispatchBoardJobItem[];
  batchDeferLowConfidencePending?: boolean | undefined;
  batchNotifyCloseoutRiskPending?: boolean | undefined;
  batchNotifyPromiseRiskPending?: boolean | undefined;
  batchNotifyStaleApprovalsPending?: boolean | undefined;
  batchNotifyStaleReturnsPending?: boolean | undefined;
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
  financeHref: string;
  dominantInterventionAction: DispatchInterventionAction | null;
  interventionSummaryItems: DispatchInterventionSummaryItem[];
  jobs: DispatchCalendarJobEvent[];
  lowConfidenceItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  onDeferLowConfidence: (jobId: string) => void;
  onFocusResourceConflicts: (technicianUserId: string) => void;
  onFocusSingleLane: (technicianUserId: string) => void;
  onNotifyCloseoutRisk: (jobId: string) => void;
  onResolveCloseoutHandoff: (
    jobId: string,
    input: {
      resolutionDisposition: TechnicianPaymentResolutionDisposition;
      resolutionNote: string | null;
    }
  ) => void;
  onNotifyPromiseRisk: (jobId: string) => void;
  onNotifyStaleApproval: (jobId: string) => void;
  onNotifyStaleReturn: (jobId: string) => void;
  onOpenVisit: (jobId: string) => void;
  onQuickEditReleaseVisit: (input: QuickEditDispatchJobInput) => Promise<void>;
  promiseRiskJobs: DispatchBoardJobItem[];
  resources: DispatchCalendarResource[];
  returnToHref: string;
  returnToLabel: string;
  staleApprovalItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  staleFollowUpItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  supplyBlockedItems: Array<{
    customerDisplayName: string;
    jobId: string;
    supplyBlockerCount: number;
    title: string;
    vehicleDisplayName: string;
  }>;
  supplyHref: string;
  technicians: AssignableTechnicianOption[];
  timezone: string;
  unassignedScheduledJobs: DispatchBoardJobItem[];
  visitsNeedsAssignmentHref: string;
  visitsReadyDispatchHref: string;
};

type DispatchInterventionCard = {
  action?: {
    href?: string | undefined;
    label: string;
    loading?: boolean | undefined;
    onClick?: (() => void) | undefined;
  } | undefined;
  detail: string;
  handoffResolutionDisposition?: TechnicianPaymentResolutionDisposition | null | undefined;
  jobId: string;
  kind: string;
  meta: string;
  score: number;
  support: string;
  supportTone: BadgeTone;
  title: string;
};

type DispatchReleaseCard = {
  lane: DispatchCalendarResource | null;
  laneCopy: string;
  sourceTone: BadgeTone;
  sourceLabel: string;
  visit: DispatchBoardJobItem;
};

function getResourceJobs(resourceUserId: string, jobs: DispatchCalendarJobEvent[]) {
  return jobs
    .filter((job) => job.resourceTechnicianUserId === resourceUserId)
    .sort((left, right) => Date.parse(left.eventStartAt) - Date.parse(right.eventStartAt));
}

function getOpportunityScore(resource: DispatchCalendarResource) {
  return getDispatchLaneOpportunityScore(resource);
}

function getPressureScore(resource: DispatchCalendarResource) {
  return getDispatchLanePressureScore(resource);
}

function getLaneSuggestionCopy(
  visit: DispatchBoardJobItem,
  lane: DispatchCalendarResource | null
) {
  return getDispatchLaneSuggestionCopy(visit, lane);
}

function getReleaseCardDefaultTechnicianUserId(
  visit: DispatchBoardJobItem,
  lane: DispatchCalendarResource | null
) {
  return visit.assignedTechnicianUserId ?? lane?.technicianUserId ?? "";
}

type DispatchReleaseCardEntryProps = {
  lane: DispatchCalendarResource | null;
  laneCopy: string;
  onFocusSingleLane: (technicianUserId: string) => void;
  onOpenVisit: (jobId: string) => void;
  onQuickEditReleaseVisit: (input: QuickEditDispatchJobInput) => Promise<void>;
  sourceLabel: string;
  sourceTone: BadgeTone;
  technicians: AssignableTechnicianOption[];
  timezone: string;
  visit: DispatchBoardJobItem;
};

function DispatchReleaseCardEntry({
  lane,
  laneCopy,
  onFocusSingleLane,
  onOpenVisit,
  onQuickEditReleaseVisit,
  sourceLabel,
  sourceTone,
  technicians,
  timezone,
  visit
}: DispatchReleaseCardEntryProps) {
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState(() =>
    getReleaseCardDefaultTechnicianUserId(visit, lane)
  );
  const [scheduledStartAt, setScheduledStartAt] = useState(() =>
    toDispatchDateTimeInput(visit.scheduledStartAt ?? visit.arrivalWindowStartAt, timezone)
  );
  const [pendingAction, setPendingAction] = useState<"owner" | "promise" | "release" | null>(null);

  useEffect(() => {
    setAssignedTechnicianUserId(getReleaseCardDefaultTechnicianUserId(visit, lane));
  }, [lane, visit.assignedTechnicianUserId, visit.id]);

  useEffect(() => {
    setScheduledStartAt(
      toDispatchDateTimeInput(visit.scheduledStartAt ?? visit.arrivalWindowStartAt, timezone)
    );
  }, [timezone, visit.arrivalWindowStartAt, visit.id, visit.scheduledStartAt]);

  const workflowState = getVisitWorkflowState(visit);
  const queueState = getDispatchQueueState(visit);
  const hasScheduledPromise = Boolean(
    scheduledStartAt || visit.scheduledStartAt || visit.arrivalWindowStartAt
  );

  const runReleaseAction = async (
    action: "owner" | "promise" | "release",
    input: QuickEditDispatchJobInput
  ) => {
    setPendingAction(action);

    try {
      await onQuickEditReleaseVisit(input);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <article className="dispatch-command-card dispatch-command-card--release" key={visit.id}>
      <div className="dispatch-command-card__topline">
        <div className="dispatch-command-card__badge-row">
          <Badge tone={sourceTone}>{sourceLabel}</Badge>
          <Badge tone={getVisitWorkflowTone(workflowState)}>{getVisitWorkflowLabel(workflowState)}</Badge>
          <Badge tone={queueState === "ready_now" ? "warning" : "brand"}>
            {getDispatchQueueLabel(queueState)}
          </Badge>
          {visit.priority === "high" || visit.priority === "urgent" ? (
            <PriorityBadge value={visit.priority} />
          ) : null}
        </div>
      </div>
      <strong className="dispatch-command-card__title">{visit.title}</strong>
      <p className="dispatch-command-card__meta">
        {visit.customerDisplayName} · {visit.vehicleDisplayName}
      </p>
      <p className="dispatch-command-card__copy">
        {visit.scheduledStartAt
          ? `Target ${formatDispatchShortRange(visit.scheduledStartAt, visit.scheduledEndAt, timezone)}`
          : visit.arrivalWindowStartAt
            ? `Promise ${formatDispatchShortRange(
                visit.arrivalWindowStartAt,
                visit.arrivalWindowEndAt ?? visit.arrivalWindowStartAt,
                timezone
              )}`
          : getVisitNextMove(visit)}
      </p>
      <div className="dispatch-command-card__lane">
        <div>
          <span className="dispatch-command-card__lane-label">Suggested lane</span>
          <strong>{lane?.displayName ?? "Manual review"}</strong>
        </div>
        {lane ? <Badge tone={getDispatchResourceLaneState(lane).tone}>{laneCopy}</Badge> : null}
      </div>
      <div className="dispatch-command-card__inline-controls">
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Owner</span>
            <Select
              aria-label={`${visit.title} dispatch owner`}
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
          <Button
            loading={pendingAction === "owner"}
            onClick={() =>
              void runReleaseAction("owner", {
                assignedTechnicianUserId: assignedTechnicianUserId || null,
                jobId: visit.id
              })
            }
            size="sm"
            tone="secondary"
            type="button"
          >
            Save owner
          </Button>
        </div>
        <div className="dispatch-command-card__inline-form">
          <label className="dispatch-command-card__field">
            <span>Promise time</span>
            <Input
              aria-label={`${visit.title} promise time`}
              onChange={(event) => setScheduledStartAt(event.target.value)}
              type="datetime-local"
              value={scheduledStartAt}
            />
          </label>
          <Button
            loading={pendingAction === "promise"}
            onClick={() =>
              void runReleaseAction("promise", {
                arrivalWindowEndAt: scheduledStartAt || null,
                arrivalWindowStartAt: scheduledStartAt || null,
                jobId: visit.id,
                status: visit.status
              })
            }
            size="sm"
            tone="secondary"
            type="button"
          >
            Save promise
          </Button>
        </div>
      </div>
      <div className="dispatch-command-card__footer">
        <span>
          {hasScheduledPromise
            ? laneCopy
            : "Set a board time here, then release this visit into the live dispatch board."}
        </span>
        <div className="dispatch-command-card__actions">
          {lane ? (
            <Button
              onClick={() => onFocusSingleLane(lane.technicianUserId)}
              size="sm"
              tone="tertiary"
              type="button"
            >
              Focus lane
            </Button>
          ) : null}
          <Button
            disabled={!hasScheduledPromise}
            loading={pendingAction === "release"}
            onClick={() =>
              void runReleaseAction("release", {
                arrivalWindowEndAt:
                  scheduledStartAt || visit.arrivalWindowEndAt || visit.arrivalWindowStartAt || null,
                arrivalWindowStartAt:
                  scheduledStartAt || visit.arrivalWindowStartAt || null,
                assignedTechnicianUserId: assignedTechnicianUserId || null,
                jobId: visit.id,
                scheduledStartAt:
                  scheduledStartAt || visit.scheduledStartAt || visit.arrivalWindowStartAt || null,
                status: "scheduled"
              })
            }
            size="sm"
            tone="secondary"
            type="button"
          >
            Release to board
          </Button>
          <Button onClick={() => onOpenVisit(visit.id)} size="sm" tone="secondary" type="button">
            Open drawer
          </Button>
        </div>
      </div>
    </article>
  );
}

export function DispatchCommandDeck({
  approvedReleaseJobIds,
  backlogJobs,
  batchDeferLowConfidencePending,
  batchNotifyCloseoutRiskPending,
  batchNotifyPromiseRiskPending,
  batchNotifyStaleApprovalsPending,
  batchNotifyStaleReturnsPending,
  closeoutRiskItems,
  financeHref,
  dominantInterventionAction,
  interventionSummaryItems,
  jobs,
  lowConfidenceItems,
  onDeferLowConfidence,
  onFocusResourceConflicts,
  onFocusSingleLane,
  onNotifyCloseoutRisk,
  onResolveCloseoutHandoff,
  onNotifyPromiseRisk,
  onNotifyStaleApproval,
  onNotifyStaleReturn,
  onOpenVisit,
  onQuickEditReleaseVisit,
  promiseRiskJobs,
  resources,
  returnToHref,
  returnToLabel,
  staleApprovalItems,
  staleFollowUpItems,
  supplyBlockedItems,
  supplyHref,
  technicians,
  timezone,
  unassignedScheduledJobs,
  visitsNeedsAssignmentHref,
  visitsReadyDispatchHref
}: DispatchCommandDeckProps) {
  const approvedReleaseJobIdSet = new Set(approvedReleaseJobIds);
  const interventionCards = [
    ...promiseRiskJobs.slice(0, 3).map<DispatchInterventionCard>((job, index) => ({
      action: {
        label: "Send update",
        loading: batchNotifyPromiseRiskPending,
        onClick: () => onNotifyPromiseRisk(job.id)
      },
      detail: "Promise risk",
      jobId: job.id,
      kind: "Promise risk",
      meta: `${job.customerDisplayName} · ${job.vehicleDisplayName}`,
      score: 900 - index,
      support: getDispatchVisitSupportingText(job, timezone),
      supportTone: "danger",
      title: job.title
    })),
    ...staleApprovalItems.slice(0, 2).map<DispatchInterventionCard>((item, index) => ({
      action: {
        label: "Queue reminder",
        loading: batchNotifyStaleApprovalsPending,
        onClick: () => onNotifyStaleApproval(item.jobId)
      },
      detail: "Approval follow-up",
      jobId: item.jobId,
      kind: "Stale approval",
      meta: `${item.customerDisplayName} · ${item.vehicleDisplayName}`,
      score: 780 - index,
      support: item.promisedAt
        ? `Reminder overdue since ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
        : "Reminder due now",
      supportTone: "warning",
      title: item.title
    })),
    ...staleFollowUpItems.slice(0, 2).map<DispatchInterventionCard>((item, index) => ({
      action: {
        label: "Queue update",
        loading: batchNotifyStaleReturnsPending,
        onClick: () => onNotifyStaleReturn(item.jobId)
      },
      detail: "Return recovery",
      jobId: item.jobId,
      kind: "Stale return",
      meta: `${item.customerDisplayName} · ${item.vehicleDisplayName}`,
      score: 740 - index,
      support: item.promisedAt
        ? `Return still hanging since ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
        : "Return timing has drifted",
      supportTone: "warning",
      title: item.title
    })),
    ...supplyBlockedItems.slice(0, 2).map<DispatchInterventionCard>((item, index) => ({
      action: {
        href: buildVisitPartsHref(item.jobId, {
          returnLabel: returnToLabel,
          returnTo: returnToHref
        }),
        label: "Open parts thread"
      },
      detail: "Supply blocker",
      jobId: item.jobId,
      kind: "Supply blocked",
      meta: `${item.customerDisplayName} · ${item.vehicleDisplayName}`,
      score: 710 - index,
      support: `${item.supplyBlockerCount} supply blocker${item.supplyBlockerCount === 1 ? "" : "s"} still holding the stop`,
      supportTone: "warning",
      title: item.title
    })),
    ...closeoutRiskItems.slice(0, 2).map<DispatchInterventionCard>((item, index) => ({
      action: {
        label: item.openPaymentHandoffCount > 0 ? "Resolve handoff" : "Queue reminder",
        loading: batchNotifyCloseoutRiskPending,
        onClick: () =>
          item.openPaymentHandoffCount > 0
            ? undefined
            : onNotifyCloseoutRisk(item.jobId)
      },
      detail: "Closeout follow-through",
      handoffResolutionDisposition: item.handoffResolutionDisposition,
      jobId: item.jobId,
      kind: "Collections",
      meta: `${item.customerDisplayName} · ${item.vehicleDisplayName}`,
      score: 660 - index,
      support:
        item.handoffCopy ??
        `${Intl.NumberFormat("en-US", {
          currency: "USD",
          style: "currency"
        }).format(item.balanceDueCents / 100)} open · ${item.lastCustomerUpdateLabel}`,
      supportTone: item.trustTone === "danger" ? "danger" : item.trustTone === "warning" ? "warning" : "brand",
      title: item.title
    })),
    ...lowConfidenceItems.slice(0, 1).map<DispatchInterventionCard>((item, index) => ({
      action: {
        label: "Pull from board",
        loading: batchDeferLowConfidencePending,
        onClick: () => onDeferLowConfidence(item.jobId)
      },
      detail: "Weak promise",
      jobId: item.jobId,
      kind: "Low confidence",
      meta: `${item.customerDisplayName} · ${item.vehicleDisplayName}`,
      score: 620 - index,
      support: item.promisedAt
        ? `Current promise is weak for ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
        : "Current timing is too weak to trust",
      supportTone: "warning",
      title: item.title
    }))
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const queueVisits = [
    ...backlogJobs
      .filter((visit) => approvedReleaseJobIdSet.has(visit.id))
      .map((visit) => ({
        rank: 0,
        sourceLabel: "Approved release",
        sourceTone: "success" as const,
        visit
      })),
    ...unassignedScheduledJobs.map((visit) => ({
      rank: 1,
      sourceLabel: approvedReleaseJobIdSet.has(visit.id) ? "Approved release" : "Board release",
      sourceTone: approvedReleaseJobIdSet.has(visit.id) ? ("success" as const) : ("brand" as const),
      visit
    })),
    ...backlogJobs
      .filter(
        (visit) => visit.assignedTechnicianUserId && !approvedReleaseJobIdSet.has(visit.id)
      )
      .map((visit) => ({
        rank: 2,
        sourceLabel: "Assigned backlog",
        sourceTone: "warning" as const,
        visit
      }))
  ]
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.visit.id === entry.visit.id) === index
    )
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      const leftPriority =
        left.visit.priority === "urgent"
          ? 4
          : left.visit.priority === "high"
            ? 3
            : left.visit.priority === "normal"
              ? 2
              : 1;
      const rightPriority =
        right.visit.priority === "urgent"
          ? 4
          : right.visit.priority === "high"
            ? 3
            : right.visit.priority === "normal"
              ? 2
              : 1;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftTime = left.visit.scheduledStartAt
        ? Date.parse(left.visit.scheduledStartAt)
        : Number.MAX_SAFE_INTEGER;
      const rightTime = right.visit.scheduledStartAt
        ? Date.parse(right.visit.scheduledStartAt)
        : Number.MAX_SAFE_INTEGER;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.visit.title.localeCompare(right.visit.title);
    })
    .slice(0, 4);
  const opportunityLanes = [...resources].sort(
    (left, right) => getOpportunityScore(left) - getOpportunityScore(right)
  );
  const releaseCards = queueVisits.map<DispatchReleaseCard>(({ sourceLabel, sourceTone, visit }) => {
    const visibleAssignedLane =
      visit.assignedTechnicianUserId
        ? resources.find((resource) => resource.technicianUserId === visit.assignedTechnicianUserId) ?? null
        : null;
    const suggestedLane = visibleAssignedLane ?? opportunityLanes[0] ?? null;

    return {
      lane: suggestedLane,
      laneCopy: getLaneSuggestionCopy(visit, suggestedLane),
      sourceLabel,
      sourceTone,
      visit
    };
  });
  const sameDayOpenings = [...resources]
    .filter((resource) => resource.conflictCount === 0 && resource.backlogCount === 0)
    .sort((left, right) => getOpportunityScore(left) - getOpportunityScore(right))
    .slice(0, 3);
  const pressureLanes = [...resources]
    .filter(
      (resource) =>
        resource.conflictCount > 0 || resource.backlogCount > 0 || resource.scheduledCount >= 3
    )
    .sort((left, right) => getPressureScore(right) - getPressureScore(left))
    .slice(0, 3);

  return (
    <section className="dispatch-command-deck" aria-label="Dispatch command deck">
      <section className="dispatch-command-deck__panel">
        <div className="dispatch-command-deck__header">
          <div>
            <p className="dispatch-command-deck__eyebrow">
              <AppIcon className="dispatch-command-deck__eyebrow-icon" name="alert" />
              <span>Intervention queue</span>
            </p>
            <h3 className="dispatch-command-deck__title">Work the hottest threads first</h3>
          </div>
          <div className="dispatch-command-card__badge-row">
            {interventionSummaryItems.slice(0, 2).map((item) => (
              <Badge key={item.id} tone={item.tone}>
                {item.label}
              </Badge>
            ))}
            {!interventionSummaryItems.length ? (
              <Badge tone={interventionCards.length ? "warning" : "success"}>
                {interventionCards.length ? `${interventionCards.length} active` : "Calm"}
              </Badge>
            ) : null}
          </div>
        </div>

        {interventionCards.length ? (
          <div className="dispatch-command-deck__stack">
            {interventionCards.map((item) => (
              <article className="dispatch-command-card" key={`${item.kind}-${item.jobId}`}>
                <div className="dispatch-command-card__topline">
                  <span className="dispatch-command-card__lane-label">{item.kind}</span>
                  <button
                    className="dispatch-command-card__open-link"
                    onClick={() => onOpenVisit(item.jobId)}
                    type="button"
                  >
                    Open drawer
                  </button>
                </div>
                <strong className="dispatch-command-card__title">{item.title}</strong>
                <p className="dispatch-command-card__meta">{item.meta}</p>
                <p className="dispatch-command-card__copy">{item.support}</p>
                <div className="dispatch-command-card__footer">
                  <span>{item.detail}</span>
                  {item.handoffResolutionDisposition ? (
                    <DispatchHandoffResolutionControl
                      defaultDisposition={item.handoffResolutionDisposition}
                      disabled={item.action?.loading}
                      jobTitle={item.title}
                      loading={item.action?.loading}
                      onResolve={(input) => onResolveCloseoutHandoff(item.jobId, input)}
                    />
                  ) : item.action?.onClick ? (
                    <Button
                      loading={item.action.loading}
                      onClick={item.action.onClick}
                      size="sm"
                      tone="secondary"
                      type="button"
                    >
                      {item.action.label}
                    </Button>
                  ) : item.action?.href ? (
                    <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={item.action.href}>
                      {item.action.label}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="dispatch-command-deck__empty">
            No active interventions are outranking the board right now.
          </p>
        )}

        <div className="dispatch-command-deck__actions">
          {dominantInterventionAction?.kind === "batch" ? (
            <Button
              loading={dominantInterventionAction.pending}
              onClick={dominantInterventionAction.onClick}
              size="sm"
              tone="secondary"
              type="button"
            >
              {dominantInterventionAction.label}
            </Button>
          ) : dominantInterventionAction?.kind === "link" ? (
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href={dominantInterventionAction.href ?? "#"}
            >
              {dominantInterventionAction.label}
            </Link>
          ) : null}
          <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsNeedsAssignmentHref}>
            Open waiting visits
          </Link>
        </div>
      </section>

      <section className="dispatch-command-deck__panel">
        <div className="dispatch-command-deck__header">
          <div>
            <p className="dispatch-command-deck__eyebrow">
              <AppIcon className="dispatch-command-deck__eyebrow-icon" name="approval" />
              <span>Release now</span>
            </p>
            <h3 className="dispatch-command-deck__title">Move ready work onto lanes</h3>
          </div>
          <Badge tone={releaseCards.length ? "brand" : "neutral"}>{releaseCards.length}</Badge>
        </div>

        {releaseCards.length ? (
          <div className="dispatch-command-deck__stack">
            {releaseCards.map(({ lane, laneCopy, sourceLabel, sourceTone, visit }) => (
              <DispatchReleaseCardEntry
                key={visit.id}
                lane={lane}
                laneCopy={laneCopy}
                onFocusSingleLane={onFocusSingleLane}
                onOpenVisit={onOpenVisit}
                onQuickEditReleaseVisit={onQuickEditReleaseVisit}
                sourceLabel={sourceLabel}
                sourceTone={sourceTone}
                technicians={technicians}
                timezone={timezone}
                visit={visit}
              />
            ))}
          </div>
        ) : (
          <p className="dispatch-command-deck__empty">
            No commercially ready visits are waiting on immediate lane placement.
          </p>
        )}

        <div className="dispatch-command-deck__actions">
          <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsReadyDispatchHref}>
            Open release runway
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsNeedsAssignmentHref}>
            Open full waiting queue
          </Link>
        </div>
      </section>

      <section className="dispatch-command-deck__panel">
        <div className="dispatch-command-deck__header">
          <div>
            <p className="dispatch-command-deck__eyebrow">
              <AppIcon className="dispatch-command-deck__eyebrow-icon" name="dispatch" />
              <span>Lane capacity</span>
            </p>
            <h3 className="dispatch-command-deck__title">See opening space and route pressure</h3>
          </div>
          <Badge tone="neutral">{resources.length}</Badge>
        </div>

        <div className="dispatch-command-deck__section">
          <div className="dispatch-command-deck__section-header">
            <strong>Same-day openings</strong>
            <Badge tone={sameDayOpenings.length ? "success" : "neutral"}>{sameDayOpenings.length}</Badge>
          </div>
          {sameDayOpenings.length ? (
            <div className="dispatch-command-deck__stack">
              {sameDayOpenings.map((resource) => {
                const resourceJobs = getResourceJobs(resource.technicianUserId, jobs);
                const nextJob = resourceJobs[0] ?? null;
                const laneState = getDispatchResourceLaneState(resource);

                return (
                  <article className="dispatch-command-card dispatch-command-card--lane" key={resource.technicianUserId}>
                    <div className="dispatch-command-card__topline">
                      <Badge tone={laneState.tone}>{laneState.label}</Badge>
                      {resource.scheduledCount <= 1 ? <Badge tone="success">Insert candidate</Badge> : null}
                    </div>
                    <strong className="dispatch-command-card__title">{resource.displayName}</strong>
                    <p className="dispatch-command-card__meta">
                      {resource.scheduledCount
                        ? `${resource.scheduledCount} stop${resource.scheduledCount === 1 ? "" : "s"} · ${formatDispatchDuration(resource.scheduledMinutes)}`
                        : "Open lane"}
                    </p>
                    <p className="dispatch-command-card__copy">
                      {nextJob
                        ? `Next ${nextJob.title} · ${formatDispatchShortRange(nextJob.eventStartAt, nextJob.eventEndAt, timezone)}`
                        : "No placed stop is occupying this lane right now."}
                    </p>
                    <div className="dispatch-command-card__footer">
                      <span>
                        {resource.availabilityBlockCount
                          ? `${resource.availabilityBlockCount} shaped block${resource.availabilityBlockCount === 1 ? "" : "s"}`
                          : "Ready for same-day work"}
                      </span>
                      <Button
                        onClick={() => onFocusSingleLane(resource.technicianUserId)}
                        size="sm"
                        tone="tertiary"
                        type="button"
                      >
                        Focus lane
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dispatch-command-deck__empty">
              No visible lane looks obviously open for same-day insertion.
            </p>
          )}
        </div>

        <div className="dispatch-command-deck__section">
          <div className="dispatch-command-deck__section-header">
            <strong>Pressure lanes</strong>
            <Badge tone={pressureLanes.length ? "warning" : "neutral"}>{pressureLanes.length}</Badge>
          </div>
          {pressureLanes.length ? (
            <div className="dispatch-command-deck__stack">
              {pressureLanes.map((resource) => {
                const resourceJobs = getResourceJobs(resource.technicianUserId, jobs);
                const liveJob =
                  resourceJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status)) ?? null;
                const nextJob = liveJob ?? resourceJobs[0] ?? null;
                const laneState = getDispatchResourceLaneState(resource);
                const nextSignal = nextJob
                  ? getDispatchVisitOperationalSignal(nextJob, timezone)
                  : null;

                return (
                  <article className="dispatch-command-card dispatch-command-card--lane" key={`${resource.technicianUserId}-pressure`}>
                    <div className="dispatch-command-card__topline">
                      <Badge tone={laneState.tone}>{laneState.label}</Badge>
                      {resource.conflictCount ? (
                        <Badge tone="danger">
                          {resource.conflictCount} conflict{resource.conflictCount === 1 ? "" : "s"}
                        </Badge>
                      ) : resource.backlogCount ? (
                        <Badge tone="warning">{resource.backlogCount} waiting</Badge>
                      ) : null}
                    </div>
                    <strong className="dispatch-command-card__title">{resource.displayName}</strong>
                    <p className="dispatch-command-card__meta">
                      {resource.scheduledCount
                        ? `${resource.scheduledCount} stop${resource.scheduledCount === 1 ? "" : "s"} · ${formatDispatchDuration(resource.scheduledMinutes)}`
                        : "No placed stops"}
                    </p>
                    <p className="dispatch-command-card__copy">
                      {nextJob
                        ? `${liveJob ? "Live on" : "Next"} ${nextJob.title} · ${nextSignal?.label ?? formatDispatchShortRange(nextJob.eventStartAt, nextJob.eventEndAt, timezone)}`
                        : "Pressure is coming from waiting work or conflicts, not a placed stop."}
                    </p>
                    <div className="dispatch-command-card__footer">
                      <span>
                        {resource.conflictCount
                          ? "Clear the lane before placing more work"
                          : "Route quality is getting tight"}
                      </span>
                      <div className="dispatch-command-card__actions">
                        {resource.conflictCount ? (
                          <Button
                            onClick={() => onFocusResourceConflicts(resource.technicianUserId)}
                            size="sm"
                            tone="secondary"
                            type="button"
                          >
                            Review conflicts
                          </Button>
                        ) : null}
                        <Button
                          onClick={() => onFocusSingleLane(resource.technicianUserId)}
                          size="sm"
                          tone="tertiary"
                          type="button"
                        >
                          Focus lane
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dispatch-command-deck__empty">
              Lane pressure is low enough that the live board can do the rest of the work.
            </p>
          )}
        </div>

        <div className="dispatch-command-deck__actions">
          <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={supplyHref}>
            Open supply blockers
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={financeHref}>
            Open finance follow-through
          </Link>
        </div>
      </section>
    </section>
  );
}
