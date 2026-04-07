import { getAssignedJobInvoiceSummary } from "@mobile-mechanic/api-client";
import {
  calculateInvoiceLineSubtotalCents,
  calculateInvoiceTotals
} from "@mobile-mechanic/core";
import * as Crypto from "expo-crypto";
import type {
  CreateInvoiceLineItemInput,
  CreateTechnicianPaymentHandoffInput,
  EstimateDetail,
  EstimateLineItem,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceStatus,
  Payment,
  RecordManualInvoicePaymentInput,
  UpdateInvoiceInput,
  UpdateInvoiceLineItemInput,
  TechnicianPaymentHandoff
} from "@mobile-mechanic/types";

import { mobileEnv } from "../../env";
import { loadMobileAppContext } from "../../lib/app-context";
import { supabase } from "../../lib/supabase";
import { loadCachedAssignedEstimate } from "../estimates/offline-estimate-store";
import {
  loadCachedAssignedInvoice,
  loadQueuedAssignedInvoiceMutations,
  saveCachedAssignedInvoice,
  saveQueuedAssignedInvoiceMutations
} from "./offline-invoice-store";
import {
  loadCachedAssignedPaymentHandoffs,
  loadQueuedAssignedPaymentHandoffs,
  saveCachedAssignedPaymentHandoffs,
  saveQueuedAssignedPaymentHandoffs
} from "./offline-payment-handoff-store";

export type AssignedInvoicePayment = Payment & {
  pendingSync?: boolean | undefined;
};

export type AssignedInvoiceDetail = Omit<InvoiceDetail, "payments"> & {
  cachedAt?: string | null | undefined;
  isCached?: boolean | undefined;
  payments: AssignedInvoicePayment[];
  pendingInvoiceMutationCount?: number | undefined;
  pendingManualPaymentCount?: number | undefined;
};

export type AssignedTechnicianPaymentHandoff = TechnicianPaymentHandoff & {
  pendingSync?: boolean | undefined;
};

export type AssignedInvoiceActionName =
  | "issue_invoice"
  | "refresh_payment_page"
  | "send_invoice_link"
  | "send_payment_reminder";

export type AssignedInvoiceActionResult = {
  action: AssignedInvoiceActionName;
  checkoutUrl: string | null;
  message: string;
  title: string;
  tone: "success" | "warning";
};

export type AssignedInvoiceCreateResult = {
  created: boolean;
  invoiceId: string;
  lineItemCount: number;
  message: string;
  queued: boolean;
  title: string;
};

export type AssignedInvoiceMutationResult = {
  queued: boolean;
};

export type AssignedInvoiceLineItemMutationResult = AssignedInvoiceMutationResult & {
  lineItem: InvoiceLineItem | null;
};

export type AssignedManualPaymentResult = AssignedInvoiceMutationResult & {
  payment: AssignedInvoicePayment;
};

type ManualPaymentInput = Pick<
  RecordManualInvoicePaymentInput,
  "amountCents" | "note" | "paidAt" | "tenderType"
>;

type QueuedTechnicianPaymentHandoff = {
  createdAt: string;
  input: CreateTechnicianPaymentHandoffInput;
  jobId: string;
  queueId: string;
};

type QueuedAssignedInvoiceMutation =
  | {
      createdAt: string;
      jobId: string;
      mutationId: string;
      mutationType: "create_draft";
    }
  | {
      createdAt: string;
      input: UpdateInvoiceInput;
      jobId: string;
      mutationId: string;
      mutationType: "save_draft";
    }
  | {
      createdAt: string;
      input: CreateInvoiceLineItemInput;
      jobId: string;
      mutationId: string;
      mutationType: "add_line";
      tempLineItemId: string;
    }
  | {
      createdAt: string;
      input: UpdateInvoiceLineItemInput;
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
      input: ManualPaymentInput;
      jobId: string;
      mutationId: string;
      mutationType: "record_manual_payment";
      tempPaymentId: string;
    };

function buildOfflineEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildOfflineInvoiceLineItemIdFromEstimateLine(estimateLineItemId: string) {
  return `offline-invoice-line-from-estimate-${estimateLineItemId}`;
}

function extractEstimateLineItemIdFromOfflineInvoiceLineId(lineItemId: string) {
  const prefix = "offline-invoice-line-from-estimate-";

  return lineItemId.startsWith(prefix) ? lineItemId.slice(prefix.length) : null;
}

function buildDefaultInvoiceSeed(input: {
  jobId: string;
  jobTitle: string;
  vehicleLabel: string;
}) {
  const todayToken = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const titleBase = input.vehicleLabel || input.jobTitle;

  return {
    invoiceNumber: `INV-${todayToken}-${input.jobId.slice(0, 4).toUpperCase()}`,
    title: `${titleBase} invoice`
  };
}

function getMobileWebAppUrl() {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim() ?? "";

  if (!baseUrl) {
    throw new Error(
      "Configure EXPO_PUBLIC_WEB_APP_URL before mobile billing handoffs can sync."
    );
  }

  return baseUrl.replace(/\/+$/g, "");
}

async function getSupabaseAccessToken() {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? null;

  if (!accessToken) {
    throw new Error("Sign in again before recording a payment handoff.");
  }

  return accessToken;
}

async function loadCurrentInvoiceSyncContext() {
  const sessionResult = await supabase.auth.getSession();
  const userId = sessionResult.data.session?.user.id ?? null;

  if (!userId) {
    throw new Error("Sign in again before syncing invoice drafts.");
  }

  const result = await loadMobileAppContext(supabase, userId);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Mobile app context could not be loaded for invoice sync.");
  }

  return result.data;
}

function buildOfflineInvoiceLineItemFromEstimateLine(
  estimateLineItem: EstimateLineItem,
  invoiceId: string
): InvoiceLineItem {
  return normalizeInvoiceLineItem({
    actualCostCents: estimateLineItem.actualCostCents,
    companyId: estimateLineItem.companyId,
    createdAt: estimateLineItem.createdAt,
    description: estimateLineItem.description,
    estimatedCostCents: estimateLineItem.estimatedCostCents,
    id: buildOfflineInvoiceLineItemIdFromEstimateLine(estimateLineItem.id),
    invoiceId,
    itemType: estimateLineItem.itemType,
    jobId: estimateLineItem.jobId,
    lineSubtotalCents: estimateLineItem.lineSubtotalCents,
    name: estimateLineItem.name,
    partRequestLineId: estimateLineItem.partRequestLineId,
    position: estimateLineItem.position,
    quantity: estimateLineItem.quantity,
    taxable: estimateLineItem.taxable,
    unitPriceCents: estimateLineItem.unitPriceCents,
    updatedAt: estimateLineItem.updatedAt
  });
}

function buildOfflineInvoiceDraftFromEstimate(
  estimateDetail: EstimateDetail,
  createdByUserId: string
): AssignedInvoiceDetail {
  const invoiceId = buildOfflineEntityId("offline-invoice");
  const lineItems = estimateDetail.lineItems.map((lineItem) =>
    buildOfflineInvoiceLineItemFromEstimateLine(lineItem, invoiceId)
  );
  const seed = buildDefaultInvoiceSeed({
    jobId: estimateDetail.job.id,
    jobTitle: estimateDetail.job.title,
    vehicleLabel: `${estimateDetail.vehicle.year ? `${estimateDetail.vehicle.year} ` : ""}${estimateDetail.vehicle.make} ${estimateDetail.vehicle.model}`.trim()
  });
  const totals = calculateInvoiceTotals({
    amountPaidCents: 0,
    discountCents: estimateDetail.estimate.discountCents,
    lineItems,
    taxRateBasisPoints: estimateDetail.estimate.taxRateBasisPoints
  });
  const timestamp = new Date().toISOString();

  return {
    customer: estimateDetail.customer,
    estimate: estimateDetail.estimate,
    invoice: {
      amountPaidCents: totals.amountPaidCents,
      balanceDueCents: totals.balanceDueCents,
      companyId: estimateDetail.estimate.companyId,
      createdAt: timestamp,
      createdByUserId,
      currencyCode: "USD",
      discountCents: totals.discountCents,
      dueAt: null,
      estimateId: estimateDetail.estimate.id,
      id: invoiceId,
      invoiceNumber: seed.invoiceNumber,
      issuedAt: null,
      jobId: estimateDetail.job.id,
      notes: estimateDetail.estimate.notes,
      paidAt: null,
      paymentUrl: null,
      paymentUrlExpiresAt: null,
      status: "draft",
      stripeCheckoutSessionId: null,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      taxRateBasisPoints: estimateDetail.estimate.taxRateBasisPoints,
      terms: estimateDetail.estimate.terms,
      title: estimateDetail.estimate.title || seed.title,
      totalCents: totals.totalCents,
      updatedAt: timestamp,
      voidedAt: null
    },
    job: estimateDetail.job,
    lineItems,
    payments: [],
    totals,
    vehicle: estimateDetail.vehicle
  };
}

function stripAssignedInvoiceTransientState(detail: AssignedInvoiceDetail): AssignedInvoiceDetail {
  const {
    cachedAt: _cachedAt,
    isCached: _isCached,
    pendingInvoiceMutationCount: _pendingInvoiceMutationCount,
    pendingManualPaymentCount: _pendingManualPaymentCount,
    ...persistedDetail
  } = detail;

  return persistedDetail;
}

function normalizeAssignedInvoicePayment(payment: Payment): AssignedInvoicePayment {
  return {
    ...payment,
    pendingSync: false
  };
}

function buildAssignedInvoiceDetail(detail: InvoiceDetail): AssignedInvoiceDetail {
  return {
    ...detail,
    payments: detail.payments.map(normalizeAssignedInvoicePayment)
  };
}

function normalizeInvoiceLineItem(lineItem: InvoiceLineItem): InvoiceLineItem {
  return {
    ...lineItem,
    lineSubtotalCents: calculateInvoiceLineSubtotalCents(
      lineItem.quantity,
      lineItem.unitPriceCents
    )
  };
}

function getInvoiceStatusAfterPayment(
  currentStatus: InvoiceStatus,
  input: {
    amountPaidCents: number;
    balanceDueCents: number;
    totalCents: number;
  }
): InvoiceStatus {
  if (currentStatus === "void" || currentStatus === "draft") {
    return currentStatus;
  }

  if (input.totalCents > 0 && input.balanceDueCents <= 0) {
    return "paid";
  }

  if (input.amountPaidCents > 0) {
    return "partially_paid";
  }

  return currentStatus;
}

function applyAssignedInvoiceTotals(
  detail: AssignedInvoiceDetail,
  nextLineItems: InvoiceLineItem[],
  overrides?: {
    amountPaidCents?: number | undefined;
    discountCents?: number | undefined;
    taxRateBasisPoints?: number | undefined;
  }
): AssignedInvoiceDetail {
  const normalizedLineItems = nextLineItems.map(normalizeInvoiceLineItem);
  const discountCents = overrides?.discountCents ?? detail.invoice.discountCents;
  const taxRateBasisPoints =
    overrides?.taxRateBasisPoints ?? detail.invoice.taxRateBasisPoints;
  const amountPaidCents = overrides?.amountPaidCents ?? detail.totals.amountPaidCents;
  const totals = calculateInvoiceTotals({
    amountPaidCents,
    discountCents,
    lineItems: normalizedLineItems,
    taxRateBasisPoints
  });
  const status = getInvoiceStatusAfterPayment(detail.invoice.status, totals);

  return {
    ...detail,
    invoice: {
      ...detail.invoice,
      amountPaidCents: totals.amountPaidCents,
      balanceDueCents: totals.balanceDueCents,
      discountCents: totals.discountCents,
      paidAt:
        status === "paid" && totals.totalCents > 0
          ? detail.invoice.paidAt ?? new Date().toISOString()
          : status === "paid"
            ? detail.invoice.paidAt
            : null,
      status,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      taxRateBasisPoints,
      totalCents: totals.totalCents
    },
    lineItems: normalizedLineItems,
    totals
  };
}

function buildOptimisticInvoiceLineItem(
  detail: AssignedInvoiceDetail,
  lineItemId: string,
  input: CreateInvoiceLineItemInput | UpdateInvoiceLineItemInput
): InvoiceLineItem {
  const timestamp = new Date().toISOString();

  return normalizeInvoiceLineItem({
    actualCostCents: null,
    companyId: detail.invoice.companyId,
    createdAt: timestamp,
    description: input.description ?? null,
    estimatedCostCents: null,
    id: lineItemId,
    invoiceId: detail.invoice.id,
    itemType: input.itemType,
    jobId: detail.job.id,
    lineSubtotalCents: 0,
    name: input.name,
    partRequestLineId: null,
    position:
      detail.lineItems.reduce(
        (highestPosition, existingLineItem) =>
          Math.max(highestPosition, existingLineItem.position),
        -1
      ) + 1,
    quantity: input.quantity,
    taxable: input.taxable ?? true,
    unitPriceCents: input.unitPriceCents,
    updatedAt: timestamp
  });
}

function applyDraftUpdateOptimistically(
  detail: AssignedInvoiceDetail,
  input: UpdateInvoiceInput
): AssignedInvoiceDetail {
  const nextDetail = applyAssignedInvoiceTotals(detail, detail.lineItems, {
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints
  });

  return {
    ...nextDetail,
    invoice: {
      ...nextDetail.invoice,
      dueAt: input.dueAt ?? null,
      invoiceNumber: input.invoiceNumber,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      title: input.title
    }
  };
}

function applyAddLineOptimistically(
  detail: AssignedInvoiceDetail,
  lineItemId: string,
  input: CreateInvoiceLineItemInput
): AssignedInvoiceDetail {
  return applyAssignedInvoiceTotals(detail, [
    ...detail.lineItems,
    buildOptimisticInvoiceLineItem(detail, lineItemId, input)
  ]);
}

function applySaveLineOptimistically(
  detail: AssignedInvoiceDetail,
  lineItemId: string,
  input: UpdateInvoiceLineItemInput
): AssignedInvoiceDetail {
  const nextLineItems = detail.lineItems.map((lineItem) =>
    lineItem.id === lineItemId
      ? normalizeInvoiceLineItem({
          ...lineItem,
          description: input.description ?? null,
          itemType: input.itemType,
          name: input.name,
          quantity: input.quantity,
          taxable: input.taxable ?? true,
          unitPriceCents: input.unitPriceCents,
          updatedAt: new Date().toISOString()
        })
      : lineItem
  );

  return applyAssignedInvoiceTotals(detail, nextLineItems);
}

function applyRemoveLineOptimistically(
  detail: AssignedInvoiceDetail,
  lineItemId: string
): AssignedInvoiceDetail {
  return applyAssignedInvoiceTotals(
    detail,
    detail.lineItems.filter((lineItem) => lineItem.id !== lineItemId)
  );
}

function buildOfflineManualPayment(
  detail: AssignedInvoiceDetail,
  tempPaymentId: string,
  input: ManualPaymentInput
): AssignedInvoicePayment {
  const timestamp = input.paidAt ?? new Date().toISOString();

  return {
    amountCents: input.amountCents,
    companyId: detail.invoice.companyId,
    createdAt: timestamp,
    currencyCode: detail.invoice.currencyCode,
    id: tempPaymentId,
    invoiceId: detail.invoice.id,
    jobId: detail.job.id,
    manualReferenceNote: input.note?.trim() || null,
    manualTenderType: input.tenderType,
    paidAt: timestamp,
    pendingSync: true,
    provider: "manual",
    receiptUrl: null,
    recordedByUserId: null,
    status: "succeeded",
    stripeChargeId: null,
    stripeCheckoutSessionId: null,
    stripeEventId: null,
    stripePaymentIntentId: null,
    updatedAt: timestamp
  };
}

function applyManualPaymentToDetail(
  detail: AssignedInvoiceDetail,
  payment: AssignedInvoicePayment
): AssignedInvoiceDetail {
  const nextAmountPaidCents = detail.totals.amountPaidCents + payment.amountCents;
  const nextDetail = applyAssignedInvoiceTotals(detail, detail.lineItems, {
    amountPaidCents: nextAmountPaidCents
  });
  const status = getInvoiceStatusAfterPayment(nextDetail.invoice.status, nextDetail.totals);

  return {
    ...nextDetail,
    invoice: {
      ...nextDetail.invoice,
      paidAt:
        status === "paid" && nextDetail.totals.totalCents > 0
          ? payment.paidAt
          : nextDetail.invoice.paidAt,
      paymentUrl: null,
      paymentUrlExpiresAt: null,
      status,
      stripeCheckoutSessionId: null
    },
    payments: [payment, ...detail.payments.filter((existingPayment) => existingPayment.id !== payment.id)]
  };
}

function summarizeQueuedAssignedInvoiceMutations(
  queue: QueuedAssignedInvoiceMutation[],
  jobId: string
) {
  const jobQueue = queue.filter((entry) => entry.jobId === jobId);

  return {
    pendingInvoiceMutationCount: jobQueue.filter(
      (entry) => entry.mutationType !== "record_manual_payment"
    ).length,
    pendingManualPaymentCount: jobQueue.filter(
      (entry) => entry.mutationType === "record_manual_payment"
    ).length
  };
}

function withAssignedInvoiceQueueState(
  detail: AssignedInvoiceDetail,
  input: {
    cachedAt?: string | null | undefined;
    isCached: boolean;
    pendingInvoiceMutationCount: number;
    pendingManualPaymentCount: number;
  }
): AssignedInvoiceDetail {
  return {
    ...stripAssignedInvoiceTransientState(detail),
    cachedAt: input.cachedAt ?? null,
    isCached: input.isCached,
    pendingInvoiceMutationCount: input.pendingInvoiceMutationCount,
    pendingManualPaymentCount: input.pendingManualPaymentCount
  };
}

async function saveAssignedInvoiceWorkingCopy(jobId: string, detail: AssignedInvoiceDetail) {
  await saveCachedAssignedInvoice(jobId, stripAssignedInvoiceTransientState(detail));
}

async function loadAssignedInvoiceWorkingCopy(jobId: string, errorMessage: string) {
  const cachedDetail = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

  if (!cachedDetail) {
    throw new Error(errorMessage);
  }

  return cachedDetail.detail;
}

async function buildBootstrapInvoiceLineItemIdMap(
  jobId: string,
  remoteDetail: AssignedInvoiceDetail
) {
  const cachedEstimate = await loadCachedAssignedEstimate<EstimateDetail>(jobId);

  if (!cachedEstimate) {
    return new Map<string, string>();
  }

  const remainingRemoteLineItems = [...remoteDetail.lineItems];
  const lineIdMap = new Map<string, string>();

  for (const estimateLineItem of cachedEstimate.lineItems) {
    const remoteIndex = remainingRemoteLineItems.findIndex(
      (remoteLineItem) =>
        remoteLineItem.partRequestLineId === estimateLineItem.partRequestLineId &&
        remoteLineItem.position === estimateLineItem.position &&
        remoteLineItem.itemType === estimateLineItem.itemType &&
        remoteLineItem.name === estimateLineItem.name &&
        remoteLineItem.quantity === estimateLineItem.quantity &&
        remoteLineItem.unitPriceCents === estimateLineItem.unitPriceCents
    );

    if (remoteIndex === -1) {
      continue;
    }

    lineIdMap.set(
      buildOfflineInvoiceLineItemIdFromEstimateLine(estimateLineItem.id),
      remainingRemoteLineItems[remoteIndex]!.id
    );
    remainingRemoteLineItems.splice(remoteIndex, 1);
  }

  return lineIdMap;
}

async function countQueuedAssignedPaymentHandoffs(jobId: string) {
  const queue = await loadQueuedAssignedPaymentHandoffs<QueuedTechnicianPaymentHandoff>();
  return queue.filter((entry) => entry.jobId === jobId).length;
}

async function enqueueAssignedPaymentHandoff(entry: QueuedTechnicianPaymentHandoff) {
  const queue = await loadQueuedAssignedPaymentHandoffs<QueuedTechnicianPaymentHandoff>();
  queue.push(entry);
  await saveQueuedAssignedPaymentHandoffs(queue);
  return queue.filter((candidate) => candidate.jobId === entry.jobId).length;
}

function buildOfflinePaymentHandoff(input: {
  jobId: string;
  payload: CreateTechnicianPaymentHandoffInput;
  technicianUserId: string;
}): AssignedTechnicianPaymentHandoff {
  const timestamp = new Date().toISOString();

  return {
    amountCents: input.payload.amountCents ?? null,
    companyId: "offline-company",
    createdAt: timestamp,
    customerPromiseAt: input.payload.customerPromiseAt ?? null,
    id: buildOfflineEntityId("offline-payment-handoff"),
    invoiceId: "offline-invoice",
    jobId: input.jobId,
    kind: input.payload.kind,
    note: input.payload.note?.trim() || null,
    pendingSync: true,
    resolutionDisposition: null,
    resolutionNote: null,
    resolvedAt: null,
    resolvedByUserId: null,
    status: "open",
    technicianUserId: input.technicianUserId,
    tenderType: input.payload.tenderType ?? null,
    updatedAt: timestamp
  };
}

async function loadAssignedPaymentHandoffsRemote(jobId: string) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/invoice/handoffs`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; handoffs?: TechnicianPaymentHandoff[] }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Payment handoffs could not be loaded.");
  }

  return (body?.handoffs ?? []).map((handoff) => ({
    ...handoff,
    pendingSync: false
  })) satisfies AssignedTechnicianPaymentHandoff[];
}

export async function runAssignedJobInvoiceAction(
  jobId: string,
  action: AssignedInvoiceActionName
) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/invoice/actions`, {
    body: JSON.stringify({ action }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & Partial<AssignedInvoiceActionResult>)
    | null;

  if (
    !response.ok ||
    !body ||
    typeof body.action !== "string" ||
    typeof body.message !== "string" ||
    typeof body.title !== "string" ||
    (body.tone !== "success" && body.tone !== "warning")
  ) {
    throw new Error(body?.error ?? "Invoice action could not be completed.");
  }

  return {
    action: body.action as AssignedInvoiceActionName,
    checkoutUrl: typeof body.checkoutUrl === "string" ? body.checkoutUrl : null,
    message: body.message,
    title: body.title,
    tone: body.tone
  } satisfies AssignedInvoiceActionResult;
}

async function createAssignedJobInvoiceDraftRemote(jobId: string) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/invoice/create`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & Partial<AssignedInvoiceCreateResult>)
    | null;

  if (
    !response.ok ||
    !body ||
    typeof body.invoiceId !== "string" ||
    typeof body.lineItemCount !== "number" ||
    typeof body.message !== "string" ||
    typeof body.title !== "string" ||
    typeof body.created !== "boolean"
  ) {
    throw new Error(body?.error ?? "Invoice draft could not be created.");
  }

  return {
    created: body.created,
    invoiceId: body.invoiceId,
    lineItemCount: body.lineItemCount,
    message: body.message,
    queued: false,
    title: body.title
  } satisfies AssignedInvoiceCreateResult;
}

export async function createAssignedJobInvoiceDraft(jobId: string) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    const result = await createAssignedJobInvoiceDraftRemote(jobId);
    const context = await loadCurrentInvoiceSyncContext();
    const refreshedDetail = await loadAssignedJobInvoiceRemote(
      context.companyId,
      context.userId,
      jobId
    );

    if (refreshedDetail) {
      await saveAssignedInvoiceWorkingCopy(jobId, refreshedDetail);
    }

    return result;
  } catch {
    const cachedEstimate = await loadCachedAssignedEstimate<EstimateDetail>(jobId);
    const userId = (await supabase.auth.getSession()).data.session?.user.id ?? null;

    if (!cachedEstimate || !userId) {
      throw new Error(
        "Invoice creation needs one successful estimate load before it can queue offline."
      );
    }

    if (!cachedEstimate.lineItems.length) {
      throw new Error(
        "Add at least one billable line to the estimate before creating the invoice."
      );
    }

    const workingDetail = buildOfflineInvoiceDraftFromEstimate(cachedEstimate, userId);
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      jobId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "create_draft"
    });
    const queuedDetail = withAssignedInvoiceQueueState(workingDetail, {
      isCached: true,
      pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
      pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
    });
    await saveAssignedInvoiceWorkingCopy(jobId, queuedDetail);

    return {
      created: true,
      invoiceId: workingDetail.invoice.id,
      lineItemCount: workingDetail.lineItems.length,
      message:
        "The invoice draft is built from the cached estimate on this device and will sync automatically when the connection is back.",
      queued: true,
      title: "Invoice draft queued"
    } satisfies AssignedInvoiceCreateResult;
  }
}

async function recordAssignedJobManualPaymentRemote(jobId: string, input: ManualPaymentInput) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/invoice/payments`, {
    body: JSON.stringify(input),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; payment?: Payment }
    | null;

  if (!response.ok || !body?.payment) {
    throw new Error(body?.error ?? "Field payment could not be recorded.");
  }

  return {
    ...body.payment,
    pendingSync: false
  } satisfies AssignedInvoicePayment;
}

async function runAssignedInvoiceDraftMutation<T>(
  jobId: string,
  pathSuffix: string,
  method: "DELETE" | "PATCH" | "POST",
  body?: unknown
) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(
    `${baseUrl}/api/mobile/jobs/${jobId}/invoice/${pathSuffix}`,
    {
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      method
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; ok?: boolean; lineItem?: T }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Invoice draft update failed.");
  }

  return payload;
}

async function saveAssignedJobInvoiceDraftRemote(jobId: string, input: UpdateInvoiceInput) {
  await runAssignedInvoiceDraftMutation(jobId, "draft", "PATCH", input);
}

async function addAssignedJobInvoiceLineItemRemote(
  jobId: string,
  input: CreateInvoiceLineItemInput
) {
  const payload = await runAssignedInvoiceDraftMutation<InvoiceLineItem>(
    jobId,
    "line-items",
    "POST",
    input
  );

  return payload?.lineItem ? normalizeInvoiceLineItem(payload.lineItem) : null;
}

async function saveAssignedJobInvoiceLineItemRemote(
  jobId: string,
  lineItemId: string,
  input: UpdateInvoiceLineItemInput
) {
  const payload = await runAssignedInvoiceDraftMutation<InvoiceLineItem>(
    jobId,
    `line-items/${lineItemId}`,
    "PATCH",
    input
  );

  return payload?.lineItem ? normalizeInvoiceLineItem(payload.lineItem) : null;
}

async function removeAssignedJobInvoiceLineItemRemote(jobId: string, lineItemId: string) {
  await runAssignedInvoiceDraftMutation(jobId, `line-items/${lineItemId}`, "DELETE");
}

async function createAssignedPaymentHandoffRemote(
  jobId: string,
  input: CreateTechnicianPaymentHandoffInput
) {
  const baseUrl = getMobileWebAppUrl();
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/invoice/handoffs`, {
    body: JSON.stringify(input),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; handoff?: TechnicianPaymentHandoff }
    | null;

  if (!response.ok || !body?.handoff) {
    throw new Error(body?.error ?? "Payment handoff could not be recorded.");
  }

  return {
    ...body.handoff,
    pendingSync: false
  } satisfies AssignedTechnicianPaymentHandoff;
}

async function flushQueuedAssignedPaymentHandoffs(jobId: string) {
  const queue = await loadQueuedAssignedPaymentHandoffs<QueuedTechnicianPaymentHandoff>();

  if (!queue.length) {
    return {
      flushedCount: 0,
      remainingCount: 0
    };
  }

  const remainingQueue: QueuedTechnicianPaymentHandoff[] = [];
  let flushedCount = 0;
  let isBlocked = false;

  for (const entry of queue) {
    if (entry.jobId !== jobId) {
      remainingQueue.push(entry);
      continue;
    }

    if (isBlocked) {
      remainingQueue.push(entry);
      continue;
    }

    try {
      await createAssignedPaymentHandoffRemote(jobId, entry.input);
      flushedCount += 1;
    } catch {
      isBlocked = true;
      remainingQueue.push(entry);
    }
  }

  await saveQueuedAssignedPaymentHandoffs(remainingQueue);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === jobId).length
  };
}

export async function syncAllQueuedAssignedPaymentHandoffs() {
  const queue = await loadQueuedAssignedPaymentHandoffs<QueuedTechnicianPaymentHandoff>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedAssignedPaymentHandoffs(jobId);
    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

export async function loadAssignedJobPaymentHandoffs(jobId: string) {
  const cachedHandoffs =
    (await loadCachedAssignedPaymentHandoffs<AssignedTechnicianPaymentHandoff[]>(jobId)) ?? [];

  await flushQueuedAssignedPaymentHandoffs(jobId);
  const pendingCount = await countQueuedAssignedPaymentHandoffs(jobId);

  try {
    const handoffs = await loadAssignedPaymentHandoffsRemote(jobId);

    if (pendingCount > 0 && cachedHandoffs.length) {
      return cachedHandoffs;
    }

    await saveCachedAssignedPaymentHandoffs(jobId, handoffs);
    return handoffs;
  } catch (error) {
    if (cachedHandoffs.length) {
      return cachedHandoffs;
    }

    throw error;
  }
}

export async function createAssignedJobPaymentHandoff(
  technicianUserId: string,
  jobId: string,
  input: CreateTechnicianPaymentHandoffInput
) {
  try {
    await flushQueuedAssignedPaymentHandoffs(jobId);
    const handoff = await createAssignedPaymentHandoffRemote(jobId, input);
    const refreshedHandoffs = await loadAssignedJobPaymentHandoffs(jobId);
    await saveCachedAssignedPaymentHandoffs(jobId, refreshedHandoffs);

    return {
      data: handoff,
      queued: false as const
    };
  } catch {
    const cachedHandoffs =
      (await loadCachedAssignedPaymentHandoffs<AssignedTechnicianPaymentHandoff[]>(jobId)) ?? [];
    const offlineHandoff = buildOfflinePaymentHandoff({
      jobId,
      payload: input,
      technicianUserId
    });
    const pendingCount = await enqueueAssignedPaymentHandoff({
      createdAt: offlineHandoff.createdAt,
      input,
      jobId,
      queueId: Crypto.randomUUID()
    });
    const nextHandoffs = [
      offlineHandoff,
      ...cachedHandoffs.filter((handoff) => handoff.id !== offlineHandoff.id)
    ].map((handoff, index) =>
      index < pendingCount && handoff.pendingSync !== false
        ? { ...handoff, pendingSync: true }
        : handoff
    );
    await saveCachedAssignedPaymentHandoffs(jobId, nextHandoffs);

    return {
      data: offlineHandoff,
      queued: true as const
    };
  }
}

async function countQueuedAssignedInvoiceMutations(jobId: string) {
  const queue = await loadQueuedAssignedInvoiceMutations<QueuedAssignedInvoiceMutation>();
  const counts = summarizeQueuedAssignedInvoiceMutations(queue, jobId);

  return {
    pendingInvoiceMutationCount: counts.pendingInvoiceMutationCount,
    pendingManualPaymentCount: counts.pendingManualPaymentCount
  };
}

async function enqueueAssignedInvoiceMutation(entry: QueuedAssignedInvoiceMutation) {
  const queue = await loadQueuedAssignedInvoiceMutations<QueuedAssignedInvoiceMutation>();
  queue.push(entry);
  await saveQueuedAssignedInvoiceMutations(queue);
  return summarizeQueuedAssignedInvoiceMutations(queue, entry.jobId);
}

async function flushQueuedAssignedInvoiceMutations(jobId: string) {
  const queue = await loadQueuedAssignedInvoiceMutations<QueuedAssignedInvoiceMutation>();

  if (!queue.length) {
    return {
      flushedCount: 0,
      remainingCount: 0
    };
  }

  const remainingQueue: QueuedAssignedInvoiceMutation[] = [];
  const tempLineItemIdMap = new Map<string, string>();
  let syncContext: Awaited<ReturnType<typeof loadCurrentInvoiceSyncContext>> | null = null;
  let flushedCount = 0;
  let isBlocked = false;

  for (const entry of queue) {
    if (entry.jobId !== jobId) {
      remainingQueue.push(entry);
      continue;
    }

    if (isBlocked) {
      remainingQueue.push(entry);
      continue;
    }

    try {
      if (entry.mutationType === "create_draft") {
        await createAssignedJobInvoiceDraftRemote(jobId);
        syncContext = syncContext ?? (await loadCurrentInvoiceSyncContext());
        const remoteDetail = await loadAssignedJobInvoiceRemote(
          syncContext.companyId,
          syncContext.userId,
          jobId
        );

        if (!remoteDetail) {
          throw new Error("Invoice draft sync could not load the created server invoice.");
        }

        const bootstrapLineItemIdMap = await buildBootstrapInvoiceLineItemIdMap(
          jobId,
          remoteDetail
        );

        for (const [offlineLineItemId, remoteLineItemId] of bootstrapLineItemIdMap.entries()) {
          tempLineItemIdMap.set(offlineLineItemId, remoteLineItemId);
        }
      }

      if (entry.mutationType === "save_draft") {
        await saveAssignedJobInvoiceDraftRemote(jobId, entry.input);
      }

      if (entry.mutationType === "add_line") {
        const lineItem = await addAssignedJobInvoiceLineItemRemote(jobId, entry.input);

        if (lineItem) {
          tempLineItemIdMap.set(entry.tempLineItemId, lineItem.id);
        }
      }

      if (entry.mutationType === "save_line") {
        await saveAssignedJobInvoiceLineItemRemote(
          jobId,
          tempLineItemIdMap.get(entry.lineItemId) ?? entry.lineItemId,
          entry.input
        );
      }

      if (entry.mutationType === "remove_line") {
        await removeAssignedJobInvoiceLineItemRemote(
          jobId,
          tempLineItemIdMap.get(entry.lineItemId) ?? entry.lineItemId
        );
      }

      if (entry.mutationType === "record_manual_payment") {
        await recordAssignedJobManualPaymentRemote(jobId, entry.input);
      }

      flushedCount += 1;
    } catch {
      isBlocked = true;
      remainingQueue.push(entry);
    }
  }

  await saveQueuedAssignedInvoiceMutations(remainingQueue);

  return {
    flushedCount,
    remainingCount: remainingQueue.filter((entry) => entry.jobId === jobId).length
  };
}

export async function syncQueuedAssignedInvoiceMutations(jobId: string) {
  return flushQueuedAssignedInvoiceMutations(jobId);
}

export async function syncAllQueuedAssignedInvoiceMutations() {
  const queue = await loadQueuedAssignedInvoiceMutations<QueuedAssignedInvoiceMutation>();
  const jobIds = Array.from(new Set(queue.map((entry) => entry.jobId)));
  let flushedCount = 0;
  let remainingCount = 0;

  for (const jobId of jobIds) {
    const result = await flushQueuedAssignedInvoiceMutations(jobId);
    flushedCount += result.flushedCount;
    remainingCount += result.remainingCount;
  }

  return {
    flushedCount,
    remainingCount
  };
}

async function loadAssignedJobInvoiceRemote(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const result = await getAssignedJobInvoiceSummary(
    supabase,
    companyId,
    technicianUserId,
    jobId
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

  return buildAssignedInvoiceDetail(result.data);
}

export async function loadAssignedJobInvoice(
  companyId: string,
  technicianUserId: string,
  jobId: string
) {
  const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

  await flushQueuedAssignedInvoiceMutations(jobId);
  const pendingCounts = await countQueuedAssignedInvoiceMutations(jobId);

  try {
    const result = await loadAssignedJobInvoiceRemote(companyId, technicianUserId, jobId);

    if (!result) {
      return cachedInvoice
        ? withAssignedInvoiceQueueState(cachedInvoice.detail, {
            cachedAt: cachedInvoice.cachedAt,
            isCached: true,
            pendingInvoiceMutationCount: pendingCounts.pendingInvoiceMutationCount,
            pendingManualPaymentCount: pendingCounts.pendingManualPaymentCount
          })
        : null;
    }

    if (
      (pendingCounts.pendingInvoiceMutationCount > 0 ||
        pendingCounts.pendingManualPaymentCount > 0) &&
      cachedInvoice
    ) {
      return withAssignedInvoiceQueueState(cachedInvoice.detail, {
        cachedAt: cachedInvoice.cachedAt,
        isCached: true,
        pendingInvoiceMutationCount: pendingCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: pendingCounts.pendingManualPaymentCount
      });
    }

    await saveAssignedInvoiceWorkingCopy(jobId, result);

    return withAssignedInvoiceQueueState(result, {
      cachedAt: null,
      isCached: false,
      pendingInvoiceMutationCount: pendingCounts.pendingInvoiceMutationCount,
      pendingManualPaymentCount: pendingCounts.pendingManualPaymentCount
    });
  } catch (error) {
    if (cachedInvoice) {
      return withAssignedInvoiceQueueState(cachedInvoice.detail, {
        cachedAt: cachedInvoice.cachedAt,
        isCached: true,
        pendingInvoiceMutationCount: pendingCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: pendingCounts.pendingManualPaymentCount
      });
    }

    throw error;
  }
}

export async function saveAssignedJobInvoiceDraft(jobId: string, input: UpdateInvoiceInput) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    await saveAssignedJobInvoiceDraftRemote(jobId, input);

    const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

    if (cachedInvoice) {
      await saveAssignedInvoiceWorkingCopy(
        jobId,
        applyDraftUpdateOptimistically(cachedInvoice.detail, input)
      );
    }

    return {
      queued: false
    } satisfies AssignedInvoiceMutationResult;
  } catch {
    const workingDetail = await loadAssignedInvoiceWorkingCopy(
      jobId,
      "Invoice changes need one successful invoice load before they can queue offline."
    );
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      input,
      jobId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "save_draft"
    });
    const optimisticDetail = withAssignedInvoiceQueueState(
      applyDraftUpdateOptimistically(workingDetail, input),
      {
        isCached: true,
        pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
      }
    );
    await saveAssignedInvoiceWorkingCopy(jobId, optimisticDetail);

    return {
      queued: true
    } satisfies AssignedInvoiceMutationResult;
  }
}

export async function addAssignedJobInvoiceLineItem(
  jobId: string,
  input: CreateInvoiceLineItemInput
) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    const lineItem = await addAssignedJobInvoiceLineItemRemote(jobId, input);
    const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

    if (cachedInvoice) {
      await saveAssignedInvoiceWorkingCopy(
        jobId,
        applyAddLineOptimistically(
          cachedInvoice.detail,
          lineItem?.id ?? buildOfflineEntityId("invoice-line"),
          input
        )
      );
    }

    return {
      lineItem,
      queued: false
    } satisfies AssignedInvoiceLineItemMutationResult;
  } catch {
    const workingDetail = await loadAssignedInvoiceWorkingCopy(
      jobId,
      "Invoice changes need one successful invoice load before they can queue offline."
    );
    const tempLineItemId = buildOfflineEntityId("offline-invoice-line");
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      input,
      jobId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "add_line",
      tempLineItemId
    });
    const optimisticDetail = withAssignedInvoiceQueueState(
      applyAddLineOptimistically(workingDetail, tempLineItemId, input),
      {
        isCached: true,
        pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
      }
    );
    await saveAssignedInvoiceWorkingCopy(jobId, optimisticDetail);

    return {
      lineItem: null,
      queued: true
    } satisfies AssignedInvoiceLineItemMutationResult;
  }
}

export async function saveAssignedJobInvoiceLineItem(
  jobId: string,
  lineItemId: string,
  input: UpdateInvoiceLineItemInput
) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    const lineItem = await saveAssignedJobInvoiceLineItemRemote(jobId, lineItemId, input);
    const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

    if (cachedInvoice) {
      await saveAssignedInvoiceWorkingCopy(
        jobId,
        applySaveLineOptimistically(cachedInvoice.detail, lineItemId, input)
      );
    }

    return {
      lineItem,
      queued: false
    } satisfies AssignedInvoiceLineItemMutationResult;
  } catch {
    const workingDetail = await loadAssignedInvoiceWorkingCopy(
      jobId,
      "Invoice changes need one successful invoice load before they can queue offline."
    );
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      input,
      jobId,
      lineItemId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "save_line"
    });
    const optimisticDetail = withAssignedInvoiceQueueState(
      applySaveLineOptimistically(workingDetail, lineItemId, input),
      {
        isCached: true,
        pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
      }
    );
    await saveAssignedInvoiceWorkingCopy(jobId, optimisticDetail);

    return {
      lineItem: null,
      queued: true
    } satisfies AssignedInvoiceLineItemMutationResult;
  }
}

export async function removeAssignedJobInvoiceLineItem(jobId: string, lineItemId: string) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    await removeAssignedJobInvoiceLineItemRemote(jobId, lineItemId);
    const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

    if (cachedInvoice) {
      await saveAssignedInvoiceWorkingCopy(
        jobId,
        applyRemoveLineOptimistically(cachedInvoice.detail, lineItemId)
      );
    }

    return {
      queued: false
    } satisfies AssignedInvoiceMutationResult;
  } catch {
    const workingDetail = await loadAssignedInvoiceWorkingCopy(
      jobId,
      "Invoice changes need one successful invoice load before they can queue offline."
    );
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      jobId,
      lineItemId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "remove_line"
    });
    const optimisticDetail = withAssignedInvoiceQueueState(
      applyRemoveLineOptimistically(workingDetail, lineItemId),
      {
        isCached: true,
        pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
      }
    );
    await saveAssignedInvoiceWorkingCopy(jobId, optimisticDetail);

    return {
      queued: true
    } satisfies AssignedInvoiceMutationResult;
  }
}

export async function recordAssignedJobManualPayment(
  jobId: string,
  input: ManualPaymentInput
) {
  try {
    await flushQueuedAssignedInvoiceMutations(jobId);
    const payment = await recordAssignedJobManualPaymentRemote(jobId, input);
    const cachedInvoice = await loadCachedAssignedInvoice<AssignedInvoiceDetail>(jobId);

    if (cachedInvoice) {
      await saveAssignedInvoiceWorkingCopy(
        jobId,
        applyManualPaymentToDetail(cachedInvoice.detail, payment)
      );
    }

    return {
      payment,
      queued: false
    } satisfies AssignedManualPaymentResult;
  } catch {
    const workingDetail = await loadAssignedInvoiceWorkingCopy(
      jobId,
      "Field payments need one successful invoice load before they can queue offline."
    );
    const tempPaymentId = buildOfflineEntityId("offline-manual-payment");
    const offlinePayment = buildOfflineManualPayment(workingDetail, tempPaymentId, input);
    const queuedCounts = await enqueueAssignedInvoiceMutation({
      createdAt: new Date().toISOString(),
      input,
      jobId,
      mutationId: buildOfflineEntityId("invoice-mutation"),
      mutationType: "record_manual_payment",
      tempPaymentId
    });
    const optimisticDetail = withAssignedInvoiceQueueState(
      applyManualPaymentToDetail(workingDetail, offlinePayment),
      {
        isCached: true,
        pendingInvoiceMutationCount: queuedCounts.pendingInvoiceMutationCount,
        pendingManualPaymentCount: queuedCounts.pendingManualPaymentCount
      }
    );
    await saveAssignedInvoiceWorkingCopy(jobId, optimisticDetail);

    return {
      payment: offlinePayment,
      queued: true
    } satisfies AssignedManualPaymentResult;
  }
}
