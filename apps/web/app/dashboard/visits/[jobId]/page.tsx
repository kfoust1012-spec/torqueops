import {
  archiveJob as archiveVisit,
  assignJobTechnician as assignVisitTechnician,
  changeJobStatus as changeVisitStatus,
  createJobNote as createVisitNote,
  deleteJobNote as deleteVisitNote,
  enqueueAppointmentConfirmation as enqueueVisitAppointmentConfirmation,
  enqueueDispatchUpdate as enqueueVisitDispatchUpdate,
  getCustomerById,
  getEstimateByJobId as getEstimateByVisitId,
  getInspectionByJobId as getInspectionByVisitId,
  getJobById as getVisitById,
  getVehicleById,
  getInvoiceByJobId as getInvoiceByVisitId,
  getInvoiceDetailById,
  listAttachmentsByJob as listVisitAttachments,
  listAssignableTechniciansByCompany,
  listJobCommunications as listVisitCommunications,
  listJobNotesByJob as listVisitNotesById,
  listJobStatusHistory as listVisitStatusHistory,
  listProfilesByIds,
  updateJobNote as updateVisitNote
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateRange,
  formatDateTime,
  formatDesignLabel,
  getAllowedNextJobStatuses
} from "@mobile-mechanic/core";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Form,
  FormField,
  Page,
  PageGrid,
  PageHeader,
  PriorityBadge,
  Select,
  StatusBadge,
  SubmitButton,
  buttonClassName
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { processCommunicationMutationResult } from "../../../../lib/communications/actions";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import {
  ensureJobVisitAccessLink as ensureVisitAccessLink,
  getJobVisitAccessLinkSummary as getVisitAccessLinkSummary,
  markJobVisitAccessLinkSent as markVisitAccessLinkSent
} from "../../../../lib/customer-documents/service";
import { buildCustomerVehicleHref } from "../../../../lib/customers/workspace";
import { getTechnicianProfilePreview } from "../../../../lib/technician-profiles/service";
import {
  buildVisitEditHref,
  buildVisitEstimateHref,
  buildVisitInspectionHref,
  buildVisitInventoryHref,
  buildVisitInvoiceHref,
  buildVisitPartsHref,
  buildVisitPhotosHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitThreadHref
} from "../../../../lib/visits/workspace";
import { sendTechnicianJobPushNotification } from "../../../../lib/mobile-push-notifications";
import { CommunicationLogPanel } from "../../_components/communication-log-panel";
import { JobNoteForm } from "../_components/job-note-form";
import { JobStatusForm } from "../_components/job-status-form";

type JobDetailPageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    feedback?: string | string[];
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

const jobDetailFeedback = {
  "appointment-queued": {
    body: "The appointment confirmation was queued for delivery to the customer.",
    title: "Appointment update queued",
    tone: "success"
  },
  "appointment-queue-failed": {
    body: "The appointment confirmation could not be queued. Try again after checking the visit schedule.",
    title: "Appointment update failed",
    tone: "danger"
  },
  "archive-failed": {
    body: "The visit could not be archived. Refresh the page and try again.",
    title: "Archive failed",
    tone: "danger"
  },
  "archive-saved": {
    body: "The visit has been archived and removed from the active edit workflow.",
    title: "Visit archived",
    tone: "success"
  },
  "assignment-failed": {
    body: "The technician assignment could not be saved. Refresh the page and try again.",
    title: "Assignment failed",
    tone: "danger"
  },
  "assignment-saved": {
    body: "The technician assignment was updated for this visit.",
    title: "Assignment saved",
    tone: "success"
  },
  "dispatch-update-failed": {
    body: "The dispatch update could not be queued. Check the assigned technician and try again.",
    title: "Dispatch update failed",
    tone: "danger"
  },
  "dispatch-update-queued": {
    body: "The customer dispatch update was queued successfully.",
    title: "Dispatch update queued",
    tone: "success"
  },
  "note-deleted": {
    body: "The visit note was removed from the timeline.",
    title: "Note deleted",
    tone: "success"
  },
  "note-delete-failed": {
    body: "The visit note could not be deleted. Refresh the page and try again.",
    title: "Note delete failed",
    tone: "danger"
  },
  "note-save-failed": {
    body: "The note could not be saved. Refresh the page and try again.",
    title: "Note save failed",
    tone: "danger"
  },
  "note-saved": {
    body: "The visit note is now visible in the internal timeline.",
    title: "Note saved",
    tone: "success"
  },
  "status-failed": {
    body: "The visit status could not be updated. Refresh the page and try again.",
    title: "Status update failed",
    tone: "danger"
  },
  "status-saved": {
    body: "The visit status was updated successfully.",
    title: "Status updated",
    tone: "success"
  }
} as const;

function getQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

function buildFeedbackHref(
  path: string,
  feedback?: keyof typeof jobDetailFeedback,
  options?: {
    returnLabel?: string | null;
    returnScope?: string | null;
    returnTo?: string | null;
  }
) {
  const returnTo = normalizeVisitReturnTo(options?.returnTo);
  const returnLabel = options?.returnLabel?.trim();
  const returnScope = options?.returnScope?.trim();

  if (!feedback) {
    if (!returnScope && !returnTo && !returnLabel) {
      return path;
    }

    const searchParams = new URLSearchParams();

    if (returnScope) {
      searchParams.set("returnScope", returnScope);
    }

    if (returnTo) {
      searchParams.set("returnTo", returnTo);
    }

    if (returnLabel) {
      searchParams.set("returnLabel", returnLabel);
    }

    return `${path}?${searchParams.toString()}`;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("feedback", feedback);

  if (returnScope) {
    searchParams.set("returnScope", returnScope);
  }

  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }

  if (returnLabel) {
    searchParams.set("returnLabel", returnLabel);
  }

  return `${path}?${searchParams.toString()}`;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

type WorkflowCheckpointTone = "success" | "warning";

function getWorkflowCheckpoint(args: {
  estimateStatus: string | null;
  inspectionStatus: string | null;
  invoiceBalanceDueCents: number | null;
  invoiceStatus: string | null;
  photoCount: number;
}) {
  const reminders: string[] = [];

  if (args.inspectionStatus !== "completed") {
    reminders.push(
      args.inspectionStatus
        ? `Inspection is still ${formatDesignLabel(args.inspectionStatus)}.`
        : "Inspection has not been started."
    );
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
    reminders.push(
      `Invoice balance due is ${formatCurrencyFromCents(args.invoiceBalanceDueCents)}.`
    );
  }

  if (args.photoCount === 0) {
    reminders.push("No visit photos have been uploaded yet.");
  }

  if (!reminders.length) {
    return {
      body: "Inspection, estimate/invoice, payment, and photo capture all look complete from the current visit record.",
      title: "Workflow looks ready for final handoff",
      tone: "success" as WorkflowCheckpointTone
    };
  }

  return {
    body: reminders.join(" "),
    title: "Review these open workflow items before closing the visit",
    tone: "warning" as WorkflowCheckpointTone
  };
}

export async function VisitDetailPageImpl({ params, searchParams }: JobDetailPageProps) {
  const context = await requireCompanyContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { jobId } = await params;
  const [jobResult, techniciansResult, notesResult, historyResult] = await Promise.all([
    getVisitById(context.supabase, jobId),
    listAssignableTechniciansByCompany(context.supabase, context.companyId),
    listVisitNotesById(context.supabase, jobId),
    listVisitStatusHistory(context.supabase, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (techniciansResult.error) {
    throw techniciansResult.error;
  }

  if (notesResult.error) {
    throw notesResult.error;
  }

  if (historyResult.error) {
    throw historyResult.error;
  }

  const job = jobResult.data;
  const [customerResult, vehicleResult] = await Promise.all([
    getCustomerById(context.supabase, job.customerId),
    getVehicleById(context.supabase, job.vehicleId)
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  const notes = notesResult.data ?? [];
  const statusHistory = historyResult.data ?? [];
  const userIds = [
    ...new Set([
      ...(job.assignedTechnicianUserId ? [job.assignedTechnicianUserId] : []),
      ...notes.map((note) => note.authorUserId),
      ...statusHistory.map((entry) => entry.changedByUserId),
      ...techniciansResult.data.map((technician) => technician.userId)
    ])
  ];
  const profilesResult = await listProfilesByIds(context.supabase, userIds);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const userNamesById = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name ?? profile.email ?? profile.id
    ])
  );
  const technicianOptions = techniciansResult.data ?? [];
  const assignmentOptions =
    job.assignedTechnicianUserId &&
    !technicianOptions.some((technician) => technician.userId === job.assignedTechnicianUserId)
      ? [
          {
            userId: job.assignedTechnicianUserId,
            displayName: `${
              userNamesById.get(job.assignedTechnicianUserId) ?? job.assignedTechnicianUserId
            } (inactive)`,
            email: null,
            role: "technician" as const
          },
          ...technicianOptions
        ]
      : technicianOptions;
  const allowedStatuses = getAllowedNextJobStatuses(job.status);
  const canMutateJob = context.canEditRecords && job.isActive;
  const pagePath = `/dashboard/visits/${jobId}`;
  const returnLabel = getQueryValue(resolvedSearchParams.returnLabel)?.trim() ?? "";
  const returnScope = getQueryValue(resolvedSearchParams.returnScope)?.trim() ?? "";
  const returnTo = normalizeVisitReturnTo(getQueryValue(resolvedSearchParams.returnTo));
  const queueThreadHref = returnTo
    ? returnTo
    : returnScope || returnLabel
      ? buildVisitReturnThreadHref(jobId, returnScope, {
          returnLabel: returnLabel || null
        })
      : buildVisitThreadHref(jobId);
  const queueThreadLabel =
    returnLabel || (returnTo ? "Back to thread" : returnScope ? "Back to queue" : "Back to visits");
  const visitThreadHref = buildVisitThreadHref(jobId, {
    returnLabel: returnLabel || null,
    returnScope: returnScope || null,
    returnTo
  });
  const feedbackKey = getQueryValue(resolvedSearchParams.feedback);
  const feedback =
    feedbackKey && feedbackKey in jobDetailFeedback
      ? jobDetailFeedback[feedbackKey as keyof typeof jobDetailFeedback]
      : null;
  const communicationsResult = await listVisitCommunications(context.supabase, jobId, { limit: 10 });

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }

  const communicationEntries = communicationsResult.data ?? [];
  const technicianPreview = await getTechnicianProfilePreview(
    context.supabase,
    job.assignedTechnicianUserId
  );
  const jobVisitLinkSummary = technicianPreview.isReady ? await getVisitAccessLinkSummary(job.id) : null;
  const canSendAppointmentConfirmation = context.canEditRecords && Boolean(job.scheduledStartAt);
  const canSendDispatchUpdates = context.canEditRecords && Boolean(job.assignedTechnicianUserId);
  const [inspectionLookup, estimateLookup, invoiceLookup, attachmentsLookup] = await Promise.all([
    getInspectionByVisitId(context.supabase, jobId),
    getEstimateByVisitId(context.supabase, jobId),
    getInvoiceByVisitId(context.supabase, jobId),
    listVisitAttachments(context.supabase, jobId)
  ]);
  const workflowSnapshotUnavailable =
    Boolean(inspectionLookup.error) ||
    Boolean(estimateLookup.error) ||
    Boolean(invoiceLookup.error) ||
    Boolean(attachmentsLookup.error);
  const inspection = inspectionLookup.data ?? null;
  const estimate = estimateLookup.data ?? null;
  const invoice = invoiceLookup.data ?? null;
  const invoiceDetailResult = invoice ? await getInvoiceDetailById(context.supabase, invoice.id) : null;
  const workflowPaymentSummaryUnavailable = Boolean(invoiceDetailResult?.error);
  const invoiceDetail = invoiceDetailResult?.data ?? null;
  const photoCount = attachmentsLookup.data?.length ?? 0;
  const customerUpdatesReady =
    canSendAppointmentConfirmation && canSendDispatchUpdates && technicianPreview.isReady;
  const customerUpdatesSummary = !context.canEditRecords
    ? "Archived visits do not allow new outbound customer updates."
    : customerUpdatesReady
      ? "Appointment and dispatch updates are ready to send."
      : !job.scheduledStartAt
        ? "Add a schedule before sending appointment updates."
        : !job.assignedTechnicianUserId
          ? "Assign a technician before sending dispatch updates."
          : !technicianPreview.isReady
            ? `Technician profile still needs ${technicianPreview.missingFields.join(", ")} before the mechanic card can be shared.`
            : "Customer updates are only partially ready.";
  const estimateHref =
    !estimate && context.canEditRecords
      ? buildVisitEstimateHref(jobId, {
          autostart: true,
          returnLabel,
          returnScope,
          returnTo,
          workspace: true
        })
      : estimate && estimate.status === "draft"
        ? buildVisitEstimateHref(jobId, { returnLabel, returnScope, returnTo, workspace: true })
        : buildVisitEstimateHref(jobId, { returnLabel, returnScope, returnTo });
  const estimateActionLabel =
    !estimate
      ? context.canEditRecords
        ? "Create estimate"
        : "Open estimate"
      : estimate.status === "draft" && context.canEditRecords
        ? "Edit estimate"
        : "Open estimate";
  const workflowCheckpoint = getWorkflowCheckpoint({
    inspectionStatus: inspection?.status ?? null,
    estimateStatus: estimate?.status ?? null,
    invoiceBalanceDueCents: invoiceDetail?.totals.balanceDueCents ?? null,
    invoiceStatus: invoice?.status ?? null,
    photoCount
  });

  async function assertJobIsMutable() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const latestVisit = await getVisitById(actionContext.supabase, jobId);

    if (
      latestVisit.error ||
      !latestVisit.data ||
      latestVisit.data.companyId !== actionContext.companyId ||
      !latestVisit.data.isActive
    ) {
      throw new Error("Archived jobs cannot be modified.");
    }

    return actionContext;
  }

  async function assignTechnicianAction(formData: FormData) {
    "use server";

    const actionContext = await assertJobIsMutable();
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data || latestVisitResult.data.companyId !== actionContext.companyId) {
      redirect(buildFeedbackHref(pagePath, "assignment-failed", { returnLabel, returnScope, returnTo }));
    }

    const result = await assignVisitTechnician(actionContext.supabase, jobId, {
      assignedTechnicianUserId: getNullableString(formData, "assignedTechnicianUserId")
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "assignment-failed", { returnLabel, returnScope, returnTo }));
    }

    if (result.data) {
      await sendTechnicianJobPushNotification({
        companyId: actionContext.companyId,
        companyTimeZone: actionContext.company.timezone,
        nextJob: result.data,
        previousJob: latestVisitResult.data
      }).catch(() => undefined);
    }

    revalidatePath(pagePath);
    revalidatePath("/dashboard/visits");
    redirect(buildFeedbackHref(pagePath, "assignment-saved", { returnLabel, returnScope, returnTo }));
  }

  async function changeStatusAction(formData: FormData) {
    "use server";

    const actionContext = await assertJobIsMutable();
    const result = await changeVisitStatus(actionContext.supabase, jobId, {
      toStatus: getString(formData, "toStatus") as
        | "new"
        | "scheduled"
        | "dispatched"
        | "in_progress"
        | "completed"
        | "canceled",
      reason: getNullableString(formData, "reason")
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "status-failed", { returnLabel, returnScope, returnTo }));
    }

    revalidatePath(pagePath);
    revalidatePath("/dashboard/visits");
    redirect(buildFeedbackHref(pagePath, "status-saved", { returnLabel, returnScope, returnTo }));
  }

  async function createNoteAction(formData: FormData) {
    "use server";

    const actionContext = await assertJobIsMutable();
    const result = await createVisitNote(actionContext.supabase, {
      jobId,
      companyId: actionContext.companyId,
      authorUserId: actionContext.currentUserId,
      body: getString(formData, "body"),
      isInternal: formData.get("isInternal") === "on"
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "note-save-failed", { returnLabel, returnScope, returnTo }));
    }

    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "note-saved", { returnLabel, returnScope, returnTo }));
  }

  async function updateNoteAction(formData: FormData) {
    "use server";

    const actionContext = await assertJobIsMutable();
    const noteId = getString(formData, "noteId");
    const result = await updateVisitNote(actionContext.supabase, noteId, {
      body: getString(formData, "body"),
      isInternal: formData.get("isInternal") === "on"
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "note-save-failed", { returnLabel, returnScope, returnTo }));
    }

    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "note-saved", { returnLabel, returnScope, returnTo }));
  }

  async function deleteNoteAction(formData: FormData) {
    "use server";

    const actionContext = await assertJobIsMutable();
    const noteId = getString(formData, "noteId");
    const result = await deleteVisitNote(actionContext.supabase, noteId);

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "note-delete-failed", { returnLabel, returnScope, returnTo }));
    }

    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "note-deleted", { returnLabel, returnScope, returnTo }));
  }

  async function archiveJobAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await archiveVisit(actionContext.supabase, jobId);

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "archive-failed", { returnLabel, returnScope, returnTo }));
    }

    revalidatePath(pagePath);
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard");
    redirect(buildFeedbackHref(pagePath, "archive-saved", { returnLabel, returnScope, returnTo }));
  }

  async function sendAppointmentConfirmationAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data) {
      redirect(buildFeedbackHref(pagePath, "appointment-queue-failed", { returnLabel, returnScope, returnTo }));
    }

    const preview = await getTechnicianProfilePreview(
      actionContext.supabase,
      latestVisitResult.data.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureVisitAccessLink({
          jobId,
          actorUserId: actionContext.currentUserId
        })
      : null;
    const result = await enqueueVisitAppointmentConfirmation(actionContext.supabase, {
      jobId,
      actorUserId: actionContext.currentUserId,
      visitUrl: visitLink?.publicUrl ?? null,
      resend: true
    });

    if (result.error || !result.data) {
      redirect(buildFeedbackHref(pagePath, "appointment-queue-failed", { returnLabel, returnScope, returnTo }));
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

    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "appointment-queued", { returnLabel, returnScope, returnTo }));
  }

  async function sendDispatchUpdateAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (latestVisitResult.error || !latestVisitResult.data) {
      redirect(buildFeedbackHref(pagePath, "dispatch-update-failed", { returnLabel, returnScope, returnTo }));
    }

    const preview = await getTechnicianProfilePreview(
      actionContext.supabase,
      latestVisitResult.data.assignedTechnicianUserId
    );
    const visitLink = preview.isReady
      ? await ensureVisitAccessLink({
          jobId,
          actorUserId: actionContext.currentUserId
        })
      : null;
    const result = await enqueueVisitDispatchUpdate(actionContext.supabase, {
      jobId,
      actorUserId: actionContext.currentUserId,
      resend: true,
      visitUrl: visitLink?.publicUrl ?? null,
      updateType: getString(formData, "updateType") as "dispatched" | "en_route"
    });

    if (result.error || !result.data) {
      redirect(buildFeedbackHref(pagePath, "dispatch-update-failed", { returnLabel, returnScope, returnTo }));
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

    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "dispatch-update-queued", { returnLabel, returnScope, returnTo }));
  }

  return (
    <Page layout="command">
      <PageHeader
        actions={
          <div className="ui-toolbar__group">
            <Link className={buttonClassName()} href={visitThreadHref}>
              Open in visits
            </Link>
            <Link className={buttonClassName({ tone: "secondary" })} href={buildVisitPartsHref(jobId, { returnLabel, returnScope, returnTo })}>
              Source parts
            </Link>
            <Link className={buttonClassName({ tone: "secondary" })} href={buildVisitInventoryHref(jobId, { returnLabel, returnScope, returnTo })}>
              Inventory
            </Link>
            {canMutateJob ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={buildVisitEditHref(jobId, { returnLabel, returnScope, returnTo })}>
                Edit visit
              </Link>
            ) : null}
            <Link className={buttonClassName({ tone: "tertiary" })} href={queueThreadHref}>
              {queueThreadLabel}
            </Link>
          </div>
        }
        description={
          <>
            Deep record for{" "}
            <Link href={`/dashboard/customers/${customerResult.data.id}`}>
              {customerResult.data.firstName} {customerResult.data.lastName}
            </Link>{" "}
            and{" "}
            <Link
              href={buildCustomerVehicleHref(
                customerResult.data.id,
                vehicleResult.data.id
              )}
            >
              {vehicleResult.data.year ? `${vehicleResult.data.year} ` : ""}
              {vehicleResult.data.make} {vehicleResult.data.model}
            </Link>
            . Use the queue for routine movement and this page for full history, edge cases, and deeper edits.
          </>
        }
        eyebrow="Visit record"
        status={<StatusBadge status={job.status} />}
        title={job.title}
      />

      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.body}
        </Callout>
      ) : null}

      <PageGrid hasSidebar>
        <div className="ui-card-list">
          <Card tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Overview</CardEyebrow>
                <CardTitle>Visit record</CardTitle>
                <CardDescription>Core customer and internal context for the visit itself.</CardDescription>
              </CardHeaderContent>
              <div className="ui-inline-meta">
                <PriorityBadge value={job.priority} />
                <Badge tone="brand">{formatDesignLabel(job.source)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="ui-action-grid">
              <div className="ui-detail-item">
                <p className="ui-detail-label">Customer concern</p>
                <p className="ui-detail-value">{job.customerConcern ?? "No concern recorded."}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Internal summary</p>
                <p className="ui-detail-value">{job.internalSummary ?? "No internal summary recorded."}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Description</p>
                <p className="ui-detail-value">{job.description ?? "No description recorded."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Exception communication</CardEyebrow>
                <CardTitle>Fallback customer updates</CardTitle>
                <CardDescription>Routine timing sends still belong in Visits and Dispatch. Use these buttons only when the selected visit needs a direct full-record recovery step.</CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-button-grid">
                {canSendAppointmentConfirmation ? (
                  <form action={sendAppointmentConfirmationAction}>
                    <SubmitButton pendingLabel="Queueing confirmation..." tone="secondary">
                      Send appointment confirmation
                    </SubmitButton>
                  </form>
                ) : null}

                {canSendDispatchUpdates ? (
                  <form action={sendDispatchUpdateAction}>
                    <input name="updateType" type="hidden" value="dispatched" />
                    <SubmitButton pendingLabel="Queueing update..." tone="secondary">
                      Send dispatched update
                    </SubmitButton>
                  </form>
                ) : null}

                {canSendDispatchUpdates ? (
                  <form action={sendDispatchUpdateAction}>
                    <input name="updateType" type="hidden" value="en_route" />
                    <SubmitButton pendingLabel="Queueing update..." tone="secondary">
                      Send en-route update
                    </SubmitButton>
                  </form>
                ) : null}
              </div>

              {!canSendAppointmentConfirmation && !canSendDispatchUpdates ? (
                <Callout tone="warning" title="Customer updates are not ready">
                  {!context.canEditRecords
                    ? "Archived visits do not allow new outbound customer updates."
                    : "Schedule the visit to send an appointment confirmation, and assign a technician before sending dispatch updates."}
                </Callout>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Record notes</CardEyebrow>
                <CardTitle>Full notes timeline</CardTitle>
                <CardDescription>Use this only when the queue rail is not enough and the visit needs deeper recordkeeping.</CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent className="ui-card-list">
              {canMutateJob ? (
                <div className="ui-callout">
                  <JobNoteForm action={createNoteAction} submitLabel="Add note" />
                </div>
              ) : null}

              {notes.length ? (
                <div className="ui-timeline">
                  {notes.map((note) => (
                    <article key={note.id} className="ui-timeline-item">
                      <div className="ui-timeline-meta">
                        <strong>{userNamesById.get(note.authorUserId) ?? "Unknown author"}</strong>
                        <span>{formatDateTime(note.createdAt, { timeZone: context.company.timezone })}</span>
                        <span>{note.isInternal ? "Internal" : "Shared"}</span>
                      </div>

                      {canMutateJob ? (
                        <div className="ui-action-grid">
                          <JobNoteForm
                            action={updateNoteAction}
                            hiddenFields={[{ name: "noteId", value: note.id }]}
                            initialValues={note}
                            submitLabel="Save note"
                          />
                          <form action={deleteNoteAction}>
                            <input name="noteId" type="hidden" value={note.id} />
                            <SubmitButton
                              confirmMessage="Delete this note from the visit timeline?"
                              pendingLabel="Deleting note..."
                              tone="secondary"
                            >
                              Delete note
                            </SubmitButton>
                          </form>
                        </div>
                      ) : (
                        <p className="ui-timeline-copy">{note.body}</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="No notes have been added yet."
                  eyebrow="Notes"
                  title="Nothing logged yet"
                />
              )}
            </CardContent>
          </Card>

          <CommunicationLogPanel
            eyebrow="History"
            emptyMessage="No customer communications have been logged for this visit yet."
            entries={communicationEntries}
            timeZone={context.company.timezone}
            title="Full communication history"
          />

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Meet Your Mechanic</CardEyebrow>
                <CardTitle>Customer-facing mechanic card</CardTitle>
                <CardDescription>
                  Review whether the assigned technician profile is ready before sending updates.
                </CardDescription>
              </CardHeaderContent>
              <Badge tone={technicianPreview.isReady ? "brand" : "warning"}>
                {technicianPreview.isReady ? "Ready" : "Not ready"}
              </Badge>
            </CardHeader>
            <CardContent className="ui-action-grid">
              {!job.assignedTechnicianUserId ? (
                <p className="ui-detail-value">
                  Assign a technician before sharing a mechanic card with the customer.
                </p>
              ) : !technicianPreview.isReady ? (
                <p className="ui-detail-value">
                  The assigned technician still needs {technicianPreview.missingFields.join(", ")} before appointment and dispatch messages can include the mechanic card.
                </p>
              ) : (
                <>
                  <div className="ui-detail-grid">
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Assigned mechanic</p>
                      <p className="ui-detail-value">
                        {technicianPreview.profile?.fullName ?? technicianPreview.technicianName}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Experience</p>
                      <p className="ui-detail-value">
                        {technicianPreview.profile?.yearsExperience !== null &&
                        technicianPreview.profile?.yearsExperience !== undefined
                          ? `${technicianPreview.profile.yearsExperience} year${technicianPreview.profile.yearsExperience === 1 ? "" : "s"}`
                          : "Not shared"}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Certifications</p>
                      <p className="ui-detail-value">
                        {technicianPreview.profile?.certifications.length
                          ? technicianPreview.profile.certifications.join(", ")
                          : "Not shared"}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Bio</p>
                      <p className="ui-detail-value">
                        {technicianPreview.profile?.bio ?? "No bio shared yet."}
                      </p>
                    </div>
                  </div>

                  <p className="ui-section-copy">
                    {jobVisitLinkSummary
                      ? "Current customer link is ready. Open it to verify the exact public mechanic card before sending updates."
                      : "A tokenized customer link will be generated automatically the next time you send an appointment or dispatch update."}
                  </p>

                  {jobVisitLinkSummary ? (
                    <div className="ui-button-grid">
                      <a
                        className={buttonClassName({ tone: "secondary" })}
                        href={jobVisitLinkSummary.publicUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open customer visit link
                      </a>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>History</CardEyebrow>
                <CardTitle>Full status history</CardTitle>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              {statusHistory.length ? (
                <div className="ui-timeline">
                  {statusHistory.map((entry) => (
                    <article key={entry.id} className="ui-timeline-item">
                      <div className="ui-timeline-meta">
                        <StatusBadge status={entry.toStatus} />
                        <span>{formatDateTime(entry.createdAt, { timeZone: context.company.timezone })}</span>
                        <span>{userNamesById.get(entry.changedByUserId) ?? "Unknown user"}</span>
                      </div>
                      <p className="ui-timeline-copy">
                        {entry.fromStatus
                          ? `Changed from ${formatDesignLabel(entry.fromStatus)} to ${formatDesignLabel(entry.toStatus)}.`
                          : `Created in ${formatDesignLabel(entry.toStatus)} status.`}
                      </p>
                      {entry.reason ? <p className="ui-section-copy">{entry.reason}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="No status changes logged yet."
                  eyebrow="History"
                  title="No status history"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="ui-sidebar-stack ui-sticky">
          <Card tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>At a glance</CardEyebrow>
                <CardTitle>Operational context</CardTitle>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-detail-grid">
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Customer</p>
                  <p className="ui-detail-value">
                    <Link href={`/dashboard/customers/${customerResult.data.id}`}>
                      {customerResult.data.firstName} {customerResult.data.lastName}
                    </Link>
                  </p>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Vehicle</p>
                  <p className="ui-detail-value">
                    <Link
                      href={buildCustomerVehicleHref(
                        customerResult.data.id,
                        vehicleResult.data.id
                      )}
                    >
                      {vehicleResult.data.year ? `${vehicleResult.data.year} ` : ""}
                      {vehicleResult.data.make} {vehicleResult.data.model}
                    </Link>
                  </p>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Scheduled start</p>
                  <p className="ui-detail-value">
                    {formatDateTime(job.scheduledStartAt, {
                      fallback: "Not scheduled",
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Scheduled end</p>
                  <p className="ui-detail-value">
                    {formatDateTime(job.scheduledEndAt, {
                      fallback: "Not scheduled",
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Arrival window</p>
                  <p className="ui-detail-value">
                    {job.arrivalWindowStartAt
                      ? formatDateRange(job.arrivalWindowStartAt, job.arrivalWindowEndAt, {
                          fallback: "Not set",
                          timeZone: context.company.timezone
                        })
                      : "Not set"}
                  </p>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Technician</p>
                  <p className="ui-detail-value">
                    {job.assignedTechnicianUserId
                      ? userNamesById.get(job.assignedTechnicianUserId) ?? "Assigned"
                      : "Unassigned"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Workflow</CardEyebrow>
                <CardTitle>Artifact readiness</CardTitle>
                <CardDescription>
                  Review linked artifacts before marking the visit complete or handing it back to the customer.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-detail-grid">
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Inspection</p>
                  <div className="ui-inline-meta">
                    {inspection ? (
                      <StatusBadge status={inspection.status} />
                    ) : (
                      <Badge tone="warning">Not started</Badge>
                    )}
                    <span className="ui-section-copy">
                      {inspection ? "Checklist exists for this visit." : "No inspection record yet."}
                    </span>
                  </div>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Estimate</p>
                  <div className="ui-inline-meta">
                    {estimate ? (
                      <StatusBadge status={estimate.status} />
                    ) : (
                      <Badge tone="neutral">Not created</Badge>
                    )}
                    <span className="ui-section-copy">
                      {estimate
                        ? `Estimate ${estimate.estimateNumber} is the current approval state.`
                        : "No estimate has been created for this visit."}
                    </span>
                  </div>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Invoice</p>
                  <div className="ui-inline-meta">
                    {invoice ? (
                      <StatusBadge status={invoice.status} />
                    ) : (
                      <Badge tone="neutral">Not created</Badge>
                    )}
                    <span className="ui-section-copy">
                      {invoice ? `Invoice ${invoice.invoiceNumber} is attached.` : "No invoice has been created yet."}
                    </span>
                  </div>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Payment</p>
                  <div className="ui-inline-meta">
                    {invoiceDetail ? (
                      invoiceDetail.totals.balanceDueCents > 0 ? (
                        <Badge tone="warning">
                          {formatCurrencyFromCents(invoiceDetail.totals.balanceDueCents)} due
                        </Badge>
                      ) : (
                        <Badge tone="success">Paid</Badge>
                      )
                    ) : (
                      <Badge tone="neutral">Waiting on invoice</Badge>
                    )}
                    <span className="ui-section-copy">
                      {invoiceDetail
                        ? `${formatCurrencyFromCents(invoiceDetail.totals.amountPaidCents)} received so far.`
                        : "Payment collection starts once the invoice exists."}
                    </span>
                  </div>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Photos</p>
                  <div className="ui-inline-meta">
                    <Badge tone={photoCount ? "success" : "warning"}>
                      {photoCount ? `${photoCount} uploaded` : "No photos"}
                    </Badge>
                    <span className="ui-section-copy">
                      {photoCount
                        ? "Photos are attached to this visit record."
                        : "Capture supporting photos before the final handoff if needed."}
                    </span>
                  </div>
                </div>
                <div className="ui-detail-item">
                  <p className="ui-detail-label">Customer updates</p>
                  <div className="ui-inline-meta">
                    <Badge tone={customerUpdatesReady ? "success" : "warning"}>
                      {customerUpdatesReady ? "Ready" : "Needs setup"}
                    </Badge>
                    <span className="ui-section-copy">{customerUpdatesSummary}</span>
                  </div>
                </div>
              </div>

              <Callout tone={workflowCheckpoint.tone} title={workflowCheckpoint.title}>
                {workflowCheckpoint.body}
              </Callout>

              {workflowSnapshotUnavailable || workflowPaymentSummaryUnavailable ? (
                <Callout tone="warning" title="Workflow snapshot is partial">
                  Some linked artifact details could not be loaded for this checkpoint. Open the artifact pages directly before closing the visit.
                </Callout>
              ) : null}

              <div className="ui-action-grid">
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={buildVisitInspectionHref(jobId, { returnLabel, returnScope, returnTo })}
                >
                  Open inspection
                </Link>
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={estimateHref}
                  prefetch={!estimate && context.canEditRecords ? false : null}
                >
                  {estimateActionLabel}
                </Link>
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={buildVisitInvoiceHref(jobId, { returnLabel, returnScope, returnTo })}
                >
                  Open invoice
                </Link>
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={buildVisitPhotosHref(jobId, { returnLabel, returnScope, returnTo })}
                >
                  Open photos
                </Link>
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={buildVisitPartsHref(jobId, { returnLabel, returnScope, returnTo })}
                >
                  Open parts
                </Link>
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={buildVisitInventoryHref(jobId, { returnLabel, returnScope, returnTo })}
                >
                  Open inventory
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Record-only controls</CardEyebrow>
                <CardTitle>Deep-record workflow controls</CardTitle>
                <CardDescription>
                  Use these only when the queue rail is not enough and you need archive-level control.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-card-list">
                <div>
                  <p className="ui-detail-label">Record assignment</p>
                  {canMutateJob ? (
                    <Form action={assignTechnicianAction}>
                      <FormField label="Assigned technician">
                        <Select defaultValue={job.assignedTechnicianUserId ?? ""} name="assignedTechnicianUserId">
                          <option value="">Unassigned</option>
                          {assignmentOptions.map((technician) => (
                            <option key={technician.userId} value={technician.userId}>
                              {technician.displayName}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <SubmitButton pendingLabel="Saving assignment...">Save assignment</SubmitButton>
                    </Form>
                  ) : (
                    <p className="ui-detail-value">
                      {job.assignedTechnicianUserId
                        ? userNamesById.get(job.assignedTechnicianUserId) ?? "Assigned technician"
                        : "No technician assigned."}
                    </p>
                  )}
                </div>

                <div>
                  <p className="ui-detail-label">Full status control</p>
                  <JobStatusForm
                    action={changeStatusAction}
                    allowedStatuses={allowedStatuses}
                    currentStatus={job.status}
                  />
                </div>

                {canMutateJob ? (
                  <div>
                    <p className="ui-detail-label">Archive lifecycle</p>
                    <form action={archiveJobAction}>
                      <SubmitButton
                        confirmMessage="Archive this visit and remove it from the active queue?"
                        pendingLabel="Archiving..."
                        tone="danger"
                      >
                        Archive visit
                      </SubmitButton>
                    </form>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageGrid>
    </Page>
  );
}

export default VisitDetailPageImpl;
