import {
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  getPurchaseOrderById,
  listAddressesByCustomer,
  listJobCommunications,
  listInventoryItemsByCompany,
  listStockLocationsByCompany
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
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
  FormRow,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../../components/ui";
import { RetailerCartPanel } from "./_components/retailer-cart-panel";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary
} from "../../../../../lib/jobs/operational-health";
import {
  installPurchasedParts,
  orderPurchaseOrder,
  receivePurchaseOrderLines,
  returnPurchaseOrderLine,
  updateCoreTracking
} from "../../../../../lib/procurement/service";
import {
  getRetailerCartSupportForPurchaseOrder
} from "../../../../../lib/procurement/retailer-cart";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveVisitRouteConfidenceSnapshot,
  hasServiceSitePlaybook
} from "../../../../../lib/service-thread/continuity";
import {
  getAmazonBusinessPurchaseOrderWorkspace,
  getRepairLinkPurchaseOrderWorkspace,
  getPurchaseOrderProviderWorkspace,
  submitPurchaseOrderViaAmazonBusiness,
  submitPurchaseOrderViaRepairLink,
  submitPurchaseOrderViaPartsTech
} from "../../../../../lib/procurement/providers/service";
import { receivePurchaseOrderLineIntoInventory } from "../../../../../lib/inventory/service";
import {
  getPurchaseOrderCoreInventoryEvents,
  holdCoreInInventory,
  returnCoreFromInventory
} from "../../../../../lib/inventory-operations/service";
import { buildVisitThreadHref } from "../../../../../lib/visits/workspace";

type PurchaseOrderDetailPageProps = {
  params: Promise<{
    purchaseOrderId: string;
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

function getProviderCalloutTone(status: string | null | undefined) {
  if (status === "connected" || status === "accepted") {
    return "success" as const;
  }

  if (status === "action_required" || status === "manual_required" || status === "submitted") {
    return "warning" as const;
  }

  return "danger" as const;
}

export default async function PurchaseOrderDetailPage({ params, searchParams }: PurchaseOrderDetailPageProps) {
  const { purchaseOrderId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/purchase-orders/${purchaseOrderId}`, (searchParams ? await searchParams : {})));
}

export async function SupplyPurchaseOrderDetailPageImpl({ params }: PurchaseOrderDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { purchaseOrderId } = await params;
  const [
    detailResult,
    inventoryItemsResult,
    stockLocationsResult,
    coreEvents,
    providerWorkspace,
    repairLinkProviderWorkspace,
    amazonBusinessProviderWorkspace
  ] =
    await Promise.all([
      getPurchaseOrderById(context.supabase, purchaseOrderId),
      listInventoryItemsByCompany(context.supabase, context.companyId, { includeInactive: true }),
      listStockLocationsByCompany(context.supabase, context.companyId),
      getPurchaseOrderCoreInventoryEvents(context.supabase, context.companyId, purchaseOrderId),
      getPurchaseOrderProviderWorkspace(context.supabase, context.companyId, purchaseOrderId),
      getRepairLinkPurchaseOrderWorkspace(context.supabase, context.companyId, purchaseOrderId),
      getAmazonBusinessPurchaseOrderWorkspace(context.supabase, context.companyId, purchaseOrderId)
    ]);

  if (inventoryItemsResult.error) {
    throw inventoryItemsResult.error;
  }

  if (stockLocationsResult.error) {
    throw stockLocationsResult.error;
  }

  if (detailResult.error || !detailResult.data) {
    notFound();
  }

  const detail = detailResult.data;
  const retailerCartSupport = getRetailerCartSupportForPurchaseOrder(detail);
  const linkedJobIds = Array.from(new Set(detail.lines.map((line) => line.jobId).filter(Boolean)));
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
  const hasSupplyRisk =
    detail.purchaseOrder.status === "draft" ||
    detail.purchaseOrder.status === "ordered" ||
    detail.purchaseOrder.status === "partially_received";
  const releaseRunwayState =
    linkedJob && readinessSummary
      ? deriveReleaseRunwayState({
          estimateStatus: estimateResult.data?.status ?? null,
          hasBlockingIssues: hasSupplyRisk,
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
          hasSupplyRisk,
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
          hasSupplyRisk,
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
  const retailerCartLines = detail.lines
    .map((line) => ({
      description: line.description,
      partNumber: line.supplierPartNumber ?? line.partNumber ?? "",
      quantity: Number(line.quantityOrdered)
    }))
    .filter((line) => line.partNumber.trim() && Number.isFinite(line.quantity) && line.quantity > 0)
    .map((line) => ({
      ...line,
      quantity: Math.max(1, Math.round(line.quantity))
    }));
  const inventoryItems = inventoryItemsResult.data ?? [];
  const stockLocations = stockLocationsResult.data ?? [];
  const activeInventoryItems = inventoryItems.filter(
    (item) => item.isActive && item.itemType === "stocked"
  );
  const activeStockLocations = stockLocations.filter((location) => location.isActive);
  const canMarkOrdered = detail.purchaseOrder.status === "draft" && detail.lines.length > 0;
  const canReceivePurchaseOrder =
    detail.purchaseOrder.status === "ordered" || detail.purchaseOrder.status === "partially_received";
  const canManageFulfillment =
    canReceivePurchaseOrder || detail.purchaseOrder.status === "received";
  const purchaseOrderPath = `/dashboard/supply/purchase-orders/${purchaseOrderId}`;

  function revalidatePurchaseOrderPaths(options?: {
    includeSupplySetup?: boolean;
    includeInventory?: boolean;
  }) {
    revalidatePath("/dashboard/supply");
    revalidatePath(purchaseOrderPath);
    revalidatePath("/dashboard/parts");
    revalidatePath(`/dashboard/parts/purchase-orders/${purchaseOrderId}`);

    if (options?.includeSupplySetup) {
      revalidatePath("/dashboard/supply/integrations");
      revalidatePath("/dashboard/parts/integrations");
    }

    if (options?.includeInventory) {
      revalidatePath("/dashboard/supply/inventory");
      revalidatePath("/dashboard/inventory");
    }
  }

  async function markOrderedAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await orderPurchaseOrder(actionContext.supabase, purchaseOrderId, {
      orderedAt: getNullableString(formData, "orderedAt"),
      expectedAt: getNullableString(formData, "expectedAt"),
      externalReference: getNullableString(formData, "externalReference"),
      manualOrderUrl: getNullableString(formData, "manualOrderUrl"),
      notes: getNullableString(formData, "notes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths();
    redirect(purchaseOrderPath);
  }

  async function receiveLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const lineId = getString(formData, "purchaseOrderLineId");
    const result = await receivePurchaseOrderLines(actionContext.supabase, {
      companyId: actionContext.companyId,
      supplierAccountId: detail.purchaseOrder.supplierAccountId,
      purchaseOrderId,
      receivedByUserId: actionContext.currentUserId,
      receivedAt: new Date().toISOString(),
      receiptNumber: getNullableString(formData, "receiptNumber"),
      notes: getNullableString(formData, "receiptNotes"),
      lines: [
        {
          purchaseOrderLineId: lineId,
          quantityReceived: getNumber(formData, "quantityReceived"),
          unitReceivedCostCents: getNullableString(formData, "unitReceivedCostCents")
            ? getNumber(formData, "unitReceivedCostCents")
            : null,
          notes: getNullableString(formData, "lineNotes")
        }
      ]
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths();
    redirect(purchaseOrderPath);
  }

  async function receiveIntoInventoryAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const purchaseOrderLineId = getString(formData, "purchaseOrderLineId");
    const inventoryItemId = getString(formData, "inventoryItemId");
    const stockLocationId = getString(formData, "stockLocationId");

    if (!inventoryItemId || !stockLocationId) {
      throw new Error("Select an inventory item and stock location before receiving into inventory.");
    }

    const result = await receivePurchaseOrderLineIntoInventory(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId,
      stockLocationId,
      purchaseOrderLineId,
      purchaseReceiptLineId: getNullableString(formData, "purchaseReceiptLineId"),
      quantityReceived: getNumber(formData, "inventoryQuantityReceived"),
      unitCostCents: getNullableString(formData, "inventoryUnitCostCents")
        ? getNumber(formData, "inventoryUnitCostCents")
        : null,
      notes: getNullableString(formData, "inventoryNotes"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error) {
      throw result.error;
    }

    const purchaseOrderLine = detail.lines.find((line) => line.id === purchaseOrderLineId);

    revalidatePurchaseOrderPaths({ includeInventory: true });
    if (purchaseOrderLine?.jobId) {
      revalidatePath(`/dashboard/visits/${purchaseOrderLine.jobId}/parts`);
      revalidatePath(`/dashboard/visits/${purchaseOrderLine.jobId}/inventory`);
    }
    redirect(purchaseOrderPath);
  }

  async function installLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await installPurchasedParts(actionContext.supabase, {
      purchaseOrderLineId: getString(formData, "purchaseOrderLineId"),
      quantityInstalled: getNumber(formData, "quantityInstalled")
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths();
    redirect(purchaseOrderPath);
  }

  async function returnLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await returnPurchaseOrderLine(actionContext.supabase, {
      companyId: actionContext.companyId,
      supplierAccountId: detail.purchaseOrder.supplierAccountId,
      purchaseOrderId,
      returnedByUserId: actionContext.currentUserId,
      returnedAt: new Date().toISOString(),
      returnNumber: getNullableString(formData, "returnNumber"),
      reason: getNullableString(formData, "returnReason"),
      lines: [
        {
          purchaseOrderLineId: getString(formData, "purchaseOrderLineId"),
          quantityReturned: getNumber(formData, "quantityReturned"),
          isCoreReturn: formData.get("isCoreReturn") === "on",
          creditAmountCents: getNullableString(formData, "creditAmountCents")
            ? getNumber(formData, "creditAmountCents")
            : null,
          notes: getNullableString(formData, "returnNotes")
        }
      ],
      inventoryQuantityReturned: getNumber(formData, "inventoryQuantityReturned")
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths({ includeInventory: true });
    redirect(purchaseOrderPath);
  }

  async function coreTrackingAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const mode = getString(formData, "mode") === "returned" ? "returned" : "due";
    const result = await updateCoreTracking(
      actionContext.supabase,
      mode === "due"
        ? {
            purchaseOrderLineId: getString(formData, "purchaseOrderLineId"),
            quantityCoreDue: getNumber(formData, "quantityCore")
          }
        : {
            purchaseOrderLineId: getString(formData, "purchaseOrderLineId"),
            quantityCoreReturned: getNumber(formData, "quantityCore")
          },
      mode
    );

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths();
    redirect(purchaseOrderPath);
  }

  async function holdCoreInventoryAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await holdCoreInInventory(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId: getString(formData, "inventoryItemId"),
      stockLocationId: getString(formData, "stockLocationId"),
      quantity: getNumber(formData, "quantityCoreHeld"),
      heldByUserId: actionContext.currentUserId,
      purchaseOrderLineId: getString(formData, "purchaseOrderLineId"),
      partRequestLineId: getNullableString(formData, "partRequestLineId"),
      notes: getNullableString(formData, "coreHoldNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths({ includeInventory: true });
    redirect(purchaseOrderPath);
  }

  async function returnCoreInventoryAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await returnCoreFromInventory(actionContext.supabase, {
      coreEventId: getString(formData, "coreEventId"),
      returnedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "coreReturnNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidatePurchaseOrderPaths({ includeInventory: true });
    redirect(purchaseOrderPath);
  }

  async function submitPartsTechOrderAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await submitPurchaseOrderViaPartsTech(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      manualReference: getNullableString(formData, "manualReference"),
      notes: getNullableString(formData, "notes"),
      providerAccountId: providerWorkspace.account?.id ?? "",
      purchaseOrderId
    });

    revalidatePurchaseOrderPaths({ includeSupplySetup: true });
    redirect(purchaseOrderPath);
  }

  async function submitRepairLinkOrderAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await submitPurchaseOrderViaRepairLink(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      manualReference: getNullableString(formData, "manualReference"),
      notes: getNullableString(formData, "notes"),
      providerAccountId: repairLinkProviderWorkspace.account?.id ?? "",
      purchaseOrderId
    });

    revalidatePurchaseOrderPaths({ includeSupplySetup: true });
    redirect(purchaseOrderPath);
  }

  async function submitAmazonBusinessOrderAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await submitPurchaseOrderViaAmazonBusiness(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      manualReference: getNullableString(formData, "manualReference"),
      notes: getNullableString(formData, "notes"),
      provider: "amazon_business",
      providerAccountId: amazonBusinessProviderWorkspace.account?.id ?? "",
      purchaseOrderId
    });

    revalidatePurchaseOrderPaths({ includeSupplySetup: true });
    redirect(purchaseOrderPath);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Purchase order"
        title={detail.purchaseOrder.poNumber}
        description={
          <>
            {detail.supplierAccount.name} · created {formatDateTime(detail.purchaseOrder.createdAt, { timeZone: context.company.timezone })}
          </>
        }
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
              Back to supply desk
            </Link>
            {detail.purchaseOrder.manualOrderUrl ? (
              <details className="procurement-thread-bar__utility">
                <summary className={buttonClassName({ tone: "tertiary" })}>More</summary>
                <div className="procurement-thread-bar__utility-actions">
                  <a
                    className="button secondary-button button-link"
                    href={detail.purchaseOrder.manualOrderUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open order URL
                  </a>
                </div>
              </details>
            ) : null}
          </>
        }
        status={<StatusBadge status={detail.purchaseOrder.status} />}
      />

      {linkedJob && promiseConfidence && releaseRunwayState && trustSummary && serviceSiteThreadSummary ? (
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Active service thread</CardEyebrow>
              <CardTitle>Keep purchase-order fulfillment tied to the visit, customer, and site thread</CardTitle>
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

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Retailer cart</CardEyebrow>
            <CardTitle>Contained purchase handoff</CardTitle>
            <CardDescription>
              {retailerCartSupport.supported
                ? "This PO can stage a real O'Reilly website cart inside the app workflow. Test mode opens that staged cart without checking out."
                : retailerCartSupport.reason ?? "This supplier is not eligible for one-click retailer cart prep."}
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <RetailerCartPanel
            companyTimeZone={context.company.timezone}
            lines={retailerCartLines}
            poNumber={detail.purchaseOrder.poNumber}
            providerLabel={retailerCartSupport.providerLabel}
            purchaseOrderId={purchaseOrderId}
            reason={retailerCartSupport.reason}
            supported={retailerCartSupport.supported}
          />
        </CardContent>
      </Card>

      <Callout
        title="PartsTech provider ordering"
        tone={getProviderCalloutTone(providerWorkspace.account?.status ?? null)}
      >
        {providerWorkspace.account
          ? providerWorkspace.orders[0]?.order.manualFallbackReason ??
            providerWorkspace.account.lastErrorMessage ??
            "Provider-linked lines can record a PartsTech order attempt here. Any unsupported automation falls back to manual ordering without breaking the PO."
          : "PartsTech is not configured for this company. The purchase order can still proceed through the normal manual workflow."}
      </Callout>

      <Callout
        title="RepairLink OEM ordering"
        tone={getProviderCalloutTone(repairLinkProviderWorkspace.account?.status ?? null)}
      >
        {repairLinkProviderWorkspace.account
          ? repairLinkProviderWorkspace.orders[0]?.order.manualFallbackReason ??
            repairLinkProviderWorkspace.account.lastErrorMessage ??
            "RepairLink-linked lines can record an OEM dealer handoff here. Any unsupported automation falls back to manual order provenance without breaking the PO."
          : "RepairLink is not configured for this company. The purchase order can still proceed through the normal manual workflow."}
      </Callout>

      <Callout
        title="Amazon Business supply ordering"
        tone={getProviderCalloutTone(amazonBusinessProviderWorkspace.account?.status ?? null)}
      >
        {amazonBusinessProviderWorkspace.account
          ? amazonBusinessProviderWorkspace.orders[0]?.order.manualFallbackReason ??
            amazonBusinessProviderWorkspace.account.lastErrorMessage ??
              "Amazon Business-linked supply lines can record search and order provenance here. Unsupported automation falls back to manual capture or manual link-out without breaking the PO."
          : "Amazon Business is not configured for this company. The purchase order can still proceed through the normal manual workflow."}
      </Callout>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Order status</CardEyebrow>
              <CardTitle>Mark ordered</CardTitle>
              <CardDescription>Use this once the supplier order has actually been placed.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={markOrderedAction}>
              <FormRow>
                <FormField label="Ordered at">
                  <Input name="orderedAt" type="datetime-local" />
                </FormField>
                <FormField label="Expected at">
                  <Input name="expectedAt" type="datetime-local" />
                </FormField>
              </FormRow>
              <FormField label="External reference">
                <Input defaultValue={detail.purchaseOrder.externalReference ?? ""} name="externalReference" />
              </FormField>
              <FormField label="Manual order URL">
                <Input defaultValue={detail.purchaseOrder.manualOrderUrl ?? ""} name="manualOrderUrl" type="url" />
              </FormField>
              <FormField label="Notes">
                <Textarea defaultValue={detail.purchaseOrder.notes ?? ""} name="notes" rows={3} />
              </FormField>
              <Button disabled={!canMarkOrdered} type="submit">
                Mark PO ordered
              </Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Provider order</CardEyebrow>
              <CardTitle>PartsTech order provenance</CardTitle>
              <CardDescription>
                Record a PartsTech order attempt for any PO lines that originated from provider quote lines.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {providerWorkspace.linkedLineCount ? (
              <>
                <Form action={submitPartsTechOrderAction}>
                  <FormField label="Manual reference">
                    <Input name="manualReference" />
                  </FormField>
                  <FormField label="Notes">
                    <Textarea
                      name="notes"
                      rows={3}
                      placeholder="Use this to record manual ordering instructions or provider limitations."
                    />
                  </FormField>
                  <Button
                    disabled={!providerWorkspace.account || providerWorkspace.orders.length > 0}
                    type="submit"
                  >
                    {providerWorkspace.orders.length
                      ? "Provider order already recorded"
                      : "Submit via PartsTech"}
                  </Button>
                </Form>

                <div className="ui-list" style={{ marginTop: "1rem" }}>
                  {providerWorkspace.linkedPurchaseOrderLines.map((line) => (
                    <article key={line.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">Provider-linked line</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Qty {line.quantityOrdered} · {formatCurrencyFromCents(line.unitOrderedCostCents)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                {providerWorkspace.orders.length ? (
                  <div className="ui-list" style={{ marginTop: "1rem" }}>
                    {providerWorkspace.orders.map((entry) => (
                      <article key={entry.order.id} className="ui-list-item">
                        <div>
                          <p className="ui-card__eyebrow">
                            {entry.order.providerOrderReference ?? entry.order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            Provider order recorded
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {entry.lines.length} provider line(s) tracked on this PO.
                          </p>
                        </div>
                        <StatusBadge status={entry.order.status} />
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                eyebrow="No provider-linked lines"
                title="This PO is not tied to a PartsTech quote"
                description="Convert a PartsTech quote line into a supplier cart first if you need provider order provenance here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>OEM provider order</CardEyebrow>
              <CardTitle>RepairLink order provenance</CardTitle>
              <CardDescription>
                Record an OEM dealer handoff for PO lines that originated from RepairLink quote
                lines. Unsupported automation falls back to a tracked manual order path.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {repairLinkProviderWorkspace.linkedLineCount ? (
              <>
                <Form action={submitRepairLinkOrderAction}>
                  <FormField label="Manual reference">
                    <Input name="manualReference" />
                  </FormField>
                  <FormField label="Notes">
                    <Textarea
                      name="notes"
                      rows={3}
                      placeholder="Use this for dealer handoff notes, manual reference numbers, or OEM ordering constraints."
                    />
                  </FormField>
                  <Button
                    disabled={
                      !repairLinkProviderWorkspace.account ||
                      repairLinkProviderWorkspace.orders.length > 0
                    }
                    type="submit"
                  >
                    {repairLinkProviderWorkspace.orders.length
                      ? "OEM order already recorded"
                      : "Submit via RepairLink"}
                  </Button>
                </Form>

                <div className="ui-list" style={{ marginTop: "1rem" }}>
                  {repairLinkProviderWorkspace.linkedPurchaseOrderLines.map((line) => (
                    <article key={line.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">OEM-linked line</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Qty {line.quantityOrdered} - {formatCurrencyFromCents(line.unitOrderedCostCents)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                {repairLinkProviderWorkspace.orders.length ? (
                  <div className="ui-list" style={{ marginTop: "1rem" }}>
                    {repairLinkProviderWorkspace.orders.map((entry) => (
                      <article key={entry.order.id} className="ui-list-item">
                        <div>
                          <p className="ui-card__eyebrow">
                            {entry.order.providerOrderReference ??
                              entry.order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            OEM provider order recorded
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {entry.lines.length} provider line(s) tracked on this PO.
                          </p>
                        </div>
                        <StatusBadge status={entry.order.status} />
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                eyebrow="No OEM-linked lines"
                title="This PO is not tied to a RepairLink quote"
                description="Convert a RepairLink OEM quote line into a supplier cart first if you need OEM provider order provenance here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Supply provider order</CardEyebrow>
              <CardTitle>Amazon Business order provenance</CardTitle>
              <CardDescription>
                Record an Amazon Business order handoff for PO lines that originated from
                supply-oriented provider quote lines. Unsupported automation falls back to a
                tracked manual order path.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {amazonBusinessProviderWorkspace.linkedLineCount ? (
              <>
                <Form action={submitAmazonBusinessOrderAction}>
                  <FormField label="Manual reference">
                    <Input name="manualReference" />
                  </FormField>
                  <FormField label="Notes">
                    <Textarea
                      name="notes"
                      rows={3}
                      placeholder="Use this for Amazon Business handoff notes, order references, or manual procurement constraints."
                    />
                  </FormField>
                  <Button
                    disabled={
                      !amazonBusinessProviderWorkspace.account ||
                      amazonBusinessProviderWorkspace.orders.length > 0
                    }
                    type="submit"
                  >
                    {amazonBusinessProviderWorkspace.orders.length
                      ? "Amazon Business order already recorded"
                      : "Submit via Amazon Business"}
                  </Button>
                </Form>

                <div className="ui-list" style={{ marginTop: "1rem" }}>
                  {amazonBusinessProviderWorkspace.linkedPurchaseOrderLines.map((line) => (
                    <article key={line.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">Supply-linked line</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Qty {line.quantityOrdered} · {formatCurrencyFromCents(line.unitOrderedCostCents)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                {amazonBusinessProviderWorkspace.orders.length ? (
                  <div className="ui-list" style={{ marginTop: "1rem" }}>
                    {amazonBusinessProviderWorkspace.orders.map((entry) => (
                      <article key={entry.order.id} className="ui-list-item">
                        <div>
                          <p className="ui-card__eyebrow">
                            {entry.order.providerOrderReference ??
                              entry.order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            Supply provider order recorded
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {entry.lines.length} provider line(s) tracked on this PO.
                          </p>
                        </div>
                        <StatusBadge status={entry.order.status} />
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                eyebrow="No supply-linked lines"
                title="This PO is not tied to an Amazon Business quote"
                description="Convert an Amazon Business supply offer into a supplier cart first if you need supply-provider order provenance here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>History</CardEyebrow>
              <CardTitle>Receipts and returns</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.receipts.length || detail.returns.length ? (
              <div className="ui-list">
                {detail.receipts.map((entry) => (
                  <article key={entry.receipt.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">Receipt {entry.receipt.receiptNumber ?? entry.receipt.id.slice(0, 8).toUpperCase()}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        Received {formatDateTime(entry.receipt.receivedAt, { timeZone: context.company.timezone })}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {entry.lines.length} receipt line(s)
                      </p>
                    </div>
                  </article>
                ))}
                {detail.returns.map((entry) => (
                  <article key={entry.partReturn.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">Return {entry.partReturn.returnNumber ?? entry.partReturn.id.slice(0, 8).toUpperCase()}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {entry.lines.length} return line(s)
                      </h3>
                    </div>
                    <StatusBadge status={entry.partReturn.status} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No activity"
                title="Nothing has been received or returned yet"
                description="Receiving, install, and return actions on the lines below will build the PO history."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>PO lines</CardEyebrow>
            <CardTitle>Receive, install, return, and track cores</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {detail.lines.length ? (
            <div className="ui-list">
              {detail.lines.map((line) => (
                (() => {
                  const receiptLineOptions = detail.receipts.flatMap((entry) =>
                    entry.lines
                      .filter((receiptLine) => receiptLine.purchaseOrderLineId === line.id)
                      .map((receiptLine) => {
                        const remainingToInventoryQuantity = Math.max(
                          receiptLine.quantityReceived - receiptLine.receivedIntoInventoryQuantity,
                          0
                        );

                        return {
                          id: receiptLine.id,
                          remainingToInventoryQuantity,
                          label: `${entry.receipt.receiptNumber ?? entry.receipt.id.slice(0, 8).toUpperCase()} · received ${receiptLine.quantityReceived} · remaining to inventory ${remainingToInventoryQuantity}`
                        };
                      })
                      .filter((receiptLine) => receiptLine.remainingToInventoryQuantity > 0)
                  );
                  const inventoryReceiptLocked =
                    line.inventoryItemId !== null || line.stockLocationId !== null;
                  const linkedInventoryItem = line.inventoryItemId
                    ? inventoryItems.find((item) => item.id === line.inventoryItemId) ?? null
                    : null;
                  const linkedStockLocation = line.stockLocationId
                    ? stockLocations.find((location) => location.id === line.stockLocationId) ?? null
                    : null;
                  const inventoryLinkInactive =
                    (linkedInventoryItem !== null &&
                      (!linkedInventoryItem.isActive ||
                        linkedInventoryItem.itemType !== "stocked")) ||
                    (linkedStockLocation !== null && !linkedStockLocation.isActive);
                  const canRecordReceipt = canReceivePurchaseOrder && line.quantityReceived < line.quantityOrdered;
                  const canMarkInstalled =
                    canManageFulfillment && line.quantityInstalled + line.quantityReturned < line.quantityReceived;
                  const canRecordReturn = canManageFulfillment && line.quantityReturned < line.quantityReceived;
                  const canTrackCore = canManageFulfillment && line.isCoreReturnable;
                  const lineCoreEvents = coreEvents.filter(
                    (event) => event.purchaseOrderLineId === line.id
                  );
                  const heldCoreEvents = lineCoreEvents.filter((event) => event.status === "held");
                  const canReceiveIntoInventory =
                    canManageFulfillment &&
                    receiptLineOptions.length > 0 &&
                    activeStockLocations.length > 0 &&
                    !inventoryLinkInactive;

                  return (
                <article key={line.id} className="ui-list-item">
                  <div style={{ width: "100%" }}>
                    <div className="ui-page-actions" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                      <div>
                        <p className="ui-card__eyebrow">{line.partNumber ?? "No part number"}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Ordered {line.quantityOrdered} · received {line.quantityReceived} · installed {line.quantityInstalled} · returned {line.quantityReturned}
                        </p>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          Ordered cost {formatCurrencyFromCents(line.unitOrderedCostCents)} · actual {formatCurrencyFromCents(line.unitActualCostCents ?? 0)}
                        </p>
                      </div>
                      <StatusBadge status={line.status} />
                    </div>

                    <div className="ui-page-grid ui-page-grid--sidebar">
                      <Card tone="subtle">
                        <CardHeader>
                          <CardHeaderContent>
                            <CardTitle style={{ fontSize: "1rem" }}>Receive</CardTitle>
                          </CardHeaderContent>
                        </CardHeader>
                        <CardContent>
                          <Form action={receiveLineAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <FormRow>
                              <FormField label="Qty received">
                                <Input min="0.01" name="quantityReceived" step="0.01" type="number" />
                              </FormField>
                              <FormField label="Unit cost (cents)">
                                <Input min="0" name="unitReceivedCostCents" type="number" />
                              </FormField>
                            </FormRow>
                            <FormField label="Receipt number">
                              <Input name="receiptNumber" />
                            </FormField>
                            <FormField label="Notes">
                              <Textarea name="lineNotes" rows={2} />
                            </FormField>
                            <input name="receiptNotes" type="hidden" value="" />
                            <Button disabled={!canRecordReceipt} type="submit">
                              Record receipt
                            </Button>
                          </Form>

                          <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />

                          <Form action={receiveIntoInventoryAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <FormRow>
                              <FormField label="Receipt line">
                                <Select defaultValue="" name="purchaseReceiptLineId">
                                  <option value="">Select receipt line</option>
                                  {receiptLineOptions.map((receiptLine) => (
                                    <option key={receiptLine.id} value={receiptLine.id}>
                                      {receiptLine.label}
                                    </option>
                                  ))}
                                </Select>
                              </FormField>
                              <FormField label="Inventory item">
                                <Select
                                  defaultValue={line.inventoryItemId ?? ""}
                                  disabled={inventoryReceiptLocked}
                                  name="inventoryItemId"
                                >
                                  <option value="">Select inventory item</option>
                                  {linkedInventoryItem &&
                                  (!linkedInventoryItem.isActive ||
                                    linkedInventoryItem.itemType !== "stocked") ? (
                                    <option value={linkedInventoryItem.id}>
                                      {linkedInventoryItem.sku} · {linkedInventoryItem.name}
                                      {!linkedInventoryItem.isActive ? " (inactive)" : ""}
                                      {linkedInventoryItem.itemType !== "stocked" ? " (non-stocked)" : ""}
                                    </option>
                                  ) : null}
                                  {activeInventoryItems.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.sku} · {item.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormField>
                              <FormField label="Stock location">
                                <Select
                                  defaultValue={line.stockLocationId ?? ""}
                                  disabled={inventoryReceiptLocked}
                                  name="stockLocationId"
                                >
                                  <option value="">Select location</option>
                                  {linkedStockLocation && !linkedStockLocation.isActive ? (
                                    <option value={linkedStockLocation.id}>
                                      {linkedStockLocation.name} (inactive)
                                    </option>
                                  ) : null}
                                  {activeStockLocations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormField>
                            </FormRow>
                            <FormRow>
                              <FormField label="Qty into inventory">
                                <Input min="0.01" name="inventoryQuantityReceived" step="0.01" type="number" />
                              </FormField>
                              <FormField label="Unit cost (cents)">
                                <Input min="0" name="inventoryUnitCostCents" type="number" />
                              </FormField>
                            </FormRow>
                            <FormField label="Notes">
                              <Textarea name="inventoryNotes" rows={2} />
                            </FormField>
                            {inventoryReceiptLocked ? (
                              <p className="ui-field__hint">
                                Future receipts for this PO line must use the same inventory item and stock
                                location.
                              </p>
                            ) : null}
                            {(linkedInventoryItem &&
                              (!linkedInventoryItem.isActive ||
                                linkedInventoryItem.itemType !== "stocked")) ||
                            (linkedStockLocation && !linkedStockLocation.isActive) ? (
                              <p className="ui-field__hint">
                                This PO line is linked to an inactive or non-stocked inventory record.
                                Reactivate it or relink it to a stocked item before recording more inventory
                                activity.
                              </p>
                            ) : null}
                            <div className="ui-page-actions">
                            <Button disabled={!canReceiveIntoInventory} tone="secondary" type="submit">
                              Receive into inventory
                            </Button>
                              <Link
                                className={buttonClassName({ size: "sm", tone: "tertiary" })}
                                href="/dashboard/supply/inventory/items"
                              >
                                Manage items
                              </Link>
                            </div>
                          </Form>
                        </CardContent>
                      </Card>

                      <Card tone="subtle">
                        <CardHeader>
                          <CardHeaderContent>
                            <CardTitle style={{ fontSize: "1rem" }}>Install / return / core</CardTitle>
                          </CardHeaderContent>
                        </CardHeader>
                        <CardContent>
                          <Form action={installLineAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <FormField label="Qty installed">
                              <Input min="0.01" name="quantityInstalled" step="0.01" type="number" />
                            </FormField>
                            <Button disabled={!canMarkInstalled} tone="secondary" type="submit">
                              Mark installed
                            </Button>
                          </Form>

                          <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />

                          <Form action={returnLineAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <FormRow>
                              <FormField label="Qty returned">
                                <Input min="0.01" name="quantityReturned" step="0.01" type="number" />
                              </FormField>
                              <FormField label="Credit (cents)">
                                <Input min="0" name="creditAmountCents" type="number" />
                              </FormField>
                            </FormRow>
                            <FormField label="Return number">
                              <Input name="returnNumber" />
                            </FormField>
                            <FormField label="Reason">
                              <Input name="returnReason" />
                            </FormField>
                            <label className="ui-field__hint" style={{ display: "flex", gap: "0.5rem" }}>
                              <input name="isCoreReturn" type="checkbox" />
                              This line is a core return
                            </label>
                            <FormField label="Notes">
                              <Textarea name="returnNotes" rows={2} />
                            </FormField>
                            {line.inventoryItemId && line.stockLocationId ? (
                              <FormField label="Qty returned from inventory">
                                <Input min="0" name="inventoryQuantityReturned" step="0.01" type="number" />
                              </FormField>
                            ) : null}
                            {line.inventoryItemId && line.stockLocationId ? (
                              <p className="ui-field__hint">
                                Inventory returns cannot exceed the quantity this PO line previously received into
                                stock and still has available at this location.
                              </p>
                            ) : null}
                            <Button disabled={!canRecordReturn || inventoryLinkInactive} tone="danger" type="submit">
                              Record return
                            </Button>
                          </Form>

                          <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />

                          <Form action={coreTrackingAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <input name="mode" type="hidden" value="due" />
                            <FormField label="Core due qty">
                              <Input defaultValue={line.quantityCoreDue} min="0" name="quantityCore" step="0.01" type="number" />
                            </FormField>
                            <Button disabled={!canTrackCore} tone="secondary" type="submit">
                              Save core due
                            </Button>
                          </Form>

                          <div style={{ height: "0.75rem" }} />

                          <Form action={coreTrackingAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <input name="mode" type="hidden" value="returned" />
                            <FormField label="Core returned qty">
                              <Input defaultValue={line.quantityCoreReturned} min="0" name="quantityCore" step="0.01" type="number" />
                            </FormField>
                            <Button disabled={!canTrackCore} tone="secondary" type="submit">
                              Save core returned
                            </Button>
                          </Form>

                          <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />

                          <Form action={holdCoreInventoryAction}>
                            <input name="purchaseOrderLineId" type="hidden" value={line.id} />
                            <input name="partRequestLineId" type="hidden" value={line.partRequestLineId} />
                            <input name="inventoryItemId" type="hidden" value={line.inventoryItemId ?? ""} />
                            <input name="stockLocationId" type="hidden" value={line.stockLocationId ?? ""} />
                            <FormField label="Core hold qty">
                              <Input min="0.01" name="quantityCoreHeld" step="0.01" type="number" />
                            </FormField>
                            <FormField label="Notes">
                              <Input name="coreHoldNotes" />
                            </FormField>
                            <Button
                              disabled={!canTrackCore || !line.inventoryItemId || !line.stockLocationId || inventoryLinkInactive}
                              tone="secondary"
                              type="submit"
                            >
                              Hold core in inventory
                            </Button>
                          </Form>

                          <div style={{ height: "0.75rem" }} />

                          <Form action={returnCoreInventoryAction}>
                            <FormField label="Held core event">
                              <Select defaultValue="" name="coreEventId">
                                <option value="">Select held core</option>
                                {heldCoreEvents.map((event) => (
                                  <option key={event.id} value={event.id}>
                                    {event.quantity} held {formatDateTime(event.heldAt, { timeZone: context.company.timezone })}
                                  </option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField label="Notes">
                              <Input name="coreReturnNotes" />
                            </FormField>
                            <Button disabled={!heldCoreEvents.length} tone="secondary" type="submit">
                              Return held core
                            </Button>
                          </Form>

                          {lineCoreEvents.length ? (
                            <div className="ui-list" style={{ marginTop: "1rem" }}>
                              {lineCoreEvents.map((event) => (
                                <article key={event.id} className="ui-list-item">
                                  <div>
                                    <p className="ui-card__eyebrow">
                                      {formatDateTime(event.heldAt, { timeZone: context.company.timezone })}
                                    </p>
                                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                                      Core qty {event.quantity}
                                    </h3>
                                  </div>
                                  <StatusBadge status={event.status} />
                                </article>
                              ))}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No PO lines"
              title="This purchase order has no lines"
              description="Convert a supplier cart with quoted lines before using the receiving workflow."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
