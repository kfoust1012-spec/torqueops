import {
  type AppSupabaseClient,
  changeEstimateStatus as changeVisitEstimateStatus,
  assignJobTechnician as assignVisitTechnician,
  changeJobStatus as changeVisitStatus,
  createJobNote as createVisitNote,
  enqueueAppointmentConfirmation,
  enqueueDispatchUpdate,
  enqueueEstimateNotification,
  enqueueInvoiceNotification,
  enqueuePaymentReminder,
  getCustomerById,
  getEstimateByJobId as getEstimateByVisitId,
  getJobById as getVisitById,
  getInspectionByJobId as getInspectionByVisitId,
  getInvoiceByJobId as getInvoiceByVisitId,
  getInvoiceDetailById,
  getVehicleById,
  listAddressesByCustomer,
  listAssignableTechniciansByCompany,
  listAttachmentsByJob as listVisitAttachments,
  listJobCommunications as listVisitCommunications,
  listJobInventoryIssuesByJobId as listVisitInventoryIssuesById,
  listJobNotesByJob as listVisitNotesById,
  listJobStatusHistory as listVisitStatusHistory,
  listJobsByCompany as listVisitsByCompany,
  listVehiclesByCustomer,
  listServiceHistoryEstimatesByJobIds,
  listServiceHistoryInvoicesByJobIds,
  updateJob
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getAllowedNextJobStatuses,
  getVehicleDisplayName,
  isTechnicianActiveFieldJobStatus,
  isInvoiceEligibleForReminder
} from "@mobile-mechanic/core";
import type {
  Database,
  Estimate,
  EstimateWorkspace,
  Invoice,
  JobListItem,
  JobStatus
} from "@mobile-mechanic/types";
import { estimateLineItemTypes, jobStatuses } from "@mobile-mechanic/types";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { VisitsWorkboard } from "./_components/visits-workboard";
import {
  AppIcon,
  Badge,
  Callout,
  DeskSavedSlices,
  Input,
  PriorityBadge,
  QueueMetric,
  QueueHero,
  QueuePage,
  Select,
  StatusBadge,
  Textarea,
  buttonClassName,
  cx
} from "../../../components/ui";
import { processCommunicationMutationResult } from "../../../lib/communications/actions";
import { enqueueFollowUpCustomerCommunication } from "../../../lib/communications/follow-up";
import { requireCompanyContext } from "../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../lib/dashboard/route-alias";
import {
  ensureEstimateAccessLink,
  ensureInvoiceAccessLink,
  ensureJobVisitAccessLink as ensureVisitAccessLink,
  getEstimateAccessLinkSummary,
  getInvoiceAccessLinkSummary,
  getJobVisitAccessLinkSummary as getVisitAccessLinkSummary,
  markEstimateAccessLinkSent,
  markInvoiceAccessLinkSent,
  markJobVisitAccessLinkSent as markVisitAccessLinkSent
} from "../../../lib/customer-documents/service";
import { getJobProcurementDetail as getVisitProcurementDetail } from "../../../lib/procurement/service";
import { getTechnicianProfilePreview } from "../../../lib/technician-profiles/service";
import { getVehicleServiceHistory } from "../../../lib/service-history/service";
import {
  buildVisitDetailHref,
  buildVisitEditHref,
  buildVisitEstimateHref,
  buildVisitInventoryHref,
  buildVisitInspectionHref,
  buildVisitInvoiceHref,
  buildVisitPartsHref,
  buildVisitPhotosHref
} from "../../../lib/visits/workspace";
import {
  getFollowUpCommunicationAction,
  getVisitFollowUpSummary,
  isFollowUpVisit,
  isStaleFollowUpVisit
} from "../../../lib/jobs/follow-up";
import {
  getVisitNextMove,
  getVisitPrimaryAction,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone,
  isVisitWorkflowState,
  type VisitWorkflowState
} from "../../../lib/jobs/workflow";
import {
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary,
  isVisitReadinessRisk
} from "../../../lib/jobs/operational-health";
import {
  getEstimateSupportActionLabel,
  getEstimateSupportStage,
  getVisitEstimateSupportSummary as getVisitEstimateSupportSummaryForVisit,
  isStaleEstimateApproval
} from "../../../lib/estimates/support";
import {
  buildDefaultEstimateWorkspaceSeed,
  createEstimateWorkspace,
  createEstimateWorkspaceLineItem,
  createEstimateWorkspaceSection,
  getEstimateWorkspaceByJobId
} from "../../../lib/estimates/workspace/service";
import {
  getVisitBillingArtifactSummary as getInvoiceArtifactSummary,
  getVisitBillingState as getBillingState,
  getVisitBillingStateLabel as getBillingStateLabel,
  getVisitBillingStateTone as getBillingStateTone
} from "../../../lib/invoices/billing-state";
import { listTechnicianPaymentHandoffsByInvoiceIds } from "../../../lib/invoices/payment-handoffs";
import { getSupplyExceptionOwnershipSummary } from "../../../lib/jobs/exception-ownership";
import { buildWorkspaceBlockerSummary } from "../../../lib/jobs/workspace-blockers";
import { sendTechnicianJobPushNotification } from "../../../lib/mobile-push-notifications";
import {
  getVisitDrawerRoleFocus,
  getVisitActionLabels,
  getVisitRoleFocus
} from "../../../lib/office-workspace-focus";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveRouteConfidenceSnapshot,
  deriveReleaseRunwayState,
  type CommercialAccountMode
} from "../../../lib/service-thread/continuity";
import { toServerError } from "../../../lib/server-error";

type VisitsFilterState = {
  assignedTechnicianUserId: string;
  dateFrom: string;
  dateTo: string;
  detailTab: string;
  focus: string;
  jobId: string;
  query: string;
  scope: string;
  status: string;
  workflowState: string;
};

type JobCommunicationSnapshotRow = Pick<
  Database["public"]["Tables"]["customer_communications"]["Row"],
  "communication_type" | "created_at" | "job_id"
>;

const visitScopes = [
  "estimate_drafting",
  "needs_assignment",
  "needs_time_promise",
  "awaiting_approval",
  "stale_approval",
  "promise_risk",
  "return_visit",
  "stale_return_visit",
  "supply_blocked",
  "readiness_risk",
  "approved_release",
  "ready_dispatch",
  "live",
  "billing_follow_up"
] as const;

type VisitScope = (typeof visitScopes)[number];
const visitDrawerTabs = ["thread", "commercial", "support"] as const;
type VisitDrawerTab = (typeof visitDrawerTabs)[number];
type VisitEstimateReleaseRunway = {
  actionKind: "production_controls" | "release" | "dispatch" | "visit";
  copy: string;
  label: string;
  ownerLabel: string;
  promiseLabel: string;
  primaryActionLabel: string;
  workflowState: VisitWorkflowState;
};

type VisitsPageProps = {
  searchParams?: Promise<{
    assignedTechnicianUserId?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    detailTab?: string | string[];
    focus?: string | string[];
    jobId?: string | string[];
    query?: string | string[];
    scope?: string | string[];
    status?: string | string[];
    workflowState?: string | string[];
  }>;
};

type VisitRailSectionProps = {
  children: ReactNode;
  compact?: boolean;
  defaultOpen?: boolean;
  description: ReactNode;
  title: string;
};

type VisitArtifactCardProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  label: string;
  meta: ReactNode;
  status: ReactNode;
  value: ReactNode;
};

function VisitRailSection({
  children,
  compact = false,
  defaultOpen = false,
  description,
  title
}: VisitRailSectionProps) {
  return (
    <details className={cx("job-flow-sidebar__section", compact && "job-flow-sidebar__section--compact")} open={defaultOpen}>
      <summary className="job-flow-sidebar__section-summary">
        <span className="job-flow-sidebar__section-summary-copy">
          <strong>{title}</strong>
          {!compact ? <small>{description}</small> : null}
        </span>
        <span className="job-flow-sidebar__section-summary-indicator" aria-hidden="true" />
      </summary>
      <div className="job-flow-sidebar__section-body">{children}</div>
    </details>
  );
}

function VisitArtifactCard({
  children,
  defaultOpen = false,
  id,
  label,
  meta,
  status,
  value
}: VisitArtifactCardProps) {
  return (
    <details className="job-flow-sidebar__artifact-card" id={id} open={defaultOpen}>
      <summary className="job-flow-sidebar__artifact-summary">
        <span className="job-flow-sidebar__artifact-summary-copy">
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{status}</small>
        </span>
        <span className="job-flow-sidebar__artifact-summary-indicator" aria-hidden="true" />
      </summary>
      <div className="job-flow-sidebar__artifact-body">
        <p className="job-flow-sidebar__action-copy">{meta}</p>
        {children}
      </div>
    </details>
  );
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function getDateTimeStart(value: string) {
  return value ? `${value}T00:00` : undefined;
}

function getDateTimeEnd(value: string) {
  return value ? `${value}T23:59` : undefined;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

function getPositiveNumberInput(formData: FormData, key: string, fallback = 1) {
  const rawValue = getString(formData, key).trim();
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function getCurrencyInputCents(formData: FormData, key: string) {
  const rawValue = getString(formData, key).trim();

  if (!rawValue) {
    return 0;
  }

  const normalizedValue = rawValue.replace(/[^0-9.-]/g, "");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.round(parsedValue * 100));
}

function isEstimateLineItemType(value: string): value is (typeof estimateLineItemTypes)[number] {
  return estimateLineItemTypes.includes(value as (typeof estimateLineItemTypes)[number]);
}

function QueueReturnFields({
  filters,
  jobId
}: {
  filters: VisitsFilterState;
  jobId: string;
}) {
  return (
    <>
      <input name="jobId" type="hidden" value={jobId} />
      <input name="returnAssignedTechnicianUserId" type="hidden" value={filters.assignedTechnicianUserId} />
      <input name="returnDateFrom" type="hidden" value={filters.dateFrom} />
      <input name="returnDateTo" type="hidden" value={filters.dateTo} />
      <input name="returnDetailTab" type="hidden" value={filters.detailTab} />
      <input name="returnFocus" type="hidden" value={filters.focus} />
      <input name="returnJobId" type="hidden" value={jobId} />
      <input name="returnQuery" type="hidden" value={filters.query} />
      <input name="returnScope" type="hidden" value={filters.scope} />
      <input name="returnStatus" type="hidden" value={filters.status} />
      <input name="returnWorkflowState" type="hidden" value={filters.workflowState} />
    </>
  );
}

function isVisitScope(value: string): value is VisitScope {
  return visitScopes.includes(value as VisitScope);
}

function normalizeVisitDrawerTab(value: string, fallback: VisitDrawerTab = "thread"): VisitDrawerTab {
  return visitDrawerTabs.includes(value as VisitDrawerTab) ? (value as VisitDrawerTab) : fallback;
}

function getVisitDrawerDefaultTab(
  sectionOrder: ReturnType<typeof getVisitDrawerRoleFocus>["sectionOrder"]
): VisitDrawerTab {
  const primarySection = sectionOrder[0];

  if (primarySection === "commercial_state" || primarySection === "workspace_links") {
    return "commercial";
  }

  if (primarySection === "recent_activity" || primarySection === "recent_status") {
    return "support";
  }

  return "thread";
}

function buildVisitsHref(current: VisitsFilterState, patch: Partial<VisitsFilterState>) {
  const params = new URLSearchParams();
  const next = { ...current, ...patch };

  for (const [key, value] of Object.entries(next)) {
    if (value) {
      params.set(key, value);
    }
  }

  const search = params.toString();
  return search ? `/dashboard/visits?${search}` : "/dashboard/visits";
}

function buildDrawerReturnHref(formData: FormData) {
  return buildVisitsHref(
    {
      assignedTechnicianUserId: getString(formData, "returnAssignedTechnicianUserId"),
      dateFrom: getString(formData, "returnDateFrom"),
      dateTo: getString(formData, "returnDateTo"),
      detailTab: getString(formData, "returnDetailTab"),
      focus: getString(formData, "returnFocus"),
      jobId: getString(formData, "returnJobId"),
      query: getString(formData, "returnQuery"),
      scope: getString(formData, "returnScope"),
      status: getString(formData, "returnStatus"),
      workflowState: getString(formData, "returnWorkflowState")
    },
    {}
  );
}

function buildDispatchHref(job: JobListItem, timeZone: string) {
  const dateValue = job.scheduledStartAt ?? job.arrivalWindowStartAt ?? new Date().toISOString();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));

  return `/dashboard/dispatch?view=day&date=${localDate}&jobId=${job.id}`;
}

function buildPrimaryVisitHref(
  job: JobListItem,
  canEditRecords: boolean,
  filters: VisitsFilterState,
  timeZone: string
) {
  const primaryAction = getVisitPrimaryAction(job);

  if (primaryAction.intent === "dispatch") {
    return buildDispatchHref(job, timeZone);
  }

  return buildVisitsHref(filters, { jobId: job.id });
}

function getPrimaryVisitActionLabel(
  primaryAction: ReturnType<typeof getVisitPrimaryAction> | null | undefined
) {
  if (!primaryAction) {
    return "Work thread";
  }

  return primaryAction.intent === "dispatch" ? primaryAction.label : "Work thread";
}

function buildEstimateHref(jobId: string, estimate: Estimate | null, returnScope: string) {
  if (!estimate) {
    return buildVisitEstimateHref(jobId, { autostart: true, returnScope, workspace: true });
  }

  if (estimate.status === "draft") {
    return buildVisitEstimateHref(jobId, { returnScope, workspace: true });
  }

  return buildVisitEstimateHref(jobId, { returnScope });
}

function isVisitApprovedReleaseReady(job: JobListItem, estimate: Estimate | null) {
  if (!estimate || getEstimateSupportStage(estimate) !== "approved_release") {
    return false;
  }

  return job.status === "new" || job.status === "scheduled";
}

function buildVisitEstimateSupportHref(job: JobListItem, estimate: Estimate | null) {
  const params = new URLSearchParams({ jobId: job.id });
  const stage = estimate ? getEstimateSupportStage(estimate) : "drafting";

  switch (stage) {
    case "drafting":
      params.set("scope", "estimate_drafting");
      break;
    case "awaiting_approval":
      params.set("scope", "awaiting_approval");
      break;
    case "stale_approval":
      params.set("scope", "stale_approval");
      break;
    case "approved_release":
      if (isVisitApprovedReleaseReady(job, estimate)) {
        params.set("scope", "approved_release");
      } else if (job.status === "completed") {
        params.set("scope", "billing_follow_up");
      } else if (isTechnicianActiveFieldJobStatus(job.status)) {
        params.set("scope", "live");
      } else {
        params.set("scope", "ready_dispatch");
      }
      break;
    default:
      params.set("scope", "estimate_drafting");
      break;
  }

  return `/dashboard/visits?${params.toString()}`;
}

function getVisitEstimateSupportSummary(estimate: Estimate | null) {
  return getVisitEstimateSupportSummaryForVisit(estimate);
}

function getVisitEstimateReleasePromiseLabel(job: JobListItem, timeZone: string) {
  if (job.scheduledStartAt) {
    return formatDateTime(job.scheduledStartAt, { fallback: "Unknown", timeZone });
  }

  if (job.arrivalWindowStartAt) {
    return formatDateTime(job.arrivalWindowStartAt, { fallback: "Unknown", timeZone });
  }

  return "Not set";
}

function getVisitEstimateReleaseRunway(args: {
  estimate: Estimate;
  job: JobListItem;
  timeZone: string;
}): VisitEstimateReleaseRunway {
  const workflowState = getVisitWorkflowState(args.job);
  const ownerLabel = args.job.assignedTechnicianUserId ? "Assigned" : "Unassigned";
  const promiseLabel = getVisitEstimateReleasePromiseLabel(args.job, args.timeZone);

  switch (workflowState) {
    case "needs_assignment":
      return {
        actionKind: "production_controls",
        copy: `${args.estimate.estimateNumber} is approved, but the visit still needs an owner before Dispatch should take it.`,
        label: "Assign the field owner",
        ownerLabel,
        primaryActionLabel: "Assign owner",
        promiseLabel,
        workflowState
      };
    case "ready_to_schedule":
      return {
        actionKind: "production_controls",
        copy: `${args.estimate.estimateNumber} is approved and owned. Lock the promise window from this visit thread before it hits Dispatch.`,
        label: "Set the time promise",
        ownerLabel,
        primaryActionLabel: "Set promise",
        promiseLabel,
        workflowState
      };
    case "ready_to_dispatch":
      return {
        actionKind: args.job.status === "new" ? "release" : "dispatch",
        copy:
          args.job.status === "new"
            ? `${args.estimate.estimateNumber} is fully ready. Release it onto the live board while the pricing and customer context are still attached here.`
            : `${args.estimate.estimateNumber} is already staged for Dispatch. Open the board and keep the service thread moving from there.`,
        label: args.job.status === "new" ? "Release into dispatch" : "Track in dispatch",
        ownerLabel,
        primaryActionLabel: args.job.status === "new" ? "Release to dispatch" : "Open dispatch",
        promiseLabel,
        workflowState
      };
    case "live":
      return {
        actionKind: "dispatch",
        copy: `${args.estimate.estimateNumber} is already live on the board or in the field. Manage timing and customer updates from Dispatch.`,
        label: "Track the live thread",
        ownerLabel,
        primaryActionLabel: "Open dispatch",
        promiseLabel,
        workflowState
      };
    case "completed":
      return {
        actionKind: "visit",
        copy: `${args.estimate.estimateNumber} is already attached to completed field work. Keep closeout and billing on the visit thread instead of reopening release.`,
        label: "Close the service thread",
        ownerLabel,
        primaryActionLabel: "Open visit",
        promiseLabel,
        workflowState
      };
    case "intake":
    default:
      return {
        actionKind: "production_controls",
        copy: `${args.estimate.estimateNumber} is approved, but intake cleanup is still keeping this visit from moving cleanly into Dispatch ownership.`,
        label: "Finish intake before release",
        ownerLabel,
        primaryActionLabel: "Open production controls",
        promiseLabel,
        workflowState
      };
  }
}

function getEstimateActionLabel(estimate: Estimate | null, canEditRecords: boolean) {
  if (!estimate) {
    return canEditRecords ? "Create estimate" : "Open estimate";
  }

  if (!canEditRecords) {
    return "Open estimate";
  }

  return getEstimateSupportActionLabel(estimate);
}

function getLatestEstimatesByJob(estimates: Estimate[]) {
  const estimatesByJobId = new Map<string, Estimate>();

  for (const estimate of estimates) {
    const current = estimatesByJobId.get(estimate.jobId);

    if (!current) {
      estimatesByJobId.set(estimate.jobId, estimate);
      continue;
    }

    if (new Date(estimate.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) {
      estimatesByJobId.set(estimate.jobId, estimate);
    }
  }

  return [...estimatesByJobId.values()];
}

function getLatestInvoicesByJob(invoices: Invoice[]) {
  const invoicesByJobId = new Map<string, Invoice>();

  for (const invoice of invoices) {
    const current = invoicesByJobId.get(invoice.jobId);

    if (!current) {
      invoicesByJobId.set(invoice.jobId, invoice);
      continue;
    }

    if (new Date(invoice.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) {
      invoicesByJobId.set(invoice.jobId, invoice);
    }
  }

  return [...invoicesByJobId.values()];
}

function getScheduleSummary(job: JobListItem, timeZone: string) {
  if (job.scheduledStartAt) {
    return {
      label: "Scheduled",
      value: formatDateTime(job.scheduledStartAt, { fallback: "Not set", timeZone })
    };
  }

  if (job.arrivalWindowStartAt) {
    return {
      label: "Arrival",
      value: formatDateTime(job.arrivalWindowStartAt, { fallback: "Not set", timeZone })
    };
  }

  return {
    label: "Schedule",
    value: "Not set"
  };
}

function formatServiceSiteAddress(
  site: Pick<CustomerSiteRecord, "line1" | "line2" | "city" | "state" | "postalCode" | "country">
) {
  return [site.line1, site.line2, site.city, site.state, site.postalCode, site.country]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function getServiceSitePlaybookCopy(
  site: Pick<
    CustomerSiteRecord,
    "accessWindowNotes" | "gateCode" | "parkingNotes" | "serviceContactName" | "serviceContactPhone"
  >
) {
  return [
    site.accessWindowNotes,
    site.gateCode ? `Gate ${site.gateCode}` : null,
    site.parkingNotes,
    site.serviceContactName || site.serviceContactPhone
      ? `Contact ${site.serviceContactName ?? site.serviceContactPhone}`
      : null
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function hasServiceSitePlaybook(
  site: Pick<
    CustomerSiteRecord,
    "serviceContactName" | "serviceContactPhone" | "accessWindowNotes" | "gateCode" | "parkingNotes"
  >
) {
  return Boolean(
    site.serviceContactName ||
      site.serviceContactPhone ||
      site.accessWindowNotes ||
      site.gateCode ||
      site.parkingNotes
  );
}

function isLiveSiteVisitStatus(status: JobStatus) {
  return status !== "completed" && status !== "canceled";
}

function buildPhoneHref(phone: string, protocol: "sms" | "tel") {
  return `${protocol}:${phone}`;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getVisitScopeLabel(scope: VisitScope) {
  switch (scope) {
    case "estimate_drafting":
      return "Estimate work";
    case "needs_assignment":
      return "Needs assignment";
    case "needs_time_promise":
      return "Needs time promise";
    case "awaiting_approval":
      return "Awaiting approval";
    case "stale_approval":
      return "Stale approval";
    case "promise_risk":
      return "Promise risk";
    case "return_visit":
      return "Return visits";
    case "stale_return_visit":
      return "Stale return";
    case "supply_blocked":
      return "Supply blocked";
    case "readiness_risk":
      return "Readiness risk";
    case "approved_release":
      return "Approved release";
    case "ready_dispatch":
      return "Ready for dispatch";
    case "live":
      return "Live now";
    case "billing_follow_up":
      return "Billing follow-up";
    default:
      return "Queue";
  }
}

function isStaleApprovalEstimate(estimate: Estimate | null) {
  return estimate ? isStaleEstimateApproval(estimate) : false;
}

function isPromiseRiskJob(job: JobListItem) {
  if (["completed", "canceled", "in_progress"].includes(job.status)) {
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

  return promiseTime <= Date.now();
}

function isStaleReturnVisitJob(job: JobListItem) {
  return isStaleFollowUpVisit({
    arrivalWindowStartAt: job.arrivalWindowStartAt,
    scheduledStartAt: job.scheduledStartAt,
    status: job.status,
    title: job.title
  });
}

function matchesVisitScope(args: {
  estimate: Estimate | null;
  invoice: Invoice | null;
  job: JobListItem;
  openPaymentHandoffCount?: number;
  scope: VisitScope;
  supplyBlockerCount?: number;
}) {
  const workflowState = getVisitWorkflowState(args.job);

  switch (args.scope) {
    case "estimate_drafting":
      return !args.estimate || getEstimateSupportStage(args.estimate) === "drafting";
    case "needs_assignment":
      return workflowState === "needs_assignment";
    case "needs_time_promise":
      return workflowState === "ready_to_schedule";
    case "awaiting_approval":
      return args.estimate?.status === "sent";
    case "stale_approval":
      return isStaleApprovalEstimate(args.estimate);
    case "promise_risk":
      return isPromiseRiskJob(args.job);
    case "return_visit":
      return isFollowUpVisit(args.job);
    case "stale_return_visit":
      return isStaleReturnVisitJob(args.job);
    case "supply_blocked":
      return Number(args.supplyBlockerCount ?? 0) > 0;
    case "readiness_risk":
      return isVisitReadinessRisk({
        estimate: args.estimate,
        job: args.job
      });
    case "approved_release":
      return isVisitApprovedReleaseReady(args.job, args.estimate);
    case "ready_dispatch":
      return workflowState === "ready_to_dispatch";
    case "live":
      return workflowState === "live";
    case "billing_follow_up": {
      if (Number(args.openPaymentHandoffCount ?? 0) > 0) {
        return true;
      }

      if (workflowState !== "completed") {
        return false;
      }

      const billingState = getBillingState(args.invoice);
      return billingState !== "closed_paid" && billingState !== "voided";
    }
    default:
      return false;
  }
}

function getInvoiceWorkspaceHref(invoice: Invoice | null, jobId: string, returnScope: string) {
  if (!invoice) {
    return buildVisitInvoiceHref(jobId, { returnScope });
  }

  return invoice.status === "draft"
    ? buildVisitInvoiceHref(jobId, { returnScope })
    : buildVisitInvoiceHref(jobId, { returnScope });
}

function getInvoiceWorkspaceLabel(invoice: Invoice | null, workflowState: VisitWorkflowState | null) {
  if (!invoice) {
    return workflowState === "completed" ? "Start invoice" : "Open billing";
  }

  return invoice.status === "draft" ? "Edit invoice draft" : "Open invoice";
}

function getFieldArtifactSummary(args: {
  inspectionStatus: string | null;
  photoCount: number;
  scheduleLabel: string;
}) {
  const inspectionSummary =
    args.inspectionStatus === "completed"
      ? "Inspection complete"
      : args.inspectionStatus
        ? `Inspection ${formatLabel(args.inspectionStatus)}`
        : "Inspection not started";
  const photoSummary =
    args.photoCount > 0 ? `${args.photoCount} photo${args.photoCount === 1 ? "" : "s"}` : "No photos";

  return {
    copy: `${inspectionSummary}. ${photoSummary}. Schedule is currently tracked as ${args.scheduleLabel}.`,
    status: inspectionSummary,
    title: "Field evidence",
    value: photoSummary
  };
}

type SelectedProcurementDetail = Awaited<ReturnType<typeof getVisitProcurementDetail>>;
type SelectedEstimateWorkspace = EstimateWorkspace | null;
type CustomerSiteRecord = NonNullable<Awaited<ReturnType<typeof listAddressesByCustomer>>["data"]>[number];
type VisitSiteJobSnapshot = Pick<
  Database["public"]["Tables"]["jobs"]["Row"],
  "id" | "title" | "status" | "service_site_id" | "scheduled_start_at" | "arrival_window_start_at" | "updated_at"
>;

async function getOptionalProcurementDetail(client: AppSupabaseClient, jobId: string) {
  try {
    return { data: await getVisitProcurementDetail(client, jobId), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Failed to load procurement detail.")
    };
  }
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

async function ensureVisitEstimateBuilderWorkspace(args: {
  actorUserId: string;
  client: AppSupabaseClient;
  companyId: string;
  visit: {
    id: string;
    title: string;
    vehicleId: string;
  };
}) {
  const existingWorkspace = await getEstimateWorkspaceByJobId(args.client, args.companyId, args.visit.id);

  if (existingWorkspace) {
    if (existingWorkspace.estimate.status !== "draft") {
      throw new Error("Only draft estimates can be edited from the visit thread.");
    }

    return existingWorkspace;
  }

  const vehicleResult = await getVehicleById(args.client, args.visit.vehicleId);

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle could not be loaded.");
  }

  const seed = buildDefaultEstimateWorkspaceSeed({
    jobId: args.visit.id,
    jobTitle: args.visit.title,
    vehicleLabel: getVehicleDisplayName({
      year: vehicleResult.data.year,
      make: vehicleResult.data.make,
      model: vehicleResult.data.model
    })
  });

  return createEstimateWorkspace(args.client, {
    companyId: args.companyId,
    createdByUserId: args.actorUserId,
    jobId: args.visit.id,
    estimateNumber: seed.estimateNumber,
    notes: null,
    terms: null,
    title: seed.title
  });
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

  return previewLines.slice(0, 3);
}

function getSupplyArtifactSummary(args: {
  inventoryIssueCount: number;
  procurementDetail: SelectedProcurementDetail | null;
}) {
  if (!args.procurementDetail) {
    return {
      copy: "Supply coverage could not be loaded. Open parts or inventory before closing the loop on this visit.",
      status: "Snapshot unavailable",
      title: "Supply",
      value: "Unavailable"
    };
  }

  const requestCount = args.procurementDetail.requests.length;
  const cartCount = args.procurementDetail.carts.length;
  const purchaseOrderCount = args.procurementDetail.purchaseOrders.length;
  const openLineCount = args.procurementDetail.jobPartsSummary.openLineCount;
  const coreOutstandingCount = args.procurementDetail.jobPartsSummary.coreOutstandingCount;
  const blockerCount = openLineCount + args.inventoryIssueCount + coreOutstandingCount;

  if (!requestCount && !cartCount && !purchaseOrderCount && !blockerCount) {
    return {
      copy: "No sourcing or stock blockers are open. Parts coverage is clear from the visit rail.",
      status: "Clear",
      title: "Supply",
      value: "No blockers"
    };
  }

  return {
    copy: `${requestCount} request${requestCount === 1 ? "" : "s"}, ${cartCount} cart${cartCount === 1 ? "" : "s"}, and ${purchaseOrderCount} PO${purchaseOrderCount === 1 ? "" : "s"} are tied to this visit. ${openLineCount} part line${openLineCount === 1 ? "" : "s"} still need coverage, ${args.inventoryIssueCount} inventory issue${args.inventoryIssueCount === 1 ? "" : "s"} remain open, and ${coreOutstandingCount} core return${coreOutstandingCount === 1 ? "" : "s"} are still outstanding.`,
    status: blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}` : "In motion",
    title: "Supply",
    value: `${requestCount}/${cartCount}/${purchaseOrderCount}`
  };
}

function getCommercialPanel(args: {
  estimate: Estimate | null;
  invoice: Invoice | null;
  invoiceBalanceDueCents: number | null;
  workflowState: VisitWorkflowState | null;
}) {
  if (args.workflowState === "completed") {
    const billingState = getBillingState(args.invoice);

    return {
      copy:
        billingState === "needs_invoice"
          ? args.estimate
            ? `${args.estimate.estimateNumber} is approved pricing, but billing has not started.`
            : "Field work is closed, but billing has not started."
          : billingState === "invoice_draft"
            ? "The invoice exists, but it still needs release."
            : billingState === "payment_due"
              ? "The invoice is out and payment collection is still open."
              : billingState === "closed_paid"
                ? "The invoice is attached and the balance is clear."
                : "This invoice was voided and no longer drives follow-up.",
      title:
        billingState === "needs_invoice"
          ? "Ready to invoice"
          : billingState === "invoice_draft"
            ? "Invoice draft"
            : billingState === "payment_due"
              ? "Payment due"
              : billingState === "closed_paid"
                ? "Paid and closed"
                : "Invoice voided",
      value: args.invoice
        ? args.invoiceBalanceDueCents && args.invoiceBalanceDueCents > 0
          ? formatCurrencyFromCents(args.invoiceBalanceDueCents)
          : "Paid"
        : args.estimate
          ? formatCurrencyFromCents(args.estimate.totalCents)
          : "Not started"
    };
  }

  if (!args.estimate) {
    return {
      copy: "Capture pricing before the visit moves deeper into scheduling, dispatch, or field work.",
      title: "Estimate not started",
      value: "Not started"
    };
  }

  if (args.estimate.status === "draft") {
    return {
      copy: `${args.estimate.estimateNumber} is still being built and has not been shared yet.`,
      title: "Estimate in draft",
      value: formatCurrencyFromCents(args.estimate.totalCents)
    };
  }

  if (args.estimate.status === "sent") {
    return {
      copy: `${args.estimate.estimateNumber} is out for approval before the visit can close cleanly.`,
      title: "Awaiting approval",
      value: formatCurrencyFromCents(args.estimate.totalCents)
    };
  }

  if (args.estimate.status === "accepted") {
    return {
      copy: `${args.estimate.estimateNumber} is approved and ready to convert into finished work and billing.`,
      title: "Approved estimate",
      value: formatCurrencyFromCents(args.estimate.totalCents)
    };
  }

  if (args.estimate.status === "declined") {
    return {
      copy: `${args.estimate.estimateNumber} was declined and likely needs an alternate recommendation or follow-up.`,
      title: "Estimate declined",
      value: formatCurrencyFromCents(args.estimate.totalCents)
    };
  }

  return {
    copy: `${args.estimate.estimateNumber} is no longer active and should be reviewed before more work is staged.`,
    title: "Estimate voided",
    value: formatCurrencyFromCents(args.estimate.totalCents)
  };
}

function getWorkflowCheckpoint(args: {
  estimateStatus: string | null;
  inspectionStatus: string | null;
  invoiceBalanceDueCents: number | null;
  invoiceStatus: string | null;
  photoCount: number;
}) {
  const reminders: string[] = [];

  if (args.inspectionStatus !== "completed") {
    reminders.push(args.inspectionStatus ? `Inspection is ${args.inspectionStatus}.` : "Inspection has not started.");
  }

  if (args.estimateStatus === "draft") {
    reminders.push("Estimate is still in draft.");
  }

  if (args.estimateStatus === "sent") {
    reminders.push("Estimate approval is still pending.");
  }

  if (!args.invoiceStatus) {
    reminders.push("Invoice has not been created yet.");
  } else if (args.invoiceBalanceDueCents && args.invoiceBalanceDueCents > 0) {
    reminders.push(`Balance due is ${formatCurrencyFromCents(args.invoiceBalanceDueCents)}.`);
  }

  if (args.photoCount === 0) {
    reminders.push("No supporting photos are attached.");
  }

  if (!reminders.length) {
    return {
      body: "Inspection, estimate, invoice, payment, and photos all look ready for closeout.",
      title: "Workflow is in a clean handoff state",
      tone: "success" as const
    };
  }

  return {
    body: reminders.join(" "),
    title: "Open workflow items still need attention",
    tone: "warning" as const
  };
}

export async function VisitsWorkspacePageImpl({ searchParams }: VisitsPageProps) {
  const context = await requireCompanyContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawScope = getSearchParam(resolvedSearchParams.scope);
  const rawStatus = getSearchParam(resolvedSearchParams.status);
  const rawWorkflowState = getSearchParam(resolvedSearchParams.workflowState);
  const visitRoleFocus = getVisitRoleFocus(context.membership.role);
  const visitDrawerRoleFocus = getVisitDrawerRoleFocus(context.membership.role);
  const visitActionLabels = getVisitActionLabels(context.membership.role);
  const rawAssignedTechnicianUserId = getSearchParam(resolvedSearchParams.assignedTechnicianUserId);
  const rawDateFrom = getDateInputValue(getSearchParam(resolvedSearchParams.dateFrom));
  const rawDateTo = getDateInputValue(getSearchParam(resolvedSearchParams.dateTo));
  const rawDetailTab = getSearchParam(resolvedSearchParams.detailTab);
  const rawFocusMode = getSearchParam(resolvedSearchParams.focus);
  const rawJobId = getSearchParam(resolvedSearchParams.jobId);
  const rawQuery = getSearchParam(resolvedSearchParams.query);
  const operatorFocusMode =
    rawFocusMode === "1" || rawFocusMode.toLowerCase() === "true" || rawFocusMode.toLowerCase() === "yes";
  const defaultDrawerTab = getVisitDrawerDefaultTab(visitDrawerRoleFocus.sectionOrder);
  const hasExplicitVisitScope = isVisitScope(rawScope);
  const useRoleDefaultVisitScope = Boolean(
    !hasExplicitVisitScope &&
      !rawAssignedTechnicianUserId &&
      !rawDateFrom &&
      !rawDateTo &&
      !rawJobId &&
      !rawQuery &&
      !rawStatus &&
      !rawWorkflowState
  );
  const filters: VisitsFilterState = {
    assignedTechnicianUserId: rawAssignedTechnicianUserId,
    dateFrom: rawDateFrom,
    dateTo: rawDateTo,
    detailTab: normalizeVisitDrawerTab(rawDetailTab, defaultDrawerTab),
    focus: operatorFocusMode ? "1" : "",
    jobId: rawJobId,
    query: rawQuery,
    scope: hasExplicitVisitScope ? rawScope : useRoleDefaultVisitScope ? visitRoleFocus.defaultValue : "",
    status: jobStatuses.includes(rawStatus as JobStatus) ? rawStatus : "",
    workflowState: isVisitWorkflowState(rawWorkflowState) ? rawWorkflowState : ""
  };

  const [jobsResult, techniciansResult] = await Promise.all([
    listVisitsByCompany(context.supabase, context.companyId, {
      assignedTechnicianUserId: filters.assignedTechnicianUserId || undefined,
      dateFrom: getDateTimeStart(filters.dateFrom),
      dateTo: getDateTimeEnd(filters.dateTo),
      query: filters.query || undefined,
      status: (filters.status || undefined) as JobStatus | undefined
    }),
    listAssignableTechniciansByCompany(context.supabase, context.companyId)
  ]);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Visits could not load visits.");
  }

  if (techniciansResult.error) {
    throw toServerError(
      techniciansResult.error,
      "Visits could not load technician owners."
    );
  }

  const queriedVisits = jobsResult.data ?? [];
  const workflowScopedVisits = filters.workflowState
    ? queriedVisits.filter((job) => getVisitWorkflowState(job) === filters.workflowState)
    : queriedVisits;
  const workflowScopedVisitIds = workflowScopedVisits.map((job) => job.id);
  const [estimatesResult, invoicesResult, visitCommunicationsResult, openPartRequestsResult, inventoryIssuesResult] = await Promise.all([
    listServiceHistoryEstimatesByJobIds(
      context.supabase,
      context.companyId,
      workflowScopedVisitIds
    ),
    listServiceHistoryInvoicesByJobIds(
      context.supabase,
      context.companyId,
      workflowScopedVisitIds
    ),
    workflowScopedVisitIds.length
      ? context.supabase
          .from("customer_communications")
          .select("job_id, communication_type, created_at")
          .in("job_id", workflowScopedVisitIds)
          .order("created_at", { ascending: false })
          .returns<JobCommunicationSnapshotRow[]>()
      : Promise.resolve({ data: [], error: null }),
    workflowScopedVisitIds.length
      ? context.supabase
          .from("part_requests")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .eq("status", "open")
          .in("job_id", workflowScopedVisitIds)
          .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>()
      : Promise.resolve({ data: [], error: null }),
    workflowScopedVisitIds.length
      ? context.supabase
          .from("job_inventory_issues")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .in("job_id", workflowScopedVisitIds)
          .returns<
            Array<Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">>
          >()
      : Promise.resolve({ data: [], error: null })
  ]);

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Visits could not load estimates.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Visits could not load invoices.");
  }

  if (visitCommunicationsResult.error) {
    throw toServerError(
      visitCommunicationsResult.error,
      "Visits could not load customer updates."
    );
  }

  if (openPartRequestsResult.error) {
    throw toServerError(
      openPartRequestsResult.error,
      "Visits could not load open part requests."
    );
  }

  if (inventoryIssuesResult.error) {
    throw toServerError(
      inventoryIssuesResult.error,
      "Visits could not load inventory issues."
    );
  }

  const initialEstimates = getLatestEstimatesByJob(estimatesResult.data ?? []);
  const initialInvoices = getLatestInvoicesByJob(invoicesResult.data ?? []);
  const initialInvoiceIds = initialInvoices.map((invoice) => invoice.id);
  const paymentHandoffs = await listTechnicianPaymentHandoffsByInvoiceIds(
    context.supabase as any,
    initialInvoiceIds
  );
  const latestVisitCommunicationsByJobId = new Map<
    string,
    {
      communicationType: string;
      createdAt: string;
      jobId: string;
    }
  >();

  for (const entry of visitCommunicationsResult.data ?? []) {
    if (!entry.job_id || latestVisitCommunicationsByJobId.has(entry.job_id)) {
      continue;
    }

    latestVisitCommunicationsByJobId.set(entry.job_id, {
      communicationType: entry.communication_type,
      createdAt: entry.created_at,
      jobId: entry.job_id
    });
  }

  const initialVisitCommunications = [...latestVisitCommunicationsByJobId.values()];
  const estimatesByJobId = new Map(initialEstimates.map((estimate) => [estimate.jobId, estimate]));
  const invoicesByJobId = new Map(initialInvoices.map((invoice) => [invoice.jobId, invoice]));
  const openPaymentHandoffCountByInvoiceId = paymentHandoffs.reduce<Map<string, number>>(
    (counts, handoff) => {
      if (handoff.status !== "open") {
        return counts;
      }

      counts.set(handoff.invoiceId, (counts.get(handoff.invoiceId) ?? 0) + 1);
      return counts;
    },
    new Map()
  );
  const openPaymentHandoffCountByJobId = initialInvoices.reduce<Map<string, number>>(
    (counts, invoice) => {
      const openPaymentHandoffCount = openPaymentHandoffCountByInvoiceId.get(invoice.id) ?? 0;

      if (openPaymentHandoffCount > 0) {
        counts.set(invoice.jobId, openPaymentHandoffCount);
      }

      return counts;
    },
    new Map()
  );
  const workflowOpenPartRequestsByJobId = (openPartRequestsResult.data ?? []).reduce<Map<string, number>>((counts, request) => {
    counts.set(request.job_id, (counts.get(request.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const workflowInventoryIssuesByJobId = (inventoryIssuesResult.data ?? []).reduce<Map<string, number>>((counts, issue) => {
    if (issue.status === "returned" || issue.status === "consumed") {
      return counts;
    }

    counts.set(issue.job_id, (counts.get(issue.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const workflowBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId,
    inventoryIssuesByJobId: workflowInventoryIssuesByJobId,
    invoicesByJobId,
    jobs: workflowScopedVisits,
    openPartRequestsByJobId: workflowOpenPartRequestsByJobId
  });
  const scopedVisits = filters.scope
    ? workflowScopedVisits.filter((job) =>
        matchesVisitScope({
          estimate: estimatesByJobId.get(job.id) ?? null,
          invoice: invoicesByJobId.get(job.id) ?? null,
          job,
          openPaymentHandoffCount: openPaymentHandoffCountByJobId.get(job.id) ?? 0,
          scope: filters.scope as VisitScope,
          supplyBlockerCount:
            (workflowOpenPartRequestsByJobId.get(job.id) ?? 0) +
            (workflowInventoryIssuesByJobId.get(job.id) ?? 0)
        })
      )
    : workflowScopedVisits;
  const selectedVisit = scopedVisits.find((job) => job.id === filters.jobId) ?? null;
  const effectiveFilters = selectedVisit ? filters : { ...filters, jobId: "" };
  const closeVisitHref = buildVisitsHref(effectiveFilters, { jobId: "" });
  const techniciansById = new Map(
    (techniciansResult.data ?? []).map((technician) => [technician.userId, technician.displayName])
  );
  const activeFilters = Boolean(
    (filters.scope && !useRoleDefaultVisitScope) ||
      filters.query ||
      filters.status ||
      filters.workflowState ||
      filters.assignedTechnicianUserId ||
      filters.dateFrom ||
      filters.dateTo
  );
  const scopeChips = [
    filters.scope
      ? `${useRoleDefaultVisitScope ? visitRoleFocus.title : "View"}: ${getVisitScopeLabel(filters.scope as VisitScope)}`
      : null,
    filters.query ? `Search: ${filters.query}` : null,
    filters.workflowState ? `Lane: ${getVisitWorkflowLabel(filters.workflowState as VisitWorkflowState)}` : null,
    filters.status ? `Status: ${formatLabel(filters.status)}` : null,
    filters.assignedTechnicianUserId
      ? `Tech: ${techniciansById.get(filters.assignedTechnicianUserId) ?? "Assigned"}`
      : null,
    filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} to ${filters.dateTo}`
      : filters.dateFrom
        ? `From ${filters.dateFrom}`
        : filters.dateTo
          ? `Through ${filters.dateTo}`
          : null
  ].filter((value): value is string => Boolean(value));
  const financeBlockedJobIds = new Set([
    ...workflowBlockers.financeBlockedItems.map((item) => item.jobId),
    ...workflowScopedVisits
      .filter((job) => (openPaymentHandoffCountByJobId.get(job.id) ?? 0) > 0)
      .map((job) => job.id)
  ]);
  const financePaymentHandoffVisitCount = workflowScopedVisits.filter(
    (job) => (openPaymentHandoffCountByJobId.get(job.id) ?? 0) > 0
  ).length;
  const visibleWorkflowMetrics: Array<{
    key: string;
    label: string;
    meta: string;
    tone: "accent" | "success" | "warning";
    value: number;
  }> = [
    {
      key: "release",
      label: "Release handoff",
      meta: workflowBlockers.approvedReleaseCount
        ? "Approved and ready for dispatch"
        : "No approved visits waiting",
      tone: workflowBlockers.approvedReleaseCount ? ("accent" as const) : ("success" as const),
      value: workflowBlockers.approvedReleaseCount
    },
    {
      key: "supply",
      label: "Supply blocked",
      meta: workflowBlockers.supplyBlockedCount
        ? "Visits waiting on parts or stock"
        : "No supply blockers in queue",
      tone: workflowBlockers.supplyBlockedCount ? ("warning" as const) : ("success" as const),
      value: workflowBlockers.supplyBlockedCount
    },
    {
      key: "finance",
      label: "Finance follow-through",
      meta: financePaymentHandoffVisitCount
        ? "Technician billing handoffs need office review"
        : financeBlockedJobIds.size
          ? "Open-balance threads still active"
        : "No closeout drift visible",
      tone: financeBlockedJobIds.size ? ("warning" as const) : ("success" as const),
      value: financeBlockedJobIds.size
    }
  ].filter((metric, index) => metric.value > 0 || index === 0);
  const workflowCounts = {
    intake: scopedVisits.filter((job) => getVisitWorkflowState(job) === "intake").length,
    billing: scopedVisits.filter((job) => getVisitWorkflowState(job) === "completed").length,
    live: scopedVisits.filter((job) => getVisitWorkflowState(job) === "live").length,
    needsAssignment: scopedVisits.filter((job) => getVisitWorkflowState(job) === "needs_assignment").length,
    readyForDispatch: scopedVisits.filter((job) => getVisitWorkflowState(job) === "ready_to_dispatch").length
  };
  const visitScopePresets: Array<{
    count: number;
    label: string;
    scope: VisitsFilterState["scope"];
    tone: "ghost" | "secondary";
  }> = [
    {
      count: workflowScopedVisits.length,
      label: "All open",
      scope: "",
      tone: filters.scope ? "ghost" : "secondary"
    },
    {
      count: workflowScopedVisits.filter((job) => {
        const estimate = estimatesByJobId.get(job.id) ?? null;
        return !estimate || getEstimateSupportStage(estimate) === "drafting";
      }).length,
      label: "Estimate work",
      scope: "estimate_drafting",
      tone: filters.scope === "estimate_drafting" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => getVisitWorkflowState(job) === "needs_assignment").length,
      label: "Needs assignment",
      scope: "needs_assignment",
      tone: filters.scope === "needs_assignment" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => getVisitWorkflowState(job) === "ready_to_schedule").length,
      label: "Needs time",
      scope: "needs_time_promise",
      tone: filters.scope === "needs_time_promise" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => (estimatesByJobId.get(job.id) ?? null)?.status === "sent").length,
      label: "Awaiting approval",
      scope: "awaiting_approval",
      tone: filters.scope === "awaiting_approval" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => isStaleApprovalEstimate(estimatesByJobId.get(job.id) ?? null)).length,
      label: "Stale approvals",
      scope: "stale_approval",
      tone: filters.scope === "stale_approval" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => isPromiseRiskJob(job)).length,
      label: "Promise risk",
      scope: "promise_risk",
      tone: filters.scope === "promise_risk" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => isFollowUpVisit(job)).length,
      label: "Return visits",
      scope: "return_visit",
      tone: filters.scope === "return_visit" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => isStaleReturnVisitJob(job)).length,
      label: "Stale return",
      scope: "stale_return_visit",
      tone: filters.scope === "stale_return_visit" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter(
        (job) =>
          (workflowOpenPartRequestsByJobId.get(job.id) ?? 0) +
            (workflowInventoryIssuesByJobId.get(job.id) ?? 0) >
          0
      ).length,
      label: "Supply blocked",
      scope: "supply_blocked",
      tone: filters.scope === "supply_blocked" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) =>
        isVisitReadinessRisk({
          estimate: estimatesByJobId.get(job.id) ?? null,
          job
        })
      ).length,
      label: "Readiness risk",
      scope: "readiness_risk",
      tone: filters.scope === "readiness_risk" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => {
        const estimate = estimatesByJobId.get(job.id) ?? null;
        return isVisitApprovedReleaseReady(job, estimate);
      }).length,
      label: "Approved release",
      scope: "approved_release",
      tone: filters.scope === "approved_release" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => getVisitWorkflowState(job) === "ready_to_dispatch").length,
      label: "Ready dispatch",
      scope: "ready_dispatch",
      tone: filters.scope === "ready_dispatch" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) => getVisitWorkflowState(job) === "live").length,
      label: "Live",
      scope: "live",
      tone: filters.scope === "live" ? "secondary" : "ghost"
    },
    {
      count: workflowScopedVisits.filter((job) =>
        matchesVisitScope({
          estimate: estimatesByJobId.get(job.id) ?? null,
          invoice: invoicesByJobId.get(job.id) ?? null,
          job,
          openPaymentHandoffCount: openPaymentHandoffCountByJobId.get(job.id) ?? 0,
          scope: "billing_follow_up"
        })
      ).length,
      label: "Billing follow-up",
      scope: "billing_follow_up",
      tone: filters.scope === "billing_follow_up" ? "secondary" : "ghost"
    }
  ];
  const primaryVisitScopes = new Set<VisitsFilterState["scope"]>([
    "",
    "estimate_drafting",
    "needs_assignment",
    "needs_time_promise",
    "awaiting_approval",
    "promise_risk",
    "supply_blocked",
    "approved_release",
    "ready_dispatch",
    "live",
    "billing_follow_up"
  ]);
  const visitPrimaryScopePresets = visitScopePresets.filter(
    (preset) => primaryVisitScopes.has(preset.scope) || preset.scope === filters.scope
  );
  const visitSecondaryScopePresets = visitScopePresets.filter(
    (preset) => !primaryVisitScopes.has(preset.scope) && preset.scope !== filters.scope
  );
  const getVisitScopeCount = (scope: VisitScope) =>
    visitScopePresets.find((preset) => preset.scope === scope)?.count ?? 0;
  const staleApprovalVisitCount = getVisitScopeCount("stale_approval");
  const needsAssignmentVisitCount = getVisitScopeCount("needs_assignment");
  const quickLanes: Array<{
    count: number;
    label: string;
    tone: "ghost" | "secondary";
    workflowState: VisitsFilterState["workflowState"];
  }> = [
    {
      count: scopedVisits.length,
      label: "All",
      tone: filters.workflowState ? "ghost" : "secondary",
      workflowState: ""
    },
    {
      count: workflowCounts.intake,
      label: "Intake",
      tone: filters.workflowState === "intake" ? "secondary" : "ghost",
      workflowState: "intake"
    },
    {
      count: workflowCounts.needsAssignment,
      label: "Assignment",
      tone: filters.workflowState === "needs_assignment" ? "secondary" : "ghost",
      workflowState: "needs_assignment"
    },
    {
      count: workflowCounts.readyForDispatch,
      label: "Dispatch",
      tone: filters.workflowState === "ready_to_dispatch" ? "secondary" : "ghost",
      workflowState: "ready_to_dispatch"
    },
    {
      count: workflowCounts.live,
      label: "Live",
      tone: filters.workflowState === "live" ? "secondary" : "ghost",
      workflowState: "live"
    },
    {
      count: workflowCounts.billing,
      label: "Billing",
      tone: filters.workflowState === "completed" ? "secondary" : "ghost",
      workflowState: "completed"
    }
  ];
  const defaultVisitsHref = buildVisitsHref(filters, {
    assignedTechnicianUserId: "",
    dateFrom: "",
    dateTo: "",
    detailTab: filters.detailTab,
    jobId: "",
    query: "",
    scope: useRoleDefaultVisitScope ? visitRoleFocus.defaultValue : "",
    status: "",
    workflowState: ""
  });
  const currentVisitsSliceHref = buildVisitsHref(filters, {
    jobId: ""
  });
  const focusToggleVisitsHref = buildVisitsHref(filters, {
    focus: operatorFocusMode ? "" : "1"
  });
  const currentVisitSliceLabel =
    visitScopePresets.find((preset) => preset.scope === filters.scope)?.label ??
    quickLanes.find((lane) => lane.workflowState === filters.workflowState)?.label ??
    (filters.query
      ? "Search slice"
      : filters.status || filters.assignedTechnicianUserId || filters.dateFrom || filters.dateTo
        ? "Filtered queue"
        : operatorFocusMode
          ? "Focus queue"
          : "Production queue");
  const threadDominantQueueTools = Boolean(selectedVisit);
  const compactVisitsHero = operatorFocusMode || threadDominantQueueTools || scopedVisits.length > 0;
  const visitSavedSliceSuggestions = [
    {
      href: defaultVisitsHref,
      id: "production-queue",
      label: "Production queue",
      tone: "ghost" as const
    },
    ...visitRoleFocus.entries.map((entry) => ({
      href: buildVisitsHref(filters, {
        assignedTechnicianUserId: "",
        dateFrom: "",
        dateTo: "",
        detailTab: filters.detailTab,
        focus: operatorFocusMode ? "1" : "",
        jobId: "",
        query: "",
        scope: entry.value,
        status: "",
        workflowState: ""
      }),
      id: `role:${entry.value}`,
      label: entry.label,
      tone: "ghost" as const
    }))
  ].filter(
    (slice, index, collection) =>
      collection.findIndex((candidate) => candidate.href === slice.href) === index
  );
  const prioritizeDrawerCustomerUpdates = visitDrawerRoleFocus.sectionOrder[0] === "customer_updates";
  const prioritizeDrawerCommercialState = visitDrawerRoleFocus.sectionOrder[0] === "commercial_state";
  const prioritizeDrawerExceptionOwnership = visitDrawerRoleFocus.sectionOrder[0] === "exception_ownership";

  let selectedInspection = null;
  let selectedEstimate = selectedVisit ? estimatesByJobId.get(selectedVisit.id) ?? null : null;
  let selectedInvoice = null;
  let selectedInvoiceBalanceDueCents: number | null = null;
  let selectedInventoryIssueCount = 0;
  let selectedEstimateLinkSummary: Awaited<ReturnType<typeof getEstimateAccessLinkSummary>> | null = null;
  let selectedInvoiceLinkSummary: Awaited<ReturnType<typeof getInvoiceAccessLinkSummary>> | null = null;
  let selectedVisitRecord: Awaited<ReturnType<typeof getVisitById>>["data"] | null = null;
  let selectedVisitLinkSummary: Awaited<ReturnType<typeof getVisitAccessLinkSummary>> | null = null;
  let selectedCommunications:
    | Awaited<ReturnType<typeof listVisitCommunications>>["data"]
    | null = null;
  let selectedNotes:
    | Awaited<ReturnType<typeof listVisitNotesById>>["data"]
    | null = null;
  let selectedStatusHistory:
    | Awaited<ReturnType<typeof listVisitStatusHistory>>["data"]
    | null = null;
  let selectedAttachments:
    | Awaited<ReturnType<typeof listVisitAttachments>>["data"]
    | null = null;
  let selectedPhotoCount = 0;
  let selectedProcurementDetail: SelectedProcurementDetail | null = null;
  let selectedEstimateWorkspace: SelectedEstimateWorkspace = null;
  let selectedSnapshotUnavailable = false;
  let selectedTechnicianPreview:
    | Awaited<ReturnType<typeof getTechnicianProfilePreview>>
    | null = null;
  let selectedVisitChain:
    | Awaited<ReturnType<typeof getVehicleServiceHistory>>
    | null = null;
  let selectedVisitCustomer: Awaited<ReturnType<typeof getCustomerById>>["data"] | null = null;
  let selectedCustomerVehicles: Awaited<ReturnType<typeof listVehiclesByCustomer>>["data"] | null = null;
  let selectedCustomerSites: Awaited<ReturnType<typeof listAddressesByCustomer>>["data"] | null = null;
  let selectedCustomerSiteJobs: VisitSiteJobSnapshot[] = [];

  if (selectedVisit) {
    const [
      jobResult,
      inspectionResult,
      invoiceResult,
      attachmentsResult,
      notesResult,
      procurementDetailResult,
      estimateWorkspaceResult,
      inventoryIssuesResult,
      communicationsResult,
      statusHistoryResult
    ] = await Promise.all([
      getVisitById(context.supabase, selectedVisit.id),
      getInspectionByVisitId(context.supabase, selectedVisit.id),
      getInvoiceByVisitId(context.supabase, selectedVisit.id),
      listVisitAttachments(context.supabase, selectedVisit.id),
      listVisitNotesById(context.supabase, selectedVisit.id),
      getOptionalProcurementDetail(context.supabase, selectedVisit.id),
      getOptionalEstimateWorkspace(context.supabase, context.companyId, selectedVisit.id),
      listVisitInventoryIssuesById(context.supabase, selectedVisit.id),
      listVisitCommunications(context.supabase, selectedVisit.id, { limit: 3 }),
      listVisitStatusHistory(context.supabase, selectedVisit.id)
    ]);

    selectedSnapshotUnavailable =
      Boolean(jobResult.error) ||
      Boolean(inspectionResult.error) ||
      Boolean(invoiceResult.error) ||
      Boolean(attachmentsResult.error) ||
      Boolean(notesResult.error) ||
      Boolean(procurementDetailResult.error) ||
      Boolean(estimateWorkspaceResult.error) ||
      Boolean(inventoryIssuesResult.error) ||
      Boolean(communicationsResult.error) ||
      Boolean(statusHistoryResult.error);
    selectedVisitRecord =
      !jobResult.error && jobResult.data && jobResult.data.companyId === context.companyId
        ? jobResult.data
        : null;
    selectedInspection = inspectionResult.data ?? null;
    selectedInvoice = invoiceResult.data ?? null;
    selectedInventoryIssueCount =
      inventoryIssuesResult.data?.filter(
        (issue) => issue.status !== "returned" && issue.status !== "consumed"
      ).length ?? 0;
    selectedCommunications = communicationsResult.data ?? null;
    selectedNotes = notesResult.data ?? null;
    selectedStatusHistory = statusHistoryResult.data?.slice(0, 3) ?? null;
    selectedAttachments = attachmentsResult.data ?? null;
    selectedPhotoCount = selectedAttachments?.length ?? 0;
    selectedProcurementDetail = procurementDetailResult.data;
    selectedEstimateWorkspace = estimateWorkspaceResult.data;

    if (selectedInvoice) {
      const invoiceDetailResult = await getInvoiceDetailById(context.supabase, selectedInvoice.id);
      selectedSnapshotUnavailable = selectedSnapshotUnavailable || Boolean(invoiceDetailResult.error);
      selectedInvoiceBalanceDueCents = invoiceDetailResult.data?.totals.balanceDueCents ?? null;
    }

    if (selectedEstimate?.status === "sent") {
      try {
        selectedEstimateLinkSummary = await getEstimateAccessLinkSummary(selectedEstimate.id);
      } catch {
        selectedSnapshotUnavailable = true;
      }
    }

    if (selectedInvoice && ["issued", "partially_paid"].includes(selectedInvoice.status)) {
      try {
        selectedInvoiceLinkSummary = await getInvoiceAccessLinkSummary(selectedInvoice.id);
      } catch {
        selectedSnapshotUnavailable = true;
      }
    }

    if (selectedVisit.assignedTechnicianUserId) {
      try {
        selectedTechnicianPreview = await getTechnicianProfilePreview(
          context.supabase,
          selectedVisit.assignedTechnicianUserId
        );
        selectedVisitLinkSummary = selectedTechnicianPreview.isReady
          ? await getVisitAccessLinkSummary(selectedVisit.id)
          : null;
      } catch {
        selectedSnapshotUnavailable = true;
      }
    }

    if (selectedVisitRecord?.vehicleId) {
      try {
        selectedVisitChain = await getVehicleServiceHistory(
          context.supabase,
          context.companyId,
          selectedVisitRecord.vehicleId,
          {}
        );
      } catch {
        selectedSnapshotUnavailable = true;
      }
    }

    if (selectedVisitRecord?.customerId) {
      const [selectedCustomerResult, customerSitesResult, customerVehiclesResult, customerSiteJobsResult] =
        await Promise.all([
        getCustomerById(context.supabase, selectedVisitRecord.customerId),
        listAddressesByCustomer(context.supabase, selectedVisitRecord.customerId),
        listVehiclesByCustomer(context.supabase, selectedVisitRecord.customerId),
        context.supabase
          .from("jobs")
          .select(
            "id, title, status, service_site_id, scheduled_start_at, arrival_window_start_at, updated_at"
          )
          .eq("company_id", context.companyId)
          .eq("customer_id", selectedVisitRecord.customerId)
          .returns<VisitSiteJobSnapshot[]>()
      ]);

      selectedSnapshotUnavailable =
        selectedSnapshotUnavailable ||
        Boolean(selectedCustomerResult.error) ||
        Boolean(customerSitesResult.error) ||
        Boolean(customerVehiclesResult.error) ||
        Boolean(customerSiteJobsResult.error);
      selectedVisitCustomer =
        !selectedCustomerResult.error &&
        selectedCustomerResult.data &&
        selectedCustomerResult.data.companyId === context.companyId
          ? selectedCustomerResult.data
          : null;
      selectedCustomerSites = customerSitesResult.data ?? null;
      selectedCustomerVehicles = customerVehiclesResult.data ?? null;
      selectedCustomerSiteJobs = customerSiteJobsResult.data ?? [];
    }
  }

  const selectedBillingState = getBillingState(selectedInvoice);
  const selectedWorkflowState = selectedVisit ? getVisitWorkflowState(selectedVisit) : null;
  const selectedPrimaryAction = selectedVisit ? getVisitPrimaryAction(selectedVisit) : null;
  const selectedReturnScope = effectiveFilters.scope;
  const selectedPrimaryHref =
    selectedVisit
      ? buildPrimaryVisitHref(
          selectedVisit,
          context.canEditRecords,
          effectiveFilters,
          context.company.timezone
        )
      : "";
  const selectedSchedule = selectedVisit ? getScheduleSummary(selectedVisit, context.company.timezone) : null;
  const selectedPrimaryServiceSite =
    selectedCustomerSites?.find((site) => site.isPrimary) ?? selectedCustomerSites?.[0] ?? null;
  const selectedExplicitServiceSite =
    selectedVisitRecord?.serviceSiteId && selectedCustomerSites
      ? selectedCustomerSites.find((site) => site.id === selectedVisitRecord.serviceSiteId) ?? null
      : null;
  const selectedServiceSite = selectedExplicitServiceSite ?? selectedPrimaryServiceSite;
  const selectedUsesPrimarySiteFallback = Boolean(
    selectedServiceSite && !selectedExplicitServiceSite && selectedVisitRecord && !selectedVisitRecord.serviceSiteId
  );
  const selectedServiceSiteJobs = selectedServiceSite
    ? selectedCustomerSiteJobs.filter(
        (job) =>
          job.service_site_id === selectedServiceSite.id ||
          (!job.service_site_id && selectedPrimaryServiceSite?.id === selectedServiceSite.id)
      )
    : [];
  const selectedServiceSiteLatestJob =
    [...selectedServiceSiteJobs].sort(
      (left, right) =>
        Date.parse(
          right.scheduled_start_at ??
            right.arrival_window_start_at ??
            right.updated_at ??
            "1970-01-01T00:00:00.000Z"
        ) -
        Date.parse(
          left.scheduled_start_at ??
            left.arrival_window_start_at ??
            left.updated_at ??
            "1970-01-01T00:00:00.000Z"
        )
    )[0] ?? null;
  const selectedServiceSiteActiveVisitCount = selectedServiceSiteJobs.filter((job) =>
    isLiveSiteVisitStatus(job.status)
  ).length;
  const selectedServiceSitePeerCount =
    selectedCustomerSites?.filter((site) => site.isActive && site.id !== selectedServiceSite?.id).length ?? 0;
  const selectedCustomerSitePlaybookGapCount = (selectedCustomerSites ?? []).filter(
    (site) => site.isActive && !hasServiceSitePlaybook(site)
  ).length;
  const selectedServiceSitePlaybookCopy = selectedServiceSite
    ? getServiceSitePlaybookCopy(selectedServiceSite)
    : "";
  const selectedCustomerThreadHref = selectedVisitRecord
    ? buildCustomerWorkspaceHref(selectedVisitRecord.customerId)
    : "";
  const selectedCustomerSitesHref = selectedVisitRecord
    ? buildCustomerWorkspaceHref(selectedVisitRecord.customerId, { tab: "addresses" })
    : "";
  const selectedIsCommercialAccount = selectedVisitCustomer?.relationshipType === "fleet_account";
  const selectedBillingSite =
    (selectedCustomerSites ?? []).find((site) => site.label === "billing" && site.isActive) ??
    (selectedCustomerSites ?? []).find((site) => site.label === "billing") ??
    null;
  const selectedFleetUnits = (selectedCustomerVehicles ?? []).filter(
    (vehicle) => vehicle.ownershipType === "fleet_account_asset"
  );
  const selectedActiveFleetUnitCount = selectedFleetUnits.filter((vehicle) => vehicle.isActive).length;
  const selectedRetailVehicleCount = (selectedCustomerVehicles ?? []).filter(
    (vehicle) => vehicle.ownershipType === "customer_owned" && vehicle.isActive
  ).length;
  const selectedAccountContactName = selectedVisitCustomer
    ? [selectedVisitCustomer.firstName, selectedVisitCustomer.lastName].filter(Boolean).join(" ").trim()
    : "";
  const selectedAccountContactValue =
    selectedAccountContactName ||
    selectedVisitCustomer?.companyName ||
    selectedVisit?.customerDisplayName ||
    "No account contact";
  const selectedAccountContactCopy = selectedVisitCustomer
    ? [selectedVisitCustomer.email, selectedVisitCustomer.phone].filter(Boolean).join(" · ") ||
      "No account phone or email is attached to this commercial thread yet."
    : "No account phone or email is attached to this commercial thread yet.";
  const selectedCommercialBillingValue = selectedBillingSite
    ? selectedBillingSite.siteName ?? selectedBillingSite.label
    : selectedInvoiceBalanceDueCents
      ? `${formatCurrencyFromCents(selectedInvoiceBalanceDueCents)} still open`
      : "No billing anchor";
  const selectedCommercialBillingCopy = selectedBillingSite
    ? formatServiceSiteAddress(selectedBillingSite) || "Billing-site address details are still missing."
    : selectedInvoiceBalanceDueCents
      ? "Finance still has open balance on this account, but no dedicated billing site is attached to the commercial thread yet."
      : "Add a billing site or billing contact so commercial closeout is not reconstructed from notes later.";
  const selectedCommercialUnitValue = selectedActiveFleetUnitCount
    ? `${selectedActiveFleetUnitCount} active unit${selectedActiveFleetUnitCount === 1 ? "" : "s"}`
    : selectedFleetUnits.length
      ? `${selectedFleetUnits.length} unit${selectedFleetUnits.length === 1 ? "" : "s"}`
      : selectedRetailVehicleCount
        ? `${selectedRetailVehicleCount} customer vehicle${selectedRetailVehicleCount === 1 ? "" : "s"}`
        : "No units on file";
  const selectedCommercialUnitCopy = selectedFleetUnits.length
    ? `${selectedRetailVehicleCount ? `${selectedRetailVehicleCount} customer vehicle${selectedRetailVehicleCount === 1 ? "" : "s"} also stay attached to this account thread.` : "Recurring fleet units should stay attached to the service-site and billing context instead of behaving like a separate desk."}`
    : "Add the first account unit or parked asset so repeat-service context belongs to this commercial thread.";
  const selectedCustomerFinanceDeskHref =
    selectedVisitCustomer?.companyName || selectedVisit?.customerDisplayName
      ? `/dashboard/finance?query=${encodeURIComponent(
          selectedVisitCustomer?.companyName ?? selectedVisit?.customerDisplayName ?? ""
        )}`
      : "/dashboard/finance";
  const selectedServiceSiteVisitHref = selectedServiceSiteLatestJob
    ? buildVisitsHref(effectiveFilters, { jobId: selectedServiceSiteLatestJob.id })
    : selectedCustomerSitesHref;
  const selectedVisitEditHref = selectedVisit
    ? buildVisitEditHref(selectedVisit.id, {
        returnLabel: "Back to visit thread",
        returnTo: buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id })
      })
    : "";
  const selectedWorkflowCheckpoint =
    selectedVisit && selectedEstimate
      ? getWorkflowCheckpoint({
          estimateStatus: selectedEstimate.status,
          inspectionStatus: selectedInspection?.status ?? null,
          invoiceBalanceDueCents: selectedInvoiceBalanceDueCents,
          invoiceStatus: selectedInvoice?.status ?? null,
          photoCount: selectedPhotoCount
        })
      : selectedVisit
        ? getWorkflowCheckpoint({
            estimateStatus: null,
            inspectionStatus: selectedInspection?.status ?? null,
            invoiceBalanceDueCents: selectedInvoiceBalanceDueCents,
            invoiceStatus: selectedInvoice?.status ?? null,
            photoCount: selectedPhotoCount
          })
        : null;
  const selectedCommercialPanel = getCommercialPanel({
    estimate: selectedEstimate,
    invoice: selectedInvoice,
    invoiceBalanceDueCents: selectedInvoiceBalanceDueCents,
    workflowState: selectedWorkflowState
  });
  const invoiceArtifactSummary = getInvoiceArtifactSummary(
    selectedInvoice,
    selectedInvoiceBalanceDueCents
  );
  const fieldArtifactSummary = getFieldArtifactSummary({
    inspectionStatus: selectedInspection?.status ?? null,
    photoCount: selectedPhotoCount,
    scheduleLabel: selectedSchedule ? `${selectedSchedule.label} ${selectedSchedule.value}` : "not set"
  });
  const supplyArtifactSummary = getSupplyArtifactSummary({
    inventoryIssueCount: selectedInventoryIssueCount,
    procurementDetail: selectedProcurementDetail
  });
  const selectedOpenPartRequestCount =
    selectedProcurementDetail?.requests.filter((request) => request.status === "open").length ?? 0;
  const selectedEstimateWorkspaceHref = selectedVisit
    ? buildEstimateHref(selectedVisit.id, selectedEstimate, selectedReturnScope)
    : "";
  const selectedEstimateSupportHref = selectedVisit
    ? buildVisitEstimateSupportHref(selectedVisit, selectedEstimate)
    : "/dashboard/visits?workflowState=intake";
  const selectedEstimateSupportSummary = getVisitEstimateSupportSummary(selectedEstimate);
  const selectedEstimateWorkspaceSummary = selectedEstimateWorkspace?.summary ?? null;
  const selectedEstimatePrimarySection = selectedEstimateWorkspace?.sections[0]?.section ?? null;
  const selectedDispatchBoardHref = selectedVisit
    ? buildDispatchHref(selectedVisit, context.company.timezone)
    : "";
  const selectedEstimatePreviewLines = selectedEstimateWorkspace
    ? getEstimateWorkspacePreviewLines(selectedEstimateWorkspace)
    : [];
  const selectedInvoiceWorkspaceHref = selectedVisit
    ? getInvoiceWorkspaceHref(selectedInvoice, selectedVisit.id, selectedReturnScope)
    : "";
  const selectedFieldWorkspaceHref = selectedVisit
    ? buildVisitInspectionHref(selectedVisit.id, { returnScope: selectedReturnScope })
    : "";
  const selectedPhotoWorkspaceHref = selectedVisit
    ? buildVisitPhotosHref(selectedVisit.id, { returnScope: selectedReturnScope })
    : "";
  const selectedPartsWorkspaceHref = selectedVisit
    ? buildVisitPartsHref(selectedVisit.id, { returnScope: selectedReturnScope })
    : "";
  const selectedInventoryWorkspaceHref = selectedVisit
    ? buildVisitInventoryHref(selectedVisit.id, { returnScope: selectedReturnScope })
    : "";
  const selectedFieldRailHref = selectedVisit
    ? `${buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id })}#visit-field-evidence`
    : "";
  const selectedFieldPhotosRailHref = selectedVisit
    ? `${buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id })}#visit-field-evidence-photos`
    : "";
  const selectedHasFieldEvidenceJump = Boolean(selectedInspection || selectedPhotoCount);
  const selectedHasPhotoJump = selectedPhotoCount > 0;
  const selectedProductionControlsRailHref = selectedVisit
    ? `${buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id })}#visit-production-controls`
    : "";
  const selectedDrawerTab = filters.detailTab as VisitDrawerTab;
  const canContinueEstimateBuilderFromThread =
    selectedDrawerTab === "thread" && context.canEditRecords && (!selectedEstimate || selectedEstimate.status === "draft");
  const selectedThreadTabHref = selectedVisit
    ? buildVisitsHref(effectiveFilters, { detailTab: "thread", jobId: selectedVisit.id })
    : "";
  const selectedCommercialTabHref = selectedVisit
    ? buildVisitsHref(effectiveFilters, { detailTab: "commercial", jobId: selectedVisit.id })
    : "";
  const selectedSupportTabHref = selectedVisit
    ? buildVisitsHref(effectiveFilters, { detailTab: "support", jobId: selectedVisit.id })
    : "";
  const selectedThreadCompanionHref = selectedOpenPartRequestCount
    ? selectedPartsWorkspaceHref
    : selectedInventoryIssueCount > 0
      ? selectedInventoryWorkspaceHref
      : buildVisitDetailHref(selectedVisit?.id ?? "", { returnScope: selectedReturnScope });
  const selectedThreadCompanionLabel = selectedOpenPartRequestCount
    ? "Open parts"
    : selectedInventoryIssueCount > 0
      ? "Open inventory"
      : "Full visit";
  const selectedPromiseSummary = selectedVisit
    ? getVisitPromiseSummary({
        communications: selectedCommunications ?? [],
        job: selectedVisit
      })
    : null;
  const selectedReadinessSummary = selectedVisit
    ? getVisitReadinessSummary({
        communications: selectedCommunications ?? [],
        estimate: selectedEstimate ?? null,
        inspectionStatus: selectedInspection?.status ?? null,
        inventoryIssueCount: selectedInventoryIssueCount,
        invoice: selectedInvoice ?? null,
        job: selectedVisit,
        noteCount: selectedNotes?.length ?? 0,
        openPartRequestCount: selectedOpenPartRequestCount,
        photoCount: selectedPhotoCount
      })
    : null;
  const selectedTrustSummary = selectedVisit
    ? getVisitTrustSummary({
        communications: selectedCommunications ?? [],
        estimate: selectedEstimate ?? null,
        invoice: selectedInvoice
          ? {
              balanceDueCents:
                selectedInvoiceBalanceDueCents ?? selectedInvoice.balanceDueCents,
              status: selectedInvoice.status
            }
          : null,
        job: selectedVisit
      })
    : null;
  const selectedCommercialAccountMode: CommercialAccountMode = selectedIsCommercialAccount
    ? "fleet_account"
    : "retail_customer";
  const selectedReleaseRunwayState = selectedVisit
    ? deriveReleaseRunwayState({
        estimateStatus: selectedEstimate?.status ?? null,
        hasBlockingIssues:
          selectedOpenPartRequestCount + selectedInventoryIssueCount > 0,
        hasOwner: Boolean(selectedVisit.assignedTechnicianUserId),
        hasPromise: Boolean(
          selectedVisit.arrivalWindowStartAt ?? selectedVisit.scheduledStartAt
        ),
        readinessReadyCount: selectedReadinessSummary?.readyCount ?? 0,
        readinessTotalCount: selectedReadinessSummary?.totalCount ?? 0,
        visitStatus: selectedVisit.status
      })
    : null;
  const selectedPromiseConfidence =
    selectedPromiseSummary && selectedReadinessSummary && selectedTrustSummary
      ? derivePromiseConfidenceSnapshot({
          hasServiceSitePlaybook: Boolean(selectedServiceSitePlaybookCopy),
          hasSupplyRisk:
            selectedOpenPartRequestCount + selectedInventoryIssueCount > 0,
          promiseSummary: selectedPromiseSummary,
          readinessSummary: selectedReadinessSummary,
          releaseRunwayState: selectedReleaseRunwayState,
          trustSummary: selectedTrustSummary
        })
      : null;
  const selectedRouteConfidence =
    selectedVisit && selectedPromiseConfidence
      ? deriveRouteConfidenceSnapshot({
          hasLiveGps:
            selectedVisit.status === "dispatched" ||
            selectedVisit.status === "in_progress" ||
            selectedVisit.status === "completed",
          hasPartsConfidence:
            selectedOpenPartRequestCount + selectedInventoryIssueCount === 0,
          hasServiceSitePlaybook: selectedServiceSite
            ? hasServiceSitePlaybook(selectedServiceSite)
            : Boolean(selectedServiceSitePlaybookCopy),
          hasTechnicianReadiness:
            Boolean(selectedVisit.assignedTechnicianUserId) &&
            selectedVisit.status !== "new",
          laneSlackMinutes:
            selectedVisit.status === "scheduled"
              ? 45
              : selectedVisit.status === "dispatched"
                ? 30
                : selectedVisit.status === "in_progress" ||
                    selectedVisit.status === "completed"
                  ? 60
                  : 15,
          promiseConfidencePercent: selectedPromiseConfidence.confidencePercent,
          routeIssueCount:
            Number(
              !(
                selectedServiceSite
                  ? hasServiceSitePlaybook(selectedServiceSite)
                  : Boolean(selectedServiceSitePlaybookCopy)
              )
            ) +
            Number(selectedOpenPartRequestCount + selectedInventoryIssueCount > 0) +
            Number(!selectedVisit.assignedTechnicianUserId)
        })
      : null;
  const selectedServiceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount: selectedServiceSiteActiveVisitCount,
    commercialAccountMode: selectedCommercialAccountMode,
    linkedAssetCount: selectedIsCommercialAccount
      ? selectedFleetUnits.length
      : selectedRetailVehicleCount || (selectedCustomerVehicles ?? []).length,
    linkedVisitCount: selectedServiceSiteJobs.length,
    site: selectedServiceSite ?? null
  });
  const selectedSupplyOwnership = getSupplyExceptionOwnershipSummary({
    inventoryIssueCount: selectedInventoryIssueCount,
    openPartRequestCount: selectedOpenPartRequestCount
  });
  const selectedSupplyExecutionState = selectedOpenPartRequestCount > 0
    ? {
        copy: `${selectedOpenPartRequestCount} open part request${selectedOpenPartRequestCount === 1 ? " is" : "s are"} still active, so sourcing needs to stay attached to this visit's next move.`,
        label: "Source parts"
      }
    : selectedInventoryIssueCount > 0
      ? {
          copy: `${selectedInventoryIssueCount} inventory blocker${selectedInventoryIssueCount === 1 ? " is" : "s are"} still open, so stock resolution should lead before more field work is promised.`,
          label: "Resolve stock"
        }
      : {
          copy: "Parts coverage is clear right now, so supply is not the limiting factor on this visit.",
          label: "Coverage clear"
        };
  const selectedFollowUpSummary = selectedVisitRecord
    ? getVisitFollowUpSummary({
        assignedTechnicianUserId: selectedVisitRecord.assignedTechnicianUserId,
        communications: selectedCommunications ?? [],
        createdAt: selectedVisitRecord.createdAt,
        invoiceStarted: Boolean(selectedInvoice),
        job: selectedVisitRecord,
        notes: selectedNotes ?? [],
        promisedAt:
          selectedVisitRecord.arrivalWindowStartAt ?? selectedVisitRecord.scheduledStartAt ?? null,
        relatedVisits: selectedVisitChain?.visits ?? [],
        supplyBlockerCount: selectedOpenPartRequestCount + selectedInventoryIssueCount
      })
    : null;
  const selectedFollowUpCommunication = selectedFollowUpSummary
    ? getFollowUpCommunicationAction(selectedFollowUpSummary)
    : null;
  const selectedThreadSignals = [
    selectedVisit && (selectedVisit.priority === "high" || selectedVisit.priority === "urgent") ? (
      <PriorityBadge key="priority" value={selectedVisit.priority} />
    ) : null,
    selectedPromiseSummary &&
    selectedWorkflowState !== "completed" &&
    selectedPromiseConfidence &&
    selectedPromiseConfidence.level !== "strong" ? (
      <Badge key="promise" tone={selectedPromiseConfidence.tone}>
        {selectedPromiseConfidence.label} · {selectedPromiseConfidence.confidencePercent}%
      </Badge>
    ) : null,
    selectedRouteConfidence &&
    selectedWorkflowState !== "completed" &&
    selectedRouteConfidence.level !== "strong" ? (
      <Badge key="route" tone={selectedRouteConfidence.tone}>
        {selectedRouteConfidence.label} · {selectedRouteConfidence.confidencePercent}%
      </Badge>
    ) : null,
    selectedWorkflowState ? (
      <Badge key="workflow" tone={getVisitWorkflowTone(selectedWorkflowState)}>
        {getVisitWorkflowLabel(selectedWorkflowState)}
      </Badge>
    ) : null,
    selectedFollowUpSummary?.isFollowUpVisit ? (
      <Badge key="follow-up" tone={selectedFollowUpSummary.tone}>Return visit</Badge>
    ) : null,
    selectedWorkflowState === "completed" || selectedInvoice ? (
      <Badge key="billing" tone={getBillingStateTone(selectedBillingState)}>
        {getBillingStateLabel(selectedBillingState)}
      </Badge>
    ) : selectedEstimate ? (
      <StatusBadge key="estimate" status={selectedEstimate.status} />
    ) : null
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, operatorFocusMode ? 2 : 4);
  const selectedLatestCommunication = selectedCommunications?.[0] ?? null;
  const selectedLatestStatusChange = selectedStatusHistory?.[0] ?? null;
  const selectedRecentAttachments = (selectedAttachments ?? []).slice(0, 3);
  const shouldOpenFieldEvidenceRail =
    prioritizeDrawerExceptionOwnership ||
    Boolean(selectedInspection) ||
    selectedPhotoCount > 0 ||
    Boolean(selectedNotes?.length);
  const selectedAllowedNextStatuses = selectedVisit ? getAllowedNextJobStatuses(selectedVisit.status) : [];
  const canSendAppointmentConfirmation =
    context.canEditRecords && Boolean(selectedVisit?.scheduledStartAt);
  const canSendDispatchUpdates =
    context.canEditRecords && Boolean(selectedVisit?.assignedTechnicianUserId);
  const canPromoteEstimateForCustomer =
    context.canEditRecords &&
    selectedEstimate?.status === "draft" &&
    Boolean(selectedEstimateWorkspaceSummary?.lineItemCount);
  const canSendEstimateNotification =
    context.canEditRecords && selectedEstimate?.status === "sent";
  const canSendInvoiceNotification =
    context.canEditRecords &&
    Boolean(selectedInvoice && ["issued", "partially_paid"].includes(selectedInvoice.status));
  const canSendPaymentReminder =
    context.canEditRecords &&
    Boolean(
      selectedInvoice &&
        isInvoiceEligibleForReminder({
          balanceDueCents: selectedInvoiceBalanceDueCents ?? selectedInvoice.balanceDueCents,
          dueAt: selectedInvoice.dueAt,
          status: selectedInvoice.status
        })
    );
  const selectedEstimateCustomerThread = selectedEstimateLinkSummary
    ? {
        copy: "Customer access is already live for this estimate, so approval follow-up can happen from the visit thread without rebuilding context.",
        label: "Link issued"
      }
    : canSendEstimateNotification
      ? {
          copy: "The estimate is ready for customer follow-up from this visit. Send the next approval touch without leaving the thread.",
          label: "Ready to send"
        }
      : selectedEstimate
        ? {
            copy: "This estimate is still internal. Finish builder or approval prep before customer follow-up starts.",
            label: "Internal only"
          }
        : {
            copy: "No customer thread exists yet because pricing has not been started for this visit.",
            label: "Not started"
          };
  const shouldShowEstimateCustomerThreadSection =
    selectedDrawerTab === "thread" &&
    Boolean(
      selectedEstimate &&
        selectedEstimate.status !== "accepted" &&
        (selectedEstimate.status === "sent" ||
          isStaleApprovalEstimate(selectedEstimate) ||
          Boolean(selectedEstimateLinkSummary) ||
          canSendEstimateNotification)
    );
  const selectedEstimateBuildFocus = !selectedEstimate
    ? {
        copy: "Pricing has not started yet. Launch the builder from this visit thread so labor, parts, and customer follow-up stay attached to the same service context.",
        label: "Start builder"
      }
    : selectedEstimate.status === "draft"
      ? selectedEstimateWorkspaceSummary?.lineItemCount
        ? {
            copy: `${selectedEstimateWorkspaceSummary.lineItemCount} live line${
              selectedEstimateWorkspaceSummary.lineItemCount === 1 ? "" : "s"
            } are already staged in the builder. Keep pricing and sourcing in-thread until the quote is ready to send.`,
            label: "Builder in motion"
          }
        : {
            copy: `${selectedEstimate.estimateNumber} exists, but pricing is still empty. Seed the first labor or part line before this visit drifts back into intake.`,
            label: "Needs first line"
          }
      : selectedEstimate.status === "sent"
        ? {
            copy: `${selectedEstimate.estimateNumber} is out with the customer. Keep follow-up and release decisions attached to this visit instead of managing approval from a disconnected quote screen.`,
            label: "Approval in flight"
          }
        : selectedEstimate.status === "accepted"
          ? {
              copy: `${selectedEstimate.estimateNumber} is approved. Release the visit into timing and dispatch from this same thread while pricing context is still hot.`,
              label: "Ready to release"
            }
          : {
              copy: `${selectedEstimate.estimateNumber} needs review before more field work is staged from this visit.`,
              label: "Review estimate"
            };
  const selectedEstimateSourcingState = selectedEstimateWorkspaceSummary
    ? selectedEstimateWorkspaceSummary.partLineCount
      ? selectedEstimateWorkspace?.partRequest
        ? {
            copy: `${selectedEstimateWorkspaceSummary.partLineCount} part line${
              selectedEstimateWorkspaceSummary.partLineCount === 1 ? "" : "s"
            } are already tied into sourcing from this visit.`,
            label: formatLabel(selectedEstimateWorkspace.partRequest.status)
          }
        : {
            copy: `${selectedEstimateWorkspaceSummary.partLineCount} part line${
              selectedEstimateWorkspaceSummary.partLineCount === 1 ? "" : "s"
            } are in the builder, but sourcing has not started yet.`,
            label: "Needs sourcing"
          }
      : {
          copy: "No part lines are staged yet, so the builder is still labor-first.",
          label: "No parts yet"
        }
    : {
        copy: "Parts sourcing will show up here once the estimate thread is active.",
        label: "Waiting on builder"
      };
  const selectedEstimateReleaseRunway =
    selectedVisit && selectedEstimate?.status === "accepted"
      ? getVisitEstimateReleaseRunway({
          estimate: selectedEstimate,
          job: selectedVisit,
          timeZone: context.company.timezone
        })
      : null;
  const selectedInvoiceCustomerThread = canSendPaymentReminder
    ? {
        copy: "Customer payment follow-up is due now. Keep reminder work attached to this visit while the thread is still warm.",
        label: "Reminder due"
      }
    : selectedInvoiceLinkSummary
      ? {
          copy: "Customer billing access is already live, so closeout work can continue directly from the visit thread.",
          label: "Link issued"
        }
      : canSendInvoiceNotification
        ? {
            copy: "The invoice is ready for customer follow-through from this visit. Send the billing touch before switching desks.",
            label: "Ready to notify"
          }
        : selectedInvoice
          ? {
              copy: "Billing is still internal. Finish setup before customer closeout work begins.",
              label: "Internal only"
            }
          : {
              copy: "No billing thread exists yet because invoicing has not started for this visit.",
              label: "Not started"
            };
  async function assignVisitOwnerAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const result = await assignVisitTechnician(actionContext.supabase, jobId, {
      assignedTechnicianUserId: getNullableString(formData, "assignedTechnicianUserId")
    });

    if (result.error) {
      redirect(returnHref);
    }

    if (result.data) {
      await sendTechnicianJobPushNotification({
        companyId: actionContext.companyId,
        companyTimeZone: actionContext.company.timezone,
        nextJob: result.data,
        previousJob: latestVisitResult.data
      }).catch(() => undefined);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function saveVisitScheduleAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const latestVisit = latestVisitResult.data;
    const clearSchedule = getString(formData, "clearSchedule") === "1";
    const scheduledStartAt = clearSchedule ? null : getNullableString(formData, "scheduledStartAt");
    const arrivalWindowStartAt = clearSchedule ? null : getNullableString(formData, "arrivalWindowStartAt");
    const arrivalWindowEndAt = clearSchedule ? null : getNullableString(formData, "arrivalWindowEndAt");
    const useArrivalWindow = Boolean(arrivalWindowStartAt || arrivalWindowEndAt) && !scheduledStartAt;
    const result = await updateJob(actionContext.supabase, jobId, {
      assignedTechnicianUserId: latestVisit.assignedTechnicianUserId,
      customerConcern: latestVisit.customerConcern,
      customerId: latestVisit.customerId,
      description: latestVisit.description,
      internalSummary: latestVisit.internalSummary,
      isActive: latestVisit.isActive,
      priority: latestVisit.priority,
      scheduledEndAt: null,
      scheduledStartAt: useArrivalWindow ? null : scheduledStartAt,
      arrivalWindowStartAt: useArrivalWindow ? arrivalWindowStartAt : null,
      arrivalWindowEndAt: useArrivalWindow ? arrivalWindowEndAt : null,
      source: latestVisit.source,
      title: latestVisit.title,
      vehicleId: latestVisit.vehicleId
    });

    if (result.error) {
      redirect(returnHref);
    }

    if (result.data) {
      await sendTechnicianJobPushNotification({
        companyId: actionContext.companyId,
        companyTimeZone: actionContext.company.timezone,
        nextJob: result.data,
        previousJob: latestVisit
      }).catch(() => undefined);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function advanceVisitStatusAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const result = await changeVisitStatus(actionContext.supabase, jobId, {
      reason: getNullableString(formData, "reason"),
      toStatus: getString(formData, "toStatus") as JobStatus
    });

    if (result.error) {
      redirect(returnHref);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function quickAddVisitEstimateLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const itemTypeValue = getString(formData, "itemType");
    const itemType = isEstimateLineItemType(itemTypeValue) ? itemTypeValue : "labor";
    const lineName = getString(formData, "name").trim();

    if (!lineName) {
      redirect(returnHref);
    }

    try {
      const workspace = await ensureVisitEstimateBuilderWorkspace({
        actorUserId: actionContext.currentUserId,
        client: actionContext.supabase,
        companyId: actionContext.companyId,
        visit: {
          id: latestVisitResult.data.id,
          title: latestVisitResult.data.title,
          vehicleId: latestVisitResult.data.vehicleId
        }
      });
      const defaultSectionId = workspace.sections[0]?.section.id ?? null;

      await createEstimateWorkspaceLineItem(
        actionContext.supabase,
        actionContext.companyId,
        workspace.estimate.id,
        actionContext.currentUserId,
        {
          description: getNullableString(formData, "description"),
          estimateSectionId: getNullableString(formData, "estimateSectionId") ?? defaultSectionId,
          itemType,
          name: lineName,
          quantity: getPositiveNumberInput(formData, "quantity", 1),
          taxable: itemType !== "labor",
          unitPriceCents: getCurrencyInputCents(formData, "unitPrice")
        }
      );
    } catch {
      redirect(returnHref);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate/workspace`);
    redirect(returnHref);
  }

  async function createVisitEstimateSectionAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const sectionTitle = getString(formData, "sectionTitle").trim();

    if (!sectionTitle) {
      redirect(returnHref);
    }

    try {
      const workspace = await ensureVisitEstimateBuilderWorkspace({
        actorUserId: actionContext.currentUserId,
        client: actionContext.supabase,
        companyId: actionContext.companyId,
        visit: {
          id: latestVisitResult.data.id,
          title: latestVisitResult.data.title,
          vehicleId: latestVisitResult.data.vehicleId
        }
      });

      await createEstimateWorkspaceSection(actionContext.supabase, actionContext.companyId, {
        companyId: actionContext.companyId,
        createdByUserId: actionContext.currentUserId,
        description: getNullableString(formData, "sectionDescription"),
        estimateId: workspace.estimate.id,
        jobId,
        notes: null,
        source: "manual",
        sourceRef: null,
        title: sectionTitle
      });
    } catch {
      redirect(returnHref);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/estimates");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate/workspace`);
    redirect(returnHref);
  }

  async function sendVisitAppointmentConfirmationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const preview = await getTechnicianProfilePreview(
      actionContext.supabase,
      latestVisitResult.data.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureVisitAccessLink({
          actorUserId: actionContext.currentUserId,
          jobId
        })
      : null;
    const result = await enqueueAppointmentConfirmation(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      jobId,
      resend: true,
      visitUrl: visitLink?.publicUrl ?? null
    });

    if (result.error || !result.data) {
      redirect(returnHref);
    }

    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue appointment confirmation."
    );

    if (visitLink) {
      await markVisitAccessLinkSent(
        visitLink.linkId,
        communication.id,
        actionContext.currentUserId
      );
    }

    revalidatePath("/dashboard/visits");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function markVisitEstimateReadyForCustomerAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const [latestVisitResult, estimateResult] = await Promise.all([
      getVisitById(actionContext.supabase, jobId),
      getEstimateByVisitId(actionContext.supabase, jobId)
    ]);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      estimateResult.error ||
      !estimateResult.data ||
      estimateResult.data.status !== "draft"
    ) {
      redirect(returnHref);
    }

    try {
      const workspace = await getEstimateWorkspaceByJobId(
        actionContext.supabase,
        actionContext.companyId,
        jobId
      );

      if (!workspace?.summary.lineItemCount) {
        redirect(returnHref);
      }
    } catch {
      redirect(returnHref);
    }

    const result = await changeVisitEstimateStatus(actionContext.supabase, estimateResult.data.id, {
      status: "sent"
    });

    if (result.error) {
      redirect(returnHref);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate/workspace`);
    redirect(returnHref);
  }

  async function sendVisitDispatchUpdateAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const preview = await getTechnicianProfilePreview(
      actionContext.supabase,
      latestVisitResult.data.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureVisitAccessLink({
          actorUserId: actionContext.currentUserId,
          jobId
        })
      : null;
    const result = await enqueueDispatchUpdate(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      jobId,
      resend: true,
      updateType: getString(formData, "updateType") as "dispatched" | "en_route",
      visitUrl: visitLink?.publicUrl ?? null
    });

    if (result.error || !result.data) {
      redirect(returnHref);
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

    revalidatePath("/dashboard/visits");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function sendVisitFollowUpCommunicationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const followUpAction = getString(formData, "followUpAction") as
      | "follow_up_awaiting_parts"
      | "follow_up_booked"
      | "follow_up_rescheduled"
      | "follow_up_status_update";
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(returnHref);
    }

    const result = await enqueueFollowUpCustomerCommunication({
      action: followUpAction,
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      jobId,
      resend: true,
      supabase: actionContext.supabase,
      timeZone: actionContext.company.timezone
    });

    await processCommunicationMutationResult(result, "Failed to queue follow-up communication.");

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function saveVisitNoteAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const body = getString(formData, "body").trim();
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (
      !body ||
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId
    ) {
      redirect(returnHref);
    }

    const result = await createVisitNote(actionContext.supabase, {
      authorUserId: actionContext.currentUserId,
      body,
      companyId: actionContext.companyId,
      isInternal: true,
      jobId
    });

    if (result.error) {
      redirect(returnHref);
    }

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    redirect(returnHref);
  }

  async function issueEstimateCustomerLinkAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);
    const estimateResult = await getEstimateByVisitId(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      estimateResult.error ||
      !estimateResult.data ||
      estimateResult.data.status !== "sent"
    ) {
      redirect(returnHref);
    }

    await ensureEstimateAccessLink({
      actorUserId: actionContext.currentUserId,
      estimateId: estimateResult.data.id
    });

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    redirect(returnHref);
  }

  async function sendVisitEstimateNotificationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);
    const estimateResult = await getEstimateByVisitId(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      estimateResult.error ||
      !estimateResult.data ||
      estimateResult.data.status !== "sent"
    ) {
      redirect(returnHref);
    }

    const linkSummary = await ensureEstimateAccessLink({
      actorUserId: actionContext.currentUserId,
      estimateId: estimateResult.data.id,
      rotate: true
    });
    const result = await enqueueEstimateNotification(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      estimateId: estimateResult.data.id,
      resend: true
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue estimate notification."
    );

    await markEstimateAccessLinkSent(
      linkSummary.linkId,
      communication.id,
      actionContext.currentUserId
    );

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    redirect(returnHref);
  }

  async function issueInvoiceCustomerLinkAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);
    const invoiceResult = await getInvoiceByVisitId(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      invoiceResult.error ||
      !invoiceResult.data ||
      !["issued", "partially_paid"].includes(invoiceResult.data.status)
    ) {
      redirect(returnHref);
    }

    await ensureInvoiceAccessLink({
      actorUserId: actionContext.currentUserId,
      invoiceId: invoiceResult.data.id
    });

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(returnHref);
  }

  async function sendVisitInvoiceNotificationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);
    const invoiceResult = await getInvoiceByVisitId(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      invoiceResult.error ||
      !invoiceResult.data ||
      !["issued", "partially_paid"].includes(invoiceResult.data.status)
    ) {
      redirect(returnHref);
    }

    const linkSummary = await ensureInvoiceAccessLink({
      actorUserId: actionContext.currentUserId,
      invoiceId: invoiceResult.data.id,
      rotate: true
    });
    const result = await enqueueInvoiceNotification(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      invoiceId: invoiceResult.data.id,
      resend: true
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue invoice notification."
    );

    await markInvoiceAccessLinkSent(
      linkSummary.linkId,
      communication.id,
      actionContext.currentUserId
    );

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(returnHref);
  }

  async function sendVisitPaymentReminderAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const jobId = getString(formData, "jobId");
    const returnHref = buildDrawerReturnHref(formData);
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);
    const invoiceResult = await getInvoiceByVisitId(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId ||
      invoiceResult.error ||
      !invoiceResult.data ||
      !["issued", "partially_paid"].includes(invoiceResult.data.status)
    ) {
      redirect(returnHref);
    }

    const linkSummary = await ensureInvoiceAccessLink({
      actorUserId: actionContext.currentUserId,
      invoiceId: invoiceResult.data.id
    });
    const result = await enqueuePaymentReminder(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      invoiceId: invoiceResult.data.id,
      resend: true
    });
    const communication = await processCommunicationMutationResult(
      result,
      "Failed to queue payment reminder."
    );

    await markInvoiceAccessLinkSent(
      linkSummary.linkId,
      communication.id,
      actionContext.currentUserId
    );

    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(returnHref);
  }

  const shouldShowSupplyArtifactCard =
    selectedOpenPartRequestCount > 0 ||
    selectedInventoryIssueCount > 0 ||
    prioritizeDrawerExceptionOwnership;
  const supportPrimaryArtifact =
    shouldShowSupplyArtifactCard && prioritizeDrawerExceptionOwnership ? "supply" : "field";
  const supportFieldArtifactCard = (
    <VisitArtifactCard
      defaultOpen={shouldOpenFieldEvidenceRail}
      id="visit-field-evidence"
      label={fieldArtifactSummary.title}
      meta={fieldArtifactSummary.copy}
      status={fieldArtifactSummary.status}
      value={fieldArtifactSummary.value}
    >
      <div className="job-flow-sidebar__grid">
        <div>
          <span>Inspection</span>
          <strong>{selectedInspection ? formatLabel(selectedInspection.status) : "Not started"}</strong>
        </div>
        <div>
          <span>Photos</span>
          <strong>{selectedPhotoCount ? `${selectedPhotoCount} captured` : "None yet"}</strong>
        </div>
        <div>
          <span>Schedule</span>
          <strong>{selectedSchedule?.label ?? "Unscheduled"}</strong>
          <p className="job-flow-sidebar__action-copy">
            {selectedSchedule?.value ?? "No confirmed time promise is attached yet."}
          </p>
        </div>
        <div>
          <span>Internal notes</span>
          <strong>{selectedNotes?.length ? `${selectedNotes.length} logged` : "No notes"}</strong>
        </div>
        <div>
          <span>Promise confidence</span>
          <strong>
            {selectedPromiseConfidence
              ? `${selectedPromiseConfidence.label} · ${selectedPromiseConfidence.confidencePercent}%`
              : "No active timing cue"}
          </strong>
        </div>
        <div>
          <span>Site thread</span>
          <strong>{selectedServiceSiteThreadSummary.siteLabel}</strong>
        </div>
      </div>
      <div className="job-flow-sidebar__grid">
        <div>
          <span>Recent field notes</span>
          {selectedNotes?.length ? (
            selectedNotes.slice(0, 2).map((note) => (
              <p className="job-flow-sidebar__action-copy" key={note.id}>
                <strong>
                  {formatDateTime(note.createdAt, {
                    fallback: "Saved recently",
                    timeZone: context.company.timezone
                  })}
                </strong>
                {` ${note.body}`}
              </p>
            ))
          ) : (
            <p className="job-flow-sidebar__action-copy">
              No internal field notes are attached to this visit yet.
            </p>
          )}
        </div>
        <div id="visit-field-evidence-photos">
          <span>Recent photos</span>
          {selectedRecentAttachments.length ? (
            selectedRecentAttachments.map((attachment) => (
              <p className="job-flow-sidebar__action-copy" key={attachment.id}>
                <strong>{attachment.caption ?? attachment.fileName}</strong>
                {` · ${formatLabel(attachment.category)}`}
              </p>
            ))
          ) : (
            <p className="job-flow-sidebar__action-copy">
              No photos have been uploaded from the field yet.
            </p>
          )}
        </div>
        <div>
          <span>Route confidence</span>
          <strong>
            {selectedRouteConfidence
              ? `${selectedRouteConfidence.label} · ${selectedRouteConfidence.confidencePercent}%`
              : "No live route cue"}
          </strong>
          <p className="job-flow-sidebar__action-copy">
            {selectedRouteConfidence?.copy ??
              "Route continuity will read here once timing, site, and lane posture are active."}
          </p>
        </div>
      </div>
      <div className="job-flow-sidebar__artifact-actions">
        <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedFieldWorkspaceHref}>
          Full inspection
        </Link>
        <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedPhotoWorkspaceHref}>
          Full photo stream
        </Link>
        {selectedCustomerThreadHref ? (
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedCustomerThreadHref}>
            {selectedIsCommercialAccount ? "Open account thread" : "Open customer thread"}
          </Link>
        ) : null}
        {selectedCustomerSitesHref ? (
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedCustomerSitesHref}>
            Open site thread
          </Link>
        ) : null}
      </div>
    </VisitArtifactCard>
  );
  const supportSupplyArtifactCard = shouldShowSupplyArtifactCard ? (
    <VisitArtifactCard
      defaultOpen={prioritizeDrawerExceptionOwnership}
      label={supplyArtifactSummary.title}
      meta={supplyArtifactSummary.copy}
      status={supplyArtifactSummary.status}
      value={supplyArtifactSummary.value}
    >
      <div className="job-flow-sidebar__grid">
        <div>
          <span>Open part requests</span>
          <strong>{selectedOpenPartRequestCount}</strong>
        </div>
        <div>
          <span>Inventory blockers</span>
          <strong>{selectedInventoryIssueCount}</strong>
        </div>
        <div>
          <span>Execution state</span>
          <strong>{selectedSupplyExecutionState.label}</strong>
          <p className="job-flow-sidebar__action-copy">{selectedSupplyExecutionState.copy}</p>
        </div>
        <div>
          <span>Release runway</span>
          <strong>{selectedReleaseRunwayState?.label ?? "No active runway"}</strong>
          <p className="job-flow-sidebar__action-copy">
            {selectedReleaseRunwayState?.copy ??
              "Release posture will stay attached here while supply is still part of the next move."}
          </p>
        </div>
        <div>
          <span>Site pressure</span>
          <strong>{selectedServiceSiteThreadSummary.label}</strong>
          <p className="job-flow-sidebar__action-copy">{selectedServiceSiteThreadSummary.copy}</p>
        </div>
      </div>
      <div className="job-flow-sidebar__artifact-actions">
        {selectedOpenPartRequestCount > 0 ? (
          <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedPartsWorkspaceHref}>
            Open parts file
          </Link>
        ) : null}
        <Link
          className={buttonClassName({
            size: "sm",
            tone: selectedOpenPartRequestCount > 0 ? "ghost" : "secondary"
          })}
          href={selectedInventoryWorkspaceHref}
        >
          Open inventory file
        </Link>
        {selectedCustomerSitesHref ? (
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedCustomerSitesHref}>
            Open site thread
          </Link>
        ) : null}
      </div>
    </VisitArtifactCard>
  ) : null;
  const visibleSupportArtifactCard =
    supportPrimaryArtifact === "supply" ? supportSupplyArtifactCard : supportFieldArtifactCard;
  const overflowSupportArtifactCard =
    supportPrimaryArtifact === "supply" ? supportFieldArtifactCard : supportSupplyArtifactCard;
  const showCommercialDrawerTab =
    selectedDrawerTab === "commercial" ||
    selectedIsCommercialAccount ||
    Boolean(selectedEstimate || selectedInvoice);
  const shouldShowGuidedFollowThroughRail = Boolean(
    prioritizeDrawerCustomerUpdates ||
      prioritizeDrawerCommercialState ||
      selectedPromiseSummary?.recommendedAction ||
      canSendInvoiceNotification ||
      canSendPaymentReminder ||
      selectedInvoiceLinkSummary ||
      selectedVisitLinkSummary ||
      (selectedVisit?.assignedTechnicianUserId &&
        selectedTechnicianPreview &&
        !selectedTechnicianPreview.isReady)
  );
  const shouldShowInternalHandoffNotesRail = Boolean(context.canEditRecords || selectedNotes?.length);
  const collapseInternalHandoffNotesRail = Boolean(!selectedNotes?.length);
  const shouldShowReturnWorkRecoveryRail = Boolean(
    selectedFollowUpSummary?.hasChainContext &&
      (selectedFollowUpSummary.needsSourceCloseout ||
        selectedFollowUpSummary.shouldCreateReturnVisit ||
        selectedFollowUpSummary.staleFollowUp ||
        selectedFollowUpSummary.activeRelatedVisitCount > 1)
  );
  const showSupportDrawerTab =
    selectedDrawerTab === "support" ||
    Boolean(
      visibleSupportArtifactCard ||
        overflowSupportArtifactCard ||
        shouldShowGuidedFollowThroughRail ||
        shouldShowInternalHandoffNotesRail ||
        shouldShowReturnWorkRecoveryRail
    );
  const showDrawerTabSwitcher =
    selectedDrawerTab !== "thread" ||
    (!operatorFocusMode && (showCommercialDrawerTab || showSupportDrawerTab));
  const shouldOpenServiceSitePlaybookByDefault = Boolean(
    selectedUsesPrimarySiteFallback ||
      !selectedServiceSite ||
      selectedCustomerSitePlaybookGapCount ||
      selectedServiceSiteActiveVisitCount > 1
  );
  const shouldOpenCommercialAccountThreadByDefault = Boolean(
    !selectedBillingSite || !selectedServiceSite || !selectedFleetUnits.length
  );
  const shouldOpenEstimateRunwayByDefault = Boolean(
    !selectedEstimate || isStaleApprovalEstimate(selectedEstimate) || selectedEstimateReleaseRunway?.actionKind
  );
  const showPinnedVisitsSlicesInline = false;

  return (
    <QueuePage className={operatorFocusMode ? "job-ops-page job-ops-page--focus-mode" : "job-ops-page"}>
      <QueueHero
        actions={
          <div className="job-ops-header__actions">
            <Link className={buttonClassName()} href="/dashboard/visits/new">
              New visit
            </Link>
            <Link
              className={buttonClassName({ tone: operatorFocusMode ? "secondary" : "tertiary" })}
              href={focusToggleVisitsHref}
            >
              {operatorFocusMode ? "Full view" : "Focus mode"}
            </Link>
            {activeFilters && !threadDominantQueueTools ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={defaultVisitsHref}>
                Clear filters
              </Link>
            ) : null}
            {!selectedVisit ? (
              <Link
                className={buttonClassName({ tone: activeFilters && !threadDominantQueueTools ? "ghost" : "secondary" })}
                href={operatorFocusMode ? "/dashboard/dispatch?focus=1" : "/dashboard/dispatch"}
              >
                Dispatch board
              </Link>
            ) : null}
          </div>
        }
        compact
        description={
          compactVisitsHero || selectedVisit
            ? null
            : "Visits owns intake, estimates, approvals, and release into Dispatch. Finance takes over once the field thread becomes a money or closeout problem."
        }
        metrics={
          compactVisitsHero || selectedVisit ? null : (
            <>
              {visibleWorkflowMetrics.map((metric) => (
                <QueueMetric
                  key={metric.key}
                  label={metric.label}
                  meta={metric.meta}
                  tone={metric.tone}
                  value={metric.value}
                />
              ))}
            </>
          )
        }
        status={
          compactVisitsHero || selectedVisit ? null : (
            <Badge tone={selectedVisit ? "brand" : "neutral"}>
              {selectedVisit ? "Visit thread open" : activeFilters ? "Scoped queue" : "Production queue"}
            </Badge>
          )
        }
        title="Visits"
      />

      <div
        className={[
          "job-ops-workspace",
          selectedVisit ? "job-ops-workspace--detail-open" : "",
          operatorFocusMode ? "job-ops-workspace--focus-mode" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="job-ops-workspace__board">
          <VisitsWorkboard
            canEditRecords={context.canEditRecords}
            filters={effectiveFilters}
            focusMode={operatorFocusMode}
            initialEstimates={initialEstimates}
            initialInvoices={initialInvoices}
            initialVisitCommunications={initialVisitCommunications}
            initialJobs={scopedVisits}
            technicians={techniciansResult.data ?? []}
            timeZone={context.company.timezone}
          >
        <details
          className={[
            "job-ops-toolbar__scope-panel",
            threadDominantQueueTools ? "job-ops-toolbar__scope-panel--thread-dominant" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <summary className="job-ops-toolbar__scope-toggle">
            <span className="job-ops-toolbar__scope-toggle-copy">
              <strong>Queue</strong>
              <small>
                {threadDominantQueueTools
                  ? activeFilters
                    ? `${scopeChips.length} active · ${scopedVisits.length} visible.`
                    : `${scopedVisits.length} visible ${scopedVisits.length === 1 ? "visit" : "visits"}.`
                  : activeFilters
                    ? `${currentVisitSliceLabel} · ${scopedVisits.length} visible.`
                    : `${currentVisitSliceLabel} · Search, technician, status, and date filters.`}
              </small>
            </span>
            <span className="job-ops-toolbar__scope-toggle-meta">
              {activeFilters && !threadDominantQueueTools ? (
                <span className="job-ops-toolbar__scope-toggle-state">
                  {scopeChips.length} active
                </span>
              ) : null}
              <span className="job-ops-toolbar__scope-toggle-state">
                {scopedVisits.length} visible
              </span>
            </span>
          </summary>
          <div className="job-ops-toolbar__scope-stack">
            {showPinnedVisitsSlicesInline ? (
              <>
                <DeskSavedSlices
                  className="job-ops-toolbar__saved-slices"
                  currentSlice={{
                    href: currentVisitsSliceHref,
                    label: currentVisitSliceLabel
                  }}
                  desk="visits"
                  operatorRole={context.membership.role}
                  pinCurrentLabel="Pin slice"
                  suggestedSlices={visitSavedSliceSuggestions}
                />
                <div className="job-ops-toolbar__lane-row" aria-label="Operational visit scopes">
                  {visitPrimaryScopePresets.map((preset) => (
                    <Link
                      className={buttonClassName({ size: "sm", tone: preset.tone })}
                      href={buildVisitsHref(filters, { jobId: "", scope: preset.scope })}
                      key={`scope-${preset.label}`}
                      scroll={false}
                    >
                      <span className="job-ops-toolbar__lane-pill">
                        <span>{preset.label}</span>
                        <strong>{preset.count}</strong>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <details className="job-ops-toolbar__secondary-scopes">
                <summary className="job-ops-toolbar__secondary-scopes-summary">
                  Slices
                </summary>
                <div className="job-ops-toolbar__scope-group job-ops-toolbar__scope-group--compact">
                  {!threadDominantQueueTools ? (
                    <div className="job-ops-toolbar__lane-row" aria-label="Operational visit scopes">
                      {visitPrimaryScopePresets.map((preset) => (
                        <Link
                          className={buttonClassName({ size: "sm", tone: preset.tone })}
                          href={buildVisitsHref(filters, { jobId: "", scope: preset.scope })}
                          key={`scope-${preset.label}`}
                          scroll={false}
                        >
                          <span className="job-ops-toolbar__lane-pill">
                            <span>{preset.label}</span>
                            <strong>{preset.count}</strong>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  <DeskSavedSlices
                    className="job-ops-toolbar__saved-slices"
                    currentSlice={{
                      href: currentVisitsSliceHref,
                      label: currentVisitSliceLabel
                    }}
                    desk="visits"
                    operatorRole={context.membership.role}
                    pinCurrentLabel="Pin slice"
                    suggestedSlices={visitSavedSliceSuggestions}
                  />
                </div>
              </details>
            )}
          </div>
          {visitSecondaryScopePresets.length && showPinnedVisitsSlicesInline ? (
            <details className="job-ops-toolbar__secondary-scopes">
              <summary className="job-ops-toolbar__secondary-scopes-summary">
                More saved slices
              </summary>
              <div className="job-ops-toolbar__scope-group job-ops-toolbar__scope-group--compact">
                <div className="job-ops-toolbar__lane-row" aria-label="Secondary visit scopes">
                  {visitSecondaryScopePresets.map((preset) => (
                    <Link
                      className={buttonClassName({ size: "sm", tone: preset.tone })}
                      href={buildVisitsHref(filters, { jobId: "", scope: preset.scope })}
                      key={`secondary-${preset.label}`}
                      scroll={false}
                    >
                      <span className="job-ops-toolbar__lane-pill">
                        <span>{preset.label}</span>
                        <strong>{preset.count}</strong>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
          {threadDominantQueueTools ? (
            <details className="job-ops-toolbar__secondary-scopes">
              <summary className="job-ops-toolbar__secondary-scopes-summary">Filters</summary>
              <form className="job-ops-toolbar__grid" method="get">
                <input name="focus" type="hidden" value={filters.focus} />
                <input name="scope" type="hidden" value={filters.scope} />
                <input name="workflowState" type="hidden" value={filters.workflowState} />
                <input name="detailTab" type="hidden" value={filters.detailTab} />
                <label className="job-ops-toolbar__field job-ops-toolbar__field--search">
                  <span>Search</span>
                  <Input
                    aria-label="Search visits"
                    className="job-ops-toolbar__search"
                    defaultValue={filters.query}
                    name="query"
                    placeholder="Customer, vehicle, or concern"
                    type="search"
                  />
                </label>
                <label className="job-ops-toolbar__field">
                  <span>Status</span>
                  <Select aria-label="Visit status" defaultValue={filters.status} name="status">
                    <option value="">All statuses</option>
                    {jobStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="job-ops-toolbar__field">
                  <span>Technician</span>
                  <Select
                    aria-label="Assigned technician"
                    defaultValue={filters.assignedTechnicianUserId}
                    name="assignedTechnicianUserId"
                  >
                    <option value="">All technicians</option>
                    {(techniciansResult.data ?? []).map((technician) => (
                      <option key={technician.userId} value={technician.userId}>
                        {technician.displayName}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="job-ops-toolbar__field">
                  <span>From</span>
                  <Input aria-label="From date" defaultValue={filters.dateFrom} name="dateFrom" type="date" />
                </label>
                <label className="job-ops-toolbar__field">
                  <span>To</span>
                  <Input aria-label="To date" defaultValue={filters.dateTo} name="dateTo" type="date" />
                </label>
                <div className="job-ops-toolbar__actions">
                  <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                    Apply filters
                  </button>
                  {activeFilters ? (
                    <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={defaultVisitsHref}>
                      Reset
                    </Link>
                  ) : null}
                </div>
              </form>
            </details>
          ) : (
            <details className="job-ops-toolbar__secondary-scopes" open={activeFilters}>
              <summary className="job-ops-toolbar__secondary-scopes-summary">
                Filters
              </summary>
              <form className="job-ops-toolbar__grid" method="get">
                <input name="focus" type="hidden" value={filters.focus} />
                <input name="scope" type="hidden" value={filters.scope} />
                <input name="workflowState" type="hidden" value={filters.workflowState} />
                <input name="detailTab" type="hidden" value={filters.detailTab} />
                <label className="job-ops-toolbar__field job-ops-toolbar__field--search">
                  <span>Search</span>
                  <Input
                    aria-label="Search visits"
                    className="job-ops-toolbar__search"
                    defaultValue={filters.query}
                    name="query"
                    placeholder="Customer, vehicle, or concern"
                    type="search"
                  />
                </label>
                <label className="job-ops-toolbar__field">
                  <span>Status</span>
                  <Select aria-label="Visit status" defaultValue={filters.status} name="status">
                    <option value="">All statuses</option>
                    {jobStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="job-ops-toolbar__field">
                  <span>Technician</span>
                  <Select
                    aria-label="Assigned technician"
                    defaultValue={filters.assignedTechnicianUserId}
                    name="assignedTechnicianUserId"
                  >
                    <option value="">All technicians</option>
                    {(techniciansResult.data ?? []).map((technician) => (
                      <option key={technician.userId} value={technician.userId}>
                        {technician.displayName}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="job-ops-toolbar__field">
                  <span>From</span>
                  <Input aria-label="From date" defaultValue={filters.dateFrom} name="dateFrom" type="date" />
                </label>
                <label className="job-ops-toolbar__field">
                  <span>To</span>
                  <Input aria-label="To date" defaultValue={filters.dateTo} name="dateTo" type="date" />
                </label>
                <div className="job-ops-toolbar__actions">
                  <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                    Apply filters
                  </button>
                  {activeFilters ? (
                    <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={defaultVisitsHref}>
                      Reset
                    </Link>
                  ) : null}
                </div>
              </form>
            </details>
          )}
        </details>
          </VisitsWorkboard>
        </div>

        {selectedVisit && selectedWorkflowState && selectedSchedule ? (
          <aside
            aria-label={`${selectedVisit.title} visit thread`}
            className="job-flow-drawer__panel job-flow-sidebar job-ops-workspace__detail"
          >
            <div className="job-flow-card__header job-flow-sidebar__header job-flow-sidebar__header--workspace">
              <div className="job-flow-sidebar__stack">
                <h2 className="job-flow-card__title">{selectedVisit.title}</h2>
                <p className="job-flow-card__meta">
                  {selectedVisit.customerDisplayName} · {selectedVisit.vehicleDisplayName}
                </p>
                <p className="job-flow-sidebar__subline">
                  <strong>
                    {selectedSchedule.label} {selectedSchedule.value}
                  </strong>
                  <span>{selectedVisit.assignedTechnicianName ?? "Unassigned"}</span>
                </p>
              </div>
              <Link
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                href={closeVisitHref}
                scroll={false}
              >
                Close
              </Link>
            </div>

            <div className="job-flow-sidebar__signals">{selectedThreadSignals}</div>

            <div className="job-flow-sidebar__command-bar">
              <Link
                className={buttonClassName({
                  size: "sm",
                  tone: selectedPrimaryAction?.intent === "dispatch" ? "primary" : "secondary"
                })}
                href={selectedPrimaryHref}
              >
                {getPrimaryVisitActionLabel(selectedPrimaryAction)}
              </Link>
              {!operatorFocusMode ? (
                <details className="job-flow-sidebar__command-utility">
                  <summary className="job-flow-sidebar__command-utility-summary">More</summary>
                  <div className="ui-table-actions job-flow-sidebar__command-utility-actions">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={selectedInvoice ? selectedInvoiceWorkspaceHref : selectedEstimateWorkspaceHref}
                    >
                      {selectedInvoice ? "Open invoice" : getEstimateActionLabel(selectedEstimate, context.canEditRecords)}
                    </Link>
                    <Link
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      href={selectedThreadCompanionHref}
                    >
                      {selectedThreadCompanionLabel}
                    </Link>
                  </div>
                </details>
              ) : null}
            </div>

            {selectedDrawerTab === "thread" &&
            !operatorFocusMode &&
            (selectedVisit.customerPhone || selectedHasFieldEvidenceJump || selectedHasPhotoJump) ? (
            <div className="job-flow-sidebar__utility-strip">
              {selectedVisit.customerPhone ? (
                <>
                  <a
                    aria-label={`Call ${selectedVisit.customerDisplayName}`}
                    className="job-flow-sidebar__utility-button"
                    href={buildPhoneHref(selectedVisit.customerPhone, "tel")}
                    title="Call customer"
                  >
                    <AppIcon className="job-flow-sidebar__utility-icon" name="phone" />
                  </a>
                  <a
                    aria-label={`Text ${selectedVisit.customerDisplayName}`}
                    className="job-flow-sidebar__utility-button"
                    href={buildPhoneHref(selectedVisit.customerPhone, "sms")}
                    title="Text customer"
                  >
                    <AppIcon className="job-flow-sidebar__utility-icon" name="message" />
                  </a>
                </>
              ) : null}
              {selectedHasFieldEvidenceJump ? (
                <Link
                  aria-label={`Jump to field evidence for ${selectedVisit.title}`}
                  className="job-flow-sidebar__utility-button"
                  href={selectedFieldRailHref}
                  scroll={false}
                  title="Jump to field evidence"
                >
                  <AppIcon className="job-flow-sidebar__utility-icon" name="approval" />
                </Link>
              ) : null}
              {selectedHasPhotoJump ? (
                <Link
                  aria-label={`Jump to recent photos for ${selectedVisit.title}`}
                  className="job-flow-sidebar__utility-button"
                  href={selectedFieldPhotosRailHref}
                  scroll={false}
                  title="Jump to recent photos"
                >
                  <AppIcon className="job-flow-sidebar__utility-icon" name="camera" />
                </Link>
              ) : null}
            </div>
            ) : null}

            <div className="job-flow-sidebar__grid job-flow-sidebar__summary-grid">
              <div>
                <span>Next move</span>
                <strong>{getVisitNextMove(selectedVisit)}</strong>
              </div>
              <div>
                <span>Dispatch owner</span>
                <strong>{selectedVisit.assignedTechnicianName ?? "Unassigned"}</strong>
              </div>
              <div>
                <span>Promise confidence</span>
                <strong>
                  {selectedPromiseConfidence
                    ? `${selectedPromiseConfidence.label} · ${selectedPromiseConfidence.confidencePercent}%`
                    : "No active timing cue"}
                </strong>
              </div>
              <div>
                <span>{selectedReleaseRunwayState?.state !== "placed" ? "Release runway" : "Route confidence"}</span>
                <strong>
                  {selectedReleaseRunwayState?.state !== "placed"
                    ? selectedReleaseRunwayState?.label ?? "No active runway"
                    : selectedRouteConfidence
                      ? `${selectedRouteConfidence.label} · ${selectedRouteConfidence.confidencePercent}%`
                      : "No active route cue"}
                </strong>
              </div>
            </div>

            {showDrawerTabSwitcher ? (
            <div className="ui-table-actions job-flow-sidebar__tabs" role="tablist" aria-label="Visit thread sections">
              {selectedDrawerTab !== "thread" ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={selectedThreadTabHref}
                  scroll={false}
                >
                  Thread
                </Link>
              ) : null}
              {showCommercialDrawerTab ? (
                <Link
                  aria-current={selectedDrawerTab === "commercial" ? "page" : undefined}
                  className={buttonClassName({ size: "sm", tone: selectedDrawerTab === "commercial" ? "secondary" : "ghost" })}
                  href={selectedCommercialTabHref}
                  scroll={false}
                >
                  Commercial
                </Link>
              ) : null}
              {showSupportDrawerTab ? (
                <Link
                  aria-current={selectedDrawerTab === "support" ? "page" : undefined}
                  className={buttonClassName({ size: "sm", tone: selectedDrawerTab === "support" ? "secondary" : "ghost" })}
                  href={selectedSupportTabHref}
                  scroll={false}
                >
                  Support
                </Link>
              ) : null}
            </div>
            ) : null}

            {selectedDrawerTab === "thread" ? (
              <VisitRailSection
                compact
                defaultOpen={shouldOpenServiceSitePlaybookByDefault}
                description="Keep recurring-location memory, arrival access, and neighboring site pressure attached to the active visit."
                title="Service-site playbook"
              >
                {selectedServiceSite ? (
                  <>
                    {selectedUsesPrimarySiteFallback ? (
                      <Callout tone="warning" title="This visit is still using the primary site fallback">
                        Anchor the visit to the exact service site before dispatch handoff so access rules and repeat-location history stay precise.
                      </Callout>
                    ) : null}
                    <div className="job-flow-sidebar__grid">
                      <div>
                        <span>Site thread</span>
                        <strong>{selectedServiceSiteThreadSummary.siteLabel}</strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedServiceSiteThreadSummary.copy}
                        </p>
                      </div>
                      <div>
                        <span>Arrival access</span>
                        <strong>
                          {selectedServiceSitePlaybookCopy ? "Playbook on file" : "Needs access playbook"}
                        </strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedServiceSitePlaybookCopy ||
                            "No access window, gate, parking, or on-site guidance is attached to this location yet."}
                        </p>
                      </div>
                      <div>
                        <span>Service contact</span>
                        <strong>
                          {selectedServiceSite.serviceContactName ??
                            selectedServiceSite.serviceContactPhone ??
                            "Not provided"}
                        </strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedServiceSite.serviceContactName &&
                          selectedServiceSite.serviceContactPhone
                            ? selectedServiceSite.serviceContactPhone
                            : "Keep the arrival contact attached to the site instead of burying it in notes."}
                        </p>
                      </div>
                      <div>
                        <span>Site pressure</span>
                        <strong>
                          {selectedServiceSiteThreadSummary.label}
                        </strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedServiceSitePeerCount
                            ? `${selectedServiceSitePeerCount} other active ${selectedIsCommercialAccount ? "account " : ""}site${selectedServiceSitePeerCount === 1 ? "" : "s"} stay attached to this ${selectedIsCommercialAccount ? "account" : "customer"} thread. ${selectedServiceSiteThreadSummary.copy}`
                            : selectedServiceSiteThreadSummary.copy}
                        </p>
                      </div>
                    </div>
                    <div className="ui-button-grid">
                      {selectedServiceSiteLatestJob && selectedServiceSiteLatestJob.id !== selectedVisit.id ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={selectedServiceSiteVisitHref}
                          scroll={false}
                        >
                          {selectedServiceSiteActiveVisitCount ? "Open live site visit" : "Open latest site visit"}
                        </Link>
                      ) : null}
                      {selectedCustomerThreadHref ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={selectedCustomerThreadHref}
                        >
                          {selectedIsCommercialAccount ? "Open account thread" : "Open customer thread"}
                        </Link>
                      ) : null}
                      {selectedCustomerSitesHref ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          href={selectedCustomerSitesHref}
                        >
                          Open service sites
                        </Link>
                      ) : null}
                      {selectedUsesPrimarySiteFallback && context.canEditRecords ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          href={selectedVisitEditHref}
                        >
                          Anchor this visit
                        </Link>
                      ) : null}
                    </div>
                  </>
                ) : selectedCustomerSites?.length ? (
                  <>
                    <Callout tone="warning" title="This visit is not anchored to a service site yet">
                      This {selectedIsCommercialAccount ? "account" : "customer"} already has service locations on file. Attach this visit to the exact site before the day gets busier so access notes and repeat-location memory stay usable.
                    </Callout>
                    <div className="job-flow-sidebar__grid">
                      <div>
                        <span>Available sites</span>
                        <strong>{selectedCustomerSites.length} on file</strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedCustomerSitePlaybookGapCount
                            ? `${selectedCustomerSitePlaybookGapCount} site playbook gap${selectedCustomerSitePlaybookGapCount === 1 ? "" : "s"} still need access memory.`
                            : "Each site already carries its own access and arrival context."}
                        </p>
                      </div>
                      <div>
                        <span>Dominant site</span>
                        <strong>
                          {selectedPrimaryServiceSite?.siteName ??
                            selectedPrimaryServiceSite?.label ??
                            "No primary site"}
                        </strong>
                        <p className="job-flow-sidebar__action-copy">
                          {selectedPrimaryServiceSite
                            ? formatServiceSiteAddress(selectedPrimaryServiceSite) ||
                              "Address details are still missing."
                            : "No primary site has been marked on this customer yet."}
                        </p>
                      </div>
                    </div>
                    <div className="ui-button-grid">
                      {selectedCustomerSitesHref ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={selectedCustomerSitesHref}
                        >
                          Open service sites
                        </Link>
                      ) : null}
                      {context.canEditRecords ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          href={selectedVisitEditHref}
                        >
                          Anchor this visit
                        </Link>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <Callout tone="warning" title="No service site exists for this visit yet">
                      Add the first service site on the {selectedIsCommercialAccount ? "account" : "customer"} thread so future access rules, parked assets, and repeat-location memory stop living in freeform notes.
                    </Callout>
                    <div className="ui-button-grid">
                      {selectedCustomerSitesHref ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={selectedCustomerSitesHref}
                        >
                          Open customer sites
                        </Link>
                      ) : null}
                      {selectedCustomerThreadHref ? (
                        <Link
                          className={buttonClassName({ size: "sm", tone: "ghost" })}
                          href={selectedCustomerThreadHref}
                        >
                          {selectedIsCommercialAccount ? "Open account thread" : "Open customer thread"}
                        </Link>
                      ) : null}
                    </div>
                  </>
                )}
              </VisitRailSection>
            ) : null}

            {selectedDrawerTab === "thread" && selectedIsCommercialAccount ? (
            <VisitRailSection
              compact
              defaultOpen={shouldOpenCommercialAccountThreadByDefault}
              description="Keep account contact, billing anchor, unit posture, and site network attached to this active commercial visit."
              title="Commercial account thread"
            >
              {!selectedBillingSite ? (
                <Callout tone="warning" title="Commercial billing is not anchored yet">
                  Add a billing site or account contact on the customer thread so finance and repeat closeout do not rebuild the commercial operating model from notes.
                </Callout>
              ) : null}
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Account contact</span>
                  <strong>{selectedAccountContactValue}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedAccountContactCopy}</p>
                </div>
                <div>
                  <span>Billing anchor</span>
                  <strong>{selectedCommercialBillingValue}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedCommercialBillingCopy}</p>
                </div>
                <div>
                  <span>Recurring units</span>
                  <strong>{selectedCommercialUnitValue}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedCommercialUnitCopy}</p>
                </div>
                <div>
                  <span>Site network</span>
                  <strong>
                    {selectedCustomerSites?.length
                      ? `${selectedCustomerSites.filter((site) => site.isActive).length} active site${
                          selectedCustomerSites.filter((site) => site.isActive).length === 1 ? "" : "s"
                        }`
                      : "No sites on file"}
                  </strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedCustomerSitePlaybookGapCount
                      ? `${selectedCustomerSitePlaybookGapCount} site playbook gap${selectedCustomerSitePlaybookGapCount === 1 ? "" : "s"} still need access memory before this account travels cleanly.`
                      : "Account sites, access rules, and repeat-location context are already attached to this commercial thread."}
                  </p>
                </div>
              </div>
              <div className="ui-button-grid">
                {selectedCustomerThreadHref ? (
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={selectedCustomerThreadHref}
                  >
                    Open account thread
                  </Link>
                ) : null}
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={selectedCustomerFinanceDeskHref}
                >
                  Open finance on account
                </Link>
                {selectedCustomerSitesHref ? (
                  <Link
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={selectedCustomerSitesHref}
                  >
                    Open account sites
                  </Link>
                ) : null}
              </div>
            </VisitRailSection>
            ) : null}

            {selectedDrawerTab === "commercial" ? (
            <div className="job-flow-sidebar__detail-block job-flow-sidebar__detail-block--workspace">
              <div className="job-flow-sidebar__detail-block-header job-flow-sidebar__detail-block-header--workspace">
                <span>Estimate sprint</span>
                <span className="job-flow-sidebar__action-copy">
                  Primary pricing work should stay attached to this visit thread, not drift into a separate admin loop.
                </span>
              </div>
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Builder stage</span>
                  <strong>{selectedEstimateBuildFocus.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateBuildFocus.copy}</p>
                </div>
                <div>
                  <span>Customer thread</span>
                  <strong>{selectedEstimateCustomerThread.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateCustomerThread.copy}</p>
                </div>
                <div>
                  <span>Live estimate</span>
                  <strong>{selectedEstimate?.estimateNumber ?? "No estimate yet"}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimate
                      ? `${formatCurrencyFromCents(selectedEstimate.totalCents)} · ${selectedEstimateSupportSummary.label}`
                      : "Start the first quote directly from this visit."}
                  </p>
                </div>
                <div>
                  <span>Sourcing state</span>
                  <strong>{selectedEstimateSourcingState.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateSourcingState.copy}</p>
                </div>
              </div>
              {selectedEstimateWorkspaceSummary ? (
                <div className="job-flow-sidebar__estimate-sprint-grid">
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Live lines</span>
                    <strong>{selectedEstimateWorkspaceSummary.lineItemCount}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Labor hours</span>
                    <strong>{selectedEstimateWorkspaceSummary.totalLaborHours}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Part lines</span>
                    <strong>{selectedEstimateWorkspaceSummary.partLineCount}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Templates</span>
                    <strong>{selectedEstimateWorkspace?.servicePackages.length ?? 0}</strong>
                  </div>
                </div>
              ) : null}
              {selectedEstimatePreviewLines.length ? (
                <div className="job-flow-sidebar__estimate-sprint-list">
                  {selectedEstimatePreviewLines.map((line) => (
                    <div className="job-flow-sidebar__estimate-sprint-item" key={line.id}>
                      <strong>{line.label}</strong>
                      <span>{line.meta}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="job-flow-sidebar__action-copy">
                  No live builder lines are staged yet. Use the builder from this thread to price the first labor or part move.
                </p>
              )}
              <div className="job-flow-sidebar__artifact-actions">
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedEstimateWorkspaceHref}>
                  {selectedEstimate?.status === "draft" ? "Review full quote" : "Open full quote"}
                </Link>
                {selectedEstimateWorkspaceSummary?.partLineCount || selectedOpenPartRequestCount ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedPartsWorkspaceHref}>
                    Source parts
                  </Link>
                ) : null}
                {selectedEstimate?.status === "sent" ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedEstimateSupportHref}>
                    {selectedEstimateSupportSummary.label}
                  </Link>
                ) : null}
              </div>
            </div>
            ) : null}

            {selectedDrawerTab !== "thread" ? (
            <div className="job-flow-sidebar__detail-block job-flow-sidebar__detail-block--workspace">
              <div className="job-flow-sidebar__detail-block-header job-flow-sidebar__detail-block-header--workspace">
                <span>{selectedDrawerTab === "commercial" ? "Commercial files" : "Support files"}</span>
              </div>
              <div className="job-flow-sidebar__artifact-grid">
                {selectedDrawerTab === "commercial" ? (
                <VisitArtifactCard
                  defaultOpen={prioritizeDrawerCommercialState}
                  label={invoiceArtifactSummary.title}
                  meta={invoiceArtifactSummary.copy}
                  status={invoiceArtifactSummary.status}
                  value={invoiceArtifactSummary.value}
                >
                  <div className="job-flow-sidebar__grid">
                    <div>
                      <span>Status</span>
                      <strong>{invoiceArtifactSummary.status}</strong>
                    </div>
                    <div>
                      <span>Record</span>
                      <strong>{selectedInvoice?.invoiceNumber ?? "No invoice yet"}</strong>
                    </div>
                    <div>
                      <span>Customer thread</span>
                      <strong>{selectedInvoiceCustomerThread.label}</strong>
                      <p className="job-flow-sidebar__action-copy">{selectedInvoiceCustomerThread.copy}</p>
                    </div>
                    <div>
                      <span>Promise confidence</span>
                      <strong>
                        {selectedPromiseConfidence
                          ? `${selectedPromiseConfidence.label} · ${selectedPromiseConfidence.confidencePercent}%`
                          : "No active timing cue"}
                      </strong>
                    </div>
                    <div>
                      <span>Release runway</span>
                      <strong>{selectedReleaseRunwayState?.label ?? "No active runway"}</strong>
                      <p className="job-flow-sidebar__action-copy">
                        {selectedReleaseRunwayState?.copy ??
                          "Release posture will stay attached to the active visit and invoice thread."}
                      </p>
                    </div>
                    <div>
                      <span>Site thread</span>
                      <strong>{selectedServiceSiteThreadSummary.siteLabel}</strong>
                    </div>
                  </div>
                  <div className="job-flow-sidebar__artifact-actions">
                    <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedInvoiceWorkspaceHref}>
                      {getInvoiceWorkspaceLabel(selectedInvoice, selectedWorkflowState)}
                    </Link>
                    {selectedInvoiceLinkSummary ? (
                      <a
                        className={buttonClassName({ size: "sm", tone: "ghost" })}
                        href={selectedInvoiceLinkSummary.publicUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open customer invoice
                      </a>
                    ) : canSendInvoiceNotification ? (
                      <form action={issueInvoiceCustomerLinkAction}>
                        <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                        <button className={buttonClassName({ size: "sm", tone: "ghost" })} type="submit">
                          Create customer invoice
                        </button>
                      </form>
                    ) : null}
                    {canSendInvoiceNotification ? (
                      <form action={sendVisitInvoiceNotificationAction}>
                        <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                        <button className={buttonClassName({ size: "sm", tone: "primary" })} type="submit">
                          {visitActionLabels.invoice}
                        </button>
                      </form>
                    ) : null}
                    {canSendPaymentReminder ? (
                      <form action={sendVisitPaymentReminderAction}>
                        <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                        <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                          {visitActionLabels.reminder}
                        </button>
                      </form>
                    ) : null}
                    {selectedCustomerThreadHref ? (
                      <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedCustomerThreadHref}>
                        {selectedIsCommercialAccount ? "Open account thread" : "Open customer thread"}
                      </Link>
                    ) : null}
                    {selectedCustomerSitesHref ? (
                      <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedCustomerSitesHref}>
                        Open site thread
                      </Link>
                    ) : null}
                  </div>
                </VisitArtifactCard>
                ) : null}
                {selectedDrawerTab === "support" ? visibleSupportArtifactCard : null}
                {selectedDrawerTab === "support" && overflowSupportArtifactCard ? (
                  <details className="job-flow-sidebar__artifact-overflow">
                    <summary className="job-flow-sidebar__artifact-overflow-summary">
                      More support files
                    </summary>
                    <div className="job-flow-sidebar__artifact-overflow-body">
                      {overflowSupportArtifactCard}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
            ) : null}

            {selectedDrawerTab === "thread" && selectedFollowUpSummary && shouldShowReturnWorkRecoveryRail ? (
              <VisitRailSection
                defaultOpen={Boolean(
                  selectedFollowUpSummary.needsSourceCloseout ||
                    selectedFollowUpSummary.shouldCreateReturnVisit ||
                    selectedFollowUpSummary.staleFollowUp
                )}
                description="Keep second-trip work attached to the same vehicle thread instead of letting it drift into fresh intake."
                title="Return-work recovery"
              >
                <div className="job-flow-sidebar__grid">
                  <div>
                    <span>Status</span>
                    <strong>{selectedFollowUpSummary.label}</strong>
                    <p className="job-flow-sidebar__action-copy">{selectedFollowUpSummary.copy}</p>
                  </div>
                  <div>
                    <span>Recovery owner</span>
                    <strong>{selectedFollowUpSummary.recoveryOwner}</strong>
                    <p className="job-flow-sidebar__action-copy">
                      This role should own the next recovery move on the return-work chain.
                    </p>
                  </div>
                </div>
                <div className="job-flow-sidebar__grid">
                  <div>
                    <span>Active thread</span>
                    <strong>
                      {selectedFollowUpSummary.activeRelatedVisitCount} open related visit
                      {selectedFollowUpSummary.activeRelatedVisitCount === 1 ? "" : "s"}
                    </strong>
                    <p className="job-flow-sidebar__action-copy">
                      Same-vehicle work stays visible here so the office can recover or route follow-up without rebuilding context.
                    </p>
                  </div>
                  <div>
                    <span>Customer status</span>
                    <strong>
                      {selectedFollowUpSummary.customerStatus
                        ? formatLabel(selectedFollowUpSummary.customerStatus)
                        : "No update prompt"}
                    </strong>
                    <p className="job-flow-sidebar__action-copy">
                      {selectedFollowUpSummary.customerStatusCopy ??
                        "No extra customer-facing follow-up update is recommended right now."}
                    </p>
                  </div>
                </div>
                {selectedFollowUpSummary.staleFollowUp ? (
                  <Callout tone="warning" title="Return-work recovery is slipping">
                    {selectedFollowUpSummary.staleCopy}
                  </Callout>
                ) : null}
                {selectedFollowUpSummary.needsSourceCloseout ? (
                  <Callout tone="warning" title="Source visit still needs closeout">
                    A return visit already exists, but this source visit still needs its own closeout path completed before the thread is clean.
                  </Callout>
                ) : null}
                {selectedFollowUpSummary.shouldCreateReturnVisit ? (
                  <Callout tone="warning" title="Create the return visit now">
                    Parts or inventory blockers still remain after this visit. Spin up the return visit before the customer thread goes cold.
                  </Callout>
                ) : null}
                <div className="ui-button-grid">
                  {selectedFollowUpSummary.sourceJobId ? (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={buildVisitsHref(effectiveFilters, { jobId: selectedFollowUpSummary.sourceJobId })}
                      scroll={false}
                    >
                      Open source visit
                    </Link>
                  ) : null}
                  {selectedFollowUpSummary.childJobId ? (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={buildVisitsHref(effectiveFilters, { jobId: selectedFollowUpSummary.childJobId })}
                      scroll={false}
                    >
                      Open return visit
                    </Link>
                  ) : null}
                  {selectedFollowUpSummary.needsSourceCloseout ? (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={selectedInvoice ? selectedInvoiceWorkspaceHref : selectedPrimaryHref}
                    >
                      Finish source closeout
                    </Link>
                  ) : null}
                  {selectedFollowUpSummary.shouldCreateReturnVisit && selectedVisitRecord ? (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={`/dashboard/visits/new?customerId=${selectedVisitRecord.customerId}&vehicleId=${selectedVisitRecord.vehicleId}&followUpJobId=${selectedVisit.id}`}
                    >
                      Create return visit
                    </Link>
                  ) : null}
                  <Link
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id, scope: "return_visit" })}
                    scroll={false}
                  >
                    Open return-visit queue
                  </Link>
                  {selectedFollowUpSummary.staleFollowUp ? (
                    <Link
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      href={buildVisitsHref(effectiveFilters, { jobId: selectedVisit.id, scope: "stale_return_visit" })}
                      scroll={false}
                    >
                      Open stale return queue
                    </Link>
                  ) : null}
                </div>
                {selectedFollowUpCommunication ? (
                  <form action={sendVisitFollowUpCommunicationAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <input name="followUpAction" type="hidden" value={selectedFollowUpCommunication.action} />
                    <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                      {selectedFollowUpCommunication.label}
                    </button>
                  </form>
                ) : null}
              </VisitRailSection>
            ) : null}

            {selectedDrawerTab === "thread" ? (
            <VisitRailSection
              compact
              defaultOpen={shouldOpenEstimateRunwayByDefault}
              description="Keep pricing, approval, and release attached to this visit instead of treating Estimates like a separate destination."
              title="Estimate runway"
            >
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Builder stage</span>
                  <strong>{selectedEstimateBuildFocus.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateBuildFocus.copy}</p>
                </div>
                <div>
                  <span>Customer quote thread</span>
                  <strong>{selectedEstimateCustomerThread.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateCustomerThread.copy}</p>
                </div>
                <div>
                  <span>Release runway</span>
                  <strong>
                    {selectedReleaseRunwayState?.label ??
                      selectedEstimateReleaseRunway?.label ??
                      selectedEstimateSupportSummary.label}
                  </strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedReleaseRunwayState?.copy ??
                      selectedEstimateReleaseRunway?.copy ??
                      (selectedEstimate
                        ? `${selectedEstimate.estimateNumber} is still attached to this visit for pricing, approval, and next-move ownership.`
                        : "Start the estimate from this visit so pricing and release stay on one service thread.")}
                  </p>
                </div>
                <div>
                  <span>Sourcing state</span>
                  <strong>{selectedEstimateSourcingState.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateSourcingState.copy}</p>
                </div>
              </div>
              {selectedEstimateWorkspaceSummary ? (
                <div className="job-flow-sidebar__estimate-sprint-grid">
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Live lines</span>
                    <strong>{selectedEstimateWorkspaceSummary.lineItemCount}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Labor hours</span>
                    <strong>{selectedEstimateWorkspaceSummary.totalLaborHours}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Part lines</span>
                    <strong>{selectedEstimateWorkspaceSummary.partLineCount}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Release state</span>
                    <strong>
                      {selectedReleaseRunwayState?.label ??
                        (selectedEstimateReleaseRunway?.workflowState
                          ? getVisitWorkflowLabel(selectedEstimateReleaseRunway.workflowState)
                          : selectedEstimateSupportSummary.label)}
                    </strong>
                  </div>
                </div>
              ) : null}
              {selectedEstimateReleaseRunway ? (
                <div className="job-flow-sidebar__estimate-sprint-grid">
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Owner</span>
                    <strong>{selectedEstimateReleaseRunway.ownerLabel}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Promise</span>
                    <strong>{selectedEstimateReleaseRunway.promiseLabel}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Visit state</span>
                    <strong>{getVisitWorkflowLabel(selectedEstimateReleaseRunway.workflowState)}</strong>
                  </div>
                  <div className="job-flow-sidebar__estimate-sprint-stat">
                    <span>Quoted total</span>
                    <strong>{formatCurrencyFromCents(selectedEstimate?.totalCents ?? 0)}</strong>
                  </div>
                </div>
              ) : null}
              <div className="job-flow-sidebar__artifact-actions">
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedEstimateWorkspaceHref}>
                  {canContinueEstimateBuilderFromThread
                    ? "Open full builder"
                    : getEstimateActionLabel(selectedEstimate, context.canEditRecords)}
                </Link>
                {selectedEstimateWorkspaceSummary?.partLineCount || selectedOpenPartRequestCount ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedPartsWorkspaceHref}>
                    Source parts
                  </Link>
                ) : null}
                {selectedEstimateReleaseRunway?.actionKind === "production_controls" ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedProductionControlsRailHref} scroll={false}>
                    {selectedEstimateReleaseRunway.primaryActionLabel}
                  </Link>
                ) : null}
                {selectedEstimateReleaseRunway?.actionKind === "release" && context.canEditRecords ? (
                  <form action={advanceVisitStatusAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <input name="reason" type="hidden" value="Released from visit thread" />
                    <input name="toStatus" type="hidden" value="scheduled" />
                    <button className={buttonClassName({ size: "sm", tone: "primary" })} type="submit">
                      {selectedEstimateReleaseRunway.primaryActionLabel}
                    </button>
                  </form>
                ) : null}
                {selectedEstimateReleaseRunway?.actionKind === "dispatch" ? (
                  <Link className={buttonClassName({ size: "sm", tone: "primary" })} href={selectedDispatchBoardHref}>
                    {selectedEstimateReleaseRunway.primaryActionLabel}
                  </Link>
                ) : null}
                {selectedEstimateLinkSummary ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={selectedEstimateLinkSummary.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open customer estimate
                  </a>
                ) : canSendEstimateNotification ? (
                  <form action={issueEstimateCustomerLinkAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button className={buttonClassName({ size: "sm", tone: "ghost" })} type="submit">
                      Create customer estimate
                    </button>
                  </form>
                ) : null}
                {canSendEstimateNotification ? (
                  <form action={sendVisitEstimateNotificationAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button
                      className={buttonClassName({
                        size: "sm",
                        tone: selectedEstimateReleaseRunway ? "secondary" : "primary"
                      })}
                      type="submit"
                    >
                      {visitActionLabels.estimate}
                    </button>
                  </form>
                ) : null}
              </div>
            </VisitRailSection>
            ) : null}

            {canContinueEstimateBuilderFromThread && selectedVisit ? (
            <VisitRailSection
              compact
              defaultOpen={!selectedEstimate}
              description="Add lines or new operation groups directly from the visit thread. Leave the full builder for deeper quote assembly."
              title="Builder continuation"
            >
              {!selectedEstimateWorkspaceSummary ? (
                <Callout tone="default" title="First quick add starts the draft builder">
                  The first line or section will create the draft estimate automatically and keep it attached to this visit.
                </Callout>
              ) : null}
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Draft thread</span>
                  <strong>{selectedEstimate ? selectedEstimate.estimateNumber : "Starts on first add"}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimate
                      ? "This draft stays on the active visit until pricing, approval, and release are complete."
                      : "Start the draft estimate here without bouncing out of Visits first."}
                  </p>
                </div>
                <div>
                  <span>Primary section</span>
                  <strong>{selectedEstimatePrimarySection?.title ?? "Recommended work"}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimatePrimarySection
                      ? "Quick-add lines land in the lead section by default so the quote keeps moving."
                      : "The first section is created automatically when the draft builder starts."}
                  </p>
                </div>
              </div>
              <div className="job-flow-sidebar__detail-block job-flow-sidebar__detail-block--workspace">
                <div className="job-flow-sidebar__detail-block-header job-flow-sidebar__detail-block-header--workspace">
                  <span>Quick add line</span>
                  <span className="job-flow-sidebar__action-copy">
                    Add labor, part, or fee lines here. Blank labor pricing uses the current labor default.
                  </span>
                </div>
                <form action={quickAddVisitEstimateLineAction} className="job-ops-toolbar__grid">
                  <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                  {selectedEstimatePrimarySection ? (
                    <input name="estimateSectionId" type="hidden" value={selectedEstimatePrimarySection.id} />
                  ) : null}
                  <label className="job-ops-toolbar__field">
                    <span>Line item</span>
                    <Input name="name" placeholder="Brake pads and hardware" type="text" />
                  </label>
                  <label className="job-ops-toolbar__field">
                    <span>Type</span>
                    <Select defaultValue="labor" name="itemType">
                      {estimateLineItemTypes.map((itemType) => (
                        <option key={itemType} value={itemType}>
                          {formatLabel(itemType)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="job-ops-toolbar__field">
                    <span>Qty</span>
                    <Input defaultValue="1" min="0.1" name="quantity" step="0.1" type="number" />
                  </label>
                  <label className="job-ops-toolbar__field">
                    <span>Unit price</span>
                    <Input defaultValue="" inputMode="decimal" name="unitPrice" placeholder="0.00" type="text" />
                  </label>
                  <label className="job-ops-toolbar__field">
                    <span>Line detail</span>
                    <Input name="description" placeholder="Optional details for the customer-facing quote" type="text" />
                  </label>
                  <div className="ui-button-grid">
                    <button className={buttonClassName({ size: "sm" })} type="submit">
                      Add line
                    </button>
                  </div>
                </form>
              </div>
              <div className="job-flow-sidebar__detail-block job-flow-sidebar__detail-block--workspace">
                <div className="job-flow-sidebar__detail-block-header job-flow-sidebar__detail-block-header--workspace">
                  <span>Add operation group</span>
                  <span className="job-flow-sidebar__action-copy">
                    Create the next estimate section here when the work needs a new repair grouping.
                  </span>
                </div>
                <form action={createVisitEstimateSectionAction} className="job-ops-toolbar__grid">
                  <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                  <label className="job-ops-toolbar__field">
                    <span>Section title</span>
                    <Input name="sectionTitle" placeholder="Front brake service" type="text" />
                  </label>
                  <label className="job-ops-toolbar__field">
                    <span>Section notes</span>
                    <Textarea
                      name="sectionDescription"
                      placeholder="Capture the operation group or repair focus for this section."
                      rows={2}
                    />
                  </label>
                  <div className="ui-button-grid">
                    <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                      Add section
                    </button>
                  </div>
                </form>
              </div>
              {selectedEstimatePreviewLines.length ? (
                <div className="job-flow-sidebar__estimate-sprint-list">
                  {selectedEstimatePreviewLines.map((line) => (
                    <div className="job-flow-sidebar__estimate-sprint-item" key={line.id}>
                      <strong>{line.label}</strong>
                      <span>{line.meta}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="job-flow-sidebar__artifact-actions">
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedEstimateWorkspaceHref}>
                  Open full builder
                </Link>
                {selectedEstimateWorkspaceSummary?.partLineCount || selectedOpenPartRequestCount ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedPartsWorkspaceHref}>
                    Source parts
                  </Link>
                ) : null}
              </div>
            </VisitRailSection>
            ) : null}

            {shouldShowEstimateCustomerThreadSection && selectedVisit ? (
            <VisitRailSection
              compact
              defaultOpen={isStaleApprovalEstimate(selectedEstimate)}
              description="Review, send, and chase approval from the active visit instead of treating the quote like a separate module."
              title="Customer quote thread"
            >
              {isStaleApprovalEstimate(selectedEstimate) ? (
                <Callout tone="warning" title="Approval follow-up is aging">
                  This quote has been sitting with the customer long enough to need an explicit approval nudge from the visit thread.
                </Callout>
              ) : null}
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Quote state</span>
                  <strong>{selectedEstimateSupportSummary.label}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimate
                      ? `${selectedEstimate.estimateNumber} · ${formatCurrencyFromCents(selectedEstimate.totalCents)}`
                      : "No estimate thread exists yet for this visit."}
                  </p>
                </div>
                <div>
                  <span>Customer access</span>
                  <strong>{selectedEstimateCustomerThread.label}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedEstimateCustomerThread.copy}</p>
                </div>
                <div>
                  <span>Review mode</span>
                  <strong>{selectedEstimateBuildFocus.label}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimate?.status === "draft"
                      ? "Finish quote review here, then move it into customer approval without leaving the visit."
                      : "Keep approval follow-up and customer access attached to this visit until the quote turns into release work."}
                  </p>
                </div>
                <div>
                  <span>Approval queue</span>
                  <strong>
                    {selectedEstimate?.status === "sent"
                      ? isStaleApprovalEstimate(selectedEstimate)
                        ? "Stale approval"
                        : "Awaiting answer"
                      : "Not in queue"}
                  </strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedEstimate?.status === "sent"
                      ? "Use the queue only as a slice. The next approval move should still happen from this active visit thread."
                      : "Once the quote is customer-ready, the approval queue becomes a support slice instead of the primary working surface."}
                  </p>
                </div>
              </div>
              <div className="job-flow-sidebar__artifact-actions">
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedEstimateWorkspaceHref}>
                  {selectedEstimate?.status === "draft" ? "Review full quote" : "Open full quote"}
                </Link>
                {canPromoteEstimateForCustomer ? (
                  <form action={markVisitEstimateReadyForCustomerAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button className={buttonClassName({ size: "sm", tone: "primary" })} type="submit">
                      Ready for customer
                    </button>
                  </form>
                ) : null}
                {selectedEstimateLinkSummary ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={selectedEstimateLinkSummary.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open customer estimate
                  </a>
                ) : canSendEstimateNotification ? (
                  <form action={issueEstimateCustomerLinkAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button className={buttonClassName({ size: "sm", tone: "ghost" })} type="submit">
                      Create customer estimate
                    </button>
                  </form>
                ) : null}
                {canSendEstimateNotification ? (
                  <form action={sendVisitEstimateNotificationAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button className={buttonClassName({ size: "sm", tone: canPromoteEstimateForCustomer ? "secondary" : "primary" })} type="submit">
                      {selectedEstimateLinkSummary ? "Resend estimate" : visitActionLabels.estimate}
                    </button>
                  </form>
                ) : null}
                {selectedEstimate?.status === "sent" ? (
                  <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedEstimateSupportHref}>
                    {isStaleApprovalEstimate(selectedEstimate) ? "Open stale approval queue" : "Open approval queue"}
                  </Link>
                ) : null}
              </div>
            </VisitRailSection>
            ) : null}

            {selectedDrawerTab === "thread" && shouldShowGuidedFollowThroughRail ? (
            <VisitRailSection
              compact
              defaultOpen={prioritizeDrawerCustomerUpdates}
              description="Run the next customer, billing, or timing move without leaving the active visit thread."
              title="Guided follow-through"
            >
              {selectedPromiseSummary?.recommendedAction ? (
                <Callout
                  tone={selectedPromiseSummary.tone === "danger" ? "danger" : "warning"}
                  title={selectedPromiseSummary.label}
                >
                  {selectedPromiseSummary.copy}
                </Callout>
              ) : null}
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Customer timing</span>
                  <strong>{selectedPromiseSummary?.label ?? "No active timing cue"}</strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedPromiseSummary?.copy ?? "No customer timing recovery is due right now."}
                  </p>
                </div>
                <div>
                  <span>Commercial state</span>
                  <strong>{selectedCommercialPanel.title}</strong>
                  <p className="job-flow-sidebar__action-copy">{selectedCommercialPanel.copy}</p>
                </div>
              </div>
              <div className="ui-button-grid">
                {selectedPromiseSummary?.recommendedAction === "set_promise" ? (
                  <Link
                    className={buttonClassName({ size: "sm" })}
                    href={selectedProductionControlsRailHref}
                    scroll={false}
                  >
                    Set time promise
                  </Link>
                ) : null}
                {selectedPromiseSummary?.recommendedAction === "appointment_confirmation" &&
                canSendAppointmentConfirmation ? (
                  <form action={sendVisitAppointmentConfirmationAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button className={buttonClassName({ size: "sm" })} type="submit">
                      {visitActionLabels.appointment}
                    </button>
                  </form>
                ) : null}
                {selectedPromiseSummary?.recommendedAction === "dispatched" && canSendDispatchUpdates ? (
                  <form action={sendVisitDispatchUpdateAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <input name="updateType" type="hidden" value="dispatched" />
                    <button className={buttonClassName({ size: "sm" })} type="submit">
                      {visitActionLabels.dispatched}
                    </button>
                  </form>
                ) : null}
                {selectedPromiseSummary?.recommendedAction === "en_route" && canSendDispatchUpdates ? (
                  <form action={sendVisitDispatchUpdateAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <input name="updateType" type="hidden" value="en_route" />
                    <button className={buttonClassName({ size: "sm" })} type="submit">
                      {visitActionLabels.enRoute}
                    </button>
                  </form>
                ) : null}
                {canSendPaymentReminder ? (
                  <form action={sendVisitPaymentReminderAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button
                      className={buttonClassName({
                        size: "sm",
                        tone: selectedPromiseSummary?.recommendedAction ? "secondary" : "primary"
                      })}
                      type="submit"
                    >
                      {visitActionLabels.reminder}
                    </button>
                  </form>
                ) : canSendInvoiceNotification ? (
                  <form action={sendVisitInvoiceNotificationAction}>
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <button
                      className={buttonClassName({
                        size: "sm",
                        tone: selectedPromiseSummary?.recommendedAction ? "secondary" : "primary"
                      })}
                      type="submit"
                    >
                      {visitActionLabels.invoice}
                    </button>
                  </form>
                ) : null}
                {selectedInvoiceLinkSummary ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={selectedInvoiceLinkSummary.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open customer invoice
                  </a>
                ) : selectedVisitLinkSummary ? (
                  <a
                    className={buttonClassName({ size: "sm", tone: "ghost" })}
                    href={selectedVisitLinkSummary.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open customer visit link
                  </a>
                ) : null}
              </div>
              {!selectedPromiseSummary?.recommendedAction &&
              !canSendInvoiceNotification &&
              !canSendPaymentReminder &&
              !selectedInvoiceLinkSummary &&
              !selectedVisitLinkSummary ? (
                <p className="job-flow-sidebar__action-copy">
                  No immediate outbound or billing action is due from this visit rail right now.
                </p>
              ) : null}
              {selectedVisit.assignedTechnicianUserId &&
              selectedTechnicianPreview &&
              !selectedTechnicianPreview.isReady ? (
                <p className="job-flow-sidebar__action-copy">
                  Meet Your Mechanic is not ready yet. The assigned technician still needs{" "}
                  {selectedTechnicianPreview.missingFields.join(", ")} before the customer visit link can be shared.
                </p>
              ) : null}
              <div className="job-flow-sidebar__grid">
                <div>
                  <span>Latest customer update</span>
                  <strong>
                    {selectedLatestCommunication
                      ? formatLabel(selectedLatestCommunication.communicationType)
                      : "No update logged"}
                  </strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedLatestCommunication
                      ? `${formatLabel(selectedLatestCommunication.status)} via ${selectedLatestCommunication.channel.toUpperCase()} to ${
                          selectedLatestCommunication.recipientName ??
                          selectedLatestCommunication.recipientEmail ??
                          selectedLatestCommunication.recipientPhone ??
                          "customer"
                        }`
                      : "No customer-facing communication has been logged from this visit yet."}
                  </p>
                </div>
                <div>
                  <span>Latest workflow handoff</span>
                  <strong>
                    {selectedLatestStatusChange
                      ? selectedLatestStatusChange.fromStatus
                        ? `${formatLabel(selectedLatestStatusChange.fromStatus)} -> ${formatLabel(selectedLatestStatusChange.toStatus)}`
                        : `Created in ${formatLabel(selectedLatestStatusChange.toStatus)}`
                      : "No handoff logged"}
                  </strong>
                  <p className="job-flow-sidebar__action-copy">
                    {selectedLatestStatusChange?.reason ?? "No workflow handoff note has been recorded yet."}
                  </p>
                </div>
              </div>
            </VisitRailSection>
            ) : null}

            {selectedDrawerTab === "thread" && context.canEditRecords ? (
              <div id="visit-production-controls">
                <VisitRailSection
                defaultOpen={[
                  "needs_assignment",
                  "needs_time_promise",
                  "ready_dispatch",
                  "promise_risk"
                ].includes(effectiveFilters.scope ?? "")}
                description="Run assignment, promise control, and the next workflow move from one production control section."
                title="Production controls"
              >
                {selectedPromiseSummary?.recommendedAction === "set_promise" ? (
                  <Callout tone="warning" title={selectedPromiseSummary.label}>
                    {selectedPromiseSummary.copy}
                  </Callout>
                ) : null}
                <div className="job-flow-sidebar__detail-block">
                  <div className="job-flow-sidebar__detail-block-header">
                    <span>Dispatch owner</span>
                    <span className="job-flow-sidebar__action-copy">Assign the field owner without leaving the queue.</span>
                  </div>
                  <form action={assignVisitOwnerAction} className="job-ops-toolbar__grid">
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <label className="job-ops-toolbar__field">
                      <span>Technician owner</span>
                      <Select defaultValue={selectedVisit.assignedTechnicianUserId ?? ""} name="assignedTechnicianUserId">
                        <option value="">Unassigned</option>
                        {(techniciansResult.data ?? []).map((technician) => (
                          <option key={technician.userId} value={technician.userId}>
                            {technician.displayName}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="ui-button-grid">
                      <button className={buttonClassName({ size: "sm" })} type="submit">
                        Save owner
                      </button>
                    </div>
                  </form>
                </div>

                <div className="job-flow-sidebar__detail-block">
                  <div className="job-flow-sidebar__detail-block-header">
                    <span>Promise control</span>
                    <span className="job-flow-sidebar__action-copy">Set a specific start or arrival window from this production rail.</span>
                  </div>
                  <form action={saveVisitScheduleAction} className="job-ops-toolbar__grid">
                    <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                    <label className="job-ops-toolbar__field">
                      <span>Specific start</span>
                      <Input defaultValue={toLocalDateTimeInput(selectedVisit.scheduledStartAt)} name="scheduledStartAt" type="datetime-local" />
                    </label>
                    <label className="job-ops-toolbar__field">
                      <span>Arrival window start</span>
                      <Input defaultValue={toLocalDateTimeInput(selectedVisit.arrivalWindowStartAt)} name="arrivalWindowStartAt" type="datetime-local" />
                    </label>
                    <label className="job-ops-toolbar__field">
                      <span>Arrival window end</span>
                      <Input defaultValue="" name="arrivalWindowEndAt" type="datetime-local" />
                    </label>
                    <div className="ui-button-grid">
                      <button className={buttonClassName({ size: "sm" })} type="submit">
                        Save time promise
                      </button>
                      <button className={buttonClassName({ size: "sm", tone: "ghost" })} name="clearSchedule" type="submit" value="1">
                        Clear schedule
                      </button>
                    </div>
                  </form>
                </div>

                <div className="job-flow-sidebar__detail-block">
                  <div className="job-flow-sidebar__detail-block-header">
                    <span>Next production move</span>
                    <span className="job-flow-sidebar__action-copy">Advance the visit from the queue when the next handoff is clear.</span>
                  </div>
                  {selectedAllowedNextStatuses.length ? (
                    <form action={advanceVisitStatusAction} className="job-ops-toolbar__grid">
                      <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                      <label className="job-ops-toolbar__field">
                        <span>Next status</span>
                        <Select defaultValue={selectedAllowedNextStatuses[0]} name="toStatus">
                          {selectedAllowedNextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatLabel(status)}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="job-ops-toolbar__field">
                        <span>Reason</span>
                        <Input name="reason" placeholder="Optional handoff note" type="text" />
                      </label>
                      <div className="ui-button-grid">
                        <button className={buttonClassName({ size: "sm" })} type="submit">
                          Move visit
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="job-flow-sidebar__action-copy">
                      No direct status transition is available from this queue state. Open the full visit for deeper workflow changes.
                    </p>
                  )}
                </div>
                </VisitRailSection>
              </div>
            ) : null}

            {selectedWorkflowCheckpoint ? (
              <Callout tone={selectedWorkflowCheckpoint.tone} title={selectedWorkflowCheckpoint.title}>
                {selectedWorkflowCheckpoint.body}
              </Callout>
            ) : null}

            {selectedSnapshotUnavailable ? (
              <Callout tone="warning" title="Partial rail snapshot">
                Some linked artifact details could not be loaded for this visit. Open the full visit or artifact pages before closing the drawer.
              </Callout>
            ) : null}

            {selectedDrawerTab === "support" && shouldShowInternalHandoffNotesRail ? (
              collapseInternalHandoffNotesRail ? (
                <details className="job-flow-sidebar__artifact-overflow">
                  <summary className="job-flow-sidebar__artifact-overflow-summary">
                    Internal handoff notes
                  </summary>
                  <div className="job-flow-sidebar__artifact-overflow-body">
                    <div className="job-flow-sidebar__detail-block-header">
                      <Link
                        className={buttonClassName({ size: "sm", tone: "ghost" })}
                        href={buildVisitDetailHref(selectedVisit.id, { returnScope: selectedReturnScope })}
                      >
                        Open timeline
                      </Link>
                    </div>
                    {context.canEditRecords ? (
                      <form action={saveVisitNoteAction} className="job-ops-toolbar__grid">
                        <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                        <label className="job-ops-toolbar__field">
                          <span>New internal note</span>
                          <Textarea
                            name="body"
                            placeholder="Add an internal note for dispatch, service, or follow-through."
                            rows={3}
                          />
                        </label>
                        <div className="ui-button-grid">
                          <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                            Save note
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </details>
              ) : (
                <VisitRailSection
                  compact
                  description="Capture and review internal handoff notes without expanding the full visit timeline."
                  title="Internal handoff notes"
                >
                  <div className="job-flow-sidebar__detail-block-header">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      href={buildVisitDetailHref(selectedVisit.id, { returnScope: selectedReturnScope })}
                    >
                      Open timeline
                    </Link>
                  </div>
                  {context.canEditRecords ? (
                    <form action={saveVisitNoteAction} className="job-ops-toolbar__grid">
                      <QueueReturnFields filters={effectiveFilters} jobId={selectedVisit.id} />
                      <label className="job-ops-toolbar__field">
                        <span>New internal note</span>
                        <Textarea
                          name="body"
                          placeholder="Add an internal note for dispatch, service, or follow-through."
                          rows={3}
                        />
                      </label>
                      <div className="ui-button-grid">
                        <button className={buttonClassName({ size: "sm", tone: "secondary" })} type="submit">
                          Save note
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {selectedNotes?.length ? (
                    selectedNotes.slice(0, 3).map((note) => (
                      <p className="job-flow-sidebar__action-copy" key={note.id}>
                        <strong>
                          {formatDateTime(note.createdAt, {
                            fallback: "Saved recently",
                            timeZone: context.company.timezone
                          })}
                        </strong>
                        {` ${note.body}`}
                      </p>
                    ))
                  ) : (
                    <p className="job-flow-sidebar__action-copy">
                      No internal notes have been logged on this visit yet.
                    </p>
                  )}
                </VisitRailSection>
              )
            ) : null}
          </aside>
        ) : null}
      </div>
    </QueuePage>
  );
}

export default VisitsWorkspacePageImpl;
