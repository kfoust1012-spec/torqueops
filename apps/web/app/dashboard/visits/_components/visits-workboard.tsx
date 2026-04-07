"use client";

import type { ReactNode } from "react";
import {
  formatCurrencyFromCents,
  formatDateTime,
  isTechnicianActiveFieldJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { AssignableTechnicianOption, Estimate, Invoice, JobListItem } from "@mobile-mechanic/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  AppIcon,
  Badge,
  Button,
  Callout,
  Input,
  PriorityBadge,
  Select,
  StatusBadge,
  Textarea,
  buttonClassName,
  cx
} from "../../../../components/ui";
import {
  assessVisitWorkflowMove,
  getVisitNextMove,
  getVisitPrimaryAction,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone,
  type VisitWorkflowState
} from "../../../../lib/jobs/workflow";
import {
  getVisitTrustSummary,
  getVisitPromiseSummary,
  isVisitReadinessRisk
} from "../../../../lib/jobs/operational-health";
import {
  isFollowUpVisit,
  isStaleFollowUpVisit
} from "../../../../lib/jobs/follow-up";
import {
  getVisitBillingActionLabel as getBillingActionLabel,
  getVisitBillingGroups as getBillingGroups,
  getVisitBillingNote as getBillingNote,
  getVisitBillingSortRank as getBillingSortRank,
  getVisitBillingState as getBillingState,
  getVisitBillingStateLabel as getBillingStateLabel,
  getVisitBillingStateTone as getBillingStateTone,
  type VisitBillingGroup as BillingGroup,
  type VisitBillingState as BillingState
} from "../../../../lib/invoices/billing-state";
import {
  buildVisitEstimateHref,
  buildVisitInvoiceHref,
  buildVisitPhotosHref
} from "../../../../lib/visits/workspace";

type VisitsFilterState = {
  assignedTechnicianUserId: string;
  dateFrom: string;
  dateTo: string;
  focus: string;
  jobId: string;
  query: string;
  scope: string;
  status: string;
  workflowState: string;
};

type VisitBoardColumn = {
  description: string;
  label: string;
  state: VisitWorkflowState;
};

type VisitCardDensity = "default" | "dense" | "tight";
type WorkboardDensity = "comfortable" | "compact";
type VisitWorkboardViewMode = "board" | "queue";

type WorkboardFeedback =
  | {
      message: string;
      tone: "danger" | "success";
    }
  | null;

type VisitsWorkboardProps = {
  canEditRecords: boolean;
  children?: ReactNode;
  filters: VisitsFilterState;
  focusMode?: boolean;
  initialEstimates: Estimate[];
  initialInvoices: Invoice[];
  initialVisitCommunications: Array<{
    communicationType: string;
    createdAt: string;
    jobId: string;
  }>;
  initialJobs: JobListItem[];
  technicians: AssignableTechnicianOption[];
  timeZone: string;
};

const visitBoardColumns: VisitBoardColumn[] = [
  {
    description: "Missing intake, estimate, or timing details.",
    label: "Intake",
    state: "intake"
  },
  {
    description: "Promised work without a technician owner.",
    label: "Needs assignment",
    state: "needs_assignment"
  },
  {
    description: "Owned work waiting for an arrival promise.",
    label: "Ready to schedule",
    state: "ready_to_schedule"
  },
  {
    description: "Staged work that should move into dispatch next.",
    label: "Ready for dispatch",
    state: "ready_to_dispatch"
  },
  {
    description: "Traveling or on-site visits happening now.",
    label: "Live",
    state: "live"
  },
  {
    description: "Closed work ready for invoice release and follow-up.",
    label: "Billing",
    state: "completed"
  }
];

function buildVisitsHref(current: VisitsFilterState, patch: Partial<VisitsFilterState>) {
  const params = new URLSearchParams();
  const nextState = { ...current, ...patch };

  for (const [key, value] of Object.entries(nextState)) {
    if (value) {
      params.set(key, value);
    }
  }

  const search = params.toString();

  return search ? `/dashboard/visits?${search}` : "/dashboard/visits";
}

function buildDispatchHref(visit: JobListItem, timeZone: string, focusMode: boolean) {
  const dateValue = visit.scheduledStartAt ?? new Date().toISOString();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));

  const params = new URLSearchParams({
    date: localDate,
    jobId: visit.id,
    view: "day"
  });

  if (focusMode) {
    params.set("focus", "1");
  }

  return `/dashboard/dispatch?${params.toString()}`;
}

function buildPrimaryVisitHref(
  visit: JobListItem,
  primaryAction: ReturnType<typeof getVisitPrimaryAction>,
  filters: VisitsFilterState,
  timeZone: string
) {
  if (primaryAction.intent === "dispatch") {
    return buildDispatchHref(visit, timeZone, filters.focus === "1");
  }

  return buildVisitsHref(filters, { jobId: visit.id });
}

function buildEstimateActionHref(jobId: string, estimate: Estimate | null, returnScope: string) {
  if (!estimate) {
    return buildVisitEstimateHref(jobId, { autostart: true, returnScope, workspace: true });
  }

  if (estimate.status === "draft") {
    return buildVisitEstimateHref(jobId, { returnScope, workspace: true });
  }

  return buildVisitEstimateHref(jobId, { returnScope });
}

function buildInvoiceActionHref(jobId: string, returnScope: string) {
  return buildVisitInvoiceHref(jobId, { returnScope });
}

function getPrimaryActionLabel(primaryAction: ReturnType<typeof getVisitPrimaryAction>) {
  return primaryAction.intent === "dispatch" ? primaryAction.label : "Open thread";
}

function getThreadPrimaryAction(input: {
  filters: VisitsFilterState;
  isSelected: boolean;
  primaryAction: ReturnType<typeof getVisitPrimaryAction>;
  timeZone: string;
  visit: JobListItem;
}) {
  if (input.primaryAction.intent === "dispatch") {
    return {
      href: buildPrimaryVisitHref(input.visit, input.primaryAction, input.filters, input.timeZone),
      label: input.primaryAction.label
    };
  }

  return {
    href: buildVisitsHref(input.filters, { jobId: input.isSelected ? "" : input.visit.id }),
    label: input.isSelected ? "Close thread" : input.primaryAction.label
  };
}

function getEstimateActionLabel(estimate: Estimate | null, canEditRecords: boolean) {
  if (!estimate) {
    return canEditRecords ? "Create estimate" : null;
  }

  if (estimate.status === "draft") {
    return canEditRecords ? "Edit estimate" : "Open estimate";
  }

  return "Open estimate";
}

function getEstimateActionTone(estimate: Estimate | null) {
  return !estimate || estimate.status === "draft" ? "secondary" : "tertiary";
}

function getEstimateStatusSummary(estimate: Estimate | null, canEditRecords: boolean) {
  if (!estimate) {
    return canEditRecords ? "Estimate not started" : "Estimate not shared";
  }

  switch (estimate.status) {
    case "draft":
      return `${estimate.estimateNumber} in draft`;
    case "sent":
      return `${estimate.estimateNumber} out for approval`;
    case "accepted":
      return `${estimate.estimateNumber} approved`;
    case "declined":
      return `${estimate.estimateNumber} declined`;
    case "void":
      return `${estimate.estimateNumber} voided`;
    default:
      return estimate.estimateNumber;
  }
}

function getPriorityRank(priority: JobListItem["priority"]) {
  switch (priority) {
    case "urgent":
      return 3;
    case "high":
      return 2;
    case "normal":
      return 1;
    default:
      return 0;
  }
}

function getScheduleTimestamp(visit: JobListItem) {
  const value = visit.arrivalWindowStartAt ?? visit.scheduledStartAt;

  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getScheduleUrgency(visit: JobListItem, workflowState: VisitWorkflowState) {
  if (workflowState === "completed") {
    return null;
  }

  const timestamp = getScheduleTimestamp(visit);

  if (!timestamp) {
    if (workflowState === "ready_to_schedule") {
      return {
        label: "Needs slot",
        rank: 2,
        tone: "warning" as const
      };
    }

    return null;
  }

  const diff = timestamp - Date.now();

  if (diff <= -30 * 60 * 1000) {
    return {
      label: "Past due",
      rank: 4,
      tone: "danger" as const
    };
  }

  if (diff <= 2 * 60 * 60 * 1000) {
    return {
      label: "Due soon",
      rank: 3,
      tone: "warning" as const
    };
  }

  if (diff <= 24 * 60 * 60 * 1000) {
    return {
      label: "Today",
      rank: 1,
      tone: "brand" as const
    };
  }

  return null;
}

function getOperationalUrgency(
  visit: JobListItem,
  workflowState: VisitWorkflowState,
  estimate: Estimate | null,
  invoice: Invoice | null,
  latestCommunication:
    | {
        communicationType: string;
        createdAt: string;
        jobId: string;
      }
    | null
) {
  if (workflowState === "completed") {
    const billingState = getBillingState(invoice);

    if (billingState === "needs_invoice") {
      return {
        label: "Invoice now",
        rank: 6,
        tone: "warning" as const
      };
    }

    if (billingState === "invoice_draft") {
      return {
        label: "Draft billing",
        rank: 5,
        tone: "warning" as const
      };
    }

    if (billingState === "payment_due") {
      return {
        label: "Collect",
        rank: 4,
        tone: "brand" as const
      };
    }

    return null;
  }

  const promiseSummary = getVisitPromiseSummary({ job: visit });
  const trustSummary = getVisitTrustSummary({
    communications: latestCommunication
      ? [
          {
            communicationType: latestCommunication.communicationType,
            createdAt: latestCommunication.createdAt
          }
        ]
      : [],
    followUpActive: isFollowUpVisit(visit),
    invoice: invoice
      ? {
          balanceDueCents: invoice.balanceDueCents,
          status: invoice.status
        }
      : null,
    job: visit
  });

  if (promiseSummary.tone === "danger") {
    return {
      label: promiseSummary.label,
      rank: 9,
      tone: "danger" as const
    };
  }

  if (
    isStaleFollowUpVisit({
      arrivalWindowStartAt: visit.arrivalWindowStartAt,
      scheduledStartAt: visit.scheduledStartAt,
      status: visit.status,
      title: visit.title
    })
  ) {
    return {
      label: "Stale return",
      rank: 8,
      tone: "danger" as const
    };
  }

  if (isVisitReadinessRisk({ estimate, job: visit })) {
    return {
      label: "Readiness risk",
      rank: 7,
      tone: "warning" as const
    };
  }

  if (trustSummary.risk === "high") {
    return {
      label: trustSummary.label,
      rank: 6.5,
      tone: "danger" as const
    };
  }

  if (estimate?.status === "sent") {
    return {
      label: "Awaiting approval",
      rank: 6,
      tone: "warning" as const
    };
  }

  if (promiseSummary.tone === "warning") {
    return {
      label: promiseSummary.label,
      rank: 5,
      tone: "warning" as const
    };
  }

  if (trustSummary.risk === "watch") {
    const trustTone: "brand" | "warning" =
      trustSummary.tone === "brand" ? "brand" : "warning";

    return {
      label: trustSummary.label,
      rank: 4.5,
      tone: trustTone
    };
  }

  if (isFollowUpVisit(visit)) {
    return {
      label: "Return work",
      rank: 3,
      tone: "brand" as const
    };
  }

  return getScheduleUrgency(visit, workflowState);
}

function compareVisitsForColumn(
  columnState: VisitWorkflowState,
  left: JobListItem,
  right: JobListItem,
  estimatesByJobId: Map<string, Estimate>,
  invoicesByJobId: Map<string, Invoice>,
  latestCommunicationsByJobId: Map<
    string,
    {
      communicationType: string;
      createdAt: string;
      jobId: string;
    }
  >
) {
  if (columnState === "completed") {
    const leftInvoice = invoicesByJobId.get(left.id) ?? null;
    const rightInvoice = invoicesByJobId.get(right.id) ?? null;
    const billingDelta =
      getBillingSortRank(getBillingState(leftInvoice)) - getBillingSortRank(getBillingState(rightInvoice));

    if (billingDelta !== 0) {
      return billingDelta;
    }

    const balanceDelta = (rightInvoice?.balanceDueCents ?? 0) - (leftInvoice?.balanceDueCents ?? 0);

    if (balanceDelta !== 0) {
      return balanceDelta;
    }

    const leftClosedAt = getScheduleTimestamp(left) ?? 0;
    const rightClosedAt = getScheduleTimestamp(right) ?? 0;

    if (rightClosedAt !== leftClosedAt) {
      return rightClosedAt - leftClosedAt;
    }

    return left.title.localeCompare(right.title);
  }

  const urgencyDelta =
    (getOperationalUrgency(
      right,
      columnState,
      estimatesByJobId.get(right.id) ?? null,
      invoicesByJobId.get(right.id) ?? null,
      latestCommunicationsByJobId.get(right.id) ?? null
    )?.rank ?? 0) -
    (getOperationalUrgency(
      left,
      columnState,
      estimatesByJobId.get(left.id) ?? null,
      invoicesByJobId.get(left.id) ?? null,
      latestCommunicationsByJobId.get(left.id) ?? null
    )?.rank ?? 0);

  if (urgencyDelta !== 0) {
    return urgencyDelta;
  }

  const priorityDelta = getPriorityRank(right.priority) - getPriorityRank(left.priority);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftTime = getScheduleTimestamp(left);
  const rightTime = getScheduleTimestamp(right);

  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (leftTime !== null && rightTime === null) {
    return -1;
  }

  if (leftTime === null && rightTime !== null) {
    return 1;
  }

  return left.title.localeCompare(right.title);
}

function getWorkflowColumnMeta(state: VisitWorkflowState) {
  if (state === "intake") {
    return "Clear blockers";
  }

  if (state === "needs_assignment") {
    return "Claim an owner";
  }

  if (state === "ready_to_schedule") {
    return "Set the promise";
  }

  if (state === "ready_to_dispatch") {
    return "Stage the route";
  }

  if (state === "live") {
    return "Track the field";
  }

  if (state === "completed") {
    return "Invoice and follow up";
  }

  return "Move to the next step";
}

function getVisitCardDensity(
  state: VisitWorkflowState,
  columnCount: number,
  densityMode: WorkboardDensity
): VisitCardDensity {
  const baseDensity =
    state === "live" || state === "completed"
      ? columnCount >= 3
        ? "tight"
        : "dense"
      : columnCount >= 6
        ? "tight"
        : columnCount >= 3
          ? "dense"
          : "default";

  if (densityMode !== "compact") {
    return baseDensity;
  }

  if (baseDensity === "default") {
    return "dense";
  }

  return "tight";
}

function getWorkflowColumnSummary(
  state: VisitWorkflowState,
  visits: JobListItem[],
  invoicesByJobId?: Map<string, Invoice>
) {
  const urgentCount = visits.filter((visit) => visit.priority === "urgent" || visit.priority === "high").length;
  const assignedCount = visits.filter((visit) => Boolean(visit.assignedTechnicianName)).length;
  const scheduledCount = visits.filter((visit) => Boolean(visit.scheduledStartAt || visit.arrivalWindowStartAt)).length;
  const liveCount = visits.filter((visit) => isTechnicianActiveFieldJobStatus(visit.status)).length;

  switch (state) {
    case "intake":
      return {
        actionLabel: "Clear blockers",
        metricLabel: "Urgent",
        metricValue: urgentCount,
        support:
          urgentCount > 0
            ? `${urgentCount} visits still need intake cleanup first.`
            : "Move raw requests into schedulable work."
      };
    case "needs_assignment":
      return {
        actionLabel: "Assign technicians",
        metricLabel: "Unassigned",
        metricValue: Math.max(visits.length - assignedCount, 0),
        support:
          assignedCount < visits.length
            ? `${visits.length - assignedCount} visits still need a technician owner.`
            : "Everything here is owned and ready to advance."
      };
    case "ready_to_schedule":
      return {
        actionLabel: "Set arrival targets",
        metricLabel: "Scheduled",
        metricValue: scheduledCount,
        support:
          scheduledCount > 0
            ? `${scheduledCount} visits already have a slot target.`
            : "Set a time promise before the route board."
      };
    case "ready_to_dispatch":
      return {
        actionLabel: "Push to dispatch",
        metricLabel: "Assigned",
        metricValue: assignedCount,
        support:
          assignedCount > 0
            ? `${assignedCount} visits are staged and ready for lane placement.`
            : "Stage work with a technician before dispatch."
      };
    case "live":
      return {
        actionLabel: "Track field work",
        metricLabel: "Live now",
        metricValue: liveCount,
        support:
          liveCount > 0
            ? `${liveCount} visits are moving in the field now.`
            : "Use this lane to monitor travel and on-site work."
      };
    case "completed":
      const openBillingCount = visits.filter((visit) => {
        const billingState = getBillingState(invoicesByJobId?.get(visit.id) ?? null);
        return billingState !== "closed_paid" && billingState !== "voided";
      }).length;

      return {
        actionLabel: "Open billing queue",
        metricLabel: "Open billing",
        metricValue: openBillingCount,
        support:
          openBillingCount > 0
            ? `${openBillingCount} closed visits still need invoice or payment follow-through.`
            : "Financial follow-through is clear."
      };
  }
}

function buildPhoneHref(phone: string, scheme: "sms" | "tel") {
  return `${scheme}:${phone}`;
}

function getWorkflowDropGuidance(
  visit: JobListItem,
  targetState: VisitWorkflowState,
  assessment: ReturnType<typeof assessVisitWorkflowMove>
) {
  if (!assessment.allowed) {
    return assessment.message;
  }

  switch (targetState) {
    case "intake":
      return "Drop here to strip the slot and hand the visit back to intake cleanup.";
    case "needs_assignment":
      return "Drop here to keep the promised slot and remove the technician owner.";
    case "ready_to_schedule":
      return "Drop here to keep the technician and pull the time promise back out.";
    case "ready_to_dispatch":
      return isTechnicianTravelJobStatus(visit.status)
        ? "Drop here to pull this visit out of Live and stage it back for dispatch."
        : "Drop here to stage the visit for dispatch placement.";
    case "live":
      return "Drop here to push the visit into the active field queue.";
    case "completed":
      return "Drop here to close field work and push the visit into invoice follow-up.";
    default:
      return "Drop here to move the visit.";
  }
}

function applyVisitMovePlan(visit: JobListItem, assessment: ReturnType<typeof assessVisitWorkflowMove>): JobListItem {
  if (!assessment.allowed) {
    return visit;
  }

  const nextStatus = assessment.plan.toStatus ?? visit.status;
  const nextScheduledStartAt = assessment.plan.clearSchedule ? null : visit.scheduledStartAt;
  const nextArrivalWindowStartAt = assessment.plan.clearSchedule ? null : visit.arrivalWindowStartAt;

  return {
    ...visit,
    assignedTechnicianName:
      assessment.plan.assignedTechnicianUserId === null ? null : visit.assignedTechnicianName,
    assignedTechnicianUserId:
      assessment.plan.assignedTechnicianUserId === undefined
        ? visit.assignedTechnicianUserId
        : assessment.plan.assignedTechnicianUserId,
    arrivalWindowStartAt: nextArrivalWindowStartAt,
    scheduledStartAt: nextScheduledStartAt,
    status: nextStatus
  };
}

function shouldHideMovedVisit(visit: JobListItem, filters: VisitsFilterState) {
  if (filters.workflowState && getVisitWorkflowState(visit) !== filters.workflowState) {
    return true;
  }

  if (filters.status && visit.status !== filters.status) {
    return true;
  }

  if (filters.assignedTechnicianUserId && !visit.assignedTechnicianUserId) {
    return true;
  }

  return false;
}

export function VisitsWorkboard({
  canEditRecords,
  children,
  filters,
  focusMode = false,
  initialEstimates,
  initialInvoices,
  initialVisitCommunications,
  initialJobs,
  technicians,
  timeZone
}: VisitsWorkboardProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null);
  const [dropTargetState, setDropTargetState] = useState<VisitWorkflowState | null>(null);
  const [pendingVisitIds, setPendingVisitIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<WorkboardFeedback>(null);
  const [activeNoteVisitId, setActiveNoteVisitId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<VisitWorkboardViewMode>("queue");
  const [densityMode, setDensityMode] = useState<WorkboardDensity>("compact");
  const [showEmptyLanes, setShowEmptyLanes] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNoteVisitId, setSavingNoteVisitId] = useState<string | null>(null);
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkTechnicianUserId, setBulkTechnicianUserId] = useState("");
  const [bulkPromiseAt, setBulkPromiseAt] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const estimatesByJobId = new Map(initialEstimates.map((estimate) => [estimate.jobId, estimate]));
  const invoicesByJobId = new Map(initialInvoices.map((invoice) => [invoice.jobId, invoice]));
  const latestCommunicationsByJobId = new Map(
    initialVisitCommunications.map((entry) => [entry.jobId, entry])
  );

  useEffect(() => {
    setJobs(initialJobs);
    setSelectedVisitIds([]);
    setSelectionMode(false);
  }, [initialJobs]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      setViewMode("queue");
    }
  }, []);

  function refreshBoard() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function toggleVisitSelection(jobId: string) {
    setSelectionMode(true);
    setSelectedVisitIds((current) =>
      current.includes(jobId) ? current.filter((value) => value !== jobId) : [...current, jobId]
    );
  }

  async function runBulkAction(input:
    | {
        action: "bulk_assign";
        assignedTechnicianUserId: string | null;
      }
    | {
        action: "bulk_set_promise";
        scheduledStartAt: string;
      }
    | {
        action: "bulk_customer_update";
        updateAction: "appointment_confirmation" | "dispatch_update";
        updateType?: "dispatched" | "en_route";
      }
    | {
        action: "bulk_estimate_follow_up";
      }
    | {
        action: "bulk_mark_completed";
      }) {
    if (!selectedVisitIds.length) {
      setFeedback({ message: "Select at least one visit first.", tone: "danger" });
      return;
    }

    setBulkAction(input.action);
    setPendingVisitIds(selectedVisitIds);
    setFeedback(null);

    try {
      const response = await fetch("/api/internal/visits/workboard", {
        body: JSON.stringify({
          ...input,
          jobIds: selectedVisitIds
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; processedCount?: number; skippedCount?: number }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Bulk action could not be completed.");
      }

      const processedCount = payload?.processedCount ?? 0;
      const skippedCount = payload?.skippedCount ?? 0;
      setFeedback({
        message:
          skippedCount > 0
            ? `${processedCount} visit${processedCount === 1 ? "" : "s"} updated, ${skippedCount} skipped.`
            : `${processedCount} visit${processedCount === 1 ? "" : "s"} updated.`,
        tone: "success"
      });
      setSelectedVisitIds([]);
      refreshBoard();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Bulk action could not be completed.",
        tone: "danger"
      });
    } finally {
      setBulkAction(null);
      setPendingVisitIds([]);
    }
  }

  async function moveVisit(jobId: string, targetState: VisitWorkflowState) {
    const currentVisit = jobs.find((candidate) => candidate.id === jobId);

    if (!currentVisit) {
      return;
    }

    const assessment = assessVisitWorkflowMove(currentVisit, targetState);

    if (!assessment.allowed) {
      setFeedback({ message: assessment.message, tone: "danger" });
      return;
    }

    const previousVisits = jobs;
    const nextVisit = applyVisitMovePlan(currentVisit, assessment);

    setFeedback(null);
    setPendingVisitIds((current) => [...current, jobId]);
    setJobs((current) => {
      const nextItems = current.map((visit) => (visit.id === jobId ? nextVisit : visit));

      return shouldHideMovedVisit(nextVisit, filters)
        ? nextItems.filter((visit) => visit.id !== jobId)
        : nextItems;
    });

    try {
      const response = await fetch("/api/internal/visits/workboard", {
        body: JSON.stringify({
          action: "move",
          jobId,
          targetState
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Visit move could not be completed.");
      }

      setFeedback({
        message: `${currentVisit.title} moved to ${visitBoardColumns.find((column) => column.state === targetState)?.label ?? "the next lane"}.`,
        tone: "success"
      });
      refreshBoard();
    } catch (error) {
      setJobs(previousVisits);
      setFeedback({
        message: error instanceof Error ? error.message : "Visit move could not be completed.",
        tone: "danger"
      });
    } finally {
      setPendingVisitIds((current) => current.filter((candidate) => candidate !== jobId));
      setDraggedVisitId(null);
      setDropTargetState(null);
    }
  }

  async function submitQuickNote(visit: JobListItem) {
    const trimmedBody = noteBody.trim();

    if (!trimmedBody) {
      setFeedback({ message: "Enter a note before saving.", tone: "danger" });
      return;
    }

    setSavingNoteVisitId(visit.id);
    setFeedback(null);

    try {
      const response = await fetch("/api/internal/visits/workboard", {
        body: JSON.stringify({
          action: "note",
          body: trimmedBody,
          isInternal: true,
          jobId: visit.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Note could not be saved.");
      }

      setActiveNoteVisitId(null);
      setNoteBody("");
      setFeedback({
        message: `Internal note saved on ${visit.title}.`,
        tone: "success"
      });
      refreshBoard();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Note could not be saved.",
        tone: "danger"
      });
    } finally {
      setSavingNoteVisitId(null);
    }
  }

  const boardColumns = visitBoardColumns.map((column) => ({
    ...column,
    jobs: jobs
      .filter((visit) => getVisitWorkflowState(visit) === column.state)
      .sort((left, right) =>
        compareVisitsForColumn(
          column.state,
          left,
          right,
          estimatesByJobId,
          invoicesByJobId,
          latestCommunicationsByJobId
        )
      )
  }));
  const visibleColumns = showEmptyLanes
    ? boardColumns
    : boardColumns.filter((column) => column.jobs.length > 0);
  const hiddenLaneCount = boardColumns.length - visibleColumns.length;
  const threadOpen = Boolean(filters.jobId);
  const isHighVolume =
    jobs.length >= 18 || visibleColumns.some((column) => column.jobs.length >= 5);
  const selectedVisits = jobs.filter((visit) => selectedVisitIds.includes(visit.id));
  const selectedVisitCount = selectedVisits.length;
  const draggedVisit = draggedVisitId ? jobs.find((visit) => visit.id === draggedVisitId) ?? null : null;
  const activeDropAssessment =
    draggedVisit && dropTargetState ? assessVisitWorkflowMove(draggedVisit, dropTargetState) : null;
  const boardMeta =
    viewMode === "board"
      ? hiddenLaneCount > 0 && !showEmptyLanes
        ? `${visibleColumns.length} active lanes · ${hiddenLaneCount} tucked away`
        : `${visibleColumns.length} active lanes`
      : `${jobs.length} visits in view${isHighVolume ? " · rail carries overflow actions" : ""}`;
  const showInlineViewControls = !focusMode && !threadOpen;
  const renderQueueRow = (visit: JobListItem) => {
    const workflowState = getVisitWorkflowState(visit);
    const primaryAction = getVisitPrimaryAction(visit);
    const estimate = estimatesByJobId.get(visit.id) ?? null;
    const invoice = invoicesByJobId.get(visit.id) ?? null;
    const billingState = getBillingState(invoice);
    const latestCommunication = latestCommunicationsByJobId.get(visit.id) ?? null;
    const communicationEntries = latestCommunication
      ? [
          {
            communicationType: latestCommunication.communicationType,
            createdAt: latestCommunication.createdAt
          }
        ]
      : [];
    const promiseSummary = getVisitPromiseSummary({
      communications: communicationEntries,
      job: visit
    });
    const trustSummary = getVisitTrustSummary({
      communications: communicationEntries,
      followUpActive: isFollowUpVisit(visit),
      invoice: invoice
        ? {
            balanceDueCents: invoice.balanceDueCents,
            status: invoice.status
          }
        : null,
      job: visit
    });
    const urgency = getOperationalUrgency(
      visit,
      workflowState,
      estimate,
      invoice,
      latestCommunication
    );
    const isSelected = visit.id === filters.jobId;
    const primaryThreadAction = getThreadPrimaryAction({
      filters,
      isSelected,
      primaryAction,
      timeZone,
      visit
    });
    const scheduleTarget = formatDateTime(visit.arrivalWindowStartAt ?? visit.scheduledStartAt, {
      fallback: "No schedule target",
      timeZone
    });
    const commercialValue =
      workflowState === "completed"
        ? invoice
          ? invoice.balanceDueCents > 0
            ? `${formatCurrencyFromCents(invoice.balanceDueCents)} due`
            : getBillingStateLabel(billingState)
          : estimate
            ? formatCurrencyFromCents(estimate.totalCents)
            : getBillingStateLabel(billingState)
        : estimate
          ? formatCurrencyFromCents(estimate.totalCents)
          : "Estimate not started";
    const commercialCopy =
      workflowState === "completed"
        ? getBillingNote(billingState, estimate)
        : estimate
          ? getEstimateStatusSummary(estimate, canEditRecords)
          : "Start pricing before release.";
    const isBulkSelected = selectedVisitIds.includes(visit.id);
    const rowTimingCopy =
      workflowState === "completed"
        ? "Closed visit"
        : [promiseSummary.nextUpdateLabel, urgency ? urgency.label : trustSummary.nextActionLabel]
            .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
            .join(" · ");
    const rowCommercialCopy =
      workflowState === "completed"
        ? commercialCopy
        : [commercialCopy, trustSummary.label]
            .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
            .join(" · ");
    const rowSignals = [
      workflowState === "completed" ? (
        <Badge key={`${visit.id}:billing`} tone={getBillingStateTone(billingState)}>
          {getBillingStateLabel(billingState)}
        </Badge>
      ) : workflowState === "ready_to_dispatch" ||
          workflowState === "needs_assignment" ||
          workflowState === "ready_to_schedule" ? (
        <Badge key={`${visit.id}:workflow`} tone={getVisitWorkflowTone(workflowState)}>
          {getVisitWorkflowLabel(workflowState)}
        </Badge>
      ) : null,
      urgency ? (
        <Badge key={`${visit.id}:urgency`} tone={urgency.tone}>
          {urgency.label}
        </Badge>
      ) : isFollowUpVisit(visit) ? (
        <Badge key={`${visit.id}:follow-up`} tone="warning">
          Return visit
        </Badge>
      ) : workflowState !== "completed" ? (
        <Badge key={`${visit.id}:promise`} tone={promiseSummary.tone}>
          {promiseSummary.confidenceLabel}
        </Badge>
      ) : visit.priority === "high" || visit.priority === "urgent" ? (
        <PriorityBadge key={`${visit.id}:priority`} value={visit.priority} />
      ) : null
    ]
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 1);
    const ownerSummary =
      workflowState === "completed"
        ? visit.assignedTechnicianName ?? "Closed without owner"
        : visit.assignedTechnicianName ?? "Unassigned";
    const timingSummary =
      workflowState === "completed"
        ? scheduleTarget
        : [scheduleTarget, rowTimingCopy]
            .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
            .join(" · ");

    return (
      <article
        className={cx(
          "job-flow-list__row",
          workflowState === "completed" && "job-flow-list__row--completed",
          workflowState === "completed" && `job-flow-list__row--billing-${billingState}`,
          filters.jobId && !isSelected && "job-flow-list__row--dimmed",
          isSelected && "job-flow-list__row--selected"
        )}
        key={visit.id}
      >
        <div className="job-flow-list__cell job-flow-list__cell--identity">
          <span className="job-flow-list__cell-label">Visit</span>
          <div className="job-flow-list__identity">
            {canEditRecords && (selectionMode || isBulkSelected) ? (
              <label className="ui-checkbox-row">
                <input
                  checked={isBulkSelected}
                  onChange={() => toggleVisitSelection(visit.id)}
                  type="checkbox"
                />
                <span>Select</span>
              </label>
            ) : null}
            <p className="job-flow-list__title">{visit.title}</p>
            <p className="job-flow-list__meta">
              {visit.customerDisplayName} · {visit.vehicleDisplayName}
            </p>
            {rowSignals.length ? <div className="job-flow-list__signals">{rowSignals}</div> : null}
          </div>
        </div>

        <div className="job-flow-list__cell job-flow-list__cell--timing">
          <span className="job-flow-list__cell-label">Timing</span>
          <strong>{ownerSummary}</strong>
          <span className="job-flow-list__cell-copy">{timingSummary}</span>
        </div>

        <div className="job-flow-list__cell job-flow-list__cell--commercial">
          <span className="job-flow-list__cell-label">
            {workflowState === "completed" ? "Closeout" : "Release"}
          </span>
          <strong>{commercialValue}</strong>
          <span className="job-flow-list__cell-copy">{rowCommercialCopy}</span>
        </div>

        <div className="job-flow-list__actions">
          <Link
            className={buttonClassName({
              size: "sm",
              tone: primaryAction.intent === "dispatch" ? "primary" : "secondary"
            })}
            href={primaryThreadAction.href}
            scroll={false}
          >
            {primaryThreadAction.label}
          </Link>
          {isSelected ? (
            <Link
              className={buttonClassName({ size: "sm", tone: "ghost" })}
              href={buildVisitsHref(filters, { jobId: "" })}
              scroll={false}
            >
              Close thread
            </Link>
          ) : null}
        </div>
      </article>
    );
  };

  const renderVisitCard = (visit: JobListItem, columnState: VisitWorkflowState, columnCount: number) => {
    const workflowState = getVisitWorkflowState(visit);
    const density = getVisitCardDensity(columnState, columnCount, densityMode);
    const primaryAction = getVisitPrimaryAction(visit);
    const estimate = estimatesByJobId.get(visit.id) ?? null;
    const invoice = invoicesByJobId.get(visit.id) ?? null;
    const billingState = getBillingState(invoice);
    const latestCommunication = latestCommunicationsByJobId.get(visit.id) ?? null;
    const communicationEntries = latestCommunication
      ? [
          {
            communicationType: latestCommunication.communicationType,
            createdAt: latestCommunication.createdAt
          }
        ]
      : [];
    const promiseSummary = getVisitPromiseSummary({
      communications: communicationEntries,
      job: visit
    });
    const urgency = getOperationalUrgency(
      visit,
      workflowState,
      estimate,
      invoice,
      latestCommunication
    );
    const estimateActionLabel = getEstimateActionLabel(estimate, canEditRecords);
    const isSelected = visit.id === filters.jobId;
    const scheduleTarget = formatDateTime(visit.arrivalWindowStartAt ?? visit.scheduledStartAt, {
      fallback: "No schedule target",
      timeZone
    });
    const primaryThreadAction = getThreadPrimaryAction({
      filters,
      isSelected,
      primaryAction,
      timeZone,
      visit
    });
    const isPending = pendingVisitIds.includes(visit.id);
    const isBulkSelected = selectedVisitIds.includes(visit.id);
    const canMessage = Boolean(visit.customerPhone);
    const canDrag = canEditRecords && !isPending && workflowState !== "completed";
    const showUtilityActions =
      isSelected ||
      (!focusMode &&
        densityMode === "comfortable" &&
        !isHighVolume &&
        workflowState === "live");
    const scheduleLabel =
      workflowState === "live"
        ? "Active slot"
        : workflowState === "completed"
          ? "Closed slot"
          : density === "default"
            ? "Schedule target"
            : "Schedule";
    const secondaryActionLabel =
      workflowState === "completed"
        ? getBillingActionLabel(billingState, canEditRecords)
        : estimateActionLabel;
    const secondaryActionHref =
      workflowState === "completed"
        ? buildInvoiceActionHref(visit.id, filters.scope)
        : estimateActionLabel
          ? buildEstimateActionHref(visit.id, estimate, filters.scope)
          : null;
    const secondaryActionTone =
      workflowState === "completed"
        ? billingState === "payment_due"
          ? "secondary"
          : "tertiary"
        : getEstimateActionTone(estimate);
    const showCardSecondaryNote = workflowState === "completed" || isSelected;
    const showSecondaryAction =
      Boolean(secondaryActionLabel && secondaryActionHref) &&
      (isSelected ||
        workflowState === "completed" ||
        (!focusMode &&
          densityMode === "comfortable" &&
          !isHighVolume &&
          workflowState === "ready_to_dispatch"));
    const cardSummary =
      workflowState === "completed"
        ? getBillingNote(billingState, estimate)
        : getVisitNextMove(visit);
    const cardSecondaryNote =
      workflowState === "completed"
        ? getBillingStateLabel(billingState)
        : `${promiseSummary.confidenceLabel} · ${promiseSummary.nextUpdateLabel}`;
    const liveEstimateFact = {
      label: "Estimate",
      value: estimate ? formatCurrencyFromCents(estimate.totalCents) : "Not started"
    };
    const cardFacts =
      workflowState === "completed"
        ? [
            {
              label: "Tech",
              value: visit.assignedTechnicianName ?? "Unassigned"
            },
            {
              label: "Closed",
              value: scheduleTarget
            },
            {
              label: billingState === "payment_due" ? "Balance" : "Amount",
              value: invoice
                ? invoice.balanceDueCents > 0
                  ? formatCurrencyFromCents(invoice.balanceDueCents)
                  : "Paid"
                : estimate
                  ? formatCurrencyFromCents(estimate.totalCents)
                  : "Pending"
            }
          ]
        : density === "tight"
          ? [
              {
                label: "Tech",
                value: visit.assignedTechnicianName ?? "Unassigned"
              },
              ...(isSelected
                ? [
                    {
                      label: "Slot",
                      value: scheduleTarget
                    }
                  ]
                : [])
            ]
          : density === "dense"
            ? [
                {
                  label: "Tech",
                  value: visit.assignedTechnicianName ?? "Unassigned"
                },
                {
                  label: "Slot",
                  value: scheduleTarget
                },
                ...(isSelected || workflowState === "ready_to_dispatch" ? [liveEstimateFact] : [])
              ]
            : [
                {
                  label: "Tech",
                  value: visit.assignedTechnicianName ?? "Unassigned"
                },
                {
                  label: "Slot",
                  value: scheduleTarget
                },
                ...(isSelected || workflowState === "ready_to_dispatch" ? [liveEstimateFact] : [])
              ];

    const cardSignals = [
      urgency ? (
        <Badge key={`${visit.id}:urgency`} tone={urgency.tone}>
          {urgency.label}
        </Badge>
      ) : visit.priority === "high" || visit.priority === "urgent" ? (
        <PriorityBadge key={`${visit.id}:priority`} value={visit.priority} />
      ) : null,
      workflowState === "completed" ? (
        <Badge key={`${visit.id}:billing`} tone={getBillingStateTone(billingState)}>
          {getBillingStateLabel(billingState)}
        </Badge>
      ) : estimate && density !== "tight" ? (
        <StatusBadge key={`${visit.id}:estimate`} status={estimate.status} />
      ) : (
        <StatusBadge key={`${visit.id}:visit-status`} status={visit.status} />
      )
    ]
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 2);
    const showCardOverflow = Boolean((showSecondaryAction && secondaryActionLabel && secondaryActionHref) || showUtilityActions);

    return (
      <article
        className={cx(
          "job-flow-card",
          density === "dense" && "job-flow-card--dense",
          density === "tight" && "job-flow-card--tight",
          filters.jobId && !isSelected && "job-flow-card--dimmed",
          isSelected && "job-flow-card--selected",
          workflowState === "completed" && "job-flow-card--completed",
          `job-flow-card--billing-${billingState}`,
          canDrag && "job-flow-card--draggable",
          draggedVisitId === visit.id && "job-flow-card--dragging",
          isPending && "job-flow-card--busy"
        )}
        draggable={canDrag}
        key={visit.id}
        onDragEnd={() => {
          setDraggedVisitId(null);
          setDropTargetState(null);
        }}
        onDragStart={() => {
          setDraggedVisitId(visit.id);
          setFeedback(null);
        }}
      >
        <div className="job-flow-card__header">
          <div className="job-flow-card__identity">
            {canEditRecords && (selectionMode || isBulkSelected) ? (
              <label className="ui-checkbox-row">
                <input
                  checked={isBulkSelected}
                  onChange={() => toggleVisitSelection(visit.id)}
                  type="checkbox"
                />
                <span>Select</span>
              </label>
            ) : null}
            <p className="job-flow-card__eyebrow">{visit.customerDisplayName}</p>
            <Link className="job-flow-card__title" href={buildVisitsHref(filters, { jobId: visit.id })} scroll={false}>
              {visit.title}
            </Link>
            <p className="job-flow-card__meta">{visit.vehicleDisplayName}</p>
          </div>
        </div>

        <div className="job-flow-card__signals">
          {cardSignals}
        </div>

        <div className="job-flow-card__body">
          <p className="job-flow-card__summary">{cardSummary}</p>
          <div className="job-flow-card__facts" aria-label="Visit details">
            {cardFacts.map((detail) => (
              <span className="job-flow-card__fact" key={detail.label}>
                <strong>{detail.value}</strong>
                <span>{detail.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="job-flow-card__footer">
          {showCardSecondaryNote ? <p className="job-flow-card__note">{cardSecondaryNote}</p> : null}
          <div className="job-flow-card__actions">
            <Link
              className={buttonClassName({
                size: "sm",
                tone: primaryAction.intent === "dispatch" ? "primary" : "secondary"
              })}
              href={primaryThreadAction.href}
            >
              {primaryThreadAction.label}
            </Link>
            {showSecondaryAction && secondaryActionLabel && secondaryActionHref ? (
              <Link
                className={buttonClassName({
                  size: "sm",
                  tone: secondaryActionTone
                })}
                href={secondaryActionHref}
                prefetch={workflowState === "completed" ? null : estimate ? null : false}
              >
                {secondaryActionLabel}
              </Link>
            ) : null}
          </div>
        </div>

        {activeNoteVisitId === visit.id ? (
          <form
            className="job-flow-card__quick-note"
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuickNote(visit);
            }}
          >
            <label className="job-flow-card__quick-note-label" htmlFor={`quick-note-${visit.id}`}>
              Quick internal note
            </label>
            <Textarea
              id={`quick-note-${visit.id}`}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Parts blocker, call outcome, or field update"
              rows={3}
              value={noteBody}
            />
            <div className="job-flow-card__quick-note-actions">
              <Button
                disabled={savingNoteVisitId === visit.id || isRefreshing}
                size="sm"
                tone="secondary"
                type="submit"
              >
                {savingNoteVisitId === visit.id ? "Saving..." : "Save note"}
              </Button>
              <Button
                disabled={savingNoteVisitId === visit.id}
                onClick={() => {
                  setActiveNoteVisitId(null);
                  setNoteBody("");
                }}
                size="sm"
                tone="ghost"
                type="button"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </article>
    );
  };

  return (
    <div
      className={cx(
        "job-flow-board-shell",
        filters.jobId && "job-flow-board-shell--inspecting",
        focusMode && "job-flow-board-shell--focus-mode",
        densityMode === "compact" && "job-flow-board-shell--density-compact",
        isHighVolume && "job-flow-board-shell--high-volume"
      )}
    >
      <div className="job-flow-board-shell__toolbar">
        <div className="job-flow-board-shell__toolbar-header">
          <div className="job-flow-board-shell__toolbar-copy">
            <div className="job-flow-board-shell__title-row">
              <h2 className="job-flow-board-shell__title">
                {viewMode === "board" ? "Visit lanes" : "Visit queue"}
              </h2>
              {!focusMode && !threadOpen ? (
                <p className="job-flow-board-shell__meta">
                  {`${boardMeta}${filters.jobId ? " · rail open" : ""}`}
                </p>
              ) : null}
            </div>
          </div>

          <div className="job-flow-board-shell__toolbar-actions">
            {canEditRecords && (selectionMode || selectedVisitCount) ? (
              <Button
                onClick={() => {
                  if (selectionMode || selectedVisitCount) {
                    setSelectedVisitIds([]);
                    setSelectionMode(false);
                    return;
                  }

                  setSelectionMode(true);
                }}
                size="sm"
                tone={selectionMode || selectedVisitCount ? "secondary" : "ghost"}
                type="button"
              >
                {selectionMode || selectedVisitCount ? "Exit bulk" : "Bulk"}
              </Button>
            ) : null}
            <div className="job-flow-board-shell__segmented" aria-label="Workboard view">
              <Button
                onClick={() => setViewMode("board")}
                size="sm"
                tone={viewMode === "board" ? "secondary" : "ghost"}
                type="button"
              >
                Lanes
              </Button>
              <Button
                onClick={() => setViewMode("queue")}
                size="sm"
                tone={viewMode === "queue" ? "secondary" : "ghost"}
                type="button"
              >
                Queue
              </Button>
            </div>

            {!focusMode ? (
              <details className="job-flow-board-shell__view-panel">
                <summary className="job-flow-board-shell__view-panel-summary">View</summary>
                <div className="job-flow-board-shell__view-panel-body">
                  {showInlineViewControls ? (
                    <div className="job-flow-board-shell__segmented" aria-label="Board density">
                      <Button
                        onClick={() => setDensityMode("comfortable")}
                        size="sm"
                        tone={densityMode === "comfortable" ? "secondary" : "ghost"}
                        type="button"
                      >
                        Comfortable
                      </Button>
                      <Button
                        onClick={() => setDensityMode("compact")}
                        size="sm"
                        tone={densityMode === "compact" ? "secondary" : "ghost"}
                        type="button"
                      >
                        Compact
                      </Button>
                    </div>
                  ) : null}
                  {showInlineViewControls && (hiddenLaneCount > 0 || showEmptyLanes) ? (
                    <Button
                      onClick={() => setShowEmptyLanes((current) => !current)}
                      size="sm"
                      tone={showEmptyLanes ? "secondary" : "ghost"}
                      type="button"
                    >
                      {showEmptyLanes ? "Hide empty lanes" : "Show empty lanes"}
                    </Button>
                  ) : null}
                  {canEditRecords && !selectionMode && !selectedVisitCount ? (
                    <Button
                      onClick={() => setSelectionMode(true)}
                      size="sm"
                      tone="ghost"
                      type="button"
                    >
                      Select rows
                    </Button>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        </div>

        {children ? <div className="job-flow-board-shell__scope">{children}</div> : null}
        {canEditRecords && selectedVisitCount ? (
          <div className="job-flow-board-shell__scope">
            <div className="job-flow-board-shell__toolbar-copy">
              <div className="job-flow-board-shell__title-row">
                <h3 className="job-flow-board-shell__title">{selectedVisitCount} selected</h3>
                <p className="job-flow-board-shell__meta">
                  Assign, promise, or close the next move.
                </p>
              </div>
            </div>
            <div className="job-flow-board-shell__toolbar-actions">
              <Button
                onClick={() => setSelectedVisitIds(jobs.map((visit) => visit.id))}
                size="sm"
                tone="ghost"
                type="button"
              >
                Select visible
              </Button>
              {selectedVisitCount ? (
                <Button
                  onClick={() => {
                    setSelectedVisitIds([]);
                    setSelectionMode(false);
                  }}
                  size="sm"
                  tone="ghost"
                  type="button"
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="dispatch-quick-edit__field-row dispatch-quick-edit__field-row--triple">
              <label className="dispatch-quick-edit__field">
                <span>Assign technician</span>
                <Select
                  onChange={(event) => setBulkTechnicianUserId(event.target.value)}
                  value={bulkTechnicianUserId}
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
                <span>Promise time</span>
                <Input
                  onChange={(event) => setBulkPromiseAt(event.target.value)}
                  type="datetime-local"
                  value={bulkPromiseAt}
                />
              </label>
            </div>
            <div className="ui-button-grid">
              <Button
                disabled={bulkAction !== null}
                loading={bulkAction === "bulk_assign"}
                onClick={() =>
                  void runBulkAction({
                    action: "bulk_assign",
                    assignedTechnicianUserId: bulkTechnicianUserId || null
                  })
                }
                size="sm"
                tone="secondary"
                type="button"
              >
                Assign owner
              </Button>
              <Button
                disabled={!bulkPromiseAt || bulkAction !== null}
                loading={bulkAction === "bulk_set_promise"}
                onClick={() =>
                  void runBulkAction({
                    action: "bulk_set_promise",
                    scheduledStartAt: new Date(bulkPromiseAt).toISOString()
                  })
                }
                size="sm"
                tone="secondary"
                type="button"
              >
                Set promise
              </Button>
              <Button
                disabled={bulkAction !== null}
                loading={bulkAction === "bulk_customer_update"}
                onClick={() =>
                  void runBulkAction({
                    action: "bulk_customer_update",
                    updateAction: "appointment_confirmation"
                  })
                }
                size="sm"
                tone="tertiary"
                type="button"
              >
                Confirm visits
              </Button>
              <Button
                disabled={bulkAction !== null}
                loading={bulkAction === "bulk_customer_update"}
                onClick={() =>
                  void runBulkAction({
                    action: "bulk_customer_update",
                    updateAction: "dispatch_update",
                    updateType: "en_route"
                  })
                }
                size="sm"
                tone="tertiary"
                type="button"
              >
                Send updates
              </Button>
            </div>
            <details className="job-flow-board-shell__bulk-overflow">
              <summary className="job-flow-board-shell__bulk-overflow-summary">
                More bulk moves
              </summary>
              <div className="ui-button-grid">
                <Button
                  disabled={bulkAction !== null}
                  loading={bulkAction === "bulk_estimate_follow_up"}
                  onClick={() =>
                    void runBulkAction({
                      action: "bulk_estimate_follow_up"
                    })
                  }
                  size="sm"
                  tone="tertiary"
                  type="button"
                >
                  Follow up estimates
                </Button>
                <Button
                  disabled={bulkAction !== null}
                  loading={bulkAction === "bulk_mark_completed"}
                  onClick={() =>
                    void runBulkAction({
                      action: "bulk_mark_completed"
                    })
                  }
                  size="sm"
                  tone="primary"
                  type="button"
                >
                  Move to billing-ready
                </Button>
              </div>
            </details>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <Callout
          className="job-flow-board-shell__feedback"
          tone={feedback.tone === "danger" ? "danger" : "success"}
          title={feedback.tone === "danger" ? "Board action blocked" : "Board updated"}
        >
          {feedback.message}
        </Callout>
      ) : null}

      {draggedVisit ? (
        <Callout
          className="job-flow-board-shell__feedback"
          tone={activeDropAssessment && !activeDropAssessment.allowed ? "danger" : "default"}
          title={activeDropAssessment ? `Moving ${draggedVisit.title}` : "Drag a visit to another lane"}
        >
          {dropTargetState && activeDropAssessment
            ? `${visitBoardColumns.find((column) => column.state === dropTargetState)?.label ?? "Lane"}: ${getWorkflowDropGuidance(
                draggedVisit,
                dropTargetState,
                activeDropAssessment
              )}`
            : "Drag over a lane to see exactly what will change before you drop."}
        </Callout>
      ) : null}

      {viewMode === "queue" ? (
        <div className="job-flow-list" aria-label="Compact visits queue">
          {visibleColumns.map((column) => {
            const billingGroups =
              column.state === "completed" ? getBillingGroups(column.jobs, invoicesByJobId) : [];

            return (
              <section className="job-flow-list__group" key={column.state}>
                <header className="job-flow-list__group-header">
                  <div>
                    <p className="job-flow-column__eyebrow">{getWorkflowColumnMeta(column.state)}</p>
                    <h3 className="job-flow-list__group-title">{column.label}</h3>
                  </div>
                  <Badge tone={getVisitWorkflowTone(column.state)}>{column.jobs.length}</Badge>
                </header>

                <div className="job-flow-list__rows">
                  {column.state === "completed"
                    ? billingGroups.map((group) => (
                        <section className="job-flow-list__billing-group" key={group.state}>
                          <header className="job-flow-list__billing-group-header">
                            <div>
                              <p className="job-flow-list__billing-group-title">{group.label}</p>
                              <p className="job-flow-list__billing-group-copy">{group.copy}</p>
                            </div>
                            <Badge tone={group.tone}>{group.jobs.length}</Badge>
                          </header>
                          <div className="job-flow-list__rows job-flow-list__rows--grouped">
                            {group.jobs.map((visit) => renderQueueRow(visit))}
                          </div>
                        </section>
                      ))
                    : column.jobs.map((visit) => renderQueueRow(visit))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
      <div
        className={cx(
          "job-flow-board",
          "job-flow-board--compact"
        )}
        aria-label="Visit workflow board"
      >
        {visibleColumns.map((column) => {
          const summary = getWorkflowColumnSummary(column.state, column.jobs, invoicesByJobId);
          const dropAssessment =
            draggedVisit && canEditRecords ? assessVisitWorkflowMove(draggedVisit, column.state) : null;
          const dropCopy =
            draggedVisit && dropAssessment
              ? getWorkflowDropGuidance(draggedVisit, column.state, dropAssessment)
              : null;
          const billingGroups =
            column.state === "completed" ? getBillingGroups(column.jobs, invoicesByJobId) : [];

          return (
            <section
              className={cx(
                "job-flow-column",
                `job-flow-column--${column.state}`,
                column.jobs.length >= 12 && "job-flow-column--overloaded",
                dropTargetState === column.state && "job-flow-column--drop-target",
                draggedVisit &&
                  dropTargetState === column.state &&
                  dropAssessment &&
                  !dropAssessment.allowed &&
                  "job-flow-column--drop-blocked"
              )}
              key={column.state}
              onDragOver={(event) => {
                if (!canEditRecords || !draggedVisit) {
                  return;
                }

                event.preventDefault();
                const assessment = assessVisitWorkflowMove(draggedVisit, column.state);

                setDropTargetState(column.state);
              }}
              onDragLeave={() => {
                if (dropTargetState === column.state) {
                  setDropTargetState(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (!draggedVisitId || !canEditRecords) {
                  return;
                }

                void moveVisit(draggedVisitId, column.state);
              }}
            >
              <header className="job-flow-column__header">
                <div className="job-flow-column__header-top">
                  <div>
                    <p className="job-flow-column__eyebrow">{getWorkflowColumnMeta(column.state)}</p>
                    <h2 className="job-flow-column__title">{column.label}</h2>
                  </div>
                  <Badge tone={getVisitWorkflowTone(column.state)}>{column.jobs.length}</Badge>
                </div>
                <div className="job-flow-column__strip">
                  <div className="job-flow-column__metric">
                    <span>{summary?.metricLabel ?? "Metric"}</span>
                    <strong>{summary?.metricValue ?? 0}</strong>
                  </div>
                  {column.jobs.length >= 12 ? (
                    <p className="job-flow-column__scroll-note">Scroll lane</p>
                  ) : null}
                </div>
              </header>

              {column.jobs.length ? (
                <div className="job-flow-column__stack">
                  {dropCopy && dropTargetState === column.state ? (
                    <div
                      className={cx(
                        "job-flow-column__drop-copy",
                        dropAssessment && !dropAssessment.allowed && "job-flow-column__drop-copy--blocked"
                      )}
                    >
                      {dropCopy}
                    </div>
                  ) : null}
                  {column.state === "completed"
                    ? billingGroups.map((group) => (
                        <section className="job-flow-column__billing-group" key={group.state}>
                          <header className="job-flow-column__billing-group-header">
                            <div>
                              <p className="job-flow-column__billing-group-title">{group.label}</p>
                              <p className="job-flow-column__billing-group-copy">{group.copy}</p>
                            </div>
                            <Badge tone={group.tone}>{group.jobs.length}</Badge>
                          </header>
                          <div className="job-flow-column__billing-group-stack">
                            {group.jobs.map((visit) => renderVisitCard(visit, column.state, column.jobs.length))}
                          </div>
                        </section>
                      ))
                    : column.jobs.map((visit) => renderVisitCard(visit, column.state, column.jobs.length))}
                </div>
              ) : (
                <div className="job-flow-column__empty-wrap">
                  {dropCopy && dropTargetState === column.state ? (
                    <div
                      className={cx(
                        "job-flow-column__drop-copy",
                        dropAssessment && !dropAssessment.allowed && "job-flow-column__drop-copy--blocked"
                      )}
                    >
                      {dropCopy}
                    </div>
                  ) : null}
                  <p className="job-flow-column__empty">No visits in this workflow lane.</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}

export const JobsWorkboard = VisitsWorkboard;
