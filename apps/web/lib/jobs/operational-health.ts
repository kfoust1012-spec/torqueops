import {
  isTechnicianOnSiteJobStatus,
  isTechnicianTravelJobStatus
} from "@mobile-mechanic/core";
import type { Estimate, Invoice, JobListItem, JobStatus } from "@mobile-mechanic/types";

type OperationalTone = "brand" | "danger" | "neutral" | "success" | "warning";

type CommunicationEntry = {
  communicationType: string;
  createdAt: string;
};

type PromiseAction = "appointment_confirmation" | "dispatched" | "en_route" | "set_promise" | null;

export type VisitOperationalItem = {
  detail: string;
  label: string;
  ready: boolean;
};

export type VisitPromiseSummary = {
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
  recommendedAction: PromiseAction;
  tone: OperationalTone;
};

export type CustomerPromiseSummary = {
  breachRisk: "high" | "none" | "watch";
  confidenceLabel: string;
  confidencePercent: number;
  copy: string;
  label: string;
  nextUpdateDueAt: string | null;
  nextUpdateLabel: string;
  owner: "Dispatch" | "Service advisor";
  promisedAt: string | null;
  tone: OperationalTone;
};

export type VisitReadinessSummary = {
  copy: string;
  items: VisitOperationalItem[];
  readyCount: number;
  score: number;
  tone: OperationalTone;
  totalCount: number;
};

export type VisitTrustSummary = {
  copy: string;
  label: string;
  nextActionLabel: string;
  owner: "Dispatch" | "Finance" | "Service advisor";
  risk: "high" | "none" | "watch";
  score: number;
  tone: OperationalTone;
};

export type CustomerTrustSummary = {
  copy: string;
  label: string;
  nextActionLabel: string;
  owner: "Dispatch" | "Finance" | "Service advisor";
  risk: "high" | "none" | "watch";
  score: number;
  tone: OperationalTone;
};

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

function getPromiseAt(job: Pick<JobListItem, "arrivalWindowStartAt" | "scheduledStartAt">) {
  return job.arrivalWindowStartAt ?? job.scheduledStartAt ?? null;
}

function getLatestCommunication(
  entries: CommunicationEntry[],
  communicationType: string
) {
  return entries.find((entry) => entry.communicationType === communicationType) ?? null;
}

function getLatestPromiseCommunication(entries: CommunicationEntry[]) {
  return (
    entries.find(
      (entry) =>
        entry.communicationType === "appointment_confirmation" ||
        entry.communicationType === "dispatch_update"
    ) ?? null
  );
}

function getDueLabel(input: { dueAt: string | null; now: Date; overdueLabel: string; upcomingPrefix: string }) {
  if (!input.dueAt) {
    return "No update due";
  }

  const dueTime = Date.parse(input.dueAt);

  if (Number.isNaN(dueTime)) {
    return "Update timing unclear";
  }

  const minutesUntil = Math.round((dueTime - input.now.getTime()) / 60_000);

  if (minutesUntil <= 0) {
    return input.overdueLabel;
  }

  if (minutesUntil < 60) {
    return `${input.upcomingPrefix} ${minutesUntil} min`;
  }

  const hours = Math.round(minutesUntil / 60);
  return `${input.upcomingPrefix} ${hours} hr`;
}

function isClosedStatus(status: JobStatus) {
  return status === "completed" || status === "canceled";
}

function getTrustNextActionLabel(action: PromiseAction) {
  switch (action) {
    case "appointment_confirmation":
      return "Confirm timing";
    case "dispatched":
      return "Send dispatch update";
    case "en_route":
      return "Send en-route update";
    default:
      return "Manage promise";
  }
}

function mapPromiseOwnerToTrustOwner(
  owner: VisitPromiseSummary["owner"],
  fallback: "Dispatch" | "Service advisor"
) {
  return owner === "Closed" ? fallback : owner;
}

export function getVisitPromiseSummary(input: {
  communications?: CommunicationEntry[] | null | undefined;
  job: Pick<JobListItem, "arrivalWindowStartAt" | "assignedTechnicianUserId" | "scheduledStartAt" | "status">;
  now?: Date;
}) {
  const communications = input.communications ?? [];
  const now = input.now ?? new Date();
  const promisedAt = getPromiseAt(input.job);
  const latestPromiseCommunication = getLatestPromiseCommunication(communications);
  const latestPromiseCommunicationAgeMinutes = getMinutesSince(latestPromiseCommunication?.createdAt);
  const latestPromiseCommunicationLabel =
    latestPromiseCommunicationAgeMinutes === null
      ? "No customer timing update logged"
      : latestPromiseCommunicationAgeMinutes < 60
        ? `Updated ${latestPromiseCommunicationAgeMinutes} min ago`
        : `Updated ${Math.round(latestPromiseCommunicationAgeMinutes / 60)} hr ago`;

  if (isClosedStatus(input.job.status)) {
    return {
      breachRisk: "none",
      confidenceLabel: "Closed",
      confidencePercent: 100,
      copy: "Promise tracking is closed on this visit.",
      label: "Promise closed",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: null,
      nextUpdateLabel: "No update due",
      owner: "Closed",
      promisedAt,
      recommendedAction: null,
      tone: "neutral" as const
    } satisfies VisitPromiseSummary;
  }

  if (!promisedAt) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Low confidence",
      confidencePercent: 20,
      copy: "Set a schedule or arrival window before this visit moves deeper into dispatch.",
      label: "Needs promise",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: null,
      nextUpdateLabel: "Set promise first",
      owner: "Dispatch",
      promisedAt: null,
      recommendedAction: "set_promise" as const,
      tone: "warning" as const
    } satisfies VisitPromiseSummary;
  }

  const promiseTime = Date.parse(promisedAt);

  if (Number.isNaN(promiseTime)) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Low confidence",
      confidencePercent: 25,
      copy: "The current promise time could not be parsed. Reset the timing from the working queue.",
      label: "Promise unclear",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: promisedAt,
      nextUpdateLabel: "Reset timing now",
      owner: "Dispatch",
      promisedAt,
      recommendedAction: "set_promise" as const,
      tone: "warning" as const
    } satisfies VisitPromiseSummary;
  }

  const minutesUntilPromise = Math.round((promiseTime - now.getTime()) / 60_000);
  const latestAppointmentConfirmation = getLatestCommunication(
    communications,
    "appointment_confirmation"
  );
  const latestDispatchUpdate = getLatestCommunication(communications, "dispatch_update");
  const latestAppointmentConfirmationAgeMinutes = getMinutesSince(
    latestAppointmentConfirmation?.createdAt
  );
  const latestDispatchUpdateAgeMinutes = getMinutesSince(latestDispatchUpdate?.createdAt);

  if (minutesUntilPromise <= 0 && !isTechnicianOnSiteJobStatus(input.job.status)) {
    return {
      breachRisk: "high",
      confidenceLabel: "Broken promise",
      confidencePercent: 10,
      copy: latestDispatchUpdateAgeMinutes === null
        ? "The promised timing has already slipped and the customer has not been updated from this workflow yet."
        : `The promise has slipped. Last dispatch update was ${latestDispatchUpdateAgeMinutes} minutes ago.`,
      label: "Promise missed",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: promisedAt,
      nextUpdateLabel: "Due now",
      owner: "Dispatch",
      promisedAt,
      recommendedAction: input.job.assignedTechnicianUserId
        ? isTechnicianTravelJobStatus(input.job.status)
          ? "en_route"
          : "dispatched"
        : "set_promise",
      tone: "danger" as const
    } satisfies VisitPromiseSummary;
  }

  if (
    input.job.status === "scheduled" &&
    minutesUntilPromise <= 90 &&
    (latestAppointmentConfirmationAgeMinutes === null ||
      latestAppointmentConfirmationAgeMinutes > 12 * 60)
  ) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Watch closely",
      confidencePercent: 55,
      copy: latestAppointmentConfirmationAgeMinutes === null
        ? "The visit is approaching its promise window and no appointment confirmation is logged."
        : `The visit is close and the last appointment confirmation was ${latestAppointmentConfirmationAgeMinutes} minutes ago.`,
      label: "Confirm timing",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: promisedAt,
      nextUpdateLabel: getDueLabel({
        dueAt: promisedAt,
        now,
        overdueLabel: "Due now",
        upcomingPrefix: "Due in"
      }),
      owner: "Service advisor",
      promisedAt,
      recommendedAction: "appointment_confirmation" as const,
      tone: "warning" as const
    } satisfies VisitPromiseSummary;
  }

  if (
    isTechnicianTravelJobStatus(input.job.status) &&
    minutesUntilPromise <= 20 &&
    (latestDispatchUpdateAgeMinutes === null || latestDispatchUpdateAgeMinutes > 20)
  ) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Watch closely",
      confidencePercent: 60,
      copy: latestDispatchUpdateAgeMinutes === null
        ? "Arrival is close and no dispatch update is logged for the customer yet."
        : `Arrival is close and the last dispatch update was ${latestDispatchUpdateAgeMinutes} minutes ago.`,
      label: "Update en route",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: promisedAt,
      nextUpdateLabel: getDueLabel({
        dueAt: promisedAt,
        now,
        overdueLabel: "Due now",
        upcomingPrefix: "Due in"
      }),
      owner: "Dispatch",
      promisedAt,
      recommendedAction: "en_route" as const,
      tone: "warning" as const
    } satisfies VisitPromiseSummary;
  }

  if (isTechnicianOnSiteJobStatus(input.job.status)) {
    return {
      breachRisk: "none",
      confidenceLabel: input.job.status === "ready_for_payment" ? "Closeout ready" : "On site",
      confidencePercent: 85,
      copy:
        input.job.status === "waiting_approval"
          ? "The technician is on site but approval is holding the next move. Keep the customer thread warm until the answer lands."
          : input.job.status === "waiting_parts"
            ? "The technician is on site but parts are blocking completion. Keep timing aligned while supply catches up."
            : input.job.status === "ready_for_payment"
              ? "Field work is wrapping. Keep the customer oriented through payment and closeout."
              : "Field work is in motion. Keep customer expectations aligned if scope or timing changes.",
      label:
        input.job.status === "waiting_approval"
          ? "Approval pending on site"
          : input.job.status === "waiting_parts"
            ? "Parts blocker on site"
            : input.job.status === "ready_for_payment"
              ? "Ready for payment"
              : "Working now",
      lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
      lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
      nextUpdateDueAt: null,
      nextUpdateLabel: "Update only if timing changes",
      owner: "Dispatch",
      promisedAt,
      recommendedAction: null,
      tone: "success" as const
    } satisfies VisitPromiseSummary;
  }

  return {
    breachRisk: "none",
    confidenceLabel: latestPromiseCommunicationAgeMinutes === null ? "Set but quiet" : "High confidence",
    confidencePercent: latestPromiseCommunicationAgeMinutes === null ? 72 : 88,
    copy: latestDispatchUpdateAgeMinutes !== null || latestAppointmentConfirmationAgeMinutes !== null
      ? "The customer has recent timing context tied to this visit."
      : "The current promise is set and the visit is still on track.",
    label: "On track",
    lastCustomerUpdateAt: latestPromiseCommunication?.createdAt ?? null,
    lastCustomerUpdateLabel: latestPromiseCommunicationLabel,
    nextUpdateDueAt: null,
    nextUpdateLabel: "No update due",
    owner: "Dispatch",
    promisedAt,
    recommendedAction: null,
    tone: "success" as const
  } satisfies VisitPromiseSummary;
}

export function getCustomerPromiseSummary(input: {
  activeVisits: Array<{
    jobStatus: JobStatus;
    scheduledStartAt: string | null;
  }>;
  latestCommunicationAt?: string | null | undefined;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const activePromisedVisits = input.activeVisits
    .filter((visit) => !isClosedStatus(visit.jobStatus) && Boolean(visit.scheduledStartAt))
    .sort((left, right) => {
      const leftValue = Date.parse(left.scheduledStartAt ?? "");
      const rightValue = Date.parse(right.scheduledStartAt ?? "");
      return leftValue - rightValue;
    });
  const nextPromisedVisit = activePromisedVisits[0] ?? null;
  const latestCommunicationAgeMinutes = getMinutesSince(input.latestCommunicationAt);
  const latestCommunicationLabel =
    latestCommunicationAgeMinutes === null
      ? "No timing update logged"
      : latestCommunicationAgeMinutes < 60
        ? `Updated ${latestCommunicationAgeMinutes} min ago`
        : `Updated ${Math.round(latestCommunicationAgeMinutes / 60)} hr ago`;

  if (!input.activeVisits.length) {
    return {
      breachRisk: "none",
      confidenceLabel: "No live promise",
      confidencePercent: 100,
      copy: "No active visit is open, so there is no live timing promise to manage here.",
      label: "No live promise",
      nextUpdateDueAt: null,
      nextUpdateLabel: "No update due",
      owner: "Service advisor",
      promisedAt: null,
      tone: "neutral" as const
    } satisfies CustomerPromiseSummary;
  }

  if (!nextPromisedVisit?.scheduledStartAt) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Low confidence",
      confidencePercent: 30,
      copy: "Active work exists, but at least one visit still needs a clear promised time.",
      label: "Needs promise",
      nextUpdateDueAt: null,
      nextUpdateLabel: "Set promise first",
      owner: "Dispatch",
      promisedAt: null,
      tone: "warning" as const
    } satisfies CustomerPromiseSummary;
  }

  const minutesUntilPromise = Math.round(
    (Date.parse(nextPromisedVisit.scheduledStartAt) - now.getTime()) / 60_000
  );

  if (
    minutesUntilPromise <= 0 &&
    (latestCommunicationAgeMinutes === null || latestCommunicationAgeMinutes > 120)
  ) {
    return {
      breachRisk: "high",
      confidenceLabel: "Broken promise",
      confidencePercent: 15,
      copy: "The next promised visit is already slipping and the customer has not been updated recently.",
      label: "Promise missed",
      nextUpdateDueAt: nextPromisedVisit.scheduledStartAt,
      nextUpdateLabel: "Due now",
      owner: "Dispatch",
      promisedAt: nextPromisedVisit.scheduledStartAt,
      tone: "danger" as const
    } satisfies CustomerPromiseSummary;
  }

  if (
    minutesUntilPromise <= 90 &&
    (latestCommunicationAgeMinutes === null || latestCommunicationAgeMinutes > 12 * 60)
  ) {
    return {
      breachRisk: "watch",
      confidenceLabel: "Watch closely",
      confidencePercent: 55,
      copy: `The next promised visit is approaching and customer timing context is stale. ${latestCommunicationLabel}.`,
      label: "Update due soon",
      nextUpdateDueAt: nextPromisedVisit.scheduledStartAt,
      nextUpdateLabel: getDueLabel({
        dueAt: nextPromisedVisit.scheduledStartAt,
        now,
        overdueLabel: "Due now",
        upcomingPrefix: "Due in"
      }),
      owner: "Service advisor",
      promisedAt: nextPromisedVisit.scheduledStartAt,
      tone: "warning" as const
    } satisfies CustomerPromiseSummary;
  }

  return {
    breachRisk: "none",
    confidenceLabel: latestCommunicationAgeMinutes === null ? "Set but quiet" : "High confidence",
    confidencePercent: latestCommunicationAgeMinutes === null ? 74 : 88,
    copy: `The next promised visit is set and the customer has enough timing context to stay oriented. ${latestCommunicationLabel}.`,
    label: "On track",
    nextUpdateDueAt: null,
    nextUpdateLabel: "No update due",
    owner: "Dispatch",
    promisedAt: nextPromisedVisit.scheduledStartAt,
    tone: "success" as const
  } satisfies CustomerPromiseSummary;
}

export function getVisitTrustSummary(input: {
  communications?: CommunicationEntry[] | null | undefined;
  estimate?: Pick<Estimate, "status"> | null | undefined;
  followUpActive?: boolean | undefined;
  invoice?: Pick<Invoice, "balanceDueCents" | "status"> | null | undefined;
  job: Pick<
    JobListItem,
    "arrivalWindowStartAt" | "assignedTechnicianUserId" | "scheduledStartAt" | "status"
  >;
  now?: Date;
}) {
  const communications = input.communications ?? [];
  const latestCustomerUpdate = getLatestPromiseCommunication(communications) ?? communications[0] ?? null;
  const latestCustomerUpdateAgeMinutes = getMinutesSince(latestCustomerUpdate?.createdAt);
  const promiseSummary = getVisitPromiseSummary({
    communications,
    job: input.job,
    ...(input.now ? { now: input.now } : {})
  });
  const hasOpenBalance =
    Boolean(input.invoice) &&
    input.invoice?.balanceDueCents !== undefined &&
    input.invoice.balanceDueCents > 0 &&
    input.invoice.status !== "paid" &&
    input.invoice.status !== "void";

  if (
    promiseSummary.breachRisk === "high" &&
    (latestCustomerUpdateAgeMinutes === null || latestCustomerUpdateAgeMinutes > 30)
  ) {
    return {
      copy: latestCustomerUpdateAgeMinutes === null
        ? "The promise is already broken and no customer-facing update is logged from this visit."
        : `The promise is broken and the last customer update was ${latestCustomerUpdateAgeMinutes} minutes ago.`,
      label: "Customer trust at risk",
      nextActionLabel: "Send recovery update",
      owner: "Dispatch",
      risk: "high",
      score: 18,
      tone: "danger"
    } satisfies VisitTrustSummary;
  }

  if (
    input.estimate?.status === "sent" &&
    (latestCustomerUpdateAgeMinutes === null || latestCustomerUpdateAgeMinutes > 24 * 60)
  ) {
    return {
      copy: "Approval is still waiting and the customer thread has gone quiet long enough to threaten conversion.",
      label: "Approval thread cooling",
      nextActionLabel: "Follow up approval",
      owner: "Service advisor",
      risk: "watch",
      score: 38,
      tone: "warning"
    } satisfies VisitTrustSummary;
  }

  if (input.followUpActive && (latestCustomerUpdateAgeMinutes === null || latestCustomerUpdateAgeMinutes > 24 * 60)) {
    return {
      copy: "Return-work context is active, but the customer has not had a fresh follow-up update recently.",
      label: "Return-work thread quiet",
      nextActionLabel: "Update return-work status",
      owner: "Service advisor",
      risk: "watch",
      score: 44,
      tone: "warning"
    } satisfies VisitTrustSummary;
  }

  if (hasOpenBalance && (latestCustomerUpdateAgeMinutes === null || latestCustomerUpdateAgeMinutes > 48 * 60)) {
    return {
      copy: "Money is still open and the customer has not had recent closeout follow-through from this visit.",
      label: "Closeout thread cooling",
      nextActionLabel: "Send billing follow-up",
      owner: "Finance",
      risk: "watch",
      score: 50,
      tone: "brand"
    } satisfies VisitTrustSummary;
  }

  if (promiseSummary.breachRisk === "watch") {
    return {
      copy: "Customer confidence is still recoverable, but the current promise needs active management.",
      label: "Watch confidence",
      nextActionLabel: getTrustNextActionLabel(promiseSummary.recommendedAction),
      owner: mapPromiseOwnerToTrustOwner(promiseSummary.owner, "Dispatch"),
      risk: "watch",
      score: 64,
      tone: "warning"
    } satisfies VisitTrustSummary;
  }

  if (latestCustomerUpdateAgeMinutes === null && !isClosedStatus(input.job.status)) {
    return {
      copy: "No customer-facing update is logged yet, so confidence depends entirely on the current promise holding.",
      label: "Quiet thread",
      nextActionLabel: "Send timing update",
      owner: "Service advisor",
      risk: "watch",
      score: 70,
      tone: "brand"
    } satisfies VisitTrustSummary;
  }

  return {
    copy: "The customer has enough active context from this visit to stay oriented and confident.",
    label: "Trust stable",
    nextActionLabel: "Monitor only",
    owner: mapPromiseOwnerToTrustOwner(promiseSummary.owner, "Service advisor"),
    risk: "none",
    score: 88,
    tone: "success"
  } satisfies VisitTrustSummary;
}

export function getCustomerTrustSummary(input: {
  activeFollowUpVisitCount: number;
  activeVisitCount: number;
  latestCommunicationAt: string | null | undefined;
  latestPromiseAt: string | null | undefined;
  openBalanceCents: number;
  pendingApprovalCount: number;
  promiseRisk: "high" | "none" | "watch";
}) {
  const communicationAgeMinutes = getMinutesSince(input.latestCommunicationAt);
  const promiseAgeMinutes = getMinutesSince(input.latestPromiseAt);

  if (input.promiseRisk === "high") {
    return {
      copy: "A promised visit is already slipping and the customer has not been updated recently.",
      label: "At risk",
      nextActionLabel: "Recover promised visit",
      owner: "Dispatch",
      risk: "high",
      score: 18,
      tone: "danger"
    } satisfies CustomerTrustSummary;
  }

  if (
    input.promiseRisk === "watch" &&
    input.latestPromiseAt &&
    promiseAgeMinutes !== null &&
    promiseAgeMinutes >= -90
  ) {
    return {
      copy: "Timing confidence is slipping and this relationship needs a fresh customer update.",
      label: "Watch promise",
      nextActionLabel: "Refresh timing",
      owner: "Dispatch",
      risk: "watch",
      score: 52,
      tone: "warning"
    } satisfies CustomerTrustSummary;
  }

  if (input.pendingApprovalCount >= 1 && (communicationAgeMinutes === null || communicationAgeMinutes > 24 * 60)) {
    return {
      copy: "Approval is still pending and the customer thread has gone quiet long enough to threaten conversion.",
      label: "Approval quiet",
      nextActionLabel: "Follow up approval",
      owner: "Service advisor",
      risk: "watch",
      score: 40,
      tone: "warning"
    } satisfies CustomerTrustSummary;
  }

  if (
    (input.activeFollowUpVisitCount > 0 || input.activeVisitCount > 0) &&
    (communicationAgeMinutes === null || communicationAgeMinutes > 24 * 60)
  ) {
    return {
      copy: "Active work exists, but this relationship has gone quiet for more than a day.",
      label: "Needs update",
      nextActionLabel: "Send customer update",
      owner: "Service advisor",
      risk: "watch",
      score: 48,
      tone: "warning"
    } satisfies CustomerTrustSummary;
  }

  if (input.openBalanceCents > 0) {
    return {
      copy: "Money is still open on this relationship, so closeout clarity matters.",
      label: "Open exposure",
      nextActionLabel: "Collect open balance",
      owner: "Finance",
      risk: "watch",
      score: 58,
      tone: "brand"
    } satisfies CustomerTrustSummary;
  }

  if (input.activeVisitCount > 0 || input.activeFollowUpVisitCount > 0) {
    return {
      copy: "The customer has active service work and recent enough context to stay oriented.",
      label: "In motion",
      nextActionLabel: "Monitor active thread",
      owner: "Service advisor",
      risk: "none",
      score: 84,
      tone: "success"
    } satisfies CustomerTrustSummary;
  }

  return {
    copy: "No immediate relationship risk is visible from current service and communication history.",
    label: "Stable",
    nextActionLabel: "Start new visit",
    owner: "Service advisor",
    risk: "none",
    score: 92,
    tone: "neutral"
  } satisfies CustomerTrustSummary;
}

export function getVisitReadinessSummary(input: {
  communications?: CommunicationEntry[] | null | undefined;
  estimate?: Pick<Estimate, "status"> | null | undefined;
  inspectionStatus?: string | null | undefined;
  inventoryIssueCount?: number | undefined;
  invoice?: Pick<Invoice, "status"> | null | undefined;
  job: Pick<
    JobListItem,
    "arrivalWindowStartAt" | "assignedTechnicianUserId" | "scheduledStartAt" | "status"
  >;
  noteCount?: number | undefined;
  openPartRequestCount?: number | undefined;
  photoCount?: number | undefined;
}) {
  const promiseSummary = getVisitPromiseSummary({
    communications: input.communications,
    job: input.job
  });
  const isApprovalClear = input.estimate?.status !== "sent";
  const supplyBlockerCount =
    Number(input.inventoryIssueCount ?? 0) + Number(input.openPartRequestCount ?? 0);
  const hasFieldEvidence =
    Boolean(input.inspectionStatus && input.inspectionStatus !== "not_started") ||
    Number(input.photoCount ?? 0) > 0 ||
    Number(input.noteCount ?? 0) > 0;
  const executionRecordItem =
    input.job.status === "completed"
      ? {
          detail: input.invoice
            ? "Billing has started for this completed visit."
            : "Completed work still needs a billing record.",
          label: "Billing started",
          ready: Boolean(input.invoice)
        }
      : isTechnicianOnSiteJobStatus(input.job.status)
        ? {
            detail: hasFieldEvidence
              ? "Inspection notes, photos, or service notes are already attached."
              : "Capture field evidence while the technician is on site.",
            label: "Field evidence",
            ready: hasFieldEvidence
          }
        : {
            detail: "Evidence will be captured during field execution.",
            label: "Execution record",
            ready: true
          };
  const items: VisitOperationalItem[] = [
    {
      detail: input.job.assignedTechnicianUserId
        ? "Technician ownership is attached to the visit."
        : "Assign a technician before the visit moves deeper into dispatch.",
      label: "Owner assigned",
      ready: Boolean(input.job.assignedTechnicianUserId)
    },
    {
      detail: promiseSummary.copy,
      label: "Promise set",
      ready: promiseSummary.recommendedAction !== "set_promise"
    },
    {
      detail: isApprovalClear
        ? "Customer approval is not blocking the next move."
        : "Estimate approval is still blocking release.",
      label: "Approval clear",
      ready: isApprovalClear
    },
    {
      detail: supplyBlockerCount > 0
        ? `${supplyBlockerCount} supply blocker${supplyBlockerCount === 1 ? "" : "s"} still need resolution.`
        : "No supply blockers are currently attached to this visit.",
      label: "Supply clear",
      ready: supplyBlockerCount === 0
    },
    {
      detail: executionRecordItem.detail,
      label: executionRecordItem.label,
      ready: executionRecordItem.ready
    }
  ];
  const readyCount = items.filter((item) => item.ready).length;
  const totalCount = items.length;
  const score = Math.round((readyCount / totalCount) * 100);
  const tone =
    readyCount === totalCount
      ? ("success" as const)
      : readyCount <= 2
        ? ("danger" as const)
        : ("warning" as const);

  return {
    copy:
      readyCount === totalCount
        ? "This visit is operationally ready for its current stage."
        : `${totalCount - readyCount} readiness check${totalCount - readyCount === 1 ? "" : "s"} still need attention.`,
    items,
    readyCount,
    score,
    tone,
    totalCount
  } satisfies VisitReadinessSummary;
}

export function isVisitReadinessRisk(input: {
  communications?: CommunicationEntry[] | null | undefined;
  estimate?: Pick<Estimate, "status"> | null | undefined;
  job: Pick<
    JobListItem,
    "arrivalWindowStartAt" | "assignedTechnicianUserId" | "scheduledStartAt" | "status"
  >;
}) {
  const readiness = getVisitReadinessSummary({
    communications: input.communications,
    estimate: input.estimate,
    job: input.job
  });

  return readiness.tone === "danger" || readiness.score < 80;
}
