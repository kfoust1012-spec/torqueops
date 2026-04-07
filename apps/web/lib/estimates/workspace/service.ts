import {
  type AppSupabaseClient,
  addSupplierCartLine,
  createSupplierAccount,
  createEstimate,
  createEstimateLineItems,
  createEstimateLineItem,
  createEstimateSection,
  deleteEstimateLineItem,
  deleteEstimateSection,
  findOrCreateOpenSupplierCart,
  getEstimateById,
  getEstimateByJobId,
  getEstimateDetailById,
  getSupplierAccountById,
  listEstimateLineItems,
  listEstimateSections,
  listPartRequestsByJobId,
  listProcurementProviderAccountsByCompany,
  listSupplierAccountsByCompany,
  updateProcurementProviderQuoteLineSelection,
  updatePartRequestLine,
  updateEstimate,
  updateEstimateLineItem,
  updateEstimateSection
} from "@mobile-mechanic/api-client";
import {
  buildEstimateVehicleContextSnapshot,
  buildPartsTechSearchTerms,
  calculateEstimateWorkspaceSummary,
  getEstimateLiveRetailerConnector,
  getVehicleDisplayName,
  groupEstimateWorkspaceLineItems
} from "@mobile-mechanic/core";
import type {
  EstimateCatalogPartOfferSummary,
  EstimateLiveRetailerPartOffer,
  ApplyEstimateServicePackageInput,
  CreateEstimateManualPartOfferInput,
  CreateEstimateInput,
  CreateEstimateLineItemInput,
  CreateEstimateServicePackageInput,
  CreateEstimateSectionInput,
  Database,
  EstimateManualPartOfferSummary,
  EstimatePartOfferSummary,
  EstimateServicePackage,
  EstimateServicePackageLine,
  EstimateWorkspace,
  EstimateWorkspaceLineItem,
  PartRequest,
  PartRequestLine,
  ProcurementProviderAccount,
  SearchEstimatePartOffersInput,
  SearchEstimateLiveRetailerOffersInput,
  SearchEstimateLiveRetailerOffersResult,
  SaveEstimateSectionAsPackageInput,
  SelectEstimateManualPartOfferInput,
  SelectEstimateCatalogPartOfferInput,
  SelectEstimateLiveRetailerOfferInput,
  SelectEstimatePartOfferInput,
  SupplierAccount,
  SupplierCart,
  SupplierCartLine,
  UpdateEstimateInput,
  UpdateEstimateLineItemInput,
  UpdateEstimateSectionInput
} from "@mobile-mechanic/types";
import {
  applyEstimateServicePackageInputSchema,
  createEstimateInputSchema,
  createEstimateManualPartOfferInputSchema,
  createEstimateLineItemInputSchema,
  createEstimateServicePackageInputSchema,
  createEstimateSectionInputSchema,
  searchEstimateLiveRetailerOffersInputSchema,
  saveEstimateSectionAsPackageInputSchema,
  searchEstimatePartOffersInputSchema,
  selectEstimateCatalogPartOfferInputSchema,
  selectEstimateLiveRetailerOfferInputSchema,
  selectEstimateManualPartOfferInputSchema,
  selectEstimatePartOfferInputSchema,
  updateEstimateInputSchema,
  updateEstimateLineItemInputSchema,
  updateEstimateSectionInputSchema
} from "@mobile-mechanic/validation";

import { startPartRequestFromEstimate } from "../../procurement/service";
import {
  buildVehicleAwareRetailerSearchQuery,
  searchOReillyRetailerOffers
} from "./live-retailer-search";
import { resolveEstimateCatalogPartOffers } from "./internal-parts-catalog";
import {
  convertAmazonBusinessQuoteLineToSupplierCart,
  convertPartsTechQuoteLineToSupplierCart,
  convertRepairLinkQuoteLineToSupplierCart,
  getAmazonBusinessRequestWorkspace,
  getRepairLinkRequestWorkspace,
  getRequestProviderWorkspace,
  searchAmazonBusinessForRequest,
  searchPartsTechForRequest,
  searchRepairLinkForRequest
} from "../../procurement/providers/service";
import {
  calculateSuggestedPartUnitPriceCents,
  resolveEstimateWorkspacePricingDefaults
} from "./pricing";

type EstimateServicePackageRow =
  Database["public"]["Tables"]["estimate_service_packages"]["Row"];
type EstimateServicePackageLineRow =
  Database["public"]["Tables"]["estimate_service_package_lines"]["Row"];
type EstimateLineItemRow = Database["public"]["Tables"]["estimate_line_items"]["Row"];
type PartRequestRow = Database["public"]["Tables"]["part_requests"]["Row"];
type PartRequestLineRow = Database["public"]["Tables"]["part_request_lines"]["Row"];
type SupplierCartRow = Database["public"]["Tables"]["supplier_carts"]["Row"];
type SupplierCartLineRow = Database["public"]["Tables"]["supplier_cart_lines"]["Row"];

type CreateEstimateWorkspaceSupplierAccountInput = {
  externalUrl?: string | null | undefined;
  name: string;
};

function mapServicePackageLineRow(row: EstimateServicePackageLineRow): EstimateServicePackageLine {
  return {
    id: row.id,
    servicePackageId: row.service_package_id,
    companyId: row.company_id,
    position: row.position,
    itemType: row.item_type as EstimateServicePackageLine["itemType"],
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    taxable: row.taxable,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    supplierSku: row.supplier_sku,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapServicePackageRow(
  row: EstimateServicePackageRow,
  lines: EstimateServicePackageLine[]
): EstimateServicePackage {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines
  };
}

function mapSupplierCartRow(row: SupplierCartRow): SupplierCart {
  return {
    id: row.id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    status: row.status,
    sourceBucketKey: row.source_bucket_key,
    createdByUserId: row.created_by_user_id,
    submittedByUserId: row.submitted_by_user_id,
    submittedAt: row.submitted_at,
    convertedPurchaseOrderId: row.converted_purchase_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupplierCartLineRow(row: SupplierCartLineRow): SupplierCartLine {
  return {
    id: row.id,
    cartId: row.cart_id,
    companyId: row.company_id,
    supplierAccountId: row.supplier_account_id,
    partRequestLineId: row.part_request_line_id,
    providerQuoteLineId: row.provider_quote_line_id,
    jobId: row.job_id,
    quotedUnitCostCents: row.quoted_unit_cost_cents,
    quotedCoreChargeCents: row.quoted_core_charge_cents,
    quantity: Number(row.quantity),
    supplierPartNumber: row.supplier_part_number,
    supplierUrl: row.supplier_url,
    availabilityText: row.availability_text,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartRequestRow(row: PartRequestRow): PartRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    origin: row.origin,
    status: row.status,
    requestedByUserId: row.requested_by_user_id,
    assignedBuyerUserId: row.assigned_buyer_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartRequestLineRow(row: PartRequestLineRow): PartRequestLine {
  return {
    id: row.id,
    partRequestId: row.part_request_id,
    companyId: row.company_id,
    jobId: row.job_id,
    estimateId: row.estimate_id,
    estimateLineItemId: row.estimate_line_item_id,
    inventoryItemId: row.inventory_item_id,
    quantityReservedFromStock: Number(row.quantity_reserved_from_stock),
    quantityConsumedFromStock: Number(row.quantity_consumed_from_stock),
    quantityIssuedFromInventory: Number(row.quantity_issued_from_inventory),
    quantityReturnedToInventory: Number(row.quantity_returned_to_inventory),
    status: row.status,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    supplierSku: row.supplier_sku,
    quantityRequested: Number(row.quantity_requested),
    quantityOrdered: Number(row.quantity_ordered),
    quantityReceived: Number(row.quantity_received),
    quantityInstalled: Number(row.quantity_installed),
    quantityReturned: Number(row.quantity_returned),
    quantityCoreDue: Number(row.quantity_core_due),
    quantityCoreReturned: Number(row.quantity_core_returned),
    quotedUnitCostCents: row.quoted_unit_cost_cents,
    estimatedUnitCostCents: row.estimated_unit_cost_cents,
    actualUnitCostCents: row.actual_unit_cost_cents,
    needsCore: row.needs_core,
    coreChargeCents: row.core_charge_cents,
    lastSupplierAccountId: row.last_supplier_account_id,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSupplierLabel(
  providerAccount: ProcurementProviderAccount | null,
  providerSupplierName: string
) {
  return providerAccount?.displayName?.trim()
    ? `${providerSupplierName} · ${providerAccount.displayName}`
    : providerSupplierName;
}

async function listEstimateServicePackagesByCompany(
  client: AppSupabaseClient,
  companyId: string
) {
  const [packagesResult, linesResult] = await Promise.all([
    client
      .from("estimate_service_packages")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .returns<EstimateServicePackageRow[]>(),
    client
      .from("estimate_service_package_lines")
      .select("*")
      .eq("company_id", companyId)
      .order("position", { ascending: true })
      .returns<EstimateServicePackageLineRow[]>()
  ]);

  if (packagesResult.error) {
    throw packagesResult.error;
  }

  if (linesResult.error) {
    throw linesResult.error;
  }

  const linesByPackageId = new Map<string, EstimateServicePackageLine[]>();

  for (const line of linesResult.data ?? []) {
    const mappedLine = mapServicePackageLineRow(line);
    const existingLines = linesByPackageId.get(line.service_package_id) ?? [];
    existingLines.push(mappedLine);
    linesByPackageId.set(line.service_package_id, existingLines);
  }

  return (packagesResult.data ?? []).map((row: EstimateServicePackageRow) =>
    mapServicePackageRow(row, linesByPackageId.get(row.id) ?? [])
  );
}

async function createEstimateServicePackage(
  client: AppSupabaseClient,
  input: CreateEstimateServicePackageInput
) {
  const parsed = createEstimateServicePackageInputSchema.parse(input);
  const packageResult = await client
    .from("estimate_service_packages")
    .insert({
      company_id: parsed.companyId,
      name: parsed.name.trim(),
      description: parsed.description ?? null,
      notes: parsed.notes ?? null,
      sort_order: parsed.sortOrder ?? 0,
      created_by_user_id: parsed.createdByUserId
    })
    .select("*")
    .single<EstimateServicePackageRow>();

  if (packageResult.error || !packageResult.data) {
    throw packageResult.error ?? new Error("Estimate service package could not be created.");
  }

  const linesPayload = parsed.lines.map((line, index) => ({
    service_package_id: packageResult.data.id,
    company_id: parsed.companyId,
    position: index,
    item_type: line.itemType,
    name: line.name.trim(),
    description: line.description ?? null,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
    taxable: line.taxable ?? true,
    manufacturer: line.manufacturer ?? null,
    part_number: line.partNumber ?? null,
    supplier_sku: line.supplierSku ?? null
  }));

  if (linesPayload.length) {
    const insertLinesResult = await client.from("estimate_service_package_lines").insert(linesPayload);

    if (insertLinesResult.error) {
      throw insertLinesResult.error;
    }
  }

  const packages = await listEstimateServicePackagesByCompany(client, parsed.companyId);
  const createdPackage = packages.find(
    (servicePackage: EstimateServicePackage) => servicePackage.id === packageResult.data.id
  );

  if (!createdPackage) {
    throw new Error("Estimate service package could not be reloaded.");
  }

  return createdPackage;
}

async function getEstimateLineItemRow(client: AppSupabaseClient, lineItemId: string) {
  const result = await client
    .from("estimate_line_items")
    .select("*")
    .eq("id", lineItemId)
    .single<EstimateLineItemRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate line item could not be loaded.");
  }

  return result.data;
}

async function getEstimatePartRequest(
  client: AppSupabaseClient,
  estimateId: string,
  jobId: string
) {
  const requestsResult = await listPartRequestsByJobId(client, jobId);

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  const matchingRequest =
    (requestsResult.data ?? []).find(
      (request) => request.estimateId === estimateId && request.status === "open"
    ) ??
    (requestsResult.data ?? []).find((request) => request.estimateId === estimateId) ??
    null;

  if (!matchingRequest) {
    return null;
  }

  const requestResult = await client
    .from("part_requests")
    .select("*")
    .eq("id", matchingRequest.id)
    .single<PartRequestRow>();

  if (requestResult.error || !requestResult.data) {
    throw requestResult.error ?? new Error("Estimate part request could not be loaded.");
  }

  const linesResult = await client
    .from("part_request_lines")
    .select("*")
    .eq("part_request_id", matchingRequest.id)
    .returns<PartRequestLineRow[]>();

  if (linesResult.error) {
    throw linesResult.error;
  }

  return {
    partRequest: mapPartRequestRow(requestResult.data),
    lines: (linesResult.data ?? []).map(mapPartRequestLineRow)
  };
}

function buildPartOffersByRequestLineId(input: {
  amazonBusinessWorkspace: Awaited<ReturnType<typeof getAmazonBusinessRequestWorkspace>>;
  partstechWorkspace: Awaited<ReturnType<typeof getRequestProviderWorkspace>>;
  repairLinkWorkspace: Awaited<ReturnType<typeof getRepairLinkRequestWorkspace>>;
}) {
  const offersByRequestLineId = new Map<string, EstimatePartOfferSummary[]>();

  function pushOffers(
    provider: EstimatePartOfferSummary["provider"],
    providerAccount: ProcurementProviderAccount | null,
    lines: EstimatePartOfferSummary["quoteLine"][] | null | undefined,
    quote: EstimatePartOfferSummary["quote"] | null | undefined
  ) {
    if (!quote || !lines?.length) {
      return;
    }

    for (const quoteLine of lines) {
      const offers = offersByRequestLineId.get(quoteLine.partRequestLineId) ?? [];
      offers.push({
        provider,
        providerAccount,
        quote,
        quoteLine,
        supplierLabel: toSupplierLabel(providerAccount, quoteLine.providerSupplierName),
        supplierMappingId: quoteLine.providerSupplierMappingId ?? null,
        isSelected: quoteLine.selectedForCart
      });
      offersByRequestLineId.set(quoteLine.partRequestLineId, offers);
    }
  }

  pushOffers(
    "partstech",
    input.partstechWorkspace.account,
    input.partstechWorkspace.latestQuote?.lines,
    input.partstechWorkspace.latestQuote?.quote
  );
  pushOffers(
    "repairlink",
    input.repairLinkWorkspace.account,
    input.repairLinkWorkspace.latestQuote?.lines,
    input.repairLinkWorkspace.latestQuote?.quote
  );
  pushOffers(
    "amazon_business",
    input.amazonBusinessWorkspace.account,
    input.amazonBusinessWorkspace.latestQuote?.lines,
    input.amazonBusinessWorkspace.latestQuote?.quote
  );

  return offersByRequestLineId;
}

function buildManualOffersByRequestLineId(input: {
  requestLinesById: Map<string, PartRequestLine>;
  supplierAccounts: SupplierAccount[];
  supplierCartLines: SupplierCartLine[];
  supplierCartsById: Map<string, SupplierCart>;
}) {
  const supplierAccountsById = new Map(
    input.supplierAccounts.map((supplierAccount) => [supplierAccount.id, supplierAccount])
  );
  const offersByRequestLineId = new Map<string, EstimateManualPartOfferSummary[]>();

  for (const cartLine of input.supplierCartLines) {
    const supplierAccount = supplierAccountsById.get(cartLine.supplierAccountId);
    const cart = input.supplierCartsById.get(cartLine.cartId);

    if (!supplierAccount || !cart) {
      continue;
    }

    const requestLine = input.requestLinesById.get(cartLine.partRequestLineId) ?? null;
    const isSelected =
      requestLine !== null &&
      requestLine.lastSupplierAccountId === cartLine.supplierAccountId &&
      requestLine.quotedUnitCostCents === cartLine.quotedUnitCostCents &&
      requestLine.coreChargeCents === cartLine.quotedCoreChargeCents &&
      (!requestLine.partNumber || !cartLine.supplierPartNumber || requestLine.partNumber === cartLine.supplierPartNumber);
    const offers = offersByRequestLineId.get(cartLine.partRequestLineId) ?? [];

    offers.push({
      supplierAccount,
      cart,
      cartLine,
      supplierLabel: supplierAccount.name,
      isSelected
    });
    offersByRequestLineId.set(cartLine.partRequestLineId, offers);
  }

  return offersByRequestLineId;
}

async function syncEstimatePartRequestIfNeeded(client: AppSupabaseClient, input: {
  companyId: string;
  estimateId: string;
  jobId: string;
  requestedByUserId: string;
}) {
  const [lineItemsResult, requestsResult] = await Promise.all([
    listEstimateLineItems(client, input.estimateId),
    listPartRequestsByJobId(client, input.jobId)
  ]);

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  const hasPartLines = (lineItemsResult.data ?? []).some((lineItem) => lineItem.itemType === "part");
  const hasExistingEstimateRequest = (requestsResult.data ?? []).some(
    (request) => request.estimateId === input.estimateId
  );

  if (!hasPartLines && !hasExistingEstimateRequest) {
    return null;
  }

  const requestResult = await startPartRequestFromEstimate(client, {
    companyId: input.companyId,
    estimateId: input.estimateId,
    jobId: input.jobId,
    requestedByUserId: input.requestedByUserId
  });

  if (requestResult.error) {
    throw requestResult.error;
  }

  return requestResult.data ?? null;
}

function buildPartLineDescription(requestLine: PartRequestLine) {
  const metadata = [
    requestLine.manufacturer,
    requestLine.partNumber ? `PN ${requestLine.partNumber}` : null,
    requestLine.supplierSku ? `SKU ${requestLine.supplierSku}` : null
  ].filter(Boolean);

  return metadata.length ? metadata.join(" · ") : requestLine.notes ?? null;
}

function slugifySupplierName(name: string) {
  const normalizedSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedSlug || "supplier";
}

function buildUniqueSupplierSlug(name: string, supplierAccounts: SupplierAccount[]) {
  const baseSlug = slugifySupplierName(name);
  const existingSlugs = new Set(supplierAccounts.map((supplierAccount) => supplierAccount.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function getPartRequestLineById(client: AppSupabaseClient, partRequestLineId: string) {
  const result = await client
    .from("part_request_lines")
    .select("*")
    .eq("id", partRequestLineId)
    .single<PartRequestLineRow>();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Part request line could not be loaded.");
  }

  return mapPartRequestLineRow(result.data);
}

async function refreshEstimatePartLineFromRequest(
  client: AppSupabaseClient,
  lineItemId: string,
  requestLine: PartRequestLine
) {
  const lineItemRow = await getEstimateLineItemRow(client, lineItemId);
  let nextUnitPriceCents = lineItemRow.unit_price_cents;

  if (nextUnitPriceCents <= 0) {
    const estimateLineItemsResult = await listEstimateLineItems(client, lineItemRow.estimate_id);

    if (estimateLineItemsResult.error) {
      throw estimateLineItemsResult.error;
    }

    const pricingDefaults = resolveEstimateWorkspacePricingDefaults(
      estimateLineItemsResult.data ?? []
    );

    nextUnitPriceCents = calculateSuggestedPartUnitPriceCents(
      requestLine.quotedUnitCostCents,
      pricingDefaults.partSellMultiplierBasisPoints
    );
  }

  const result = await updateEstimateLineItem(client, lineItemId, {
    estimateSectionId: lineItemRow.estimate_section_id,
    itemType: "part",
    name: requestLine.description,
    description: buildPartLineDescription(requestLine),
    quantity: Number(lineItemRow.quantity),
    unitPriceCents: nextUnitPriceCents,
    taxable: lineItemRow.taxable
  });

  if (result.error) {
    throw result.error;
  }

  return result.data ?? null;
}

function buildDefaultEstimateTitle(input: {
  jobTitle: string;
  vehicleLabel: string;
}) {
  return `${input.vehicleLabel || input.jobTitle} estimate`;
}

export function buildDefaultEstimateWorkspaceSeed(input: {
  jobTitle: string;
  vehicleLabel: string;
  jobId: string;
}) {
  const todayToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");

  return {
    estimateNumber: `EST-${todayToken}-${input.jobId.slice(0, 4).toUpperCase()}`,
    title: buildDefaultEstimateTitle({
      jobTitle: input.jobTitle,
      vehicleLabel: input.vehicleLabel
    })
  };
}

export async function getEstimateWorkspace(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string
) {
  const [
    detailResult,
    sectionsResult,
    servicePackagesResult,
    providerAccountsResult,
    supplierAccountsResult
  ] =
    await Promise.all([
      getEstimateDetailById(client, estimateId),
      listEstimateSections(client, estimateId),
      listEstimateServicePackagesByCompany(client, companyId),
      listProcurementProviderAccountsByCompany(client, companyId),
      listSupplierAccountsByCompany(client, companyId)
    ]);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Estimate builder could not be loaded.");
  }

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (providerAccountsResult.error) {
    throw providerAccountsResult.error;
  }
  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const detail = detailResult.data;
  const vehicleContext = buildEstimateVehicleContextSnapshot(detail.vehicle);
  const pricingDefaults = resolveEstimateWorkspacePricingDefaults(detail.lineItems);
  const supplierAccounts = (supplierAccountsResult.data ?? []).filter(
    (supplierAccount: SupplierAccount) => supplierAccount.isActive
  );
  const partRequestDetail = await getEstimatePartRequest(client, estimateId, detail.job.id);
  const [partstechWorkspace, repairLinkWorkspace, amazonBusinessWorkspace] = partRequestDetail?.partRequest
    ? await Promise.all([
        getRequestProviderWorkspace(client, companyId, partRequestDetail.partRequest.id),
        getRepairLinkRequestWorkspace(client, companyId, partRequestDetail.partRequest.id),
        getAmazonBusinessRequestWorkspace(client, companyId, partRequestDetail.partRequest.id)
      ])
    : await Promise.all([
        Promise.resolve({
          account: null,
          latestQuote: null,
          supplierMappings: [],
          unmappedQuoteLineCount: 0
        }),
        Promise.resolve({
          account: null,
          latestQuote: null,
          supplierMappings: [],
          unmappedQuoteLineCount: 0
        }),
        Promise.resolve({
          account: null,
          latestQuote: null,
          supplierMappings: [],
          unmappedQuoteLineCount: 0
        })
      ]);
  const offersByRequestLineId = buildPartOffersByRequestLineId({
    amazonBusinessWorkspace,
    partstechWorkspace,
    repairLinkWorkspace
  });
  const requestLinesById = new Map<string, PartRequestLine>(
    (partRequestDetail?.lines ?? []).map((line: PartRequestLine) => [line.id, line])
  );
  const requestLineIds = [...requestLinesById.keys()];
  let manualOffersByRequestLineId = new Map<string, EstimateManualPartOfferSummary[]>();

  if (requestLineIds.length) {
    const manualCartLinesResult = await client
      .from("supplier_cart_lines")
      .select("*")
      .in("part_request_line_id", requestLineIds)
      .is("provider_quote_line_id", null)
      .returns<SupplierCartLineRow[]>();

    if (manualCartLinesResult.error) {
      throw manualCartLinesResult.error;
    }

    const manualCartLines = (manualCartLinesResult.data ?? []).map(mapSupplierCartLineRow);
    const cartIds = [...new Set(manualCartLines.map((cartLine) => cartLine.cartId))];
    let supplierCartsById = new Map<string, SupplierCart>();

    if (cartIds.length) {
      const supplierCartsResult = await client
        .from("supplier_carts")
        .select("*")
        .in("id", cartIds)
        .returns<SupplierCartRow[]>();

      if (supplierCartsResult.error) {
        throw supplierCartsResult.error;
      }

      supplierCartsById = new Map(
        (supplierCartsResult.data ?? [])
          .map((row) => mapSupplierCartRow(row))
          .filter((cart) => cart.status !== "abandoned")
          .map((cart) => [cart.id, cart] as const)
      );
    }

    manualOffersByRequestLineId = buildManualOffersByRequestLineId({
      requestLinesById,
      supplierAccounts,
      supplierCartLines: manualCartLines.filter((cartLine) => supplierCartsById.has(cartLine.cartId)),
      supplierCartsById
    });
  }
  const workspaceLineItems: EstimateWorkspaceLineItem[] = detail.lineItems.map((lineItem: typeof detail.lineItems[number]) => ({
    ...lineItem,
    linkedPartRequestLine: lineItem.partRequestLineId
      ? requestLinesById.get(lineItem.partRequestLineId) ?? null
      : null,
    partOffers: lineItem.partRequestLineId
      ? offersByRequestLineId.get(lineItem.partRequestLineId) ?? []
      : [],
    manualPartOffers: lineItem.partRequestLineId
      ? manualOffersByRequestLineId.get(lineItem.partRequestLineId) ?? []
      : [],
    catalogPartOffers:
      lineItem.itemType === "part"
        ? resolveEstimateCatalogPartOffers({
            lineItem: {
              name: lineItem.name,
              description: lineItem.description
            },
            supplierAccounts,
            vehicleContext
          })
        : []
  }));
  const groupedLines = groupEstimateWorkspaceLineItems({
    lineItems: workspaceLineItems,
    sections: sectionsResult.data ?? []
  });

  return {
    estimate: detail.estimate,
    job: detail.job,
    customer: detail.customer,
    vehicle: detail.vehicle,
    vehicleContext,
    totals: detail.totals,
    summary: calculateEstimateWorkspaceSummary(groupedLines),
    pricingDefaults,
    sections: groupedLines.sections,
    ungroupedLineItems: groupedLines.ungroupedLineItems,
    partRequest: partRequestDetail?.partRequest ?? null,
    servicePackages: servicePackagesResult,
    providerAccounts: providerAccountsResult.data ?? [],
    supplierAccounts,
    signature: detail.signature
  } satisfies EstimateWorkspace;
}

export async function getEstimateWorkspaceByJobId(
  client: AppSupabaseClient,
  companyId: string,
  jobId: string
) {
  const estimateResult = await getEstimateByJobId(client, jobId);

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  if (!estimateResult.data) {
    return null;
  }

  return getEstimateWorkspace(client, companyId, estimateResult.data.id);
}

export async function createEstimateWorkspace(
  client: AppSupabaseClient,
  input: CreateEstimateInput
) {
  const parsed = createEstimateInputSchema.parse(input);
  const estimateResult = await createEstimate(client, parsed);

  if (estimateResult.error || !estimateResult.data) {
    throw estimateResult.error ?? new Error("Estimate builder could not be created.");
  }

  const sectionsResult = await listEstimateSections(client, estimateResult.data.id);

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (!(sectionsResult.data ?? []).length) {
    await createEstimateSection(client, createEstimateSectionInputSchema.parse({
      estimateId: estimateResult.data.id,
      companyId: parsed.companyId,
      jobId: parsed.jobId,
      title: "Recommended work",
      description: "Primary estimate assembly area for labor, parts, and fees.",
      notes: null,
      source: "manual",
      sourceRef: null,
      createdByUserId: parsed.createdByUserId
    }));
  }

  return getEstimateWorkspace(client, parsed.companyId, estimateResult.data.id);
}

export async function updateEstimateWorkspaceMeta(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  input: UpdateEstimateInput
) {
  const parsed = updateEstimateInputSchema.parse(input);
  const result = await updateEstimate(client, estimateId, parsed);

  if (result.error) {
    throw result.error;
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function createEstimateWorkspaceSection(
  client: AppSupabaseClient,
  companyId: string,
  input: CreateEstimateSectionInput
) {
  const parsed = createEstimateSectionInputSchema.parse(input);
  const result = await createEstimateSection(client, parsed);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate section could not be created.");
  }

  return getEstimateWorkspace(client, companyId, parsed.estimateId);
}

export async function updateEstimateWorkspaceSection(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  sectionId: string,
  input: UpdateEstimateSectionInput
) {
  const parsed = updateEstimateSectionInputSchema.parse(input);
  const result = await updateEstimateSection(client, sectionId, parsed);

  if (result.error) {
    throw result.error;
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function deleteEstimateWorkspaceSection(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  sectionId: string
) {
  const result = await deleteEstimateSection(client, sectionId);

  if (result.error) {
    throw result.error;
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function createEstimateWorkspaceLineItem(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  actorUserId: string,
  input: CreateEstimateLineItemInput
) {
  const parsed = createEstimateLineItemInputSchema.parse(input);
  const estimateResult = await getEstimateById(client, estimateId);

  if (estimateResult.error || !estimateResult.data) {
    throw estimateResult.error ?? new Error("Estimate could not be loaded.");
  }

  let normalizedInput = parsed;

  if (parsed.itemType === "labor" && parsed.unitPriceCents <= 0) {
    const estimateLineItemsResult = await listEstimateLineItems(client, estimateId);

    if (estimateLineItemsResult.error) {
      throw estimateLineItemsResult.error;
    }

    normalizedInput = {
      ...parsed,
      unitPriceCents: resolveEstimateWorkspacePricingDefaults(
        estimateLineItemsResult.data ?? []
      ).laborRateCents
    };
  }

  const result = await createEstimateLineItem(client, estimateId, normalizedInput);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate line item could not be created.");
  }

  if (normalizedInput.itemType === "part") {
    await syncEstimatePartRequestIfNeeded(client, {
      companyId,
      estimateId,
      jobId: estimateResult.data.jobId,
      requestedByUserId: actorUserId
    });

    await autoSourceBestEstimateCatalogOffers(client, companyId, actorUserId, estimateId, {
      lineItemIds: [result.data.id]
    });
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function createEstimateWorkspaceSupplierAccount(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  input: CreateEstimateWorkspaceSupplierAccountInput
) {
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Enter a supplier name before saving it to the estimate.");
  }

  const supplierAccountsResult = await listSupplierAccountsByCompany(client, companyId);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const result = await createSupplierAccount(client, {
    companyId,
    name: normalizedName,
    slug: buildUniqueSupplierSlug(normalizedName, supplierAccountsResult.data ?? []),
    mode: "manual",
    externalUrl: input.externalUrl?.trim() ? input.externalUrl.trim() : null,
    contactEmail: null,
    contactName: null,
    contactPhone: null,
    notes: null,
    sortOrder: 0
  });

  if (result.error || !result.data) {
    throw result.error ?? new Error("Supplier account could not be created.");
  }

  return {
    supplierAccountId: result.data.id,
    workspace: await getEstimateWorkspace(client, companyId, estimateId)
  };
}

export async function updateEstimateWorkspaceLineItem(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  lineItemId: string,
  input: UpdateEstimateLineItemInput
) {
  const parsed = updateEstimateLineItemInputSchema.parse(input);
  const existingLineItemRow = await getEstimateLineItemRow(client, lineItemId);
  const result = await updateEstimateLineItem(client, lineItemId, parsed);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate line item could not be updated.");
  }

  if (parsed.itemType === "part" || existingLineItemRow.item_type === "part") {
    await syncEstimatePartRequestIfNeeded(client, {
      companyId,
      estimateId: existingLineItemRow.estimate_id,
      jobId: existingLineItemRow.job_id,
      requestedByUserId: actorUserId
    });
  }

  return getEstimateWorkspace(client, companyId, existingLineItemRow.estimate_id);
}

export async function deleteEstimateWorkspaceLineItem(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  lineItemId: string
) {
  const existingLineItemRow = await getEstimateLineItemRow(client, lineItemId);
  const result = await deleteEstimateLineItem(client, lineItemId);

  if (result.error) {
    throw result.error;
  }

  if (existingLineItemRow.item_type === "part") {
    await syncEstimatePartRequestIfNeeded(client, {
      companyId,
      estimateId: existingLineItemRow.estimate_id,
      jobId: existingLineItemRow.job_id,
      requestedByUserId: actorUserId
    });
  }

  return getEstimateWorkspace(client, companyId, existingLineItemRow.estimate_id);
}

export async function applyEstimateWorkspaceServicePackage(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  actorUserId: string,
  input: ApplyEstimateServicePackageInput
) {
  const parsed = applyEstimateServicePackageInputSchema.parse(input);
  const estimateResult = await getEstimateById(client, estimateId);

  if (estimateResult.error || !estimateResult.data) {
    throw estimateResult.error ?? new Error("Estimate could not be loaded.");
  }

  const servicePackages = await listEstimateServicePackagesByCompany(client, companyId);
  const servicePackage = servicePackages.find(
    (candidate: EstimateServicePackage) => candidate.id === parsed.servicePackageId
  );

  if (!servicePackage) {
    throw new Error("Estimate service package could not be found.");
  }

  const sectionResult = await createEstimateSection(client, {
    estimateId,
    companyId,
    jobId: estimateResult.data.jobId,
    title: parsed.targetSectionTitle?.trim() || servicePackage.name,
    description: servicePackage.description ?? null,
    notes: servicePackage.notes ?? null,
    source: "service_package",
    sourceRef: servicePackage.id,
    createdByUserId: actorUserId
  });

  if (sectionResult.error || !sectionResult.data) {
    throw sectionResult.error ?? new Error("Estimate package section could not be created.");
  }

  const sectionId = sectionResult.data.id;
  const lineResult = await createEstimateLineItems(
    client,
    estimateId,
    servicePackage.lines.map((line: EstimateServicePackageLine) => ({
      estimateSectionId: sectionId,
      itemType: line.itemType,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      taxable: line.taxable
    }))
  );

  if (lineResult.error) {
    throw lineResult.error;
  }

  if (servicePackage.lines.some((line: EstimateServicePackageLine) => line.itemType === "part")) {
    await syncEstimatePartRequestIfNeeded(client, {
      companyId,
      estimateId,
      jobId: estimateResult.data.jobId,
      requestedByUserId: actorUserId
    });

    await autoSourceBestEstimateCatalogOffers(client, companyId, actorUserId, estimateId, {
      lineItemIds: (lineResult.data ?? [])
        .filter((lineItem) => lineItem.itemType === "part")
        .map((lineItem) => lineItem.id)
    });
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function saveEstimateWorkspaceSectionAsPackage(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  sectionId: string,
  input: SaveEstimateSectionAsPackageInput
) {
  const parsed = saveEstimateSectionAsPackageInputSchema.parse(input);
  const sectionResult = await client
    .from("estimate_sections")
    .select("*")
    .eq("id", sectionId)
    .single<Database["public"]["Tables"]["estimate_sections"]["Row"]>();

  if (sectionResult.error || !sectionResult.data) {
    throw sectionResult.error ?? new Error("Estimate section could not be loaded.");
  }

  const lineItemsResult = await client
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_section_id", sectionId)
    .order("position", { ascending: true })
    .returns<EstimateLineItemRow[]>();

  if (lineItemsResult.error) {
    throw lineItemsResult.error;
  }

  const lineItems = lineItemsResult.data ?? [];

  if (!lineItems.length) {
    throw new Error("Add at least one line item before saving a section as a package.");
  }

  return createEstimateServicePackage(client, {
    companyId,
    createdByUserId: actorUserId,
    name: parsed.name,
    description: parsed.description ?? sectionResult.data.description,
    notes: parsed.notes ?? sectionResult.data.notes,
    lines: lineItems.map((lineItem: EstimateLineItemRow) => ({
      itemType: lineItem.item_type as EstimateServicePackageLine["itemType"],
      name: lineItem.name,
      description: lineItem.description,
      quantity: Number(lineItem.quantity),
      unitPriceCents: lineItem.unit_price_cents,
      taxable: lineItem.taxable
    }))
  });
}

export async function searchEstimatePartOffers(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: SearchEstimatePartOffersInput
) {
  const parsed = searchEstimatePartOffersInputSchema.parse(input);
  const estimateResult = await getEstimateById(client, estimateId);

  if (estimateResult.error || !estimateResult.data) {
    throw estimateResult.error ?? new Error("Estimate could not be loaded.");
  }

  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can open the sourcing panel.");
  }

  const syncedRequest = await syncEstimatePartRequestIfNeeded(client, {
    companyId,
    estimateId,
    jobId: estimateResult.data.jobId,
    requestedByUserId: actorUserId
  });
  const refreshedLineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (!refreshedLineItemRow.part_request_line_id || !syncedRequest?.request.id) {
    throw new Error("The selected estimate part line could not be linked to a sourcing request.");
  }

  if (parsed.provider === "partstech") {
    await searchPartsTechForRequest(client, {
      companyId,
      requestId: syncedRequest.request.id,
      requestedByUserId: actorUserId,
      searchTerms:
        parsed.searchTerms && parsed.searchTerms.length
          ? parsed.searchTerms
          : buildPartsTechSearchTerms([
              {
                description: refreshedLineItemRow.name,
                partNumber: null
              }
            ]),
      selectedPartRequestLineIds: [refreshedLineItemRow.part_request_line_id]
    });
  }

  if (parsed.provider === "repairlink") {
    await searchRepairLinkForRequest(client, {
      companyId,
      requestId: syncedRequest.request.id,
      requestedByUserId: actorUserId,
      selectedPartRequestLineIds: [refreshedLineItemRow.part_request_line_id],
      selectedDealerMappingIds: parsed.selectedDealerMappingIds ?? []
    });
  }

  if (parsed.provider === "amazon_business") {
    const providerAccounts = await listProcurementProviderAccountsByCompany(client, companyId);

    if (providerAccounts.error) {
      throw providerAccounts.error;
    }

    const amazonAccount = (providerAccounts.data ?? []).find(
      (account) => account.provider === "amazon_business"
    );

    if (!amazonAccount) {
      throw new Error("Configure Amazon Business before starting supply sourcing.");
    }

    await searchAmazonBusinessForRequest(client, {
      companyId,
      providerAccountId: amazonAccount.id,
      requestId: syncedRequest.request.id,
      jobId: estimateResult.data.jobId,
      estimateId,
      requestedByUserId: actorUserId,
      selectedPartRequestLineIds: [refreshedLineItemRow.part_request_line_id],
      searchTerms:
        parsed.searchTerms && parsed.searchTerms.length
          ? parsed.searchTerms
          : [refreshedLineItemRow.name],
      supplyListId: null
    });
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function selectEstimatePartOffer(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: SelectEstimatePartOfferInput
) {
  const parsed = selectEstimatePartOfferInputSchema.parse(input);
  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  const quoteLineResult = await client
    .from("procurement_provider_quote_lines")
    .select("id, provider_quote_id, part_request_line_id")
    .eq("id", parsed.providerQuoteLineId)
    .single<{
      id: string;
      provider_quote_id: string;
      part_request_line_id: string;
    }>();

  if (quoteLineResult.error || !quoteLineResult.data) {
    throw quoteLineResult.error ?? new Error("Selected provider offer could not be loaded.");
  }

  const quoteResult = await client
    .from("procurement_provider_quotes")
    .select("provider_account_id")
    .eq("id", quoteLineResult.data.provider_quote_id)
    .single<{ provider_account_id: string }>();

  if (quoteResult.error || !quoteResult.data) {
    throw quoteResult.error ?? new Error("Provider quote session could not be loaded.");
  }

  const providerAccountResult = await client
    .from("procurement_provider_accounts")
    .select("provider")
    .eq("id", quoteResult.data.provider_account_id)
    .single<{ provider: EstimatePartOfferSummary["provider"] }>();

  if (providerAccountResult.error || !providerAccountResult.data) {
    throw providerAccountResult.error ?? new Error("Provider account could not be loaded.");
  }

  if (providerAccountResult.data.provider === "partstech") {
    await convertPartsTechQuoteLineToSupplierCart(client, {
      actorUserId,
      companyId,
      providerQuoteLineId: parsed.providerQuoteLineId
    });
  }

  if (providerAccountResult.data.provider === "repairlink") {
    await convertRepairLinkQuoteLineToSupplierCart(client, {
      actorUserId,
      companyId,
      providerQuoteLineId: parsed.providerQuoteLineId
    });
  }

  if (providerAccountResult.data.provider === "amazon_business") {
    await convertAmazonBusinessQuoteLineToSupplierCart(client, {
      actorUserId,
      companyId,
      providerQuoteLineId: parsed.providerQuoteLineId
    });
  }

  const requestLine = await getPartRequestLineById(client, quoteLineResult.data.part_request_line_id);
  await refreshEstimatePartLineFromRequest(client, parsed.lineItemId, requestLine);

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function createEstimateManualPartOffer(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: CreateEstimateManualPartOfferInput
) {
  const parsed = createEstimateManualPartOfferInputSchema.parse(input);
  const estimateResult = await getEstimateById(client, estimateId);

  if (estimateResult.error || !estimateResult.data) {
    throw estimateResult.error ?? new Error("Estimate could not be loaded.");
  }

  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can store supplier offers.");
  }

  const supplierAccountResult = await getSupplierAccountById(client, parsed.supplierAccountId);

  if (supplierAccountResult.error || !supplierAccountResult.data) {
    throw supplierAccountResult.error ?? new Error("Supplier account could not be loaded.");
  }

  if (supplierAccountResult.data.companyId !== companyId || !supplierAccountResult.data.isActive) {
    throw new Error("Select an active supplier account before saving an offer.");
  }

  await syncEstimatePartRequestIfNeeded(client, {
    companyId,
    estimateId,
    jobId: estimateResult.data.jobId,
    requestedByUserId: actorUserId
  });

  const refreshedLineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (!refreshedLineItemRow.part_request_line_id) {
    throw new Error("The selected estimate part line could not be linked to a sourcing request.");
  }

  const requestLine = await getPartRequestLineById(client, refreshedLineItemRow.part_request_line_id);
  const cartResult = await findOrCreateOpenSupplierCart(
    client,
    companyId,
    parsed.supplierAccountId,
    `estimate-manual:${requestLine.partRequestId}`,
    actorUserId
  );

  if (cartResult.error || !cartResult.data) {
    throw cartResult.error ?? new Error("Supplier cart could not be prepared.");
  }

  const existingManualLinesResult = await client
    .from("supplier_cart_lines")
    .select("*")
    .eq("cart_id", cartResult.data.id)
    .eq("part_request_line_id", requestLine.id)
    .is("provider_quote_line_id", null)
    .order("updated_at", { ascending: false })
    .returns<SupplierCartLineRow[]>();

  if (existingManualLinesResult.error) {
    throw existingManualLinesResult.error;
  }

  const existingManualLine = existingManualLinesResult.data?.[0] ?? null;
  const supplierUrl =
    parsed.supplierUrl === undefined
      ? supplierAccountResult.data.externalUrl
      : parsed.supplierUrl;
  let savedCartLineId: string | null = null;

  if (existingManualLine) {
    const updateManualLineResult = await client
      .from("supplier_cart_lines")
      .update({
        quoted_unit_cost_cents: parsed.quotedUnitCostCents,
        quoted_core_charge_cents: parsed.quotedCoreChargeCents ?? 0,
        quantity: requestLine.quantityRequested,
        supplier_part_number: parsed.supplierPartNumber ?? null,
        supplier_url: supplierUrl ?? null,
        availability_text: parsed.availabilityText ?? null,
        notes: parsed.notes ?? null
      })
      .eq("id", existingManualLine.id)
      .select("*")
      .single<SupplierCartLineRow>();

    if (updateManualLineResult.error || !updateManualLineResult.data) {
      throw updateManualLineResult.error;
    }

    savedCartLineId = updateManualLineResult.data.id;
  } else {
    const addManualLineResult = await addSupplierCartLine(client, cartResult.data.id, {
      companyId,
      supplierAccountId: parsed.supplierAccountId,
      partRequestLineId: requestLine.id,
      jobId: refreshedLineItemRow.job_id,
      quantity: requestLine.quantityRequested,
      quotedUnitCostCents: parsed.quotedUnitCostCents,
      quotedCoreChargeCents: parsed.quotedCoreChargeCents ?? 0,
      supplierPartNumber: parsed.supplierPartNumber ?? null,
      supplierUrl: supplierUrl ?? null,
      availabilityText: parsed.availabilityText ?? null,
      notes: parsed.notes ?? null
    });

    if (addManualLineResult.error) {
      throw addManualLineResult.error;
    }

    savedCartLineId = addManualLineResult.data?.id ?? null;
  }

  if (parsed.selectAfterCreate && savedCartLineId) {
    return selectEstimateManualPartOffer(client, companyId, estimateId, {
      lineItemId: parsed.lineItemId,
      supplierCartLineId: savedCartLineId
    });
  }

  return getEstimateWorkspace(client, companyId, estimateId);
}

export async function selectEstimateManualPartOffer(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  input: SelectEstimateManualPartOfferInput
) {
  const parsed = selectEstimateManualPartOfferInputSchema.parse(input);
  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can choose supplier offers.");
  }

  const supplierCartLineResult = await client
    .from("supplier_cart_lines")
    .select("*")
    .eq("id", parsed.supplierCartLineId)
    .single<SupplierCartLineRow>();

  if (supplierCartLineResult.error || !supplierCartLineResult.data) {
    throw supplierCartLineResult.error ?? new Error("Selected manual supplier offer could not be loaded.");
  }

  const supplierCartLine = mapSupplierCartLineRow(supplierCartLineResult.data);

  if (
    lineItemRow.part_request_line_id &&
    supplierCartLine.partRequestLineId !== lineItemRow.part_request_line_id
  ) {
    throw new Error("Selected manual supplier offer does not belong to this part line.");
  }

  if (typeof supplierCartLine.quotedUnitCostCents !== "number") {
    throw new Error("Selected manual supplier offer is missing a quoted price.");
  }

  const requestLine = await getPartRequestLineById(client, supplierCartLine.partRequestLineId);

  if (requestLine.estimateId !== estimateId || requestLine.estimateLineItemId !== parsed.lineItemId) {
    throw new Error("Selected manual supplier offer does not belong to this estimate part line.");
  }

  const updateRequestLineResult = await updatePartRequestLine(client, requestLine.id, {
    description: requestLine.description,
    manufacturer: requestLine.manufacturer,
    partNumber: supplierCartLine.supplierPartNumber ?? requestLine.partNumber,
    supplierSku: requestLine.supplierSku,
    quantityRequested: requestLine.quantityRequested,
    quotedUnitCostCents: supplierCartLine.quotedUnitCostCents,
    estimatedUnitCostCents: supplierCartLine.quotedUnitCostCents,
    needsCore: requestLine.needsCore,
    coreChargeCents: supplierCartLine.quotedCoreChargeCents ?? 0,
    lastSupplierAccountId: supplierCartLine.supplierAccountId,
    notes: requestLine.notes
  });

  if (updateRequestLineResult.error || !updateRequestLineResult.data) {
    throw updateRequestLineResult.error ?? new Error("Part request line could not be updated.");
  }

  const selectedProviderQuoteLinesResult = await client
    .from("procurement_provider_quote_lines")
    .select("id")
    .eq("part_request_line_id", requestLine.id)
    .eq("selected_for_cart", true)
    .returns<Array<{ id: string }>>();

  if (selectedProviderQuoteLinesResult.error) {
    throw selectedProviderQuoteLinesResult.error;
  }

  await Promise.all(
    (selectedProviderQuoteLinesResult.data ?? []).map((quoteLine) =>
      updateProcurementProviderQuoteLineSelection(client, quoteLine.id, false)
    )
  );

  await refreshEstimatePartLineFromRequest(client, parsed.lineItemId, updateRequestLineResult.data);

  return getEstimateWorkspace(client, companyId, estimateId);
}

async function ensureSupplierAccountForSourcedOffer(
  client: AppSupabaseClient,
  companyId: string,
  supplierAccounts: SupplierAccount[],
  input: {
    notes: string;
    supplierAccountId?: string | null | undefined;
    supplierLabel: string;
    supplierUrl?: string | null | undefined;
  }
) {
  if (input.supplierAccountId) {
    const existingSupplierAccount = supplierAccounts.find(
      (supplierAccount) => supplierAccount.id === input.supplierAccountId
    );

    if (existingSupplierAccount) {
      return existingSupplierAccount;
    }
  }

  const matchingSupplierAccount =
    supplierAccounts.find(
      (supplierAccount) =>
        slugifySupplierName(supplierAccount.name) === slugifySupplierName(input.supplierLabel)
    ) ?? null;

  if (matchingSupplierAccount) {
    return matchingSupplierAccount;
  }

  const createdSupplierAccountResult = await createSupplierAccount(client, {
    companyId,
    name: input.supplierLabel,
    slug: buildUniqueSupplierSlug(input.supplierLabel, supplierAccounts),
    mode: "manual",
    externalUrl: input.supplierUrl ?? null,
    contactEmail: null,
    contactName: null,
    contactPhone: null,
    notes: input.notes,
    sortOrder: 0
  });

  if (createdSupplierAccountResult.error || !createdSupplierAccountResult.data) {
    throw createdSupplierAccountResult.error ?? new Error("Suggested supplier could not be prepared.");
  }

  return createdSupplierAccountResult.data;
}

export async function selectEstimateCatalogPartOffer(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: SelectEstimateCatalogPartOfferInput
) {
  const parsed = selectEstimateCatalogPartOfferInputSchema.parse(input);
  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can choose fitment suggestions.");
  }

  const [detailResult, supplierAccountsResult] = await Promise.all([
    getEstimateDetailById(client, estimateId),
    listSupplierAccountsByCompany(client, companyId)
  ]);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Estimate could not be loaded.");
  }

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const supplierAccounts = (supplierAccountsResult.data ?? []).filter(
    (supplierAccount) => supplierAccount.isActive
  );
  const matchingLineItem =
    detailResult.data.lineItems.find((lineItem) => lineItem.id === parsed.lineItemId) ?? null;

  if (!matchingLineItem) {
    throw new Error("Selected estimate part line could not be loaded.");
  }

  const matchingOffer =
    resolveEstimateCatalogPartOffers({
      lineItem: {
        name: matchingLineItem.name,
        description: matchingLineItem.description
      },
      supplierAccounts,
      vehicleContext: buildEstimateVehicleContextSnapshot(detailResult.data.vehicle)
    }).find((offer) => offer.id === parsed.offerId) ?? null;

  if (!matchingOffer) {
    throw new Error("Suggested fitment offer could not be found for this part line.");
  }

  const supplierAccount = await ensureSupplierAccountForSourcedOffer(
    client,
    companyId,
    supplierAccounts,
    {
      notes: "Auto-created from the internal fitment catalog.",
      supplierAccountId: matchingOffer.supplierAccountId,
      supplierLabel: matchingOffer.supplierLabel,
      supplierUrl: matchingOffer.supplierUrl
    }
  );

  return createEstimateManualPartOffer(client, companyId, actorUserId, estimateId, {
    lineItemId: parsed.lineItemId,
    supplierAccountId: supplierAccount.id,
    supplierPartNumber: matchingOffer.partNumber,
    quotedUnitCostCents: matchingOffer.quotedUnitCostCents,
    quotedCoreChargeCents: 0,
    availabilityText: matchingOffer.availabilityText,
    supplierUrl: matchingOffer.supplierUrl,
    notes: matchingOffer.fitmentNotes,
    selectAfterCreate: true
  });
}

export async function autoSourceBestEstimateCatalogOffers(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: {
    lineItemIds: string[];
  }
) {
  const requestedLineItemIds = [...new Set(input.lineItemIds.filter(Boolean))];

  if (!requestedLineItemIds.length) {
    return [] as string[];
  }

  const workspace = await getEstimateWorkspace(client, companyId, estimateId);
  const vehicleContext = workspace.vehicleContext;
  const supplierAccounts = workspace.supplierAccounts.filter(
    (supplierAccount) => supplierAccount.isActive
  );
  const lineItems = [
    ...workspace.ungroupedLineItems,
    ...workspace.sections.flatMap((sectionDetail) => sectionDetail.lineItems)
  ];
  const autoSourcedLineItemIds: string[] = [];

  for (const lineItemId of requestedLineItemIds) {
    const lineItem = lineItems.find((candidate) => candidate.id === lineItemId) ?? null;

    if (!lineItem || lineItem.itemType !== "part") {
      continue;
    }

    const alreadyHasSelectedSource =
      Boolean(lineItem.linkedPartRequestLine?.partNumber) ||
      lineItem.manualPartOffers.some((offer) => offer.isSelected) ||
      lineItem.partOffers.some((offer) => offer.isSelected);

    if (alreadyHasSelectedSource) {
      continue;
    }

    const bestCatalogOffer =
      resolveEstimateCatalogPartOffers({
        lineItem: {
          name: lineItem.name,
          description: lineItem.description
        },
        supplierAccounts,
        vehicleContext
      })[0] ?? null;

    if (!bestCatalogOffer) {
      continue;
    }

    await selectEstimateCatalogPartOffer(client, companyId, actorUserId, estimateId, {
      lineItemId,
      offerId: bestCatalogOffer.id
    });
    autoSourcedLineItemIds.push(lineItemId);
  }

  return autoSourcedLineItemIds;
}

export async function searchEstimateLiveRetailerOffers(
  client: AppSupabaseClient,
  companyId: string,
  estimateId: string,
  input: SearchEstimateLiveRetailerOffersInput
) {
  const parsed = searchEstimateLiveRetailerOffersInputSchema.parse(input);
  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can run retailer lookup.");
  }

  const detailResult = await getEstimateDetailById(client, estimateId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Estimate could not be loaded.");
  }

  const matchingLineItem =
    detailResult.data.lineItems.find((lineItem) => lineItem.id === parsed.lineItemId) ?? null;

  if (!matchingLineItem) {
    throw new Error("Selected estimate part line could not be loaded.");
  }

  const searchQuery = buildVehicleAwareRetailerSearchQuery({
    explicitQuery: parsed.query,
    fallbackQuery: matchingLineItem.name,
    vehicleContext: buildEstimateVehicleContextSnapshot(detailResult.data.vehicle)
  });

  if (!searchQuery) {
    throw new Error("Enter a part description before retailer lookup can run.");
  }

  const connector = getEstimateLiveRetailerConnector(parsed.provider ?? "oreilly");
  let offers: EstimateLiveRetailerPartOffer[] = [];
  let providerLabel = connector.label;

  if (!parsed.provider || parsed.provider === "oreilly") {
    offers = await searchOReillyRetailerOffers({
      limit: parsed.limit,
      query: searchQuery
    });
  }

  return {
    connector,
    offers,
    provider: parsed.provider ?? "oreilly",
    providerLabel,
    query: searchQuery
  } satisfies SearchEstimateLiveRetailerOffersResult;
}

export async function selectEstimateLiveRetailerOffer(
  client: AppSupabaseClient,
  companyId: string,
  actorUserId: string,
  estimateId: string,
  input: SelectEstimateLiveRetailerOfferInput
) {
  const parsed = selectEstimateLiveRetailerOfferInputSchema.parse(input);
  const lineItemRow = await getEstimateLineItemRow(client, parsed.lineItemId);

  if (lineItemRow.estimate_id !== estimateId) {
    throw new Error("Selected estimate line item does not belong to this estimate.");
  }

  if (lineItemRow.item_type !== "part") {
    throw new Error("Only estimate part lines can choose live retailer offers.");
  }

  const supplierAccountsResult = await listSupplierAccountsByCompany(client, companyId);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const supplierAccounts = (supplierAccountsResult.data ?? []).filter(
    (supplierAccount) => supplierAccount.isActive
  );
  const supplierAccount = await ensureSupplierAccountForSourcedOffer(client, companyId, supplierAccounts, {
    notes: `Auto-created from live ${parsed.offer.supplierLabel} retailer lookup.`,
    supplierLabel: parsed.offer.supplierLabel,
    supplierUrl: parsed.offer.supplierUrl
  });

  return createEstimateManualPartOffer(client, companyId, actorUserId, estimateId, {
    lineItemId: parsed.lineItemId,
    supplierAccountId: supplierAccount.id,
    supplierPartNumber: parsed.offer.partNumber,
    quotedUnitCostCents: parsed.offer.quotedUnitCostCents,
    quotedCoreChargeCents: parsed.offer.quotedCoreChargeCents,
    availabilityText: parsed.offer.availabilityText,
    supplierUrl: parsed.offer.supplierUrl,
    notes: parsed.offer.fitmentNotes,
    selectAfterCreate: true
  });
}
