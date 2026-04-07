import type { Job, JobListItem, JobStatus } from "@mobile-mechanic/types";

type FollowUpTone = "brand" | "neutral" | "success" | "warning";
type FollowUpRecoveryOwner = "Dispatch" | "Finance" | "Service advisor" | "Supply";
type FollowUpCustomerStatus =
  | "awaiting_parts"
  | "follow_up_booked"
  | "follow_up_in_progress"
  | "follow_up_rescheduled"
  | null;
type FollowUpCustomerCommunication = "appointment_confirmation" | "dispatch_update" | null;

type VisitNoteEntry = {
  body: string;
};

type VisitCommunicationEntry = {
  communicationType: string;
  createdAt: string;
};

type RelatedVisitEntry = {
  jobId: string;
  jobStatus: JobStatus;
  jobTitle: string;
};

export type VisitFollowUpSummary = {
  activeRelatedVisitCount: number;
  childJobId: string | null;
  childTitle: string | null;
  copy: string;
  customerCommunicationAction: FollowUpCustomerCommunication;
  customerStatus: FollowUpCustomerStatus;
  customerStatusCopy: string | null;
  hasChainContext: boolean;
  isFollowUpVisit: boolean;
  label: string;
  needsSourceCloseout: boolean;
  recommendedAction: "close_source" | "create_return_visit" | "monitor_return_visit" | null;
  recoveryOwner: FollowUpRecoveryOwner;
  sourceJobId: string | null;
  sourceTitle: string | null;
  staleCopy: string | null;
  staleFollowUp: boolean;
  shouldCreateReturnVisit: boolean;
  tone: FollowUpTone;
};

export type FollowUpCommunicationAction =
  | "follow_up_awaiting_parts"
  | "follow_up_booked"
  | "follow_up_rescheduled"
  | "follow_up_status_update";

const followUpTitlePattern = /^follow[\s-]?up:/i;
const sourceVisitPattern = /^Follow-up visit created from (.+) \(([^)]+)\)\.$/i;
const childVisitPattern = /^Created follow-up visit (.+) \(([^)]+)\)\.$/i;

function isClosedStatus(status: JobStatus) {
  return status === "completed" || status === "canceled";
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

function findLinkedVisit(
  notes: VisitNoteEntry[],
  pattern: RegExp
) {
  for (const note of notes) {
    const match = note.body.match(pattern);

    if (match) {
      return {
        jobId: match[2] ?? null,
        title: match[1]?.trim() ?? null
      };
    }
  }

  return {
    jobId: null,
    title: null
  };
}

function getLatestCommunication(
  entries: VisitCommunicationEntry[],
  communicationType: string
) {
  return entries.find((entry) => entry.communicationType === communicationType) ?? null;
}

export function isFollowUpVisitTitle(title: string) {
  return followUpTitlePattern.test(title.trim());
}

export function isFollowUpVisit(
  job: Pick<Job, "title"> | Pick<JobListItem, "title">
) {
  return isFollowUpVisitTitle(job.title);
}

export function isStaleFollowUpVisit(input: {
  arrivalWindowStartAt?: string | null | undefined;
  scheduledStartAt?: string | null | undefined;
  status: JobStatus;
  title: string;
}) {
  if (!isFollowUpVisitTitle(input.title)) {
    return false;
  }

  if (isClosedStatus(input.status)) {
    return false;
  }

  const promisedAt = input.arrivalWindowStartAt ?? input.scheduledStartAt ?? null;

  if (!promisedAt) {
    return true;
  }

  const promiseTime = Date.parse(promisedAt);

  if (Number.isNaN(promiseTime)) {
    return true;
  }

  return promiseTime <= Date.now();
}

export function getFollowUpCommunicationAction(summary: Pick<
  VisitFollowUpSummary,
  "customerStatus"
>): {
  action: FollowUpCommunicationAction;
  label: string;
  successMessage: string;
} | null {
  switch (summary.customerStatus) {
    case "awaiting_parts":
      return {
        action: "follow_up_awaiting_parts",
        label: "Send awaiting-parts update",
        successMessage: "Awaiting-parts update queued."
      };
    case "follow_up_booked":
      return {
        action: "follow_up_booked",
        label: "Send return-visit booking",
        successMessage: "Return-visit booking queued."
      };
    case "follow_up_rescheduled":
      return {
        action: "follow_up_rescheduled",
        label: "Send reschedule update",
        successMessage: "Return-visit reschedule queued."
      };
    case "follow_up_in_progress":
      return {
        action: "follow_up_status_update",
        label: "Send return-visit status",
        successMessage: "Return-visit status update queued."
      };
    default:
      return null;
  }
}

export function getVisitFollowUpSummary(input: {
  assignedTechnicianUserId?: string | null | undefined;
  communications?: VisitCommunicationEntry[] | null | undefined;
  createdAt?: string | null | undefined;
  job: Pick<Job, "id" | "status" | "title"> | Pick<JobListItem, "id" | "status" | "title">;
  invoiceStarted?: boolean | null | undefined;
  notes?: VisitNoteEntry[] | null | undefined;
  promisedAt?: string | null | undefined;
  relatedVisits?: RelatedVisitEntry[] | null | undefined;
  supplyBlockerCount?: number | undefined;
}): VisitFollowUpSummary {
  const communications = input.communications ?? [];
  const notes = input.notes ?? [];
  const relatedVisits = input.relatedVisits ?? [];
  const sourceVisit = findLinkedVisit(notes, sourceVisitPattern);
  const childVisit = findLinkedVisit(notes, childVisitPattern);
  const activeRelatedVisitCount = relatedVisits.filter(
    (visit) => visit.jobId !== input.job.id && !isClosedStatus(visit.jobStatus)
  ).length;
  const isFollowUpTitle = isFollowUpVisit(input.job);
  const needsSourceCloseout = Boolean(
    childVisit.jobId &&
      ((!isClosedStatus(input.job.status)) ||
        (input.job.status === "completed" && input.invoiceStarted === false))
  );
  const shouldCreateReturnVisit = Boolean(
    !sourceVisit.jobId &&
      !childVisit.jobId &&
      !isFollowUpTitle &&
      Number(input.supplyBlockerCount ?? 0) > 0 &&
      (input.job.status === "completed" || input.job.status === "canceled")
  );
  const latestAppointmentConfirmation = getLatestCommunication(
    communications,
    "appointment_confirmation"
  );
  const latestDispatchUpdate = getLatestCommunication(communications, "dispatch_update");
  const promiseTime = input.promisedAt ? Date.parse(input.promisedAt) : Number.NaN;
  const createdAgeMinutes = getMinutesSince(input.createdAt);
  const latestDispatchUpdateAgeMinutes = getMinutesSince(latestDispatchUpdate?.createdAt);
  const staleBecauseUnscheduled = Boolean(
    (sourceVisit.jobId || isFollowUpTitle) &&
      !isClosedStatus(input.job.status) &&
      !input.promisedAt &&
      createdAgeMinutes !== null &&
      createdAgeMinutes >= 24 * 60
  );
  const staleBecausePromiseSlipped = Boolean(
    (sourceVisit.jobId || isFollowUpTitle) &&
      !isClosedStatus(input.job.status) &&
      input.promisedAt &&
      !Number.isNaN(promiseTime) &&
      promiseTime <= Date.now()
  );
  const staleCopy = staleBecausePromiseSlipped
    ? "The promised return visit timing has already slipped."
    : staleBecauseUnscheduled
      ? "This return visit has been open without a promise window for more than a day."
      : needsSourceCloseout
        ? "A linked return visit exists, but the source visit still needs closeout."
        : shouldCreateReturnVisit
          ? "The source visit is blocked by parts coverage and still needs a return visit booked."
          : null;
  const customerStatus: FollowUpCustomerStatus = shouldCreateReturnVisit
    ? "awaiting_parts"
    : sourceVisit.jobId && input.promisedAt
      ? latestAppointmentConfirmation
        ? "follow_up_rescheduled"
        : "follow_up_booked"
      : sourceVisit.jobId && input.assignedTechnicianUserId
        ? "follow_up_in_progress"
        : null;
  const customerStatusCopy =
    customerStatus === "awaiting_parts"
      ? "Customer should be told the follow-up work is waiting on parts before the thread goes cold."
      : customerStatus === "follow_up_booked"
        ? "Customer should receive the booked return-visit confirmation."
        : customerStatus === "follow_up_rescheduled"
          ? "Customer timing changed on the return visit and should get a fresh confirmation."
          : customerStatus === "follow_up_in_progress"
            ? latestDispatchUpdateAgeMinutes === null
              ? "Customer should get a live update that the return visit is moving."
              : `Last live update was ${latestDispatchUpdateAgeMinutes} minutes ago.`
            : null;
  const customerCommunicationAction: FollowUpCustomerCommunication =
    customerStatus === "follow_up_booked" || customerStatus === "follow_up_rescheduled"
      ? "appointment_confirmation"
      : customerStatus === "follow_up_in_progress"
        ? "dispatch_update"
        : null;

  if (sourceVisit.jobId) {
    return {
      activeRelatedVisitCount,
      childJobId: childVisit.jobId,
      childTitle: childVisit.title,
      copy:
        activeRelatedVisitCount > 0
          ? `This return visit stays attached to ${sourceVisit.title}. ${activeRelatedVisitCount} other active visit${activeRelatedVisitCount === 1 ? "" : "s"} are still open on the same vehicle thread.`
          : `This return visit stays attached to ${sourceVisit.title} so the same vehicle thread does not restart from zero.`,
      customerCommunicationAction,
      customerStatus,
      customerStatusCopy,
      hasChainContext: true,
      isFollowUpVisit: true,
      label: "Return visit",
      needsSourceCloseout: false,
      recommendedAction: activeRelatedVisitCount > 0 ? "monitor_return_visit" : null,
      recoveryOwner:
        customerCommunicationAction === "dispatch_update" ? "Dispatch" : "Service advisor",
      sourceJobId: sourceVisit.jobId,
      sourceTitle: sourceVisit.title,
      staleCopy,
      staleFollowUp: Boolean(staleCopy),
      shouldCreateReturnVisit: false,
      tone: activeRelatedVisitCount > 0 ? "warning" : "brand"
    };
  }

  if (childVisit.jobId) {
    const linkedChildVisit = relatedVisits.find((visit) => visit.jobId === childVisit.jobId) ?? null;
    const childIsActive = linkedChildVisit ? !isClosedStatus(linkedChildVisit.jobStatus) : true;

    return {
      activeRelatedVisitCount,
      childJobId: childVisit.jobId,
      childTitle: childVisit.title,
      copy: childIsActive
        ? `${childVisit.title} is carrying the follow-up thread for this vehicle right now.`
        : `${childVisit.title} is linked as the follow-up visit on this vehicle thread.`,
      customerCommunicationAction,
      customerStatus,
      customerStatusCopy,
      hasChainContext: true,
      isFollowUpVisit: isFollowUpTitle,
      label: needsSourceCloseout
        ? "Source needs closeout"
        : childIsActive
          ? "Return visit open"
          : "Follow-up logged",
      needsSourceCloseout,
      recommendedAction: needsSourceCloseout
        ? "close_source"
        : childIsActive
          ? "monitor_return_visit"
          : null,
      recoveryOwner: needsSourceCloseout
        ? input.invoiceStarted
          ? "Finance"
          : "Service advisor"
        : "Service advisor",
      sourceJobId: null,
      sourceTitle: null,
      staleCopy,
      staleFollowUp: Boolean(staleCopy),
      shouldCreateReturnVisit: false,
      tone: needsSourceCloseout ? "warning" : childIsActive ? "brand" : "success"
    };
  }

  if (isFollowUpTitle) {
    return {
      activeRelatedVisitCount,
      childJobId: null,
      childTitle: null,
      copy:
        activeRelatedVisitCount > 0
          ? `${activeRelatedVisitCount} other active visit${activeRelatedVisitCount === 1 ? "" : "s"} are still open on this vehicle, so keep the return-work thread visible.`
          : "This visit is labeled as return work on the same vehicle thread.",
      customerCommunicationAction,
      customerStatus,
      customerStatusCopy,
      hasChainContext: true,
      isFollowUpVisit: true,
      label: "Return visit",
      needsSourceCloseout: false,
      recommendedAction: activeRelatedVisitCount > 0 ? "monitor_return_visit" : null,
      recoveryOwner:
        customerCommunicationAction === "dispatch_update" ? "Dispatch" : "Service advisor",
      sourceJobId: null,
      sourceTitle: null,
      staleCopy,
      staleFollowUp: Boolean(staleCopy),
      shouldCreateReturnVisit: false,
      tone: activeRelatedVisitCount > 0 ? "warning" : "brand"
    };
  }

  if (shouldCreateReturnVisit) {
    return {
      activeRelatedVisitCount,
      childJobId: null,
      childTitle: null,
      copy: `${input.supplyBlockerCount} supply blocker${input.supplyBlockerCount === 1 ? "" : "s"} remain after this visit and no return visit is linked yet.`,
      customerCommunicationAction,
      customerStatus,
      customerStatusCopy,
      hasChainContext: true,
      isFollowUpVisit: false,
      label: "Return visit likely",
      needsSourceCloseout: false,
      recommendedAction: "create_return_visit",
      recoveryOwner: Number(input.supplyBlockerCount ?? 0) > 0 ? "Supply" : "Service advisor",
      sourceJobId: null,
      sourceTitle: null,
      staleCopy,
      staleFollowUp: Boolean(staleCopy),
      shouldCreateReturnVisit: true,
      tone: "warning"
    };
  }

  return {
    activeRelatedVisitCount,
    childJobId: null,
    childTitle: null,
    copy:
      activeRelatedVisitCount > 0
        ? `${activeRelatedVisitCount} other active visit${activeRelatedVisitCount === 1 ? "" : "s"} are open for this vehicle. Keep the chain visible before dispatching more work.`
        : "No active return-work chain is attached to this visit.",
    customerCommunicationAction,
    customerStatus,
    customerStatusCopy,
    hasChainContext: activeRelatedVisitCount > 0,
    isFollowUpVisit: false,
    label: activeRelatedVisitCount > 0 ? "Shared vehicle thread" : "Standalone visit",
    needsSourceCloseout: false,
    recommendedAction: activeRelatedVisitCount > 0 ? "monitor_return_visit" : null,
    recoveryOwner: activeRelatedVisitCount > 0 ? "Service advisor" : "Dispatch",
    sourceJobId: null,
    sourceTitle: null,
    staleCopy,
    staleFollowUp: Boolean(staleCopy),
    shouldCreateReturnVisit: false,
    tone: activeRelatedVisitCount > 0 ? "warning" : "neutral"
  };
}
