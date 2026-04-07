import {
  addPartRequestLine,
  getCustomerById,
  getEstimateByJobId,
  getInvoiceByJobId,
  getJobById,
  getPartRequestById,
  getVehicleById,
  listAddressesByCustomer,
  listJobCommunications,
  listSupplierAccountsByCompany
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
  FormRow,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  Textarea,
  HeaderCell,
  Cell,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary
} from "../../../../../lib/jobs/operational-health";
import { routePartRequestLinesToSupplierBuckets } from "../../../../../lib/procurement/service";
import {
  applySupplyListToRequest,
  getSupplyListsWorkspace
} from "../../../../../lib/procurement/supplies/service";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveVisitRouteConfidenceSnapshot,
  hasServiceSitePlaybook
} from "../../../../../lib/service-thread/continuity";
import {
  buildVisitDetailHref,
  buildVisitPartsHref,
  normalizeVisitReturnTo
} from "../../../../../lib/visits/workspace";
import {
  convertAmazonBusinessQuoteLineToSupplierCart,
  convertRepairLinkQuoteLineToSupplierCart,
  convertPartsTechQuoteLineToSupplierCart,
  createManualAmazonBusinessQuoteLine,
  createManualRepairLinkQuoteLine,
  createManualPartsTechQuoteLine,
  getAmazonBusinessFallbackModeFromSettings,
  getAmazonBusinessRequestWorkspace,
  getRepairLinkFallbackModeFromSettings,
  getRepairLinkPreferredDealerIdsFromSettings,
  getRepairLinkRequestWorkspace,
  getRequestProviderWorkspace,
  searchAmazonBusinessForRequest,
  searchRepairLinkForRequest,
  searchPartsTechForRequest
} from "../../../../../lib/procurement/providers/service";

type PartRequestDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
  searchParams?: Promise<{
    feedback?: string | string[] | undefined;
    returnLabel?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
    unmatched?: string | string[] | undefined;
  }>;
};

export default async function PartRequestDetailPage({ params, searchParams }: PartRequestDetailPageProps) {
  const { requestId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  redirect(
    buildDashboardAliasHref(`/dashboard/supply/requests/${requestId}`, resolvedSearchParams)
  );
}

const requestRoutingFeedback = {
  partial: {
    title: "Some lines still need supplier attention",
    tone: "warning",
    buildBody: (unmatchedCount: number | null) =>
      unmatchedCount && unmatchedCount > 0
        ? `${unmatchedCount} request line(s) still need manual routing or a fallback rule.`
        : "Some request lines are still open and need manual routing or a fallback rule."
  },
  routed: {
    title: "Request routed",
    tone: "success",
    buildBody: () => "All open request lines were routed into supplier carts."
  }
} as const;

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

function getQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

function buildRequestFeedbackHref(
  path: string,
  feedback?: keyof typeof requestRoutingFeedback,
  unmatchedCount?: number
) {
  if (!feedback) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("feedback", feedback);

  if (typeof unmatchedCount === "number" && unmatchedCount > 0) {
    url.searchParams.set("unmatched", String(unmatchedCount));
  }

  return `${url.pathname}${url.search}`;
}

function buildRequestDetailHref(
  requestId: string,
  options?: {
    feedback?: keyof typeof requestRoutingFeedback;
    returnLabel?: string | null;
    returnTo?: string | null;
    unmatched?: number | null;
  }
) {
  const searchParams = new URLSearchParams();

  if (options?.feedback) {
    searchParams.set("feedback", options.feedback);
  }

  if (typeof options?.unmatched === "number" && options.unmatched > 0) {
    searchParams.set("unmatched", String(options.unmatched));
  }

  if (options?.returnLabel?.trim()) {
    searchParams.set("returnLabel", options.returnLabel.trim());
  }

  const returnTo = normalizeVisitReturnTo(options?.returnTo);
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }

  const search = searchParams.toString();
  const path = `/dashboard/supply/requests/${requestId}`;
  return search ? `${path}?${search}` : path;
}

function getRemainingProcurementDemandQuantity(line: {
  quantityConsumedFromStock: number;
  quantityReturnedToInventory: number;
  quantityInstalled: number;
  quantityRequested: number;
  quantityReservedFromStock: number;
}) {
  const netConsumedFromStockQuantity = Math.max(
    Number(line.quantityConsumedFromStock) - Number(line.quantityReturnedToInventory),
    0
  );

  return Math.max(
    Number(line.quantityRequested) -
      Number(line.quantityInstalled) -
      Number(line.quantityReservedFromStock) -
      netConsumedFromStockQuantity,
    0
  );
}

function getProviderCalloutTone(status: string | null | undefined) {
  if (status === "connected" || status === "priced" || status === "selected" || status === "converted") {
    return "success" as const;
  }

  if (status === "action_required" || status === "manual_required") {
    return "warning" as const;
  }

  return "danger" as const;
}

function getProviderMessageFromMetadata(metadata: unknown) {
  if (
    metadata &&
    typeof metadata === "object" &&
    "message" in metadata &&
    typeof metadata.message === "string"
  ) {
    return metadata.message;
  }

  return null;
}

function getRepairLinkFallbackDescription(
  fallbackMode: "manual_capture" | "manual_link_out"
) {
  return fallbackMode === "manual_link_out"
    ? "RepairLink OEM sourcing requires a VIN and one or more active dealer mappings. This account is configured for manual link-out by default, while manual quote capture remains available if you want to bring OEM pricing back into internal procurement."
    : "RepairLink OEM sourcing requires a VIN and one or more active dealer mappings. Any unsupported provider automation falls back to manual quote capture or manual order handoff.";
}

function getAmazonBusinessFallbackDescription(
  fallbackMode: "manual_capture" | "manual_link_out"
) {
  return fallbackMode === "manual_link_out"
    ? "Amazon Business supplies sourcing is configured for manual link-out by default. Search sessions still keep supply context and provider provenance inside procurement, while manual capture remains available when you want internal pricing before conversion."
    : "Amazon Business supplies sourcing keeps search, quote, and provider-order provenance inside procurement. Any unsupported automation falls back to manual quote capture or manual order handoff.";
}

export async function SupplyRequestDetailPageImpl({ params, searchParams }: PartRequestDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { requestId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnLabel = getQueryValue(resolvedSearchParams.returnLabel)?.trim() ?? "";
  const returnTo = normalizeVisitReturnTo(getQueryValue(resolvedSearchParams.returnTo));
  const [
    requestResult,
    supplierAccountsResult,
    providerWorkspace,
    repairLinkWorkspace,
    amazonBusinessWorkspace,
    supplyListsWorkspace
  ] = await Promise.all([
    getPartRequestById(context.supabase, requestId),
    listSupplierAccountsByCompany(context.supabase, context.companyId),
    getRequestProviderWorkspace(context.supabase, context.companyId, requestId),
    getRepairLinkRequestWorkspace(context.supabase, context.companyId, requestId),
    getAmazonBusinessRequestWorkspace(context.supabase, context.companyId, requestId),
    getSupplyListsWorkspace(context.supabase, context.companyId)
  ]);

  if (requestResult.error || !requestResult.data) {
    notFound();
  }
  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const detail = requestResult.data;
  const jobResult = await getJobById(context.supabase, detail.request.jobId);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Visit could not be loaded for this parts request.");
  }

  const vehicleResult = jobResult.data.vehicleId
    ? await getVehicleById(context.supabase, jobResult.data.vehicleId)
    : { data: null, error: null };

  if (vehicleResult.error) {
    throw vehicleResult.error;
  }

  const [customerResult, estimateResult, invoiceResult, communicationsResult, serviceSitesResult] = await Promise.all([
    getCustomerById(context.supabase, jobResult.data.customerId),
    getEstimateByJobId(context.supabase, detail.request.jobId),
    getInvoiceByJobId(context.supabase, detail.request.jobId),
    listJobCommunications(context.supabase, detail.request.jobId, { limit: 10 }),
    listAddressesByCustomer(context.supabase, jobResult.data.customerId)
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

  const supplierAccounts = supplierAccountsResult.data ?? [];
  const supplierAccountsById = new Map(supplierAccounts.map((account) => [account.id, account]));
  const requestPath = buildRequestDetailHref(requestId, {
    returnLabel,
    returnTo
  });
  const visitPartsHref = buildVisitPartsHref(detail.request.jobId, {
    returnLabel,
    returnTo
  });
  const visitDetailHref = buildVisitDetailHref(detail.request.jobId, {
    returnLabel: "Back to request",
    returnTo: requestPath
  });

  function revalidateRequestPaths(options?: { includeSupplySetup?: boolean }) {
    revalidatePath("/dashboard/supply");
    revalidatePath(requestPath);
    revalidatePath("/dashboard/parts");
    revalidatePath(`/dashboard/parts/requests/${requestId}`);

    if (options?.includeSupplySetup) {
      revalidatePath("/dashboard/supply/integrations");
      revalidatePath("/dashboard/parts/integrations");
    }
  }

  const feedbackKey = getQueryValue(resolvedSearchParams.feedback);
  const unmatchedCountRaw = getQueryValue(resolvedSearchParams.unmatched);
  const unmatchedCount = unmatchedCountRaw ? Number(unmatchedCountRaw) : null;
  const feedback =
    feedbackKey && feedbackKey in requestRoutingFeedback
      ? requestRoutingFeedback[feedbackKey as keyof typeof requestRoutingFeedback]
      : null;
  const routeableLines = detail.lines.filter(
    (line) => getRemainingProcurementDemandQuantity(line) > 0
  );
  const partsTechAccount = providerWorkspace.account;
  const repairLinkAccount = repairLinkWorkspace.account;
  const amazonBusinessAccount = amazonBusinessWorkspace.account;
  const providerMappingsById = new Map(
    providerWorkspace.supplierMappings.map((mapping) => [mapping.id, mapping])
  );
  const repairLinkMappingsById = new Map(
    repairLinkWorkspace.supplierMappings.map((mapping) => [mapping.id, mapping])
  );
  const repairLinkFallbackMode = getRepairLinkFallbackModeFromSettings(repairLinkAccount);
  const preferredRepairLinkDealerMappingIds = getRepairLinkPreferredDealerIdsFromSettings(
    repairLinkAccount
  );
  const activeRepairLinkMappings = repairLinkWorkspace.supplierMappings.filter(
    (mapping) =>
      !["disabled", "unmapped"].includes(mapping.status) && mapping.supportsQuote
  );
  const defaultRepairLinkDealerMappingIds = new Set(
    preferredRepairLinkDealerMappingIds.filter((mappingId) =>
      activeRepairLinkMappings.some((mapping) => mapping.id === mappingId)
    )
  );
  if (defaultRepairLinkDealerMappingIds.size === 0) {
    for (const mapping of activeRepairLinkMappings) {
      defaultRepairLinkDealerMappingIds.add(mapping.id);
    }
  }
  const vehicleVin = vehicleResult.data?.vin ?? null;
  const amazonBusinessFallbackMode =
    getAmazonBusinessFallbackModeFromSettings(amazonBusinessAccount);
  const customer = customerResult.data;
  const linkedJob = jobResult.data;
  const hasSupplyRisk = routeableLines.length > 0;
  const serviceSite =
    (serviceSitesResult.data ?? []).find((address) => address.id === linkedJob.serviceSiteId) ?? null;
  const continuityCommunications = (communicationsResult.data ?? []).map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const promiseSummary = getVisitPromiseSummary({
    communications: continuityCommunications,
    job: linkedJob
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: linkedJob
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimateResult.data?.status ?? null,
    hasBlockingIssues: hasSupplyRisk,
    hasOwner: Boolean(linkedJob.assignedTechnicianUserId),
    hasPromise: Boolean(linkedJob.arrivalWindowStartAt ?? linkedJob.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: linkedJob.status
  });
  const trustSummary = getVisitTrustSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: linkedJob
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
    assignedTechnicianUserId: linkedJob.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: linkedJob.status
  });
  const serviceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount:
      linkedJob.status === "scheduled" || isTechnicianActiveFieldJobStatus(linkedJob.status) ? 1 : 0,
    commercialAccountMode: customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: linkedJob.vehicleId ? 1 : 0,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const customerThreadHref = buildCustomerWorkspaceHref(customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });

  async function addLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await addPartRequestLine(actionContext.supabase, requestId, {
      companyId: actionContext.companyId,
      jobId: detail.request.jobId,
      estimateId: detail.request.estimateId,
      description: getString(formData, "description"),
      manufacturer: getNullableString(formData, "manufacturer"),
      partNumber: getNullableString(formData, "partNumber"),
      supplierSku: getNullableString(formData, "supplierSku"),
      quantityRequested: getNumber(formData, "quantityRequested") || 1,
      quotedUnitCostCents: getNullableString(formData, "quotedUnitCostCents")
        ? getNumber(formData, "quotedUnitCostCents")
        : null,
      estimatedUnitCostCents: getNullableString(formData, "estimatedUnitCostCents")
        ? getNumber(formData, "estimatedUnitCostCents")
        : null,
      needsCore: formData.get("needsCore") === "on",
      coreChargeCents: getNumber(formData, "coreChargeCents"),
      notes: getNullableString(formData, "notes"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error) {
      throw result.error;
    }

    revalidateRequestPaths();
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function routeLinesAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await routePartRequestLinesToSupplierBuckets(actionContext.supabase, {
      companyId: actionContext.companyId,
      requestId,
      actorUserId: actionContext.currentUserId
    });

    if (result.error) {
      throw result.error;
    }

    revalidateRequestPaths();
  revalidatePath(buildVisitPartsHref(detail.request.jobId));
    const remainingOpenLineCount = result.data
      ? result.data.lines.filter(
          (line) =>
            getRemainingProcurementDemandQuantity(line) > 0 &&
            !line.lastSupplierAccountId
        ).length
      : 0;
    redirect(
      buildRequestFeedbackHref(
        requestPath,
        remainingOpenLineCount > 0 ? "partial" : "routed",
        remainingOpenLineCount
      )
    );
  }

  async function searchPartsTechAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await searchPartsTechForRequest(actionContext.supabase, {
      companyId: actionContext.companyId,
      requestId,
      requestedByUserId: actionContext.currentUserId
    });

    revalidateRequestPaths({ includeSupplySetup: true });
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function searchRepairLinkAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const selectedDealerMappingIds = formData
      .getAll("dealerMappingIds")
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean);

    await searchRepairLinkForRequest(actionContext.supabase, {
      companyId: actionContext.companyId,
      requestId,
      requestedByUserId: actionContext.currentUserId,
      selectedDealerMappingIds
    });

    revalidateRequestPaths({ includeSupplySetup: true });
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function searchAmazonBusinessAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const providerAccountId = amazonBusinessAccount?.id;

    if (!providerAccountId) {
      throw new Error("Configure Amazon Business before starting a supply sourcing session.");
    }

    const submittedSearchTerms = getString(formData, "searchTerms")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const supplyListId = getNullableString(formData, "supplyListId");

    if (!submittedSearchTerms.length && !supplyListId) {
      throw new Error(
        "Provide Amazon search terms or select an applied supply list before starting a supply sourcing session."
      );
    }

    const selectedPartRequestLineIds = routeableLines.map((line) => line.id);

    await searchAmazonBusinessForRequest(actionContext.supabase, {
      companyId: actionContext.companyId,
      providerAccountId,
      requestId,
      jobId: detail.request.jobId,
      requestedByUserId: actionContext.currentUserId,
      searchTerms: submittedSearchTerms,
      selectedPartRequestLineIds,
      supplyListId
    });

    revalidateRequestPaths({ includeSupplySetup: true });
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function applySupplyListAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await applySupplyListToRequest(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      requestId,
      supplyListId: getString(formData, "supplyListId")
    });

    revalidateRequestPaths();
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function capturePartsTechOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await createManualPartsTechQuoteLine(actionContext.supabase, {
      availabilityText: getNullableString(formData, "availabilityText"),
      companyId: actionContext.companyId,
      coreChargeCents: getNullableString(formData, "coreChargeCents")
        ? getNumber(formData, "coreChargeCents")
        : null,
      description: getString(formData, "description"),
      etaText: getNullableString(formData, "etaText"),
      manufacturer: getNullableString(formData, "manufacturer"),
      partNumber: getNullableString(formData, "partNumber"),
      partRequestLineId: getString(formData, "partRequestLineId"),
      providerSupplierKey: getNullableString(formData, "providerSupplierKey"),
      providerSupplierMappingId: getNullableString(formData, "providerSupplierMappingId"),
      providerSupplierName: getNullableString(formData, "providerSupplierName"),
      quantity: getNumber(formData, "quantity") || 1,
      requestId,
      requestedByUserId: actionContext.currentUserId,
      unitPriceCents: getNullableString(formData, "unitPriceCents")
        ? getNumber(formData, "unitPriceCents")
        : null
    });

    revalidateRequestPaths();
    redirect(requestPath);
  }

  async function convertPartsTechOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await convertPartsTechQuoteLineToSupplierCart(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      providerQuoteLineId: getString(formData, "providerQuoteLineId")
    });

    revalidateRequestPaths();
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function captureRepairLinkOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await createManualRepairLinkQuoteLine(actionContext.supabase, {
      availabilityText: getNullableString(formData, "availabilityText"),
      companyId: actionContext.companyId,
      coreChargeCents: getNullableString(formData, "coreChargeCents")
        ? getNumber(formData, "coreChargeCents")
        : null,
      description: getString(formData, "description"),
      etaText: getNullableString(formData, "etaText"),
      partNumber: getNullableString(formData, "partNumber"),
      partRequestLineId: getString(formData, "partRequestLineId"),
      providerSupplierMappingId: getString(formData, "providerSupplierMappingId"),
      quantity: getNumber(formData, "quantity") || 1,
      requestId,
      requestedByUserId: actionContext.currentUserId,
      unitPriceCents: getNullableString(formData, "unitPriceCents")
        ? getNumber(formData, "unitPriceCents")
        : null
    });

    revalidateRequestPaths();
    redirect(requestPath);
  }

  async function convertRepairLinkOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await convertRepairLinkQuoteLineToSupplierCart(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      providerQuoteLineId: getString(formData, "providerQuoteLineId")
    });

    revalidateRequestPaths();
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  async function captureAmazonBusinessOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await createManualAmazonBusinessQuoteLine(actionContext.supabase, {
      availabilityText: getNullableString(formData, "availabilityText"),
      companyId: actionContext.companyId,
      description: getString(formData, "description"),
      etaText: getNullableString(formData, "etaText"),
      partNumber: getNullableString(formData, "partNumber"),
      partRequestLineId: getString(formData, "partRequestLineId"),
      providerProductKey: getNullableString(formData, "providerProductKey"),
      quantity: getNumber(formData, "quantity") || 1,
      requestId,
      requestedByUserId: actionContext.currentUserId,
      unitPriceCents: getNullableString(formData, "unitPriceCents")
        ? getNumber(formData, "unitPriceCents")
        : null
    });

    revalidateRequestPaths();
    redirect(requestPath);
  }

  async function convertAmazonBusinessOfferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await convertAmazonBusinessQuoteLineToSupplierCart(actionContext.supabase, {
      actorUserId: actionContext.currentUserId,
      companyId: actionContext.companyId,
      providerQuoteLineId: getString(formData, "providerQuoteLineId")
    });

    revalidateRequestPaths();
    revalidatePath(buildVisitPartsHref(detail.request.jobId));
    redirect(requestPath);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts request"
        title={`Request ${detail.request.id.slice(0, 8).toUpperCase()}`}
        description={
          <>
            {detail.request.origin.replaceAll("_", " ")} request for visit{" "}
            <Link href={visitDetailHref}>{detail.request.jobId.slice(0, 8).toUpperCase()}</Link>.
          </>
        }
        actions={
          <>
            <form action={searchPartsTechAction}>
              <Button disabled={!routeableLines.length || !partsTechAccount} tone="secondary" type="submit">
                Search PartsTech
              </Button>
            </form>
            <form action={routeLinesAction}>
              <Button disabled={!routeableLines.length || !supplierAccounts.length} type="submit">
                Route to supplier carts
              </Button>
            </form>
            <Link
              className={buttonClassName({ tone: "tertiary" })}
              href="/dashboard/supply/integrations/partstech"
            >
              PartsTech settings
            </Link>
            <details className="procurement-thread-bar__utility">
              <summary className={buttonClassName({ tone: "tertiary" })}>More</summary>
              <div className="procurement-thread-bar__utility-actions">
                <Link
                  className="button secondary-button button-link"
                  href="/dashboard/supply/integrations/repairlink"
                >
                  RepairLink settings
                </Link>
                <Link
                  className="button secondary-button button-link"
                  href="/dashboard/supply/integrations/amazon-business"
                >
                  Amazon settings
                </Link>
                <Link
                  className="button secondary-button button-link"
                  href="/dashboard/supply/supplies"
                >
                  Supply lists
                </Link>
              </div>
            </details>
            <Link className={buttonClassName({ tone: "secondary" })} href={visitPartsHref}>
              Back to visit parts
            </Link>
          </>
        }
        status={<StatusBadge status={detail.request.status} />}
      />

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Active service thread</CardEyebrow>
            <CardTitle>Keep sourcing, release, and site continuity attached to this request</CardTitle>
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
            <Link className={buttonClassName({ tone: "secondary" })} href={visitDetailHref}>
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

      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.buildBody(unmatchedCount)}
        </Callout>
      ) : null}

      <Callout
        tone={getProviderCalloutTone(partsTechAccount?.status ?? null)}
        title="PartsTech aftermarket sourcing"
      >
        {partsTechAccount
          ? getProviderMessageFromMetadata(providerWorkspace.latestQuote?.quote.metadataJson) ??
            partsTechAccount.lastErrorMessage ??
              "Searches and order submissions use the PartsTech connector boundary and fall back to manual capture when full automation is not confirmed."
          : "Configure the PartsTech account first. Search sessions and manual PartsTech quote capture only become available after the provider is connected."}
      </Callout>

      <Callout
        tone={getProviderCalloutTone(repairLinkAccount?.status ?? null)}
        title="RepairLink OEM sourcing"
      >
        {repairLinkAccount
          ? getProviderMessageFromMetadata(repairLinkWorkspace.latestQuote?.quote.metadataJson) ??
            repairLinkAccount.lastErrorMessage ??
              (vehicleVin
                ? "RepairLink OEM sourcing uses VIN-linked dealer handoff and manual capture fallback until officially confirmed automation is available."
                : "Add a VIN to the linked vehicle before starting a RepairLink OEM search.")
          : "Configure the RepairLink account and dealer mappings first. VIN-linked search and manual OEM quote capture only open up after that setup is in place."}
      </Callout>

      <Callout
        tone={getProviderCalloutTone(amazonBusinessAccount?.status ?? null)}
        title="Amazon Business supplies sourcing"
      >
        {amazonBusinessAccount
          ? getProviderMessageFromMetadata(amazonBusinessWorkspace.latestQuote?.quote.metadataJson) ??
            amazonBusinessAccount.lastErrorMessage ??
              getAmazonBusinessFallbackDescription(amazonBusinessFallbackMode)
          : "Configure the Amazon Business account first. Supply search and manual Amazon quote capture are only available after the account is connected."}
      </Callout>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Request lines</CardEyebrow>
              <CardTitle>Demand-side lines</CardTitle>
              <CardDescription>These lines drive quoting, ordering, receiving, returns, and cost write-back.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.lines.length ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <HeaderCell>Description</HeaderCell>
                      <HeaderCell>Qty</HeaderCell>
                      <HeaderCell>Status</HeaderCell>
                      <HeaderCell>Quoted</HeaderCell>
                      <HeaderCell>Actual</HeaderCell>
                      <HeaderCell>Supplier</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <Cell>
                          <div className="ui-table-cell-title">
                            <strong>{line.description}</strong>
                            <p className="ui-table-cell-meta">
                              {line.partNumber ?? "No part number"}{line.needsCore ? " · Core due" : ""}
                            </p>
                          </div>
                        </Cell>
                        <Cell>{line.quantityRequested}</Cell>
                        <Cell>
                          <StatusBadge status={line.status} />
                        </Cell>
                        <Cell>{formatCurrencyFromCents(line.quotedUnitCostCents ?? 0)}</Cell>
                        <Cell>{formatCurrencyFromCents(line.actualUnitCostCents ?? 0)}</Cell>
                        <Cell>
                          {line.lastSupplierAccountId
                            ? (supplierAccountsById.get(line.lastSupplierAccountId)?.name ?? "Unknown supplier")
                            : "Unrouted"}
                        </Cell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState
                eyebrow="No lines"
                title="Add the first requested part"
                description="This request does not have any demand lines yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Add line</CardEyebrow>
              <CardTitle>Request another part</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={addLineAction}>
              <FormRow>
                <FormField label="Description" required>
                  <Input name="description" required />
                </FormField>
                <FormField label="Quantity">
                  <Input defaultValue="1" min="0.01" name="quantityRequested" step="0.01" type="number" />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Manufacturer">
                  <Input name="manufacturer" />
                </FormField>
                <FormField label="Part number">
                  <Input name="partNumber" />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Supplier SKU">
                  <Input name="supplierSku" />
                </FormField>
                <FormField label="Quoted unit cost (cents)">
                  <Input min="0" name="quotedUnitCostCents" type="number" />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Estimated unit cost (cents)">
                  <Input min="0" name="estimatedUnitCostCents" type="number" />
                </FormField>
                <FormField label="Core charge (cents)">
                  <Input defaultValue="0" min="0" name="coreChargeCents" type="number" />
                </FormField>
              </FormRow>
              <label className="ui-field__hint" style={{ display: "flex", gap: "0.5rem" }}>
                <input name="needsCore" type="checkbox" />
                Requires a core return
              </label>
              <FormField label="Notes">
                <Textarea name="notes" rows={3} />
              </FormField>
              <Button type="submit">Add request line</Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>PartsTech</CardEyebrow>
              <CardTitle>Capture or convert provider offers</CardTitle>
              <CardDescription>
                Use this when PartsTech can inform sourcing, but the confirmed provider workflow still requires manual capture or manual ordering fallback.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {partsTechAccount ? (
              <Form action={capturePartsTechOfferAction}>
                <FormRow>
                  <FormField label="Request line" required>
                    <Select name="partRequestLineId" required>
                      <option value="">Select request line</option>
                      {routeableLines.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.description} · qty {line.quantityRequested}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Supplier mapping">
                    <Select defaultValue="" name="providerSupplierMappingId">
                      <option value="">Manual supplier entry</option>
                      {providerWorkspace.supplierMappings.map((mapping) => (
                        <option key={mapping.id} value={mapping.id}>
                          {mapping.providerSupplierName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Provider supplier key">
                    <Input name="providerSupplierKey" />
                  </FormField>
                  <FormField label="Provider supplier name">
                    <Input name="providerSupplierName" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Description" required>
                    <Input name="description" required />
                  </FormField>
                  <FormField label="Quantity">
                    <Input defaultValue="1" min="0.01" name="quantity" step="0.01" type="number" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Manufacturer">
                    <Input name="manufacturer" />
                  </FormField>
                  <FormField label="Part number">
                    <Input name="partNumber" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Unit price (cents)">
                    <Input min="0" name="unitPriceCents" type="number" />
                  </FormField>
                  <FormField label="Core charge (cents)">
                    <Input min="0" name="coreChargeCents" type="number" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Availability">
                    <Input name="availabilityText" />
                  </FormField>
                  <FormField label="ETA">
                    <Input name="etaText" />
                  </FormField>
                </FormRow>
                <Button disabled={!routeableLines.length} type="submit">
                  Capture manual PartsTech offer
                </Button>
              </Form>
            ) : (
              <EmptyState
                eyebrow="No account"
                title="PartsTech is not configured"
                description="Open PartsTech settings first so this request can store search sessions or manually captured PartsTech quotes."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Latest PartsTech quote</CardEyebrow>
              <CardTitle>Provider quote session</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {providerWorkspace.latestQuote ? (
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">
                      Quote {providerWorkspace.latestQuote.quote.id.slice(0, 8).toUpperCase()}
                    </p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {providerWorkspace.latestQuote.lines.length} line(s) captured
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Unmapped offers: {providerWorkspace.unmappedQuoteLineCount}
                    </p>
                  </div>
                  <StatusBadge status={providerWorkspace.latestQuote.quote.status} />
                </article>

                {providerWorkspace.latestQuote.lines.map((line) => {
                  const mapping = line.providerSupplierMappingId
                    ? providerMappingsById.get(line.providerSupplierMappingId) ?? null
                    : null;

                  return (
                    <article key={line.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">{line.providerSupplierName}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          {formatCurrencyFromCents(line.unitPriceCents ?? 0)} · qty {line.quantity}
                          {line.availabilityText ? ` · ${line.availabilityText}` : ""}
                          {line.etaText ? ` · ETA ${line.etaText}` : ""}
                        </p>
                      </div>
                      <div className="ui-page-actions">
                        {mapping ? (
                          <StatusBadge status={mapping.status} />
                        ) : (
                          <StatusBadge status="unmapped" />
                        )}
                        <form action={convertPartsTechOfferAction}>
                          <input name="providerQuoteLineId" type="hidden" value={line.id} />
                          <Button
                            disabled={!mapping || line.selectedForCart}
                            size="sm"
                            tone="secondary"
                            type="submit"
                          >
                            {line.selectedForCart ? "Added to cart" : "Add to supplier cart"}
                          </Button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No PartsTech quote"
                title="No provider quote session yet"
                description="Search PartsTech or capture a manual offer to keep aftermarket sourcing provenance attached to this request."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
            <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>RepairLink</CardEyebrow>
              <CardTitle>VIN-linked OEM sourcing</CardTitle>
              <CardDescription>
                {getRepairLinkFallbackDescription(repairLinkFallbackMode)}
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {repairLinkAccount ? (
              <>
                <Form action={searchRepairLinkAction}>
                  <FormField
                    label="Vehicle VIN"
                    hint={
                      vehicleVin
                        ? "RepairLink searches use the vehicle VIN as the OEM lookup context."
                        : "Add a VIN to the linked vehicle before starting a RepairLink search."
                    }
                  >
                    <Input disabled value={vehicleVin ?? "VIN required"} />
                  </FormField>
                  <FormField
                    label="Dealer mappings"
                    hint={
                      activeRepairLinkMappings.length
                        ? "Choose one or more dealer mappings to include in the OEM search handoff."
                        : "Create at least one active dealer mapping that supports quote capture."
                    }
                  >
                    {activeRepairLinkMappings.length ? (
                      <div className="ui-list">
                        {activeRepairLinkMappings.map((mapping) => (
                          <label
                            key={mapping.id}
                            className="ui-list-item"
                            style={{ alignItems: "center", display: "flex", gap: "0.75rem" }}
                          >
                            <input
                              defaultChecked={defaultRepairLinkDealerMappingIds.has(mapping.id)}
                              name="dealerMappingIds"
                              type="checkbox"
                              value={mapping.id}
                            />
                            <div>
                              <strong>{mapping.providerSupplierName}</strong>
                              <p className="ui-card__description" style={{ marginBottom: 0 }}>
                                {mapping.providerSupplierKey}
                                {mapping.providerLocationKey ? ` - ${mapping.providerLocationKey}` : ""}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        eyebrow="No active dealers"
                        title="No dealer mappings available"
                        description="Open RepairLink settings and add an active dealer mapping before starting OEM search."
                      />
                    )}
                  </FormField>
                  <div className="ui-page-actions">
                    <Button
                      disabled={
                        !routeableLines.length ||
                        !vehicleVin ||
                        !repairLinkAccount ||
                        !activeRepairLinkMappings.length
                      }
                      tone="secondary"
                      type="submit"
                    >
                      {repairLinkFallbackMode === "manual_link_out"
                        ? "Start RepairLink handoff"
                        : "Search RepairLink"}
                    </Button>
                    <Link
                      className={buttonClassName({ tone: "tertiary" })}
                      href="/dashboard/supply/integrations/repairlink"
                    >
                      Manage dealer mappings
                    </Link>
                  </div>
                </Form>

                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid var(--ui-border-subtle)",
                    margin: "1rem 0"
                  }}
                />

                <Form action={captureRepairLinkOfferAction}>
                  <FormRow>
                    <FormField label="Request line" required>
                      <Select name="partRequestLineId" required>
                        <option value="">Select request line</option>
                        {routeableLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.description} - qty {line.quantityRequested}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Dealer mapping" required>
                      <Select name="providerSupplierMappingId" required>
                        <option value="">Select dealer mapping</option>
                        {activeRepairLinkMappings.map((mapping) => (
                          <option key={mapping.id} value={mapping.id}>
                            {mapping.providerSupplierName}
                            {mapping.providerLocationKey ? ` - ${mapping.providerLocationKey}` : ""}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="OEM description" required>
                      <Input name="description" required />
                    </FormField>
                    <FormField label="Quantity">
                      <Input defaultValue="1" min="0.01" name="quantity" step="0.01" type="number" />
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="OEM part number">
                      <Input name="partNumber" />
                    </FormField>
                    <FormField label="Unit price (cents)">
                      <Input min="0" name="unitPriceCents" type="number" />
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Core charge (cents)">
                      <Input min="0" name="coreChargeCents" type="number" />
                    </FormField>
                    <FormField label="Availability">
                      <Input name="availabilityText" />
                    </FormField>
                  </FormRow>
                  <FormField label="ETA">
                    <Input name="etaText" />
                  </FormField>
                  <Button
                    disabled={!routeableLines.length || !vehicleVin || !activeRepairLinkMappings.length}
                    type="submit"
                  >
                    {repairLinkFallbackMode === "manual_link_out"
                      ? "Capture OEM quote manually"
                      : "Capture manual RepairLink offer"}
                  </Button>
                </Form>
              </>
            ) : (
              <EmptyState
                eyebrow="No account"
                title="RepairLink is not configured"
                description="Open RepairLink settings first so VIN-linked search sessions and manual OEM quotes can be attached to this request."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Latest RepairLink quote</CardEyebrow>
              <CardTitle>OEM quote session</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {repairLinkWorkspace.latestQuote ? (
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">
                      Quote {repairLinkWorkspace.latestQuote.quote.id.slice(0, 8).toUpperCase()}
                    </p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {repairLinkWorkspace.latestQuote.lines.length} line(s) captured
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      VIN {vehicleVin ?? "missing"} - unmapped offers: {repairLinkWorkspace.unmappedQuoteLineCount}
                    </p>
                  </div>
                  <StatusBadge status={repairLinkWorkspace.latestQuote.quote.status} />
                </article>

                {repairLinkWorkspace.latestQuote.lines.map((line) => {
                  const mapping = line.providerSupplierMappingId
                    ? repairLinkMappingsById.get(line.providerSupplierMappingId) ?? null
                    : null;

                  return (
                    <article key={line.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">
                          {line.providerSupplierName}
                          {line.providerLocationKey ? ` - ${line.providerLocationKey}` : ""}
                        </p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {line.description}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          {formatCurrencyFromCents(line.unitPriceCents ?? 0)} - qty {line.quantity}
                          {line.availabilityText ? ` - ${line.availabilityText}` : ""}
                          {line.etaText ? ` - ETA ${line.etaText}` : ""}
                        </p>
                      </div>
                      <div className="ui-page-actions">
                        {mapping ? (
                          <StatusBadge status={mapping.status} />
                        ) : (
                          <StatusBadge status="unmapped" />
                        )}
                        <form action={convertRepairLinkOfferAction}>
                          <input name="providerQuoteLineId" type="hidden" value={line.id} />
                          <Button
                            disabled={!mapping || line.selectedForCart}
                            size="sm"
                            tone="secondary"
                            type="submit"
                          >
                            {line.selectedForCart ? "Added to cart" : "Add to supplier cart"}
                          </Button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No RepairLink quote"
                title="No OEM quote session yet"
                description="Start a VIN-linked RepairLink search or capture a manual OEM dealer quote to keep OEM provenance attached to this request."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Supply lists</CardEyebrow>
              <CardTitle>Apply reusable supplies</CardTitle>
              <CardDescription>
                Seed this request with repeatable consumables before searching Amazon Business.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {supplyListsWorkspace.lists.length ? (
              <Form action={applySupplyListAction}>
                <FormField label="Supply list" required>
                  <Select name="supplyListId" required>
                    <option value="">Select supply list</option>
                    {supplyListsWorkspace.lists
                      .filter((list) => list.isActive)
                      .map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                  </Select>
                </FormField>
                <div className="ui-page-actions">
                  <Button type="submit">Apply supply list</Button>
                  <Link
                    className={buttonClassName({ tone: "tertiary" })}
                    href="/dashboard/supply/supplies"
                  >
                    Manage supply lists
                  </Link>
                </div>
              </Form>
            ) : (
              <EmptyState
                eyebrow="No supply lists"
                title="Create a reusable supply kit"
                description="Open Supply lists to create reusable oils, shop-rag, and consumable kits for this request."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Amazon Business</CardEyebrow>
              <CardTitle>Supply-oriented sourcing</CardTitle>
              <CardDescription>
                {getAmazonBusinessFallbackDescription(amazonBusinessFallbackMode)}
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {amazonBusinessAccount ? (
              <>
                <Form action={searchAmazonBusinessAction}>
                <FormField
                  label="Search terms"
                  hint="Enter search terms directly, or leave this blank only when you selected an applied supply list below."
                >
                  <Input name="searchTerms" />
                </FormField>
                  <FormField
                    label="Applied supply list"
                    hint="Optional context only. Use this when the request was seeded from a reusable supply kit."
                  >
                    <Select defaultValue="" name="supplyListId">
                      <option value="">No supply list selected</option>
                      {supplyListsWorkspace.lists
                        .filter((list) => list.isActive)
                        .map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                    </Select>
                  </FormField>
                  <div className="ui-page-actions">
                    <Button disabled={!routeableLines.length} tone="secondary" type="submit">
                      {amazonBusinessFallbackMode === "manual_link_out"
                        ? "Start Amazon handoff"
                        : "Search Amazon Business"}
                    </Button>
                    <Link
                      className={buttonClassName({ tone: "tertiary" })}
                      href="/dashboard/supply/integrations/amazon-business"
                    >
                      Amazon settings
                    </Link>
                  </div>
                </Form>

                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid var(--ui-border-subtle)",
                    margin: "1rem 0"
                  }}
                />

                <Form action={captureAmazonBusinessOfferAction}>
                  <FormRow>
                    <FormField label="Request line" required>
                      <Select name="partRequestLineId" required>
                        <option value="">Select request line</option>
                        {routeableLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.description} - qty {line.quantityRequested}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Quantity">
                      <Input defaultValue="1" min="0.01" name="quantity" step="0.01" type="number" />
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Description" required>
                      <Input name="description" required />
                    </FormField>
                    <FormField label="Amazon product key">
                      <Input name="providerProductKey" />
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Part number">
                      <Input name="partNumber" />
                    </FormField>
                    <FormField label="Unit price (cents)">
                      <Input min="0" name="unitPriceCents" type="number" />
                    </FormField>
                  </FormRow>
                  <FormRow>
                    <FormField label="Availability">
                      <Input name="availabilityText" />
                    </FormField>
                    <FormField label="ETA">
                      <Input name="etaText" />
                    </FormField>
                  </FormRow>
                  <Button disabled={!routeableLines.length} type="submit">
                    {amazonBusinessFallbackMode === "manual_link_out"
                      ? "Capture Amazon offer manually"
                      : "Capture manual Amazon offer"}
                  </Button>
                </Form>
              </>
            ) : (
              <EmptyState
                eyebrow="No account"
                title="Amazon Business is not configured"
                description="Open Amazon Business settings first so supply searches and manual Amazon quotes can be attached to this request."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Latest Amazon Business quote</CardEyebrow>
            <CardTitle>Supply quote session</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {amazonBusinessWorkspace.latestQuote ? (
            <div className="ui-list">
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">
                    Quote {amazonBusinessWorkspace.latestQuote.quote.id.slice(0, 8).toUpperCase()}
                  </p>
                  <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                    {amazonBusinessWorkspace.latestQuote.lines.length} line(s) captured
                  </h3>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    Supply-oriented search and order provenance stay attached to this request.
                  </p>
                </div>
                <StatusBadge status={amazonBusinessWorkspace.latestQuote.quote.status} />
              </article>

              {amazonBusinessWorkspace.latestQuote.lines.map((line) => (
                <article key={line.id} className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">{line.providerSupplierName}</p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {line.description}
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      {formatCurrencyFromCents(line.unitPriceCents ?? 0)} - qty {line.quantity}
                      {line.providerProductKey ? ` - product ${line.providerProductKey}` : ""}
                      {line.availabilityText ? ` - ${line.availabilityText}` : ""}
                      {line.etaText ? ` - ETA ${line.etaText}` : ""}
                    </p>
                  </div>
                  <div className="ui-page-actions">
                    <Badge tone="neutral">Amazon Business</Badge>
                    <form action={convertAmazonBusinessOfferAction}>
                      <input name="providerQuoteLineId" type="hidden" value={line.id} />
                      <Button
                        disabled={!amazonBusinessAccount || line.selectedForCart}
                        size="sm"
                        tone="secondary"
                        type="submit"
                      >
                        {line.selectedForCart ? "Added to cart" : "Add to supplier cart"}
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No Amazon Business quote"
              title="No supplies quote session yet"
              description="Search Amazon Business or capture a manual supply offer to keep non-core purchasing provenance attached to this request."
            />
          )}
        </CardContent>
      </Card>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Linked carts</CardEyebrow>
              <CardTitle>Supplier buckets</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.linkedCarts.length ? (
              <div className="ui-list">
                {detail.linkedCarts.map((cart) => (
                  <article key={cart.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{cart.sourceBucketKey}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        Cart {cart.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {(supplierAccountsById.get(cart.supplierAccountId)?.name ?? "Unknown supplier")} · Updated{" "}
                        {formatDateTime(cart.updatedAt, { timeZone: context.company.timezone })}
                      </p>
                    </div>
                    <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={`/dashboard/supply/carts/${cart.id}`}>
                      Open cart
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No carts"
                title="No supplier buckets yet"
                description={supplierAccounts.length ? "Route the request to build grouped supplier carts." : "Add a supplier account before routing this request."}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Linked POs</CardEyebrow>
              <CardTitle>Purchase order trail</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.linkedPurchaseOrders.length ? (
              <div className="ui-list">
                {detail.linkedPurchaseOrders.map((purchaseOrder) => (
                  <article key={purchaseOrder.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{purchaseOrder.poNumber}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        PO {purchaseOrder.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {supplierAccountsById.get(purchaseOrder.supplierAccountId)?.name ?? "Unknown supplier"}
                      </p>
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
                eyebrow="No purchase orders"
                title="No PO created yet"
                description="Convert a routed supplier cart into a purchase order when you are ready to place the order."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
