import {
  enqueueEstimateNotification,
  enqueuePaymentReminder,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  listEstimatesByCompany,
  listInvoicesByCompany,
  listJobsByCompany
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  getDispatchLocalDate,
  getSafeTimeZone,
  isTechnicianActiveFieldJobStatus,
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { Database, JobListItem } from "@mobile-mechanic/types";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AppIcon,
  Badge,
  EmptyState,
  Page,
  PageHeader,
  buttonClassName
} from "../../components/ui";
import { processCommunicationMutationResult } from "../../lib/communications/actions";
import { requireCompanyContext } from "../../lib/company-context";
import {
  ensureEstimateAccessLink,
  ensureInvoiceAccessLink,
  markEstimateAccessLinkSent,
  markInvoiceAccessLinkSent
} from "../../lib/customer-documents/service";
import { buildDashboardAliasHref } from "../../lib/dashboard/route-alias";
import { getFleetWorkspace } from "../../lib/fleet/workspace";
import {
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../lib/invoices/payment-handoffs";
import { buildWorkspaceBlockerSummary } from "../../lib/jobs/workspace-blockers";
import { getOfficeHomeWorkspace } from "../../lib/office-workspace-focus";
import { toServerError } from "../../lib/server-error";
import {
  buildVisitDetailHref,
  buildVisitEstimateHref,
  buildVisitInventoryHref,
  buildVisitInvoiceHref,
  type VisitWorkspaceLinkOptions
} from "../../lib/visits/workspace";
import { type DashboardActionSection } from "./_components/dashboard-action-rail";
import { type DashboardQueueItem } from "./_components/dashboard-queue-panel";
import {
  getFleetOperationalStatusLabel,
  getFleetRouteHealthTone,
  type FleetTechnicianView
} from "./fleet/_components/fleet-types";

type OperationalAlert = {
  body: string;
  href: string;
  key: "approval" | "assignment" | "carryover" | "delay";
  title: string;
  tone: "danger" | "warning" | "info" | "success";
};

type DashboardReadinessItem = {
  badgeLabel: string;
  badgeTone: "brand" | "success" | "warning";
  detail: string;
  href: string;
  title: string;
};

type DashboardLiveOwnerStop = {
  key: string;
  label: string;
  tone: "info" | "neutral" | "progress" | "warning";
};

type DashboardLiveOwnerCard = {
  badgeLabel: string;
  badgeTone: "brand" | "info" | "progress" | "warning";
  detail?: string;
  href: string;
  key: string;
  meta: string;
  ownerLabel: string;
  ownerName: string;
  stops: DashboardLiveOwnerStop[];
  summary: string;
  tailMeta: string;
};

function isOpenJob(status: string) {
  return !["completed", "canceled"].includes(status);
}

function getJobDisplayValue(input: {
  estimateTotalCents: number | null;
  invoiceTotalCents: number | null;
}) {
  return input.invoiceTotalCents ?? input.estimateTotalCents ?? 0;
}

function getBoardColumns(input: {
  billingJobs: JobListItem[];
  dispatchJobs: JobListItem[];
  liveJobs: JobListItem[];
}) {
  const dispatchJobs = input.dispatchJobs ?? [];
  const liveJobs = input.liveJobs ?? [];
  const billingJobs = input.billingJobs ?? [];
  const travelingJobs = liveJobs.filter((job) => isTechnicianTravelJobStatus(job.status));
  const onSiteJobs = liveJobs.filter((job) => isTechnicianOnSiteJobStatus(job.status));

  return [
    {
      description: "Stops that still need a lane owner before they can move.",
      jobs: dispatchJobs.slice(0, 6),
      key: "needs-dispatch",
      totalCount: dispatchJobs.length,
      title: "Needs dispatch"
    },
    {
      description: "Visits in transit and already on the road.",
      jobs: travelingJobs.slice(0, 6),
      key: "traveling",
      totalCount: travelingJobs.length,
      title: "Traveling"
    },
    {
      description: "Technicians actively working on-site right now.",
      jobs: onSiteJobs.slice(0, 6),
      key: "on-site",
      totalCount: onSiteJobs.length,
      title: "On site"
    },
    {
      description: "Work ready for billing review or invoice follow-through.",
      jobs: billingJobs.slice(0, 6),
      key: "ready-to-bill",
      totalCount: billingJobs.length,
      title: "Ready to invoice"
    }
  ];
}

function getVisibleBoardColumns(columns: ReturnType<typeof getBoardColumns>) {
  const activeColumns = columns.filter((column) => column.jobs.length > 0);

  return activeColumns.length ? activeColumns : columns;
}

function getDashboardJobLocalDate(job: JobListItem, timeZone: string) {
  if (!job.scheduledStartAt) {
    return null;
  }

  return getDispatchLocalDate(job.scheduledStartAt, timeZone);
}

function getDashboardDateAgeDays(dateValue: string | null, today: string) {
  if (!dateValue) {
    return null;
  }

  const dateTimestamp = Date.parse(`${dateValue}T00:00:00Z`);
  const todayTimestamp = Date.parse(`${today}T00:00:00Z`);

  if (Number.isNaN(dateTimestamp) || Number.isNaN(todayTimestamp)) {
    return null;
  }

  const dayDifference = Math.floor((todayTimestamp - dateTimestamp) / 86_400_000);

  return dayDifference > 0 ? dayDifference : null;
}

function getDashboardCarryoverAgeDays(job: JobListItem, timeZone: string, today: string) {
  return getDashboardDateAgeDays(getDashboardJobLocalDate(job, timeZone), today);
}

function getDashboardCarryoverAgeSignal(ageDays: number | null) {
  if (!ageDays) {
    return {
      label: "Carryover",
      tone: "neutral" as const
    };
  }

  if (ageDays >= 7) {
    return {
      label: `${ageDays}d stale`,
      tone: "danger" as const
    };
  }

  if (ageDays >= 3) {
    return {
      label: `${ageDays}d open`,
      tone: "warning" as const
    };
  }

  return {
    label: `${ageDays}d carryover`,
    tone: "neutral" as const
  };
}

function getDashboardBottleneckAction(key: string) {
  switch (key) {
    case "needs-dispatch":
      return "Assign lane owner";
    case "traveling":
      return "Watch arrival";
    case "on-site":
      return "Support live work";
    case "ready-to-bill":
      return "Collect and invoice";
    default:
      return "Move workflow";
  }
}

function compareDashboardJobs(left: JobListItem, right: JobListItem) {
  const rank = (status: string) => {
    switch (status) {
      case "ready_for_payment":
        return 0;
      case "repairing":
        return 1;
      case "waiting_parts":
      case "waiting_approval":
      case "diagnosing":
      case "arrived":
      case "in_progress":
        return 2;
      case "en_route":
      case "dispatched":
        return 3;
      case "scheduled":
        return 4;
      case "new":
        return 5;
      default:
        return 6;
    }
  };

  const statusDelta = rank(left.status) - rank(right.status);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  const leftTime = left.scheduledStartAt ? Date.parse(left.scheduledStartAt) : Number.MAX_SAFE_INTEGER;
  const rightTime = right.scheduledStartAt ? Date.parse(right.scheduledStartAt) : Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.title.localeCompare(right.title);
}

function formatDashboardDateShort(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDashboardDateLong(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric"
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDashboardJobTimeShort(value: string | null, timeZone: string) {
  if (!value) {
    return "No time set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No time set";
  }

  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(date);

  return `${day} · ${time}`;
}

function buildDashboardDispatchHref(date: string, technicianUserId?: string | null) {
  const params = new URLSearchParams({ date, view: "day" });

  if (technicianUserId) {
    params.set("resourceUserIds", technicianUserId);
  }

  return `/dashboard/dispatch?${params.toString()}`;
}

function buildDashboardVisitsHref(input?: {
  jobId?: string | null | undefined;
  scope?: string | undefined;
}) {
  return buildDashboardAliasHref("/dashboard/visits", {
    jobId: input?.jobId ?? undefined,
    scope: input?.scope ?? undefined
  });
}

function getDashboardQueueRouteLabel(job: JobListItem) {
  switch (job.status) {
    case "new":
      return "Needs dispatch owner";
    case "scheduled":
      return job.assignedTechnicianUserId ? "Arrival promised" : "Unassigned route";
    case "dispatched":
    case "en_route":
      return "Traveling to stop";
    case "arrived":
      return "Arrived on site";
    case "diagnosing":
      return "Diagnosing on site";
    case "waiting_approval":
      return "Waiting on approval";
    case "waiting_parts":
      return "Waiting on parts";
    case "repairing":
    case "in_progress":
      return "On site now";
    case "ready_for_payment":
      return "Ready for payment";
    case "completed":
      return "Ready for billing";
    default:
      return "Watch workflow";
  }
}

function getDashboardQueueContextLabel(job: JobListItem, carryoverJobIds: Set<string>) {
  const baseLabel = getDashboardQueueRouteLabel(job);

  if (!carryoverJobIds.has(job.id)) {
    return baseLabel;
  }

  return `Carryover · ${baseLabel}`;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function sendDashboardEstimateReminderAction(formData: FormData) {
  "use server";

  const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
  const jobId = getFormString(formData, "jobId");
  const returnHref = getFormString(formData, "returnHref") || "/dashboard";
  const latestJobResult = await getJobById(actionContext.supabase, jobId);
  const estimateResult = await getEstimateByJobId(actionContext.supabase, jobId);

  if (
    latestJobResult.error ||
    !latestJobResult.data ||
    latestJobResult.data.companyId !== actionContext.companyId ||
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

  await markEstimateAccessLinkSent(linkSummary.linkId, communication.id, actionContext.currentUserId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/visits");
  revalidatePath(`/dashboard/visits/${jobId}`);
  revalidatePath(`/dashboard/visits/${jobId}/estimate`);
  redirect(returnHref);
}

function getDistinctDashboardJobs(jobs: JobListItem[]) {
  const seenJobIds = new Set<string>();

  return jobs.filter((job) => {
    if (seenJobIds.has(job.id)) {
      return false;
    }

    seenJobIds.add(job.id);
    return true;
  });
}

function getDashboardAssignedTechnicianLabel(job: JobListItem) {
  if (job.assignedTechnicianName) {
    return job.assignedTechnicianName;
  }

  if (job.assignedTechnicianUserId) {
    return "Technician assigned";
  }

  if (["new", "scheduled"].includes(job.status)) {
    return "Needs assignment";
  }

  return "Dispatch needed";
}

function getDashboardInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "MM";
}

function getDashboardTechnicianUnitLabel(technician: FleetTechnicianView) {
  return technician.vehicleLabel ?? technician.vehicleUnit ?? "Service unit missing";
}

function getDashboardTechnicianDisplayName(technician: FleetTechnicianView) {
  if (!/^Technician [a-f0-9]{6}$/i.test(technician.name)) {
    return technician.name;
  }

  if (technician.email) {
    const localPart = technician.email.split("@")[0]?.trim();

    if (localPart) {
      return localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(" ");
    }
  }

  return technician.initials ? `Technician ${technician.initials}` : "Technician setup needed";
}

function getDashboardTechnicianSetupState(technician: FleetTechnicianView) {
  if (!technician.vehicleLabel && !technician.vehicleUnit) {
    return {
      badgeLabel: "Unit needed",
      detail: "Assign a service unit before routing more work.",
      title: "Service unit missing",
      tone: "warning" as const
    };
  }

  if (technician.currentLocationLabel === "Waiting for live GPS") {
    return {
      badgeLabel: "GPS offline",
      detail: "Live location is missing for dispatch watch.",
      title: "Live GPS missing",
      tone: "warning" as const
    };
  }

  return null;
}

function getDashboardTechnicianRouteTone(technician: FleetTechnicianView) {
  return getDashboardTechnicianSetupState(technician)?.tone ?? getFleetRouteHealthTone(technician.routeHealth);
}

function getDashboardTechnicianRouteLabel(technician: FleetTechnicianView) {
  return getDashboardTechnicianSetupState(technician)?.badgeLabel ?? technician.routeHealthLabel;
}

function getDashboardTechnicianRouteDetail(technician: FleetTechnicianView) {
  const setupState = getDashboardTechnicianSetupState(technician);

  if (setupState) {
    return setupState.detail;
  }

  const stopTitle =
    technician.currentStop?.title ??
    technician.nextStop?.title;

  if (stopTitle) {
    return `${stopTitle} · ${getDashboardTechnicianUnitLabel(technician)}`;
  }

  return `${getDashboardTechnicianUnitLabel(technician)} · Available for same-day assignment`;
}

function getDashboardTechnicianMeta(technician: FleetTechnicianView) {
  const setupState = getDashboardTechnicianSetupState(technician);

  if (setupState) {
    return `${getFleetOperationalStatusLabel(technician.status)} · ${setupState.badgeLabel}`;
  }

  return `${getFleetOperationalStatusLabel(technician.status)} · ${technician.jobsRemaining} stop${
    technician.jobsRemaining === 1 ? "" : "s"
  } left`;
}

function getDashboardDispatchCardLead(technician: FleetTechnicianView) {
  const setupState = getDashboardTechnicianSetupState(technician);

  if (technician.currentStop) {
    return {
      detail: technician.currentStop.windowLabel ?? technician.currentStop.cityStateLabel,
      label: "Current stop",
      title: technician.currentStop.title
    };
  }

  if (technician.nextStop) {
    return {
      detail: technician.nextStop.windowLabel ?? technician.nextStop.cityStateLabel,
      label: "Next stop",
      title: technician.nextStop.title
    };
  }

  if (setupState) {
    return {
      detail: setupState.detail,
      label: "Setup blocker",
      title: setupState.title
    };
  }

  if (technician.status === "idle") {
    return {
      detail: technician.currentLocationLabel,
      label: "Capacity",
      title: "Ready for same-day work"
    };
  }

  return {
    detail: technician.currentLocationLabel,
    label: getFleetOperationalStatusLabel(technician.status),
    title: "No stop promised yet"
  };
}

function getDashboardDispatchCardTail(technician: FleetTechnicianView) {
  const setupState = getDashboardTechnicianSetupState(technician);

  if (setupState) {
    return setupState.badgeLabel;
  }

  if (technician.routeHealth === "issue") {
    return "Needs reroute";
  }

  if (technician.routeHealth === "watch") {
    return "Watch route";
  }

  if (technician.status === "idle") {
    return "Open capacity";
  }

  if (technician.status === "on_job") {
    return "On site";
  }

  if (technician.status === "en_route") {
    return "Traveling";
  }

  return "Open lane";
}

function getDistinctDashboardTechnicians(technicians: FleetTechnicianView[]) {
  const seenTechnicianIds = new Set<string>();

  return technicians.filter((technician) => {
    if (seenTechnicianIds.has(technician.id)) {
      return false;
    }

    seenTechnicianIds.add(technician.id);
    return true;
  });
}

function getDashboardQueueNextAction(
  job: JobListItem,
  date: string,
  returnLinkOptions?: VisitWorkspaceLinkOptions
) {
  switch (job.status) {
    case "new":
      return {
        href: buildDashboardVisitsHref({ jobId: job.id, scope: "needs_assignment" }),
        label: "Open intake visit",
        visitHref: buildDashboardVisitsHref({ jobId: job.id, scope: "needs_assignment" }),
        workflowLabel: "Needs intake"
      };
    case "scheduled":
      return {
        href: job.assignedTechnicianUserId
          ? buildDashboardDispatchHref(date, job.assignedTechnicianUserId)
          : buildDashboardVisitsHref({ jobId: job.id, scope: "needs_assignment" }),
        label: job.assignedTechnicianUserId ? "Open dispatch lane" : "Assign in visits",
        visitHref: buildDashboardVisitsHref({
          jobId: job.id,
          scope: job.assignedTechnicianUserId ? "ready_dispatch" : "needs_assignment"
        }),
        workflowLabel: job.assignedTechnicianUserId ? "Ready for route" : "Needs assignment"
      };
    case "dispatched":
    case "en_route":
      return {
        href: buildDashboardDispatchHref(date, job.assignedTechnicianUserId),
        label: "Watch arrival",
        visitHref: buildVisitDetailHref(job.id, returnLinkOptions),
        workflowLabel: "Traveling"
      };
    case "arrived":
    case "diagnosing":
    case "waiting_approval":
    case "waiting_parts":
    case "repairing":
    case "ready_for_payment":
    case "in_progress":
      return {
        href: buildVisitDetailHref(job.id, returnLinkOptions),
        label: job.status === "ready_for_payment" ? "Review payment closeout" : "Review live visit",
        visitHref: buildVisitDetailHref(job.id, returnLinkOptions),
        workflowLabel:
          job.status === "waiting_approval"
            ? "Waiting approval"
            : job.status === "waiting_parts"
              ? "Waiting parts"
              : job.status === "ready_for_payment"
                ? "Ready for payment"
                : "On site"
      };
    case "completed":
      return {
        href: buildVisitInvoiceHref(job.id, returnLinkOptions),
        label: "Open closeout thread",
        visitHref: buildDashboardVisitsHref({ jobId: job.id, scope: "billing_follow_up" }),
        workflowLabel: "Ready to invoice"
      };
    default:
      return {
        href: buildVisitDetailHref(job.id, returnLinkOptions),
        label: "Open visit",
        visitHref: buildVisitDetailHref(job.id, returnLinkOptions),
        workflowLabel: "Watch workflow"
      };
  }
}

export default async function DashboardPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const homeWorkspace = getOfficeHomeWorkspace(context.membership.role);

  if (homeWorkspace.href !== "/dashboard") {
    redirect(homeWorkspace.href);
  }

  const timeZone = getSafeTimeZone(context.company.timezone);
  const now = new Date();
  const today = getDispatchLocalDate(now, timeZone);
  const todayShortLabel = formatDashboardDateShort(today, timeZone);
  const todayDisplayLabel = formatDashboardDateLong(today, timeZone);

  const [jobsResult, estimatesResult, invoicesResult, fleetWorkspace, openPartRequestsResult, inventoryIssuesResult] = await Promise.all([
    listJobsByCompany(context.supabase, context.companyId, { includeInactive: true }),
    listEstimatesByCompany(context.supabase, context.companyId),
    listInvoicesByCompany(context.supabase, context.companyId),
    getFleetWorkspace(context, { date: today }),
    context.supabase
      .from("part_requests")
      .select("job_id, status")
      .eq("company_id", context.companyId)
      .eq("status", "open")
      .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>(),
    context.supabase
      .from("job_inventory_issues")
      .select("job_id, status")
      .eq("company_id", context.companyId)
      .returns<
        Array<Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">>
      >()
  ]);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Owner brief could not load visits.");
  }

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Owner brief could not load estimates.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Owner brief could not load invoices.");
  }

  if (openPartRequestsResult.error) {
    throw toServerError(
      openPartRequestsResult.error,
      "Owner brief could not load supply blockers."
    );
  }

  if (inventoryIssuesResult.error) {
    throw toServerError(
      inventoryIssuesResult.error,
      "Owner brief could not load inventory issues."
    );
  }

  const jobs = jobsResult.data ?? [];
  const estimates = estimatesResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const invoiceIdToJobId = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice.jobId]));
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
  const closeoutFieldHandoffCount = Array.from(openPaymentHandoffCountByJobId.values()).reduce(
    (sum, count) => sum + count,
    0
  );
  const activeJobs = jobs.filter((job) => job.isActive && isOpenJob(job.status));
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const estimatesByJobId = new Map(
    estimates.map((estimate) => [
      estimate.jobId,
      { status: estimate.status, totalCents: estimate.totalCents }
    ])
  );
  const invoicesByJobId = new Map(
    invoices.map((invoice) => [
      invoice.jobId,
      {
        balanceDueCents: invoice.balanceDueCents,
        dueAt: null,
        status: invoice.status,
        totalCents: invoice.totalCents,
        updatedAt: invoice.updatedAt
      }
    ])
  );
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
  const workspaceBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId,
    inventoryIssuesByJobId,
    invoicesByJobId,
    jobs: jobs.filter((job) => {
      if (job.isActive && isOpenJob(job.status)) {
        return true;
      }

      if ((openPaymentHandoffCountByJobId.get(job.id) ?? 0) > 0) {
        return true;
      }

      const invoice = invoicesByJobId.get(job.id);
      return Boolean(invoice && invoice.balanceDueCents > 0 && invoice.status !== "paid" && invoice.status !== "void");
    }),
    paymentHandoffSummaryByJobId,
    openPaymentHandoffCountByJobId,
    openPartRequestsByJobId
  });
  const todayQueueJobs = activeJobs.filter((job) => {
    if (job.status === "new") {
      return true;
    }

    return getDashboardJobLocalDate(job, timeZone) === today;
  });
  const carryoverJobs = activeJobs.filter((job) => {
    if (!isTechnicianActiveFieldJobStatus(job.status)) {
      return false;
    }

    const scheduledDate = getDashboardJobLocalDate(job, timeZone);

    return !scheduledDate || scheduledDate < today;
  });
  const carryoverJobIds = new Set(carryoverJobs.map((job) => job.id));
  const liveWorkflowJobs = getDistinctDashboardJobs(
    activeJobs.filter((job) => isTechnicianActiveFieldJobStatus(job.status))
  );
  const waitingApprovalEstimates = estimates.filter((estimate) => estimate.status === "sent");
  const assignmentGaps = todayQueueJobs.filter(
    (job) => ["new", "scheduled"].includes(job.status) && !job.assignedTechnicianUserId
  );
  const delayedJobs = todayQueueJobs.filter((job) => {
    if (!job.scheduledStartAt) {
      return false;
    }

    return (
      Date.parse(job.scheduledStartAt) < now.getTime() &&
      !["completed", "canceled"].includes(job.status) &&
      !isTechnicianOnSiteJobStatus(job.status)
    );
  });
  const billingReadyJobs = completedJobs
    .filter((job) => getDashboardJobLocalDate(job, timeZone) === today)
    .filter((job) => invoicesByJobId.get(job.id)?.status !== "paid")
    .sort((left, right) => {
      const leftTime = left.scheduledStartAt ? Date.parse(left.scheduledStartAt) : 0;
      const rightTime = right.scheduledStartAt ? Date.parse(right.scheduledStartAt) : 0;

      return rightTime - leftTime;
    });
  const outstandingBalance = invoices.reduce((total, invoice) => total + invoice.balanceDueCents, 0);
  const setupGapTechnicians = fleetWorkspace.technicians.filter((technician) =>
    Boolean(getDashboardTechnicianSetupState(technician))
  );
  const availableTechnicians = fleetWorkspace.technicians.filter(
    (technician) => technician.status === "idle" && !getDashboardTechnicianSetupState(technician)
  );
  const routeWatchTechnicians = fleetWorkspace.technicians.filter(
    (technician) =>
      !getDashboardTechnicianSetupState(technician) &&
      (technician.routeHealth !== "healthy" || ["delayed", "offline"].includes(technician.status))
  );
  const techniciansWithRouteContext = fleetWorkspace.technicians.filter(
    (technician) =>
      !getDashboardTechnicianSetupState(technician) && Boolean(technician.currentStop || technician.nextStop)
  );
  const dispatchBlockerJobs = getDistinctDashboardJobs(assignmentGaps).sort(compareDashboardJobs);
  const liveOwnerGroupCount = Array.from(
    getDistinctDashboardJobs(liveWorkflowJobs).reduce<Map<string, number>>((groups, job) => {
      const ownerKey =
        job.assignedTechnicianUserId ??
        (job.assignedTechnicianName ? `name:${job.assignedTechnicianName}` : `unassigned:${job.id}`);
      groups.set(ownerKey, (groups.get(ownerKey) ?? 0) + 1);
      return groups;
    }, new Map())
  ).length;
  const alerts: OperationalAlert[] = [
    carryoverJobs.length
      ? {
          body: `Live work from before ${todayShortLabel} is still open. Close it or move it forward so today's queue stays trustworthy.`,
          href: buildDashboardDispatchHref(today),
          key: "carryover",
          title: `${carryoverJobs.length} carryover live visit${carryoverJobs.length === 1 ? "" : "s"}`,
          tone: "danger"
        }
      : null,
    delayedJobs.length
      ? {
          body: "Scheduled stops have missed their planned start windows and still need dispatch follow-through.",
          href: "/dashboard/visits?scope=ready_dispatch",
          key: "delay",
          title: `${delayedJobs.length} delayed visit${delayedJobs.length === 1 ? "" : "s"}`,
          tone: "danger"
        }
      : null,
    assignmentGaps.length
      ? {
          body: "Assign a lane owner so today's field work can move.",
          href: "/dashboard/visits?scope=needs_assignment",
          key: "assignment",
          title: `${assignmentGaps.length} visit${assignmentGaps.length === 1 ? "" : "s"} need assignment`,
          tone: "warning"
        }
      : null,
    waitingApprovalEstimates.length
      ? {
          body: "Customer approval is still blocking work release.",
          href: "/dashboard/visits?scope=awaiting_approval",
          key: "approval",
          title: `${waitingApprovalEstimates.length} estimate${waitingApprovalEstimates.length === 1 ? "" : "s"} waiting approval`,
          tone: "warning"
        }
      : null
  ].filter((alert): alert is OperationalAlert => Boolean(alert));
  const boardColumns = getBoardColumns({
    billingJobs: billingReadyJobs,
    dispatchJobs: dispatchBlockerJobs,
    liveJobs: liveWorkflowJobs
  });
  const activeBottlenecks = boardColumns.filter((column) => column.jobs.length > 0);
  const workflowColumns = getVisibleBoardColumns(boardColumns);
  const hiddenWorkflowCount = Math.max(boardColumns.length - workflowColumns.length, 0);
  const fieldQueue = getDistinctDashboardJobs([...carryoverJobs, ...todayQueueJobs]).sort(compareDashboardJobs);
  const queueBacklogJobs = getDistinctDashboardJobs(
    todayQueueJobs.filter((job) => ["new", "scheduled"].includes(job.status))
  ).sort(compareDashboardJobs);
  const priorityAlerts = alerts.filter((alert) => !["approval", "carryover"].includes(alert.key)).slice(0, 4);
  const approvalQueue = waitingApprovalEstimates.slice(0, 4);
  const routeAttentionCount = routeWatchTechnicians.length;
  const routeAttention = routeWatchTechnicians.slice(0, 4);
  const dispatchWatchTechnicians = getDistinctDashboardTechnicians([
    ...routeAttention,
    ...techniciansWithRouteContext
  ]);
  const dispatchDeskTechnicians = dispatchWatchTechnicians.slice(0, 4);
  const hiddenDispatchTechnicianCount = Math.max(dispatchWatchTechnicians.length - dispatchDeskTechnicians.length, 0);
  const technicianById = new Map(fleetWorkspace.technicians.map((technician) => [technician.id, technician]));
  const carryoverAgeDays = carryoverJobs
    .map((job) => getDashboardCarryoverAgeDays(job, timeZone, today))
    .filter((ageDays): ageDays is number => ageDays !== null);
  const oldestCarryoverAgeDays = carryoverAgeDays.length ? Math.max(...carryoverAgeDays) : null;
  const oldestCarryoverJob =
    [...carryoverJobs].sort((left, right) => {
      const leftTimestamp = left.scheduledStartAt ? Date.parse(left.scheduledStartAt) : Number.MAX_SAFE_INTEGER;
      const rightTimestamp = right.scheduledStartAt ? Date.parse(right.scheduledStartAt) : Number.MAX_SAFE_INTEGER;
      return leftTimestamp - rightTimestamp;
    })[0] ?? null;
  const liveTravelingCount = liveWorkflowJobs.filter((job) => isTechnicianTravelJobStatus(job.status)).length;
  const liveOnSiteCount = liveWorkflowJobs.filter((job) => isTechnicianOnSiteJobStatus(job.status)).length;
  const carryoverSummary = [
    {
      key: "traveling",
      label: "Traveling",
      value: carryoverJobs.filter((job) => isTechnicianTravelJobStatus(job.status)).length
    },
    {
      key: "on-site",
      label: "On site",
      value: carryoverJobs.filter((job) => isTechnicianOnSiteJobStatus(job.status)).length
    },
    {
      key: "oldest-open",
      label: "Oldest open",
      value: oldestCarryoverAgeDays ? `${oldestCarryoverAgeDays}d` : "Now"
    }
  ];
  const dispatchWatchOwnerCount = dispatchWatchTechnicians.length || liveOwnerGroupCount;
  const dispatchWatchPrimarySignal = routeAttentionCount
    ? {
        label: `${routeAttentionCount} route flag${routeAttentionCount === 1 ? "" : "s"}`,
        tone: "warning" as const
      }
    : dispatchWatchOwnerCount
      ? {
          label: `${dispatchWatchOwnerCount} live owner${dispatchWatchOwnerCount === 1 ? "" : "s"} active`,
          tone: "brand" as const
        }
      : {
          label: "Routes clear",
          tone: "success" as const
        };
  const headerBriefItems = [
    {
      key: "live",
      label: "Live",
      tone: "brand" as const,
      value: liveWorkflowJobs.length ? `${liveWorkflowJobs.length} moving` : "Clear"
    },
    {
      key: "supply",
      label: "Supply",
      tone: workspaceBlockers.supplyBlockedCount ? ("warning" as const) : ("success" as const),
      value: workspaceBlockers.supplyBlockedCount ? `${workspaceBlockers.supplyBlockedCount} blocked` : "Clear"
    },
    {
      key: "finance",
      label: "Money",
      tone: workspaceBlockers.financeBlockedCount ? ("warning" as const) : ("success" as const),
      value: workspaceBlockers.financeBlockedCount ? `${workspaceBlockers.financeBlockedCount} threads` : "Current"
    }
  ];
  const ownerBriefHeaderItems = headerBriefItems.slice(0, 1);
  const upcomingJobs = activeJobs
    .filter((job) => {
      if (!job.scheduledStartAt) {
        return false;
      }

      const scheduledDate = getDashboardJobLocalDate(job, timeZone);

      return Boolean(scheduledDate && scheduledDate > today);
    })
    .sort((left, right) => {
      const leftTime = left.scheduledStartAt ? Date.parse(left.scheduledStartAt) : Number.MAX_SAFE_INTEGER;
      const rightTime = right.scheduledStartAt ? Date.parse(right.scheduledStartAt) : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, 3);
  const moneyWaiting = invoices
    .filter((invoice) => invoice.balanceDueCents > 0)
    .sort((left, right) => right.balanceDueCents - left.balanceDueCents)
    .slice(0, 3);
  const dispatchDayHref = buildDashboardDispatchHref(today);
  const todayBriefVisitLinkOptions: VisitWorkspaceLinkOptions = {
    returnLabel: "Back to Today brief",
    returnTo: "/dashboard"
  };
  const nextVisitFocusCommand = carryoverJobs[0]
    ? {
        href: buildDashboardVisitsHref({ jobId: carryoverJobs[0].id, scope: "ready_dispatch" }),
        label: "Recover carryover"
      }
    : workspaceBlockers.approvedReleaseItems[0]
      ? {
          href: buildDashboardVisitsHref({
            jobId: workspaceBlockers.approvedReleaseItems[0].jobId,
            scope: "approved_release"
          }),
          label: "Release approved visit"
        }
      : workspaceBlockers.staleApprovalCount
        ? {
            href: buildDashboardVisitsHref({ scope: "stale_approval" }),
            label: "Chase stale approvals"
          }
        : queueBacklogJobs[0]
          ? {
              href: getDashboardQueueNextAction(queueBacklogJobs[0], today, todayBriefVisitLinkOptions).visitHref,
              label: getDashboardQueueNextAction(queueBacklogJobs[0], today, todayBriefVisitLinkOptions).label
            }
          : {
              href: buildDashboardVisitsHref({
                scope: workspaceBlockers.approvedReleaseCount ? "ready_dispatch" : undefined
              }),
              label: workspaceBlockers.approvedReleaseCount ? "Open release runway" : "Open visits"
            };
  const nextVisitFocusHref = nextVisitFocusCommand.href;
  const closeoutThreadHref = workspaceBlockers.financeBlockedItems[0]
    ? buildVisitInvoiceHref(workspaceBlockers.financeBlockedItems[0].jobId, todayBriefVisitLinkOptions)
    : "/dashboard/finance";
  const closeoutSignalCopy = closeoutFieldHandoffCount
    ? `${closeoutFieldHandoffCount} field handoff${closeoutFieldHandoffCount === 1 ? "" : "s"} waiting in Finance.`
    : workspaceBlockers.financeBlockedItems.length
      ? `${workspaceBlockers.financeBlockedItems.length} finance blocker${workspaceBlockers.financeBlockedItems.length === 1 ? "" : "s"} waiting in Finance.`
      : upcomingJobs.length
        ? "Review tomorrow risk."
        : "No closeout or tomorrow pressure.";
  const dispatchWatchOwnerCards: DashboardLiveOwnerCard[] =
    dispatchDeskTechnicians.length || !liveWorkflowJobs.length
      ? []
      : Array.from(
          getDistinctDashboardJobs(liveWorkflowJobs)
            .sort(compareDashboardJobs)
            .reduce<Map<string, JobListItem[]>>((groups, job) => {
              const ownerKey =
                job.assignedTechnicianUserId ??
                (job.assignedTechnicianName ? `name:${job.assignedTechnicianName}` : `unassigned:${job.id}`);
              const currentJobs = groups.get(ownerKey) ?? [];
              currentJobs.push(job);
              groups.set(ownerKey, currentJobs);
              return groups;
            }, new Map())
        ).map(([key, jobs]) => {
          const leadJob = jobs[0]!;
          const ownerTechnician = leadJob.assignedTechnicianUserId
            ? (technicianById.get(leadJob.assignedTechnicianUserId) ?? null)
            : null;
          const ownerName =
            leadJob.assignedTechnicianName?.trim() ||
            (ownerTechnician ? getDashboardTechnicianDisplayName(ownerTechnician) : "Dispatch owner needed");
          const ownerUnitLabel = ownerTechnician?.vehicleLabel ?? ownerTechnician?.vehicleUnit ?? null;
          const vehicleLabels = [
            ...new Set(
              jobs
                .map((job) =>
                  job.vehicleDisplayName && job.vehicleDisplayName !== "Unknown vehicle"
                    ? job.vehicleDisplayName
                    : null
                )
                .filter((label): label is string => Boolean(label))
            )
          ];
          const leadVehicleLabel = vehicleLabels[0] ?? null;
          const travelingCount = jobs.filter((job) => isTechnicianTravelJobStatus(job.status)).length;
          const onSiteCount = jobs.filter((job) => isTechnicianOnSiteJobStatus(job.status)).length;
          const oldestJobAgeDays = jobs
            .map((job) => getDashboardCarryoverAgeDays(job, timeZone, today))
            .filter((ageDays): ageDays is number => ageDays !== null);
          const oldestOwnerAgeDays = oldestJobAgeDays.length ? Math.max(...oldestJobAgeDays) : null;
          const summaryLabel =
            jobs.length === 1
              ? leadJob.customerDisplayName
              : `${leadJob.customerDisplayName} + ${jobs.length - 1} more stop${jobs.length === 2 ? "" : "s"}`;
          const vehicleSummary =
            vehicleLabels.length > 1
              ? `${vehicleLabels.length} vehicles`
              : vehicleLabels[0] ?? null;
          const ownerMeta = [
            vehicleSummary,
            oldestOwnerAgeDays
              ? `oldest ${oldestOwnerAgeDays}d`
              : `${jobs.length} live visit${jobs.length === 1 ? "" : "s"}`
          ]
            .filter(Boolean)
            .join(" · ");
          const ownerDetail =
            oldestOwnerAgeDays && oldestOwnerAgeDays >= 3
              ? `Oldest carryover ${oldestOwnerAgeDays}d`
              : null;
          const stopSignals: DashboardLiveOwnerStop[] = jobs.slice(0, 2).map((job) => ({
            key: job.id,
            label: `${
              job.vehicleDisplayName && job.vehicleDisplayName !== "Unknown vehicle"
                ? job.vehicleDisplayName
                : job.customerDisplayName
            } · ${getDashboardQueueRouteLabel(job)}`,
            tone:
              isTechnicianOnSiteJobStatus(job.status)
                ? ("progress" as const)
                : isTechnicianTravelJobStatus(job.status)
                  ? ("info" as const)
                  : ("neutral" as const)
          }));

          if (jobs.length > stopSignals.length) {
            stopSignals.push({
              key: `${key}-more`,
              label: `+${jobs.length - stopSignals.length} more`,
              tone: "neutral"
            });
          }

          return {
            badgeLabel:
              travelingCount && onSiteCount
                ? `${travelingCount} traveling · ${onSiteCount} on site`
                : onSiteCount
                  ? `${onSiteCount} on site`
                  : travelingCount
                    ? `${travelingCount} traveling`
                    : `${jobs.length} live`,
            badgeTone:
              travelingCount && onSiteCount
                ? ("brand" as const)
                : onSiteCount
                  ? ("progress" as const)
                : travelingCount
                  ? ("info" as const)
                  : ("warning" as const),
            href: buildDashboardDispatchHref(today, leadJob.assignedTechnicianUserId),
            key,
            meta: ownerMeta,
            ownerLabel:
              ownerName === "Dispatch owner needed"
                ? "Owner pending"
                : ownerUnitLabel
                  ? ownerUnitLabel
                  : vehicleLabels.length > 1
                    ? `${vehicleLabels.length} vehicles`
                    : leadVehicleLabel
                      ? leadVehicleLabel
                      : leadJob.assignedTechnicianUserId
                        ? "Named owner"
                        : "Name pending",
            ownerName,
            stops: stopSignals,
            summary: summaryLabel,
            tailMeta: `${jobs.length} active stop${jobs.length === 1 ? "" : "s"}`,
            ...(ownerDetail ? { detail: ownerDetail } : {})
          };
        });
  const ownerBriefTechnicians = dispatchDeskTechnicians.slice(0, 1);
  const ownerBriefOwnerCards = dispatchWatchOwnerCards.slice(0, 1);
  const coveredQueueCount = fieldQueue.filter((job) => Boolean(job.assignedTechnicianName || job.assignedTechnicianUserId)).length;
  const supportCrewSummary = [
    setupGapTechnicians.length
      ? {
          key: "setup",
          label: "Setup blocked",
          tone: "warning" as const,
          value: setupGapTechnicians.length
        }
      : null,
    availableTechnicians.length
      ? {
          key: "available",
          label: "Open lanes",
          tone: "success" as const,
          value: availableTechnicians.length
        }
      : null,
    {
      key: "covered",
      label: "Covered lanes",
      tone: "brand" as const,
      value: coveredQueueCount
    }
  ].filter(
    (
      item
    ): item is {
      key: string;
      label: string;
      tone: "brand" | "success" | "warning";
      value: number;
    } => Boolean(item)
  );
  const fieldReadinessItems = [
    setupGapTechnicians.length
      ? {
          badgeLabel: `${setupGapTechnicians.length} blocked`,
          badgeTone: "warning" as const,
          detail: "Assign service units or restore GPS to reopen blocked lanes.",
          href: "/dashboard/fleet?panel=team",
          title: "Resolve setup gaps"
        }
      : null,
    availableTechnicians.length
      ? {
          badgeLabel: `${availableTechnicians.length} open`,
          badgeTone: "success" as const,
          detail: "Configured technicians can take another stop today.",
          href: dispatchDayHref,
          title: "Open same-day capacity"
        }
      : liveWorkflowJobs.length
      ? {
          badgeLabel: "All lanes committed",
          badgeTone: "brand" as const,
          detail: "Close live work or billing to reopen capacity.",
          href: dispatchDayHref,
          title: "All lanes committed"
        }
      : null
  ].filter((item): item is DashboardReadinessItem => Boolean(item));
  const supportBillingSummary = [
    {
      key: "outstanding",
      label: "Unpaid invoices",
      tone: outstandingBalance ? ("warning" as const) : ("neutral" as const),
      value: formatCurrencyFromCents(outstandingBalance)
    },
    ...(closeoutFieldHandoffCount
      ? [
          {
            key: "handoffs",
            label: "Field handoffs",
            tone: "warning" as const,
            value: `${closeoutFieldHandoffCount}`
          }
        ]
      : []),
    ...(upcomingJobs.length
      ? [
          {
            key: "upcoming",
            label: "Future work",
            tone: "brand" as const,
            value: `${upcomingJobs.length}`
          }
        ]
      : [])
  ];
  const railSectionCandidates: DashboardActionSection[] = [
    {
      emptyCopy: "No owner-critical failures are open right now.",
      icon: "alert",
      items: priorityAlerts.map((alert) => ({
        actionHref: alert.href,
        actionLabel:
          alert.href === dispatchDayHref
            ? "Open dispatch"
            : alert.href.startsWith("/dashboard/visits")
              ? "Open visit focus"
              : "Open workflow",
        badgeLabel:
          alert.key === "assignment"
            ? "Needs dispatch"
            : alert.key === "delay"
              ? "Delayed"
              : alert.key === "carryover"
                ? "Carryover"
                : "Urgent",
        badgeTone: alert.tone,
        detail: alert.body,
        id: `urgent-${alert.title}`,
        title: alert.title,
        ...(alert.href === dispatchDayHref
          ? {}
          : {
              secondaryHref: dispatchDayHref,
              secondaryLabel: "Open dispatch"
            })
      })),
      key: "urgent",
      title: "Urgent"
    },
    {
      emptyCopy: "No approval threads are blocking release right now.",
      icon: "approval",
      items: approvalQueue.map((estimate) => ({
        actionHref: buildVisitDetailHref(estimate.jobId, todayBriefVisitLinkOptions),
        actionLabel: "Open visit focus",
        badgeLabel: formatCurrencyFromCents(estimate.totalCents),
        badgeTone: "warning",
        detail: [estimate.title, estimate.customerName, estimate.vehicleLabel].filter(Boolean).join(" · "),
        id: `approval-${estimate.estimateId}`,
        meta: "Sent to customer",
        secondaryHref: buildVisitEstimateHref(estimate.jobId, todayBriefVisitLinkOptions),
        secondaryLabel: "Open estimate",
        submitAction: sendDashboardEstimateReminderAction,
        submitHiddenInputs: [
          { name: "jobId", value: estimate.jobId },
          { name: "returnHref", value: "/dashboard" }
        ],
        submitLabel: "Send reminder",
        submitPendingLabel: "Queueing...",
        title: estimate.estimateNumber
      })),
      key: "approval",
      title: "Approvals"
    },
    {
      emptyCopy: "No live visit is blocked by sourcing right now.",
      icon: "inventory",
      items: workspaceBlockers.supplyBlockedItems.slice(0, 4).map((item) => ({
        actionHref: buildVisitInventoryHref(item.jobId, todayBriefVisitLinkOptions),
        actionLabel: "Open supply blocker",
        badgeLabel: `${item.supplyBlockerCount} blocker${item.supplyBlockerCount === 1 ? "" : "s"}`,
        badgeTone: item.supplyOwnership.tone,
        detail: [item.customerDisplayName, item.vehicleDisplayName].filter(Boolean).join(" · "),
        id: `supply-${item.jobId}`,
        meta: item.supplyOwnership.copy,
        secondaryHref: "/dashboard/supply",
        secondaryLabel: "Open supply desk",
        title: item.title
      })),
      key: "supply",
      title: "Supply"
    },
    {
      emptyCopy: "No route-confidence failures or open capacity risks are active right now.",
      icon: "team",
      items: (
        routeAttention.length
          ? routeAttention.map((technician) => ({
              actionHref: `/dashboard/fleet?panel=team&technicianId=${technician.id}`,
              actionLabel: "Inspect technician",
              badgeLabel: getDashboardTechnicianRouteLabel(technician),
              badgeTone: getDashboardTechnicianRouteTone(technician),
              detail: getDashboardTechnicianRouteDetail(technician),
              id: `route-${technician.id}`,
              meta: getDashboardTechnicianMeta(technician),
              secondaryHref: buildDashboardDispatchHref(today, technician.id),
              secondaryLabel: "Open lane",
              title: getDashboardTechnicianDisplayName(technician)
            }))
          : fleetWorkspace.technicians
              .filter(
                (technician) => technician.status === "idle" && !getDashboardTechnicianSetupState(technician)
              )
              .slice(0, 4)
              .map((technician) => ({
                actionHref: `/dashboard/fleet?panel=team&technicianId=${technician.id}`,
                actionLabel: "Inspect technician",
                badgeLabel: "Available",
                badgeTone: "success" as const,
                detail: `${getDashboardTechnicianUnitLabel(technician)} · Available for same-day assignment`,
                id: `capacity-${technician.id}`,
                meta: getDashboardTechnicianMeta(technician),
                secondaryHref: buildDashboardDispatchHref(today, technician.id),
                secondaryLabel: "Open lane",
                title: getDashboardTechnicianDisplayName(technician)
              }))
      ),
      key: "route",
      title: "Route watch"
    }
  ];
  const railSections = railSectionCandidates.filter((section) => section.items.length > 0);
  const visibleRailSections = railSections.length
    ? railSections.slice(0, 1)
    : railSectionCandidates.slice(0, 1);
  const singleRailSection = visibleRailSections.length === 1 ? visibleRailSections[0] : null;
  const queuePreviewLimit = queueBacklogJobs.length > 18 ? 3 : 4;
  const visibleQueueJobs = queueBacklogJobs.slice(0, queuePreviewLimit);
  const hiddenQueueCount = Math.max(queueBacklogJobs.length - visibleQueueJobs.length, 0);
  const utilityPreviewLimit = 2;
  const visibleReadinessItems = fieldReadinessItems.slice(0, utilityPreviewLimit);
  const hiddenReadinessCount = Math.max(fieldReadinessItems.length - visibleReadinessItems.length, 0);
  const visibleMoneyWaiting = moneyWaiting.slice(0, utilityPreviewLimit);
  const hiddenMoneyWaitingCount = Math.max(moneyWaiting.length - visibleMoneyWaiting.length, 0);
  const visibleUpcomingJobs = upcomingJobs.slice(0, utilityPreviewLimit);
  const hiddenUpcomingCount = Math.max(upcomingJobs.length - visibleUpcomingJobs.length, 0);
  const queueItems: DashboardQueueItem[] = visibleQueueJobs.map((job) => {
    const estimate = estimatesByJobId.get(job.id);
    const invoice = invoicesByJobId.get(job.id);
    const nextAction = getDashboardQueueNextAction(job, today, todayBriefVisitLinkOptions);

    return {
      customerName: job.customerDisplayName,
      dispatchHref: buildDashboardDispatchHref(today, job.assignedTechnicianUserId),
      id: job.id,
      visitHref: nextAction.visitHref,
      nextActionHref: nextAction.href,
      nextActionLabel: nextAction.label,
      routeLabel: getDashboardQueueContextLabel(job, carryoverJobIds),
      scheduledLabel: formatDashboardJobTimeShort(job.scheduledStartAt, context.company.timezone),
      status: job.status,
      technicianName: getDashboardAssignedTechnicianLabel(job),
      title: job.title,
      valueLabel: formatCurrencyFromCents(
        getJobDisplayValue({
          estimateTotalCents: estimate?.totalCents ?? null,
          invoiceTotalCents: invoice?.totalCents ?? null
        })
      ),
      vehicleLabel: job.vehicleDisplayName || "Vehicle details needed",
      workflowLabel: nextAction.workflowLabel
    };
  });
  const compactQueueItems = queueItems.slice(0, 2);
  const moneyWaitingBalanceCents = moneyWaiting.reduce((sum, invoice) => sum + invoice.balanceDueCents, 0);
  const leadReadinessItem = visibleReadinessItems[0] ?? null;
  const leadMoneyWaiting = visibleMoneyWaiting[0] ?? null;
  const leadUpcomingJob = visibleUpcomingJobs[0] ?? null;
  const showReadinessSupportPanel = Boolean(
    visibleReadinessItems.length ||
      hiddenReadinessCount ||
      supportCrewSummary.some((item) => item.tone !== "success")
  );
  const showBillingSupportPanel = Boolean(
    visibleMoneyWaiting.length ||
      hiddenMoneyWaitingCount ||
      visibleUpcomingJobs.length ||
      hiddenUpcomingCount ||
      moneyWaitingBalanceCents
  );
  const showSupportGrid = showReadinessSupportPanel || showBillingSupportPanel;
  const totalRailItems = visibleRailSections.reduce((sum, section) => sum + section.items.length, 0);
  const hasWorkspaceContent = Boolean(fieldQueue.length || dispatchDeskTechnicians.length || activeBottlenecks.length);
  const queuePanelEyebrow = hiddenQueueCount ? "Visits backlog" : carryoverJobs.length || liveWorkflowJobs.length ? "Next from visits" : "Visits queue";
  const queuePanelTitle =
    hiddenQueueCount
      ? "Next visits to release"
      : carryoverJobs.length
      ? "Release after recovery"
      : liveWorkflowJobs.length
        ? "Release next from visits"
        : "Release next from visits";
  const queueEmptyTitle = carryoverJobs.length
    ? "No scheduled work is waiting behind carryover"
    : liveWorkflowJobs.length
      ? "No new work is waiting behind the live lanes"
      : "Today's field queue is clear";
  const queueEmptyCopy = carryoverJobs.length
    ? "Keep dispatch focused on closing the active lanes first."
    : liveWorkflowJobs.length
      ? "Keep the crew on the current handoff until a new stop is ready."
      : "New blockers still surface in Interventions.";
  const showQueuePanel = Boolean(queueItems.length);
  const hasSingleRailSection = visibleRailSections.length === 1;
  const dispatchWatchTitle = dispatchDeskTechnicians.length
    ? "Live lanes"
    : "Lane ownership";
  const carryoverPriorityNote = oldestCarryoverJob
    ? `Oldest carryover opened ${formatDashboardJobTimeShort(oldestCarryoverJob.scheduledStartAt, context.company.timezone)}. Keep new same-day promises behind the active handoff.`
    : "Carryover still needs dispatch ownership and billing follow-through.";
  const railEyebrow = hasSingleRailSection && singleRailSection ? singleRailSection.title : "Interventions";
  const railIcon = hasSingleRailSection && singleRailSection ? singleRailSection.icon : ("alert" as const);
  const railTitle =
    hasSingleRailSection && singleRailSection
      ? singleRailSection.key === "approval"
        ? "Approval queue"
        : singleRailSection.title
      : "Interventions";
  const railDescription =
    hasSingleRailSection && singleRailSection
      ? singleRailSection.key === "approval"
        ? "Resolve customer decisions from the side drawer."
        : `Handle the next ${singleRailSection.title.toLowerCase()} blocker from the side drawer.`
      : "Keep the next owner move in view without page hopping.";
  const railCollapsedSummary = visibleRailSections.length
    ? visibleRailSections
        .map((section) => `${section.items.length} ${section.title.toLowerCase()}`)
        .join(" · ")
    : `${totalRailItems} follow-through item${totalRailItems === 1 ? "" : "s"}`;
  const queueCollapsedSummary = hiddenQueueCount
    ? `${queueItems.length} shown of ${queueBacklogJobs.length} scheduled stops`
    : `${queueItems.length} scheduled stop${queueItems.length === 1 ? "" : "s"}`;
  const readinessCollapsedSummary = visibleReadinessItems.length || hiddenReadinessCount
    ? `${visibleReadinessItems.length + hiddenReadinessCount} readiness item${
        visibleReadinessItems.length + hiddenReadinessCount === 1 ? "" : "s"
      }`
    : "Crew setup is healthy";
  const billingCollapsedSummary = moneyWaiting.length || upcomingJobs.length
    ? `${formatCurrencyFromCents(moneyWaitingBalanceCents)} open${closeoutFieldHandoffCount ? ` · ${closeoutFieldHandoffCount} handoff${closeoutFieldHandoffCount === 1 ? "" : "s"}` : ""} · ${upcomingJobs.length} future`
      : "No money or future work waiting";
  const shouldOpenActionRail = Boolean(priorityAlerts.length || totalRailItems <= 3);
  const shouldOpenReadinessPanel = Boolean(visibleReadinessItems.length);
  const shouldOpenBillingPanel = Boolean(moneyWaiting.length);
  const supportCrewSummaryClassName = [
    "dashboard-cockpit__support-summary",
    supportCrewSummary.length === 1
      ? "dashboard-cockpit__support-summary--single"
      : supportCrewSummary.length === 2
        ? "dashboard-cockpit__support-summary--compact"
        : ""
  ]
    .filter(Boolean)
    .join(" ");
  const supportBillingSummaryClassName = [
    "dashboard-cockpit__support-summary",
    "dashboard-cockpit__support-summary--billing",
    supportBillingSummary.length === 1 ? "dashboard-cockpit__support-summary--single" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const financeGridClassName = [
    "dashboard-cockpit__finance-grid",
    upcomingJobs.length ? "" : "dashboard-cockpit__finance-grid--single"
  ]
    .filter(Boolean)
    .join(" ");
  const dashboardGridClassName = hasSingleRailSection
    ? "dashboard-cockpit__grid dashboard-cockpit__grid--single-rail"
    : "dashboard-cockpit__grid";
  const railPanelClassName = hasSingleRailSection
    ? "dashboard-cockpit__rail-panel dashboard-cockpit__rail-panel--single"
    : "dashboard-cockpit__rail-panel";
  const workflowLaneGridClassName = [
    "dashboard-cockpit__lane-grid",
    workflowColumns.length === 1
      ? "dashboard-cockpit__lane-grid--single"
      : workflowColumns.length === 2
        ? "dashboard-cockpit__lane-grid--double"
        : workflowColumns.length === 3
          ? "dashboard-cockpit__lane-grid--triple"
          : ""
  ]
    .filter(Boolean)
    .join(" ");
  const workflowBadgeLabel = activeBottlenecks.length
    ? `${activeBottlenecks.length} active${hiddenWorkflowCount ? ` · ${hiddenWorkflowCount} quiet` : ""}`
    : "Flow stable";
  const primaryUrgentAlert = priorityAlerts[0] ?? null;
  const visibleOwnerBriefHeaderItems = ownerBriefHeaderItems.slice(0, 1);
  const hiddenOwnerBriefHeaderCount = Math.max(
    ownerBriefHeaderItems.length - visibleOwnerBriefHeaderItems.length,
    0
  );
  const showDispatchWatchSurface = Boolean(
    ownerBriefTechnicians.length || ownerBriefOwnerCards.length || setupGapTechnicians.length
  );
  const leadDispatchWatchTechnician = ownerBriefTechnicians[0] ?? null;
  const leadDispatchWatchOwnerCard = ownerBriefOwnerCards[0] ?? null;
  return (
    <Page className="dashboard-cockpit dashboard-command" layout="command">
      <PageHeader
        actions={
          <div className="dashboard-command__actions">
            <Link className={buttonClassName({ size: "sm" })} href={dispatchDayHref}>
              Open live board
            </Link>
          </div>
        }
        description="Start here for the shop-level next move. Visits owns intake and release, Dispatch owns live execution, and Finance owns closeout."
        status={
          <Badge tone="brand">{todayDisplayLabel}</Badge>
        }
        title="Today brief"
      />

      <section className={dashboardGridClassName}>
        <div className="dashboard-cockpit__main">
          <section className="dashboard-cockpit__workspace dashboard-cockpit__workspace--brief">
            {hasWorkspaceContent ? (
              <div className="dashboard-cockpit__workspace-body">
                {carryoverJobs.length ? (
                  <section className="dashboard-cockpit__workspace-priority dashboard-cockpit__workspace-priority--danger">
                    <div className="dashboard-cockpit__workspace-priority-header">
                      <div>
                        <p className="dashboard-cockpit__eyebrow">
                          <AppIcon className="dashboard-cockpit__eyebrow-icon" name="alert" />
                          <span>Recovery first</span>
                        </p>
                        <h3 className="dashboard-cockpit__panel-title">Recover loose carryover before releasing new work</h3>
                        <p className="dashboard-cockpit__workspace-priority-copy">
                          Traveling and on-site work from before {todayShortLabel} still needs dispatch ownership and billing follow-through.
                        </p>
                      </div>
                    </div>

                    <div className="dashboard-cockpit__workspace-priority-summary">
                      {carryoverSummary.map((item) => (
                        <div className="dashboard-cockpit__workspace-priority-stat" key={item.key}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    <p className="dashboard-cockpit__workspace-priority-note">{carryoverPriorityNote}</p>
                  </section>
                ) : null}

                <div className="dashboard-cockpit__workspace-flow">
                  <section className="dashboard-cockpit__lane-panel">
                    <div className="dashboard-cockpit__panel-header">
                      <div>
                        <p className="dashboard-cockpit__eyebrow">
                          <AppIcon className="dashboard-cockpit__eyebrow-icon" name="dashboard" />
                          <span>Release pressure</span>
                        </p>
                        <h3 className="dashboard-cockpit__panel-title">Hottest release pressure</h3>
                      </div>
                      <Badge tone={activeBottlenecks.length ? "warning" : "success"}>{workflowBadgeLabel}</Badge>
                    </div>

                    <div className={workflowLaneGridClassName}>
                      {workflowColumns.map((column) => {
                        const visibleLaneJobs = column.jobs.slice(0, 2);
                        const hiddenLaneJobs = Math.max(column.totalCount - visibleLaneJobs.length, 0);

                        return (
                          <section className="dashboard-cockpit__lane" key={column.key}>
                            <div className="dashboard-cockpit__lane-header">
                              <div>
                                <h3 className="dashboard-cockpit__lane-title">{column.title}</h3>
                                <p className="dashboard-cockpit__lane-action">{getDashboardBottleneckAction(column.key)}</p>
                              </div>
                              <Badge tone="neutral">{column.totalCount}</Badge>
                            </div>
                            {column.jobs.length ? (
                              <>
                                <div className="dashboard-cockpit__lane-list">
                                  {visibleLaneJobs.map((job) => (
                                    <Link
                                      className="dashboard-cockpit__lane-item"
                                      href={getDashboardQueueNextAction(job, today, todayBriefVisitLinkOptions).visitHref}
                                      key={job.id}
                                    >
                                      <strong>{job.title}</strong>
                                      <span>
                                        {job.customerDisplayName} · {getDashboardQueueContextLabel(job, carryoverJobIds)}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                                {hiddenLaneJobs ? (
                                  <p className="dashboard-cockpit__lane-overflow">
                                    +{hiddenLaneJobs} more in this lane
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="dashboard-cockpit__empty">Stage clear.</p>
                            )}
                          </section>
                        );
                      })}
                    </div>

                    {showQueuePanel ? null : (
                      <div className="dashboard-cockpit__lane-note" role="note">
                        <p className="dashboard-cockpit__lane-note-title">{queueEmptyTitle}</p>
                      </div>
                    )}
                  </section>

                  <div className="dashboard-cockpit__workspace-sidebar">
                    {primaryUrgentAlert ? (
                      <section className="dashboard-cockpit__dispatch-watch dashboard-cockpit__dispatch-watch--urgent">
                        <div className="dashboard-cockpit__dispatch-watch-header">
                          <div>
                            <p className="dashboard-cockpit__eyebrow">
                              <AppIcon className="dashboard-cockpit__eyebrow-icon" name="alert" />
                              <span>Urgent</span>
                            </p>
                            <h3 className="dashboard-cockpit__panel-title">{primaryUrgentAlert.title}</h3>
                          </div>
                        </div>
                        <p className="dashboard-cockpit__dispatch-card-detail">{primaryUrgentAlert.body}</p>
                        <div className="ui-table-actions">
                          <Link className={buttonClassName({ size: "sm" })} href={primaryUrgentAlert.href}>
                            {primaryUrgentAlert.href === dispatchDayHref ? "Open live board" : "Open next move"}
                          </Link>
                        </div>
                      </section>
                    ) : null}

                    {showDispatchWatchSurface ? (
                      <section className="dashboard-cockpit__dispatch-watch">
                        <div className="dashboard-cockpit__dispatch-watch-header">
                          <div>
                            <p className="dashboard-cockpit__eyebrow">
                              <AppIcon className="dashboard-cockpit__eyebrow-icon" name="dispatch" />
                              <span>Live route pressure</span>
                            </p>
                            <h3 className="dashboard-cockpit__panel-title">{dispatchWatchTitle}</h3>
                          </div>
                          <div className="dashboard-cockpit__dispatch-watch-signals">
                            <Badge tone={dispatchWatchPrimarySignal.tone}>{dispatchWatchPrimarySignal.label}</Badge>
                          </div>
                        </div>
                        <div className="dashboard-cockpit__dispatch-watch-grid">
                          {leadDispatchWatchTechnician ? (
                            (() => {
                              const lead = getDashboardDispatchCardLead(leadDispatchWatchTechnician);
                              const setupState = getDashboardTechnicianSetupState(leadDispatchWatchTechnician);

                              return (
                                <Link
                                  className={`dashboard-cockpit__dispatch-card${
                                    setupState ? " dashboard-cockpit__dispatch-card--setup" : ""
                                  }`}
                                  href={buildDashboardDispatchHref(today, leadDispatchWatchTechnician.id)}
                                >
                                  <div className="dashboard-cockpit__dispatch-card-top">
                                    <div className="dashboard-cockpit__dispatch-card-person">
                                      <span aria-hidden="true" className="dashboard-cockpit__dispatch-card-avatar">
                                        {leadDispatchWatchTechnician.initials}
                                      </span>
                                      <div>
                                        <p className="dashboard-cockpit__dispatch-card-title">
                                          {getDashboardTechnicianDisplayName(leadDispatchWatchTechnician)}
                                        </p>
                                        <p className="dashboard-cockpit__dispatch-card-copy">
                                          {getDashboardTechnicianUnitLabel(leadDispatchWatchTechnician)}
                                        </p>
                                      </div>
                                    </div>
                                    <Badge tone={getDashboardTechnicianRouteTone(leadDispatchWatchTechnician)}>
                                      {getDashboardTechnicianRouteLabel(leadDispatchWatchTechnician)}
                                    </Badge>
                                  </div>
                                  <div className="dashboard-cockpit__dispatch-card-main">
                                    <strong>{lead.title}</strong>
                                    <span>{lead.label}</span>
                                  </div>
                                  <div className="dashboard-cockpit__dispatch-card-bottom">
                                    <span className="dashboard-cockpit__dispatch-card-route">
                                      {getDashboardTechnicianMeta(leadDispatchWatchTechnician)}
                                    </span>
                                    <span>View lane</span>
                                  </div>
                                </Link>
                              );
                            })()
                          ) : leadDispatchWatchOwnerCard ? (
                            <Link className="dashboard-cockpit__dispatch-card dashboard-cockpit__dispatch-card--owner" href={leadDispatchWatchOwnerCard.href}>
                              <div className="dashboard-cockpit__dispatch-card-top">
                                <div className="dashboard-cockpit__dispatch-card-person">
                                  <span aria-hidden="true" className="dashboard-cockpit__dispatch-card-avatar">
                                    {getDashboardInitials(leadDispatchWatchOwnerCard.ownerName)}
                                  </span>
                                  <div>
                                    <p className="dashboard-cockpit__dispatch-card-title">{leadDispatchWatchOwnerCard.ownerName}</p>
                                    <p className="dashboard-cockpit__dispatch-card-copy">{leadDispatchWatchOwnerCard.ownerLabel}</p>
                                  </div>
                                </div>
                                <Badge tone={leadDispatchWatchOwnerCard.badgeTone}>{leadDispatchWatchOwnerCard.badgeLabel}</Badge>
                              </div>
                              <div className="dashboard-cockpit__dispatch-card-main">
                                <strong>{leadDispatchWatchOwnerCard.summary}</strong>
                                <span>{leadDispatchWatchOwnerCard.meta}</span>
                              </div>
                              <div className="dashboard-cockpit__dispatch-card-bottom">
                                <span className="dashboard-cockpit__dispatch-card-route">{leadDispatchWatchOwnerCard.tailMeta}</span>
                                <span>View lane</span>
                              </div>
                            </Link>
                          ) : (
                            <p className="dashboard-cockpit__empty">
                              {setupGapTechnicians.length
                                ? "No lane is burning yet. Keep setup blockers in Fleet."
                                : "No live route needs intervention right now."}
                            </p>
                          )}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <div className="dashboard-cockpit__owner-signals">
                    <Link className="dashboard-cockpit__owner-signal" href={nextVisitFocusCommand.href}>
                      <span className="dashboard-cockpit__owner-signal-label">Next visits to release</span>
                      <strong className="dashboard-cockpit__owner-signal-value">
                        {queueBacklogJobs.length ? `${queueBacklogJobs.length} ready` : "Clear"}
                      </strong>
                      <span className="dashboard-cockpit__owner-signal-copy">{nextVisitFocusCommand.label}</span>
                    </Link>
                    <Link className="dashboard-cockpit__owner-signal" href="/dashboard/fleet">
                      <span className="dashboard-cockpit__owner-signal-label">Field readiness</span>
                      <strong className="dashboard-cockpit__owner-signal-value">
                        {setupGapTechnicians.length
                          ? `${setupGapTechnicians.length} blocked`
                          : availableTechnicians.length
                            ? `${availableTechnicians.length} open`
                            : "Covered"}
                      </strong>
                      <span className="dashboard-cockpit__owner-signal-copy">
                        {setupGapTechnicians.length
                          ? "Resolve setup gaps first."
                          : availableTechnicians.length
                            ? "Open lane capacity is available."
                            : "No readiness block is active."}
                      </span>
                    </Link>
                    <Link className="dashboard-cockpit__owner-signal" href={closeoutThreadHref}>
                      <span className="dashboard-cockpit__owner-signal-label">Unpaid invoices</span>
                      <strong className="dashboard-cockpit__owner-signal-value">
                        {outstandingBalance
                          ? formatCurrencyFromCents(outstandingBalance)
                          : upcomingJobs.length
                            ? `${upcomingJobs.length} queued`
                            : "Clear"}
                      </strong>
                      <span className="dashboard-cockpit__owner-signal-copy">
                        {outstandingBalance || workspaceBlockers.financeBlockedItems.length
                          ? closeoutSignalCopy
                          : upcomingJobs.length
                            ? "Review tomorrow risk."
                            : "No closeout or tomorrow pressure."}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                actions={
                  context.canEditRecords ? (
                    <>
                      <Link className={buttonClassName()} href="/dashboard/visits/new">
                        Create visit
                      </Link>
                      <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits/new?mode=estimate">
                        Create estimate
                      </Link>
                    </>
                  ) : undefined
                }
                description={`No dispatch, release, or collections exception is open for ${todayDisplayLabel}.`}
                eyebrow="Brief clear"
                title="No owner exception is open"
                tone="success"
              />
            )}
          </section>
        </div>

      </section>
    </Page>
  );
}
