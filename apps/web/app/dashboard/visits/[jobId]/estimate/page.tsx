import {
  getCustomerById,
  enqueueEstimateNotification,
  createEstimateSignatureSignedUrl,
  getEstimateByJobId as getEstimateByVisitId,
  getEstimateDetailById,
  getInvoiceByJobId,
  getJobById as getVisitById,
  listAddressesByCustomer,
  listJobCommunications as listVisitCommunications
} from "@mobile-mechanic/api-client";
import {
  formatDateTime,
  formatCurrencyFromCents,
  isTechnicianActiveFieldJobStatus,
  isTerminalEstimateStatus
} from "@mobile-mechanic/core";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireCompanyContext } from "../../../../../lib/company-context";
import { processCommunicationMutationResult } from "../../../../../lib/communications/actions";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import {
  ensureEstimateAccessLink,
  getEstimateAccessLinkSummary,
  markEstimateAccessLinkSent
} from "../../../../../lib/customer-documents/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import { readVehicleCarfaxSummaryForVehicle } from "../../../../../lib/carfax/service";
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
  buildVisitEstimateHref,
  buildVisitEstimateThreadHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitPartsHref
} from "../../../../../lib/visits/workspace";
import { VisitArtifactIntroCard } from "../_components/visit-artifact-intro-card";
import { VisitArtifactLineItemsCard } from "../_components/visit-artifact-line-items-card";
import { CommunicationLogPanel } from "../../../_components/communication-log-panel";
import { CopyPublicLinkButton } from "../../../_components/copy-public-link-button";
import { CarfaxSummaryCompactCard } from "../../../_components/carfax-summary-card";
import { EstimateTotalsCard } from "./_components/estimate-totals-card";

type JobEstimatePageProps = {
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

export async function VisitEstimatePageImpl({ params, searchParams }: JobEstimatePageProps) {
  const context = await requireCompanyContext();
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel).trim();
  const returnScope = getSearchParam(resolvedSearchParams.returnScope).trim();
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, {
        returnLabel,
        returnTo
      })
    : buildVisitEstimateThreadHref(jobId);
  const [jobResult, estimateResult] = await Promise.all([
    getVisitById(context.supabase, jobId),
    getEstimateByVisitId(context.supabase, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  if (!estimateResult.data) {
    if (context.canEditRecords) {
      redirect(
        buildVisitEstimateHref(jobId, {
          autostart: true,
          returnLabel,
          returnScope,
          returnTo,
          workspace: true
        })
      );
    }

    return (
      <section className="workspace-section">
        <VisitArtifactIntroCard
          className="panel-subsection"
          eyebrow="Estimate"
          title="No estimate created"
          description="This visit does not have an estimate yet."
          actions={
            <>
              <Link className="button button-link" href={visitThreadHref}>
                Open visit thread
              </Link>
              <Link
                className="button secondary-button button-link"
                href={buildVisitPartsHref(jobId, { returnLabel, returnScope, returnTo })}
              >
                Source parts
              </Link>
            </>
          }
        />

        <div className="empty-state">
          <p className="copy" style={{ marginBottom: 0 }}>
            Office staff can create the first estimate for this visit from the estimate thread.
          </p>
        </div>
      </section>
    );
  }

  const detailResult = await getEstimateDetailById(context.supabase, estimateResult.data.id);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Estimate detail could not be loaded.");
  }

  const detail = detailResult.data;
  const estimate = detail.estimate;
  const carfaxSummary = await readVehicleCarfaxSummaryForVehicle(context.supabase, detail.vehicle);
  const [communicationsResult, invoiceResult, customerResult, serviceSitesResult] = await Promise.all([
    listVisitCommunications(context.supabase, jobId, {
      communicationType: "estimate_notification",
      limit: 5
    }),
    getInvoiceByJobId(context.supabase, jobId),
    getCustomerById(context.supabase, detail.job.customerId),
    listAddressesByCustomer(context.supabase, detail.job.customerId)
  ]);

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }
  if (invoiceResult.error) {
    throw invoiceResult.error;
  }
  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer detail could not be loaded.");
  }
  if (serviceSitesResult.error) {
    throw serviceSitesResult.error;
  }

  const communicationEntries = communicationsResult.data ?? [];
  const customer = customerResult.data;
  const serviceSite =
    (serviceSitesResult.data ?? []).find((address) => address.id === detail.job.serviceSiteId) ?? null;
  const continuityCommunications = communicationEntries.map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const promiseSummary = getVisitPromiseSummary({
    communications: continuityCommunications,
    job: detail.job
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: continuityCommunications,
    estimate,
    invoice: invoiceResult.data,
    job: detail.job
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimate.status,
    hasBlockingIssues: false,
    hasOwner: Boolean(detail.job.assignedTechnicianUserId),
    hasPromise: Boolean(detail.job.arrivalWindowStartAt ?? detail.job.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: detail.job.status
  });
  const trustSummary = getVisitTrustSummary({
    communications: continuityCommunications,
    estimate,
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
    linkedAssetCount: detail.vehicle ? 1 : 0,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const customerThreadHref = buildCustomerWorkspaceHref(customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });
  const signatureSignedUrlResult = detail.signature
    ? await createEstimateSignatureSignedUrl(context.supabase, detail.signature)
    : { data: null, error: null };

  if (signatureSignedUrlResult.error) {
    throw signatureSignedUrlResult.error;
  }

  const signatureSignedUrl = signatureSignedUrlResult.data?.signedUrl ?? null;
  const customerLinkSummary = context.canEditRecords && estimate.status === "sent"
    ? await getEstimateAccessLinkSummary(estimate.id)
    : null;
  const pagePath = `/dashboard/visits/${jobId}/estimate`;

  async function issueEstimateLinkAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await ensureEstimateAccessLink({
      estimateId: estimate.id,
      actorUserId: actionContext.currentUserId
    });

    revalidatePath(pagePath);
    redirect(pagePath);
  }

  async function sendEstimateNotificationAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const linkSummary = await ensureEstimateAccessLink({
      estimateId: estimate.id,
      actorUserId: actionContext.currentUserId,
      rotate: true
    });
    const result = await enqueueEstimateNotification(actionContext.supabase, {
      estimateId: estimate.id,
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      resend: true
    });

    await processCommunicationMutationResult(result, "Failed to queue estimate notification.");
    await markEstimateAccessLinkSent(linkSummary.linkId, result.data?.id ?? null, actionContext.currentUserId);

    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(pagePath);
    redirect(pagePath);
  }

  return (
    <section className="workspace-section">
      <VisitArtifactIntroCard
        className="panel-subsection"
        eyebrow="Estimate"
        title={estimate.title}
        description={
          <>
            Estimate <strong>{estimate.estimateNumber}</strong> for this visit.
          </>
        }
        headerMeta={<span className="badge">{estimate.status}</span>}
        actions={
          <>
            <Link className="button secondary-button button-link" href={visitThreadHref}>
              Open visit thread
            </Link>
            {context.canEditRecords && !isTerminalEstimateStatus(estimate.status) && estimate.status === "draft" ? (
              <Link
                className="button button-link"
                href={buildVisitEstimateHref(jobId, {
                  returnLabel,
                  returnScope,
                  returnTo,
                  workspace: true
                })}
              >
                Open estimate thread
              </Link>
            ) : null}
          </>
        }
      />

      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <div>
            <p className="eyebrow">Active service thread</p>
            <h2 className="section-title">Keep estimate, release, and site continuity on this visit</h2>
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
          <Link className="button button-link" href={visitThreadHref}>
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

      <div className="card-grid">
        <div className="workspace-card panel-subsection">
          <div className="section-header">
            <h2 className="section-title">Estimate summary</h2>
            <span className="badge">{estimate.status}</span>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <p className="detail-label">Estimate number</p>
              <p className="detail-value">{estimate.estimateNumber}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Tax rate</p>
              <p className="detail-value">{estimate.taxRateBasisPoints / 100}%</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Created</p>
              <p className="detail-value">{formatDateTime(estimate.createdAt, { timeZone: context.company.timezone })}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Updated</p>
              <p className="detail-value">{formatDateTime(estimate.updatedAt, { timeZone: context.company.timezone })}</p>
            </div>
          </div>

          <div className="detail-item">
            <p className="detail-label">Notes</p>
            <p className="detail-value">{estimate.notes ?? "No estimate notes."}</p>
          </div>

          <div className="detail-item">
            <p className="detail-label">Terms</p>
            <p className="detail-value">{estimate.terms ?? "No estimate terms."}</p>
          </div>
        </div>

        <EstimateTotalsCard estimate={estimate} totals={detail.totals} />
      </div>

      {carfaxSummary?.status === "ready" ? <CarfaxSummaryCompactCard summary={carfaxSummary} /> : null}

      {context.canEditRecords && estimate.status === "sent" ? (
        <div className="workspace-card panel-subsection">
          <div className="section-header">
            <h2 className="section-title">Customer link</h2>
            <span className="badge">{customerLinkSummary?.status ?? "Not issued"}</span>
          </div>

          {customerLinkSummary ? (
            <>
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Sent</p>
                  <p className="detail-value">
                    {formatDateTime(customerLinkSummary.sentAt, {
                      fallback: "Not sent",
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">First viewed</p>
                  <p className="detail-value">
                    {formatDateTime(customerLinkSummary.firstViewedAt, {
                      fallback: "Not viewed",
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Last viewed</p>
                  <p className="detail-value">
                    {formatDateTime(customerLinkSummary.lastViewedAt, {
                      fallback: "Not viewed",
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Views</p>
                  <p className="detail-value">{customerLinkSummary.viewCount}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Expires</p>
                  <p className="detail-value">
                    {formatDateTime(customerLinkSummary.expiresAt, {
                      timeZone: context.company.timezone
                    })}
                  </p>
                </div>
              </div>

              <label className="label">
                Public customer link
                <input className="input" readOnly type="text" value={customerLinkSummary.publicUrl} />
              </label>

              {customerLinkSummary.status === "active" ? (
                <div className="header-actions">
                  <a className="button secondary-button button-link" href={customerLinkSummary.publicUrl} rel="noreferrer" target="_blank">
                    Open link
                  </a>
                  <CopyPublicLinkButton linkId={customerLinkSummary.linkId} publicUrl={customerLinkSummary.publicUrl} />
                  <form action={sendEstimateNotificationAction}>
                    <button className="button" type="submit">
                      Resend estimate link
                    </button>
                  </form>
                </div>
              ) : (
                <div className="header-actions">
                  <form action={issueEstimateLinkAction}>
                    <button className="button" type="submit">
                      Issue fresh customer link
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="copy" style={{ marginBottom: 0 }}>
                No public customer link has been issued yet. Create one explicitly before copying or opening it.
              </p>

              <div className="header-actions">
                <form action={issueEstimateLinkAction}>
                  <button className="button" type="submit">
                    Issue customer link
                  </button>
                </form>
                <form action={sendEstimateNotificationAction}>
                  <button className="button secondary-button" type="submit">
                    Send estimate notification
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      ) : null}

      {estimate.status === "accepted" ? (
        <div className="workspace-card panel-subsection">
          <div className="section-header">
            <h2 className="section-title">Approval</h2>
            <span className="badge">Accepted</span>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <p className="detail-label">Approved by</p>
              <p className="detail-value">{estimate.approvedByName ?? "Unknown signer"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Approved at</p>
              <p className="detail-value">
                {formatDateTime(estimate.acceptedAt, {
                  fallback: "Pending",
                  timeZone: context.company.timezone
                })}
              </p>
            </div>
          </div>

          <div className="detail-item">
            <p className="detail-label">Approval statement</p>
            <p className="detail-value">{estimate.approvalStatement ?? "No approval statement."}</p>
          </div>

          {signatureSignedUrl ? (
            <div className="detail-item">
              <p className="detail-label">Customer signature</p>
              <img
                alt={`Signature for estimate ${estimate.estimateNumber}`}
                src={signatureSignedUrl}
                style={{
                  maxWidth: "100%",
                  width: 420,
                  borderRadius: 16,
                  border: "1px solid rgba(17, 24, 39, 0.12)",
                  background: "#ffffff",
                  padding: 12
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <VisitArtifactLineItemsCard
        className="panel-subsection"
        currencyCode={estimate.currencyCode}
        description="Keep labor, parts, and fees readable inside the visit workspace."
        emptyDescription="No estimate line items have been added yet."
        emptyEyebrow="Line items"
        emptyTitle="Nothing quoted yet"
        eyebrow="Estimate breakdown"
        items={detail.lineItems}
        title="Line items"
      />

      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <h2 className="section-title">Manual estimate entry</h2>
        </div>

        <p className="copy" style={{ marginBottom: 0 }}>
          This estimate uses manual line items only. Edit the estimate to add, update, or remove
          labor, part, and fee entries.
        </p>
        <p className="detail-value" style={{ margin: 0 }}>
          Current total: {formatCurrencyFromCents(estimate.totalCents, estimate.currencyCode)}
        </p>
      </div>

      <div className="workspace-card panel-subsection">
        <div className="section-header">
          <div>
            <p className="eyebrow">Customer communication</p>
            <h2 className="section-title">Estimate notification</h2>
          </div>
        </div>

        <p className="copy" style={{ marginBottom: 0 }}>
          Send or resend the estimate notification once the estimate is ready for the customer.
        </p>

        {context.canEditRecords && estimate.status !== "draft" ? (
          <form action={sendEstimateNotificationAction}>
            <button className="button" type="submit">
              Send estimate notification
            </button>
          </form>
        ) : null}
      </div>

      <CommunicationLogPanel
        eyebrow="History"
        emptyMessage="No estimate notifications have been logged yet."
        entries={communicationEntries}
        timeZone={context.company.timezone}
        title="Estimate communication log"
      />
    </section>
  );
}

export default VisitEstimatePageImpl;
