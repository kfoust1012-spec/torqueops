import {
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  listAddressesByCustomer,
  listJobCommunications
} from "@mobile-mechanic/api-client";
import { isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
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
  Form,
  FormField,
  FormRow,
  Input,
  Page,
  Select,
  StatusBadge,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  releaseInventoryReservationById,
  reserveInventoryForPartRequestLine
} from "../../../../../lib/inventory/service";
import {
  consumeIssuedInventoryForJob,
  getJobInventoryOperationsDetail,
  issueInventoryToJob,
  returnUnusedInventoryFromJob
} from "../../../../../lib/inventory-operations/service";
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
  buildVisitInventoryHref,
  buildVisitPartsHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitThreadHref
} from "../../../../../lib/visits/workspace";

type JobInventoryPageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

type JobInventoryDetail = Awaited<ReturnType<typeof getJobInventoryOperationsDetail>>;
type JobInventoryIssueEntry = JobInventoryDetail["issues"][number];
type JobInventoryRequestLine = JobInventoryDetail["requestLines"][number];
type JobInventoryLocation = JobInventoryDetail["locations"][number];
type JobInventoryItem = JobInventoryDetail["inventoryItems"][number];
type JobInventoryBalance = JobInventoryDetail["balances"][number];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : 0;
}

function revalidateInventoryWorkspace() {
  revalidatePath("/dashboard/supply/inventory");
  revalidatePath("/dashboard/inventory");
}

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function VisitInventoryPageImpl({ params, searchParams }: JobInventoryPageProps) {
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
  const [jobResult, detail] = await Promise.all([
    getJobById(context.supabase, jobId),
    getJobInventoryOperationsDetail(context.supabase, context.companyId, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  const job = jobResult.data;
  const [customerResult, estimateResult, invoiceResult, communicationsResult, serviceSitesResult] = await Promise.all([
    getCustomerById(context.supabase, job.customerId),
    getEstimateByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    listJobCommunications(context.supabase, jobId, { limit: 10 }),
    listAddressesByCustomer(context.supabase, job.customerId)
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
    (serviceSitesResult.data ?? []).find((address) => address.id === job.serviceSiteId) ?? null;
  const hasSupplyRisk = detail.requestLines.some((line: JobInventoryRequestLine) => {
    const reservedQuantity = detail.summary.reservations
      .filter((entry) => entry.reservation.partRequestLineId === line.id)
      .reduce((total, entry) => total + entry.reservation.quantityReserved, 0);

    return reservedQuantity < line.quantity_requested;
  });
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
    hasBlockingIssues: hasSupplyRisk,
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
    hasSupplyRisk,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: job.status
  });
  const serviceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount: job.status === "scheduled" || isTechnicianActiveFieldJobStatus(job.status) ? 1 : 0,
    commercialAccountMode: customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: job.vehicleId ? 1 : 0,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const customerThreadHref = buildCustomerWorkspaceHref(customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });
  const activeInventoryItems = detail.inventoryItems.filter(
    (item: JobInventoryItem) => item.isActive && item.itemType === "stocked"
  );
  const activeLocations = detail.locations.filter((location: JobInventoryLocation) => location.isActive);

  async function reserveInventoryAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await reserveInventoryForPartRequestLine(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId: getString(formData, "inventoryItemId"),
      stockLocationId: getString(formData, "stockLocationId"),
      jobId,
      partRequestLineId: getNullableString(formData, "partRequestLineId"),
      quantityReserved: getNumber(formData, "quantityReserved"),
      notes: getNullableString(formData, "notes"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(buildVisitInventoryHref(jobId, visitLinkOptions));
  }

  async function releaseReservationAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await releaseInventoryReservationById(actionContext.supabase, {
      reservationId: getString(formData, "reservationId"),
      quantityReleased: getNumber(formData, "quantityReleased")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(buildVisitInventoryHref(jobId, visitLinkOptions));
  }

  async function issueInventoryAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await issueInventoryToJob(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryReservationId: getString(formData, "reservationId"),
      quantityIssued: getNumber(formData, "quantityIssued"),
      issuedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "issueNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(buildVisitInventoryHref(jobId, visitLinkOptions));
  }

  async function consumeIssueAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await consumeIssuedInventoryForJob(actionContext.supabase, {
      issueId: getString(formData, "issueId"),
      quantityConsumed: getNumber(formData, "quantityConsumed"),
      notes: getNullableString(formData, "consumeNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(buildVisitInventoryHref(jobId, visitLinkOptions));
  }

  async function returnIssueAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await returnUnusedInventoryFromJob(actionContext.supabase, {
      issueId: getString(formData, "issueId"),
      quantityReturned: getNumber(formData, "quantityReturned"),
      returnedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "returnIssueNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryWorkspace();
    revalidatePath(buildVisitPartsHref(jobId));
    revalidatePath(buildVisitInventoryHref(jobId));
    redirect(buildVisitInventoryHref(jobId, visitLinkOptions));
  }

  return (
    <Page>
      <Card tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Visit inventory</CardEyebrow>
            <CardTitle>{job.title}</CardTitle>
            <CardDescription>Review stock availability and reserve inventory for this visit's procurement demand.</CardDescription>
          </CardHeaderContent>
          <Badge tone="brand">{detail.summary.openReservationCount} open reservation(s)</Badge>
        </CardHeader>
        <CardContent>
          <div className="ui-page-actions">
            <Link className={buttonClassName({ tone: "secondary" })} href={buildVisitPartsHref(jobId, visitLinkOptions)}>
              Back to visit parts
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
            <details className="procurement-thread-bar__utility">
              <summary className={buttonClassName({ tone: "tertiary" })}>More</summary>
              <div className="procurement-thread-bar__utility-menu">
                <Link className="button secondary-button button-link" href="/dashboard/supply/inventory/lookup">
                  Stock lookup
                </Link>
              </div>
            </details>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Active service thread</CardEyebrow>
            <CardTitle>Keep stock decisions tied to the visit, customer, and site thread</CardTitle>
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
          <CardEyebrow>Open reservations</CardEyebrow>
          <p className="ui-summary-value">{detail.summary.openReservationCount}</p>
          <p className="ui-summary-meta">Current stock holds tied to this visit.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Total reserved</CardEyebrow>
          <p className="ui-summary-value">{detail.summary.totalReservedQuantity}</p>
          <p className="ui-summary-meta">Reserved quantity across all linked inventory records.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Issued</CardEyebrow>
          <p className="ui-summary-value">
            {detail.issues.reduce(
              (total: number, entry: JobInventoryIssueEntry) => total + entry.issue.quantityIssued,
              0
            )}
          </p>
          <p className="ui-summary-meta">Inventory already issued out to this visit.</p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Reservations</CardEyebrow>
              <CardTitle>Current visit stock holds</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.summary.reservations.length ? (
              <div className="ui-list">
                {detail.summary.reservations.map((entry) => {
                  const openQuantity = Math.max(
                    entry.reservation.quantityReserved -
                      entry.reservation.quantityReleased -
                      entry.reservation.quantityConsumed,
                    0
                  );

                  return (
                    <article key={entry.reservation.id} className="ui-list-item">
                      <div style={{ width: "100%" }}>
                        <p className="ui-card__eyebrow">{entry.location.name}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {entry.item.sku} · {entry.item.name}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Reserved {entry.reservation.quantityReserved} · open {openQuantity}
                          {entry.balance ? ` · available now ${entry.balance.availableQuantity}` : ""}
                        </p>
                        <Form action={releaseReservationAction}>
                          <input name="reservationId" type="hidden" value={entry.reservation.id} />
                          <FormRow>
                            <FormField label="Release qty">
                              <Input max={openQuantity} min="0.01" name="quantityReleased" step="0.01" type="number" />
                            </FormField>
                            <FormField label="Action">
                              <div className="ui-page-actions" style={{ minHeight: "44px", alignItems: "end" }}>
                                <Button tone="secondary" type="submit">
                                  Release reservation
                                </Button>
                              </div>
                            </FormField>
                          </FormRow>
                        </Form>
                        <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />
                        <Form action={issueInventoryAction}>
                          <input name="reservationId" type="hidden" value={entry.reservation.id} />
                          <FormRow>
                            <FormField label="Issue qty">
                              <Input max={openQuantity} min="0.01" name="quantityIssued" step="0.01" type="number" />
                            </FormField>
                            <FormField label="Notes">
                              <Input name="issueNotes" />
                            </FormField>
                          </FormRow>
                          <Button disabled={openQuantity <= 0} tone="secondary" type="submit">
                            {openQuantity > 0 ? "Issue to visit" : "No open quantity left"}
                          </Button>
                        </Form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No reservations"
                title="Nothing is reserved for this visit yet"
                description="Reserve stock from the request lines below once you know which item and location should cover the demand."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Request lines</CardEyebrow>
              <CardTitle>Reserve from inventory</CardTitle>
              <CardDescription>Reservations do not change on-hand quantity; they only hold stock against active demand.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.requestLines.length ? (
              <div className="ui-list">
                {detail.requestLines.map((line: JobInventoryRequestLine) => {
                  const canReserveLine =
                    line.requestStatus === "open" && line.remainingReservableQuantity > 0;
                  const linkedItem = line.inventory_item_id
                    ? detail.inventoryItems.find((item: JobInventoryItem) => item.id === line.inventory_item_id) ?? null
                    : null;
                  const linkedLocation =
                    line.activeReservationLocations.length === 1
                      ? line.activeReservationLocations[0]
                      : null;
                  const linkedBalance =
                    linkedItem && linkedLocation
                      ? detail.balances.find(
                          (balance: JobInventoryBalance) =>
                            balance.inventoryItemId === linkedItem.id &&
                            balance.stockLocationId === linkedLocation.id
                        ) ?? null
                      : null;

                  return (
                    <article key={line.id} className="ui-list-item">
                      <div style={{ width: "100%" }}>
                        <p className="ui-card__eyebrow">{line.part_number ?? line.supplier_sku ?? "No catalog reference"}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>{line.description}</h3>
                        <div className="ui-page-actions" style={{ marginBottom: "0.5rem" }}>
                          <StatusBadge
                            status={line.requestStatus}
                            fallbackTone={
                              line.requestStatus === "canceled"
                                ? "danger"
                                : line.requestStatus === "fulfilled"
                                  ? "success"
                                  : "info"
                            }
                          />
                        </div>
                        <p className="ui-card__description" style={{ marginBottom: "0.75rem" }}>
                          Requested {line.quantity_requested} · installed {line.quantity_installed} · reserved {line.openReservedQuantity} · consumed {line.quantity_consumed_from_stock} · returned to stock {line.quantity_returned_to_inventory} · remaining {line.remainingReservableQuantity}
                        </p>
                        {linkedItem ? (
                          <div className="ui-page-actions" style={{ marginBottom: "0.75rem" }}>
                            <StatusBadge
                              status={linkedItem.itemType}
                              fallbackTone={linkedItem.itemType === "stocked" ? "success" : "warning"}
                            />
                            <span className="ui-section-copy">
                              Linked to {linkedItem.sku}
                              {linkedLocation
                                ? ` at ${linkedLocation.name}`
                                : line.activeReservationLocations.length > 1
                                  ? ` across ${line.activeReservationLocations.length} reserved locations`
                                  : ""}
                              {linkedBalance ? ` · available ${linkedBalance.availableQuantity}` : ""}
                              {!linkedItem.isActive ? " · inactive item" : ""}
                              {linkedItem.itemType !== "stocked" ? " · non-stocked item" : ""}
                              {linkedLocation && !linkedLocation.isActive ? " · inactive location" : ""}
                            </span>
                          </div>
                        ) : (
                          <div className="ui-page-actions" style={{ marginBottom: "0.75rem" }}>
                            <StatusBadge status="not_found" fallbackTone="warning" />
                            <span className="ui-section-copy">
                              No inventory item is linked to this demand yet.
                            </span>
                          </div>
                        )}
                        <Form action={reserveInventoryAction}>
                          <input name="partRequestLineId" type="hidden" value={line.id} />
                          <FormRow>
                            <FormField label="Inventory item">
                              <Select
                                defaultValue={
                                  linkedItem?.isActive && linkedItem.itemType === "stocked"
                                    ? linkedItem.id
                                    : ""
                                }
                                disabled={!canReserveLine}
                                name="inventoryItemId"
                              >
                                <option value="">Select inventory item</option>
                                {linkedItem && (!linkedItem.isActive || linkedItem.itemType !== "stocked") ? (
                                  <option value={linkedItem.id}>
                                    {linkedItem.sku} · {linkedItem.name}
                                    {!linkedItem.isActive ? " (inactive)" : ""}
                                    {linkedItem.itemType !== "stocked" ? " (non-stocked)" : ""}
                                  </option>
                                ) : null}
                                {activeInventoryItems.map((item: JobInventoryItem) => (
                                  <option key={item.id} value={item.id}>
                                    {item.sku} · {item.name}
                                  </option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField label="Location">
                              <Select
                                defaultValue={linkedLocation?.id ?? ""}
                                disabled={!canReserveLine}
                                name="stockLocationId"
                              >
                                <option value="">Select location</option>
                                {linkedLocation && !linkedLocation.isActive ? (
                                  <option value={linkedLocation.id}>{linkedLocation.name} (inactive)</option>
                                ) : null}
                                {activeLocations.map((location: JobInventoryLocation) => (
                                  <option key={location.id} value={location.id}>
                                    {location.name}
                                  </option>
                                ))}
                              </Select>
                            </FormField>
                          </FormRow>
                          <FormRow>
                            <FormField label="Reserve qty">
                              <Input
                                disabled={!canReserveLine}
                                max={line.remainingReservableQuantity}
                                min="0.01"
                                name="quantityReserved"
                                step="0.01"
                                type="number"
                              />
                            </FormField>
                            <FormField label="Notes">
                              <Input disabled={!canReserveLine} name="notes" />
                            </FormField>
                          </FormRow>
                          {line.requestStatus !== "open" ? (
                            <p className="ui-field__hint">
                              Inventory reservations are disabled because this part request is {line.requestStatus}.
                            </p>
                          ) : null}
                          <div className="ui-page-actions">
                            <Button disabled={!canReserveLine} tone="secondary" type="submit">
                              {line.requestStatus !== "open"
                                ? "Request not open"
                                : line.remainingReservableQuantity > 0
                                  ? "Reserve stock"
                                  : "Request fully covered"}
                            </Button>
                            <Link
                              className={buttonClassName({ tone: "tertiary", size: "sm" })}
                              href={`/dashboard/supply/inventory/lookup?q=${encodeURIComponent(
                                line.part_number ?? line.description
                              )}`}
                            >
                              Find stock
                            </Link>
                          </div>
                        </Form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No procurement demand"
                title="There are no part request lines for this visit"
                description="Source parts first, then use inventory reservations if existing stock should cover the demand."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Issued inventory</CardEyebrow>
            <CardTitle>Consume or return unused parts</CardTitle>
            <CardDescription>Issued stock leaves inventory immediately; consume it when used or return what came back unused.</CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {detail.issues.length ? (
            <div className="ui-list">
              {detail.issues.map((entry: JobInventoryIssueEntry) => {
                const openQuantity = Math.max(
                  entry.issue.quantityIssued - entry.issue.quantityConsumed - entry.issue.quantityReturned,
                  0
                );

                return (
                  <article key={entry.issue.id} className="ui-list-item">
                    <div style={{ width: "100%" }}>
                      <div className="ui-page-actions" style={{ justifyContent: "space-between" }}>
                        <div>
                          <p className="ui-card__eyebrow">{entry.location?.name ?? "Unknown location"}</p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            {entry.item?.sku ?? "Unknown item"} · {entry.item?.name ?? "Missing item"}
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            Issued {entry.issue.quantityIssued} · consumed {entry.issue.quantityConsumed} · returned {entry.issue.quantityReturned} · open {openQuantity}
                          </p>
                        </div>
                        <StatusBadge status={entry.issue.status} />
                      </div>

                      <div className="ui-page-grid ui-page-grid--sidebar" style={{ marginTop: "1rem" }}>
                        <Card tone="subtle">
                          <CardHeader>
                            <CardHeaderContent>
                              <CardTitle style={{ fontSize: "1rem" }}>Consume</CardTitle>
                            </CardHeaderContent>
                          </CardHeader>
                          <CardContent>
                            <Form action={consumeIssueAction}>
                              <input name="issueId" type="hidden" value={entry.issue.id} />
                              <FormRow>
                                <FormField label="Qty consumed">
                                  <Input
                                    disabled={openQuantity <= 0}
                                    max={openQuantity}
                                    min="0.01"
                                    name="quantityConsumed"
                                    step="0.01"
                                    type="number"
                                  />
                                </FormField>
                                <FormField label="Notes">
                                  <Input disabled={openQuantity <= 0} name="consumeNotes" />
                                </FormField>
                              </FormRow>
                              <Button disabled={openQuantity <= 0} tone="secondary" type="submit">
                                Mark consumed
                              </Button>
                            </Form>
                          </CardContent>
                        </Card>

                        <Card tone="subtle">
                          <CardHeader>
                            <CardHeaderContent>
                              <CardTitle style={{ fontSize: "1rem" }}>Return unused</CardTitle>
                            </CardHeaderContent>
                          </CardHeader>
                          <CardContent>
                            <Form action={returnIssueAction}>
                              <input name="issueId" type="hidden" value={entry.issue.id} />
                              <FormRow>
                                <FormField label="Qty returned">
                                  <Input
                                    disabled={openQuantity <= 0}
                                    max={openQuantity}
                                    min="0.01"
                                    name="quantityReturned"
                                    step="0.01"
                                    type="number"
                                  />
                                </FormField>
                                <FormField label="Notes">
                                  <Input disabled={openQuantity <= 0} name="returnIssueNotes" />
                                </FormField>
                              </FormRow>
                              <Button disabled={openQuantity <= 0} tone="secondary" type="submit">
                                Return unused stock
                              </Button>
                            </Form>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="No issued stock"
              title="Nothing has been issued to the job yet"
              description="Issue stock from an open reservation to start tracking used and returned inventory."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default VisitInventoryPageImpl;

