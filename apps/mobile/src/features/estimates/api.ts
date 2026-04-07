import {
  addSupplierCartLine,
  changeEstimateStatus,
  createEstimate,
  createEstimateLineItem,
  createPartRequestFromEstimate,
  createSupplierAccount,
  deleteEstimateLineItem,
  findOrCreateOpenSupplierCart,
  getAssignedJobDetailForTechnician,
  getAssignedJobEstimateSummary,
  getPartRequestById,
  getSupplierCartById,
  listPartRequestsByJobId,
  listSupplierAccountsByCompany,
  listSupplierCartsByJobId,
  updateEstimate,
  updateEstimateLineItem,
  updatePartRequestLine,
  updateSupplierCartLine
} from "@mobile-mechanic/api-client";
import {
  calculateEstimateLineSubtotalCents,
  calculateEstimateTotals,
  getVehicleDisplayName
} from "@mobile-mechanic/core";
import type {
  ChangeEstimateStatusInput,
  CreateEstimateLineItemInput,
  EstimateLineItem,
  EstimateLiveRetailerSearchProvider,
  EstimateTotals,
  PartRequestLine,
  SearchEstimateLiveRetailerOffersResult,
  SupplierAccount,
  SupplierCartLine,
  TechnicianJobDetail,
  UpdateEstimateInput,
  UpdateEstimateLineItemInput
} from "@mobile-mechanic/types";

import { mobileEnv } from "../../env";
import {
  loadCachedAssignedEstimate,
  loadQueuedAssignedEstimateMutations,
  saveCachedAssignedEstimate,
  saveQueuedAssignedEstimateMutations
} from "./offline-estimate-store";
import { loadCachedAssignedJobDetail } from "../jobs/offline-job-store";
import { supabase } from "../../lib/supabase";

type AssignedEstimateSummaryResult = Awaited<ReturnType<typeof getAssignedJobEstimateSummary>>;
type BaseAssignedEstimateDetail = NonNullable<AssignedEstimateSummaryResult["data"]>;

export type AssignedEstimateContext = {
  companyId: string;
  jobId: string;
  technicianUserId: string;
};

export type AssignedEstimatePartSource = {
  lineItemId: string;
  requestLine: PartRequestLine | null;
  selectedSupplierAccount: SupplierAccount | null;
  selectedCartLine: SupplierCartLine | null;
};

export type AssignedEstimateDetail = BaseAssignedEstimateDetail & {
  pendingMutationCount?: number | undefined;
  partSources: AssignedEstimatePartSource[];
  supplierAccounts: SupplierAccount[];
};

type SaveAssignedJobEstimatePartSourceInput = {
  availabilityText?: string | null | undefined;
  coreChargeCents?: number | undefined;
  lineItemId: string;
  notes?: string | null | undefined;
  quotedUnitCostCents: number;
  supplierAccountId?: string | null | undefined;
  supplierName?: string | null | undefined;
  supplierPartNumber?: string | null | undefined;
  supplierUrl?: string | null | undefined;
};

type SearchAssignedJobEstimateLiveRetailerOffersInput = {
  lineItemId: string;
  limit?: number | undefined;
  provider?: EstimateLiveRetailerSearchProvider | undefined;
  query?: string | null | undefined;
};

type QueuedAssignedEstimateMutation =
  | {
      createdAt: string;
      estimateId: string;
      jobId: string;
      mutationId: string;
      mutationType: "create_draft";
    }
  | {
      createdAt: string;
      estimateId: string;
      input: UpdateEstimateInput;
      jobId: string;
      mutationId: string;
      mutationType: "save_draft";
    }
  | {
      createdAt: string;
      estimateId: string;
      input: CreateEstimateLineItemInput;
      jobId: string;
      mutationId: string;
      mutationType: "add_line";
      tempLineItemId: string;
    }
  | {
      createdAt: string;
      input: UpdateEstimateLineItemInput;
      jobId: string;
      lineItemId: string;
      mutationId: string;
      mutationType: "save_line";
    }
  | {
      createdAt: string;
      jobId: string;
      lineItemId: string;
      mutationId: string;
      mutationType: "remove_line";
    }
  | {
      createdAt: string;
      estimateId: string;
      input: SaveAssignedJobEstimatePartSourceInput;
      jobId: string;
      mutationId: string;
      mutationType: "save_part_source";
    };

function buildDefaultEstimateDraftSeed(input: {
  jobId: string;
  jobTitle: string;
  vehicleLabel: string;
}) {
  const todayToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");

  return {
    estimateNumber: `EST-${todayToken}-${input.jobId.slice(0, 4).toUpperCase()}`,
    title: `${input.vehicleLabel || input.jobTitle} estimate`
  };
}

function buildOfflineAssignedEstimateDetail(
  context: AssignedEstimateContext,
  jobDetail: TechnicianJobDetail,
  estimateId: string
): AssignedEstimateDetail {
  const timestamp = new Date().toISOString();
  const vehicleLabel = getVehicleDisplayName({
    year: jobDetail.vehicle.year,
    make: jobDetail.vehicle.make,
    model: jobDetail.vehicle.model
  });
  const seed = buildDefaultEstimateDraftSeed({
    jobId: context.jobId,
    jobTitle: jobDetail.job.title,
    vehicleLabel
  });
  const totals = calculateEstimateTotals({
    discountCents: 0,
    lineItems: [],
    taxRateBasisPoints: 0
  }) satisfies EstimateTotals;

  return {
    customer: jobDetail.customer,
    estimate: {
      acceptedAt: null,
      approvalStatement: null,
      approvedByName: null,
      approvedSignatureId: null,
      companyId: context.companyId,
      createdAt: timestamp,
      createdByUserId: context.technicianUserId,
      currencyCode: "USD",
      declinedAt: null,
      discountCents: totals.discountCents,
      estimateNumber: seed.estimateNumber,
      id: estimateId,
      jobId: context.jobId,
      notes: null,
      sentAt: null,
      status: "draft",
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      taxRateBasisPoints: 0,
      terms: null,
      title: seed.title,
      totalCents: totals.totalCents,
      updatedAt: timestamp,
      voidedAt: null
    },
    job: jobDetail.job,
    lineItems: [],
    partSources: [],
    signature: null,
    supplierAccounts: [],
    totals,
    vehicle: jobDetail.vehicle
  };
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

async function hydrateAssignedEstimateDetail(
  context: AssignedEstimateContext,
  detail: BaseAssignedEstimateDetail
): Promise<AssignedEstimateDetail> {
  const [supplierAccountsResult, requestsResult, cartsResult] = await Promise.all([
    listSupplierAccountsByCompany(supabase, context.companyId),
    listPartRequestsByJobId(supabase, context.jobId),
    listSupplierCartsByJobId(supabase, context.jobId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  if (cartsResult.error) {
    throw cartsResult.error;
  }

  const supplierAccounts = (supplierAccountsResult.data ?? []).filter(
    (supplierAccount) => supplierAccount.isActive
  );
  const supplierAccountsById = new Map(
    supplierAccounts.map((supplierAccount) => [supplierAccount.id, supplierAccount])
  );
  const matchingRequests = (requestsResult.data ?? []).filter(
    (request) => request.estimateId === detail.estimate.id
  );
  const activeRequest =
    matchingRequests.find((request) => request.status === "open") ?? matchingRequests[0] ?? null;
  const requestDetailResult = activeRequest
    ? await getPartRequestById(supabase, activeRequest.id)
    : { data: null, error: null };

  if (requestDetailResult.error) {
    throw requestDetailResult.error;
  }

  const cartDetails = await Promise.all(
    (cartsResult.data ?? []).map((cart) => getSupplierCartById(supabase, cart.id))
  );

  for (const cartDetail of cartDetails) {
    if (cartDetail.error) {
      throw cartDetail.error;
    }
  }

  const requestLinesByEstimateLineItemId = new Map(
    (requestDetailResult.data?.lines ?? [])
      .filter((line) => Boolean(line.estimateLineItemId))
      .map((line) => [line.estimateLineItemId!, line])
  );

  const partSources = detail.lineItems
    .filter((lineItem) => lineItem.itemType === "part")
    .map((lineItem) => {
      const requestLine = requestLinesByEstimateLineItemId.get(lineItem.id) ?? null;
      let selectedSupplierAccount: SupplierAccount | null = null;
      let selectedCartLine: SupplierCartLine | null = null;

      if (requestLine) {
        const matchingCartLines = cartDetails.flatMap((cartDetail) =>
          (cartDetail.data?.lines ?? [])
            .filter(
              (entry) =>
                entry.requestLine.id === requestLine.id &&
                entry.cartLine.providerQuoteLineId === null
            )
            .map((entry) => ({
              cartLine: entry.cartLine,
              supplierAccount: cartDetail.data?.supplierAccount ?? null
            }))
        );

        const selectedEntry =
          matchingCartLines.find(
            (entry) => entry.supplierAccount?.id === requestLine.lastSupplierAccountId
          ) ??
          matchingCartLines.find(
            (entry) => entry.cartLine.quotedUnitCostCents === requestLine.quotedUnitCostCents
          ) ??
          matchingCartLines[0] ??
          null;

        selectedCartLine = selectedEntry?.cartLine ?? null;
        selectedSupplierAccount =
          selectedEntry?.supplierAccount ??
          (requestLine.lastSupplierAccountId
            ? supplierAccountsById.get(requestLine.lastSupplierAccountId) ?? null
            : null);
      }

      return {
        lineItemId: lineItem.id,
        requestLine,
        selectedSupplierAccount,
        selectedCartLine
      } satisfies AssignedEstimatePartSource;
    });

  return {
    ...detail,
    partSources,
    supplierAccounts
  };
}

function buildFallbackAssignedEstimateDetail(
  detail: BaseAssignedEstimateDetail
): AssignedEstimateDetail {
  return {
    ...detail,
    partSources: detail.lineItems
      .filter((lineItem) => lineItem.itemType === "part")
      .map((lineItem) => ({
        lineItemId: lineItem.id,
        requestLine: null,
        selectedCartLine: null,
        selectedSupplierAccount: null
      })),
    supplierAccounts: []
  };
}

async function loadAssignedJobEstimateRemote(
  context: AssignedEstimateContext
): Promise<AssignedEstimateDetail | null> {
  const result = await getAssignedJobEstimateSummary(
    supabase,
    context.companyId,
    context.technicianUserId,
    context.jobId
  );

  if (result.error) {
    if ("code" in result.error && result.error.code === "PGRST116") {
      throw new Error("Assigned job not found.");
    }

    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  try {
    return await hydrateAssignedEstimateDetail(context, result.data);
  } catch (error) {
    if (__DEV__) {
      console.warn("[estimate-load] using fallback detail without sourcing side-data", {
        error: error instanceof Error ? error.message : String(error),
        jobId: context.jobId
      });
    }

    return buildFallbackAssignedEstimateDetail(result.data);
  }
}

export async function loadAssignedJobEstimate(
  companyId: string,
  technicianUserId: string,
  jobId: string
): Promise<AssignedEstimateDetail | null> {
  const context = {
    companyId,
    jobId,
    technicianUserId
  } satisfies AssignedEstimateContext;
  const cachedDetail = await loadCachedAssignedEstimate<AssignedEstimateDetail>(jobId);

  await flushQueuedAssignedEstimateMutations(context);
  const pendingMutationCount = await countQueuedAssignedEstimateMutations(jobId);
  let hydratedDetail: AssignedEstimateDetail | null = null;

  try {
    hydratedDetail = await loadAssignedJobEstimateRemote(context);
  } catch (error) {
    if (cachedDetail) {
      return withPendingMutationCount(cachedDetail, pendingMutationCount);
    }

    throw error;
  }

  if (!hydratedDetail) {
    return cachedDetail ? withPendingMutationCount(cachedDetail, pendingMutationCount) : null;
  }

  if (pendingMutationCount > 0 && cachedDetail) {
    return withPendingMutationCount(cachedDetail, pendingMutationCount);
  }

  await saveCachedAssignedEstimate(jobId, hydratedDetail);
  return withPendingMutationCount(hydratedDetail, pendingMutationCount);
}

async function reloadAssignedJobEstimate(
  context: AssignedEstimateContext
): Promise<AssignedEstimateDetail> {
  const detail = await loadAssignedJobEstimateRemote(context);

  if (!detail) {
    throw new Error("Assigned estimate could not be loaded.");
  }

  return detail;
}

function buildOfflineEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function withPendingMutationCount(
  detail: AssignedEstimateDetail,
  pendingMutationCount: number
): AssignedEstimateDetail {
  return {
    ...detail,
    pendingMutationCount
  };
}

async function countQueuedAssignedEstimateMutations(jobId: string) {
  const queue = await loadQueuedAssignedEstimateMutations<QueuedAssignedEstimateMutation>();
  return queue.filter((entry) => entry.jobId === jobId).length;
}

async function enqueueAssignedEstimateMutation(entry: QueuedAssignedEstimateMutation) {
  const queue = await loadQueuedAssignedEstimateMutations<QueuedAssignedEstimateMutation>();
  queue.push(entry);
  await saveQueuedAssignedEstimateMutations(queue);
  return queue.filter((candidate) => candidate.jobId === entry.jobId).length;
}

function normalizeLineItem(lineItem: EstimateLineItem): EstimateLineItem {
  return {
    ...lineItem,
    lineSubtotalCents: calculateEstimateLineSubtotalCents(lineItem.quantity, lineItem.unitPriceCents)
  };
}

function applyAssignedEstimateTotals(
  detail: AssignedEstimateDetail,
  nextLineItems: EstimateLineItem[],
  overrides?: {
    discountCents?: number | undefined;
    taxRateBasisPoints?: number | undefined;
  }
): AssignedEstimateDetail {
  const normalizedLineItems = nextLineItems.map(normalizeLineItem);
  const discountCents = overrides?.discountCents ?? detail.estimate.discountCents;
  const taxRateBasisPoints =
    overrides?.taxRateBasisPoints ?? detail.estimate.taxRateBasisPoints;
  const totals = calculateEstimateTotals({
    discountCents,
    lineItems: normalizedLineItems,
    taxRateBasisPoints
  }) satisfies EstimateTotals;

  return {
    ...detail,
    estimate: {
      ...detail.estimate,
      discountCents: totals.discountCents,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      taxRateBasisPoints,
      totalCents: totals.totalCents
    },
    lineItems: normalizedLineItems,
    totals
  };
}

function syncPartSourcesToLineItems(
  lineItems: EstimateLineItem[],
  existingPartSources: AssignedEstimatePartSource[]
) {
  const existingByLineItemId = new Map(
    existingPartSources.map((partSource) => [partSource.lineItemId, partSource])
  );

  return lineItems
    .filter((lineItem) => lineItem.itemType === "part")
    .map((lineItem) => {
      const existingPartSource = existingByLineItemId.get(lineItem.id);

      return (
        existingPartSource ?? {
          lineItemId: lineItem.id,
          requestLine: null,
          selectedCartLine: null,
          selectedSupplierAccount: null
        }
      );
    });
}

function applyDraftUpdateOptimistically(
  detail: AssignedEstimateDetail,
  input: UpdateEstimateInput
): AssignedEstimateDetail {
  const nextDetail = applyAssignedEstimateTotals(detail, detail.lineItems, {
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints
  });

  return {
    ...nextDetail,
    estimate: {
      ...nextDetail.estimate,
      estimateNumber: input.estimateNumber,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      title: input.title
    }
  };
}

function buildOptimisticLineItem(
  detail: AssignedEstimateDetail,
  lineItemId: string,
  input: CreateEstimateLineItemInput | UpdateEstimateLineItemInput
): EstimateLineItem {
  const timestamp = new Date().toISOString();

  return normalizeLineItem({
    id: lineItemId,
    actualCostCents: null,
    companyId: detail.estimate.companyId,
    createdAt: timestamp,
    description: input.description ?? null,
    estimateId: detail.estimate.id,
    estimateSectionId: input.estimateSectionId ?? null,
    estimatedCostCents: null,
    itemType: input.itemType,
    jobId: detail.estimate.jobId,
    lineSubtotalCents: 0,
    name: input.name,
    partRequestLineId: null,
    position:
      detail.lineItems.reduce((highestPosition, lineItem) => Math.max(highestPosition, lineItem.position), -1) + 1,
    quantity: input.quantity,
    taxable: input.taxable ?? true,
    unitPriceCents: input.unitPriceCents,
    updatedAt: timestamp
  });
}

function applyAddLineOptimistically(
  detail: AssignedEstimateDetail,
  tempLineItemId: string,
  input: CreateEstimateLineItemInput
): AssignedEstimateDetail {
  const nextLineItems = [...detail.lineItems, buildOptimisticLineItem(detail, tempLineItemId, input)];
  const nextDetail = applyAssignedEstimateTotals(detail, nextLineItems);

  return {
    ...nextDetail,
    partSources: syncPartSourcesToLineItems(nextDetail.lineItems, detail.partSources)
  };
}

function applySaveLineOptimistically(
  detail: AssignedEstimateDetail,
  lineItemId: string,
  input: UpdateEstimateLineItemInput
): AssignedEstimateDetail {
  const nextLineItems = detail.lineItems.map((lineItem) =>
    lineItem.id === lineItemId
      ? normalizeLineItem({
          ...lineItem,
          description: input.description ?? null,
          estimateSectionId: input.estimateSectionId ?? null,
          itemType: input.itemType,
          name: input.name,
          quantity: input.quantity,
          taxable: input.taxable ?? true,
          unitPriceCents: input.unitPriceCents,
          updatedAt: new Date().toISOString()
        })
      : lineItem
  );
  const nextDetail = applyAssignedEstimateTotals(detail, nextLineItems);

  return {
    ...nextDetail,
    partSources: syncPartSourcesToLineItems(nextDetail.lineItems, detail.partSources)
  };
}

function applyRemoveLineOptimistically(detail: AssignedEstimateDetail, lineItemId: string) {
  const nextLineItems = detail.lineItems.filter((lineItem) => lineItem.id !== lineItemId);
  const nextDetail = applyAssignedEstimateTotals(detail, nextLineItems);

  return {
    ...nextDetail,
    partSources: syncPartSourcesToLineItems(nextDetail.lineItems, detail.partSources)
  };
}

function resolveOptimisticSupplierAccount(
  detail: AssignedEstimateDetail,
  input: SaveAssignedJobEstimatePartSourceInput
) {
  if (input.supplierAccountId) {
    return (
      detail.supplierAccounts.find((supplierAccount) => supplierAccount.id === input.supplierAccountId) ??
      null
    );
  }

  const normalizedSupplierName = input.supplierName?.trim().toLowerCase() ?? "";

  if (!normalizedSupplierName) {
    return null;
  }

  const existingSupplierAccount =
    detail.supplierAccounts.find(
      (supplierAccount) => supplierAccount.name.trim().toLowerCase() === normalizedSupplierName
    ) ?? null;

  if (existingSupplierAccount) {
    return existingSupplierAccount;
  }

  const timestamp = new Date().toISOString();

  return {
    id: buildOfflineEntityId("offline-supplier"),
    companyId: detail.estimate.companyId,
    contactEmail: null,
    contactName: null,
    contactPhone: null,
    createdAt: timestamp,
    externalUrl: input.supplierUrl?.trim() || null,
    isActive: true,
    mode: "manual",
    name: input.supplierName?.trim() ?? "Manual supplier",
    notes: "Created while this estimate was offline.",
    slug: slugifySupplierName(input.supplierName?.trim() ?? "Manual supplier"),
    sortOrder: detail.supplierAccounts.length,
    updatedAt: timestamp
  } satisfies SupplierAccount;
}

function applyPartSourceOptimistically(
  detail: AssignedEstimateDetail,
  input: SaveAssignedJobEstimatePartSourceInput
): AssignedEstimateDetail {
  const supplierAccount = resolveOptimisticSupplierAccount(detail, input);
  const lineItem = detail.lineItems.find((candidate) => candidate.id === input.lineItemId) ?? null;

  if (!lineItem) {
    return detail;
  }

  const timestamp = new Date().toISOString();
  const nextSupplierAccounts =
    supplierAccount && !detail.supplierAccounts.some((candidate) => candidate.id === supplierAccount.id)
      ? [...detail.supplierAccounts, supplierAccount]
      : detail.supplierAccounts;
  const nextPartSources = syncPartSourcesToLineItems(detail.lineItems, detail.partSources).map(
    (partSource) =>
      partSource.lineItemId === input.lineItemId
        ? {
            ...partSource,
            selectedCartLine: {
              id: buildOfflineEntityId("offline-cart-line"),
              availabilityText: input.availabilityText?.trim() || null,
              cartId: buildOfflineEntityId("offline-cart"),
              companyId: detail.estimate.companyId,
              createdAt: timestamp,
              jobId: detail.estimate.jobId,
              notes: input.notes?.trim() || null,
              partRequestLineId: partSource.requestLine?.id ?? buildOfflineEntityId("offline-request-line"),
              providerQuoteLineId: null,
              quantity: lineItem.quantity,
              quotedCoreChargeCents: input.coreChargeCents ?? 0,
              quotedUnitCostCents: input.quotedUnitCostCents,
              supplierAccountId: supplierAccount?.id ?? buildOfflineEntityId("offline-supplier"),
              supplierPartNumber: input.supplierPartNumber?.trim() || null,
              supplierUrl: input.supplierUrl?.trim() || supplierAccount?.externalUrl || null,
              updatedAt: timestamp
            },
            selectedSupplierAccount: supplierAccount,
            requestLine: partSource.requestLine
          }
        : partSource
  );

  return {
    ...detail,
    partSources: nextPartSources,
    supplierAccounts: nextSupplierAccounts
  };
}

async function saveAssignedEstimateCache(detail: AssignedEstimateDetail) {
  await saveCachedAssignedEstimate(detail.job.id, detail);
}

function getMobileWebAppUrl() {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim() ?? "";

  if (!baseUrl) {
    throw new Error(
      "Configure EXPO_PUBLIC_WEB_APP_URL before live retailer sourcing can run on mobile."
    );
  }

  return baseUrl.replace(/\/+$/g, "");
}

async function getSupabaseAccessToken() {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? null;

  if (!accessToken) {
    throw new Error("Sign in again before running live retailer sourcing.");
  }

  return accessToken;
}

async function resolveSupplierAccountForPartSource(
  context: AssignedEstimateContext,
  input: SaveAssignedJobEstimatePartSourceInput
) {
  const supplierAccountsResult = await listSupplierAccountsByCompany(supabase, context.companyId);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  const supplierAccounts = (supplierAccountsResult.data ?? []).filter(
    (supplierAccount) => supplierAccount.isActive
  );

  if (input.supplierAccountId) {
    const existingSupplierAccount = supplierAccounts.find(
      (supplierAccount) => supplierAccount.id === input.supplierAccountId
    );

    if (!existingSupplierAccount) {
      throw new Error("Select an active supplier before saving the sourced part.");
    }

    return existingSupplierAccount;
  }

  const normalizedSupplierName = input.supplierName?.trim() ?? "";

  if (!normalizedSupplierName) {
    throw new Error("Choose a supplier or enter a supplier name before saving the sourced part.");
  }

  const existingSupplierAccount =
    supplierAccounts.find(
      (supplierAccount) =>
        supplierAccount.name.trim().toLowerCase() === normalizedSupplierName.toLowerCase()
    ) ?? null;

  if (existingSupplierAccount) {
    return existingSupplierAccount;
  }

  const createSupplierAccountResult = await createSupplierAccount(supabase, {
    companyId: context.companyId,
    name: normalizedSupplierName,
    slug: buildUniqueSupplierSlug(normalizedSupplierName, supplierAccounts),
    mode: "manual",
    externalUrl: input.supplierUrl?.trim() || null,
    contactEmail: null,
    contactName: null,
    contactPhone: null,
    notes: "Created from the technician mobile sourcing flow.",
    sortOrder: 0
  });

  if (createSupplierAccountResult.error || !createSupplierAccountResult.data) {
    throw createSupplierAccountResult.error ?? new Error("Supplier account could not be created.");
  }

  return createSupplierAccountResult.data;
}

function findEstimateLineItem(detail: AssignedEstimateDetail, lineItemId: string) {
  return detail.lineItems.find((lineItem) => lineItem.id === lineItemId) ?? null;
}

async function ensureAssignedJobEstimateDraftRemote(
  context: AssignedEstimateContext
): Promise<AssignedEstimateDetail> {
  const existingDetail = await loadAssignedJobEstimateRemote(context);

  if (existingDetail) {
    return existingDetail;
  }

  const jobResult = await getAssignedJobDetailForTechnician(
    supabase,
    context.companyId,
    context.technicianUserId,
    context.jobId
  );

  if (jobResult.error || !jobResult.data) {
    if (jobResult.error && "code" in jobResult.error && jobResult.error.code === "PGRST116") {
      throw new Error("Assigned job not found.");
    }

    throw jobResult.error ?? new Error("Assigned job not found.");
  }

  const vehicleLabel = getVehicleDisplayName({
    year: jobResult.data.vehicle.year,
    make: jobResult.data.vehicle.make,
    model: jobResult.data.vehicle.model
  });
  const seed = buildDefaultEstimateDraftSeed({
    jobId: context.jobId,
    jobTitle: jobResult.data.job.title,
    vehicleLabel
  });

  const createResult = await createEstimate(supabase, {
    companyId: context.companyId,
    jobId: context.jobId,
    estimateNumber: seed.estimateNumber,
    title: seed.title,
    notes: null,
    terms: null,
    createdByUserId: context.technicianUserId
  });

  if (createResult.error || !createResult.data) {
    throw createResult.error ?? new Error("Estimate draft could not be created.");
  }

  return reloadAssignedJobEstimate(context);
}

async function saveAssignedJobEstimateDraftRemote(
  context: AssignedEstimateContext,
  estimateId: string,
  input: UpdateEstimateInput
): Promise<AssignedEstimateDetail> {
  const result = await updateEstimate(supabase, estimateId, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate draft could not be saved.");
  }

  return reloadAssignedJobEstimate(context);
}

async function changeAssignedJobEstimateStatusRemote(
  context: AssignedEstimateContext,
  estimateId: string,
  input: ChangeEstimateStatusInput
): Promise<AssignedEstimateDetail> {
  const result = await changeEstimateStatus(supabase, estimateId, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate status could not be updated.");
  }

  return reloadAssignedJobEstimate(context);
}

async function addAssignedJobEstimateLineItemRemote(
  context: AssignedEstimateContext,
  estimateId: string,
  input: CreateEstimateLineItemInput
): Promise<AssignedEstimateDetail> {
  const result = await createEstimateLineItem(supabase, estimateId, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate line item could not be created.");
  }

  return reloadAssignedJobEstimate(context);
}

async function saveAssignedJobEstimateLineItemRemote(
  context: AssignedEstimateContext,
  lineItemId: string,
  input: UpdateEstimateLineItemInput
): Promise<AssignedEstimateDetail> {
  const result = await updateEstimateLineItem(supabase, lineItemId, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Estimate line item could not be saved.");
  }

  return reloadAssignedJobEstimate(context);
}

async function removeAssignedJobEstimateLineItemRemote(
  context: AssignedEstimateContext,
  lineItemId: string
): Promise<AssignedEstimateDetail> {
  const result = await deleteEstimateLineItem(supabase, lineItemId);

  if (result.error) {
    throw result.error;
  }

  return reloadAssignedJobEstimate(context);
}

async function saveAssignedJobEstimatePartSourceRemote(
  context: AssignedEstimateContext,
  estimateId: string,
  input: SaveAssignedJobEstimatePartSourceInput
): Promise<AssignedEstimateDetail> {
  const detail = await reloadAssignedJobEstimate(context);
  const lineItem = findEstimateLineItem(detail, input.lineItemId);

  if (!lineItem) {
    throw new Error("The selected estimate part line could not be loaded.");
  }

  if (lineItem.itemType !== "part") {
    throw new Error("Only estimate part lines can be sourced.");
  }

  const supplierAccount = await resolveSupplierAccountForPartSource(context, input);
  const requestResult = await createPartRequestFromEstimate(supabase, {
    companyId: context.companyId,
    estimateId,
    jobId: context.jobId,
    notes: "Created from the technician mobile sourcing flow.",
    requestedByUserId: context.technicianUserId
  });

  if (requestResult.error || !requestResult.data) {
    throw requestResult.error ?? new Error("Part request could not be prepared for this estimate.");
  }

  const requestLine =
    requestResult.data.lines.find((line) => line.estimateLineItemId === input.lineItemId) ?? null;

  if (!requestLine) {
    throw new Error("The selected estimate part line could not be linked to a sourcing request.");
  }

  const cartResult = await findOrCreateOpenSupplierCart(
    supabase,
    context.companyId,
    supplierAccount.id,
    `estimate-manual:${requestResult.data.request.id}`,
    context.technicianUserId
  );

  if (cartResult.error || !cartResult.data) {
    throw cartResult.error ?? new Error("Supplier cart could not be prepared.");
  }

  const cartDetailResult = await getSupplierCartById(supabase, cartResult.data.id);

  if (cartDetailResult.error || !cartDetailResult.data) {
    throw cartDetailResult.error ?? new Error("Supplier cart could not be loaded.");
  }

  const existingCartLine =
    cartDetailResult.data.lines.find(
      (entry) =>
        entry.requestLine.id === requestLine.id && entry.cartLine.providerQuoteLineId === null
    )?.cartLine ?? null;
  const normalizedSupplierUrl = input.supplierUrl?.trim() || supplierAccount.externalUrl || null;

  if (existingCartLine) {
    const updateCartLineResult = await updateSupplierCartLine(supabase, existingCartLine.id, {
      availabilityText: input.availabilityText?.trim() || null,
      notes: input.notes?.trim() || null,
      quantity: requestLine.quantityRequested,
      quotedCoreChargeCents: input.coreChargeCents ?? 0,
      quotedUnitCostCents: input.quotedUnitCostCents,
      supplierPartNumber: input.supplierPartNumber?.trim() || null,
      supplierUrl: normalizedSupplierUrl
    });

    if (updateCartLineResult.error || !updateCartLineResult.data) {
      throw updateCartLineResult.error ?? new Error("Supplier quote could not be updated.");
    }
  } else {
    const addCartLineResult = await addSupplierCartLine(supabase, cartResult.data.id, {
      availabilityText: input.availabilityText?.trim() || null,
      companyId: context.companyId,
      jobId: context.jobId,
      notes: input.notes?.trim() || null,
      partRequestLineId: requestLine.id,
      quantity: requestLine.quantityRequested,
      quotedCoreChargeCents: input.coreChargeCents ?? 0,
      quotedUnitCostCents: input.quotedUnitCostCents,
      supplierAccountId: supplierAccount.id,
      supplierPartNumber: input.supplierPartNumber?.trim() || null,
      supplierUrl: normalizedSupplierUrl
    });

    if (addCartLineResult.error || !addCartLineResult.data) {
      throw addCartLineResult.error ?? new Error("Supplier quote could not be saved.");
    }
  }

  const updateRequestLineResult = await updatePartRequestLine(supabase, requestLine.id, {
    coreChargeCents: input.coreChargeCents ?? 0,
    description: requestLine.description,
    estimatedUnitCostCents: input.quotedUnitCostCents,
    lastSupplierAccountId: supplierAccount.id,
    manufacturer: requestLine.manufacturer,
    needsCore: requestLine.needsCore || (input.coreChargeCents ?? 0) > 0,
    notes: input.notes?.trim() || requestLine.notes,
    partNumber: input.supplierPartNumber?.trim() || requestLine.partNumber,
    quantityRequested: requestLine.quantityRequested,
    quotedUnitCostCents: input.quotedUnitCostCents,
    supplierSku: requestLine.supplierSku,
    status: requestLine.status
  });

  if (updateRequestLineResult.error || !updateRequestLineResult.data) {
    throw updateRequestLineResult.error ?? new Error("Part request line could not be updated.");
  }

  return reloadAssignedJobEstimate(context);
}

async function flushQueuedAssignedEstimateMutations(context: AssignedEstimateContext) {
  const queue = await loadQueuedAssignedEstimateMutations<QueuedAssignedEstimateMutation>();

  if (!queue.length) {
    return { flushedCount: 0, remainingCount: 0 };
  }

  const remainingQueue: QueuedAssignedEstimateMutation[] = [];
  const tempEstimateIdMap = new Map<string, string>();
  const tempLineItemIdMap = new Map<string, string>();
  let flushedCount = 0;
  let isBlocked = false;

  for (const entry of queue) {
    if (entry.jobId !== context.jobId) {
      remainingQueue.push(entry);
      continue;
    }

    if (isBlocked) {
      remainingQueue.push(entry);
      continue;
    }

    try {
      if (entry.mutationType === "create_draft") {
        const createdDetail = await ensureAssignedJobEstimateDraftRemote(context);
        tempEstimateIdMap.set(entry.estimateId, createdDetail.estimate.id);
      }

      if (entry.mutationType === "save_draft") {
        await saveAssignedJobEstimateDraftRemote(
          context,
          tempEstimateIdMap.get(entry.estimateId) ?? entry.estimateId,
          entry.input
        );
      }

      if (entry.mutationType === "add_line") {
        const addedDetail = await addAssignedJobEstimateLineItemRemote(
          context,
          tempEstimateIdMap.get(entry.estimateId) ?? entry.estimateId,
          entry.input
        );
        const matchingLineItem =
          addedDetail.lineItems.find(
            (lineItem) =>
              lineItem.name === entry.input.name &&
              lineItem.itemType === entry.input.itemType &&
              lineItem.quantity === entry.input.quantity &&
              lineItem.unitPriceCents === entry.input.unitPriceCents
          ) ?? null;

        if (matchingLineItem) {
          tempLineItemIdMap.set(entry.tempLineItemId, matchingLineItem.id);
        }
      }

      if (entry.mutationType === "save_line") {
        await saveAssignedJobEstimateLineItemRemote(
          context,
          tempLineItemIdMap.get(entry.lineItemId) ?? entry.lineItemId,
          entry.input
        );
      }

      if (entry.mutationType === "remove_line") {
        await removeAssignedJobEstimateLineItemRemote(
          context,
          tempLineItemIdMap.get(entry.lineItemId) ?? entry.lineItemId
        );
      }

      if (entry.mutationType === "save_part_source") {
        await saveAssignedJobEstimatePartSourceRemote(
          context,
          tempEstimateIdMap.get(entry.estimateId) ?? entry.estimateId,
          {
          ...entry.input,
          lineItemId: tempLineItemIdMap.get(entry.input.lineItemId) ?? entry.input.lineItemId
          }
        );
      }

      flushedCount += 1;
    } catch {
      isBlocked = true;
      remainingQueue.push(entry);
    }
  }

  await saveQueuedAssignedEstimateMutations(remainingQueue);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === context.jobId).length
  };
}

async function buildQueuedMutationResult(
  optimisticDetail: AssignedEstimateDetail,
  queueEntry: QueuedAssignedEstimateMutation
) {
  const pendingMutationCount = await enqueueAssignedEstimateMutation(queueEntry);
  const detailWithPendingCount = withPendingMutationCount(optimisticDetail, pendingMutationCount);
  await saveAssignedEstimateCache(detailWithPendingCount);
  return detailWithPendingCount;
}

async function loadAssignedEstimateWorkingCopy(context: AssignedEstimateContext) {
  const cachedDetail = await loadCachedAssignedEstimate<AssignedEstimateDetail>(context.jobId);

  if (cachedDetail) {
    return cachedDetail;
  }

  return reloadAssignedJobEstimate(context);
}

export async function syncQueuedAssignedEstimateMutations(context: AssignedEstimateContext) {
  return flushQueuedAssignedEstimateMutations(context);
}

export async function syncAllQueuedAssignedEstimateMutations(input: {
  companyId: string;
  technicianUserId: string;
}) {
  const queue = await loadQueuedAssignedEstimateMutations<QueuedAssignedEstimateMutation>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedAssignedEstimateMutations({
      companyId: input.companyId,
      jobId,
      technicianUserId: input.technicianUserId
    });

    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

export async function ensureAssignedJobEstimateDraft(
  context: AssignedEstimateContext
): Promise<AssignedEstimateDetail> {
  try {
    const detail = await ensureAssignedJobEstimateDraftRemote(context);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(
      detail,
      await countQueuedAssignedEstimateMutations(context.jobId)
    );
  } catch (error) {
    const cachedDetail = await loadCachedAssignedEstimate<AssignedEstimateDetail>(context.jobId);

    if (cachedDetail) {
      return withPendingMutationCount(
        cachedDetail,
        await countQueuedAssignedEstimateMutations(context.jobId)
      );
    }

    const cachedJobDetail = await loadCachedAssignedJobDetail<TechnicianJobDetail>(context.jobId);

    if (!cachedJobDetail) {
      throw error;
    }

    const offlineEstimateId = buildOfflineEntityId("offline-estimate");

    return buildQueuedMutationResult(
      buildOfflineAssignedEstimateDetail(context, cachedJobDetail, offlineEstimateId),
      {
      createdAt: new Date().toISOString(),
      estimateId: offlineEstimateId,
      jobId: context.jobId,
      mutationId: buildOfflineEntityId("estimate-mutation"),
      mutationType: "create_draft"
      }
    );
  }
}

export async function saveAssignedJobEstimateDraft(
  context: AssignedEstimateContext,
  estimateId: string,
  input: UpdateEstimateInput
): Promise<AssignedEstimateDetail> {
  try {
    await flushQueuedAssignedEstimateMutations(context);
    const detail = await saveAssignedJobEstimateDraftRemote(context, estimateId, input);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
  } catch {
    const workingDetail = await loadAssignedEstimateWorkingCopy(context);

    return buildQueuedMutationResult(applyDraftUpdateOptimistically(workingDetail, input), {
      createdAt: new Date().toISOString(),
      estimateId,
      input,
      jobId: context.jobId,
      mutationId: buildOfflineEntityId("estimate-mutation"),
      mutationType: "save_draft"
    });
  }
}

export async function changeAssignedJobEstimateStatus(
  context: AssignedEstimateContext,
  estimateId: string,
  input: ChangeEstimateStatusInput
): Promise<AssignedEstimateDetail> {
  await flushQueuedAssignedEstimateMutations(context);
  const detail = await changeAssignedJobEstimateStatusRemote(context, estimateId, input);
  await saveAssignedEstimateCache(detail);
  return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
}

export async function addAssignedJobEstimateLineItem(
  context: AssignedEstimateContext,
  estimateId: string,
  input: CreateEstimateLineItemInput
): Promise<AssignedEstimateDetail> {
  try {
    await flushQueuedAssignedEstimateMutations(context);
    const detail = await addAssignedJobEstimateLineItemRemote(context, estimateId, input);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
  } catch {
    const workingDetail = await loadAssignedEstimateWorkingCopy(context);
    const tempLineItemId = buildOfflineEntityId("offline-line");

    return buildQueuedMutationResult(
      applyAddLineOptimistically(workingDetail, tempLineItemId, input),
      {
        createdAt: new Date().toISOString(),
        estimateId,
        input,
        jobId: context.jobId,
        mutationId: buildOfflineEntityId("estimate-mutation"),
        mutationType: "add_line",
        tempLineItemId
      }
    );
  }
}

export async function saveAssignedJobEstimateLineItem(
  context: AssignedEstimateContext,
  lineItemId: string,
  input: UpdateEstimateLineItemInput
): Promise<AssignedEstimateDetail> {
  try {
    await flushQueuedAssignedEstimateMutations(context);
    const detail = await saveAssignedJobEstimateLineItemRemote(context, lineItemId, input);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
  } catch {
    const workingDetail = await loadAssignedEstimateWorkingCopy(context);

    return buildQueuedMutationResult(
      applySaveLineOptimistically(workingDetail, lineItemId, input),
      {
        createdAt: new Date().toISOString(),
        input,
        jobId: context.jobId,
        lineItemId,
        mutationId: buildOfflineEntityId("estimate-mutation"),
        mutationType: "save_line"
      }
    );
  }
}

export async function removeAssignedJobEstimateLineItem(
  context: AssignedEstimateContext,
  lineItemId: string
): Promise<AssignedEstimateDetail> {
  try {
    await flushQueuedAssignedEstimateMutations(context);
    const detail = await removeAssignedJobEstimateLineItemRemote(context, lineItemId);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
  } catch {
    const workingDetail = await loadAssignedEstimateWorkingCopy(context);

    return buildQueuedMutationResult(
      applyRemoveLineOptimistically(workingDetail, lineItemId),
      {
        createdAt: new Date().toISOString(),
        jobId: context.jobId,
        lineItemId,
        mutationId: buildOfflineEntityId("estimate-mutation"),
        mutationType: "remove_line"
      }
    );
  }
}

export async function saveAssignedJobEstimatePartSource(
  context: AssignedEstimateContext,
  estimateId: string,
  input: SaveAssignedJobEstimatePartSourceInput
): Promise<AssignedEstimateDetail> {
  try {
    await flushQueuedAssignedEstimateMutations(context);
    const detail = await saveAssignedJobEstimatePartSourceRemote(context, estimateId, input);
    await saveAssignedEstimateCache(detail);
    return withPendingMutationCount(detail, await countQueuedAssignedEstimateMutations(context.jobId));
  } catch {
    const workingDetail = await loadAssignedEstimateWorkingCopy(context);

    return buildQueuedMutationResult(
      applyPartSourceOptimistically(workingDetail, input),
      {
        createdAt: new Date().toISOString(),
        estimateId,
        input,
        jobId: context.jobId,
        mutationId: buildOfflineEntityId("estimate-mutation"),
        mutationType: "save_part_source"
      }
    );
  }
}

export async function searchAssignedJobEstimateLiveRetailerOffers(
  context: AssignedEstimateContext,
  input: SearchAssignedJobEstimateLiveRetailerOffersInput
): Promise<SearchEstimateLiveRetailerOffersResult> {
  const [baseUrl, accessToken] = await Promise.all([
    Promise.resolve(getMobileWebAppUrl()),
    getSupabaseAccessToken()
  ]);
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${context.jobId}/estimate/live-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json().catch(() => null)) as
    | (SearchEstimateLiveRetailerOffersResult & { error?: string; ok?: boolean })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Live retailer lookup could not be completed.");
  }

  if (!payload) {
    throw new Error("Live retailer lookup returned an empty response.");
  }

  return {
    connector: payload.connector,
    offers: payload.offers ?? [],
    provider: payload.provider,
    providerLabel: payload.providerLabel,
    query: payload.query
  };
}
