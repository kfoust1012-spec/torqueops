import {
  getCustomerById,
  getEstimateByJobId,
  getInspectionByJobId,
  getInvoiceByJobId,
  getInvoiceDetailById,
  getJobById,
  listAddressesByCustomer,
  listAttachmentsByJob,
  listJobInventoryIssuesByJobId,
  listJobCommunications,
  listJobNotesByJob,
  listJobStatusHistory,
  listPartRequestsByJobId,
  listVehiclesByCustomer
} from "@mobile-mechanic/api-client";
import { NextResponse } from "next/server";

import {
  getEstimateAccessLinkSummary,
  getInvoiceAccessLinkSummary
} from "../../../../../../lib/customer-documents/service";
import { getDispatchTechnicianFitSignals } from "../../../../../../lib/dispatch/fit";
import { getVisitFollowUpSummary } from "../../../../../../lib/jobs/follow-up";
import {
  getVisitTrustSummary,
  getVisitPromiseSummary,
  getVisitReadinessSummary
} from "../../../../../../lib/jobs/operational-health";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveVisitRouteConfidenceSnapshot,
  hasServiceSitePlaybook
} from "../../../../../../lib/service-thread/continuity";
import { getVehicleServiceHistory } from "../../../../../../lib/service-history/service";
import { requireVisitsWorkboardApiContext } from "../../_shared";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<unknown> }
) {
  const { context, response } = await requireVisitsWorkboardApiContext();

  if (!context) {
    return response;
  }

  const { jobId } = (await params) as { jobId: string };
  const jobResult = await getJobById(context.supabase, jobId);

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  if (jobResult.data.companyId !== context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [customerResult, addressesResult, vehiclesResult, estimateResult, invoiceResult, inspectionResult, attachmentsResult, notesResult, communicationsResult, statusHistoryResult, fitSignalsResult, vehicleHistoryResult, inventoryIssuesResult, partRequestsResult] =
    await Promise.all([
      getCustomerById(context.supabase, jobResult.data.customerId),
      listAddressesByCustomer(context.supabase, jobResult.data.customerId),
      listVehiclesByCustomer(context.supabase, jobResult.data.customerId),
      getEstimateByJobId(context.supabase, jobId),
      getInvoiceByJobId(context.supabase, jobId),
      getInspectionByJobId(context.supabase, jobId),
      listAttachmentsByJob(context.supabase, jobId),
      listJobNotesByJob(context.supabase, jobId),
      listJobCommunications(context.supabase, jobId, { limit: 5 }),
      listJobStatusHistory(context.supabase, jobId),
      getDispatchTechnicianFitSignals({
        companyId: context.companyId,
        job: jobResult.data,
        supabase: context.supabase
      }).catch(() => []),
      getVehicleServiceHistory(
        context.supabase,
        context.companyId,
        jobResult.data.vehicleId,
        {}
      ).catch(() => null),
      listJobInventoryIssuesByJobId(context.supabase, jobId),
      listPartRequestsByJobId(context.supabase, jobId)
    ]);

  if (customerResult.error || !customerResult.data) {
    return NextResponse.json({ error: customerResult.error?.message ?? "Customer not found." }, { status: 400 });
  }

  if (addressesResult.error) {
    return NextResponse.json({ error: addressesResult.error.message }, { status: 400 });
  }

  if (vehiclesResult.error) {
    return NextResponse.json({ error: vehiclesResult.error.message }, { status: 400 });
  }

  if (estimateResult.error) {
    return NextResponse.json({ error: estimateResult.error.message }, { status: 400 });
  }

  if (invoiceResult.error) {
    return NextResponse.json({ error: invoiceResult.error.message }, { status: 400 });
  }

  if (inspectionResult.error) {
    return NextResponse.json({ error: inspectionResult.error.message }, { status: 400 });
  }

  if (attachmentsResult.error) {
    return NextResponse.json({ error: attachmentsResult.error.message }, { status: 400 });
  }

  if (notesResult.error) {
    return NextResponse.json({ error: notesResult.error.message }, { status: 400 });
  }

  if (communicationsResult.error) {
    return NextResponse.json({ error: communicationsResult.error.message }, { status: 400 });
  }

  if (statusHistoryResult.error) {
    return NextResponse.json({ error: statusHistoryResult.error.message }, { status: 400 });
  }

  if (inventoryIssuesResult.error) {
    return NextResponse.json({ error: inventoryIssuesResult.error.message }, { status: 400 });
  }

  if (partRequestsResult.error) {
    return NextResponse.json({ error: partRequestsResult.error.message }, { status: 400 });
  }

  const invoiceDetailResult = invoiceResult.data
    ? await getInvoiceDetailById(context.supabase, invoiceResult.data.id)
    : null;

  if (invoiceDetailResult?.error) {
    return NextResponse.json({ error: invoiceDetailResult.error.message }, { status: 400 });
  }

  let estimateLinkSummary = null;
  let invoiceLinkSummary = null;

  try {
    if (estimateResult.data?.status === "sent") {
      estimateLinkSummary = await getEstimateAccessLinkSummary(estimateResult.data.id);
    }

    if (invoiceResult.data && ["issued", "partially_paid"].includes(invoiceResult.data.status)) {
      invoiceLinkSummary = await getInvoiceAccessLinkSummary(invoiceResult.data.id);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Customer link summary could not be loaded." },
      { status: 400 }
    );
  }

  const followUpSummary = getVisitFollowUpSummary({
    assignedTechnicianUserId: jobResult.data.assignedTechnicianUserId,
    communications: communicationsResult.data ?? [],
    createdAt: jobResult.data.createdAt,
    invoiceStarted: Boolean(invoiceResult.data),
    job: jobResult.data,
    notes: notesResult.data ?? [],
    promisedAt: jobResult.data.arrivalWindowStartAt ?? jobResult.data.scheduledStartAt ?? null,
    relatedVisits: vehicleHistoryResult?.visits ?? []
  });
  const addresses = addressesResult.data ?? [];
  const serviceSite =
    (jobResult.data?.serviceSiteId
      ? addresses.find((address) => address.id === jobResult.data?.serviceSiteId) ?? null
      : null) ??
    addresses.find((address) => address.isPrimary) ??
    addresses[0] ??
    null;
  const openPartRequestCount = partRequestsResult.data?.length ?? 0;
  const inventoryIssueCount = inventoryIssuesResult.data?.length ?? 0;
  const hasSupplyRisk = Boolean(openPartRequestCount || inventoryIssueCount);
  const promiseSummary = getVisitPromiseSummary({
    communications: communicationsResult.data ?? [],
    job: {
      arrivalWindowStartAt: jobResult.data.arrivalWindowStartAt,
      assignedTechnicianUserId: jobResult.data.assignedTechnicianUserId,
      scheduledStartAt: jobResult.data.scheduledStartAt,
      status: jobResult.data.status
    }
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: communicationsResult.data ?? [],
    estimate: estimateResult.data,
    inspectionStatus: inspectionResult.data?.status ?? null,
    inventoryIssueCount,
    invoice: invoiceResult.data,
    job: {
      arrivalWindowStartAt: jobResult.data.arrivalWindowStartAt,
      assignedTechnicianUserId: jobResult.data.assignedTechnicianUserId,
      scheduledStartAt: jobResult.data.scheduledStartAt,
      status: jobResult.data.status
    },
    noteCount: notesResult.data?.length ?? 0,
    openPartRequestCount,
    photoCount: attachmentsResult.data?.length ?? 0
  });
  const trustSummary = getVisitTrustSummary({
    communications: communicationsResult.data ?? [],
    estimate: estimateResult.data,
    followUpActive: followUpSummary.hasChainContext,
    invoice: invoiceResult.data
      ? {
          balanceDueCents:
            invoiceDetailResult?.data?.totals.balanceDueCents ?? invoiceResult.data.balanceDueCents,
          status: invoiceResult.data.status
        }
      : null,
    job: {
      arrivalWindowStartAt: jobResult.data.arrivalWindowStartAt,
      assignedTechnicianUserId: jobResult.data.assignedTechnicianUserId,
      scheduledStartAt: jobResult.data.scheduledStartAt,
      status: jobResult.data.status
    }
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimateResult.data?.status,
    hasBlockingIssues: hasSupplyRisk,
    hasOwner: Boolean(jobResult.data.assignedTechnicianUserId),
    hasPromise: Boolean(jobResult.data.arrivalWindowStartAt ?? jobResult.data.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: jobResult.data.status
  });
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: jobResult.data.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: jobResult.data.status
  });
  const serviceSiteThread = buildServiceSiteThreadSummary({
    activeVisitCount: jobResult.data.status === "completed" || jobResult.data.status === "canceled" ? 0 : 1,
    commercialAccountMode:
      customerResult.data.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: vehiclesResult.data?.length ?? 0,
    linkedVisitCount: vehicleHistoryResult?.visits.length ?? 1,
    site: serviceSite
  });

  return NextResponse.json({
    ok: true,
    snapshot: {
      continuity: {
        promiseConfidence,
        releaseRunway: releaseRunwayState,
        routeConfidence,
        serviceSiteThread
      },
      promiseSummary,
      followUpSummary,
      readinessSummary,
      trustSummary,
      communicationCount: communicationsResult.data?.length ?? 0,
      estimate: estimateResult.data
        ? {
            estimateNumber: estimateResult.data.estimateNumber,
            status: estimateResult.data.status,
            totalCents: estimateResult.data.totalCents
          }
        : null,
      estimateLink: estimateLinkSummary
        ? {
            publicUrl: estimateLinkSummary.publicUrl,
            sentAt: estimateLinkSummary.sentAt,
            status: estimateLinkSummary.status
          }
        : null,
      inspectionStatus: inspectionResult.data?.status ?? null,
      invoice: invoiceResult.data
        ? {
            balanceDueCents:
              invoiceDetailResult?.data?.totals.balanceDueCents ?? invoiceResult.data.balanceDueCents,
            dueAt: invoiceResult.data.dueAt ?? null,
            invoiceNumber: invoiceResult.data.invoiceNumber,
            status: invoiceResult.data.status,
            totalCents: invoiceResult.data.totalCents
          }
        : null,
      invoiceLink: invoiceLinkSummary
        ? {
            publicUrl: invoiceLinkSummary.publicUrl,
            sentAt: invoiceLinkSummary.sentAt,
            status: invoiceLinkSummary.status
          }
        : null,
      lastCommunicationType: communicationsResult.data?.[0]?.communicationType ?? null,
      latestCommunications: (communicationsResult.data ?? []).slice(0, 3).map((entry) => ({
        channel: entry.channel,
        communicationType: entry.communicationType,
        createdAt: entry.createdAt,
        id: entry.id,
        recipientEmail: entry.recipientEmail,
        recipientName: entry.recipientName,
        recipientPhone: entry.recipientPhone,
        status: entry.status
      })),
      latestStatusHistory: (statusHistoryResult.data ?? []).slice(0, 3).map((entry) => ({
        createdAt: entry.createdAt,
        fromStatus: entry.fromStatus,
        id: entry.id,
        reason: entry.reason,
        toStatus: entry.toStatus
      })),
      latestNotes: (notesResult.data ?? []).slice(0, 3).map((note) => ({
        body: note.body,
        createdAt: note.createdAt,
        id: note.id,
        isInternal: note.isInternal
      })),
      fitRecommendations: fitSignalsResult,
      noteCount: notesResult.data?.length ?? 0,
      photoCount: attachmentsResult.data?.length ?? 0
    }
  });
}
