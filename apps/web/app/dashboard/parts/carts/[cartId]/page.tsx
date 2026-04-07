import {
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  getSupplierCartById,
  listAddressesByCustomer,
  listJobCommunications,
  updateSupplierCartLine
} from "@mobile-mechanic/api-client";
import { formatCurrencyFromCents, isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
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
  PageHeader,
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import { convertCartToPurchaseOrder } from "../../../../../lib/procurement/service";
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
import { buildVisitThreadHref } from "../../../../../lib/visits/workspace";

type SupplierCartPageProps = {
  params: Promise<{
    cartId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key).trim();
  return raw ? Number(raw) : 0;
}

function revalidateCartPaths(cartId: string) {
  revalidatePath("/dashboard/supply");
  revalidatePath(`/dashboard/supply/carts/${cartId}`);
  revalidatePath("/dashboard/parts");
  revalidatePath(`/dashboard/parts/carts/${cartId}`);
}

export default async function SupplierCartPage({ params, searchParams }: SupplierCartPageProps) {
  const { cartId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/carts/${cartId}`, (searchParams ? await searchParams : {})));
}

export async function SupplyCartPageImpl({ params }: SupplierCartPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { cartId } = await params;
  const detailResult = await getSupplierCartById(context.supabase, cartId);

  if (detailResult.error || !detailResult.data) {
    notFound();
  }

  const detail = detailResult.data;
  const isEditableCart = detail.cart.status === "open";
  const linkedJobIds = Array.from(new Set(detail.lines.map(({ requestLine }) => requestLine.jobId).filter(Boolean)));
  const singleLinkedJobId = linkedJobIds.length === 1 ? linkedJobIds[0] : null;
  const linkedJobResult = singleLinkedJobId ? await getJobById(context.supabase, singleLinkedJobId) : { data: null, error: null };

  if (linkedJobResult.error) {
    throw linkedJobResult.error;
  }

  const linkedJob =
    linkedJobResult.data && linkedJobResult.data.companyId === context.companyId ? linkedJobResult.data : null;
  const [customerResult, estimateResult, invoiceResult, communicationsResult, serviceSitesResult] = linkedJob
    ? await Promise.all([
        getCustomerById(context.supabase, linkedJob.customerId),
        getEstimateByJobId(context.supabase, linkedJob.id),
        getInvoiceByJobId(context.supabase, linkedJob.id),
        listJobCommunications(context.supabase, linkedJob.id, { limit: 10 }),
        listAddressesByCustomer(context.supabase, linkedJob.customerId)
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (customerResult.error) {
    throw customerResult.error;
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
  const serviceSite = linkedJob
    ? (serviceSitesResult.data ?? []).find((address) => address.id === linkedJob.serviceSiteId) ?? null
    : null;
  const continuityCommunications = (communicationsResult.data ?? []).map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const promiseSummary = linkedJob
    ? getVisitPromiseSummary({
        communications: continuityCommunications,
        job: linkedJob
      })
    : null;
  const readinessSummary = linkedJob
    ? getVisitReadinessSummary({
        communications: continuityCommunications,
        estimate: estimateResult.data,
        invoice: invoiceResult.data,
        job: linkedJob
      })
    : null;
  const releaseRunwayState =
    linkedJob && readinessSummary
      ? deriveReleaseRunwayState({
          estimateStatus: estimateResult.data?.status ?? null,
          hasBlockingIssues: detail.cart.status !== "converted" && detail.lines.length > 0,
          hasOwner: Boolean(linkedJob.assignedTechnicianUserId),
          hasPromise: Boolean(linkedJob.arrivalWindowStartAt ?? linkedJob.scheduledStartAt),
          readinessReadyCount: readinessSummary.readyCount,
          readinessTotalCount: readinessSummary.totalCount,
          visitStatus: linkedJob.status
        })
      : null;
  const trustSummary =
    linkedJob && readinessSummary
      ? getVisitTrustSummary({
          communications: continuityCommunications,
          estimate: estimateResult.data,
          invoice: invoiceResult.data,
          job: linkedJob
        })
      : null;
  const promiseConfidence =
    promiseSummary && readinessSummary && releaseRunwayState && trustSummary
      ? derivePromiseConfidenceSnapshot({
          hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
          hasSupplyRisk: detail.lines.length > 0 && detail.cart.status !== "converted",
          promiseSummary,
          readinessSummary,
          releaseRunwayState,
          trustSummary
        })
      : null;
  const routeConfidence =
    linkedJob && promiseConfidence
      ? deriveVisitRouteConfidenceSnapshot({
          assignedTechnicianUserId: linkedJob.assignedTechnicianUserId,
          hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
          hasSupplyRisk: detail.lines.length > 0 && detail.cart.status !== "converted",
          promiseConfidencePercent: promiseConfidence.confidencePercent,
          visitStatus: linkedJob.status
        })
      : null;
  const serviceSiteThreadSummary =
    linkedJob && customer
      ? buildServiceSiteThreadSummary({
          activeVisitCount:
            linkedJob.status === "scheduled" || isTechnicianActiveFieldJobStatus(linkedJob.status) ? 1 : 0,
          commercialAccountMode: customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
          linkedAssetCount: linkedJob.vehicleId ? 1 : 0,
          linkedVisitCount: 1,
          site: serviceSite
        })
      : null;
  const visitThreadHref = linkedJob ? buildVisitThreadHref(linkedJob.id) : null;
  const customerThreadHref = customer ? buildCustomerWorkspaceHref(customer.id) : null;
  const siteThreadHref = customer ? buildCustomerWorkspaceHref(customer.id, { tab: "addresses" }) : null;

  async function updateCartLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const lineId = getString(formData, "lineId");
    const lineDetail = detail.lines.find(({ cartLine }) => cartLine.id === lineId);
    const result = await updateSupplierCartLine(actionContext.supabase, lineId, {
      quantity: getNumber(formData, "quantity"),
      quotedUnitCostCents: getNullableString(formData, "quotedUnitCostCents")
        ? getNumber(formData, "quotedUnitCostCents")
        : null,
      quotedCoreChargeCents: getNumber(formData, "quotedCoreChargeCents"),
      supplierPartNumber: getNullableString(formData, "supplierPartNumber"),
      supplierUrl: getNullableString(formData, "supplierUrl"),
      availabilityText: getNullableString(formData, "availabilityText"),
      notes: getNullableString(formData, "notes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateCartPaths(cartId);
    if (lineDetail) {
      revalidatePath(`/dashboard/supply/requests/${lineDetail.requestLine.partRequestId}`);
      revalidatePath(`/dashboard/parts/requests/${lineDetail.requestLine.partRequestId}`);
      revalidatePath(`/dashboard/visits/${lineDetail.requestLine.jobId}/parts`);
    }
    redirect(`/dashboard/supply/carts/${cartId}`);
  }

  async function convertCartAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await convertCartToPurchaseOrder(actionContext.supabase, {
      companyId: actionContext.companyId,
      cartId,
      poNumber: getString(formData, "poNumber"),
      orderedByUserId: actionContext.currentUserId,
      expectedAt: getNullableString(formData, "expectedAt"),
      externalReference: getNullableString(formData, "externalReference"),
      manualOrderUrl: getNullableString(formData, "manualOrderUrl"),
      notes: getNullableString(formData, "poNotes")
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Purchase order could not be created.");
    }

    revalidateCartPaths(cartId);
    revalidatePath(`/dashboard/supply/purchase-orders/${result.data.id}`);
    revalidatePath(`/dashboard/parts/purchase-orders/${result.data.id}`);
    redirect(`/dashboard/supply/purchase-orders/${result.data.id}`);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Supplier cart"
        title={`Cart ${detail.cart.id.slice(0, 8).toUpperCase()}`}
        description={
          <>
            {detail.supplierAccount.name} bucket <strong>{detail.cart.sourceBucketKey}</strong>.
          </>
        }
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
              Back to supply desk
            </Link>
            {detail.supplierAccount.externalUrl ? (
              <details className="procurement-thread-bar__utility">
                <summary className={buttonClassName({ tone: "tertiary" })}>More</summary>
                <div className="procurement-thread-bar__utility-actions">
                  <a
                    className="button secondary-button button-link"
                    href={detail.supplierAccount.externalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open supplier site
                  </a>
                </div>
              </details>
            ) : null}
          </>
        }
        status={<StatusBadge status={detail.cart.status} />}
      />

      {linkedJob && promiseConfidence && releaseRunwayState && trustSummary && serviceSiteThreadSummary ? (
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Active service thread</CardEyebrow>
              <CardTitle>Keep supplier-cart decisions tied to the visit, customer, and site thread</CardTitle>
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
                    : `${routeConfidence?.label ?? "Stable"} · ${routeConfidence?.confidencePercent ?? 0}%`}
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
              {visitThreadHref ? (
                <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
                  Open visit thread
                </Link>
              ) : null}
              {customerThreadHref ? (
                <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
                  {customer?.relationshipType === "fleet_account" ? "Open account thread" : "Open customer thread"}
                </Link>
              ) : null}
              {siteThreadHref ? (
                <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
                  Open site thread
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Quoted lines</CardEyebrow>
              <CardTitle>Supplier cart lines</CardTitle>
              <CardDescription>Adjust quoted cost, supplier references, and manual link-out details before converting to a PO.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.lines.length ? (
              <div className="ui-list">
                {detail.lines.map(({ cartLine, requestLine }) => (
                  <article key={cartLine.id} className="ui-list-item">
                    <div style={{ width: "100%" }}>
                      <div className="ui-page-actions" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <div>
                          <p className="ui-card__eyebrow">{requestLine.partNumber ?? "No part number"}</p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            {requestLine.description}
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            Qty {cartLine.quantity} · quoted {formatCurrencyFromCents(cartLine.quotedUnitCostCents ?? 0)}
                          </p>
                        </div>
                        <StatusBadge status={requestLine.status} />
                      </div>

                      <Form action={updateCartLineAction}>
                        <input name="lineId" type="hidden" value={cartLine.id} />
                        <FormRow>
                          <FormField label="Quantity">
                            <Input defaultValue={String(cartLine.quantity)} min="0.01" name="quantity" step="0.01" type="number" />
                          </FormField>
                          <FormField label="Quoted unit cost (cents)">
                            <Input defaultValue={cartLine.quotedUnitCostCents ?? ""} min="0" name="quotedUnitCostCents" type="number" />
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Core charge (cents)">
                            <Input defaultValue={cartLine.quotedCoreChargeCents} min="0" name="quotedCoreChargeCents" type="number" />
                          </FormField>
                          <FormField label="Supplier part number">
                            <Input defaultValue={cartLine.supplierPartNumber ?? ""} name="supplierPartNumber" />
                          </FormField>
                        </FormRow>
                        <FormField label="Supplier URL">
                          <Input defaultValue={cartLine.supplierUrl ?? detail.supplierAccount.externalUrl ?? ""} name="supplierUrl" type="url" />
                        </FormField>
                        <FormField label="Availability">
                          <Input defaultValue={cartLine.availabilityText ?? ""} name="availabilityText" />
                        </FormField>
                        <FormField label="Notes">
                          <Textarea defaultValue={cartLine.notes ?? ""} name="notes" rows={3} />
                        </FormField>
                        <Button disabled={!isEditableCart} type="submit">
                          Save cart line
                        </Button>
                      </Form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="Empty cart"
                title="No quoted lines are in this cart"
                description="Route a request into this supplier bucket before trying to order it."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Convert to PO</CardEyebrow>
              <CardTitle>Create purchase order</CardTitle>
              <CardDescription>Once the cart is ready, create a purchase order for receiving and return tracking.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={convertCartAction}>
              <FormField label="PO number" required>
                <Input name="poNumber" required />
              </FormField>
              <FormRow>
                <FormField label="Expected at">
                  <Input name="expectedAt" type="datetime-local" />
                </FormField>
                <FormField label="External reference">
                  <Input name="externalReference" />
                </FormField>
              </FormRow>
              <FormField label="Manual order URL">
                <Input defaultValue={detail.supplierAccount.externalUrl ?? ""} name="manualOrderUrl" type="url" />
              </FormField>
              <FormField label="PO notes">
                <Textarea name="poNotes" rows={3} />
              </FormField>
              <Button disabled={!isEditableCart || !detail.lines.length} type="submit">
                Convert cart to PO
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
