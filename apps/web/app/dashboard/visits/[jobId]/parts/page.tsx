import {
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  listAddressesByCustomer,
  listJobCommunications
} from "@mobile-mechanic/api-client";
import { formatCurrencyFromCents, isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Page,
  PageHeader,
  StatusBadge,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  getJobProcurementDetail,
  startPartRequestForJob,
  startPartRequestFromEstimate
} from "../../../../../lib/procurement/service";
import { getJobInventoryDetail } from "../../../../../lib/inventory/service";
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
  buildVisitDetailHref,
  buildVisitEstimateHref,
  buildVisitInventoryHref,
  buildVisitPartsHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitThreadHref
} from "../../../../../lib/visits/workspace";

type JobPartsPageProps = {
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

function buildSupplyRequestHref(
  requestId: string,
  options: {
    returnLabel?: string | null;
    returnTo?: string | null;
  }
) {
  const searchParams = new URLSearchParams();

  if (options.returnLabel?.trim()) {
    searchParams.set("returnLabel", options.returnLabel.trim());
  }

  const returnTo = normalizeVisitReturnTo(options.returnTo);
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }

  const search = searchParams.toString();
  const path = `/dashboard/supply/requests/${requestId}`;
  return search ? `${path}?${search}` : path;
}

export async function VisitPartsPageImpl({ params, searchParams }: JobPartsPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel).trim();
  const returnScope = getSearchParam(resolvedSearchParams.returnScope).trim();
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)
    : buildVisitThreadHref(jobId);
  const supplyRequestReturnHref = buildVisitPartsHref(jobId, visitLinkOptions);
  const [detail, estimateResult, invoiceResult, inventoryDetail] = await Promise.all([
    getJobProcurementDetail(context.supabase, jobId),
    getEstimateByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    getJobInventoryDetail(context.supabase, context.companyId, jobId)
  ]);

  if (estimateResult.error) {
    throw estimateResult.error;
  }
  if (invoiceResult.error) {
    throw invoiceResult.error;
  }

  if (!detail.job || detail.job.companyId !== context.companyId) {
    notFound();
  }

  const [customerResult, communicationsResult, serviceSitesResult] = await Promise.all([
    getCustomerById(context.supabase, detail.job.customerId),
    listJobCommunications(context.supabase, jobId, { limit: 10 }),
    listAddressesByCustomer(context.supabase, detail.job.customerId)
  ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer detail could not be loaded.");
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
  const hasSupplyRisk = detail.requests.length > 0;
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
    hasBlockingIssues: hasSupplyRisk,
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
    hasSupplyRisk,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: detail.job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
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

  async function startBlankRequestAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await startPartRequestForJob(actionContext.supabase, {
      companyId: actionContext.companyId,
      jobId,
      origin: "job_detail",
      requestedByUserId: actionContext.currentUserId
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Part request could not be started.");
    }

    revalidatePath(buildVisitDetailHref(jobId));
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(
      buildSupplyRequestHref(result.data.request.id, {
        returnLabel: "Back to visit parts",
        returnTo: supplyRequestReturnHref
      })
    );
  }

  async function startEstimateRequestAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentEstimate = await getEstimateByJobId(actionContext.supabase, jobId);

    if (currentEstimate.error || !currentEstimate.data) {
      throw currentEstimate.error ?? new Error("Estimate not available for parts sourcing.");
    }

    const result = await startPartRequestFromEstimate(actionContext.supabase, {
      companyId: actionContext.companyId,
      jobId,
      estimateId: currentEstimate.data.id,
      requestedByUserId: actionContext.currentUserId
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Estimate parts request could not be started.");
    }

    revalidatePath(buildVisitEstimateHref(jobId));
    revalidatePath(buildVisitEstimateHref(jobId, { workspace: true }));
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(
      buildSupplyRequestHref(result.data.request.id, {
        returnLabel: "Back to visit parts",
        returnTo: supplyRequestReturnHref
      })
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Visit parts"
        title={detail.job.title}
        description={
          <>
            Source, order, receive, install, and return parts for this visit without leaving the office dashboard.
          </>
        }
        actions={
          <>
            <form action={startBlankRequestAction}>
              <Button type="submit">Start blank request</Button>
            </form>
            {estimateResult.data ? (
              <form action={startEstimateRequestAction}>
                <Button tone="secondary" type="submit">
                  Source estimate parts
                </Button>
              </form>
            ) : null}
            <Link className={buttonClassName({ tone: "tertiary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
            <details className="procurement-thread-bar__utility">
              <summary className={buttonClassName({ tone: "tertiary" })}>More</summary>
              <div className="procurement-thread-bar__utility-menu">
                <Link className="button secondary-button button-link" href={buildVisitInventoryHref(jobId, visitLinkOptions)}>
                  Visit inventory
                </Link>
              </div>
            </details>
          </>
        }
        status={<Badge tone="brand">{detail.requests.length} request(s)</Badge>}
      />

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Active service thread</CardEyebrow>
            <CardTitle>Keep sourcing, release, and site continuity attached to this visit</CardTitle>
            <CardDescription>
              {promiseConfidence.copy} {serviceSiteThreadSummary.copy}
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
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
          <div className="ui-page-actions" style={{ marginTop: "1rem" }}>
            <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
              {customer.relationshipType === "fleet_account" ? "Open account thread" : "Open customer thread"}
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
              Open site thread
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Quoted Cost</CardEyebrow>
          <p className="ui-summary-value">{formatCurrencyFromCents(detail.jobPartsSummary.quotedCostCents)}</p>
          <p className="ui-summary-meta">Current sourcing snapshot for requested parts.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Estimated Cost</CardEyebrow>
          <p className="ui-summary-value">{formatCurrencyFromCents(detail.jobPartsSummary.estimatedCostCents)}</p>
          <p className="ui-summary-meta">Estimated cost write-back across linked estimate/invoice lines.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Actual Cost</CardEyebrow>
          <p className="ui-summary-value">{formatCurrencyFromCents(detail.jobPartsSummary.actualCostCents)}</p>
          <p className="ui-summary-meta">Based on received parts and supplier cost updates.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Gross Profit</CardEyebrow>
          <p className="ui-summary-value">{formatCurrencyFromCents(detail.jobPartsSummary.grossProfitCents)}</p>
          <p className="ui-summary-meta">Sell minus actual parts cost for linked estimate/invoice lines.</p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Inventory</CardEyebrow>
              <CardTitle>Stock coverage</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {inventoryDetail.summary.openReservationCount ? (
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">
                      {inventoryDetail.summary.openReservationCount} reservation(s)
                    </p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {inventoryDetail.summary.totalReservedQuantity} reserved for this visit
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Use the visit inventory view to manage stock holds against live procurement demand.
                    </p>
                  </div>
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={buildVisitInventoryHref(jobId, visitLinkOptions)}
                  >
                    Open inventory
                  </Link>
                </article>
              </div>
            ) : (
              <EmptyState
                eyebrow="No stock reserved"
                title="Inventory is not covering this visit yet"
                description="Open the visit inventory view if current stock should satisfy any part request lines."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Requests</CardEyebrow>
              <CardTitle>Sourcing requests</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.requests.length ? (
              <div className="ui-list">
                {detail.requests.map((request) => (
                  <article key={request.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{request.origin.replaceAll("_", " ")}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        Request {request.id.slice(0, 8).toUpperCase()}
                      </h3>
                    </div>
                    <div className="ui-page-actions">
                      <StatusBadge status={request.status} />
                      <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={`/dashboard/supply/requests/${request.id}`}>
                        Open
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No requests"
                title="This visit does not have parts sourcing yet"
                description="Start a blank request or seed parts directly from the estimate."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Fulfillment</CardEyebrow>
              <CardTitle>Carts and purchase orders</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.carts.length || detail.purchaseOrders.length ? (
              <div className="ui-list">
                {detail.carts.map((cart) => (
                  <article key={cart.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">Cart</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {cart.id.slice(0, 8).toUpperCase()}
                      </h3>
                    </div>
                    <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={`/dashboard/supply/carts/${cart.id}`}>
                      Open cart
                    </Link>
                  </article>
                ))}
                {detail.purchaseOrders.map((purchaseOrder) => (
                  <article key={purchaseOrder.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{purchaseOrder.poNumber}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {purchaseOrder.id.slice(0, 8).toUpperCase()}
                      </h3>
                    </div>
                    <div className="ui-page-actions">
                      <StatusBadge status={purchaseOrder.status} />
                      <Link
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={`/dashboard/supply/purchase-orders/${purchaseOrder.id}`}
                      >
                        Open PO
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No fulfillment records"
                title="No carts or purchase orders yet"
                description="Routing a request builds grouped carts, and converting a cart creates the PO lifecycle."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Estimate profitability</CardEyebrow>
              <CardTitle>Linked estimate context</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.estimatePartsSummary ? (
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">{detail.estimatePartsSummary.linkedLineCount} linked line(s)</p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      Estimate parts profitability
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Sell {formatCurrencyFromCents(detail.estimatePartsSummary.totalSellCents)} · estimated cost {formatCurrencyFromCents(detail.estimatePartsSummary.estimatedCostCents)} · actual cost {formatCurrencyFromCents(detail.estimatePartsSummary.actualCostCents)}
                    </p>
                  </div>
                </article>
              </div>
            ) : (
              <EmptyState
                eyebrow="No estimate linkage"
                title="No estimate line items are linked yet"
                description={estimateResult.data ? "Use Source estimate parts to seed part lines directly from the estimate editor." : "Create an estimate first if you want procurement costs to flow back into estimate profitability."}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Invoice profitability</CardEyebrow>
              <CardTitle>Linked invoice context</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.invoicePartsSummary ? (
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">{detail.invoicePartsSummary.linkedLineCount} linked line(s)</p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      Invoice parts profitability
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Sell {formatCurrencyFromCents(detail.invoicePartsSummary.totalSellCents)} · estimated cost {formatCurrencyFromCents(detail.invoicePartsSummary.estimatedCostCents)} · actual cost {formatCurrencyFromCents(detail.invoicePartsSummary.actualCostCents)}
                    </p>
                  </div>
                </article>
              </div>
            ) : (
              <EmptyState
                eyebrow="No invoice linkage"
                title="No invoice line items are linked yet"
                description={invoiceResult.data ? "Invoice parts profitability will populate automatically when linked request lines receive or return cost updates." : "Create an invoice from the accepted estimate to carry part-request profitability forward."}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

export default VisitPartsPageImpl;

