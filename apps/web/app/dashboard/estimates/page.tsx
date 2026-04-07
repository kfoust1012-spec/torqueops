import {
  type AppSupabaseClient,
  assignJobTechnician as assignVisitTechnician,
  changeJobStatus as changeVisitStatus,
  enqueueDispatchUpdate as enqueueVisitDispatchUpdate,
  getEstimateDetailById,
  getInvoiceByJobId,
  getJobById,
  listEstimatesByCompany,
  listAssignableTechniciansByCompany,
  listServiceHistoryInvoicesByJobIds,
  updateJob
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getCustomerDisplayName
} from "@mobile-mechanic/core";
import { resolveTechnicianPaymentHandoffInputSchema } from "@mobile-mechanic/validation";
import type {
  Database,
  EstimateSummary,
  EstimateWorkspace,
  Job,
  JobStatus,
  TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";
import { technicianPaymentResolutionDispositions } from "@mobile-mechanic/types";
import Link from "next/link";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import {
  AppIcon,
  Badge,
  Callout,
  Card,
  CardContent,
  EmptyState,
  Form,
  FormField,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  buttonClassName,
  cx
} from "../../../components/ui";
import { requireCompanyContext } from "../../../lib/company-context";
import { processCommunicationMutationResult } from "../../../lib/communications/actions";
import {
  formatTechnicianPaymentResolutionDispositionLabel,
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  resolveOpenTechnicianPaymentHandoffsByInvoiceId,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../../lib/invoices/payment-handoffs";
import {
  ensureJobVisitAccessLink as ensureVisitAccessLink,
  markJobVisitAccessLinkSent as markVisitAccessLinkSent
} from "../../../lib/customer-documents/service";
import {
  getEstimateDecisionCopy,
  getEstimateNextStepLabel,
  getEstimateStageCopy,
  getEstimateSupportActionLabel,
  getEstimateSupportRank as getEstimateThroughputRank,
  getEstimateSupportStage as getEstimateThroughputStage,
  getEstimateSupportStageLabel as getEstimateThroughputStageLabel,
  getEstimateSupportTone as getEstimateThroughputTone,
  mapLegacyEstimateStatusToSupportStage as mapLegacyEstimateStatusToStage,
  resolveEstimateSupportStage as resolveEstimateThroughputStage,
  type EstimateSupportStage as EstimateThroughputStage
} from "../../../lib/estimates/support";
import {
  getEstimateBulkDispatchUpdateReadiness as getEstimateBulkDispatchUpdateReadinessHelper,
  getEstimateBulkOwnerReadiness as getEstimateBulkOwnerReadinessHelper,
  getEstimateBulkPromiseReadiness as getEstimateBulkPromiseReadinessHelper,
  getEstimateBulkReleaseReadiness as getEstimateBulkReleaseReadinessHelper,
  getEstimateOnBoardStatusRiskRank,
  isEstimateApprovedReleaseAlreadyOnBoard as isEstimateApprovedReleaseAlreadyOnBoardHelper,
  type EstimateBulkActionReadiness,
  type EstimateBulkDispatchUpdateReadiness,
  type EstimateDeskJobState,
  type EstimateDispatchUpdateType
} from "../../../lib/estimates/dispatch-readiness";
import { getEstimateWorkspaceByJobId } from "../../../lib/estimates/workspace/service";
import { getEstimateExceptionOwnershipSummary } from "../../../lib/jobs/exception-ownership";
import { getVisitPromiseSummary } from "../../../lib/jobs/operational-health";
import { buildWorkspaceBlockerSummary } from "../../../lib/jobs/workspace-blockers";
import {
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone,
  type VisitWorkflowState
} from "../../../lib/jobs/workflow";
import {
  getServiceThreadPressureScore,
  getServiceThreadSummary
} from "../../../lib/jobs/service-thread";
import { sendTechnicianJobPushNotification } from "../../../lib/mobile-push-notifications";
import { getTechnicianProfilePreview } from "../../../lib/technician-profiles/service";
import {
  buildVisitEstimateHref,
  buildVisitPartsHref
} from "../../../lib/visits/workspace";
import { toServerError } from "../../../lib/server-error";

export const dynamic = "force-dynamic";

type EstimatesPageProps = {
  searchParams?: Promise<{
    estimateId?: string | string[];
    feedback?: string | string[];
    feedbackBlocked?: string | string[];
    feedbackCount?: string | string[];
    jobId?: string | string[];
    query?: string | string[];
    selectedJobIds?: string | string[];
    stage?: string | string[];
    status?: string | string[];
    view?: string | string[];
  }>;
};

type EstimatesFilterState = {
  estimateId: string;
  jobId: string;
  query: string;
  selectedJobIds: string;
  stage: string;
  view: "board" | "compact" | "list";
};

type EstimateTimelineRecord = {
  acceptedAt?: string | null;
  declinedAt?: string | null;
  sentAt?: string | null;
  status: EstimateSummary["status"];
  updatedAt: string;
  voidedAt?: string | null;
};

type EstimateThroughputRecord = Pick<EstimateSummary, "acceptedAt" | "sentAt" | "status" | "updatedAt">;
type SelectedEstimateWorkspace = EstimateWorkspace | null;
type EstimateReleaseRunway = {
  copy: string;
  dispatchActionHref: string;
  dispatchActionLabel: string;
  label: string;
  ownerLabel: string;
  primaryActionHref: string;
  primaryActionLabel: string;
  promiseLabel: string;
  releaseThreadHref: string;
  releaseThreadLabel: string;
  secondaryActionHref: string;
  secondaryActionLabel: string;
  workflowState: VisitWorkflowState;
};
type EstimateReleaseFeedbackCode =
  | "release-owner-saved"
  | "release-owner-failed"
  | "bulk-owner-saved"
  | "bulk-owner-partial"
  | "bulk-owner-failed"
  | "release-promise-saved"
  | "release-promise-failed"
  | "bulk-promise-saved"
  | "bulk-promise-partial"
  | "bulk-promise-failed"
  | "release-dispatch-saved"
  | "release-dispatch-failed"
  | "bulk-release-saved"
  | "bulk-release-partial"
  | "bulk-release-failed"
  | "bulk-dispatch-update-saved"
  | "bulk-dispatch-update-partial"
  | "bulk-dispatch-update-failed";

type EstimateBulkJobRow = Database["public"]["Tables"]["jobs"]["Row"];
type EstimateCommunicationSnapshotRow = Pick<
  Database["public"]["Tables"]["customer_communications"]["Row"],
  "communication_type" | "created_at" | "job_id"
>;
type EstimateOnBoardFollowThrough = {
  copy: string;
  dispatchHref: string;
  label: string;
  lastCustomerUpdateAt: string | null;
  lastCustomerUpdateLabel: string;
  lastOutboundAgeLabel: string;
  riskScore: number;
  tone: "brand" | "danger" | "neutral" | "success" | "warning";
  updateActionLabel: string | null;
  updateType: EstimateDispatchUpdateType | null;
};
type EstimateBulkSelectionRow = {
  dispatchUpdateReadiness: EstimateBulkDispatchUpdateReadiness;
  estimate: EstimateSummary;
  job: EstimateDeskJobState | null;
  ownerReadiness: EstimateBulkActionReadiness;
  promiseReadiness: EstimateBulkActionReadiness;
  releaseReadiness: EstimateBulkActionReadiness;
  releaseRunway: EstimateReleaseRunway | null;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSearchParamIdList(value: string | string[] | undefined) {
  return [...new Set(readSearchParam(value).split(",").map((segment) => segment.trim()).filter(Boolean))];
}

function serializeIdList(value: string[]) {
  return [...new Set(value.filter(Boolean))].join(",");
}

function resolveEstimateView(value: string): "compact" | "list" {
  return value === "list" ? value : "compact";
}

function buildEstimatesHref(current: EstimatesFilterState, patch: Partial<EstimatesFilterState>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(next)) {
    if (value && !(key === "view" && value === "compact")) {
      params.set(key, value);
    }
  }

  const search = params.toString();
  return search ? `/dashboard/estimates?${search}` : "/dashboard/estimates";
}

function appendHrefQueryParam(href: string, key: string, value: string) {
  const [pathname = "", search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set(key, value);
  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

function buildEstimateSelectionHref(
  current: EstimatesFilterState,
  selection: Pick<EstimateSummary, "estimateId" | "jobId"> | null,
  feedback?: EstimateReleaseFeedbackCode
) {
  const href = buildEstimatesHref(current, {
    estimateId: selection?.estimateId ?? "",
    jobId: selection?.jobId ?? ""
  });

  return feedback ? appendHrefQueryParam(href, "feedback", feedback) : href;
}

function buildEstimateBulkSelectionHref(current: EstimatesFilterState, selectedJobIds: string[]) {
  return buildEstimatesHref(current, {
    selectedJobIds: serializeIdList(selectedJobIds)
  });
}

function buildEstimateBulkSelectionToggleHref(
  current: EstimatesFilterState,
  selectedJobIds: string[],
  jobId: string
) {
  const next = new Set(selectedJobIds);

  if (next.has(jobId)) {
    next.delete(jobId);
  } else {
    next.add(jobId);
  }

  return buildEstimateBulkSelectionHref(current, [...next]);
}

function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEstimateReleaseFeedback(
  code: string,
  options?: {
    blockedCount?: number;
    count?: number;
  }
) {
  const countLabel = options?.count ? pluralizeLabel(options.count, "visit") : "Selected visits";
  const blockedLabel = options?.blockedCount ? pluralizeLabel(options.blockedCount, "visit") : null;

  switch (code as EstimateReleaseFeedbackCode) {
    case "release-owner-saved":
      return {
        body: "The technician owner was updated from the estimate release runway.",
        title: "Dispatch owner saved",
        tone: "success" as const
      };
    case "release-owner-failed":
      return {
        body: "The technician owner could not be saved. Refresh the desk and try again.",
        title: "Dispatch owner failed",
        tone: "warning" as const
      };
    case "bulk-owner-saved":
      return {
        body: `${countLabel} were updated with the new dispatch owner from the release runway.`,
        title: "Bulk owner saved",
        tone: "success" as const
      };
    case "bulk-owner-partial":
      return {
        body: `${countLabel} were updated, but ${blockedLabel ?? "some visits"} could not be changed.`,
        title: "Bulk owner partially saved",
        tone: "warning" as const
      };
    case "bulk-owner-failed":
      return {
        body: "The selected visits could not be updated with a dispatch owner. Refresh the queue and try again.",
        title: "Bulk owner failed",
        tone: "warning" as const
      };
    case "release-promise-saved":
      return {
        body: "The visit promise was updated from the estimate release runway.",
        title: "Time promise saved",
        tone: "success" as const
      };
    case "release-promise-failed":
      return {
        body: "The visit promise could not be saved. Refresh the desk and try again.",
        title: "Time promise failed",
        tone: "warning" as const
      };
    case "bulk-promise-saved":
      return {
        body: `${countLabel} were updated with the new promise from the release runway.`,
        title: "Bulk promise saved",
        tone: "success" as const
      };
    case "bulk-promise-partial":
      return {
        body: `${countLabel} were updated, but ${blockedLabel ?? "some visits"} still need manual promise cleanup.`,
        title: "Bulk promise partially saved",
        tone: "warning" as const
      };
    case "bulk-promise-failed":
      return {
        body: "The selected visits could not be updated with a shared promise. Refresh the queue and try again.",
        title: "Bulk promise failed",
        tone: "warning" as const
      };
    case "release-dispatch-saved":
      return {
        body: "The approved visit was released into Dispatch from the estimate desk.",
        title: "Released to dispatch",
        tone: "success" as const
      };
    case "release-dispatch-failed":
      return {
        body: "The visit could not be released into Dispatch. Confirm owner and promise state, then try again.",
        title: "Dispatch release failed",
        tone: "warning" as const
      };
    case "bulk-release-saved":
      return {
        body: `${countLabel} were released into Dispatch from the approved-release runway.`,
        title: "Bulk dispatch release saved",
        tone: "success" as const
      };
    case "bulk-release-partial":
      return {
        body: `${countLabel} were released, but ${blockedLabel ?? "some visits"} still need manual release cleanup.`,
        title: "Bulk dispatch release partial",
        tone: "warning" as const
      };
    case "bulk-release-failed":
      return {
        body: "The selected visits could not be released into Dispatch. Refresh the queue and try again.",
        title: "Bulk dispatch release failed",
        tone: "warning" as const
      };
    case "bulk-dispatch-update-saved":
      return {
        body: `${countLabel} were updated from the already-on-board follow-through queue.`,
        title: "Timing updates queued",
        tone: "success" as const
      };
    case "bulk-dispatch-update-partial":
      return {
        body: `${countLabel} were updated, but ${blockedLabel ?? "some visits"} still need manual follow-through.`,
        title: "Timing updates partially queued",
        tone: "warning" as const
      };
    case "bulk-dispatch-update-failed":
      return {
        body: "The already-on-board timing updates could not be queued. Refresh the queue and try again.",
        title: "Timing updates failed",
        tone: "warning" as const
      };
    default:
      return null;
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isTechnicianPaymentResolutionDisposition(
  value: string
): value is TechnicianPaymentResolutionDisposition {
  return technicianPaymentResolutionDispositions.includes(
    value as TechnicianPaymentResolutionDisposition
  );
}

function getNullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key).trim();
  return value ? value : null;
}

function normalizeEstimateReturnTo(value: string) {
  return value.startsWith("/dashboard/estimates") ? value : "/dashboard/estimates";
}

function appendEstimateFeedbackHref(
  returnTo: string,
  feedback: EstimateReleaseFeedbackCode,
  options?: {
    blockedCount?: number;
    count?: number;
  }
) {
  const [pathname = "/dashboard/estimates", search = ""] = normalizeEstimateReturnTo(returnTo).split("?");
  const params = new URLSearchParams(search);
  params.set("feedback", feedback);

  if (typeof options?.count === "number" && options.count > 0) {
    params.set("feedbackCount", String(options.count));
  } else {
    params.delete("feedbackCount");
  }

  if (typeof options?.blockedCount === "number" && options.blockedCount > 0) {
    params.set("feedbackBlocked", String(options.blockedCount));
  } else {
    params.delete("feedbackBlocked");
  }

  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

function buildEstimateDispatchHref(job: Pick<Job, "arrivalWindowStartAt" | "id" | "scheduledStartAt">, timeZone: string) {
  const dateValue = job.scheduledStartAt ?? job.arrivalWindowStartAt ?? new Date().toISOString();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));

  return `/dashboard/dispatch?view=day&date=${localDate}&jobId=${job.id}`;
}

function getEstimateWorkspaceHref(
  estimate: EstimateSummary,
  options?: {
    returnLabel?: string;
    returnTo?: string;
  }
) {
  return buildVisitEstimateHref(estimate.jobId, {
    returnLabel: options?.returnLabel ?? null,
    returnTo: options?.returnTo ?? null,
    workspace: estimate.status === "draft"
  });
}

function buildVisitsEstimateScopeHref(stage: EstimateThroughputStage, jobId?: string) {
  const params = new URLSearchParams();

  if (jobId) {
    params.set("jobId", jobId);
  }

  switch (stage) {
    case "approved_release":
      params.set("scope", "approved_release");
      break;
    case "stale_approval":
      params.set("scope", "stale_approval");
      break;
    case "awaiting_approval":
      params.set("scope", "awaiting_approval");
      break;
    default:
      params.set("scope", "estimate_drafting");
      break;
  }

  return `/dashboard/visits?${params.toString()}`;
}

function getEstimateVisitWorkspaceHref(estimate: EstimateSummary) {
  return buildVisitsEstimateScopeHref(getEstimateThroughputStage(estimate), estimate.jobId);
}

function getEstimateVisitWorkspaceLabel(estimate: EstimateSummary) {
  switch (getEstimateThroughputStage(estimate)) {
    case "approved_release":
      return "Open release runway";
    case "stale_approval":
      return "Open approval thread";
    case "awaiting_approval":
      return "Open approval thread";
    default:
      return "Open estimate work";
  }
}

function getEstimateReleasePromiseLabel(job: EstimateDeskJobState, timeZone: string) {
  if (job.scheduledStartAt) {
    return formatDateTime(job.scheduledStartAt, { fallback: "Unknown", timeZone });
  }

  if (job.arrivalWindowStartAt) {
    return formatDateTime(job.arrivalWindowStartAt, { fallback: "Unknown", timeZone });
  }

  return "Not set";
}

function getEstimateReleaseRunway(args: {
  estimate: EstimateSummary;
  job: EstimateDeskJobState;
  timeZone: string;
}) : EstimateReleaseRunway {
  const workflowState = getVisitWorkflowState(args.job);
  const releaseThreadHref = buildVisitsEstimateScopeHref("approved_release", args.estimate.jobId);
  const dispatchHref = buildEstimateDispatchHref(args.job, args.timeZone);
  const releaseThreadLabel = "Open release runway";
  const ownerLabel = args.job.assignedTechnicianUserId ? "Assigned" : "Unassigned";
  const promiseLabel = getEstimateReleasePromiseLabel(args.job, args.timeZone);

  switch (workflowState) {
    case "needs_assignment":
      return {
        copy: "Commercial approval is clear, but Dispatch still cannot place this work until a technician owns the visit.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Open dispatch board",
        label: "Assign the field owner",
        ownerLabel,
        primaryActionHref: releaseThreadHref,
        primaryActionLabel: "Assign in visits",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: dispatchHref,
        secondaryActionLabel: "Open dispatch board",
        workflowState
      };
    case "ready_to_schedule":
      return {
        copy: "The technician owner is clear, but the visit still needs a promise window before it should hit the live board.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Open dispatch board",
        label: "Lock the time promise",
        ownerLabel,
        primaryActionHref: releaseThreadHref,
        primaryActionLabel: "Set promise in visits",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: dispatchHref,
        secondaryActionLabel: "Open dispatch board",
        workflowState
      };
    case "ready_to_dispatch":
      return {
        copy: "Owner and promise are already set. Move straight into Dispatch while the customer, quote, and visit thread are still aligned.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Open dispatch board",
        label: "Release into dispatch",
        ownerLabel,
        primaryActionHref: dispatchHref,
        primaryActionLabel: "Open dispatch board",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: releaseThreadHref,
        secondaryActionLabel: "Open release runway",
        workflowState
      };
    case "live":
      return {
        copy: "The approved work is already on the board or in the field. Stay in Dispatch to manage timing and customer updates.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Track in dispatch",
        label: "Track the live thread",
        ownerLabel,
        primaryActionHref: dispatchHref,
        primaryActionLabel: "Track in dispatch",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: releaseThreadHref,
        secondaryActionLabel: "Open visit thread",
        workflowState
      };
    case "completed":
      return {
        copy: "Field work is already complete. Keep this quote anchored to the visit thread for closeout or follow-up instead of reopening dispatch.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Open dispatch board",
        label: "Close the service thread",
        ownerLabel,
        primaryActionHref: releaseThreadHref,
        primaryActionLabel: "Open visit thread",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: buildVisitEstimateHref(args.estimate.jobId),
        secondaryActionLabel: "Open quote",
        workflowState
      };
    case "intake":
    default:
      return {
        copy: "The quote is approved, but the visit still reads like intake. Clean up the release runway before Dispatch becomes the owner.",
        dispatchActionHref: dispatchHref,
        dispatchActionLabel: "Open dispatch board",
        label: "Finish intake before release",
        ownerLabel,
        primaryActionHref: releaseThreadHref,
        primaryActionLabel: "Open release runway",
        promiseLabel,
        releaseThreadHref,
        releaseThreadLabel,
        secondaryActionHref: dispatchHref,
        secondaryActionLabel: "Open dispatch board",
        workflowState
      };
  }
}

function getEstimateBulkReleaseReadiness(
  job: EstimateDeskJobState | null,
  releaseRunway: EstimateReleaseRunway | null
): EstimateBulkActionReadiness {
  return getEstimateBulkReleaseReadinessHelper(job, releaseRunway ? {
    workflowState: releaseRunway.workflowState
  } : null);
}

function getEstimateBulkOwnerReadiness(job: EstimateDeskJobState | null) {
  return getEstimateBulkOwnerReadinessHelper(job);
}

function getEstimateBulkPromiseReadiness(job: EstimateDeskJobState | null) {
  return getEstimateBulkPromiseReadinessHelper(job);
}

function getEstimateBulkDispatchUpdateReadiness(job: EstimateDeskJobState | null) {
  return getEstimateBulkDispatchUpdateReadinessHelper(job);
}

function isEstimateApprovedReleaseAlreadyOnBoard(row: EstimateBulkSelectionRow) {
  return isEstimateApprovedReleaseAlreadyOnBoardHelper({ job: row.job });
}

function getEstimateDispatchUpdateActionLabel(updateType: EstimateDispatchUpdateType | null) {
  if (updateType === "en_route") {
    return "Send en-route update";
  }

  if (updateType === "dispatched") {
    return "Send dispatched update";
  }

  return null;
}

function getEstimateOutboundAgeLabel(value: string | null | undefined) {
  const minutes = getEstimateOutboundAgeMinutes(value);

  if (minutes === null) {
    if (!value) {
      return "No outbound message yet";
    }

    return "Outbound timing unavailable";
  }

  if (minutes < 60) {
    return `${minutes} min since last message`;
  }

  return `${Math.round(minutes / 60)} hr since last message`;
}

function getEstimateOutboundAgeMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(Math.round((Date.now() - timestamp) / 60_000), 0);
}

function getEstimateOnBoardFollowThroughRiskScore(input: {
  dispatchUpdateReadiness: EstimateBulkDispatchUpdateReadiness;
  followThroughTone: EstimateOnBoardFollowThrough["tone"];
  jobStatus: EstimateDeskJobState["status"] | null | undefined;
  lastCustomerUpdateAt: string | null;
}) {
  const lastOutboundAgeMinutes = getEstimateOutboundAgeMinutes(input.lastCustomerUpdateAt);
  const toneScore =
    input.followThroughTone === "danger"
      ? 320
      : input.followThroughTone === "warning"
        ? 220
        : input.followThroughTone === "brand"
          ? 120
          : input.followThroughTone === "success"
            ? 20
            : 40;
  const outboundScore =
    lastOutboundAgeMinutes === null
      ? 240
      : lastOutboundAgeMinutes >= 120
        ? 220
        : lastOutboundAgeMinutes >= 60
          ? 160
          : lastOutboundAgeMinutes >= 30
            ? 100
            : lastOutboundAgeMinutes >= 15
              ? 50
              : 10;
  const updateScore =
    input.dispatchUpdateReadiness.updateType === "en_route"
      ? 60
      : input.dispatchUpdateReadiness.updateType === "dispatched"
        ? 30
        : 0;

  return (
    toneScore +
    outboundScore +
    updateScore +
    getEstimateOnBoardStatusRiskRank(input.jobStatus) * 30 +
    (input.dispatchUpdateReadiness.isReady ? 0 : 180)
  );
}

function getEstimateActionLabel(estimate: EstimateSummary) {
  return getEstimateSupportActionLabel(estimate);
}

function getEstimateCustomerLabel(estimate: EstimateSummary) {
  return estimate.customerName ?? "Customer pending";
}

function getEstimateVehicleContext(estimate: EstimateSummary) {
  return estimate.vehicleLabel ?? "Vehicle pending";
}

function getEstimateBoardContext(estimate: EstimateSummary) {
  return `${getEstimateCustomerLabel(estimate)} · ${getEstimateVehicleContext(estimate)}`;
}

function getEstimateDecisionChecklist(estimate: EstimateThroughputRecord) {
  const stage = getEstimateThroughputStage(estimate);

  switch (stage) {
    case "drafting":
      return ["Confirm labor, parts, and fees.", "Send the approval link once pricing is final."];
    case "awaiting_approval":
      return ["Monitor customer response.", "Move approved work into visits as soon as the decision lands."];
    case "stale_approval":
      return ["Contact the customer now.", "Escalate approved work into visits immediately after confirmation."];
    case "approved_release":
      return ["Release the visit into dispatch.", "Lock arrival timing and technician ownership."];
    case "closed":
      return estimate.status === "declined"
        ? ["Leave the estimate closed.", "Reopen only if the customer wants a revised quote."]
        : ["Keep this estimate archived.", "Reference it only when replacing the quote."];
    default:
      return ["Review the estimate.", "Decide the next action."];
  }
}

function compareEstimateThroughput(a: EstimateThroughputRecord, b: EstimateThroughputRecord) {
  const stageDifference = getEstimateThroughputRank(getEstimateThroughputStage(a)) - getEstimateThroughputRank(getEstimateThroughputStage(b));
  if (stageDifference !== 0) return stageDifference;

  if (a.status === "accepted" && b.status === "accepted") {
    const aAccepted = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
    const bAccepted = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;
    return aAccepted - bAccepted;
  }

  if (a.status === "sent" && b.status === "sent") {
    const aSent = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const bSent = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return aSent - bSent;
  }

  return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
}

function compareEstimateThroughputWithPressure(
  a: EstimateSummary,
  b: EstimateSummary,
  threadSummariesByEstimateId: Map<string, ReturnType<typeof getServiceThreadSummary>>
) {
  const pressureDelta =
    getServiceThreadPressureScore(threadSummariesByEstimateId.get(b.estimateId) ?? {
      copy: "",
      label: "Thread visible",
      nextActionLabel: "Monitor only",
      segments: [],
      tone: "neutral"
    }) -
    getServiceThreadPressureScore(threadSummariesByEstimateId.get(a.estimateId) ?? {
      copy: "",
      label: "Thread visible",
      nextActionLabel: "Monitor only",
      segments: [],
      tone: "neutral"
    });

  if (pressureDelta !== 0) {
    return pressureDelta;
  }

  return compareEstimateThroughput(a, b);
}

function getEstimateThreadNextStepLabel(
  estimate: EstimateSummary,
  threadSummary: ReturnType<typeof getServiceThreadSummary> | null
) {
  return threadSummary?.nextActionLabel ?? getEstimateNextStepLabel(estimate);
}

function getEstimateTimeline(record: EstimateTimelineRecord, timeZone: string) {
  if (record.status === "accepted" && record.acceptedAt) {
    return { label: "Approved", value: formatDateTime(record.acceptedAt, { fallback: "Unknown", timeZone }) };
  }

  if (record.status === "sent" && record.sentAt) {
    return { label: "Sent", value: formatDateTime(record.sentAt, { fallback: "Unknown", timeZone }) };
  }

  if (record.status === "declined" && record.declinedAt) {
    return { label: "Declined", value: formatDateTime(record.declinedAt, { fallback: "Unknown", timeZone }) };
  }

  if (record.status === "void" && record.voidedAt) {
    return { label: "Voided", value: formatDateTime(record.voidedAt, { fallback: "Unknown", timeZone }) };
  }

  return { label: "Updated", value: formatDateTime(record.updatedAt, { fallback: "Unknown", timeZone }) };
}

function isEstimateReadyForVisitRelease(
  estimate: EstimateSummary,
  jobStatus: EstimateSummary["status"] | JobStatus
) {
  return getEstimateThroughputStage(estimate) === "approved_release" && (jobStatus === "new" || jobStatus === "scheduled");
}

function getVehicleLabel(vehicle: { year: number | null; make: string; model: string }) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getCustomerLabel(customer: {
  companyName?: string | null | undefined;
  firstName: string;
  lastName: string;
  relationshipType?: "retail_customer" | "fleet_account" | undefined;
}) {
  return getCustomerDisplayName(customer);
}

function getEstimateItemTypeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getEstimateCardTimeline(estimate: EstimateSummary, timeZone: string) {
  return getEstimateTimeline(
    {
      acceptedAt: estimate.acceptedAt,
      declinedAt: estimate.declinedAt,
      sentAt: estimate.sentAt,
      status: estimate.status,
      updatedAt: estimate.updatedAt,
      voidedAt: estimate.voidedAt
    },
    timeZone
  );
}

function pluralizeLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function getOptionalEstimateWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string
) {
  try {
    return {
      data: await getEstimateWorkspaceByJobId(client, companyId, jobId),
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to load estimate workspace.")
    };
  }
}

function getEstimateWorkspacePreviewLines(workspace: EstimateWorkspace) {
  const previewLines: Array<{
    id: string;
    label: string;
    meta: string;
  }> = [];

  for (const section of workspace.sections) {
    for (const lineItem of section.lineItems) {
      previewLines.push({
        id: lineItem.id,
        label: lineItem.name,
        meta: section.section.title
      });
    }
  }

  for (const lineItem of workspace.ungroupedLineItems) {
    previewLines.push({
      id: lineItem.id,
      label: lineItem.name,
      meta: "Ungrouped"
    });
  }

  return previewLines.slice(0, 4);
}

function formatEstimateDeskStatusLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const estimateProductionLanes: Array<{
  description: string;
  key: "draft" | "sent" | "accepted";
  label: string;
  stageLabel: string;
  statuses: EstimateSummary["status"][];
}> = [
  { key: "draft", label: "Builder in progress", stageLabel: "Builder", description: "Finish pricing and get the quote out.", statuses: ["draft"] },
  { key: "sent", label: "Approval pursuit", stageLabel: "Conversion", description: "Chase sent work and escalate stale approvals.", statuses: ["sent"] },
  { key: "accepted", label: "Approved to release", stageLabel: "Release", description: "Move approved work straight into visits.", statuses: ["accepted"] }
];

const estimateDeskSections: Array<{
  actionLabel: string;
  copy: string;
  eyebrow: string;
  focusLabel: string;
  key: EstimateThroughputStage;
  label: string;
  tone: "brand" | "warning" | "danger" | "success";
}> = [
  {
    key: "stale_approval",
    label: "Stale approvals",
    eyebrow: "Act now",
    copy: "Quotes that need customer follow-up before they die in the queue.",
    focusLabel: "Follow up now",
    actionLabel: "Chase approvals",
    tone: "danger"
  },
  {
    key: "approved_release",
    label: "Approved to release",
    eyebrow: "Release",
    copy: "Approved work that should move into visit timing and dispatch immediately.",
    focusLabel: "Release visit",
    actionLabel: "Open release runway",
    tone: "success"
  },
  {
    key: "awaiting_approval",
    label: "Awaiting approval",
    eyebrow: "Monitor",
    copy: "Live approvals that should stay visible without crowding the urgent work.",
    focusLabel: "Monitor decision",
    actionLabel: "Review approvals",
    tone: "warning"
  },
  {
    key: "drafting",
    label: "Builder in progress",
    eyebrow: "Build",
    copy: "Quotes still being priced before they can convert into approvals.",
    focusLabel: "Finish pricing",
    actionLabel: "Open builders",
    tone: "brand"
  }
];

function getEstimateDeskSectionHref(current: EstimatesFilterState, stage: EstimateThroughputStage) {
  return buildEstimatesHref(current, { estimateId: "", stage, view: "compact" });
}

function getEstimateLaneSummary(
  lane: (typeof estimateProductionLanes)[number],
  estimates: EstimateSummary[],
  jobsByJobId: Map<string, EstimateDeskJobState>,
  timeZone: string
) {
  const totalValue = estimates.reduce((sum, estimate) => sum + estimate.totalCents, 0);
  const staleCount = estimates.filter((estimate) => getEstimateThroughputStage(estimate) === "stale_approval").length;

  if (lane.key === "draft") {
    return {
      actionHref: estimates[0]
        ? buildVisitsEstimateScopeHref("drafting", estimates[0].jobId)
        : "/dashboard/visits/new?mode=estimate",
      actionLabel: "Open estimate work",
      focusLabel: "Lane focus",
      focusValue: "Finish pricing",
      metricLabel: "Quoted value",
      metricValue: formatCurrencyFromCents(totalValue),
      support: estimates.length ? "Finish pricing fast so the queue can convert." : "No builder work is in motion."
    };
  }

  if (lane.key === "sent") {
    return {
      actionHref: buildVisitsEstimateScopeHref(
        staleCount ? "stale_approval" : "awaiting_approval",
        estimates[0]?.jobId
      ),
      actionLabel: staleCount ? "Open stale approvals" : "Open approval queue",
      focusLabel: "Lane focus",
      focusValue: staleCount ? `${staleCount} stale` : "Follow up",
      metricLabel: "Quoted value",
      metricValue: formatCurrencyFromCents(totalValue),
      support: staleCount
        ? "Get overdue approvals unstuck and convert them into visits."
        : estimates.length
          ? "Stay on active approvals and move fast."
          : "No approvals are waiting."
    };
  }

  const leadEstimate = estimates[0] ?? null;
  const leadJob = leadEstimate ? jobsByJobId.get(leadEstimate.jobId) ?? null : null;
  const releaseRunway = leadEstimate && leadJob
    ? getEstimateReleaseRunway({
        estimate: leadEstimate,
        job: leadJob,
        timeZone
      })
    : null;

  return {
    actionHref: releaseRunway?.primaryActionHref ?? buildVisitsEstimateScopeHref("approved_release", estimates[0]?.jobId),
    actionLabel: releaseRunway?.primaryActionLabel ?? "Release to visits",
    focusLabel: "Lane focus",
    focusValue: releaseRunway ? getVisitWorkflowLabel(releaseRunway.workflowState) : "Release now",
    metricLabel: "Ready value",
    metricValue: formatCurrencyFromCents(totalValue),
    support: estimates.length
      ? releaseRunway?.copy ?? "Release approved work into visits and lock timing."
      : "No approved work is waiting."
  };
}

export default async function EstimatesPage({ searchParams }: EstimatesPageProps) {
  noStore();
  const context = await requireCompanyContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedbackBlockedCount = Number.parseInt(readSearchParam(resolvedSearchParams.feedbackBlocked), 10);
  const feedbackCode = readSearchParam(resolvedSearchParams.feedback);
  const feedbackCount = Number.parseInt(readSearchParam(resolvedSearchParams.feedbackCount), 10);
  const requestedStage =
    resolveEstimateThroughputStage(readSearchParam(resolvedSearchParams.stage)) ??
    mapLegacyEstimateStatusToStage(readSearchParam(resolvedSearchParams.status)) ??
    "";
  const filters: EstimatesFilterState = {
    estimateId: readSearchParam(resolvedSearchParams.estimateId),
    jobId: readSearchParam(resolvedSearchParams.jobId),
    query: readSearchParam(resolvedSearchParams.query),
    selectedJobIds: serializeIdList(parseSearchParamIdList(resolvedSearchParams.selectedJobIds)),
    stage: requestedStage,
    view: resolveEstimateView(readSearchParam(resolvedSearchParams.view))
  };
  const selectedJobIds = parseSearchParamIdList(resolvedSearchParams.selectedJobIds);
  const selectedJobIdSet = new Set(selectedJobIds);

  const [allEstimatesResult, visibleEstimatesResult] = await Promise.all([
    listEstimatesByCompany(context.supabase, context.companyId),
    listEstimatesByCompany(context.supabase, context.companyId, {
      query: filters.query || undefined
    })
  ]);

  if (allEstimatesResult.error) {
    throw toServerError(
      allEstimatesResult.error,
      "Visits approval runway could not load estimates."
    );
  }

  if (visibleEstimatesResult.error) {
    throw toServerError(
      visibleEstimatesResult.error,
      "Visits approval runway could not load the current estimate slice."
    );
  }

  const allEstimates = allEstimatesResult.data ?? [];
  const queryMatchedEstimates = visibleEstimatesResult.data ?? [];
  const estimateJobIds = [...new Set(allEstimates.map((estimate) => estimate.jobId))];
  const [estimateJobsResult, invoicesResult, communicationsResult, openPartRequestsResult, inventoryIssuesResult] = estimateJobIds.length
    ? await Promise.all([
        context.supabase
          .from("jobs")
          .select("id, status, is_active, assigned_technician_user_id, scheduled_start_at, arrival_window_start_at")
          .eq("company_id", context.companyId)
          .in("id", estimateJobIds),
        listServiceHistoryInvoicesByJobIds(context.supabase, context.companyId, estimateJobIds),
        context.supabase
          .from("customer_communications")
          .select("job_id, communication_type, created_at")
          .eq("company_id", context.companyId)
          .in("job_id", estimateJobIds)
          .order("created_at", { ascending: false })
          .returns<EstimateCommunicationSnapshotRow[]>(),
        context.supabase
          .from("part_requests")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .eq("status", "open")
          .in("job_id", estimateJobIds),
        context.supabase
          .from("job_inventory_issues")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .in("job_id", estimateJobIds)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (estimateJobsResult.error) {
    throw toServerError(
      estimateJobsResult.error,
      "Visits approval runway could not load linked visits."
    );
  }
  if (invoicesResult.error) {
    throw toServerError(
      invoicesResult.error,
      "Visits approval runway could not load linked invoices."
    );
  }
  if (communicationsResult.error) {
    throw toServerError(
      communicationsResult.error,
      "Visits approval runway could not load customer updates."
    );
  }
  if (openPartRequestsResult.error) {
    throw toServerError(
      openPartRequestsResult.error,
      "Visits approval runway could not load open part requests."
    );
  }
  if (inventoryIssuesResult.error) {
    throw toServerError(
      inventoryIssuesResult.error,
      "Visits approval runway could not load inventory issues."
    );
  }

  const estimateJobsByJobId = new Map<string, EstimateDeskJobState>(
    (estimateJobsResult.data ?? []).map((job) => [
      job.id,
      {
        arrivalWindowStartAt: job.arrival_window_start_at,
        assignedTechnicianUserId: job.assigned_technician_user_id,
        id: job.id,
        isActive: job.is_active,
        scheduledStartAt: job.scheduled_start_at,
        status: job.status
      }
    ])
  );
  const estimateJobStatusByJobId = new Map(
    [...estimateJobsByJobId.entries()].map(([jobId, job]) => [jobId, job.status])
  );
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
  const estimateCommunicationsByJobId = (communicationsResult.data ?? []).reduce<
    Map<string, Array<{ communicationType: string; createdAt: string }>>
  >((entries, communication) => {
    if (!communication.job_id) {
      return entries;
    }

    const current = entries.get(communication.job_id) ?? [];
    current.push({
      communicationType: communication.communication_type,
      createdAt: communication.created_at
    });
    entries.set(communication.job_id, current);
    return entries;
  }, new Map());
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
  const estimateSummariesByJobId = new Map(
    allEstimates.map((estimate) => [estimate.jobId, estimate])
  );
  const workspaceBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId: new Map(
      allEstimates.map((estimate) => [estimate.jobId, { sentAt: estimate.sentAt ?? null, status: estimate.status }])
    ),
    inventoryIssuesByJobId,
    invoicesByJobId: new Map(
      [...latestInvoicesByJobId.entries()].map(([jobId, invoice]) => [
        jobId,
        {
          balanceDueCents: invoice.balanceDueCents,
          status: invoice.status,
          updatedAt: invoice.updatedAt
        }
      ])
    ),
    jobs: estimateJobIds.map((jobId) => {
      const estimate = estimateSummariesByJobId.get(jobId);

      return {
        customerDisplayName: estimate?.customerName ?? "Customer pending",
        id: jobId,
        status: estimateJobStatusByJobId.get(jobId) ?? "scheduled",
        title: estimate?.title ?? "Estimate visit",
        vehicleDisplayName: estimate?.vehicleLabel ?? "Vehicle pending"
      };
    }),
    paymentHandoffSummaryByJobId,
    openPaymentHandoffCountByJobId,
    openPartRequestsByJobId
  });
  const estimateThreadSummaryByEstimateId = new Map(
    allEstimates.map((estimate) => [
      estimate.estimateId,
      getServiceThreadSummary({
        estimate: {
          estimateNumber: estimate.estimateNumber,
          status: estimate.status,
          totalCents: estimate.totalCents
        },
        job: {
          status: estimateJobStatusByJobId.get(estimate.jobId) ?? "scheduled"
        }
      })
    ])
  );
  const visibleEstimates = (
    filters.stage
      ? queryMatchedEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === filters.stage)
      : queryMatchedEstimates
  ).sort((left, right) =>
    compareEstimateThroughputWithPressure(left, right, estimateThreadSummaryByEstimateId)
  );
  const selectedEstimate = filters.estimateId
    ? visibleEstimates.find((estimate) => estimate.estimateId === filters.estimateId) ?? null
    : null;
  const [selectedDetailResult, selectedEstimateWorkspaceResult] = selectedEstimate
    ? await Promise.all([
        getEstimateDetailById(context.supabase, selectedEstimate.estimateId),
        getOptionalEstimateWorkspace(context.supabase, context.companyId, selectedEstimate.jobId)
      ])
    : [null, null];
  const assignableTechniciansResult = context.canEditRecords
    ? await listAssignableTechniciansByCompany(context.supabase, context.companyId)
    : { data: [], error: null };

  if (selectedDetailResult?.error) {
    throw toServerError(
      selectedDetailResult.error,
      "Visits approval runway could not load the selected estimate thread."
    );
  }
  if (assignableTechniciansResult.error) {
    throw toServerError(
      assignableTechniciansResult.error,
      "Visits approval runway could not load technician owners."
    );
  }

  const selectedDetail = selectedDetailResult?.data ?? null;
  const selectedEstimateWorkspace = selectedEstimateWorkspaceResult?.data ?? null;
  const assignableTechnicians = assignableTechniciansResult.data ?? [];
  const filtersApplied = Boolean(filters.query || filters.stage);
  const queueEstimates = (filtersApplied ? visibleEstimates : allEstimates)
    .slice()
    .sort((left, right) =>
      compareEstimateThroughputWithPressure(left, right, estimateThreadSummaryByEstimateId)
    );
  const draftCount = queueEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === "drafting").length;
  const awaitingApprovalCount = queueEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === "awaiting_approval").length;
  const staleApprovalCount = queueEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === "stale_approval").length;
  const approvedReleaseCount = queueEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === "approved_release").length;
  const quotedValue = queueEstimates
    .filter((estimate) => getEstimateThroughputStage(estimate) !== "closed")
    .reduce((total, estimate) => total + estimate.totalCents, 0);
  const productionLanes = estimateProductionLanes.map((lane) => ({
    ...lane,
    estimates: visibleEstimates
      .filter((estimate) => lane.statuses.includes(estimate.status))
      .sort((left, right) =>
        compareEstimateThroughputWithPressure(left, right, estimateThreadSummaryByEstimateId)
      )
  }));
  const supportEstimates = visibleEstimates
    .filter((estimate) => getEstimateThroughputStage(estimate) === "closed")
    .sort((left, right) =>
      compareEstimateThroughputWithPressure(left, right, estimateThreadSummaryByEstimateId)
    );
  const clearEstimateHref = buildEstimatesHref(filters, { estimateId: "", jobId: "" });
  const clearFiltersHref = buildEstimatesHref(filters, { estimateId: "", jobId: "", query: "", stage: "" });
  const queueReturnHref = buildEstimatesHref(filters, { estimateId: "", jobId: "" });
  const compactViewHref = buildEstimatesHref(filters, { view: "compact" });
  const listViewHref = buildEstimatesHref(filters, { view: "list" });
  const isCompactView = filters.view === "compact";
  const isListView = filters.view === "list";
  const selectedTimeline = selectedDetail ? getEstimateTimeline(selectedDetail.estimate, context.company.timezone) : null;
  const selectedVisitHref = selectedEstimate
    ? getEstimateVisitWorkspaceHref(selectedEstimate)
    : "/dashboard/visits";
  const selectedVisitLabel = selectedEstimate
    ? getEstimateVisitWorkspaceLabel(selectedEstimate)
    : "Open visits";
  const selectedEstimateOwnership = selectedEstimate
    ? getEstimateExceptionOwnershipSummary({
        sentAt: selectedEstimate.sentAt ?? null,
        status: selectedEstimate.status
      })
    : null;
  const workspaceBlockerByJobId = new Map(workspaceBlockers.items.map((item) => [item.jobId, item]));
  const selectedWorkflowBlocker = selectedEstimate
    ? workspaceBlockerByJobId.get(selectedEstimate.jobId) ?? null
    : null;
  const selectedThreadSummary = selectedEstimate
    ? estimateThreadSummaryByEstimateId.get(selectedEstimate.estimateId) ?? null
    : null;
  const selectedReleaseRunway =
    selectedEstimate && selectedDetail
      ? getEstimateReleaseRunway({
          estimate: selectedEstimate,
          job: selectedDetail.job,
          timeZone: context.company.timezone
        })
      : null;
  const selectedReleaseFeedback =
    selectedEstimate && selectedReleaseRunway && !feedbackCode.startsWith("bulk-")
      ? getEstimateReleaseFeedback(feedbackCode)
      : null;
  const selectedReleaseRunwayDispatchAction =
    selectedReleaseRunway &&
    selectedReleaseRunway.dispatchActionHref !== selectedReleaseRunway.primaryActionHref &&
    selectedReleaseRunway.dispatchActionHref !== selectedReleaseRunway.secondaryActionHref
      ? {
          href: selectedReleaseRunway.dispatchActionHref,
          label: selectedReleaseRunway.dispatchActionLabel
        }
      : null;
  const activeQueueCount = productionLanes.reduce((total, lane) => total + lane.estimates.length, 0);
  const toolbarSummary = staleApprovalCount
      ? `${pluralizeLabel(staleApprovalCount, "stale approval")} need follow-up.`
      : approvedReleaseCount
        ? `${pluralizeLabel(approvedReleaseCount, "approved estimate")} are ready for visit release.`
        : awaitingApprovalCount
        ? `${pluralizeLabel(awaitingApprovalCount, "estimate")} waiting on approval.`
        : draftCount
          ? `${pluralizeLabel(draftCount, "estimate")} still in the builder.`
          : "Estimate queue is clear.";
  const estimateToolbarMetrics = [
    {
      key: "active",
      label: "Live",
      tone: "neutral" as const,
      value: String(activeQueueCount)
    },
    {
      key: "ready",
      label: "Ready",
      tone: approvedReleaseCount ? ("success" as const) : ("neutral" as const),
      value: String(approvedReleaseCount)
    },
    ...(staleApprovalCount
      ? [
          {
            key: "stale",
            label: "Stale",
            tone: "warning" as const,
            value: String(staleApprovalCount)
          }
        ]
      : []),
    ...(workspaceBlockers.supplyBlockedCount
      ? [
          {
            key: "supply",
            label: "Supply",
            tone: "warning" as const,
            value: String(workspaceBlockers.supplyBlockedCount)
          }
        ]
      : []),
    ...(!staleApprovalCount && !workspaceBlockers.supplyBlockedCount
      ? [
          {
            key: "quoted",
            label: "Quoted",
            tone: "value" as const,
            value: formatCurrencyFromCents(quotedValue)
          }
        ]
      : [])
  ];
  const visibleEstimateToolbarMetrics = estimateToolbarMetrics.slice(0, 1);
  const showEstimateToolbarMetrics = Boolean(
    staleApprovalCount || approvedReleaseCount || filtersApplied
  );
  const showEstimateViewSwitch = isListView || visibleEstimates.length > 6;
  const estimateQueuePanelSummary = filtersApplied
    ? [
        filters.query ? `Search: ${filters.query}` : null,
        filters.stage ? getEstimateThroughputStageLabel(filters.stage as EstimateThroughputStage) : null,
        `${visibleEstimates.length} record${visibleEstimates.length === 1 ? "" : "s"}`
      ]
        .filter(Boolean)
        .join(" · ")
    : "Use this desk only when approval or release exceptions still need support outside the active visit thread.";
  const selectedLane =
    (selectedEstimate
      ? productionLanes.find((lane) => lane.estimates.some((estimate) => estimate.estimateId === selectedEstimate.estimateId))
      : null) ??
    (selectedEstimate
      ? estimateProductionLanes.find((lane) => lane.statuses.includes(selectedEstimate.status))
      : null) ??
    null;
  const selectedEstimateDeskReturnHref = selectedEstimate
    ? buildEstimatesHref(filters, {
        estimateId: selectedEstimate.estimateId,
        jobId: selectedEstimate.jobId
      })
    : "/dashboard/estimates";
  const selectedEstimateWorkspaceHref = selectedEstimate
    ? getEstimateWorkspaceHref(selectedEstimate, {
        returnLabel: "Back to estimates",
        returnTo: selectedEstimateDeskReturnHref
      })
    : "/dashboard/visits";
  const selectedEstimateReviewHref = selectedEstimate
    ? buildVisitEstimateHref(selectedEstimate.jobId, {
        returnLabel: "Back to estimates",
        returnTo: selectedEstimateDeskReturnHref
      })
    : "/dashboard/visits";
  const selectedEstimatePartsHref = selectedEstimate
    ? buildVisitPartsHref(selectedEstimate.jobId, {
        returnLabel: "Back to estimates",
        returnTo: selectedEstimateDeskReturnHref
      })
    : "/dashboard/visits";
  const selectedEstimateWorkspacePreviewLines = selectedEstimateWorkspace
    ? getEstimateWorkspacePreviewLines(selectedEstimateWorkspace)
    : [];
  const selectedEstimateWorkspaceUnavailable = Boolean(selectedEstimateWorkspaceResult?.error);
  const selectedEstimatePendingPricingPartLines = selectedEstimateWorkspace
    ? [
        ...selectedEstimateWorkspace.sections.flatMap((section) =>
          section.lineItems.map((lineItem) => ({
            lineItem,
            sectionTitle: section.section.title
          }))
        ),
        ...selectedEstimateWorkspace.ungroupedLineItems.map((lineItem) => ({
          lineItem,
          sectionTitle: "Ungrouped"
        }))
      ].filter(
        ({ lineItem }) =>
          lineItem.itemType === "part" &&
          typeof lineItem.linkedPartRequestLine?.quotedUnitCostCents !== "number"
      )
    : [];
  const selectedEstimatePendingPricingPartCount = selectedEstimatePendingPricingPartLines.length;
  const selectedEstimatePendingPricingPrimaryLine = selectedEstimatePendingPricingPartLines[0] ?? null;
  const selectedEstimatePendingSourcePartCount = selectedEstimateWorkspace
    ? [
        ...selectedEstimateWorkspace.sections.flatMap((section) => section.lineItems),
        ...selectedEstimateWorkspace.ungroupedLineItems
      ].filter((lineItem) => lineItem.itemType === "part" && !lineItem.linkedPartRequestLine?.partNumber).length
    : 0;
  const selectedEstimateCanvasReady = Boolean(selectedEstimateWorkspace?.summary.lineItemCount);
  const selectedEstimateContinuation = !selectedEstimate
    ? null
    : selectedEstimateWorkspaceUnavailable
      ? {
          copy: "The desk snapshot could not load the live builder state. Continue in the full quote thread so pricing and release work does not stall.",
          label: "Continue in full builder",
          primaryActionHref: selectedEstimate.status === "draft" ? selectedEstimateWorkspaceHref : selectedEstimateReviewHref,
          primaryActionLabel: selectedEstimate.status === "draft" ? "Open builder" : "Open quote",
          secondaryActionHref: selectedVisitHref,
          secondaryActionLabel: selectedVisitLabel
        }
      : selectedEstimate.status === "draft"
        ? !selectedEstimateCanvasReady
          ? {
              copy: "This quote exists, but the builder is still empty. Stage the first labor or part line before it falls back into intake limbo.",
              label: "Build the first operation",
              primaryActionHref: selectedEstimateWorkspaceHref,
              primaryActionLabel: "Continue builder",
              secondaryActionHref: selectedEstimatePartsHref,
              secondaryActionLabel: "Open sourcing"
            }
          : selectedEstimatePendingPricingPartCount
            ? {
                copy: `${pluralizeLabel(selectedEstimatePendingPricingPartCount, "part line")} still need supplier cost before the quote is genuinely ready for review.`,
                label: selectedEstimatePendingPricingPrimaryLine
                  ? `Price ${selectedEstimatePendingPricingPrimaryLine.lineItem.name}`
                  : "Resolve part pricing",
                primaryActionHref: selectedEstimateWorkspaceHref,
                primaryActionLabel: "Continue builder",
                secondaryActionHref: selectedEstimatePartsHref,
                secondaryActionLabel: "Open sourcing"
              }
            : selectedEstimatePendingSourcePartCount
              ? {
                  copy: `${pluralizeLabel(selectedEstimatePendingSourcePartCount, "part line")} still need sourcing detail before the customer-ready review should begin.`,
                  label: "Start sourcing",
                  primaryActionHref: selectedEstimatePartsHref,
                  primaryActionLabel: "Open sourcing",
                  secondaryActionHref: selectedEstimateWorkspaceHref,
                  secondaryActionLabel: "Continue builder"
                }
              : {
                  copy: "Pricing and sourcing are clear. Move straight into customer-ready review without losing the queue that brought you here.",
                  label: "Review and release the quote",
                  primaryActionHref: selectedEstimateReviewHref,
                  primaryActionLabel: "Open review",
                  secondaryActionHref: selectedEstimateWorkspaceHref,
                  secondaryActionLabel: "Adjust builder"
                }
        : selectedEstimate.status === "sent"
          ? {
              copy: "Approval pursuit is now the constraint. Keep the customer-facing quote and visit release runway paired while you work follow-up.",
              label: "Work the approval thread",
              primaryActionHref: selectedEstimateReviewHref,
              primaryActionLabel: "Open approval review",
              secondaryActionHref: selectedVisitHref,
              secondaryActionLabel: selectedVisitLabel
            }
          : selectedEstimate.status === "accepted"
            ? selectedReleaseRunway
              ? {
                  copy: selectedReleaseRunway.copy,
                  label: selectedReleaseRunway.label,
                  primaryActionHref: selectedReleaseRunway.primaryActionHref,
                  primaryActionLabel: selectedReleaseRunway.primaryActionLabel,
                  secondaryActionHref: selectedReleaseRunway.secondaryActionHref,
                  secondaryActionLabel: selectedReleaseRunway.secondaryActionLabel
                }
              : {
                  copy: "The quote is approved. Move immediately into release and dispatch while the commercial context is still hot.",
                  label: "Release approved work",
                  primaryActionHref: selectedVisitHref,
                  primaryActionLabel: selectedVisitLabel,
                  secondaryActionHref: selectedEstimateReviewHref,
                  secondaryActionLabel: "Open quote"
                }
            : {
                copy: "This estimate is no longer in an active approval flow. Review the quote and only reopen it if the customer needs a revised version.",
                label: "Review the closed quote",
                primaryActionHref: selectedEstimateReviewHref,
                primaryActionLabel: "Open quote",
                secondaryActionHref: selectedVisitHref,
                secondaryActionLabel: selectedVisitLabel
              };
  const activeQueueEstimates = productionLanes.flatMap((lane) =>
    lane.estimates.map((estimate) => ({
      estimate,
      lane
    }))
  ).sort((a, b) =>
    compareEstimateThroughputWithPressure(a.estimate, b.estimate, estimateThreadSummaryByEstimateId)
  );
  const dominantThreadEstimate = queueEstimates.find((estimate) => {
    const summary = estimateThreadSummaryByEstimateId.get(estimate.estimateId);
    return summary ? getServiceThreadPressureScore(summary) > 0 : false;
  }) ?? null;
  const dominantThreadSummary = dominantThreadEstimate
    ? estimateThreadSummaryByEstimateId.get(dominantThreadEstimate.estimateId) ?? null
    : null;
  const dominantThreadHref = dominantThreadEstimate
    ? buildEstimatesHref(filters, {
        estimateId: dominantThreadEstimate.estimateId,
        jobId: dominantThreadEstimate.jobId
      })
    : "";
  const dominantThreadVisitHref = dominantThreadEstimate
    ? getEstimateVisitWorkspaceHref(dominantThreadEstimate)
    : "/dashboard/visits";
  const dominantThreadLabel = dominantThreadSummary?.nextActionLabel ?? "Work hot thread";
  const dominantThreadVisitLabel = dominantThreadEstimate
    ? getEstimateVisitWorkspaceLabel(dominantThreadEstimate)
    : "Open visits";
  const dominantThreadCopy =
    dominantThreadEstimate && dominantThreadSummary
      ? `${dominantThreadSummary.nextActionLabel} for ${getEstimateCustomerLabel(dominantThreadEstimate)}.`
      : "";
  const companyDraftingEstimates = allEstimates.filter((estimate) => getEstimateThroughputStage(estimate) === "drafting");
  const companyAwaitingApprovalEstimates = allEstimates.filter(
    (estimate) => getEstimateThroughputStage(estimate) === "awaiting_approval"
  );
  const companyStaleApprovalEstimates = allEstimates.filter(
    (estimate) => getEstimateThroughputStage(estimate) === "stale_approval"
  );
  const companyApprovedReleaseEstimates = allEstimates.filter((estimate) =>
    isEstimateReadyForVisitRelease(estimate, estimateJobStatusByJobId.get(estimate.jobId) ?? "scheduled")
  );
  const visibleApprovedReleaseEstimates = visibleEstimates.filter(
    (estimate) => getEstimateThroughputStage(estimate) === "approved_release"
  );
  const visibleApprovedReleaseRows = visibleApprovedReleaseEstimates.map((estimate) => {
    const job = estimateJobsByJobId.get(estimate.jobId) ?? null;
    const releaseRunway = job
      ? getEstimateReleaseRunway({
          estimate,
          job,
          timeZone: context.company.timezone
        })
      : null;

    return {
      dispatchUpdateReadiness: getEstimateBulkDispatchUpdateReadiness(job),
      estimate,
      job,
      ownerReadiness: getEstimateBulkOwnerReadiness(job),
      promiseReadiness: getEstimateBulkPromiseReadiness(job),
      releaseReadiness: getEstimateBulkReleaseReadiness(job, releaseRunway),
      releaseRunway
    } satisfies EstimateBulkSelectionRow;
  });
  const visibleApprovedReleaseRowsByEstimateId = new Map(
    visibleApprovedReleaseRows.map((row) => [row.estimate.estimateId, row] as const)
  );
  const selectedApprovedReleaseRows = visibleApprovedReleaseRows.filter((row) =>
    selectedJobIdSet.has(row.estimate.jobId)
  );
  const selectedApprovedReleaseCount = selectedApprovedReleaseRows.length;
  const approvedReleaseReadyRows = visibleApprovedReleaseRows.filter((row) => row.releaseReadiness.isReady);
  const approvedReleaseAlreadyOnBoardRowsUnsorted = visibleApprovedReleaseRows.filter((row) =>
    isEstimateApprovedReleaseAlreadyOnBoard(row)
  );
  const onBoardFollowThroughByJobId = new Map(
    approvedReleaseAlreadyOnBoardRowsUnsorted.map((row) => {
      const promiseSummary = row.job
        ? getVisitPromiseSummary({
            communications: estimateCommunicationsByJobId.get(row.estimate.jobId),
            job: row.job
          })
        : null;
      const updateType = row.dispatchUpdateReadiness.updateType;

      return [
        row.estimate.jobId,
        promiseSummary && row.job
          ? {
              copy: promiseSummary.copy,
              dispatchHref: buildEstimateDispatchHref(row.job, context.company.timezone),
              label: promiseSummary.label,
              lastCustomerUpdateAt: promiseSummary.lastCustomerUpdateAt,
              lastCustomerUpdateLabel: promiseSummary.lastCustomerUpdateLabel,
              lastOutboundAgeLabel: getEstimateOutboundAgeLabel(promiseSummary.lastCustomerUpdateAt),
              riskScore: getEstimateOnBoardFollowThroughRiskScore({
                dispatchUpdateReadiness: row.dispatchUpdateReadiness,
                followThroughTone: promiseSummary.tone,
                jobStatus: row.job.status,
                lastCustomerUpdateAt: promiseSummary.lastCustomerUpdateAt
              }),
              tone: promiseSummary.tone,
              updateActionLabel: getEstimateDispatchUpdateActionLabel(updateType),
              updateType
            }
          : null
      ] satisfies readonly [string, EstimateOnBoardFollowThrough | null];
    })
  );
  const approvedReleaseAlreadyOnBoardRows = [...approvedReleaseAlreadyOnBoardRowsUnsorted].sort(
    (left, right) => {
      const leftFollowThrough = onBoardFollowThroughByJobId.get(left.estimate.jobId);
      const rightFollowThrough = onBoardFollowThroughByJobId.get(right.estimate.jobId);
      const riskDelta = (rightFollowThrough?.riskScore ?? 0) - (leftFollowThrough?.riskScore ?? 0);

      if (riskDelta !== 0) {
        return riskDelta;
      }

      const leftAge = getEstimateOutboundAgeMinutes(leftFollowThrough?.lastCustomerUpdateAt);
      const rightAge = getEstimateOutboundAgeMinutes(rightFollowThrough?.lastCustomerUpdateAt);

      if ((rightAge ?? -1) !== (leftAge ?? -1)) {
        return (rightAge ?? -1) - (leftAge ?? -1);
      }

      const leftStatusRank = getEstimateOnBoardStatusRiskRank(left.job?.status);
      const rightStatusRank = getEstimateOnBoardStatusRiskRank(right.job?.status);

      if (leftStatusRank !== rightStatusRank) {
        return rightStatusRank - leftStatusRank;
      }

      return left.estimate.title.localeCompare(right.estimate.title);
    }
  );
  const approvedReleaseBlockedRows = visibleApprovedReleaseRows.filter(
    (row) => !row.releaseReadiness.isReady && !isEstimateApprovedReleaseAlreadyOnBoard(row)
  );
  const actionableApprovedReleaseBlockedRows = approvedReleaseBlockedRows.filter((row) => row.job?.status === "new");
  const blockedGroupOwnerActionJobIds = actionableApprovedReleaseBlockedRows
    .filter((row) => row.ownerReadiness.isReady)
    .map((row) => row.estimate.jobId);
  const blockedGroupPromiseActionJobIds = actionableApprovedReleaseBlockedRows
    .filter((row) => row.promiseReadiness.isReady)
    .map((row) => row.estimate.jobId);
  const blockedGroupOwnerActionCount = blockedGroupOwnerActionJobIds.length;
  const blockedGroupPromiseActionCount = blockedGroupPromiseActionJobIds.length;
  const blockedGroupOwnerPreblockedCount = approvedReleaseBlockedRows.length - blockedGroupOwnerActionCount;
  const blockedGroupPromisePreblockedCount = approvedReleaseBlockedRows.length - blockedGroupPromiseActionCount;
  const blockedGroupOwnerActionJobIdsValue = serializeIdList(blockedGroupOwnerActionJobIds);
  const blockedGroupPromiseActionJobIdsValue = serializeIdList(blockedGroupPromiseActionJobIds);
  const onBoardGroupActionRows = approvedReleaseAlreadyOnBoardRows.filter((row) => row.dispatchUpdateReadiness.isReady);
  const onBoardGroupActionJobIds = onBoardGroupActionRows.map((row) => row.estimate.jobId);
  const onBoardGroupActionCount = onBoardGroupActionJobIds.length;
  const onBoardGroupPreblockedCount = approvedReleaseAlreadyOnBoardRows.length - onBoardGroupActionCount;
  const onBoardGroupActionJobIdsValue = serializeIdList(onBoardGroupActionJobIds);
  const onBoardGroupLeadJob = approvedReleaseAlreadyOnBoardRows.find((row) => row.job)?.job ?? null;
  const onBoardGroupDispatchHref = onBoardGroupLeadJob
    ? buildEstimateDispatchHref(onBoardGroupLeadJob, context.company.timezone)
    : "/dashboard/dispatch";
  const blockedGroupSelectHref = buildEstimateBulkSelectionHref(
    filters,
    approvedReleaseBlockedRows.map((row) => row.estimate.jobId)
  );
  const blockedGroupReturnHref = buildEstimatesHref(filters, { estimateId: "", jobId: "", selectedJobIds: "" });
  const onBoardGroupReturnHref = buildEstimatesHref(filters, { estimateId: "", jobId: "", selectedJobIds: "" });
  const approvedReleaseRosterGroups = [
    {
      copy: "Owner and promise are locked. Dispatch can take these visits now without another release check.",
      key: "ready",
      label: "Release ready",
      rows: approvedReleaseReadyRows,
      tone: "success" as const
    },
    {
      copy: "Dispatch already owns these visits. The hottest timing gaps rise first so stale live follow-through gets handled before routine on-board work.",
      key: "on_board",
      label: "Already on board",
      rows: approvedReleaseAlreadyOnBoardRows,
      tone: "brand" as const
    },
    {
      copy: "These approved visits still need owner, promise, or intake cleanup before Dispatch should own them.",
      key: "blocked",
      label: "Blocked for release",
      rows: approvedReleaseBlockedRows,
      tone: "warning" as const
    }
  ].filter((group) => group.rows.length > 0);
  const bulkOwnerReadyJobIds = selectedApprovedReleaseRows
    .filter((row) => row.ownerReadiness.isReady)
    .map((row) => row.estimate.jobId);
  const bulkPromiseReadyJobIds = selectedApprovedReleaseRows
    .filter((row) => row.promiseReadiness.isReady)
    .map((row) => row.estimate.jobId);
  const bulkReleaseReadyJobIds = selectedApprovedReleaseRows
    .filter((row) => row.releaseReadiness.isReady)
    .map((row) => row.estimate.jobId);
  const bulkOwnerReadyCount = bulkOwnerReadyJobIds.length;
  const bulkPromiseReadyCount = bulkPromiseReadyJobIds.length;
  const bulkReleaseReadyCount = bulkReleaseReadyJobIds.length;
  const bulkOwnerBlockedCount = selectedApprovedReleaseCount - bulkOwnerReadyCount;
  const bulkPromiseBlockedCount = selectedApprovedReleaseCount - bulkPromiseReadyCount;
  const bulkReleaseBlockedCount = selectedApprovedReleaseCount - bulkReleaseReadyCount;
  const bulkOwnerReadyJobIdsValue = serializeIdList(bulkOwnerReadyJobIds);
  const bulkPromiseReadyJobIdsValue = serializeIdList(bulkPromiseReadyJobIds);
  const bulkReleaseReadyJobIdsValue = serializeIdList(bulkReleaseReadyJobIds);
  const bulkExceptionRows = selectedApprovedReleaseRows.filter(
    (row) =>
      !row.ownerReadiness.isReady ||
      !row.promiseReadiness.isReady ||
      !row.releaseReadiness.isReady
  );
  const companyApprovedReleaseLead = companyApprovedReleaseEstimates[0] ?? null;
  const companyApprovedReleaseRunway =
    companyApprovedReleaseLead && estimateJobsByJobId.get(companyApprovedReleaseLead.jobId)
      ? getEstimateReleaseRunway({
          estimate: companyApprovedReleaseLead,
          job: estimateJobsByJobId.get(companyApprovedReleaseLead.jobId)!,
          timeZone: context.company.timezone
        })
      : null;
  const commandDeck = [
    {
      key: "stale_approval",
      eyebrow: "Critical",
      label: "Approval follow-up",
      copy: companyStaleApprovalEstimates.length
        ? "Overdue approvals are blocking conversion and keeping work off the board."
        : "No stale approvals are currently blocking conversion.",
      count: companyStaleApprovalEstimates.length,
      totalCents: companyStaleApprovalEstimates.reduce((sum, estimate) => sum + estimate.totalCents, 0),
      actionLabel: companyStaleApprovalEstimates.length ? "Chase stale approvals" : "Review queue",
      actionHref: buildVisitsEstimateScopeHref("stale_approval", companyStaleApprovalEstimates[0]?.jobId),
      tone: "danger" as const
    },
    {
      key: "approved_release",
      eyebrow: "Release",
      label: "Ready for visits",
      copy: companyApprovedReleaseEstimates.length
        ? "Approved quotes should move into visit timing and dispatch without another handoff."
        : "Nothing is waiting for release into visits right now.",
      count: companyApprovedReleaseEstimates.length,
      totalCents: companyApprovedReleaseEstimates.reduce((sum, estimate) => sum + estimate.totalCents, 0),
      actionLabel: companyApprovedReleaseEstimates.length
        ? companyApprovedReleaseRunway?.primaryActionLabel ?? "Release approved work"
        : "Open visits",
      actionHref: companyApprovedReleaseEstimates.length
        ? companyApprovedReleaseRunway?.primaryActionHref ??
          buildVisitsEstimateScopeHref("approved_release", companyApprovedReleaseEstimates[0]?.jobId)
        : "/dashboard/visits",
      tone: "success" as const
    },
    {
      key: "drafting",
      eyebrow: "Production",
      label: "Builder throughput",
      copy: companyDraftingEstimates.length
        ? "Finish pricing fast so the queue can convert into approval work."
        : companyAwaitingApprovalEstimates.length
          ? "Pricing is mostly out; stay on live approvals and keep the queue moving."
          : "Builder load is clear and approval work is under control.",
      count: companyDraftingEstimates.length,
      totalCents: companyDraftingEstimates.reduce((sum, estimate) => sum + estimate.totalCents, 0),
      actionLabel: companyDraftingEstimates.length ? "Open estimate work" : "New estimate",
      actionHref: companyDraftingEstimates.length
        ? buildVisitsEstimateScopeHref("drafting", companyDraftingEstimates[0]?.jobId)
        : "/dashboard/visits/new?mode=estimate",
      tone: "brand" as const
    }
  ];
  const visibleDeskSections = estimateDeskSections
    .map((section) => ({
      ...section,
      actionHref: getEstimateDeskSectionHref(filters, section.key),
      estimates: visibleEstimates
        .filter((estimate) => getEstimateThroughputStage(estimate) === section.key)
        .sort((left, right) =>
          compareEstimateThroughputWithPressure(left, right, estimateThreadSummaryByEstimateId)
        )
    }))
    .filter((section) => section.estimates.length > 0);
  const inspectorFocusCommand =
    commandDeck.find((item) => item.count > 0) ??
    (dominantThreadEstimate
      ? {
          actionHref: dominantThreadVisitHref,
          actionLabel: dominantThreadVisitLabel,
          copy: dominantThreadCopy || "Keep the hottest service thread visible from the estimate desk.",
          count: 0,
          eyebrow: "Service thread",
          key: "service_thread",
          label: "Active quote pressure",
          tone: "brand" as const,
          totalCents: dominantThreadEstimate.totalCents
        }
      : null);
  const selectedEstimateReleaseBaseHref = buildEstimateSelectionHref(filters, selectedEstimate);
  const bulkEstimateReturnHref = buildEstimatesHref(filters, { estimateId: "", jobId: "" });
  const clearBulkSelectionHref = buildEstimateBulkSelectionHref(filters, []);
  const selectVisibleApprovedReleaseHref = buildEstimateBulkSelectionHref(
    filters,
    visibleApprovedReleaseEstimates.map((estimate) => estimate.jobId)
  );
  const topFeedback = getEstimateReleaseFeedback(feedbackCode, {
    blockedCount: Number.isFinite(feedbackBlockedCount) ? feedbackBlockedCount : 0,
    count: Number.isFinite(feedbackCount) ? feedbackCount : 0
  });
  const bulkFeedback = feedbackCode.startsWith("bulk-") ? topFeedback : null;

  const renderEstimateRosterEntry = (
    estimate: EstimateSummary,
    approvedReleaseRow?: EstimateBulkSelectionRow | null
  ) => {
    const isSelected = selectedEstimate?.estimateId === estimate.estimateId;
    const timeline = getEstimateCardTimeline(estimate, context.company.timezone);
    const threadSummary = estimateThreadSummaryByEstimateId.get(estimate.estimateId) ?? null;
    const workflowBlocker = workspaceBlockerByJobId.get(estimate.jobId) ?? null;
    const releaseJob = approvedReleaseRow ? approvedReleaseRow.job ?? estimateJobsByJobId.get(estimate.jobId) ?? null : null;
    const quickReleaseRunway =
      approvedReleaseRow?.releaseRunway ??
      (releaseJob
        ? getEstimateReleaseRunway({
            estimate,
            job: releaseJob,
            timeZone: context.company.timezone
          })
        : null);
    const isBulkSelected = selectedJobIdSet.has(estimate.jobId);
    const onBoardFollowThrough =
      approvedReleaseRow && isEstimateApprovedReleaseAlreadyOnBoard(approvedReleaseRow)
        ? onBoardFollowThroughByJobId.get(estimate.jobId) ?? null
        : null;

    return (
      <div
        className={cx(
          "estimate-production-roster__entry",
          isBulkSelected && "estimate-production-roster__entry--bulk-selected"
        )}
        key={estimate.estimateId}
      >
        <Link
          className={cx(
            "estimate-production-roster__row",
            isSelected && "estimate-production-roster__row--selected"
          )}
          href={buildEstimatesHref(filters, {
            estimateId: estimate.estimateId,
            jobId: estimate.jobId
          })}
        >
          <div className="estimate-production-roster__row-main">
            <div className="estimate-production-roster__row-topline">
              <p className="estimate-production-roster__row-eyebrow">{estimate.estimateNumber}</p>
              <div className="estimate-production-roster__row-badges">
                <StatusBadge status={estimate.status} />
                {workflowBlocker?.supplyBlockerCount ? (
                  <Badge tone="warning">{workflowBlocker.supplyBlockerCount} supply blocked</Badge>
                ) : null}
                {!workflowBlocker?.supplyBlockerCount && workflowBlocker?.openPaymentHandoffCount ? (
                  <Badge tone="brand">
                    {workflowBlocker.financeHandoffSummary?.label ??
                      `${workflowBlocker.openPaymentHandoffCount} field handoff${workflowBlocker.openPaymentHandoffCount === 1 ? "" : "s"}`}
                  </Badge>
                ) : null}
              </div>
            </div>
            <h4 className="estimate-production-roster__row-title">{estimate.title}</h4>
            <p className="estimate-production-roster__row-context">
              {getEstimateCustomerLabel(estimate)} · {getEstimateVehicleContext(estimate)}
            </p>
            {workflowBlocker?.financeHandoffSummary && !workflowBlocker.supplyBlockerCount ? (
              <p className="estimate-production-roster__row-meta">
                {workflowBlocker.financeHandoffSummary.copy}
              </p>
            ) : null}
          </div>
          <div className="estimate-production-roster__row-side">
            <span className="estimate-production-roster__row-next">
              {getEstimateThreadNextStepLabel(estimate, threadSummary)}
              {threadSummary ? ` · ${threadSummary.label}` : ""}
            </span>
            <strong className="estimate-production-roster__row-value">
              {formatCurrencyFromCents(estimate.totalCents)}
            </strong>
            <span className="estimate-production-roster__row-meta">
              {timeline.label} {timeline.value}
            </span>
          </div>
        </Link>

        {context.canEditRecords && quickReleaseRunway ? (
          <div className="estimate-production-roster__quick-release">
            <div className="estimate-production-roster__quick-release-summary">
              <Badge tone={getVisitWorkflowTone(quickReleaseRunway.workflowState)}>
                {getVisitWorkflowLabel(quickReleaseRunway.workflowState)}
              </Badge>
              <span>Owner: {quickReleaseRunway.ownerLabel}</span>
              <span>Promise: {quickReleaseRunway.promiseLabel}</span>
              <Link
                className="estimate-production-roster__quick-release-toggle"
                href={buildEstimateBulkSelectionToggleHref(filters, selectedJobIds, estimate.jobId)}
              >
                {isBulkSelected ? "Selected for bulk" : "Select for bulk"}
              </Link>
            </div>

            <div className="estimate-production-roster__quick-release-grid">
              <form action={saveEstimateReleaseOwnerAction} className="estimate-production-roster__quick-form">
                <input name="jobId" type="hidden" value={estimate.jobId} />
                <input name="returnTo" type="hidden" value={queueReturnHref} />
                <label className="estimate-production-roster__quick-field">
                  <span>Owner</span>
                  <Select defaultValue={releaseJob?.assignedTechnicianUserId ?? ""} name="assignedTechnicianUserId">
                    <option value="">Unassigned</option>
                    {assignableTechnicians.map((technician) => (
                      <option key={technician.userId} value={technician.userId}>
                        {technician.displayName}
                      </option>
                    ))}
                  </Select>
                </label>
                <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                  Save owner
                </button>
              </form>

              <form action={saveEstimateReleasePromiseAction} className="estimate-production-roster__quick-form">
                <input name="jobId" type="hidden" value={estimate.jobId} />
                <input name="returnTo" type="hidden" value={queueReturnHref} />
                <label className="estimate-production-roster__quick-field">
                  <span>Promise</span>
                  <Input
                    defaultValue={toLocalDateTimeInput(releaseJob?.scheduledStartAt ?? releaseJob?.arrivalWindowStartAt ?? null)}
                    name="scheduledStartAt"
                    type="datetime-local"
                  />
                </label>
                <div className="estimate-production-roster__quick-actions">
                  <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                    Save promise
                  </button>
                  <button
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    name="clearSchedule"
                    type="submit"
                    value="1"
                  >
                    Clear
                  </button>
                </div>
              </form>

              {onBoardFollowThrough ? (
                <div className="estimate-production-roster__quick-form estimate-production-roster__quick-form--live">
                  <div className="estimate-production-roster__quick-field">
                    <span>Follow-through</span>
                    <div className="estimate-production-roster__live-signal">
                      <Badge tone={onBoardFollowThrough.tone}>{onBoardFollowThrough.label}</Badge>
                      <strong>{onBoardFollowThrough.lastOutboundAgeLabel}</strong>
                    </div>
                  </div>
                  <p className="estimate-production-roster__live-copy">{onBoardFollowThrough.copy}</p>
                  <div className="estimate-production-roster__live-meta">
                    <span>Last customer update</span>
                    <strong>{onBoardFollowThrough.lastCustomerUpdateLabel}</strong>
                  </div>
                  <div className="estimate-production-roster__quick-actions">
                    {onBoardFollowThrough.updateType && onBoardFollowThrough.updateActionLabel ? (
                      <form action={queueEstimateBulkDispatchUpdateAction}>
                        <input name="preblockedCount" type="hidden" value="0" />
                        <input name="returnTo" type="hidden" value={queueReturnHref} />
                        <input name="selectedJobIds" type="hidden" value={estimate.jobId} />
                        <button className={buttonClassName({ size: "sm" })} type="submit">
                          {onBoardFollowThrough.updateActionLabel}
                        </button>
                      </form>
                    ) : null}
                    <Link
                      className={buttonClassName({ size: "sm", tone: "tertiary" })}
                      href={onBoardFollowThrough.dispatchHref}
                    >
                      Open dispatch drawer
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="estimate-production-roster__quick-form">
                  <div className="estimate-production-roster__quick-field">
                    <span>Dispatch</span>
                    <strong>{quickReleaseRunway.label}</strong>
                  </div>
                  {quickReleaseRunway.workflowState === "ready_to_dispatch" ? (
                    <form action={releaseEstimateToDispatchAction}>
                      <input name="jobId" type="hidden" value={estimate.jobId} />
                      <input name="returnTo" type="hidden" value={queueReturnHref} />
                      <button className={buttonClassName({ size: "sm" })} type="submit">
                        Release
                      </button>
                    </form>
                  ) : (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "tertiary" })}
                      href={quickReleaseRunway.primaryActionHref}
                    >
                      Open dispatch
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  async function saveEstimateReleaseOwnerAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getFormString(formData, "jobId");
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const latestVisitResult = await getJobById(actionContext.supabase, jobId);

    if (
      !jobId ||
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      !latestVisitResult.data.isActive
    ) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-owner-failed"));
    }

    const result = await assignVisitTechnician(actionContext.supabase, jobId, {
      assignedTechnicianUserId: getNullableFormString(formData, "assignedTechnicianUserId")
    });

    if (result.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-owner-failed"));
    }

    if (result.data) {
      await sendTechnicianJobPushNotification({
        companyId: actionContext.companyId,
        companyTimeZone: actionContext.company.timezone,
        nextJob: result.data,
        previousJob: latestVisitResult.data
      }).catch(() => undefined);
    }

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(appendEstimateFeedbackHref(returnHref, "release-owner-saved"));
  }

  async function saveEstimateBulkOwnerAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const preblockedCount = Math.max(0, Number.parseInt(getFormString(formData, "preblockedCount"), 10) || 0);
    const selectedBulkJobIds = parseSearchParamIdList(getFormString(formData, "selectedJobIds"));

    if (!selectedBulkJobIds.length) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-owner-failed"));
    }

    const jobsResult = await actionContext.supabase
      .from("jobs")
      .select("*")
      .eq("company_id", actionContext.companyId)
      .in("id", selectedBulkJobIds)
      .returns<EstimateBulkJobRow[]>();

    if (jobsResult.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-owner-failed"));
    }

    const assignableJobs = (jobsResult.data ?? []).filter((job) => job.is_active);
    const assignedTechnicianUserId = getNullableFormString(formData, "assignedTechnicianUserId");
    const results = await Promise.all(
      assignableJobs.map((job) =>
        assignVisitTechnician(actionContext.supabase, job.id, {
          assignedTechnicianUserId
        })
      )
    );
    await Promise.all(
      results.map((result, index) =>
        result.data
          ? sendTechnicianJobPushNotification({
              companyId: actionContext.companyId,
              companyTimeZone: actionContext.company.timezone,
              nextJob: result.data,
              previousJob: assignableJobs[index]!
            }).catch(() => undefined)
          : Promise.resolve()
      )
    );
    const successCount = results.filter((result) => !result.error).length;
    const blockedCount = preblockedCount + (selectedBulkJobIds.length - successCount);
    const feedback =
      successCount === 0
        ? "bulk-owner-failed"
        : blockedCount
          ? "bulk-owner-partial"
          : "bulk-owner-saved";

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    redirect(
      appendEstimateFeedbackHref(returnHref, feedback, {
        blockedCount,
        count: successCount
      })
    );
  }

  async function saveEstimateReleasePromiseAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getFormString(formData, "jobId");
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const latestVisitResult = await getJobById(actionContext.supabase, jobId);

    if (
      !jobId ||
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      !latestVisitResult.data.isActive
    ) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-promise-failed"));
    }

    const latestVisit = latestVisitResult.data;
    const clearSchedule = getFormString(formData, "clearSchedule") === "1";
    const scheduledStartAt = clearSchedule ? null : getNullableFormString(formData, "scheduledStartAt");
    const arrivalWindowStartAt = clearSchedule ? null : getNullableFormString(formData, "arrivalWindowStartAt");
    const arrivalWindowEndAt = clearSchedule ? null : getNullableFormString(formData, "arrivalWindowEndAt");
    const useArrivalWindow = Boolean(arrivalWindowStartAt || arrivalWindowEndAt) && !scheduledStartAt;
    const result = await updateJob(actionContext.supabase, jobId, {
      assignedTechnicianUserId: latestVisit.assignedTechnicianUserId,
      arrivalWindowEndAt: useArrivalWindow ? arrivalWindowEndAt : null,
      arrivalWindowStartAt: useArrivalWindow ? arrivalWindowStartAt : null,
      customerConcern: latestVisit.customerConcern,
      customerId: latestVisit.customerId,
      description: latestVisit.description,
      internalSummary: latestVisit.internalSummary,
      isActive: latestVisit.isActive,
      priority: latestVisit.priority,
      scheduledEndAt: null,
      scheduledStartAt: useArrivalWindow ? null : scheduledStartAt,
      serviceSiteId: latestVisit.serviceSiteId,
      source: latestVisit.source,
      title: latestVisit.title,
      vehicleId: latestVisit.vehicleId
    });

    if (result.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-promise-failed"));
    }

    if (result.data) {
      await sendTechnicianJobPushNotification({
        companyId: actionContext.companyId,
        companyTimeZone: actionContext.company.timezone,
        nextJob: result.data,
        previousJob: latestVisit
      }).catch(() => undefined);
    }

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(appendEstimateFeedbackHref(returnHref, "release-promise-saved"));
  }

  async function saveEstimateBulkPromiseAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const preblockedCount = Math.max(0, Number.parseInt(getFormString(formData, "preblockedCount"), 10) || 0);
    const selectedBulkJobIds = parseSearchParamIdList(getFormString(formData, "selectedJobIds"));

    if (!selectedBulkJobIds.length) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-promise-failed"));
    }

    const jobsResult = await actionContext.supabase
      .from("jobs")
      .select("*")
      .eq("company_id", actionContext.companyId)
      .in("id", selectedBulkJobIds)
      .returns<EstimateBulkJobRow[]>();

    if (jobsResult.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-promise-failed"));
    }

    const assignableJobs = (jobsResult.data ?? []).filter((job) => job.is_active);
    const clearSchedule = getFormString(formData, "clearSchedule") === "1";
    const scheduledStartAt = clearSchedule ? null : getNullableFormString(formData, "scheduledStartAt");
    const arrivalWindowStartAt = clearSchedule ? null : getNullableFormString(formData, "arrivalWindowStartAt");
    const arrivalWindowEndAt = clearSchedule ? null : getNullableFormString(formData, "arrivalWindowEndAt");
    const useArrivalWindow = Boolean(arrivalWindowStartAt || arrivalWindowEndAt) && !scheduledStartAt;
    const results = await Promise.all(
      assignableJobs.map((job) =>
        updateJob(actionContext.supabase, job.id, {
          assignedTechnicianUserId: job.assigned_technician_user_id,
          arrivalWindowEndAt: useArrivalWindow ? arrivalWindowEndAt : null,
          arrivalWindowStartAt: useArrivalWindow ? arrivalWindowStartAt : null,
          customerConcern: job.customer_concern,
          customerId: job.customer_id,
          description: job.description,
          internalSummary: job.internal_summary,
          isActive: job.is_active,
          priority: job.priority as Job["priority"],
          scheduledEndAt: null,
          scheduledStartAt: useArrivalWindow ? null : scheduledStartAt,
          serviceSiteId: job.service_site_id,
          source: job.source as Job["source"],
          title: job.title,
          vehicleId: job.vehicle_id
        })
      )
    );
    await Promise.all(
      results.map((result, index) =>
        result.data
          ? sendTechnicianJobPushNotification({
              companyId: actionContext.companyId,
              companyTimeZone: actionContext.company.timezone,
              nextJob: result.data,
              previousJob: assignableJobs[index]!
            }).catch(() => undefined)
          : Promise.resolve()
      )
    );
    const successCount = results.filter((result) => !result.error).length;
    const blockedCount = preblockedCount + (selectedBulkJobIds.length - successCount);
    const feedback =
      successCount === 0
        ? "bulk-promise-failed"
        : blockedCount
          ? "bulk-promise-partial"
          : "bulk-promise-saved";

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    redirect(
      appendEstimateFeedbackHref(returnHref, feedback, {
        blockedCount,
        count: successCount
      })
    );
  }

  async function resolveEstimatePaymentHandoffAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getFormString(formData, "jobId");
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const resolutionDispositionValue = getFormString(formData, "resolutionDisposition");
    const resolutionNoteValue = getNullableFormString(formData, "resolutionNote");
    const latestVisitResult = await getJobById(actionContext.supabase, jobId);

    if (
      !jobId ||
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId
    ) {
      redirect(returnHref);
    }

    const invoiceResult = await getInvoiceByJobId(actionContext.supabase, jobId);

    if (invoiceResult.error || !invoiceResult.data) {
      redirect(returnHref);
    }

    if (!isTechnicianPaymentResolutionDisposition(resolutionDispositionValue)) {
      redirect(returnHref);
    }

    const parsedResolutionInput = resolveTechnicianPaymentHandoffInputSchema.safeParse({
      resolutionDisposition: resolutionDispositionValue,
      resolutionNote: resolutionNoteValue
    });

    if (!parsedResolutionInput.success) {
      redirect(returnHref);
    }

    await resolveOpenTechnicianPaymentHandoffsByInvoiceId(
      actionContext.supabase as any,
      invoiceResult.data.id,
      actionContext.currentUserId,
      parsedResolutionInput.data
    );

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(returnHref);
  }

  async function releaseEstimateToDispatchAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getFormString(formData, "jobId");
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const latestVisitResult = await getJobById(actionContext.supabase, jobId);

    if (
      !jobId ||
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      !latestVisitResult.data.isActive
    ) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-dispatch-failed"));
    }

    const latestVisit = latestVisitResult.data;

    if (latestVisit.status !== "new" && latestVisit.status !== "scheduled") {
      redirect(appendEstimateFeedbackHref(returnHref, "release-dispatch-failed"));
    }

    const result =
      latestVisit.status === "scheduled"
        ? { error: null }
        : await changeVisitStatus(actionContext.supabase, jobId, {
            reason: "Released from estimate desk",
            toStatus: "scheduled" as JobStatus
          });

    if (result.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "release-dispatch-failed"));
    }

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(appendEstimateFeedbackHref(returnHref, "release-dispatch-saved"));
  }

  async function releaseEstimateBulkToDispatchAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const preblockedCount = Math.max(0, Number.parseInt(getFormString(formData, "preblockedCount"), 10) || 0);
    const selectedBulkJobIds = parseSearchParamIdList(getFormString(formData, "selectedJobIds"));

    if (!selectedBulkJobIds.length) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-release-failed"));
    }

    const jobsResult = await actionContext.supabase
      .from("jobs")
      .select("*")
      .eq("company_id", actionContext.companyId)
      .in("id", selectedBulkJobIds)
      .returns<EstimateBulkJobRow[]>();

    if (jobsResult.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-release-failed"));
    }

    const activeJobs = (jobsResult.data ?? []).filter((job) => job.is_active);
    let successCount = 0;

    for (const job of activeJobs) {
      if (job.status === "scheduled") {
        successCount += 1;
        continue;
      }

      if (job.status !== "new") {
        continue;
      }

      const result = await changeVisitStatus(actionContext.supabase, job.id, {
        reason: "Released from estimate desk bulk queue",
        toStatus: "scheduled" as JobStatus
      });

      if (!result.error) {
        successCount += 1;
      }
    }

    const blockedCount = preblockedCount + (selectedBulkJobIds.length - successCount);
    const feedback =
      successCount === 0
        ? "bulk-release-failed"
        : blockedCount
          ? "bulk-release-partial"
          : "bulk-release-saved";

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    redirect(
      appendEstimateFeedbackHref(returnHref, feedback, {
        blockedCount,
        count: successCount
      })
    );
  }

  async function queueEstimateBulkDispatchUpdateAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const returnHref = normalizeEstimateReturnTo(getFormString(formData, "returnTo"));
    const preblockedCount = Math.max(0, Number.parseInt(getFormString(formData, "preblockedCount"), 10) || 0);
    const selectedBulkJobIds = parseSearchParamIdList(getFormString(formData, "selectedJobIds"));

    if (!selectedBulkJobIds.length) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-dispatch-update-failed"));
    }

    const jobsResult = await actionContext.supabase
      .from("jobs")
      .select("*")
      .eq("company_id", actionContext.companyId)
      .in("id", selectedBulkJobIds)
      .returns<EstimateBulkJobRow[]>();

    if (jobsResult.error) {
      redirect(appendEstimateFeedbackHref(returnHref, "bulk-dispatch-update-failed"));
    }

    const activeJobs = (jobsResult.data ?? []).filter((job) => job.is_active);
    let successCount = 0;

    for (const job of activeJobs) {
      const readiness = getEstimateBulkDispatchUpdateReadiness({
        arrivalWindowStartAt: job.arrival_window_start_at,
        assignedTechnicianUserId: job.assigned_technician_user_id,
        id: job.id,
        isActive: job.is_active,
        scheduledStartAt: job.scheduled_start_at,
        status: job.status as JobStatus
      });

      if (!readiness.isReady || !readiness.updateType) {
        continue;
      }

      try {
        const preview = await getTechnicianProfilePreview(
          actionContext.supabase,
          job.assigned_technician_user_id
        );
        const visitLink = preview.isReady
          ? await ensureVisitAccessLink({
              actorUserId: actionContext.currentUserId,
              jobId: job.id
            })
          : null;
        const result = await enqueueVisitDispatchUpdate(actionContext.supabase, {
          actorUserId: actionContext.currentUserId,
          jobId: job.id,
          resend: true,
          updateType: readiness.updateType,
          visitUrl: visitLink?.publicUrl ?? null
        });

        if (result.error || !result.data) {
          continue;
        }

        const communication = await processCommunicationMutationResult(
          result,
          "Failed to queue dispatch update."
        );

        if (visitLink) {
          await markVisitAccessLinkSent(
            visitLink.linkId,
            communication.id,
            actionContext.currentUserId
          );
        }

        successCount += 1;
      } catch {
        continue;
      }
    }

    const blockedCount = preblockedCount + (selectedBulkJobIds.length - successCount);
    const feedback =
      successCount === 0
        ? "bulk-dispatch-update-failed"
        : blockedCount
          ? "bulk-dispatch-update-partial"
          : "bulk-dispatch-update-saved";

    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    redirect(
      appendEstimateFeedbackHref(returnHref, feedback, {
        blockedCount,
        count: successCount
      })
    );
  }

  return (
    <Page
      className={cx(
        "ops-hub estimate-production-page",
        isCompactView && "estimate-production-page--compact",
        isListView && "estimate-production-page--list"
      )}
      layout="command"
    >
      <PageHeader
        compact
        title="Visit approval support"
        actions={
          <div className="ops-hub__header-actions">
            {dominantThreadEstimate ? (
              <Link className={buttonClassName()} href={dominantThreadVisitHref}>
                {dominantThreadVisitLabel}
              </Link>
            ) : (
              <Link className={buttonClassName()} href="/dashboard/visits">
                Return to visits
              </Link>
            )}
            {context.canEditRecords ? (
              <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits/new?mode=estimate">
                Start in visits
              </Link>
            ) : null}
          </div>
        }
      />

      <section aria-label="Visit approval support controls" className="estimate-production-toolbar">
        <div className="estimate-production-toolbar__summary">
          <p className="estimate-production-toolbar__summary-copy">
            {dominantThreadCopy || toolbarSummary}
          </p>
          {showEstimateToolbarMetrics ? (
            <div className="estimate-production-toolbar__summary-metrics">
              {visibleEstimateToolbarMetrics.map((metric) => (
                <span
                  className={cx(
                    "estimate-production-toolbar__summary-chip",
                    metric.tone === "success" && "estimate-production-toolbar__summary-chip--success",
                    metric.tone === "value" && "estimate-production-toolbar__summary-chip--value",
                    metric.tone === "warning" && "estimate-production-toolbar__summary-chip--warning"
                  )}
                  key={metric.key}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="estimate-production-toolbar__controls">
          {showEstimateViewSwitch ? (
            <nav aria-label="Estimate layout" className="estimate-production-view-switch">
              <Link
                aria-current={isCompactView ? "page" : undefined}
                className={cx(
                  "estimate-production-view-switch__item",
                  isCompactView && "estimate-production-view-switch__item--active"
                )}
                href={compactViewHref}
              >
                Queue
              </Link>
              <Link
                aria-current={isListView ? "page" : undefined}
                className={cx(
                  "estimate-production-view-switch__item",
                  isListView && "estimate-production-view-switch__item--active"
                )}
                href={listViewHref}
              >
                Dense list
              </Link>
            </nav>
          ) : null}

          <details className="estimate-production-toolbar__queue-panel" open={filtersApplied}>
            <summary className="estimate-production-toolbar__queue-panel-summary">
              <span className="estimate-production-toolbar__queue-panel-copy">
                <strong>Filters</strong>
                <small>{estimateQueuePanelSummary}</small>
              </span>
              {filtersApplied ? (
                <span className="estimate-production-toolbar__queue-panel-state">Live filters</span>
              ) : null}
              <span className="estimate-production-toolbar__queue-panel-indicator" aria-hidden="true" />
            </summary>
            <Form className="estimate-production-toolbar__form" method="get">
              {selectedEstimate ? <input name="estimateId" type="hidden" value={selectedEstimate.estimateId} /> : null}
              {selectedEstimate ? <input name="jobId" type="hidden" value={selectedEstimate.jobId} /> : null}
              <input name="view" type="hidden" value={filters.view} />
              <FormField label="Search">
                <Input defaultValue={filters.query} name="query" placeholder="Estimate, customer, vehicle, or note" type="search" />
              </FormField>
              <FormField label="Queue">
                <Select defaultValue={filters.stage} name="stage">
                  <option value="">All live + closed</option>
                  <option value="stale_approval">Stale approvals</option>
                  <option value="approved_release">Approved to release</option>
                  <option value="awaiting_approval">Awaiting approval</option>
                  <option value="drafting">Builder in progress</option>
                  <option value="closed">Closed</option>
                </Select>
              </FormField>
              <div className="estimate-production-toolbar__actions">
                <button className={buttonClassName({ size: "sm" })} type="submit">Apply</button>
                {filtersApplied ? (
                  <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={clearFiltersHref}>
                    Clear
                  </Link>
                ) : null}
              </div>
            </Form>
          </details>
        </div>
      </section>

      {bulkFeedback ? (
        <Callout tone={bulkFeedback.tone} title={bulkFeedback.title}>
          {bulkFeedback.body}
        </Callout>
      ) : null}

      {selectedApprovedReleaseCount ? (
        <section className="estimate-production-bulk-bar" aria-label="Approved release bulk actions">
          <Card padding="base" tone="raised">
            <CardContent className="estimate-production-bulk-bar__content">
              <div className="estimate-production-bulk-bar__header">
                <div>
                  <p className="estimate-production-bulk-bar__eyebrow">Bulk release</p>
                  <h2 className="estimate-production-bulk-bar__title">
                    {pluralizeLabel(selectedApprovedReleaseCount, "approved visit")} selected
                  </h2>
                  <p className="estimate-production-bulk-bar__copy">
                    Apply shared owner, promise, or dispatch release actions to the selected approved queue.
                  </p>
                </div>
                <div className="estimate-production-bulk-bar__header-actions">
                  <Badge tone="success">{selectedApprovedReleaseCount}</Badge>
                  <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={clearBulkSelectionHref}>
                    Clear selection
                  </Link>
                </div>
              </div>

              <div className="estimate-production-bulk-bar__metrics" aria-label="Bulk action readiness">
                <div className="estimate-production-bulk-bar__metric">
                  <span>Owner ready</span>
                  <strong>{pluralizeLabel(bulkOwnerReadyCount, "visit")}</strong>
                  <small>{pluralizeLabel(bulkOwnerBlockedCount, "visit")} blocked</small>
                </div>
                <div className="estimate-production-bulk-bar__metric">
                  <span>Promise ready</span>
                  <strong>{pluralizeLabel(bulkPromiseReadyCount, "visit")}</strong>
                  <small>{pluralizeLabel(bulkPromiseBlockedCount, "visit")} blocked</small>
                </div>
                <div className="estimate-production-bulk-bar__metric">
                  <span>Release ready</span>
                  <strong>{pluralizeLabel(bulkReleaseReadyCount, "visit")}</strong>
                  <small>{pluralizeLabel(bulkReleaseBlockedCount, "visit")} blocked</small>
                </div>
              </div>

              <div className="estimate-production-bulk-bar__grid">
                <form action={saveEstimateBulkOwnerAction} className="estimate-production-bulk-bar__form">
                  <input name="returnTo" type="hidden" value={bulkEstimateReturnHref} />
                  <input name="preblockedCount" type="hidden" value={String(bulkOwnerBlockedCount)} />
                  <input name="selectedJobIds" type="hidden" value={bulkOwnerReadyJobIdsValue} />
                  <FormField label="Dispatch owner">
                    <Select defaultValue="" disabled={!bulkOwnerReadyCount} name="assignedTechnicianUserId">
                      <option value="">Unassigned</option>
                      {assignableTechnicians.map((technician) => (
                        <option key={technician.userId} value={technician.userId}>
                          {technician.displayName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <p className="estimate-production-bulk-bar__form-copy">
                    {bulkOwnerReadyCount
                      ? `${pluralizeLabel(bulkOwnerReadyCount, "visit")} can take the same owner now.`
                      : "No selected visits can take an owner update from this queue."}
                  </p>
                  <button
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    disabled={!bulkOwnerReadyCount}
                    type="submit"
                  >
                    Apply owner to selected
                  </button>
                </form>

                <form action={saveEstimateBulkPromiseAction} className="estimate-production-bulk-bar__form">
                  <input name="returnTo" type="hidden" value={bulkEstimateReturnHref} />
                  <input name="preblockedCount" type="hidden" value={String(bulkPromiseBlockedCount)} />
                  <input name="selectedJobIds" type="hidden" value={bulkPromiseReadyJobIdsValue} />
                  <FormField label="Specific promise">
                    <Input disabled={!bulkPromiseReadyCount} name="scheduledStartAt" type="datetime-local" />
                  </FormField>
                  <p className="estimate-production-bulk-bar__form-copy">
                    {bulkPromiseReadyCount
                      ? `${pluralizeLabel(bulkPromiseReadyCount, "visit")} can take the same promise window now.`
                      : "No selected visits can take a shared promise from this queue."}
                  </p>
                  <div className="estimate-production-bulk-bar__form-actions">
                    <button
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      disabled={!bulkPromiseReadyCount}
                      type="submit"
                    >
                      Apply promise to selected
                    </button>
                    <button
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      disabled={!bulkPromiseReadyCount}
                      name="clearSchedule"
                      type="submit"
                      value="1"
                    >
                      Clear promise
                    </button>
                  </div>
                </form>

                <form action={releaseEstimateBulkToDispatchAction} className="estimate-production-bulk-bar__form">
                  <input name="returnTo" type="hidden" value={bulkEstimateReturnHref} />
                  <input name="preblockedCount" type="hidden" value={String(bulkReleaseBlockedCount)} />
                  <input name="selectedJobIds" type="hidden" value={bulkReleaseReadyJobIdsValue} />
                  <p className="estimate-production-bulk-bar__release-copy">
                    Release the selected approved visits into Dispatch without opening each estimate thread.
                  </p>
                  <p className="estimate-production-bulk-bar__form-copy">
                    {bulkReleaseReadyCount
                      ? `${pluralizeLabel(bulkReleaseReadyCount, "visit")} are truly release-ready right now.`
                      : "No selected visits are ready for Dispatch release yet."}
                  </p>
                  <button className={buttonClassName({ size: "sm" })} disabled={!bulkReleaseReadyCount} type="submit">
                    Release selected to dispatch
                  </button>
                </form>
              </div>

              {bulkExceptionRows.length ? (
                <div className="estimate-production-bulk-bar__exceptions" aria-label="Bulk action exceptions">
                  <div className="estimate-production-bulk-bar__exceptions-header">
                    <div>
                      <p className="estimate-production-bulk-bar__eyebrow">Exceptions</p>
                      <h3 className="estimate-production-bulk-bar__exceptions-title">
                        Drop blocked visits before applying shared actions
                      </h3>
                    </div>
                    <Badge tone="warning">{bulkExceptionRows.length}</Badge>
                  </div>

                  <div className="estimate-production-bulk-bar__exception-list">
                    {bulkExceptionRows.map((row) => {
                      const blockedNotes = [
                        !row.ownerReadiness.isReady && row.ownerReadiness.blockedReason
                          ? `Owner: ${row.ownerReadiness.blockedReason}`
                          : null,
                        !row.promiseReadiness.isReady && row.promiseReadiness.blockedReason
                          ? `Promise: ${row.promiseReadiness.blockedReason}`
                          : null,
                        !row.releaseReadiness.isReady && row.releaseReadiness.blockedReason
                          ? `Release: ${row.releaseReadiness.blockedReason}`
                          : null
                      ].filter(Boolean) as string[];

                      return (
                        <div className="estimate-production-bulk-bar__exception" key={row.estimate.estimateId}>
                          <div className="estimate-production-bulk-bar__exception-main">
                            <div>
                              <p className="estimate-production-bulk-bar__exception-title">
                                {row.estimate.estimateNumber} · {row.estimate.title}
                              </p>
                              <p className="estimate-production-bulk-bar__exception-context">
                                {getEstimateCustomerLabel(row.estimate)} · {getEstimateVehicleContext(row.estimate)}
                              </p>
                            </div>
                            <div className="estimate-production-bulk-bar__exception-notes">
                              {blockedNotes.map((note) => (
                                <span key={note}>{note}</span>
                              ))}
                            </div>
                          </div>
                          <div className="estimate-production-bulk-bar__exception-actions">
                            <Link
                              className={buttonClassName({ size: "sm", tone: "tertiary" })}
                              href={buildEstimateBulkSelectionToggleHref(filters, selectedJobIds, row.estimate.jobId)}
                            >
                              Drop from selection
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="estimate-production-layout">
        <div className="estimate-production-workspace">
          <div className="estimate-production-board">
            {visibleEstimates.length ? (
              <>
                {isCompactView ? (
                  <div className="estimate-production-roster">
                    {visibleDeskSections.map((section) => {
                      const sectionTotal = section.estimates.reduce((sum, estimate) => sum + estimate.totalCents, 0);

                      return (
                        <Card
                          className={cx(
                            "estimate-production-roster__section",
                            `estimate-production-roster__section--${section.key}`
                          )}
                          key={section.key}
                          padding="base"
                          tone="raised"
                        >
                          <CardContent className="estimate-production-roster__section-content">
                            <div className="estimate-production-roster__section-header">
                              <div>
                                <p className="estimate-production-roster__section-eyebrow">{section.eyebrow}</p>
                                <h3 className="estimate-production-roster__section-title">{section.label}</h3>
                                <p className="estimate-production-roster__section-copy">{section.copy}</p>
                              </div>
                              <div className="estimate-production-roster__section-side">
                                <Badge tone={section.tone}>{section.estimates.length}</Badge>
                                <Link className="estimate-production-roster__section-link" href={section.actionHref}>
                                  {section.actionLabel}
                                </Link>
                                {section.key === "approved_release" ? (
                                  <>
                                    <Link className="estimate-production-roster__section-link" href={selectVisibleApprovedReleaseHref}>
                                      Select visible
                                    </Link>
                                    {selectedApprovedReleaseCount ? (
                                      <Link className="estimate-production-roster__section-link" href={clearBulkSelectionHref}>
                                        Clear selected
                                      </Link>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="estimate-production-roster__section-strip">
                              <div className="estimate-production-roster__section-metric">
                                <span>Queue value</span>
                                <strong>{formatCurrencyFromCents(sectionTotal)}</strong>
                              </div>
                              <div className="estimate-production-roster__section-metric">
                                <span>Next move</span>
                                <strong>{section.focusLabel}</strong>
                              </div>
                            </div>

                            {section.key === "approved_release" ? (
                              <div className="estimate-production-roster__groups">
                                {approvedReleaseRosterGroups.map((group) => (
                                  <section
                                    className={cx(
                                      "estimate-production-roster__group",
                                      `estimate-production-roster__group--${group.key}`
                                    )}
                                    key={group.key}
                                  >
                                    <div className="estimate-production-roster__group-header">
                                      <div>
                                        <p className="estimate-production-roster__group-eyebrow">Dispatch runway</p>
                                        <h4 className="estimate-production-roster__group-title">{group.label}</h4>
                                        <p className="estimate-production-roster__group-copy">{group.copy}</p>
                                      </div>
                                      <div className="estimate-production-roster__group-side">
                                        <Badge tone={group.tone}>{group.rows.length}</Badge>
                                        {group.key === "blocked" ? (
                                          <div className="estimate-production-roster__group-actions">
                                            <Link
                                              className={buttonClassName({ size: "sm", tone: "tertiary" })}
                                              href={blockedGroupSelectHref}
                                            >
                                              Select blocked
                                            </Link>

                                            <form
                                              action={saveEstimateBulkOwnerAction}
                                              className="estimate-production-roster__group-form"
                                            >
                                              <input name="returnTo" type="hidden" value={blockedGroupReturnHref} />
                                              <input
                                                name="preblockedCount"
                                                type="hidden"
                                                value={String(blockedGroupOwnerPreblockedCount)}
                                              />
                                              <input
                                                name="selectedJobIds"
                                                type="hidden"
                                                value={blockedGroupOwnerActionJobIdsValue}
                                              />
                                              <label className="estimate-production-roster__group-field">
                                                <span>Assign owner</span>
                                                <Select
                                                  defaultValue=""
                                                  disabled={!blockedGroupOwnerActionCount}
                                                  name="assignedTechnicianUserId"
                                                >
                                                  <option value="">Unassigned</option>
                                                  {assignableTechnicians.map((technician) => (
                                                    <option key={technician.userId} value={technician.userId}>
                                                      {technician.displayName}
                                                    </option>
                                                  ))}
                                                </Select>
                                              </label>
                                              <button
                                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                                disabled={!blockedGroupOwnerActionCount}
                                                type="submit"
                                              >
                                                Apply owner to blocked
                                              </button>
                                            </form>

                                            <form
                                              action={saveEstimateBulkPromiseAction}
                                              className="estimate-production-roster__group-form"
                                            >
                                              <input name="returnTo" type="hidden" value={blockedGroupReturnHref} />
                                              <input
                                                name="preblockedCount"
                                                type="hidden"
                                                value={String(blockedGroupPromisePreblockedCount)}
                                              />
                                              <input
                                                name="selectedJobIds"
                                                type="hidden"
                                                value={blockedGroupPromiseActionJobIdsValue}
                                              />
                                              <label className="estimate-production-roster__group-field">
                                                <span>Set promise</span>
                                                <Input
                                                  disabled={!blockedGroupPromiseActionCount}
                                                  name="scheduledStartAt"
                                                  type="datetime-local"
                                                />
                                              </label>
                                              <button
                                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                                disabled={!blockedGroupPromiseActionCount}
                                                type="submit"
                                              >
                                                Apply promise to blocked
                                              </button>
                                            </form>
                                          </div>
                                        ) : group.key === "on_board" ? (
                                          <div className="estimate-production-roster__group-actions">
                                            <Link
                                              className={buttonClassName({ size: "sm", tone: "tertiary" })}
                                              href={onBoardGroupDispatchHref}
                                            >
                                              Open in Dispatch
                                            </Link>

                                            <form action={queueEstimateBulkDispatchUpdateAction}>
                                              <input name="returnTo" type="hidden" value={onBoardGroupReturnHref} />
                                              <input
                                                name="preblockedCount"
                                                type="hidden"
                                                value={String(onBoardGroupPreblockedCount)}
                                              />
                                              <input
                                                name="selectedJobIds"
                                                type="hidden"
                                                value={onBoardGroupActionJobIdsValue}
                                              />
                                              <button
                                                className={buttonClassName({ size: "sm", tone: "secondary" })}
                                                disabled={!onBoardGroupActionCount}
                                                type="submit"
                                              >
                                                Send timing updates
                                              </button>
                                            </form>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="estimate-production-roster__list">
                                      {group.rows.map((row) => renderEstimateRosterEntry(row.estimate, row))}
                                    </div>
                                  </section>
                                ))}
                              </div>
                            ) : (
                              <div className="estimate-production-roster__list">
                                {section.estimates.map((estimate) =>
                                  renderEstimateRosterEntry(
                                    estimate,
                                    visibleApprovedReleaseRowsByEstimateId.get(estimate.estimateId) ?? null
                                  )
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : isListView ? (
                <Card className="estimate-production-list" padding="base" tone="raised">
                  <CardContent className="estimate-production-list__content">
                    <div className="estimate-production-list__header">
                      <div>
                        <p className="estimate-production-list__eyebrow">Support queue</p>
                        <h3 className="estimate-production-list__title">Approval + release scan</h3>
                        <p className="estimate-production-list__copy">High-density scan for stale approvals, approved release, and builder exceptions.</p>
                      </div>
                      <Badge tone="brand">{activeQueueEstimates.length}</Badge>
                    </div>

                    <div className="estimate-production-list__table">
                      <div aria-hidden="true" className="estimate-production-list__head">
                        <span>Stage</span>
                        <span>Estimate</span>
                        <span>Customer / vehicle</span>
                        <span>Status</span>
                        <span>Value</span>
                        <span>Next</span>
                        <span>Timeline</span>
                      </div>

                      <div className="estimate-production-list__rows">
                        {activeQueueEstimates.length ? (
                          activeQueueEstimates.map(({ estimate, lane }) => {
                            const isSelected = selectedEstimate?.estimateId === estimate.estimateId;
                            const timeline = getEstimateCardTimeline(estimate, context.company.timezone);
                            const throughputStage = getEstimateThroughputStage(estimate);
                            const threadSummary = estimateThreadSummaryByEstimateId.get(estimate.estimateId) ?? null;

                            return (
                              <Link
                                aria-expanded={isSelected}
                                aria-haspopup="dialog"
                                className={cx("estimate-production-list__row", isSelected && "estimate-production-list__row--selected")}
                                href={buildEstimatesHref(filters, {
                                  estimateId: estimate.estimateId,
                                  jobId: estimate.jobId
                                })}
                                key={estimate.estimateId}
                              >
                                <div className="estimate-production-list__stage">
                                  <p className="estimate-production-list__row-eyebrow">{lane.stageLabel}</p>
                                  <strong className="estimate-production-list__stage-title">{getEstimateThroughputStageLabel(throughputStage)}</strong>
                                </div>
                                <div className="estimate-production-list__main">
                                  <p className="estimate-production-list__row-eyebrow">{estimate.estimateNumber}</p>
                                  <h4 className="estimate-production-list__row-title">{estimate.title}</h4>
                                </div>
                                <p className="estimate-production-list__row-context">
                                  {getEstimateCustomerLabel(estimate)} · {getEstimateVehicleContext(estimate)}
                                </p>
                                <div className="estimate-production-list__row-status">
                                  <StatusBadge status={estimate.status} />
                                </div>
                                <strong className="estimate-production-list__row-value">
                                  {formatCurrencyFromCents(estimate.totalCents)}
                                </strong>
                                <p className="estimate-production-list__row-next">
                                  {getEstimateThreadNextStepLabel(estimate, threadSummary)}
                                  {threadSummary ? ` · ${threadSummary.label}` : ""}
                                </p>
                                <p className="estimate-production-list__row-meta">
                                  {timeline.label} {timeline.value}
                                </p>
                              </Link>
                            );
                          })
                        ) : (
                          <p className="estimate-production-column__empty">No active estimates in this queue.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ) : (
                productionLanes.map((lane) => {
                  const laneSummary = getEstimateLaneSummary(
                    lane,
                    lane.estimates,
                    estimateJobsByJobId,
                    context.company.timezone
                  );
                  const laneIcon = lane.key === "draft" ? "estimates" : lane.key === "sent" ? "approval" : "dispatch";

                  return (
                    <Card className={`estimate-production-column estimate-production-column--${lane.key}`} key={lane.key} padding="base" tone="raised">
                      <CardContent className="estimate-production-column__content">
                        <div className="estimate-production-column__header">
                          <div className="estimate-production-column__title-group">
                            <span className="estimate-production-column__icon">
                              <AppIcon name={laneIcon} />
                            </span>
                            <div>
                              <p className="estimate-production-column__eyebrow">{lane.stageLabel}</p>
                              <h3 className="estimate-production-column__title">{lane.label}</h3>
                              <p className="estimate-production-column__description">{lane.description}</p>
                            </div>
                          </div>
                          <div className="estimate-production-column__header-side">
                            <Badge tone={lane.key === "draft" ? "brand" : lane.key === "sent" ? "warning" : "success"}>
                              {lane.estimates.length}
                            </Badge>
                            <Link className="estimate-production-column__header-link" href={laneSummary.actionHref}>
                              {laneSummary.actionLabel}
                            </Link>
                          </div>
                        </div>

                        <div className="estimate-production-column__strip">
                          <div className="estimate-production-column__metric">
                            <span>{laneSummary.focusLabel}</span>
                            <strong>{laneSummary.focusValue}</strong>
                          </div>
                          <div className="estimate-production-column__metric">
                            <span>{laneSummary.metricLabel}</span>
                            <strong>{laneSummary.metricValue}</strong>
                          </div>
                        </div>

                        {lane.estimates.length ? (
                          <div className="estimate-production-column__stack">
                            {lane.estimates.map((estimate) => {
                              const isSelected = selectedEstimate?.estimateId === estimate.estimateId;
                              const timeline = getEstimateCardTimeline(estimate, context.company.timezone);
                              const throughputStage = getEstimateThroughputStage(estimate);
                              const threadSummary = estimateThreadSummaryByEstimateId.get(estimate.estimateId) ?? null;

                              return (
                                <Link
                                  aria-expanded={isSelected}
                                  aria-haspopup="dialog"
                                  className={cx(
                                    "estimate-production-card",
                                    isCompactView && "estimate-production-card--compact",
                                    isSelected && "estimate-production-card--selected"
                                  )}
                                  href={buildEstimatesHref(filters, {
                                    estimateId: estimate.estimateId,
                                    jobId: estimate.jobId
                                  })}
                                  key={estimate.estimateId}
                                >
                                  <div className="estimate-production-card__topline">
                                    <p className="estimate-production-card__eyebrow">{estimate.estimateNumber}</p>
                                    {isSelected ? <Badge tone="brand">Open</Badge> : <span className="estimate-production-card__inspect">Open details</span>}
                                  </div>
                                  <h4 className="estimate-production-card__title">{estimate.title}</h4>
                                  <p className="estimate-production-card__context-line">{getEstimateBoardContext(estimate)}</p>
                                  <div className={cx("estimate-production-card__signal-row", isCompactView && "estimate-production-card__signal-row--compact")}>
                                    <div className="estimate-production-card__signal-main">
                                      <span
                                        className={cx(
                                          "estimate-production-card__next-pill",
                                          `estimate-production-card__next-pill--${lane.key}`
                                        )}
                                      >
                                        {getEstimateThreadNextStepLabel(estimate, threadSummary)}
                                      </span>
                                      {throughputStage !== "drafting" ? (
                                        <span className="estimate-production-card__thread-note">
                                          {getEstimateThroughputStageLabel(throughputStage)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <strong className="estimate-production-card__total">
                                      {formatCurrencyFromCents(estimate.totalCents)}
                                    </strong>
                                  </div>
                                  <div className="estimate-production-card__foot">
                                    <span>{timeline.label}</span>
                                    <span>{timeline.value}</span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="estimate-production-column__empty">No estimates in this lane.</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}

                {supportEstimates.length ? (
                <Card className="estimate-production-support" padding="base" tone="subtle">
                  <CardContent className="estimate-production-support__content">
                    <div className="estimate-production-support__header">
                      <div>
                        <p className="estimate-production-support__eyebrow">Closed queue</p>
                        <h3 className="estimate-production-support__title">Closed estimates</h3>
                        <p className="estimate-production-support__copy">Declined and void quotes kept off the live board.</p>
                      </div>
                      <Badge tone="neutral">{supportEstimates.length}</Badge>
                    </div>

                    <div className="estimate-production-support__table">
                      <div aria-hidden="true" className="estimate-production-support__list-head">
                        <span>Estimate</span>
                        <span>Customer / vehicle</span>
                        <span>Status</span>
                        <span>Value</span>
                        <span>Timeline</span>
                      </div>

                      <div className="estimate-production-support__list">
                        {supportEstimates.map((estimate) => {
                          const isSelected = selectedEstimate?.estimateId === estimate.estimateId;
                          const timeline = getEstimateCardTimeline(estimate, context.company.timezone);
                          const threadSummary = estimateThreadSummaryByEstimateId.get(estimate.estimateId) ?? null;

                          return (
                            <Link
                              aria-expanded={isSelected}
                              aria-haspopup="dialog"
                              className={cx("estimate-production-support__row", isSelected && "estimate-production-support__row--selected")}
                              href={buildEstimatesHref(filters, {
                                estimateId: estimate.estimateId,
                                jobId: estimate.jobId
                              })}
                              key={estimate.estimateId}
                            >
                              <div className="estimate-production-support__row-main">
                                <p className="estimate-production-support__row-eyebrow">{estimate.estimateNumber}</p>
                                <h4 className="estimate-production-support__row-title">{estimate.title}</h4>
                              </div>
                              <p className="estimate-production-support__row-context">
                                {getEstimateCustomerLabel(estimate)} · {getEstimateVehicleContext(estimate)}
                              </p>
                              <div className="estimate-production-support__row-status">
                                <StatusBadge status={estimate.status} />
                              </div>
                              <strong className="estimate-production-support__row-value">
                                {formatCurrencyFromCents(estimate.totalCents)}
                              </strong>
                              <p className="estimate-production-support__row-meta">
                                {timeline.label} {timeline.value}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ) : null}
              </>
            ) : (
            <Card padding="spacious" tone="raised">
              <CardContent>
                <EmptyState
                  actions={
                    context.canEditRecords ? (
                      <Link className={buttonClassName()} href="/dashboard/visits/new?mode=estimate">
                        Start estimate
                      </Link>
                    ) : undefined
                  }
                  description={filtersApplied ? "No estimates match this queue slice." : "Start a quote from a visit to load this throughput desk."}
                  eyebrow={filtersApplied ? "No queue matches" : "Estimate queue empty"}
                  title={filtersApplied ? "Nothing in this queue" : "No estimates in motion"}
                  tone={filtersApplied ? "info" : "default"}
                />
              </CardContent>
            </Card>
            )}
          </div>

          <aside className="estimate-production-inspector">
            {selectedDetail && selectedEstimate ? (
              <Card className="estimate-production-drawer__card estimate-production-inspector__card" padding="spacious" tone="raised">
                <CardContent className="estimate-production-drawer__content estimate-production-inspector__content">
                    <div className="estimate-production-drawer__header">
                      <div className="estimate-production-drawer__header-copy">
                        <p className="estimate-production-drawer__eyebrow">Visit thread</p>
                        <h2 className="estimate-production-drawer__title">{selectedDetail.estimate.estimateNumber}</h2>
                        <p className="estimate-production-drawer__description">{selectedDetail.estimate.title}</p>
                      </div>

                    <div className="estimate-production-drawer__header-actions">
                      {selectedLane ? <Badge tone="neutral">{selectedLane.stageLabel}</Badge> : null}
                      <StatusBadge status={selectedDetail.estimate.status} />
                      <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={clearEstimateHref}>
                        Clear focus
                      </Link>
                    </div>
                  </div>

                  <div className="estimate-production-drawer__hero">
                    <div className="estimate-production-drawer__hero-top">
                      <div>
                        <p className="estimate-production-drawer__hero-label">Quoted total</p>
                        <strong className="estimate-production-drawer__hero-value">
                          {formatCurrencyFromCents(selectedDetail.totals.totalCents)}
                        </strong>
                        <p className="estimate-production-drawer__hero-copy">
                          Keep the visit thread moving from here.
                        </p>
                      </div>
                      <div className="estimate-production-drawer__hero-badges">
                        <Badge tone={getEstimateThroughputTone(getEstimateThroughputStage(selectedDetail.estimate))}>
                          {getEstimateThreadNextStepLabel(selectedEstimate, selectedThreadSummary)}
                        </Badge>
                        {selectedWorkflowBlocker?.supplyBlockerCount ? (
                          <Badge tone="warning">{selectedWorkflowBlocker.supplyBlockerCount} supply blocked</Badge>
                        ) : null}
                        {!selectedWorkflowBlocker?.supplyBlockerCount && selectedWorkflowBlocker?.openPaymentHandoffCount ? (
                          <Badge tone="brand">
                            {selectedWorkflowBlocker.financeHandoffSummary?.label ??
                              `${selectedWorkflowBlocker.openPaymentHandoffCount} field handoff${selectedWorkflowBlocker.openPaymentHandoffCount === 1 ? "" : "s"}`}
                          </Badge>
                        ) : null}
                        {!selectedWorkflowBlocker?.supplyBlockerCount &&
                        !selectedWorkflowBlocker?.openPaymentHandoffCount &&
                        selectedWorkflowBlocker?.financeOwnership?.owner === "Finance" ? (
                          <Badge tone="brand">Finance follow-through</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="estimate-production-drawer__hero-grid">
                      <div className="estimate-production-drawer__item">
                        <span>Customer</span>
                        <strong>{getCustomerLabel(selectedDetail.customer)}</strong>
                      </div>
                      <div className="estimate-production-drawer__item">
                        <span>Vehicle</span>
                        <strong>{getVehicleLabel(selectedDetail.vehicle)}</strong>
                      </div>
                      <div className="estimate-production-drawer__item">
                        <span>Visit</span>
                        <strong>{selectedDetail.job.title}</strong>
                      </div>
                      <div className="estimate-production-drawer__item">
                        <span>{selectedTimeline?.label ?? "Updated"}</span>
                        <strong>{selectedTimeline?.value ?? "Unknown"}</strong>
                      </div>
                    </div>
                    <div className="ui-button-grid estimate-production-drawer__action-grid">
                      <Link className={buttonClassName()} href={selectedVisitHref}>
                        {selectedVisitLabel}
                      </Link>
                      <Link className={buttonClassName({ tone: "secondary" })} href={selectedEstimateWorkspaceHref}>
                        {getEstimateActionLabel(selectedEstimate)}
                      </Link>
                      {selectedWorkflowBlocker?.supplyBlockerCount ? (
                        <Link className={buttonClassName({ tone: "secondary" })} href={`/dashboard/visits/${selectedEstimate.jobId}/inventory`}>
                          Unblock supply
                        </Link>
                      ) : null}
                      {!selectedWorkflowBlocker?.supplyBlockerCount &&
                      (selectedWorkflowBlocker?.openPaymentHandoffCount ||
                        selectedWorkflowBlocker?.financeOwnership?.owner === "Finance") ? (
                        selectedWorkflowBlocker?.openPaymentHandoffCount ? (
                          <form action={resolveEstimatePaymentHandoffAction}>
                            <input name="jobId" type="hidden" value={selectedEstimate.jobId} />
                            <input name="returnTo" type="hidden" value={selectedEstimateReleaseBaseHref} />
                            <FormField label="Resolve as">
                              <Select
                                defaultValue={
                                  selectedWorkflowBlocker.financeHandoffSummary?.resolutionDisposition ??
                                  "escalated_to_billing_owner"
                                }
                                name="resolutionDisposition"
                              >
                                {technicianPaymentResolutionDispositions.map((disposition) => (
                                  <option key={disposition} value={disposition}>
                                    {formatTechnicianPaymentResolutionDispositionLabel(disposition)}
                                  </option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField label="Office note">
                              <Input
                                name="resolutionNote"
                                placeholder="Optional unless resolved another way"
                              />
                            </FormField>
                            <button className={buttonClassName({ tone: "secondary" })} type="submit">
                              Resolve handoff
                            </button>
                          </form>
                        ) : (
                          <Link className={buttonClassName({ tone: "secondary" })} href={`/dashboard/visits/${selectedEstimate.jobId}/invoice`}>
                            Work closeout
                          </Link>
                        )
                      ) : null}
                    </div>
                  </div>

                  {selectedEstimateContinuation ? (
                    <section className="estimate-production-drawer__section">
                      <div className="estimate-production-drawer__section-header">
                        <p className="estimate-production-drawer__section-label">Keep moving</p>
                        <span className="estimate-production-drawer__section-copy">
                          Stay in the queue until the quote truly needs deeper work.
                        </span>
                      </div>

                      <div className="estimate-production-drawer__continuation">
                        <div className="estimate-production-drawer__decision-main">
                          <p className="estimate-production-drawer__decision-eyebrow">Next move</p>
                          <p className="estimate-production-drawer__decision-label">{selectedEstimateContinuation.label}</p>
                          <p className="estimate-production-drawer__decision-copy">{selectedEstimateContinuation.copy}</p>
                        </div>

                        <div className="estimate-production-drawer__grid estimate-production-drawer__continuation-grid">
                          <div className="estimate-production-drawer__item">
                            <span>Builder state</span>
                            <strong>
                              {selectedEstimateWorkspaceUnavailable
                                ? "Unavailable"
                                : !selectedEstimateCanvasReady
                                  ? "Needs first line"
                                  : `${selectedEstimateWorkspace?.summary.lineItemCount ?? 0} live line${
                                      selectedEstimateWorkspace?.summary.lineItemCount === 1 ? "" : "s"
                                    }`}
                            </strong>
                          </div>
                          <div className="estimate-production-drawer__item">
                            <span>Part pricing</span>
                            <strong>
                              {selectedEstimateWorkspaceUnavailable
                                ? "Unavailable"
                                : selectedEstimatePendingPricingPartCount
                                  ? `${selectedEstimatePendingPricingPartCount} pending`
                                  : "Clear"}
                            </strong>
                          </div>
                          <div className="estimate-production-drawer__item">
                            <span>Sourcing</span>
                            <strong>
                              {selectedEstimateWorkspaceUnavailable
                                ? "Unavailable"
                                : selectedEstimateWorkspace?.summary.partLineCount
                                  ? selectedEstimateWorkspace.partRequest
                                    ? formatEstimateDeskStatusLabel(selectedEstimateWorkspace.partRequest.status)
                                    : selectedEstimatePendingSourcePartCount
                                      ? `${selectedEstimatePendingSourcePartCount} missing`
                                      : "Not started"
                                  : "Not needed"}
                            </strong>
                          </div>
                        </div>

                        <div className="ui-button-grid estimate-production-drawer__continuation-actions">
                          <Link className={buttonClassName()} href={selectedEstimateContinuation.primaryActionHref}>
                            {selectedEstimateContinuation.primaryActionLabel}
                          </Link>
                          {selectedEstimateContinuation.secondaryActionHref &&
                          selectedEstimateContinuation.secondaryActionLabel ? (
                            <Link
                              className={buttonClassName({ tone: "secondary" })}
                              href={selectedEstimateContinuation.secondaryActionHref}
                            >
                              {selectedEstimateContinuation.secondaryActionLabel}
                            </Link>
                          ) : null}
                        </div>

                        {selectedEstimateWorkspaceUnavailable ? (
                          <p className="estimate-production-drawer__quiet">
                            The live builder snapshot is temporarily unavailable from the desk. Use the full quote thread to continue safely.
                          </p>
                        ) : selectedEstimatePendingPricingPartCount ? (
                          <div className="estimate-production-drawer__continuation-list">
                            <div className="estimate-production-drawer__continuation-list-header">
                              <p className="estimate-production-drawer__section-label">Pricing queue</p>
                              <span className="estimate-production-drawer__section-copy">
                                Work these part lines before customer review.
                              </span>
                            </div>
                            <div className="estimate-production-drawer__queue">
                              {selectedEstimatePendingPricingPartLines.slice(0, 4).map(({ lineItem, sectionTitle }) => (
                                <div className="estimate-production-drawer__queue-item" key={lineItem.id}>
                                  <div className="estimate-production-drawer__queue-main">
                                    <div className="estimate-production-drawer__queue-title-row">
                                      <p className="estimate-production-drawer__queue-title">{lineItem.name}</p>
                                      <Badge tone="warning">
                                        {lineItem.linkedPartRequestLine?.partNumber ? "Cost pending" : "Needs sourcing"}
                                      </Badge>
                                    </div>
                                    <p className="estimate-production-drawer__queue-meta">{sectionTitle}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : selectedEstimateWorkspacePreviewLines.length ? (
                          <div className="estimate-production-drawer__continuation-list">
                            <div className="estimate-production-drawer__continuation-list-header">
                              <p className="estimate-production-drawer__section-label">Builder preview</p>
                              <span className="estimate-production-drawer__section-copy">
                                Current scope without leaving the desk.
                              </span>
                            </div>
                            <div className="estimate-production-drawer__queue">
                              {selectedEstimateWorkspacePreviewLines.map((lineItem) => (
                                <div className="estimate-production-drawer__queue-item" key={lineItem.id}>
                                  <div className="estimate-production-drawer__queue-main">
                                    <div className="estimate-production-drawer__queue-title-row">
                                      <p className="estimate-production-drawer__queue-title">{lineItem.label}</p>
                                      <Badge tone="neutral">In builder</Badge>
                                    </div>
                                    <p className="estimate-production-drawer__queue-meta">{lineItem.meta}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="estimate-production-drawer__quiet">
                            No builder lines are staged yet. Use the builder to create the first operation.
                          </p>
                        )}
                      </div>
                    </section>
                  ) : null}

                  {selectedReleaseRunway ? (
                    <section className="estimate-production-drawer__section">
                      <div className="estimate-production-drawer__section-header">
                        <p className="estimate-production-drawer__section-label">Release runway</p>
                        <span className="estimate-production-drawer__section-copy">
                          Keep approved work inside one commercial-to-dispatch handoff.
                        </span>
                      </div>

                      {selectedReleaseFeedback ? (
                        <Callout tone={selectedReleaseFeedback.tone} title={selectedReleaseFeedback.title}>
                          {selectedReleaseFeedback.body}
                        </Callout>
                      ) : null}

                      <div className="estimate-production-drawer__decision">
                        <div className="estimate-production-drawer__decision-main">
                          <p className="estimate-production-drawer__decision-eyebrow">Visit release</p>
                          <p className="estimate-production-drawer__decision-label">{selectedReleaseRunway.label}</p>
                          <p className="estimate-production-drawer__decision-copy">{selectedReleaseRunway.copy}</p>
                        </div>
                        <div className="estimate-production-drawer__decision-meta">
                          <span>Release runway</span>
                          <strong>{selectedReleaseRunway.releaseThreadLabel}</strong>
                        </div>
                      </div>

                      <div className="estimate-production-drawer__grid">
                        <div className="estimate-production-drawer__item">
                          <span>Visit state</span>
                          <strong>
                            <Badge tone={getVisitWorkflowTone(selectedReleaseRunway.workflowState)}>
                              {getVisitWorkflowLabel(selectedReleaseRunway.workflowState)}
                            </Badge>
                          </strong>
                        </div>
                        <div className="estimate-production-drawer__item">
                          <span>Dispatch owner</span>
                          <strong>{selectedReleaseRunway.ownerLabel}</strong>
                        </div>
                        <div className="estimate-production-drawer__item">
                          <span>Time promise</span>
                          <strong>{selectedReleaseRunway.promiseLabel}</strong>
                        </div>
                      </div>

                      <div className="ui-button-grid estimate-production-drawer__continuation-actions">
                        <Link className={buttonClassName()} href={selectedReleaseRunway.primaryActionHref}>
                          {selectedReleaseRunway.primaryActionLabel}
                        </Link>
                        <Link
                          className={buttonClassName({ tone: "secondary" })}
                          href={selectedReleaseRunway.secondaryActionHref}
                        >
                          {selectedReleaseRunway.secondaryActionLabel}
                        </Link>
                        {selectedReleaseRunwayDispatchAction ? (
                          <Link
                            className={buttonClassName({ tone: "tertiary" })}
                            href={selectedReleaseRunwayDispatchAction.href}
                          >
                            {selectedReleaseRunwayDispatchAction.label}
                          </Link>
                        ) : null}
                      </div>

                      {context.canEditRecords ? (
                        <div className="estimate-production-drawer__continuation-list">
                          <div className="estimate-production-drawer__continuation-list-header">
                            <p className="estimate-production-drawer__section-label">Inline release controls</p>
                            <span className="estimate-production-drawer__section-copy">
                              Assign, promise, and release the visit without leaving the estimate desk.
                            </span>
                          </div>

                          <div className="ui-card-list">
                            <div>
                              <p className="ui-detail-label">Dispatch owner</p>
                              <form action={saveEstimateReleaseOwnerAction}>
                                <input name="intent" type="hidden" value="save_owner" />
                                <input name="jobId" type="hidden" value={selectedEstimate.jobId} />
                                <input name="returnTo" type="hidden" value={selectedEstimateReleaseBaseHref} />
                                <FormField label="Technician owner">
                                  <Select defaultValue={selectedDetail.job.assignedTechnicianUserId ?? ""} name="assignedTechnicianUserId">
                                    <option value="">Unassigned</option>
                                    {assignableTechnicians.map((technician) => (
                                      <option key={technician.userId} value={technician.userId}>
                                        {technician.displayName}
                                      </option>
                                    ))}
                                  </Select>
                                </FormField>
                                <div className="ui-button-grid">
                                  <button className={buttonClassName({ size: "sm" })} type="submit">
                                    Save owner
                                  </button>
                                </div>
                              </form>
                            </div>

                            <div>
                              <p className="ui-detail-label">Time promise</p>
                              <form action={saveEstimateReleasePromiseAction}>
                                <input name="intent" type="hidden" value="save_promise" />
                                <input name="jobId" type="hidden" value={selectedEstimate.jobId} />
                                <input name="returnTo" type="hidden" value={selectedEstimateReleaseBaseHref} />
                                <FormField label="Specific start">
                                  <Input
                                    defaultValue={toLocalDateTimeInput(selectedDetail.job.scheduledStartAt)}
                                    name="scheduledStartAt"
                                    type="datetime-local"
                                  />
                                </FormField>
                                <FormField label="Arrival window start">
                                  <Input
                                    defaultValue={toLocalDateTimeInput(selectedDetail.job.arrivalWindowStartAt)}
                                    name="arrivalWindowStartAt"
                                    type="datetime-local"
                                  />
                                </FormField>
                                <FormField label="Arrival window end">
                                  <Input
                                    defaultValue={toLocalDateTimeInput(selectedDetail.job.arrivalWindowEndAt)}
                                    name="arrivalWindowEndAt"
                                    type="datetime-local"
                                  />
                                </FormField>
                                <div className="ui-button-grid">
                                  <button className={buttonClassName({ size: "sm" })} type="submit">
                                    Save time promise
                                  </button>
                                  <button
                                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                                    name="clearSchedule"
                                    type="submit"
                                    value="1"
                                  >
                                    Clear schedule
                                  </button>
                                </div>
                              </form>
                            </div>

                            <div>
                              <p className="ui-detail-label">Release to dispatch</p>
                              {selectedDetail.job.status === "new" ? (
                                <form action={releaseEstimateToDispatchAction}>
                                  <input name="intent" type="hidden" value="release_dispatch" />
                                  <input name="jobId" type="hidden" value={selectedEstimate.jobId} />
                                  <input name="returnTo" type="hidden" value={selectedEstimateReleaseBaseHref} />
                                  <p className="estimate-production-drawer__quiet">
                                    {selectedReleaseRunway.workflowState === "ready_to_dispatch"
                                      ? "Owner and promise are already clear. Push the visit onto the live dispatch board now."
                                      : `Dispatch can take this visit now, but ${formatLabel(selectedReleaseRunway.workflowState)} is still open in the release runway.`}
                                  </p>
                                  <div className="ui-button-grid">
                                    <button className={buttonClassName({ size: "sm" })} type="submit">
                                      Release to dispatch
                                    </button>
                                  </div>
                                </form>
                              ) : selectedDetail.job.status === "scheduled" ? (
                                <p className="estimate-production-drawer__quiet">
                                  This visit is already released to the dispatch board. Use the runway links above for live routing.
                                </p>
                              ) : selectedReleaseRunway.workflowState === "live" ? (
                                <p className="estimate-production-drawer__quiet">
                                  Dispatch already owns this stop. Use the live board or visit thread for the next move.
                                </p>
                              ) : (
                                <p className="estimate-production-drawer__quiet">
                                  Finish {formatLabel(selectedReleaseRunway.workflowState)} before releasing this visit into Dispatch.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedDetail.estimate.notes ? (
                        <p className="estimate-production-drawer__notes">{selectedDetail.estimate.notes}</p>
                      ) : (
                        <p className="estimate-production-drawer__quiet">
                          Keep the approved quote and visit release runway aligned until Dispatch owns the stop.
                        </p>
                      )}
                    </section>
                  ) : null}

                  <section className="estimate-production-drawer__section">
                    <div className="estimate-production-drawer__section-header">
                      <p className="estimate-production-drawer__section-label">Action now</p>
                      <span className="estimate-production-drawer__section-copy">What the operator should do next.</span>
                    </div>

                    <div className="estimate-production-drawer__decision">
                      <div className="estimate-production-drawer__decision-main">
                        <p className="estimate-production-drawer__decision-eyebrow">Workflow step</p>
                        <p className="estimate-production-drawer__decision-label">{getEstimateNextStepLabel(selectedDetail.estimate)}</p>
                        <p className="estimate-production-drawer__decision-copy">{getEstimateDecisionCopy(selectedDetail.estimate)}</p>
                      </div>
                      <div className="estimate-production-drawer__decision-meta">
                        <span>{selectedTimeline?.label ?? "Updated"}</span>
                        <strong>{selectedTimeline?.value ?? "Unknown"}</strong>
                      </div>
                      <div className="estimate-production-drawer__decision-checklist">
                        {getEstimateDecisionChecklist(selectedDetail.estimate).map((item) => (
                          <p className="estimate-production-drawer__decision-check" key={item}>
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </section>

                  {selectedThreadSummary ? (
                    <section className="estimate-production-drawer__section">
                      <div className="estimate-production-drawer__section-header">
                        <p className="estimate-production-drawer__section-label">Service thread</p>
                        <span className="estimate-production-drawer__section-copy">
                          Keep quote, visit release, and closeout pressure aligned.
                        </span>
                      </div>

                      <div className="estimate-production-drawer__decision">
                        <div className="estimate-production-drawer__decision-main">
                          <p className="estimate-production-drawer__decision-eyebrow">Thread pressure</p>
                          <p className="estimate-production-drawer__decision-label">{selectedThreadSummary.nextActionLabel}</p>
                          <p className="estimate-production-drawer__decision-copy">{selectedThreadSummary.copy}</p>
                        </div>
                        <div className="estimate-production-drawer__decision-checklist">
                          {selectedThreadSummary.segments.map((segment) => (
                            <p className="estimate-production-drawer__decision-check" key={segment.label}>
                              {segment.label}: {segment.value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {selectedEstimateOwnership ? (
                    <section className="estimate-production-drawer__section">
                      <div className="estimate-production-drawer__section-header">
                        <p className="estimate-production-drawer__section-label">Exception ownership</p>
                        <span className="estimate-production-drawer__section-copy">
                          Keep conversion and release responsibility explicit.
                        </span>
                      </div>

                      <div className="estimate-production-drawer__grid">
                        <div className="estimate-production-drawer__item">
                          <span>Owning role</span>
                          <strong>{selectedEstimateOwnership.owner}</strong>
                        </div>
                        <div className="estimate-production-drawer__item">
                          <span>Active exception</span>
                          <strong>{selectedEstimateOwnership.label}</strong>
                        </div>
                      </div>
                      <p className="estimate-production-drawer__notes">{selectedEstimateOwnership.copy}</p>
                    </section>
                  ) : null}

                  {selectedWorkflowBlocker ? (
                    <section className="estimate-production-drawer__section">
                      <div className="estimate-production-drawer__section-header">
                        <p className="estimate-production-drawer__section-label">Cross-thread blockers</p>
                        <span className="estimate-production-drawer__section-copy">
                          Keep release decisions grounded in supply and finance reality.
                        </span>
                      </div>

                      <div className="estimate-production-drawer__grid">
                        <div className="estimate-production-drawer__item">
                          <span>Release handoff</span>
                          <strong>{selectedWorkflowBlocker.hasApprovedRelease ? "Ready" : "Not ready"}</strong>
                        </div>
                        <div className="estimate-production-drawer__item">
                          <span>Supply blockers</span>
                          <strong>{selectedWorkflowBlocker.supplyBlockerCount}</strong>
                        </div>
                        <div className="estimate-production-drawer__item">
                          <span>Finance state</span>
                          <strong>
                            {selectedWorkflowBlocker.openPaymentHandoffCount
                              ? selectedWorkflowBlocker.financeHandoffSummary?.label ?? "Field handoff active"
                              : selectedWorkflowBlocker.financeOwnership?.owner === "Finance"
                              ? selectedWorkflowBlocker.financeOwnership.label
                              : "Clear"}
                          </strong>
                        </div>
                      </div>
                      <p className="estimate-production-drawer__notes">
                        {selectedWorkflowBlocker.supplyBlockerCount
                          ? selectedWorkflowBlocker.supplyOwnership.copy
                          : selectedWorkflowBlocker.openPaymentHandoffCount
                            ? selectedWorkflowBlocker.financeHandoffSummary?.copy
                            : selectedWorkflowBlocker.financeOwnership?.owner === "Finance"
                            ? selectedWorkflowBlocker.financeOwnership.copy
                            : selectedWorkflowBlocker.hasApprovedRelease
                              ? "This estimate is commercially approved and can move straight into visits and dispatch."
                              : "No shared blocker is currently dominating this estimate thread."}
                      </p>
                    </section>
                  ) : null}

                  <section className="estimate-production-drawer__section">
                    <div className="estimate-production-drawer__section-header">
                      <p className="estimate-production-drawer__section-label">Priced work</p>
                      <span className="estimate-production-drawer__section-copy">Current pricing and scope.</span>
                    </div>

                    <div className="estimate-production-drawer__queue">
                      {selectedDetail.lineItems.length ? (
                        selectedDetail.lineItems.map((lineItem) => (
                          <div className="estimate-production-drawer__queue-item" key={lineItem.id}>
                            <div className="estimate-production-drawer__queue-main">
                              <div className="estimate-production-drawer__queue-title-row">
                                <p className="estimate-production-drawer__queue-title">{lineItem.name}</p>
                                <Badge tone="neutral">{getEstimateItemTypeLabel(lineItem.itemType)}</Badge>
                              </div>
                              <p className="estimate-production-drawer__queue-meta">
                                {lineItem.quantity} x {formatCurrencyFromCents(lineItem.unitPriceCents)}
                              </p>
                            </div>
                            <strong className="estimate-production-drawer__queue-value">
                              {formatCurrencyFromCents(lineItem.lineSubtotalCents)}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <p className="estimate-production-drawer__empty">No priced lines yet.</p>
                      )}
                    </div>
                  </section>
                </CardContent>
              </Card>
            ) : (
              <Card className="estimate-production-inspector__card" padding="spacious" tone="raised">
                <CardContent className="estimate-production-inspector__content">
                  <div>
                    <p className="estimate-production-command-card__eyebrow">Estimate focus</p>
                    <h3 className="estimate-production-inspector__title">
                      {visibleEstimates.length ? "Choose a quote to inspect" : filtersApplied ? "No matching queue focus" : "No estimates in motion"}
                    </h3>
                    <p className="estimate-production-inspector__copy">
                      {visibleEstimates.length
                        ? "Keep the queue on the left and open one estimate at a time here for release, approval, and pricing context."
                        : filtersApplied
                          ? "Adjust the queue filters or clear them to restore live estimate work."
                          : "Start a new estimate from a visit when pricing work begins."}
                    </p>
                  </div>

                  <div className="estimate-production-command-card__metrics estimate-production-inspector__metrics">
                    <div className="estimate-production-command-card__metric">
                      <span>Active queue</span>
                      <strong>{activeQueueCount}</strong>
                    </div>
                    <div className="estimate-production-command-card__metric">
                      <span>Quoted value</span>
                      <strong>{formatCurrencyFromCents(quotedValue)}</strong>
                    </div>
                  </div>

                  {inspectorFocusCommand ? (
                    <div className="estimate-production-inspector__focus-card">
                      <p className="estimate-production-command-card__eyebrow">{inspectorFocusCommand.eyebrow}</p>
                      <h4 className="estimate-production-inspector__focus-title">{inspectorFocusCommand.label}</h4>
                      <p className="estimate-production-inspector__focus-copy">{inspectorFocusCommand.copy}</p>
                      <Link className={buttonClassName({ size: "sm" })} href={inspectorFocusCommand.actionHref}>
                        {inspectorFocusCommand.actionLabel}
                      </Link>
                    </div>
                  ) : null}

                  <div className="ui-button-grid estimate-production-inspector__actions">
                    {context.canEditRecords ? (
                      <Link className={buttonClassName()} href="/dashboard/visits/new?mode=estimate">
                        New estimate
                      </Link>
                    ) : null}
                    <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits">
                      Open visits
                    </Link>
                    {filtersApplied ? (
                      <Link className={buttonClassName({ tone: "tertiary" })} href={clearFiltersHref}>
                        Clear filters
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </section>
    </Page>
  );
}
