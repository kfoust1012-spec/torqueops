"use client";

import Link from "next/link";
import { isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
import type {
  DispatchCalendarConflict,
  DispatchCalendarJobEvent,
  DispatchCalendarResource,
  TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";

import { AppIcon, Badge, Button, StatusBadge, buttonClassName, cx } from "../../../../components/ui";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import {
  buildDispatchOnBoardFollowThroughItems,
  getDispatchLaneFollowThroughPressureScore,
  getDispatchOnBoardFollowThroughActionLabel,
  needsDispatchPromiseIntervention,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "../../../../lib/dispatch/follow-through";
import { getDispatchResourceLaneState as getLaneState } from "../../../../lib/dispatch/lane-health";
import {
  derivePromiseConfidenceSnapshot,
  deriveRouteConfidenceSnapshot
} from "../../../../lib/service-thread/continuity";
import { buildVisitPartsHref, buildVisitThreadHref } from "../../../../lib/visits/workspace";

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

type DispatchOperationsRailProps = {
  batchDeferLowConfidencePending?: boolean | undefined;
  batchNotifyCloseoutRiskPending?: boolean | undefined;
  batchNotifyPromiseRiskPending?: boolean | undefined;
  batchNotifyStaleApprovalsPending?: boolean | undefined;
  batchNotifyStaleReturnsPending?: boolean | undefined;
  closeoutRiskCount: number;
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
  compactMode: boolean;
  conflicts: DispatchCalendarConflict[];
  focusedResourceUserId: string | null;
  financeHref: string;
  dominantInterventionAction: DispatchInterventionAction | null;
  interventionSummaryItems: DispatchInterventionSummaryItem[];
  jobs: DispatchCalendarJobEvent[];
  lowConfidenceCount: number;
  lowConfidenceItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  now: Date;
  onDeferLowConfidence: (jobId: string) => void;
  onDeferLowConfidenceBatch: () => void;
  onFocusResourceConflicts: (technicianUserId: string) => void;
  onFocusSingleLane: (technicianUserId: string) => void;
  onNotifyCloseoutRisk: (jobId: string) => void;
  onNotifyCloseoutRiskBatch: () => void;
  onResolveCloseoutHandoff: (
    jobId: string,
    input: {
      resolutionDisposition: TechnicianPaymentResolutionDisposition;
      resolutionNote: string | null;
    }
  ) => void;
  onNotifyPromiseRisk: (jobId: string) => void;
  onNotifyPromiseRiskBatch: () => void;
  onNotifyStaleApproval: (jobId: string) => void;
  onNotifyStaleApprovalsBatch: () => void;
  onNotifyStaleReturn: (jobId: string) => void;
  onNotifyStaleReturnsBatch: () => void;
  onOpenVisit: (jobId: string) => void;
  followUpVisitCount: number;
  promiseSummaries: Array<{
    jobId: string;
    summary: DispatchOnBoardPromiseSummary;
  }>;
  staleFollowUpVisitCount: number;
  promiseRiskCount: number;
  queueCount: number;
  readyQueueCount: number;
  returnToHref: string;
  returnToLabel: string;
  resources: DispatchCalendarResource[];
  selectedVisit: DispatchCalendarJobEvent | null;
  selectedVisitId: string | null;
  supplyBlockedCount: number;
  supplyBlockedItems: Array<{
    customerDisplayName: string;
    jobId: string;
    supplyBlockerCount: number;
    title: string;
    vehicleDisplayName: string;
  }>;
  supplyHref: string;
  staleApprovalItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  staleApprovalCount: number;
  staleFollowUpItems: Array<{
    customerDisplayName: string;
    jobId: string;
    promisedAt: string | null;
    title: string;
    vehicleDisplayName: string;
  }>;
  timezone: string;
  visitsNeedsAssignmentHref: string;
  visitsPromiseRiskHref: string;
  visitsReturnVisitHref: string;
  visitsStaleReturnVisitHref: string;
  visitsStaleApprovalHref: string;
};

function getDispatchCloseoutSummaryCopy(
  item: DispatchOperationsRailProps["closeoutRiskItems"][number]
): string {
  if (item.openPaymentHandoffCount > 0) {
    return "Dispatch only needs to steady the live visit here. Finance should reconcile the field billing outcome next.";
  }
  if (item.balanceDueCents > 0) {
    return "Dispatch only needs the last customer touch here. Finance owns the rest of the closeout.";
  }
  return item.trustCopy;
}

function getResourceJobs(resourceUserId: string, jobs: DispatchCalendarJobEvent[]) {
  return jobs
    .filter((job) => job.resourceTechnicianUserId === resourceUserId)
    .sort((left, right) => new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime());
}

function getInsertionOpportunityCopy(resource: DispatchCalendarResource, jobs: DispatchCalendarJobEvent[]) {
  const resourceJobs = getResourceJobs(resource.technicianUserId, jobs);
  const liveJob = resourceJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status));

  if (liveJob) {
    return `Live on ${liveJob.title}`;
  }

  if (resource.scheduledCount === 0) {
    return "Open lane";
  }

  if (resource.scheduledCount === 1) {
    return "One scheduled stop";
  }

  return `${resource.scheduledCount} scheduled stops`;
}

function buildVisitSupplyThreadHref(jobId: string, returnToHref: string, returnToLabel: string) {
  return buildVisitPartsHref(jobId, {
    returnLabel: returnToLabel,
    returnTo: returnToHref
  });
}

function buildFinanceFileHref(invoiceId: string | null) {
  if (!invoiceId) {
    return "/dashboard/finance";
  }

  const params = new URLSearchParams();
  params.set("invoiceId", invoiceId);
  return `/dashboard/finance?${params.toString()}`;
}

export function DispatchOperationsRail({
  batchDeferLowConfidencePending,
  batchNotifyCloseoutRiskPending,
  batchNotifyPromiseRiskPending,
  batchNotifyStaleApprovalsPending,
  batchNotifyStaleReturnsPending,
  closeoutRiskCount,
  closeoutRiskItems,
  compactMode,
  conflicts,
  focusedResourceUserId,
  financeHref,
  dominantInterventionAction,
  interventionSummaryItems,
  jobs,
  lowConfidenceCount,
  lowConfidenceItems,
  now,
  onDeferLowConfidence,
  onDeferLowConfidenceBatch,
  onFocusResourceConflicts,
  onFocusSingleLane,
  onNotifyCloseoutRisk,
  onNotifyCloseoutRiskBatch,
  onResolveCloseoutHandoff,
  onNotifyPromiseRisk,
  onNotifyPromiseRiskBatch,
  onNotifyStaleApproval,
  onNotifyStaleApprovalsBatch,
  onNotifyStaleReturn,
  onNotifyStaleReturnsBatch,
  onOpenVisit,
  followUpVisitCount,
  promiseSummaries,
  staleFollowUpVisitCount,
  promiseRiskCount,
  queueCount,
  readyQueueCount,
  returnToHref,
  returnToLabel,
  resources,
  selectedVisit,
  selectedVisitId,
  supplyBlockedCount,
  supplyBlockedItems,
  supplyHref,
  staleApprovalItems,
  staleApprovalCount,
  staleFollowUpItems,
  timezone,
  visitsNeedsAssignmentHref,
  visitsPromiseRiskHref,
  visitsReturnVisitHref,
  visitsStaleReturnVisitHref,
  visitsStaleApprovalHref
}: DispatchOperationsRailProps) {
  const promiseSummariesByJobId = new Map(
    promiseSummaries.map((entry) => [entry.jobId, entry.summary] as const)
  );
  const visibleOnBoardFollowThroughCount = compactMode ? 2 : 5;
  const onBoardFollowThroughItems = buildDispatchOnBoardFollowThroughItems({
    jobs,
    now,
    promiseSummariesByJobId
  }).slice(0, visibleOnBoardFollowThroughCount);
  const laneFollowThroughByResourceId = new Map(
    resources.map((resource) => {
      const laneFollowThrough = summarizeDispatchLaneFollowThrough(
        buildDispatchOnBoardFollowThroughItems({
          jobs: getResourceJobs(resource.technicianUserId, jobs),
          now,
          promiseSummariesByJobId
        })
      );

      return [resource.technicianUserId, laneFollowThrough] as const;
    })
  );
  const detailedCardCount = 2;
  const compactCardCount = 4;
  const visibleLaneWatchCount = compactMode ? 3 : 5;
  const orderedResources = [...resources].sort((left, right) => {
    if (focusedResourceUserId) {
      if (left.technicianUserId === focusedResourceUserId) {
        return -1;
      }

      if (right.technicianUserId === focusedResourceUserId) {
        return 1;
      }
    }

    const leftJobs = getResourceJobs(left.technicianUserId, jobs);
    const rightJobs = getResourceJobs(right.technicianUserId, jobs);
    const leftLive = leftJobs.some((job) => isTechnicianActiveFieldJobStatus(job.status));
    const rightLive = rightJobs.some((job) => isTechnicianActiveFieldJobStatus(job.status));
    const leftFollowThrough = laneFollowThroughByResourceId.get(left.technicianUserId);
    const rightFollowThrough = laneFollowThroughByResourceId.get(right.technicianUserId);
    const leftScore =
      left.conflictCount * 1000 +
      getDispatchLaneFollowThroughPressureScore(
        leftFollowThrough ?? {
          attentionCount: 0,
          dangerCount: 0,
          highestRiskTone: "neutral",
          staleLabel: "No follow-through due",
          staleMinutes: null
        }
      ) +
      left.backlogCount * 140 +
      (leftLive ? 40 : 0) +
      left.scheduledCount;
    const rightScore =
      right.conflictCount * 1000 +
      getDispatchLaneFollowThroughPressureScore(
        rightFollowThrough ?? {
          attentionCount: 0,
          dangerCount: 0,
          highestRiskTone: "neutral",
          staleLabel: "No follow-through due",
          staleMinutes: null
        }
      ) +
      right.backlogCount * 140 +
      (rightLive ? 40 : 0) +
      right.scheduledCount;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.displayName.localeCompare(right.displayName);
  });
  const hasBoardSignal = queueCount > 0 || readyQueueCount > 0 || conflicts.length > 0 || jobs.length > 0;
  const focusedResource =
    (focusedResourceUserId
      ? resources.find((resource) => resource.technicianUserId === focusedResourceUserId)
      : undefined) ?? null;
  const focusedLaneState = focusedResource ? getLaneState(focusedResource) : null;
  const selectedVisitResource =
    (selectedVisit?.resourceTechnicianUserId
      ? resources.find((resource) => resource.technicianUserId === selectedVisit.resourceTechnicianUserId)
      : undefined) ?? null;
  const selectedVisitPromiseSummary = selectedVisit
    ? promiseSummariesByJobId.get(selectedVisit.id) ?? null
    : null;
  const selectedVisitPromiseConfidence =
    selectedVisit && selectedVisitPromiseSummary
      ? derivePromiseConfidenceSnapshot({
          hasServiceSitePlaybook: Boolean(selectedVisit.serviceSiteId),
          hasSupplyRisk: false,
          promiseSummary: {
            confidencePercent: selectedVisitPromiseSummary.confidencePercent,
            copy: selectedVisitPromiseSummary.copy,
            recommendedAction: selectedVisitPromiseSummary.recommendedAction
          },
          readinessSummary: {
            readyCount:
              Number(Boolean(selectedVisit.assignedTechnicianUserId)) +
              Number(Boolean(selectedVisit.arrivalWindowStartAt ?? selectedVisit.scheduledStartAt)) +
              Number(Boolean(selectedVisit.serviceSiteId)),
            score: Math.round(
              ((Number(Boolean(selectedVisit.assignedTechnicianUserId)) +
                Number(Boolean(selectedVisit.arrivalWindowStartAt ?? selectedVisit.scheduledStartAt)) +
                Number(Boolean(selectedVisit.serviceSiteId))) /
                3) *
                100
            ),
            totalCount: 3
          },
          releaseRunwayState: null,
          trustSummary: {
            risk:
              selectedVisitPromiseSummary.breachRisk === "high"
                ? "high"
                : selectedVisitPromiseSummary.breachRisk === "watch"
                  ? "watch"
                  : "none"
          }
        })
      : null;
  const selectedVisitRouteConfidence =
    selectedVisit && selectedVisitPromiseConfidence
      ? deriveRouteConfidenceSnapshot({
          hasLiveGps:
            isTechnicianActiveFieldJobStatus(selectedVisit.status)
              ? Boolean(selectedVisit.assignedTechnicianUserId)
              : true,
          hasPartsConfidence: true,
          hasServiceSitePlaybook: Boolean(selectedVisit.serviceSiteId),
          hasTechnicianReadiness:
            Boolean(selectedVisit.assignedTechnicianUserId) ||
            selectedVisit.status === "completed" ||
            selectedVisit.status === "canceled",
          laneSlackMinutes:
            selectedVisitResource?.conflictCount
              ? 15
              : selectedVisitResource?.backlogCount
                ? 30
                : selectedVisit.status === "scheduled"
                  ? 45
                  : 60,
          promiseConfidencePercent: selectedVisitPromiseConfidence.confidencePercent,
          routeIssueCount:
            Number(!selectedVisit.assignedTechnicianUserId) +
            Number(!selectedVisit.serviceSiteId) +
            Number((selectedVisitResource?.conflictCount ?? 0) > 0) +
            Number((selectedVisitResource?.backlogCount ?? 0) > 0)
        })
      : null;
  const selectedVisitCustomerHref = selectedVisit
    ? buildCustomerWorkspaceHref(selectedVisit.customerId)
    : null;
  const selectedVisitSiteThreadHref =
    selectedVisit?.serviceSiteId
      ? buildCustomerWorkspaceHref(selectedVisit.customerId, {
          editAddressId: selectedVisit.serviceSiteId,
          tab: "addresses"
        })
      : null;
  const insertionCandidates = orderedResources
    .filter((resource) => {
      const resourceJobs = getResourceJobs(resource.technicianUserId, jobs);
      const liveJob = resourceJobs.find(
        (job) => isTechnicianActiveFieldJobStatus(job.status)
      );

      return (
        resource.conflictCount === 0 &&
        resource.backlogCount === 0 &&
        !liveJob &&
        resource.scheduledCount <= 1
      );
    })
    .slice(0, 3);
  const insertionOpportunityCount = Math.min(queueCount, insertionCandidates.length);
  const promiseRiskJobs = jobs
    .filter((job) => needsDispatchPromiseIntervention(promiseSummariesByJobId.get(job.id) ?? null))
    .sort((left, right) => Date.parse(left.eventStartAt) - Date.parse(right.eventStartAt));
  const nextPromiseRiskJob =
    (selectedVisit &&
    needsDispatchPromiseIntervention(promiseSummariesByJobId.get(selectedVisit.id) ?? null)
      ? selectedVisit
      : null) ?? promiseRiskJobs[0] ?? null;
  const laneWatchResources = orderedResources.slice(0, visibleLaneWatchCount);
  const hiddenLaneWatchCount = Math.max(orderedResources.length - laneWatchResources.length, 0);
  const compactSecondaryWatchSections = compactMode
    ? [
        lowConfidenceCount
          ? {
              count: lowConfidenceCount,
              href: visitsPromiseRiskHref,
              icon: "alert" as const,
              id: "low-confidence",
              label: "Weak promise"
            }
          : null,
        closeoutRiskCount
          ? {
              count: closeoutRiskCount,
              href: financeHref,
              icon: "invoices" as const,
              id: "closeout",
              label: "Closeout"
            }
          : null,
        supplyBlockedCount
          ? {
              count: supplyBlockedCount,
              href: supplyHref,
              icon: "inventory" as const,
              id: "supply",
              label: "Supply blocked"
            }
          : null,
        staleApprovalCount
          ? {
              count: staleApprovalCount,
              href: visitsStaleApprovalHref,
              icon: "approval" as const,
              id: "stale-approvals",
              label: "Stale approvals"
            }
          : null,
        staleFollowUpVisitCount
          ? {
              count: staleFollowUpVisitCount,
              href: visitsStaleReturnVisitHref,
              icon: "jobs" as const,
              id: "stale-returns",
              label: "Stale returns"
            }
          : null,
        followUpVisitCount
          ? {
              count: followUpVisitCount,
              href: visitsReturnVisitHref,
              icon: "jobs" as const,
              id: "return-work",
              label: "Return work"
            }
          : null,
        insertionOpportunityCount
          ? {
              count: insertionOpportunityCount,
              href: visitsNeedsAssignmentHref,
              icon: "dispatch" as const,
              id: "same-day-fit",
              label: "Same-day fit"
            }
          : null
      ].filter(
        (
          item
        ): item is {
          count: number;
          href: string;
          icon: "alert" | "approval" | "dispatch" | "inventory" | "invoices" | "jobs";
          id: string;
          label: string;
        } => Boolean(item)
      )
    : [];
  const expandedSecondaryWatchSectionCount = [
    followUpVisitCount > 0,
    closeoutRiskCount > 0,
    supplyBlockedCount > 0,
    staleApprovalItems.length > 0,
    staleFollowUpItems.length > 0
  ].filter(Boolean).length;
  const dominantInterventionTone =
    dominantInterventionAction?.id === "promise_risk"
      ? "danger"
      : dominantInterventionAction?.id === "ready_release" ||
          dominantInterventionAction?.id === "stale_return" ||
          dominantInterventionAction?.id === "closeout_risk"
        ? "brand"
        : "warning";
  const dominantInterventionStateLabel =
    dominantInterventionAction?.id === "ready_release"
      ? "Release runway"
      : dominantInterventionAction?.id === "stale_return"
        ? "Needs recovery"
        : dominantInterventionAction?.id === "closeout_risk"
          ? "Needs follow-through"
          : dominantInterventionAction?.id === "stale_approval"
            ? "Needs follow-up"
            : "Needs intervention";

  return (
    <aside className="dispatch-ops-rail">
      <div className="dispatch-ops-rail__header">
        <div>
          <p className="dispatch-ops-rail__eyebrow">
            <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="team" />
            <span>Live intervention</span>
          </p>
          <h3 className="dispatch-ops-rail__title">Intervention dock</h3>
        </div>
        <Badge tone="neutral">{resources.length} lane{resources.length === 1 ? "" : "s"}</Badge>
      </div>

      <div className="dispatch-ops-rail__summary-line">
        {interventionSummaryItems.slice(0, 3).map((item) => (
          <Badge key={item.id} tone={item.tone}>
            {item.label}
          </Badge>
        ))}
        {jobs.length > 0 && interventionSummaryItems.length < 3 ? (
          <Badge tone="neutral">{jobs.length} placed</Badge>
        ) : null}
        {!hasBoardSignal ? <span className="dispatch-ops-rail__quiet-state">Intervention lane clear</span> : null}
      </div>

      {dominantInterventionAction ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="alert" />
              <span>Recovery watch</span>
            </p>
            <Badge tone={dominantInterventionTone}>{dominantInterventionStateLabel}</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            {dominantInterventionAction?.title ??
              `${staleApprovalCount} sent estimate${staleApprovalCount === 1 ? "" : "s"} need follow-up`}
          </strong>
          <p className="dispatch-ops-focus__copy">
            {dominantInterventionAction?.copy ??
              "Keep route recovery, approval pursuit, and return-work triage visible from dispatch instead of burying them in separate queues."}
          </p>
          {nextPromiseRiskJob ? (
            <div className="dispatch-ops-card dispatch-ops-card--compact">
              <div className="dispatch-ops-card__header">
                <div className="dispatch-ops-card__identity">
                  <strong className="dispatch-ops-card__name">{nextPromiseRiskJob.title}</strong>
                  <p className="dispatch-ops-card__meta">
                    {nextPromiseRiskJob.customerDisplayName} ·{" "}
                    {formatDispatchShortRange(
                      nextPromiseRiskJob.eventStartAt,
                      nextPromiseRiskJob.eventEndAt,
                      timezone
                    )}
                  </p>
                  <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                    <Badge tone="danger">At-risk stop</Badge>
                  </div>
                </div>
                <div className="ui-button-grid">
                  <Button
                    loading={batchNotifyPromiseRiskPending}
                    onClick={() => onNotifyPromiseRisk(nextPromiseRiskJob.id)}
                    size="sm"
                    tone="primary"
                    type="button"
                  >
                    Send update
                  </Button>
                  <Button
                    aria-label={`Open recovery drawer for ${nextPromiseRiskJob.title}`}
                    onClick={() => onOpenVisit(nextPromiseRiskJob.id)}
                    size="sm"
                    tone="secondary"
                    type="button"
                  >
                    Open drawer
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="dispatch-ops-focus__actions">
            {dominantInterventionAction?.kind === "batch" ? (
              <Button
                loading={dominantInterventionAction.pending}
                onClick={dominantInterventionAction.onClick}
                size="sm"
                tone="primary"
                type="button"
              >
                {dominantInterventionAction.label}
              </Button>
            ) : dominantInterventionAction?.kind === "link" ? (
              <Link
                className={buttonClassName({ size: "sm", tone: "primary" })}
                href={dominantInterventionAction.href ?? "#"}
              >
                {dominantInterventionAction.label}
              </Link>
            ) : null}
            {promiseRiskCount > 0 ? (
              <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsPromiseRiskHref}>
                Open promise risk
              </Link>
            ) : null}
            {staleApprovalCount > 0 ? (
              <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsStaleApprovalHref}>
                Open stale approvals
              </Link>
            ) : null}
            {staleFollowUpVisitCount > 0 ? (
              <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsStaleReturnVisitHref}>
                Open stale returns
              </Link>
            ) : null}
          </div>
        </article>
      ) : null}

      {onBoardFollowThroughItems.length ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="dispatch" />
              <span>Already on board</span>
            </p>
            <Badge tone={onBoardFollowThroughItems[0]?.promiseSummary.tone ?? "neutral"}>
              {onBoardFollowThroughItems.filter(
                (item) => item.promiseSummary.tone === "danger" || item.promiseSummary.tone === "warning"
              ).length || onBoardFollowThroughItems.length}{" "}
              live follow-through
            </Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            Dispatch owns the live timing threads already on the board
          </strong>
          <p className="dispatch-ops-focus__copy">
            The riskiest customer-update gaps and weakest live promises rise first so routine on-board visits do not crowd out follow-through work.
          </p>
          <div className="dispatch-ops-rail__stack">
            {onBoardFollowThroughItems.map((item) => {
              const operationalSignal = getDispatchVisitOperationalSignal(item.job, timezone, now);
              const primaryActionIsDispatchUpdate =
                item.promiseSummary.recommendedAction === "dispatched" ||
                item.promiseSummary.recommendedAction === "en_route";

              return (
                <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.job.id}>
                  <div className="dispatch-ops-card__header">
                    <div className="dispatch-ops-card__identity">
                      <strong className="dispatch-ops-card__name">{item.job.title}</strong>
                      <p className="dispatch-ops-card__meta">
                        {item.job.customerDisplayName} · {item.job.vehicleDisplayName}
                      </p>
                      <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                        <Badge tone={operationalSignal.tone}>{operationalSignal.label}</Badge>
                        <Badge tone={item.promiseSummary.tone}>{item.promiseSummary.label}</Badge>
                        <Badge tone="neutral">{item.promiseSummary.confidenceLabel}</Badge>
                      </div>
                      <p className="dispatch-ops-card__meta">
                        {item.promiseSummary.lastCustomerUpdateLabel} · {item.promiseSummary.nextUpdateLabel}
                      </p>
                    </div>
                    <div className="ui-button-grid">
                      <Button
                        loading={primaryActionIsDispatchUpdate && batchNotifyPromiseRiskPending}
                        onClick={() =>
                          primaryActionIsDispatchUpdate
                            ? onNotifyPromiseRisk(item.job.id)
                            : onOpenVisit(item.job.id)
                        }
                        size="sm"
                        tone="primary"
                        type="button"
                      >
                        {getDispatchOnBoardFollowThroughActionLabel(
                          item.promiseSummary.recommendedAction
                        )}
                      </Button>
                      {item.job.resourceTechnicianUserId ? (
                        <Button
                          onClick={() => onFocusSingleLane(item.job.resourceTechnicianUserId!)}
                          size="sm"
                          tone="secondary"
                          type="button"
                        >
                          Focus lane
                        </Button>
                      ) : (
                        <Button
                          aria-label={`Open on-board visit ${item.job.title}`}
                          onClick={() => onOpenVisit(item.job.id)}
                          size="sm"
                          tone="secondary"
                          type="button"
                        >
                          Open drawer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ) : null}

      {compactSecondaryWatchSections.length ? (
        <details className="dispatch-ops-rail__overflow">
          <summary className="dispatch-ops-rail__overflow-summary">
            <span>More watchlists</span>
            <Badge tone="neutral">{compactSecondaryWatchSections.length}</Badge>
          </summary>
          <div className="dispatch-ops-rail__summary">
            {compactSecondaryWatchSections.map((section) => (
              <Link
                className="dispatch-ops-rail__summary-item dispatch-ops-rail__summary-link"
                href={section.href}
                key={section.id}
              >
                <AppIcon className="dispatch-ops-rail__summary-icon" name={section.icon} />
                <span>{section.label}</span>
                <strong>{section.count}</strong>
              </Link>
            ))}
          </div>
        </details>
      ) : null}

      {!compactMode && lowConfidenceCount > 0 ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="today" />
              <span>Low-confidence replan</span>
            </p>
            <Badge tone="warning">{lowConfidenceCount} weak promise</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            Some scheduled stops should come off the live board before the promise breaks
          </strong>
          <p className="dispatch-ops-focus__copy">
            Use dispatch to move low-confidence timing back into the planning queue when the current commitment is too soft to trust.
          </p>
          {lowConfidenceItems.length ? (
            <div className="dispatch-ops-rail__stack">
              {lowConfidenceItems.map((item) => (
                <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.jobId}>
                  <div className="dispatch-ops-card__header">
                    <div className="dispatch-ops-card__identity">
                      <strong className="dispatch-ops-card__name">{item.title}</strong>
                      <p className="dispatch-ops-card__meta">
                        {item.customerDisplayName} · {item.vehicleDisplayName}
                      </p>
                      <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                        <Badge tone="warning">
                          {item.promisedAt
                            ? `Promised ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
                            : "Timing needs review"}
                        </Badge>
                      </div>
                    </div>
                    <div className="ui-button-grid">
                      <Button
                        loading={batchDeferLowConfidencePending}
                        onClick={() => onDeferLowConfidence(item.jobId)}
                        size="sm"
                        tone="primary"
                        type="button"
                      >
                        Pull to queue
                      </Button>
                      <Button
                        aria-label={`Open low-confidence visit ${item.title}`}
                        onClick={() => onOpenVisit(item.jobId)}
                        size="sm"
                        tone="secondary"
                        type="button"
                      >
                        Open drawer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="dispatch-ops-focus__actions">
            <Button
              loading={batchDeferLowConfidencePending}
              onClick={onDeferLowConfidenceBatch}
              size="sm"
              tone="secondary"
              type="button"
            >
              Pull weak promises
            </Button>
            <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsPromiseRiskHref}>
              Open promise risk
            </Link>
          </div>
        </article>
      ) : null}

      {!compactMode && expandedSecondaryWatchSectionCount > 0 ? (
        <details className="dispatch-ops-rail__overflow dispatch-ops-rail__overflow--expanded">
          <summary className="dispatch-ops-rail__overflow-summary">
            <span>More recovery watchlists</span>
            <Badge tone="neutral">{expandedSecondaryWatchSectionCount}</Badge>
          </summary>
          <div className="dispatch-ops-rail__overflow-body">
      {!compactMode && followUpVisitCount > 0 ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="jobs" />
              <span>Return-visit watch</span>
            </p>
            <Badge tone="brand">Keep visible</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            {followUpVisitCount} return visit{followUpVisitCount === 1 ? "" : "s"} are active on the board
          </strong>
          <p className="dispatch-ops-focus__copy">
            Keep second-trip work attached to the same vehicle thread so the office can route and recover it without recreating context.
          </p>
          <div className="dispatch-ops-focus__actions">
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsReturnVisitHref}>
              Open return visits
            </Link>
            {staleFollowUpVisitCount > 0 ? (
              <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsStaleReturnVisitHref}>
                Open stale return
              </Link>
            ) : null}
          </div>
        </article>
      ) : null}

      {!compactMode && closeoutRiskCount > 0 ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="invoices" />
              <span>Closeout watch</span>
            </p>
            <Badge tone="brand">
              {closeoutRiskItems.some((item) => item.openPaymentHandoffCount > 0)
                ? `${closeoutRiskCount} closeout thread`
                : `${closeoutRiskCount} money thread`}
            </Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            {closeoutRiskItems.some((item) => item.openPaymentHandoffCount > 0)
              ? "A live visit still needs finance handoff cleanup"
              : "A live visit still needs finance follow-through"}
          </strong>
          <p className="dispatch-ops-focus__copy">
            {closeoutRiskItems.some((item) => item.openPaymentHandoffCount > 0)
              ? "Dispatch only needs to stabilize the live thread here. Finance should reconcile the field billing outcome next."
              : "Dispatch only needs the last live touch here. Finance owns the rest of the closeout."}
          </p>
          {closeoutRiskItems.length ? (
            <div className="dispatch-ops-rail__stack">
              {closeoutRiskItems.map((item) => (
                <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.jobId}>
                  <div className="dispatch-ops-card__header">
                    <div className="dispatch-ops-card__identity">
                      <strong className="dispatch-ops-card__name">{item.title}</strong>
                      <p className="dispatch-ops-card__meta">
                        {item.customerDisplayName} · {item.vehicleDisplayName}
                      </p>
                      <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                        <Badge tone="brand">
                          {item.openPaymentHandoffCount > 0
                            ? item.handoffLabel ?? `${item.openPaymentHandoffCount} field handoff${item.openPaymentHandoffCount === 1 ? "" : "s"}`
                            : item.balanceDueCents > 0
                              ? `$${(item.balanceDueCents / 100).toFixed(2)}`
                              : "Balance review"}
                        </Badge>
                        <Badge tone={item.trustTone}>{item.trustLabel}</Badge>
                        <Badge tone="neutral">{item.lastCustomerUpdateLabel}</Badge>
                      </div>
                      <p className="dispatch-ops-card__support">{getDispatchCloseoutSummaryCopy(item)}</p>
                      <p className="dispatch-ops-card__support dispatch-ops-card__support--subtle">
                        Next move: {item.nextActionLabel}
                      </p>
                    </div>
                    <div className="ui-button-grid">
                      <Link
                        className={buttonClassName({ size: "sm", tone: "tertiary" })}
                        href={buildFinanceFileHref(item.invoiceId)}
                      >
                        {item.openPaymentHandoffCount > 0 ? "Resolve in finance" : "Finance file"}
                      </Link>
                      {item.openPaymentHandoffCount > 0 && item.handoffResolutionDisposition ? (
                        <DispatchHandoffResolutionControl
                          defaultDisposition={item.handoffResolutionDisposition}
                          disabled={batchNotifyCloseoutRiskPending}
                          jobTitle={item.title}
                          loading={batchNotifyCloseoutRiskPending}
                          onResolve={(input) => onResolveCloseoutHandoff(item.jobId, input)}
                        />
                      ) : (
                        <Button
                          loading={batchNotifyCloseoutRiskPending}
                          onClick={() => onNotifyCloseoutRisk(item.jobId)}
                          size="sm"
                          tone="primary"
                          type="button"
                        >
                          Queue reminder
                        </Button>
                      )}
                      <Button
                        aria-label={`Review closeout visit ${item.title}`}
                        onClick={() => onOpenVisit(item.jobId)}
                        size="sm"
                        tone="secondary"
                        type="button"
                      >
                        Visit thread
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="dispatch-ops-focus__actions">
            <Button
              loading={batchNotifyCloseoutRiskPending}
              onClick={onNotifyCloseoutRiskBatch}
              size="sm"
              tone="secondary"
              type="button"
            >
              Queue payment nudges
            </Button>
            <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={financeHref}>
              Open finance desk
            </Link>
          </div>
        </article>
      ) : null}

      {!compactMode && supplyBlockedCount > 0 ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="inventory" />
              <span>Supply watch</span>
            </p>
            <Badge tone="warning">{supplyBlockedCount} blocked</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            Parts and stock blockers are still freezing visits that dispatch can already see
          </strong>
          <p className="dispatch-ops-focus__copy">
            Keep supply pressure visible from the live board so approved work does not sit in limbo after the customer has already said yes.
          </p>
          <div className="dispatch-ops-rail__stack">
            {supplyBlockedItems.map((item) => (
              <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.jobId}>
                <div className="dispatch-ops-card__header">
                  <div className="dispatch-ops-card__identity">
                    <strong className="dispatch-ops-card__name">{item.title}</strong>
                    <p className="dispatch-ops-card__meta">
                      {item.customerDisplayName} · {item.vehicleDisplayName}
                    </p>
                    <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                      <Badge tone={item.supplyBlockerCount > 1 ? "danger" : "warning"}>
                        {item.supplyBlockerCount} blocker{item.supplyBlockerCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </div>
                  <div className="ui-button-grid">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "primary" })}
                      href={buildVisitSupplyThreadHref(item.jobId, returnToHref, returnToLabel)}
                    >
                      Open parts thread
                    </Link>
                    <Button
                      aria-label={`Open supply-blocked visit ${item.title}`}
                      onClick={() => onOpenVisit(item.jobId)}
                      size="sm"
                      tone="secondary"
                      type="button"
                    >
                      Open drawer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="dispatch-ops-focus__actions">
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={supplyHref}>
              Open supply desk
            </Link>
            <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={visitsNeedsAssignmentHref}>
              Open assignment queue
            </Link>
          </div>
        </article>
      ) : null}

      {!compactMode && staleApprovalItems.length ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="approval" />
              <span>Approval review</span>
            </p>
            <Badge tone="warning">{staleApprovalCount} stale</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            Stale approvals should stay inside the live command view
          </strong>
          <p className="dispatch-ops-focus__copy">
            Review the most delayed approval threads here, then open the full stale-approval slice only when you need broader cleanup.
          </p>
          <div className="dispatch-ops-rail__stack">
            {staleApprovalItems.map((item) => (
              <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.jobId}>
                <div className="dispatch-ops-card__header">
                  <div className="dispatch-ops-card__identity">
                    <strong className="dispatch-ops-card__name">{item.title}</strong>
                    <p className="dispatch-ops-card__meta">
                      {item.customerDisplayName} · {item.vehicleDisplayName}
                    </p>
                    <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                      <Badge tone="warning">
                        {item.promisedAt
                          ? `Promised ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
                          : "Timing needs review"}
                      </Badge>
                    </div>
                  </div>
                  <div className="ui-button-grid">
                    <Button
                      loading={batchNotifyStaleApprovalsPending}
                      onClick={() => onNotifyStaleApproval(item.jobId)}
                      size="sm"
                      tone="primary"
                      type="button"
                    >
                      Queue reminder
                    </Button>
                    <Button
                      aria-label={`Open stale approval visit ${item.title}`}
                      onClick={() => onOpenVisit(item.jobId)}
                      size="sm"
                      tone="secondary"
                      type="button"
                    >
                      Open drawer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="dispatch-ops-focus__actions">
            <Button
              loading={batchNotifyStaleApprovalsPending}
              onClick={onNotifyStaleApprovalsBatch}
              size="sm"
              tone="secondary"
              type="button"
            >
              Queue approval reminders
            </Button>
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsStaleApprovalHref}>
              Open stale approvals
            </Link>
          </div>
        </article>
      ) : null}

      {!compactMode && staleFollowUpItems.length ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="jobs" />
              <span>Stale return review</span>
            </p>
            <Badge tone="warning">{staleFollowUpVisitCount} stale</Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            Return-work threads need direct recovery attention
          </strong>
          <p className="dispatch-ops-focus__copy">
            Keep aging return visits visible here so dispatch can recover them before they become disconnected customer promises.
          </p>
          <div className="dispatch-ops-rail__stack">
            {staleFollowUpItems.map((item) => (
              <div className="dispatch-ops-card dispatch-ops-card--compact" key={item.jobId}>
                <div className="dispatch-ops-card__header">
                  <div className="dispatch-ops-card__identity">
                    <strong className="dispatch-ops-card__name">{item.title}</strong>
                    <p className="dispatch-ops-card__meta">
                      {item.customerDisplayName} · {item.vehicleDisplayName}
                    </p>
                    <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                      <Badge tone="warning">
                        {item.promisedAt
                          ? `Return due ${formatDispatchShortRange(item.promisedAt, item.promisedAt, timezone)}`
                          : "Return timing unclear"}
                      </Badge>
                    </div>
                  </div>
                  <div className="ui-button-grid">
                    <Button
                      loading={batchNotifyStaleReturnsPending}
                      onClick={() => onNotifyStaleReturn(item.jobId)}
                      size="sm"
                      tone="primary"
                      type="button"
                    >
                      Queue update
                    </Button>
                    <Button
                      aria-label={`Open stale return visit ${item.title}`}
                      onClick={() => onOpenVisit(item.jobId)}
                      size="sm"
                      tone="secondary"
                      type="button"
                    >
                      Open drawer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="dispatch-ops-focus__actions">
            <Button
              loading={batchNotifyStaleReturnsPending}
              onClick={onNotifyStaleReturnsBatch}
              size="sm"
              tone="secondary"
              type="button"
            >
              Queue return updates
            </Button>
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsStaleReturnVisitHref}>
              Open stale returns
            </Link>
          </div>
        </article>
      ) : null}

          </div>
        </details>
      ) : null}

      {!compactMode && insertionOpportunityCount > 0 ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="dispatch" />
              <span>Same-day insert</span>
            </p>
            <Badge tone="success">
              {insertionOpportunityCount} opening{insertionOpportunityCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <strong className="dispatch-ops-focus__title">
            {insertionOpportunityCount} lane{insertionOpportunityCount === 1 ? "" : "s"} can likely absorb waiting work
          </strong>
          <p className="dispatch-ops-focus__copy">
            {insertionCandidates.map((resource) => resource.displayName).join(", ")} look light enough for same-day insertion right now.
          </p>
          <div className="dispatch-ops-rail__stack">
            {insertionCandidates.map((resource) => (
              <div className="dispatch-ops-card dispatch-ops-card--compact" key={resource.technicianUserId}>
                <div className="dispatch-ops-card__header">
                  <div className="dispatch-ops-card__identity">
                    <strong className="dispatch-ops-card__name">{resource.displayName}</strong>
                    <p className="dispatch-ops-card__meta">
                      {getInsertionOpportunityCopy(resource, jobs)}
                    </p>
                    <div className="dispatch-ops-card__status-row dispatch-ops-card__status-row--minimal">
                      <Badge tone="success">Insert candidate</Badge>
                    </div>
                  </div>
                  <Button
                    aria-label={`Open lane for ${resource.displayName}`}
                    onClick={() => onFocusSingleLane(resource.technicianUserId)}
                    size="sm"
                    tone="tertiary"
                    type="button"
                  >
                    Focus lane
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="dispatch-ops-focus__actions">
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitsNeedsAssignmentHref}>
              Open waiting visits
            </Link>
          </div>
        </article>
      ) : null}

      {selectedVisit ? (
        <article className="dispatch-ops-focus dispatch-ops-focus--job">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="dispatch" />
              <span>Intervention focus</span>
            </p>
            <StatusBadge status={selectedVisit.status} />
          </div>
          <strong className="dispatch-ops-focus__title">{selectedVisit.title}</strong>
          <p className="dispatch-ops-focus__copy">
            {selectedVisit.customerDisplayName} · {selectedVisit.vehicleDisplayName} · keep the live board, customer promise, and release context aligned from one drawer.
          </p>
          <div className="dispatch-ops-focus__signals">
            {selectedVisitResource ? <Badge tone="brand">{selectedVisitResource.displayName}</Badge> : null}
            {selectedVisitPromiseConfidence ? (
              <Badge tone={selectedVisitPromiseConfidence.tone}>
                {selectedVisitPromiseConfidence.label} · {selectedVisitPromiseConfidence.confidencePercent}%
              </Badge>
            ) : null}
            {selectedVisitRouteConfidence ? (
              <Badge tone={selectedVisitRouteConfidence.tone}>
                {selectedVisitRouteConfidence.label} · {selectedVisitRouteConfidence.confidencePercent}%
              </Badge>
            ) : null}
            <Badge tone="neutral">
              {formatDispatchShortRange(selectedVisit.eventStartAt, selectedVisit.eventEndAt, timezone)}
            </Badge>
          </div>
          <div className="dispatch-ops-focus__actions">
            <Button
              aria-label={`Open visit drawer for ${selectedVisit.title}`}
              onClick={() => onOpenVisit(selectedVisit.id)}
              size="sm"
              tone="secondary"
              type="button"
            >
              Open intervention drawer
            </Button>
            <Link
              className={buttonClassName({ size: "sm", tone: "tertiary" })}
              href={buildVisitThreadHref(selectedVisit.id, {
                returnLabel: returnToLabel,
                returnTo: returnToHref
              })}
            >
              Open visit thread
            </Link>
            {selectedVisitCustomerHref ? (
              <Link
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                href={selectedVisitCustomerHref}
              >
                Open customer thread
              </Link>
            ) : null}
            {selectedVisitSiteThreadHref ? (
              <Link
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                href={selectedVisitSiteThreadHref}
              >
                Open site thread
              </Link>
            ) : null}
            {selectedVisitResource ? (
              <Button
                aria-label={`Open lane for ${selectedVisitResource.displayName}`}
                onClick={() => onFocusSingleLane(selectedVisitResource.technicianUserId)}
                size="sm"
                tone="tertiary"
                type="button"
              >
                Focus lane
              </Button>
            ) : null}
          </div>
        </article>
      ) : focusedResource ? (
        <article className="dispatch-ops-focus">
          <div className="dispatch-ops-focus__topline">
            <p className="dispatch-ops-rail__eyebrow">
              <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="team" />
              <span>Focused lane</span>
            </p>
            {focusedLaneState ? <Badge tone={focusedLaneState.tone}>{focusedLaneState.label}</Badge> : null}
          </div>
          <strong className="dispatch-ops-focus__title">{focusedResource.displayName}</strong>
          <p className="dispatch-ops-focus__copy">
            {focusedResource.scheduledCount > 0
              ? `${focusedResource.scheduledCount} scheduled · ${formatDispatchDuration(
                  focusedResource.scheduledMinutes || 0
                )}`
              : focusedResource.availabilityBlockCount > 0
                ? `${focusedResource.availabilityBlockCount} shaped window${
                    focusedResource.availabilityBlockCount === 1 ? "" : "s"
                  }`
                : "Route open"}
          </p>
          <div className="dispatch-ops-focus__signals">
            {focusedResource.scheduledCount > 0 ? (
              <Badge tone="neutral">
                {focusedResource.scheduledCount} scheduled · {formatDispatchDuration(focusedResource.scheduledMinutes || 0)}
              </Badge>
            ) : null}
            {focusedResource.backlogCount > 0 ? (
              <Badge tone="warning">{focusedResource.backlogCount} waiting</Badge>
            ) : null}
          </div>
          <div className="dispatch-ops-focus__actions">
            {focusedResource.conflictCount > 0 ? (
              <Button
                aria-label={`Review conflicts for ${focusedResource.displayName}`}
                onClick={() => onFocusResourceConflicts(focusedResource.technicianUserId)}
                size="sm"
                tone="secondary"
                type="button"
              >
                Review conflicts
              </Button>
            ) : null}
            <Button
              aria-label={`Open lane for ${focusedResource.displayName}`}
              onClick={() => onFocusSingleLane(focusedResource.technicianUserId)}
              size="sm"
              tone="tertiary"
              type="button"
            >
              Open lane
            </Button>
          </div>
        </article>
      ) : null}

      {laneWatchResources.length ? (
        <div className="dispatch-ops-rail__lane-watch">
          <div className="dispatch-ops-rail__lane-watch-header">
            <div>
              <p className="dispatch-ops-rail__eyebrow">
                <AppIcon className="dispatch-ops-rail__eyebrow-icon" name="dispatch" />
                <span>Lane watch</span>
              </p>
              <h4 className="dispatch-ops-rail__lane-watch-title">Highest-pressure lanes</h4>
            </div>
            <Badge tone="neutral">{laneWatchResources.length} shown</Badge>
          </div>
          <p className="dispatch-ops-rail__lane-watch-copy">
            Keep the hottest lane exceptions here. Stale timing gaps now outrank lanes that are only busy.
          </p>
        </div>
      ) : null}

      <div className="dispatch-ops-rail__stack">
        {laneWatchResources.map((resource, index) => {
          const resourceJobs = getResourceJobs(resource.technicianUserId, jobs);
          const resourceFollowThrough = laneFollowThroughByResourceId.get(resource.technicianUserId) ?? {
            attentionCount: 0,
            dangerCount: 0,
            highestRiskTone: "neutral" as const,
            staleLabel: "No follow-through due",
            staleMinutes: null
          };
          const liveJob =
            resourceJobs.find((job) => isTechnicianActiveFieldJobStatus(job.status)) ?? null;
          const nextJob = liveJob ?? resourceJobs[0] ?? null;
          const nextJobSignal = nextJob ? getDispatchVisitOperationalSignal(nextJob, timezone, now) : null;
          const nextJobPromiseSummary = nextJob ? promiseSummariesByJobId.get(nextJob.id) ?? null : null;
          const laneState = getLaneState(resource);
          const isCompactCard = index >= detailedCardCount;
          const isMinimalCard = index >= compactCardCount;
          const laneMeta =
            resourceFollowThrough.attentionCount > 0 && !isMinimalCard
              ? `${resourceFollowThrough.attentionCount} timing risk${
                  resourceFollowThrough.attentionCount === 1 ? "" : "s"
                } · ${resourceFollowThrough.staleLabel}`
              : resource.scheduledCount > 0
              ? isMinimalCard
                ? `${resource.scheduledCount} stops`
                : `${resource.scheduledCount} stops · ${formatDispatchDuration(resource.scheduledMinutes || 0)}`
              : resource.availabilityBlockCount > 0
                ? isMinimalCard
                  ? `${resource.availabilityBlockCount} shaped`
                  : `${resource.availabilityBlockCount} shaped window${
                      resource.availabilityBlockCount === 1 ? "" : "s"
                    }`
                : isMinimalCard
                  ? "Open lane"
                  : "Route open";

          return (
            <article
              className={cx(
                "dispatch-ops-card",
                focusedResourceUserId === resource.technicianUserId && "dispatch-ops-card--focused",
                isCompactCard && "dispatch-ops-card--compact",
                isMinimalCard && "dispatch-ops-card--minimal"
              )}
              key={resource.technicianUserId}
            >
              <div className="dispatch-ops-card__header">
                <div className="dispatch-ops-card__identity">
                  <strong className="dispatch-ops-card__name">{resource.displayName}</strong>
                  <p className="dispatch-ops-card__meta">{laneMeta}</p>
                  <div
                    className={cx(
                      "dispatch-ops-card__status-row",
                      isMinimalCard && "dispatch-ops-card__status-row--minimal"
                    )}
                  >
                    <Badge tone={laneState.tone}>{laneState.label}</Badge>
                    {resourceFollowThrough.attentionCount ? (
                      <Badge
                        tone={
                          resourceFollowThrough.highestRiskTone === "danger"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {resourceFollowThrough.attentionCount} timing risk
                        {resourceFollowThrough.attentionCount === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                    {resource.backlogCount ? (
                      <Badge tone="warning">{resource.backlogCount} waiting</Badge>
                    ) : null}
                    {!isCompactCard && !isMinimalCard && resource.availabilityBlockCount ? (
                      <Badge tone="neutral">{resource.availabilityBlockCount} block</Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  aria-label={`Open lane for ${resource.displayName}`}
                  onClick={() => onFocusSingleLane(resource.technicianUserId)}
                  size="sm"
                  tone="tertiary"
                  type="button"
                >
                  {isMinimalCard ? "Focus" : isCompactCard ? "Lane" : "Open lane"}
                </Button>
                {resource.conflictCount > 0 && !isMinimalCard ? (
                  <Button
                    aria-label={`Review conflicts for ${resource.displayName}`}
                    onClick={() => onFocusResourceConflicts(resource.technicianUserId)}
                    size="sm"
                    tone="secondary"
                    type="button"
                  >
                    Open conflicts
                  </Button>
                ) : null}
              </div>

              {nextJob ? (
                <div
                  className={cx(
                    "dispatch-ops-card__job",
                    isMinimalCard && "dispatch-ops-card__job--minimal",
                    selectedVisitId === nextJob.id && "dispatch-ops-card__job--selected"
                  )}
                >
                  <div className="dispatch-ops-card__job-topline">
                    <span className="dispatch-ops-card__job-state">
                      {liveJob ? "Live now" : "Next stop"}
                    </span>
                    <span className="dispatch-ops-card__job-time">
                      {formatDispatchShortRange(nextJob.eventStartAt, nextJob.eventEndAt, timezone)}
                    </span>
                  </div>
                  <div className="dispatch-ops-card__job-header">
                    <div>
                      <button
                        aria-label={`Open visit ${nextJob.title} for ${nextJob.customerDisplayName}`}
                        className="dispatch-ops-card__job-title"
                        onClick={() => onOpenVisit(nextJob.id)}
                        type="button"
                      >
                        {nextJob.title}
                      </button>
                    </div>
                    {!isCompactCard && !isMinimalCard ? <StatusBadge status={nextJob.status} /> : null}
                  </div>

                  {!isMinimalCard ? (
                    <p className="dispatch-ops-card__job-copy">
                      {nextJob.customerDisplayName} · {nextJob.vehicleDisplayName}
                    </p>
                  ) : null}

                  {!isCompactCard && !isMinimalCard && nextJobSignal ? (
                    <p className="dispatch-ops-card__job-support">
                      {nextJobPromiseSummary &&
                      nextJobPromiseSummary.recommendedAction &&
                      (nextJobPromiseSummary.tone === "warning" ||
                        nextJobPromiseSummary.tone === "danger")
                        ? `${nextJobSignal.label} · ${nextJobPromiseSummary.lastCustomerUpdateLabel}`
                        : `${nextJobSignal.label} · ${getDispatchVisitSupportingText(nextJob, timezone)}`}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="dispatch-ops-card__empty">
                  {isMinimalCard ? "Route open" : "Route open for the next mobile visit."}
                </p>
              )}

              {!isCompactCard && resource.conflictCount ? (
                <Button
                  onClick={() => onFocusResourceConflicts(resource.technicianUserId)}
                  size="sm"
                  tone="secondary"
                  type="button"
                >
                  Open conflicts
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
      {hiddenLaneWatchCount > 0 ? (
        <p className="dispatch-ops-rail__lane-watch-note">
          {hiddenLaneWatchCount} calmer lane{hiddenLaneWatchCount === 1 ? "" : "s"} stay on the board.
        </p>
      ) : null}
    </aside>
  );
}
