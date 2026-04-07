import { formatDateTime, isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
import {
  createAttachmentSignedUrl,
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  getVehicleById,
  listAddressesByCustomer,
  listAttachmentsByJob,
  listJobCommunications
} from "@mobile-mechanic/api-client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary
} from "../../../../../lib/jobs/operational-health";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveVisitRouteConfidenceSnapshot,
  hasServiceSitePlaybook
} from "../../../../../lib/service-thread/continuity";
import {
  buildVisitInspectionHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref
} from "../../../../../lib/visits/workspace";

type JobPhotosPageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function VisitPhotosPageImpl({ params, searchParams }: JobPhotosPageProps) {
  const context = await requireCompanyContext();
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel).trim();
  const returnScope = getSearchParam(resolvedSearchParams.returnScope).trim();
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const fieldEvidenceHref = `${buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)}#visit-field-evidence`;
  const [jobResult, attachmentsResult] = await Promise.all([
    getJobById(context.supabase, jobId),
    listAttachmentsByJob(context.supabase, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (attachmentsResult.error) {
    throw attachmentsResult.error;
  }

  const [customerResult, vehicleResult, estimateResult, invoiceResult, communicationsResult, serviceSitesResult] = await Promise.all([
    getCustomerById(context.supabase, jobResult.data.customerId),
    getVehicleById(context.supabase, jobResult.data.vehicleId),
    getEstimateByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    listJobCommunications(context.supabase, jobId, { limit: 10 }),
    listAddressesByCustomer(context.supabase, jobResult.data.customerId)
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  if (invoiceResult.error) {
    throw invoiceResult.error;
  }

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }

  if (serviceSitesResult.error) {
    throw serviceSitesResult.error;
  }

  const attachments = attachmentsResult.data ?? [];
  const customer = customerResult.data;
  const job = jobResult.data;
  const serviceSite =
    (serviceSitesResult.data ?? []).find((address) => address.id === job.serviceSiteId) ?? null;
  const continuityCommunications = (communicationsResult.data ?? []).map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const promiseSummary = getVisitPromiseSummary({
    communications: continuityCommunications,
    job
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimateResult.data?.status ?? null,
    hasBlockingIssues: false,
    hasOwner: Boolean(job.assignedTechnicianUserId),
    hasPromise: Boolean(job.arrivalWindowStartAt ?? job.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: job.status
  });
  const trustSummary = getVisitTrustSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job
  });
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk: false,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk: false,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: job.status
  });
  const serviceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount: job.status === "scheduled" || isTechnicianActiveFieldJobStatus(job.status) ? 1 : 0,
    commercialAccountMode: customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: 1,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const customerThreadHref = buildCustomerWorkspaceHref(customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });
  const signedUrls = await Promise.all(
    attachments.map(async (attachment) => {
      const signedUrlResult = await createAttachmentSignedUrl(context.supabase, attachment);

      return {
        attachmentId: attachment.id,
        signedUrl: signedUrlResult.data?.signedUrl ?? null
      };
    })
  );
  const signedUrlById = new Map(signedUrls.map((entry) => [entry.attachmentId, entry.signedUrl]));

  return (
    <section className="workspace-section">
      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <div>
            <p className="eyebrow">Field evidence</p>
            <h2 className="section-title">Photo stream</h2>
          </div>
          <div className="header-actions">
            <Link className="button secondary-button button-link" href={buildVisitInspectionHref(jobId, visitLinkOptions)}>
              Full inspection
            </Link>
            <Link className="button button-link" href={fieldEvidenceHref}>
              Return to field evidence
            </Link>
          </div>
        </div>
        <p className="copy" style={{ marginBottom: 0 }}>
          {customerResult.data.firstName} {customerResult.data.lastName} · {vehicleResult.data.year ? `${vehicleResult.data.year} ` : ""}
          {vehicleResult.data.make} {vehicleResult.data.model}
        </p>
      </div>

      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <div>
            <p className="eyebrow">Active service thread</p>
            <h2 className="section-title">Keep field evidence tied to the visit, customer, and site thread</h2>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <p className="detail-label">Promise confidence</p>
            <p className="detail-value">{promiseConfidence.label} · {promiseConfidence.confidencePercent}%</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">
              {releaseRunwayState.state !== "placed" ? "Release runway" : "Route confidence"}
            </p>
            <p className="detail-value">
              {releaseRunwayState.state !== "placed"
                ? releaseRunwayState.label
                : `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`}
            </p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Site thread</p>
            <p className="detail-value">{serviceSiteThreadSummary.siteLabel}</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Next thread move</p>
            <p className="detail-value">{trustSummary.nextActionLabel}</p>
          </div>
        </div>

        <p className="copy" style={{ marginBottom: 0 }}>
          {promiseConfidence.copy} {serviceSiteThreadSummary.copy}
        </p>

        <div className="header-actions">
          <Link className="button button-link" href={fieldEvidenceHref}>
            Open visit thread
          </Link>
          <Link className="button secondary-button button-link" href={customerThreadHref}>
            {customer.relationshipType === "fleet_account" ? "Open account thread" : "Open customer thread"}
          </Link>
          <Link className="button secondary-button button-link" href={siteThreadHref}>
            Open site thread
          </Link>
        </div>
      </div>

      {attachments.length ? (
        <div className="photo-gallery-grid">
          {attachments.map((attachment) => (
            <article key={attachment.id} className="photo-card">
              {signedUrlById.get(attachment.id) ? (
                <img
                  alt={attachment.caption ?? attachment.fileName}
                  className="photo-card-image"
                  src={signedUrlById.get(attachment.id) ?? undefined}
                />
              ) : (
                <div className="photo-card-image photo-card-placeholder">Preview unavailable</div>
              )}

              <div className="photo-card-body">
                <div className="badge">{attachment.category}</div>
                <h2 className="photo-card-title">{attachment.fileName}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {formatDateTime(attachment.createdAt, { timeZone: context.company.timezone })}
                </p>
                {attachment.caption ? (
                  <p className="detail-value" style={{ marginBottom: 0 }}>
                    {attachment.caption}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="eyebrow">No attachments</p>
          <h2 className="section-title">No visit photos uploaded yet</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            Technicians can upload camera or library images from the mobile photo gallery screen.
          </p>
        </div>
      )}
    </section>
  );
}

export default VisitPhotosPageImpl;

