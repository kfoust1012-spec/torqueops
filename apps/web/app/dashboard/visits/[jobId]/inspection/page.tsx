import {
  getCustomerById,
  getEstimateByJobId,
  getInspectionByJobId,
  getInspectionDetailById,
  getInvoiceByJobId,
  listAddressesByCustomer,
  listJobCommunications
} from "@mobile-mechanic/api-client";
import { formatDateTime, isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
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
  buildVisitPhotosHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref
} from "../../../../../lib/visits/workspace";

type JobInspectionPageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

function formatInspectionStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatItemStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function VisitInspectionPageImpl({ params, searchParams }: JobInspectionPageProps) {
  const context = await requireCompanyContext();
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel).trim();
  const returnScope = getSearchParam(resolvedSearchParams.returnScope).trim();
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const fieldEvidenceHref = `${buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)}#visit-field-evidence`;
  const inspectionResult = await getInspectionByJobId(context.supabase, jobId);

  if (inspectionResult.error) {
    throw inspectionResult.error;
  }

  if (!inspectionResult.data) {
    return (
      <section className="workspace-section">
        <div className="workspace-card panel-subsection">
          <div className="section-header">
            <h2 className="section-title">Inspection thread</h2>
            <div className="header-actions">
              <Link className="button button-link" href={fieldEvidenceHref}>
                Return to field evidence
              </Link>
            </div>
          </div>
          <p className="eyebrow">Inspection</p>
          <h2 className="section-title">No inspection started</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            This visit does not have an inspection yet.
          </p>
        </div>
      </section>
    );
  }

  if (inspectionResult.data.companyId !== context.companyId) {
    notFound();
  }

  const detailResult = await getInspectionDetailById(context.supabase, inspectionResult.data.id);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Inspection detail could not be loaded.");
  }

  const detail = detailResult.data;
  const [customerResult, estimateResult, invoiceResult, communicationsResult, serviceSitesResult] = await Promise.all([
    getCustomerById(context.supabase, detail.job.customerId),
    getEstimateByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    listJobCommunications(context.supabase, jobId, { limit: 10 }),
    listAddressesByCustomer(context.supabase, detail.job.customerId)
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer detail could not be loaded.");
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

  const customer = customerResult.data;
  const serviceSite =
    (serviceSitesResult.data ?? []).find((address) => address.id === detail.job.serviceSiteId) ?? null;
  const continuityCommunications = (communicationsResult.data ?? []).map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const promiseSummary = getVisitPromiseSummary({
    communications: continuityCommunications,
    job: detail.job
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: detail.job
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimateResult.data?.status ?? null,
    hasBlockingIssues: false,
    hasOwner: Boolean(detail.job.assignedTechnicianUserId),
    hasPromise: Boolean(detail.job.arrivalWindowStartAt ?? detail.job.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: detail.job.status
  });
  const trustSummary = getVisitTrustSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: detail.job
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
    assignedTechnicianUserId: detail.job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk: false,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: detail.job.status
  });
  const serviceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount:
      detail.job.status === "scheduled" || isTechnicianActiveFieldJobStatus(detail.job.status) ? 1 : 0,
    commercialAccountMode: customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: detail.job.vehicleId ? 1 : 0,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const customerThreadHref = buildCustomerWorkspaceHref(customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });

  return (
    <section className="workspace-section">
      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <h2 className="section-title">Inspection summary</h2>
          <div className="header-actions">
            <span className="badge">{formatInspectionStatus(detail.inspection.status)}</span>
            <Link className="button secondary-button button-link" href={buildVisitPhotosHref(jobId, visitLinkOptions)}>
              Full photo stream
            </Link>
            <Link className="button button-link" href={fieldEvidenceHref}>
              Return to field evidence
            </Link>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <p className="detail-label">Template</p>
            <p className="detail-value">{detail.inspection.templateVersion}</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Started</p>
            <p className="detail-value">{formatDateTime(detail.inspection.startedAt, { timeZone: context.company.timezone })}</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Completed</p>
            <p className="detail-value">
              {detail.inspection.completedAt
                ? formatDateTime(detail.inspection.completedAt, { timeZone: context.company.timezone })
                : "Not completed"}
            </p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Visit</p>
            <p className="detail-value">
              {detail.job.title}
            </p>
          </div>
        </div>
      </div>

      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <div>
            <p className="eyebrow">Active service thread</p>
            <h2 className="section-title">Keep inspection, customer, and site continuity attached to this visit</h2>
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

      <div className="panel-subsection">
        {detail.sections.map((section) => (
          <div key={section.sectionKey} className="workspace-card panel-subsection">
            <div className="section-header">
              <h2 className="section-title">{section.title}</h2>
              <span className="badge">
                {section.items.filter((item) => item.status !== "not_checked").length}/
                {section.items.length} checked
              </span>
            </div>

            <div className="timeline-list">
              {section.items.map((item) => (
                <article key={item.id} className="timeline-item">
                  <div className="note-meta">
                    <strong>{item.label}</strong>
                    <span>{formatItemStatus(item.status)}</span>
                    <span>{item.findingSeverity ?? "No severity"}</span>
                  </div>

                  {item.technicianNotes ? (
                    <div className="detail-item">
                      <p className="detail-label">Technician notes</p>
                      <p className="detail-value">{item.technicianNotes}</p>
                    </div>
                  ) : null}

                  {item.recommendation ? (
                    <div className="detail-item">
                      <p className="detail-label">Recommendation</p>
                      <p className="detail-value">{item.recommendation}</p>
                    </div>
                  ) : null}

                  {!item.technicianNotes && !item.recommendation ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No additional inspection notes recorded.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default VisitInspectionPageImpl;

