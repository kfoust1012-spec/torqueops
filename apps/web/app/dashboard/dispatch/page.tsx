import {
  getDispatchLocalDate,
  getSafeTimeZone,
  isInvoiceEligibleForReminder,
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus
} from "@mobile-mechanic/core";
import {
  getDispatchCalendarSettings,
  getJobById,
  listAddressesByCustomer,
  listServiceHistoryEstimatesByJobIds,
  listServiceHistoryInvoicesByJobIds
} from "@mobile-mechanic/api-client";
import type {
  Database,
  DispatchBoardJobItem,
  DispatchCalendarJobEvent,
  DispatchCalendarResource,
  Job,
  TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";

import { Page } from "../../../components/ui";
import { requireCompanyContext } from "../../../lib/company-context";
import { getDispatchTechnicianFitSignals } from "../../../lib/dispatch/fit";
import {
  buildDispatchOnBoardFollowThroughItems,
  summarizeDispatchLaneFollowThrough,
  type DispatchOnBoardPromiseSummary
} from "../../../lib/dispatch/follow-through";
import { getDispatchCommandCenter } from "../../../lib/dispatch/service";
import { getDispatchLaneOpportunityScore } from "../../../lib/dispatch/intelligence";
import { isFollowUpVisit, isStaleFollowUpVisit } from "../../../lib/jobs/follow-up";
import {
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../../lib/invoices/payment-handoffs";
import {
  getVisitPromiseSummary,
  getVisitTrustSummary
} from "../../../lib/jobs/operational-health";
import { deriveRouteConfidenceSnapshot } from "../../../lib/service-thread/continuity";
import { buildWorkspaceBlockerSummary } from "../../../lib/jobs/workspace-blockers";
import { getEstimateSupportStage } from "../../../lib/estimates/support";

import {
  parseDispatchCalendarSearchParams,
  toDispatchCalendarQuery
} from "./calendar-query";
import { DispatchCommandCenter } from "./_components/dispatch-command-center";
import { toServerError } from "../../../lib/server-error";

type DispatchPageProps = {
  searchParams?: Promise<{
    date?: string | string[];
    focus?: string | string[];
    includeUnassigned?: string | string[];
    resourceUserIds?: string | string[];
    savedViewId?: string | string[];
    scope?: string | string[];
    view?: string | string[];
  }>;
};

type DispatchWatchlistItem = {
  customerDisplayName: string;
  jobId: string;
  promisedAt: string | null;
  title: string;
  vehicleDisplayName: string;
};

type DispatchCloseoutRiskItem = {
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
};

type DispatchLowConfidenceItem = {
  customerDisplayName: string;
  jobId: string;
  promisedAt: string | null;
  title: string;
  vehicleDisplayName: string;
};

type DispatchCommunicationSnapshotRow = Pick<
  Database["public"]["Tables"]["customer_communications"]["Row"],
  "communication_type" | "created_at" | "job_id"
>;

type DispatchCrewReadinessTone = "brand" | "danger" | "neutral" | "success" | "warning";

type DispatchCrewReadinessFact = {
  label: string;
  tone: DispatchCrewReadinessTone;
};

type DispatchCrewReadinessSummary = {
  copy: string;
  facts: DispatchCrewReadinessFact[];
  label: string;
  tone: DispatchCrewReadinessTone;
};

function getTrustRiskRank(risk: "high" | "none" | "watch") {
  switch (risk) {
    case "high":
      return 3;
    case "watch":
      return 2;
    default:
      return 1;
  }
}

function getTrackingStatusLabel(state: string | null) {
  switch (state) {
    case "live":
      return "GPS live";
    case "limited":
      return "GPS limited";
    case "stale":
      return "GPS stale";
    case "offline":
      return "GPS offline";
    case "waiting":
      return "GPS waiting";
    default:
      return "GPS unknown";
  }
}

function getTrackingTone(state: string | null) {
  switch (state) {
    case "live":
      return "success" as const;
    case "limited":
    case "stale":
      return "warning" as const;
    case "offline":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function buildDispatchCrewReadinessSummary(args: {
  continuityCustomerCount: number;
  continuityVehicleCount: number;
  fitSignal: Awaited<ReturnType<typeof getDispatchTechnicianFitSignals>>[number] | null;
  hasLiveVisit: boolean;
  isCleanInsertion: boolean;
  isTightAfter: boolean;
  isTightBefore: boolean;
  laneAttentionCount: number;
  laneHighestRiskTone: DispatchCrewReadinessTone;
  resource: DispatchCalendarResource;
}) {
  const facts: DispatchCrewReadinessFact[] = [];
  const trackingLabel = getTrackingStatusLabel(args.fitSignal?.trackingState ?? null);
  const trackingTone = getTrackingTone(args.fitSignal?.trackingState ?? null);
  const hasTightWindow = args.isTightBefore || args.isTightAfter;
  const hasWeakVisibility =
    args.fitSignal?.trackingState === "offline" || args.fitSignal?.trackingState === "waiting";
  const hasWatchVisibility =
    args.fitSignal?.trackingState === "stale" || args.fitSignal?.trackingState === "limited";

  facts.push({
    label: trackingLabel,
    tone: trackingTone
  });

  facts.push({
    label: hasTightWindow
      ? "Tight insert"
      : args.isCleanInsertion
        ? "Clean insert"
        : args.hasLiveVisit
          ? "Live stop active"
          : args.resource.scheduledCount === 0
            ? "Open lane"
            : `${args.resource.scheduledCount} scheduled`,
    tone: hasTightWindow
      ? "warning"
      : args.isCleanInsertion || args.resource.scheduledCount === 0
        ? "success"
        : "neutral"
  });

  if (args.laneAttentionCount > 0) {
    facts.push({
      label: `${args.laneAttentionCount} live follow-through`,
      tone: args.laneHighestRiskTone === "danger" ? "danger" : "warning"
    });
  } else if (args.fitSignal?.repeatVehicleVisits) {
    facts.push({
      label: `Vehicle ${args.fitSignal.repeatVehicleVisits}x`,
      tone: "success"
    });
  } else if (args.fitSignal?.repeatCustomerVisits) {
    facts.push({
      label: `Customer ${args.fitSignal.repeatCustomerVisits}x`,
      tone: "brand"
    });
  } else if (args.fitSignal?.specialtyMatches.length) {
    facts.push({
      label: args.fitSignal.specialtyMatches[0] ?? "Specialty fit",
      tone: "brand"
    });
  } else if (args.fitSignal?.yearsExperience) {
    facts.push({
      label: `${args.fitSignal.yearsExperience}y field`,
      tone: "neutral"
    });
  } else if (args.continuityVehicleCount > 0) {
    facts.push({
      label: "Same vehicle today",
      tone: "success"
    });
  } else if (args.continuityCustomerCount > 0) {
    facts.push({
      label: "Same customer today",
      tone: "brand"
    });
  }

  if (hasWeakVisibility && (args.laneAttentionCount > 0 || hasTightWindow)) {
    return {
      copy: "GPS visibility is weak and this lane is already carrying timing pressure. Hand-check the commitment before you place more work here.",
      facts: facts.slice(0, 3),
      label: "Manual hand check",
      tone: "danger"
    } satisfies DispatchCrewReadinessSummary;
  }

  if (hasTightWindow || args.laneAttentionCount > 0 || args.hasLiveVisit || hasWatchVisibility) {
    return {
      copy: args.laneAttentionCount > 0
        ? "The lane can still absorb work, but customer timing debt is already active. Set a defensive promise when you commit."
        : hasTightWindow
          ? "Route fit exists, but the insertion window is narrow around adjacent stops. Commit only with a clear promise."
          : args.hasLiveVisit
            ? "The crew is already live on another stop, so this handoff needs a deliberate promise and quick follow-through."
            : "Crew visibility is not perfect, so confirm the lane before you commit the next stop.",
      facts: facts.slice(0, 3),
      label: "Use with care",
      tone: "warning"
    } satisfies DispatchCrewReadinessSummary;
  }

  return {
    copy:
      args.fitSignal?.repeatVehicleVisits || args.fitSignal?.repeatCustomerVisits
        ? "Continuity, crew visibility, and route load all support a clean handoff from Dispatch."
        : "Crew visibility and route load support a clean same-day commitment from Dispatch.",
    facts: facts.slice(0, 3),
    label: "Crew ready",
    tone: "success"
  } satisfies DispatchCrewReadinessSummary;
}

function getDurationMinutes(startAt: string, endAt: string) {
  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return null;
  }

  return Math.round((endTime - startTime) / 60_000);
}

function getInsertionLaneWindowFit(args: {
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

function buildSameDayDraftWindow(job: Job) {
  const draftStartAtValue = job.scheduledStartAt ?? job.arrivalWindowStartAt;

  if (!draftStartAtValue) {
    return {
      draftEndAt: null,
      draftStartAt: null
    };
  }

  const draftStartAt = new Date(draftStartAtValue);

  if (Number.isNaN(draftStartAt.getTime())) {
    return {
      draftEndAt: null,
      draftStartAt: null
    };
  }

  const explicitEndAt = job.scheduledEndAt ?? job.arrivalWindowEndAt;
  const draftEndAt = explicitEndAt
    ? new Date(explicitEndAt)
    : new Date(draftStartAt.getTime() + 60 * 60_000);

  if (Number.isNaN(draftEndAt.getTime())) {
    return {
      draftEndAt: new Date(draftStartAt.getTime() + 60 * 60_000),
      draftStartAt
    };
  }

  return {
    draftEndAt,
    draftStartAt
  };
}

function getSameDayInsertionCopy(args: {
  distanceMiles: number | null;
  continuityCustomerCount: number;
  continuityVehicleCount: number;
  hasLiveVisit: boolean;
  isCleanInsertion: boolean;
  isTightAfter: boolean;
  isTightBefore: boolean;
  nextVisitTitle: string | null;
  previousVisitTitle: string | null;
  repeatCustomerVisits: number;
  repeatVehicleVisits: number;
  specialtyMatches: string[];
  trackingState: string | null;
}) {
  if (args.repeatVehicleVisits > 0) {
    return `Handled this vehicle ${args.repeatVehicleVisits} time${
      args.repeatVehicleVisits === 1 ? "" : "s"
    } before.`;
  }

  if (args.repeatCustomerVisits > 0) {
    return `Worked with this customer ${args.repeatCustomerVisits} time${
      args.repeatCustomerVisits === 1 ? "" : "s"
    } before.`;
  }

  if (args.specialtyMatches.length > 0) {
    return `Profile match: ${args.specialtyMatches.join(", ")}.`;
  }

  if (args.distanceMiles !== null && args.distanceMiles <= 12) {
    return `${args.distanceMiles.toFixed(1)} mi from the service site with visible route proximity.`;
  }

  if (args.isTightBefore && args.previousVisitTitle) {
    return `Tight insert after ${args.previousVisitTitle}; use only if timing is stable.`;
  }

  if (args.isTightAfter && args.nextVisitTitle) {
    return `Tight insert before ${args.nextVisitTitle}; promise window needs care.`;
  }

  if (args.isCleanInsertion) {
    return "Clean route window for a same-day insert.";
  }

  if (args.continuityVehicleCount > 0) {
    return "This lane is already touching the same vehicle today.";
  }

  if (args.continuityCustomerCount > 0) {
    return "This lane is already handling work for the same customer.";
  }

  if (args.trackingState === "offline" || args.trackingState === "waiting") {
    return "Route capacity exists, but live field visibility is weak.";
  }

  if (args.hasLiveVisit) {
    return "Technician is live on another stop, so insert carefully.";
  }

  return "Lowest-friction visible lane for same-day placement.";
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const timeZone = getSafeTimeZone(context.company.timezone);
  const renderedAt = new Date().toISOString();
  const fallbackDate = getDispatchLocalDate(renderedAt, timeZone);
  const settingsResult = await getDispatchCalendarSettings(context.supabase, context.companyId);

  if (settingsResult.error) {
    throw toServerError(
      settingsResult.error,
      "Dispatch could not load calendar settings."
    );
  }

  const parsedSearchState = parseDispatchCalendarSearchParams({
    defaultView: settingsResult.data?.defaultView ?? "day",
    fallbackDate,
    searchParams: resolvedSearchParams
  });
  const commandCenter = await getDispatchCommandCenter(
    context,
    toDispatchCalendarQuery(parsedSearchState)
  );
  const dispatchJobs = [
    ...commandCenter.calendar.jobs,
    ...commandCenter.calendar.unassignedScheduledJobs,
    ...commandCenter.calendar.backlogJobs
  ];
  const jobsById = new Map(dispatchJobs.map((job) => [job.id, job]));
  const dispatchJobIds = [
    ...new Set([
      ...dispatchJobs.map((job) => job.id)
    ])
  ];
  const [estimatesResult, invoicesResult, communicationsResult, openPartRequestsResult, inventoryIssuesResult] = dispatchJobIds.length
    ? await Promise.all([
        listServiceHistoryEstimatesByJobIds(context.supabase, context.companyId, dispatchJobIds),
        listServiceHistoryInvoicesByJobIds(context.supabase, context.companyId, dispatchJobIds),
        context.supabase
          .from("customer_communications")
          .select("job_id, communication_type, created_at")
          .in("job_id", dispatchJobIds)
          .order("created_at", { ascending: false })
          .returns<DispatchCommunicationSnapshotRow[]>(),
        context.supabase
          .from("part_requests")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .eq("status", "open")
          .in("job_id", dispatchJobIds)
          .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>(),
        context.supabase
          .from("job_inventory_issues")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .in("job_id", dispatchJobIds)
          .returns<
            Array<Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">>
          >()
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Dispatch could not load estimates.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Dispatch could not load invoices.");
  }

  if (communicationsResult.error) {
    throw toServerError(
      communicationsResult.error,
      "Dispatch could not load customer updates."
    );
  }

  if (openPartRequestsResult.error) {
    throw toServerError(
      openPartRequestsResult.error,
      "Dispatch could not load open part requests."
    );
  }

  if (inventoryIssuesResult.error) {
    throw toServerError(
      inventoryIssuesResult.error,
      "Dispatch could not load inventory issues."
    );
  }

  const latestEstimatesByJobId = new Map<string, NonNullable<typeof estimatesResult.data>[number]>();
  for (const estimate of estimatesResult.data ?? []) {
    const current = latestEstimatesByJobId.get(estimate.jobId);

    if (!current || Date.parse(estimate.updatedAt) >= Date.parse(current.updatedAt)) {
      latestEstimatesByJobId.set(estimate.jobId, estimate);
    }
  }

  const latestInvoicesByJobId = new Map<string, NonNullable<typeof invoicesResult.data>[number]>();
  for (const invoice of invoicesResult.data ?? []) {
    const current = latestInvoicesByJobId.get(invoice.jobId);

    if (!current || Date.parse(invoice.updatedAt) >= Date.parse(current.updatedAt)) {
      latestInvoicesByJobId.set(invoice.jobId, invoice);
    }
  }
  const invoiceIdToJobId = new Map(
    (invoicesResult.data ?? []).map((invoice) => [invoice.id, invoice.jobId])
  );
  const paymentHandoffs = await listTechnicianPaymentHandoffsByInvoiceIds(
    context.supabase as any,
    [...invoiceIdToJobId.keys()]
  );
  const openPaymentHandoffCountByJobId = countOpenTechnicianPaymentHandoffsByJobId({
    handoffs: paymentHandoffs,
    invoiceIdToJobId
  });
  const paymentHandoffSummaryByJobId = summarizeOpenTechnicianPaymentHandoffsByJobId({
    handoffs: paymentHandoffs,
    invoiceIdToJobId
  });
  const openPartRequestsByJobId = (openPartRequestsResult.data ?? []).reduce<Map<string, number>>((counts, request) => {
    counts.set(request.job_id, (counts.get(request.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const inventoryIssuesByJobId = (inventoryIssuesResult.data ?? []).reduce<Map<string, number>>((counts, issue) => {
    if (issue.status === "returned" || issue.status === "consumed") {
      return counts;
    }

    counts.set(issue.job_id, (counts.get(issue.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const dispatchBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId: latestEstimatesByJobId,
    inventoryIssuesByJobId,
    invoicesByJobId: latestInvoicesByJobId,
    jobs: dispatchJobs,
    paymentHandoffSummaryByJobId,
    openPaymentHandoffCountByJobId,
    openPartRequestsByJobId
  });
  const dispatchBlockerByJobId = new Map(dispatchBlockers.items.map((item) => [item.jobId, item]));

  const latestCommunicationsByJobId = new Map<
    string,
    {
      communicationType: string;
      createdAt: string;
      jobId: string;
    }
  >();

  for (const entry of communicationsResult.data ?? []) {
    if (!entry.job_id || latestCommunicationsByJobId.has(entry.job_id)) {
      continue;
    }

    latestCommunicationsByJobId.set(entry.job_id, {
      communicationType: entry.communication_type,
      createdAt: entry.created_at,
      jobId: entry.job_id
    });
  }

  const trustScoresByJobId = new Map<string, number>();
  const trustRisksByJobId = new Map<string, "high" | "none" | "watch">();
  const approvedReleaseJobIds = [...latestEstimatesByJobId.entries()]
    .filter(([, estimate]) => getEstimateSupportStage(estimate) === "approved_release")
    .map(([jobId]) => jobId);
  const followThroughNow = new Date(renderedAt);
  const promiseSummariesByJobId = new Map<
    string,
    ReturnType<typeof getVisitPromiseSummary>
  >();
  const trustSummariesByJobId = new Map<
    string,
    ReturnType<typeof getVisitTrustSummary>
  >();

  for (const job of dispatchJobs) {
    const latestCommunication = latestCommunicationsByJobId.get(job.id) ?? null;
    const latestInvoice = latestInvoicesByJobId.get(job.id) ?? null;
    const promiseSummary = getVisitPromiseSummary({
      communications: latestCommunication
        ? [
            {
              communicationType: latestCommunication.communicationType,
              createdAt: latestCommunication.createdAt
            }
          ]
        : [],
      job
    });
    const trustSummary = getVisitTrustSummary({
      communications: latestCommunication
        ? [
            {
              communicationType: latestCommunication.communicationType,
              createdAt: latestCommunication.createdAt
            }
          ]
        : [],
      estimate: latestEstimatesByJobId.get(job.id) ?? null,
      followUpActive: isFollowUpVisit(job),
      invoice: latestInvoice
        ? {
            balanceDueCents: latestInvoice.balanceDueCents,
            status: latestInvoice.status
          }
        : null,
      job
    });

    promiseSummariesByJobId.set(job.id, promiseSummary);
    trustSummariesByJobId.set(job.id, trustSummary);
    trustScoresByJobId.set(job.id, trustSummary.score);
    trustRisksByJobId.set(job.id, trustSummary.risk);
  }

  const compareTrustPressure = (leftJobId: string, rightJobId: string) => {
    const leftRisk = getTrustRiskRank(trustRisksByJobId.get(leftJobId) ?? "none");
    const rightRisk = getTrustRiskRank(trustRisksByJobId.get(rightJobId) ?? "none");

    if (leftRisk !== rightRisk) {
      return rightRisk - leftRisk;
    }

    return (trustScoresByJobId.get(leftJobId) ?? 100) - (trustScoresByJobId.get(rightJobId) ?? 100);
  };

  commandCenter.calendar.unassignedScheduledJobs = [...commandCenter.calendar.unassignedScheduledJobs].sort(
    (left, right) => {
      const trustDelta = compareTrustPressure(left.id, right.id);

      if (trustDelta !== 0) {
        return trustDelta;
      }

      const leftStart = left.scheduledStartAt ? new Date(left.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightStart = right.scheduledStartAt ? new Date(right.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;

      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      return left.title.localeCompare(right.title);
    }
  );

  commandCenter.calendar.backlogJobs = [...commandCenter.calendar.backlogJobs].sort((left, right) => {
    const trustDelta = compareTrustPressure(left.id, right.id);

    if (trustDelta !== 0) {
      return trustDelta;
    }

    const leftStart = left.scheduledStartAt ? new Date(left.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightStart = right.scheduledStartAt ? new Date(right.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return left.title.localeCompare(right.title);
  });

  const staleApprovalEstimates = (estimatesResult.data ?? []).filter((estimate) => {
    if (estimate.status !== "sent" || !estimate.sentAt) {
      return false;
    }

    const sentAtTime = Date.parse(estimate.sentAt);

    if (Number.isNaN(sentAtTime)) {
      return false;
    }

    return sentAtTime <= Date.now() - 24 * 60 * 60 * 1000;
  });
  const staleApprovalCount = staleApprovalEstimates.length;
  const staleApprovalCandidates: DispatchWatchlistItem[] = staleApprovalEstimates
    .map((estimate) => {
      const job = jobsById.get(estimate.jobId);

      if (!job) {
        return null;
      }

      return {
        customerDisplayName: job.customerDisplayName,
        jobId: job.id,
        promisedAt: job.arrivalWindowStartAt ?? job.scheduledStartAt ?? null,
        title: job.title,
        vehicleDisplayName: job.vehicleDisplayName
      };
    })
    .filter((item): item is DispatchWatchlistItem => Boolean(item))
    .sort((left, right) => compareTrustPressure(left.jobId, right.jobId));
  const staleApprovalItems = staleApprovalCandidates.slice(0, 3);
  const currentState = {
    date: commandCenter.calendar.query.date,
    focusMode: parsedSearchState.focusMode,
    includeUnassigned: commandCenter.calendar.query.includeUnassigned ?? true,
    jobId: parsedSearchState.jobId,
    resourceUserIds: commandCenter.calendar.query.resourceUserIds ?? [],
    savedViewId: commandCenter.calendar.query.savedViewId ?? "",
    scope: commandCenter.calendar.query.scope ?? "all_workers",
    view: commandCenter.calendar.query.view ?? commandCenter.settings.defaultView
  };
  const followUpVisitCount = dispatchJobs.filter((job) => isFollowUpVisit(job)).length;
  const staleFollowUpJobs = dispatchJobs.filter((job) =>
    isStaleFollowUpVisit({
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      scheduledStartAt: job.scheduledStartAt,
      status: job.status,
      title: job.title
    })
  );
  const staleFollowUpVisitCount = staleFollowUpJobs.length;
  const staleFollowUpCandidates: DispatchWatchlistItem[] = staleFollowUpJobs
    .sort((left, right) => compareTrustPressure(left.id, right.id))
    .map((job) => ({
      customerDisplayName: job.customerDisplayName,
      jobId: job.id,
      promisedAt: job.arrivalWindowStartAt ?? job.scheduledStartAt ?? null,
      title: job.title,
      vehicleDisplayName: job.vehicleDisplayName
    }));
  const staleFollowUpItems = staleFollowUpCandidates.slice(0, 3);
  const lowConfidenceCandidates = dispatchJobs
    .filter((job) => {
      if (job.status === "completed" || job.status === "canceled" || isTechnicianOnSiteJobStatus(job.status)) {
        return false;
      }

      const promiseSummary = promiseSummariesByJobId.get(job.id);
      const promiseAt = job.arrivalWindowStartAt ?? job.scheduledStartAt;

      if (!promiseSummary || !promiseAt) {
        return false;
      }

      const promiseTime = Date.parse(promiseAt);

      if (Number.isNaN(promiseTime) || promiseTime <= Date.now()) {
        return false;
      }

      return promiseSummary.confidencePercent <= 55;
    })
    .sort((left, right) => compareTrustPressure(left.id, right.id));
  const lowConfidenceCount = lowConfidenceCandidates.length;
  const lowConfidenceItems: DispatchLowConfidenceItem[] = lowConfidenceCandidates.slice(0, 3).map((job) => ({
    customerDisplayName: job.customerDisplayName,
    jobId: job.id,
    promisedAt: job.arrivalWindowStartAt ?? job.scheduledStartAt ?? null,
    title: job.title,
    vehicleDisplayName: job.vehicleDisplayName
  }));
  const closeoutRiskCandidates = dispatchJobs
    .filter((job) => {
      const invoice = latestInvoicesByJobId.get(job.id);
      const trustSummary = trustSummariesByJobId.get(job.id);
      const workflowBlocker = dispatchBlockerByJobId.get(job.id) ?? null;

      if (workflowBlocker?.openPaymentHandoffCount) {
        return true;
      }

      if (!invoice || !trustSummary) {
        return false;
      }

      return (
        trustSummary.owner === "Finance" &&
        isInvoiceEligibleForReminder({
          balanceDueCents: invoice.balanceDueCents,
          dueAt: invoice.dueAt,
          status: invoice.status
        })
      );
    })
    .sort((left, right) => compareTrustPressure(left.id, right.id));
  const closeoutRiskCount = closeoutRiskCandidates.length;
  const closeoutRiskItems: DispatchCloseoutRiskItem[] = closeoutRiskCandidates.slice(0, 3).map((job) => {
    const workflowBlocker = dispatchBlockerByJobId.get(job.id) ?? null;

    return {
      balanceDueCents: latestInvoicesByJobId.get(job.id)?.balanceDueCents ?? 0,
      customerDisplayName: job.customerDisplayName,
      handoffCopy: workflowBlocker?.financeHandoffSummary?.copy ?? null,
      handoffLabel: workflowBlocker?.financeHandoffSummary?.label ?? null,
      handoffResolutionDisposition:
        workflowBlocker?.financeHandoffSummary?.resolutionDisposition ?? null,
      invoiceId: latestInvoicesByJobId.get(job.id)?.id ?? null,
      jobId: job.id,
      lastCustomerUpdateLabel:
        promiseSummariesByJobId.get(job.id)?.lastCustomerUpdateLabel ?? "No customer timing update logged",
      nextActionLabel:
        workflowBlocker?.openPaymentHandoffCount
          ? "Review technician billing handoff"
          : trustSummariesByJobId.get(job.id)?.nextActionLabel ?? "Send billing follow-up",
      openPaymentHandoffCount: workflowBlocker?.openPaymentHandoffCount ?? 0,
      title: job.title,
      trustCopy:
        workflowBlocker?.financeHandoffSummary?.copy ??
        trustSummariesByJobId.get(job.id)?.copy ??
        "Money is still open and the closeout thread needs a fresh follow-through touch.",
      trustLabel:
        workflowBlocker?.financeHandoffSummary?.label ??
        trustSummariesByJobId.get(job.id)?.label ??
        "Closeout thread cooling",
      trustTone: trustSummariesByJobId.get(job.id)?.tone ?? "brand",
      vehicleDisplayName: job.vehicleDisplayName
    };
  });
  const supplyBlockedItems = dispatchBlockers.supplyBlockedItems.slice(0, 3).map((item) => ({
    customerDisplayName: item.customerDisplayName,
    jobId: item.jobId,
    supplyBlockerCount: item.supplyBlockerCount,
    title: item.title,
    vehicleDisplayName: item.vehicleDisplayName
  }));
  const sameDayInsertionCandidates = [
    ...commandCenter.calendar.unassignedScheduledJobs.map((visit) => ({
      queueLabel: "Scheduled waiting",
      visit
    })),
    ...commandCenter.calendar.backlogJobs.map((visit) => ({
      queueLabel: visit.assignedTechnicianUserId ? "Assigned backlog" : "Unscheduled intake",
      visit
    }))
  ]
    .filter(({ visit }) => !approvedReleaseJobIds.includes(visit.id))
    .filter(
      ({ visit }, index, items) =>
        items.findIndex((candidate) => candidate.visit.id === visit.id) === index
    )
    .slice(0, 2);
  const sameDayInsertionSuggestions = (
    await Promise.all(
      sameDayInsertionCandidates.map(async ({ queueLabel, visit }) => {
        const jobResult = await getJobById(context.supabase, visit.id);

        if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
          return null;
        }
        const jobRecord = jobResult.data;

        const fitSignals = await getDispatchTechnicianFitSignals({
          companyId: context.companyId,
          job: jobRecord,
          supabase: context.supabase
        }).catch(() => []);
        const customerSitesResult = await listAddressesByCustomer(
          context.supabase,
          jobRecord.customerId
        ).catch(() => null);
        const customerSites = customerSitesResult?.data ?? [];
        const primarySite =
          customerSites.find((site) => site.isPrimary) ?? customerSites[0] ?? null;
        const serviceSite = jobRecord.serviceSiteId
          ? customerSites.find((site) => site.id === jobRecord.serviceSiteId) ?? null
          : primarySite;
        const hasServiceSitePlaybook = Boolean(
          serviceSite &&
            (serviceSite.accessWindowNotes ||
              serviceSite.gateCode ||
              serviceSite.parkingNotes ||
              serviceSite.serviceContactName ||
              serviceSite.serviceContactPhone)
        );
        const fitSignalByTechnicianId = new Map(
          fitSignals.map((signal) => [signal.technicianUserId, signal] as const)
        );
        const { draftEndAt, draftStartAt } = buildSameDayDraftWindow(jobRecord);
        const rankedSuggestions = commandCenter.calendar.resources
          .map((resource) => {
            const laneEvents = commandCenter.calendar.jobs.filter(
              (candidate) =>
                candidate.id !== visit.id && candidate.resourceTechnicianUserId === resource.technicianUserId
            );
            const laneVisits = [
              ...laneEvents,
              ...commandCenter.calendar.backlogJobs.filter(
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
            const fitSignal = fitSignalByTechnicianId.get(resource.technicianUserId) ?? null;
            const laneWindowFit = getInsertionLaneWindowFit({
              draftEndAt,
              draftStartAt,
              events: laneEvents
            });
            const laneFollowThrough = summarizeDispatchLaneFollowThrough(
              buildDispatchOnBoardFollowThroughItems({
                jobs: laneEvents,
                now: followThroughNow,
                promiseSummariesByJobId
              })
            );
            const score =
              getDispatchLaneOpportunityScore(resource) +
              resource.availabilityBlockCount * 120 +
              (hasLiveVisit ? 180 : 0) +
              (laneWindowFit.isTightBefore ? 600 : 0) +
              (laneWindowFit.isTightAfter ? 600 : 0) -
              (laneWindowFit.isCleanInsertion ? 160 : 0) -
              continuityVehicleCount * 700 -
              continuityCustomerCount * 260 -
              (fitSignal?.repeatVehicleVisits ?? 0) * 90 -
              (fitSignal?.repeatCustomerVisits ?? 0) * 30 -
              (fitSignal?.specialtyMatches.length ?? 0) * 24 -
              Math.min(fitSignal?.yearsExperience ?? 0, 12) * 4 -
              (fitSignal?.distanceMiles !== null && fitSignal?.distanceMiles !== undefined
                ? Math.max(18 - fitSignal.distanceMiles, 0) * 12
                : 0) +
              (fitSignal?.trackingState === "offline" ? 220 : 0) +
              (fitSignal?.trackingState === "waiting" ? 140 : 0) +
              (fitSignal?.trackingState === "stale" ? 70 : 0) +
              (fitSignal?.trackingState === "limited" ? 45 : 0);

            return {
              continuityCustomerCount,
              continuityVehicleCount,
              copy: getSameDayInsertionCopy({
                continuityCustomerCount,
                continuityVehicleCount,
                distanceMiles: fitSignal?.distanceMiles ?? null,
                hasLiveVisit,
                isCleanInsertion: laneWindowFit.isCleanInsertion,
                isTightAfter: laneWindowFit.isTightAfter,
                isTightBefore: laneWindowFit.isTightBefore,
                nextVisitTitle: laneWindowFit.nextJob?.title ?? null,
                previousVisitTitle: laneWindowFit.previousJob?.title ?? null,
                repeatCustomerVisits: fitSignal?.repeatCustomerVisits ?? 0,
                repeatVehicleVisits: fitSignal?.repeatVehicleVisits ?? 0,
                specialtyMatches: fitSignal?.specialtyMatches ?? [],
                trackingState: fitSignal?.trackingState ?? null
              }),
              distanceLabel:
                fitSignal?.distanceMiles !== null && fitSignal?.distanceMiles !== undefined
                  ? `${fitSignal.distanceMiles.toFixed(1)} mi`
                  : null,
              fitSignal,
              readinessSummary: buildDispatchCrewReadinessSummary({
                continuityCustomerCount,
                continuityVehicleCount,
                fitSignal,
                hasLiveVisit,
                isCleanInsertion: laneWindowFit.isCleanInsertion,
                isTightAfter: laneWindowFit.isTightAfter,
                isTightBefore: laneWindowFit.isTightBefore,
                laneAttentionCount: laneFollowThrough.attentionCount,
                laneHighestRiskTone: laneFollowThrough.highestRiskTone,
                resource
              }),
              routeConfidence: deriveRouteConfidenceSnapshot({
                hasLiveGps: fitSignal?.trackingState === "live",
                hasPartsConfidence: !dispatchBlockers.supplyBlockedItems.some(
                  (item) => item.jobId === visit.id
                ),
                hasServiceSitePlaybook,
                hasTechnicianReadiness:
                  resource.availabilityBlockCount === 0 &&
                  fitSignal?.trackingState !== "offline" &&
                  fitSignal?.trackingState !== "waiting",
                laneSlackMinutes:
                  laneWindowFit.isTightBefore || laneWindowFit.isTightAfter
                    ? 15
                    : laneWindowFit.isCleanInsertion
                      ? 75
                      : 45,
                promiseConfidencePercent:
                  promiseSummariesByJobId.get(visit.id)?.confidencePercent ?? 72,
                routeIssueCount:
                  laneFollowThrough.attentionCount +
                  (laneWindowFit.isTightBefore ? 1 : 0) +
                  (laneWindowFit.isTightAfter ? 1 : 0)
              }),
              resource,
              score,
              trackingLabel: getTrackingStatusLabel(fitSignal?.trackingState ?? null),
              trackingTone: getTrackingTone(fitSignal?.trackingState ?? null)
            };
          })
          .sort((left, right) => {
            if (left.score !== right.score) {
              return left.score - right.score;
            }

            return left.resource.displayName.localeCompare(right.resource.displayName);
          })
          .slice(0, 3)
          .map((suggestion) => ({
            continuityLabel:
              suggestion.fitSignal?.repeatVehicleVisits
                ? `Vehicle ${suggestion.fitSignal.repeatVehicleVisits}x`
                : suggestion.fitSignal?.repeatCustomerVisits
                  ? `Customer ${suggestion.fitSignal.repeatCustomerVisits}x`
                  : suggestion.fitSignal?.specialtyMatches?.length
                    ? suggestion.fitSignal.specialtyMatches[0] ?? null
                    : suggestion.continuityVehicleCount
                      ? "Same vehicle today"
                      : suggestion.continuityCustomerCount
                        ? "Same customer today"
                        : null,
            copy: suggestion.copy,
            distanceLabel: suggestion.distanceLabel,
            readinessSummary: suggestion.readinessSummary,
            routeConfidence: suggestion.routeConfidence,
            technicianName: suggestion.fitSignal?.technicianName ?? suggestion.resource.displayName,
            technicianUserId: suggestion.resource.technicianUserId,
            trackingLabel: suggestion.trackingLabel,
            trackingTone: suggestion.trackingTone
          }));

        return {
          jobId: visit.id,
          queueLabel,
          suggestions: rankedSuggestions,
          visit
        };
      })
    )
  )
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.suggestions.length > 0);
  return (
    <Page className="dispatch-page" layout="command">
      <DispatchCommandCenter
        backHref="/dashboard/visits"
        calendar={commandCenter.calendar}
        currentState={currentState}
        operatorRole={context.membership.role}
        operatorFocusMode={parsedSearchState.focusMode}
        pageDescription="Recover live lanes, release the next visit, and clear route pressure before the board drifts."
        pageTitle="Dispatch"
        renderedAt={renderedAt}
        resourcePreferences={commandCenter.resourcePreferences}
        savedViews={commandCenter.savedViews}
        settingsHref="/dashboard/dispatch/settings"
        approvedReleaseJobIds={approvedReleaseJobIds}
        closeoutRiskCount={closeoutRiskCount}
        closeoutRiskJobIds={closeoutRiskCandidates.map((job) => job.id)}
        closeoutRiskItems={closeoutRiskItems}
        lowConfidenceCount={lowConfidenceCount}
        lowConfidenceJobIds={lowConfidenceCandidates.map((job) => job.id)}
        lowConfidenceItems={lowConfidenceItems}
        supplyBlockedCount={dispatchBlockers.supplyBlockedCount}
        supplyBlockedItems={supplyBlockedItems}
        sameDayInsertionSuggestions={sameDayInsertionSuggestions}
        staleApprovalJobIds={staleApprovalCandidates.map((item) => item.jobId)}
        staleApprovalItems={staleApprovalItems}
        staleApprovalCount={staleApprovalCount}
        staleFollowUpJobIds={staleFollowUpCandidates.map((item) => item.jobId)}
        staleFollowUpItems={staleFollowUpItems}
        followUpVisitCount={followUpVisitCount}
      staleFollowUpVisitCount={staleFollowUpVisitCount}
      technicians={commandCenter.technicians}
      promiseSummaries={[...promiseSummariesByJobId.entries()].map(([jobId, summary]) => ({
        jobId,
        summary: summary as DispatchOnBoardPromiseSummary
      }))}
      trustScores={[...trustScoresByJobId.entries()].map(([jobId, score]) => ({ jobId, score }))}
    />
  </Page>
  );
}
