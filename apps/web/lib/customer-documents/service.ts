import {
  approveEstimateWithSignature,
  clearInvoicePaymentLink,
  changeEstimateStatus,
  completeCustomerDocumentLink,
  createCustomerDocumentLink,
  createEstimateSignatureSignedUrl,
  expireCustomerDocumentLink,
  getActiveCustomerDocumentLinkForEstimate,
  getActiveCustomerDocumentLinkForInvoice,
  getActiveCustomerDocumentLinkForJobVisit,
  getCompanyById,
  getCustomerById,
  getCustomerDocumentLinkById,
  getCustomerDocumentLinkByTokenHash,
  getEstimateDetailById,
  getJobById,
  getInvoiceDetailById,
  getLatestCustomerDocumentLinkForEstimate,
  getLatestCustomerDocumentLinkForInvoice,
  getLatestCustomerDocumentLinkForJobVisit,
  getVehicleById,
  listAddressesByCustomer,
  markCustomerDocumentLinkSent,
  markCustomerDocumentLinkViewed,
  recordCustomerDocumentLinkEvent,
  revokeActiveCustomerDocumentLinksForEstimate,
  revokeActiveCustomerDocumentLinksForInvoice,
  revokeActiveCustomerDocumentLinksForJobVisit,
  updateInvoicePaymentLink
} from "@mobile-mechanic/api-client";
import {
  canCustomerApproveEstimate,
  canCustomerDeclineEstimate,
  formatServiceAddressSummary,
  canCustomerPayInvoice,
  getCustomerDocumentLinkExpiresAt,
  getCustomerDisplayName,
  getVehicleDisplayName,
  isCustomerDocumentLinkExpired,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";
import type {
  ApproveEstimateViaLinkInput,
  CreateInvoiceCheckoutViaLinkInput,
  CustomerDocumentKind,
  CustomerDocumentLink,
  CustomerDocumentLinkSummary,
  DeclineEstimateViaLinkInput,
  EnsureEstimateAccessLinkInput,
  EnsureInvoiceAccessLinkInput,
  EnsureJobVisitAccessLinkInput,
  PublicEstimateDocument,
  PublicInvoiceDocument,
  PublicJobVisitDocument,
  ResolvedCustomerDocumentAccess,
  ResolveCustomerDocumentAccessInput,
  JobStatus
} from "@mobile-mechanic/types";
import {
  approveEstimateViaLinkInputSchema,
  createInvoiceCheckoutViaLinkInputSchema,
  declineEstimateViaLinkInputSchema,
  ensureEstimateAccessLinkInputSchema,
  ensureInvoiceAccessLinkInputSchema,
  ensureJobVisitAccessLinkInputSchema,
  resolveCustomerDocumentAccessInputSchema
} from "@mobile-mechanic/validation";
import type Stripe from "stripe";

import {
  buildCustomerDocumentToken,
  buildEstimateAccessUrl,
  buildInvoiceAccessUrl,
  buildVisitAccessUrl,
  hashCustomerDocumentToken,
  verifyCustomerDocumentToken
} from "./tokens";
import { createServiceRoleSupabaseClient } from "../supabase/service-role";
import { buildAppUrl } from "../server-env";
import { getStripeClient } from "../stripe";
import { getTechnicianProfilePreview } from "../technician-profiles/service";

type ResolveAccessOptions = {
  markViewed?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type InvoiceCheckoutSurface = "office" | "public";

class CustomerDocumentActionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerDocumentActionUnavailableError";
  }
}

class InvoiceCheckoutPendingError extends Error {
  constructor() {
    super("Invoice payment was already submitted and is waiting for Stripe reconciliation.");
    this.name = "InvoiceCheckoutPendingError";
  }
}

class InvoiceCheckoutRotationError extends Error {
  constructor() {
    super("Existing Stripe checkout could not be safely replaced.");
    this.name = "InvoiceCheckoutRotationError";
  }
}

export function isInvoiceCheckoutPendingError(error: unknown) {
  return error instanceof InvoiceCheckoutPendingError;
}

export function isInvoiceCheckoutRotationError(error: unknown) {
  return error instanceof InvoiceCheckoutRotationError;
}

export function isCustomerDocumentActionUnavailableError(error: unknown) {
  return error instanceof CustomerDocumentActionUnavailableError;
}

function isCustomerVisibleVisitJobStatus(status: string) {
  return status === "scheduled" || isTechnicianActiveFieldJobStatus(status as JobStatus);
}

function toPublicEstimateLinkSummary(link: CustomerDocumentLink): CustomerDocumentLinkSummary {
  const token = buildCustomerDocumentToken(link.id);

  return {
    linkId: link.id,
    documentKind: link.documentKind,
    status: link.status,
    publicUrl: buildEstimateAccessUrl(token),
    expiresAt: link.expiresAt,
    sentAt: link.sentAt,
    firstViewedAt: link.firstViewedAt,
    lastViewedAt: link.lastViewedAt,
    viewCount: link.viewCount
  };
}

function toPublicInvoiceLinkSummary(link: CustomerDocumentLink): CustomerDocumentLinkSummary {
  const token = buildCustomerDocumentToken(link.id);

  return {
    linkId: link.id,
    documentKind: link.documentKind,
    status: link.status,
    publicUrl: buildInvoiceAccessUrl(token),
    expiresAt: link.expiresAt,
    sentAt: link.sentAt,
    firstViewedAt: link.firstViewedAt,
    lastViewedAt: link.lastViewedAt,
    viewCount: link.viewCount
  };
}

function toPublicJobVisitLinkSummary(link: CustomerDocumentLink): CustomerDocumentLinkSummary {
  const token = buildCustomerDocumentToken(link.id);

  return {
    linkId: link.id,
    documentKind: link.documentKind,
    status: link.status,
    publicUrl: buildVisitAccessUrl(token),
    expiresAt: link.expiresAt,
    sentAt: link.sentAt,
    firstViewedAt: link.firstViewedAt,
    lastViewedAt: link.lastViewedAt,
    viewCount: link.viewCount
  };
}

async function recordLinkEventSafe(input: Parameters<typeof recordCustomerDocumentLinkEvent>[1]) {
  const client = createServiceRoleSupabaseClient();
  await recordCustomerDocumentLinkEvent(client, input);
}

async function expireLinkIfNeeded(link: CustomerDocumentLink) {
  if (!isCustomerDocumentLinkExpired(link)) {
    return link;
  }

  const client = createServiceRoleSupabaseClient();

  if (link.status === "active") {
    await expireCustomerDocumentLink(client, link.id, {
      expiredAt: new Date().toISOString()
    });

    await recordCustomerDocumentLinkEvent(client, {
      linkId: link.id,
      companyId: link.companyId,
      customerId: link.customerId,
      jobId: link.jobId,
      documentKind: link.documentKind,
      estimateId: link.estimateId,
      invoiceId: link.invoiceId,
      eventType: "expired"
    });

    const refreshed = await getCustomerDocumentLinkById(client, link.id);

    if (refreshed.error || !refreshed.data) {
      throw refreshed.error ?? new Error("Expired customer document link could not be reloaded.");
    }

    return refreshed.data;
  }

  return link;
}

function unavailableResult(
  kind: ResolvedCustomerDocumentAccess["unavailable"] extends infer T
    ? T extends { kind: infer K }
      ? K
      : never
    : never,
  message: string,
  link: CustomerDocumentLink | null = null
): ResolvedCustomerDocumentAccess {
  return {
    link,
    estimate: null,
    invoice: null,
    visit: null,
    unavailable: {
      kind,
      message
    }
  };
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    throw new Error("Signature image is invalid.");
  }

  const mimeType = match[1];
  const base64Payload = match[2];

  if (!mimeType || !base64Payload) {
    throw new Error("Signature image is invalid.");
  }

  const buffer = Uint8Array.from(Buffer.from(base64Payload, "base64"));

  return new Blob([buffer], { type: mimeType });
}

function getCustomerDocumentPublicUrl(kind: CustomerDocumentKind, linkId: string) {
  const token = buildCustomerDocumentToken(linkId);

  switch (kind) {
    case "estimate":
      return buildEstimateAccessUrl(token);
    case "invoice":
      return buildInvoiceAccessUrl(token);
    case "job_visit":
      return buildVisitAccessUrl(token);
  }
}

function buildInvoiceCheckoutReturnUrl(
  token: string | null,
  jobId: string,
  checkout: "success" | "canceled",
  surface: InvoiceCheckoutSurface
) {
  const url = new URL(buildAppUrl("payment/return"));
  url.searchParams.set("checkout", checkout);
  url.searchParams.set("jobId", jobId);
  url.searchParams.set("surface", surface);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

function getInvoiceCheckoutSurface(
  metadata: Record<string, string> | null | undefined
): InvoiceCheckoutSurface | null {
  const value = metadata?.checkoutSurface;
  return value === "office" || value === "public" ? value : null;
}

function isStripeMissingCheckoutSessionError(error: unknown) {
  return error instanceof Error && error.message.includes("No such checkout.session");
}

function isFutureIsoDate(value: string | null) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() > Date.now();
}

async function expireCheckoutSessionOrThrow(
  stripe: Stripe,
  checkoutSessionId: string,
  context: "invoice_link_rotation" | "checkout_session_replacement"
) {
  try {
    await stripe.checkout.sessions.expire(checkoutSessionId);
  } catch (error) {
    console.error("Failed to expire existing Stripe checkout session before replacement.", {
      checkoutSessionId,
      context,
      error: error instanceof Error ? error.message : error
    });

    throw new InvoiceCheckoutRotationError();
  }
}

async function ensureEstimateAccessLinkRecord(input: EnsureEstimateAccessLinkInput) {
  const parsed = ensureEstimateAccessLinkInputSchema.parse(input);
  const client = createServiceRoleSupabaseClient();
  const detailResult = await getEstimateDetailById(client, parsed.estimateId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Estimate detail not found.");
  }

  const detail = detailResult.data;

  if (detail.estimate.status !== "sent") {
    throw new Error("Customer estimate links are only available for sent estimates.");
  }

  const existingResult = await getActiveCustomerDocumentLinkForEstimate(client, parsed.estimateId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  const existing = existingResult.data ? await expireLinkIfNeeded(existingResult.data) : null;

  if (existing && existing.status === "active" && !parsed.rotate) {
    return existing;
  }

  if (existing && existing.status === "active") {
    await revokeActiveCustomerDocumentLinksForEstimate(client, parsed.estimateId, {
      reason: "Rotated for resend."
    });

    await recordCustomerDocumentLinkEvent(client, {
      linkId: existing.id,
      companyId: existing.companyId,
      customerId: existing.customerId,
      jobId: existing.jobId,
      documentKind: existing.documentKind,
      estimateId: existing.estimateId,
      invoiceId: existing.invoiceId,
      eventType: "revoked",
      createdByUserId: parsed.actorUserId,
      metadata: { reason: "Rotated for resend." }
    });
  }

  const linkId = crypto.randomUUID();
  const token = buildCustomerDocumentToken(linkId);
  const createResult = await createCustomerDocumentLink(client, {
    id: linkId,
    companyId: detail.estimate.companyId,
    customerId: detail.customer.id,
    jobId: detail.job.id,
    documentKind: "estimate",
    estimateId: detail.estimate.id,
    accessTokenHash: hashCustomerDocumentToken(token),
    expiresAt: getCustomerDocumentLinkExpiresAt(),
    createdByUserId: parsed.actorUserId
  });

  if (createResult.error || !createResult.data) {
    throw createResult.error ?? new Error("Estimate access link could not be created.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: createResult.data.id,
    companyId: createResult.data.companyId,
    customerId: createResult.data.customerId,
    jobId: createResult.data.jobId,
    documentKind: createResult.data.documentKind,
    estimateId: createResult.data.estimateId,
    invoiceId: createResult.data.invoiceId,
    eventType: "created",
    createdByUserId: parsed.actorUserId
  });

  return createResult.data;
}

async function ensureInvoiceAccessLinkRecord(input: EnsureInvoiceAccessLinkInput) {
  const parsed = ensureInvoiceAccessLinkInputSchema.parse(input);
  const client = createServiceRoleSupabaseClient();
  const detailResult = await getInvoiceDetailById(client, parsed.invoiceId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Invoice detail not found.");
  }

  const detail = detailResult.data;

  if (!canCustomerPayInvoice(detail.invoice.status, detail.invoice.balanceDueCents, "active")) {
    throw new Error("Customer invoice links are only available for payable invoices.");
  }

  const existingResult = await getActiveCustomerDocumentLinkForInvoice(client, parsed.invoiceId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  const existing = existingResult.data ? await expireLinkIfNeeded(existingResult.data) : null;

  if (existing && existing.status === "active" && !parsed.rotate) {
    return existing;
  }

  if (existing && existing.status === "active") {
    await revokeActiveCustomerDocumentLinksForInvoice(client, parsed.invoiceId, {
      reason: "Rotated for resend."
    });

    await recordCustomerDocumentLinkEvent(client, {
      linkId: existing.id,
      companyId: existing.companyId,
      customerId: existing.customerId,
      jobId: existing.jobId,
      documentKind: existing.documentKind,
      estimateId: existing.estimateId,
      invoiceId: existing.invoiceId,
      eventType: "revoked",
      createdByUserId: parsed.actorUserId,
      metadata: { reason: "Rotated for resend." }
    });
  }

  if (detail.invoice.paymentUrl || detail.invoice.paymentUrlExpiresAt || detail.invoice.stripeCheckoutSessionId) {
    if (
      detail.invoice.stripeCheckoutSessionId &&
      isFutureIsoDate(detail.invoice.paymentUrlExpiresAt)
    ) {
      const stripe = getStripeClient();
      await expireCheckoutSessionOrThrow(
        stripe,
        detail.invoice.stripeCheckoutSessionId,
        "invoice_link_rotation"
      );
    }

    const clearedPaymentLinkResult = await clearInvoicePaymentLink(client, detail.invoice.id);

    if (clearedPaymentLinkResult.error) {
      throw clearedPaymentLinkResult.error;
    }
  }

  const linkId = crypto.randomUUID();
  const token = buildCustomerDocumentToken(linkId);
  const createResult = await createCustomerDocumentLink(client, {
    id: linkId,
    companyId: detail.invoice.companyId,
    customerId: detail.customer.id,
    jobId: detail.job.id,
    documentKind: "invoice",
    invoiceId: detail.invoice.id,
    accessTokenHash: hashCustomerDocumentToken(token),
    expiresAt: getCustomerDocumentLinkExpiresAt(),
    createdByUserId: parsed.actorUserId
  });

  if (createResult.error || !createResult.data) {
    throw createResult.error ?? new Error("Invoice access link could not be created.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: createResult.data.id,
    companyId: createResult.data.companyId,
    customerId: createResult.data.customerId,
    jobId: createResult.data.jobId,
    documentKind: createResult.data.documentKind,
    estimateId: createResult.data.estimateId,
    invoiceId: createResult.data.invoiceId,
    eventType: "created",
    createdByUserId: parsed.actorUserId
  });

  return createResult.data;
}

async function ensureJobVisitAccessLinkRecord(input: EnsureJobVisitAccessLinkInput) {
  const parsed = ensureJobVisitAccessLinkInputSchema.parse(input);
  const client = createServiceRoleSupabaseClient();
  const jobResult = await getJobById(client, parsed.jobId);

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Visit detail not found.");
  }

  const job = jobResult.data;

  if (!job.assignedTechnicianUserId) {
    throw new Error("Meet Your Mechanic links require an assigned technician.");
  }

  if (!isCustomerVisibleVisitJobStatus(job.status)) {
    throw new Error(
      "Meet Your Mechanic links are only available for scheduled or active field visits."
    );
  }

  const technicianPreview = await getTechnicianProfilePreview(client, job.assignedTechnicianUserId);

  if (!technicianPreview.isReady) {
    throw new Error(
      `Meet Your Mechanic requires ${technicianPreview.missingFields.join(", ")} before sharing.`
    );
  }

  const existingResult = await getActiveCustomerDocumentLinkForJobVisit(client, parsed.jobId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  const existing = existingResult.data ? await expireLinkIfNeeded(existingResult.data) : null;

  if (existing && existing.status === "active" && !parsed.rotate) {
    return existing;
  }

  if (existing && existing.status === "active") {
    await revokeActiveCustomerDocumentLinksForJobVisit(client, parsed.jobId, {
      reason: "Rotated for resend."
    });

    await recordCustomerDocumentLinkEvent(client, {
      linkId: existing.id,
      companyId: existing.companyId,
      customerId: existing.customerId,
      jobId: existing.jobId,
      documentKind: existing.documentKind,
      estimateId: existing.estimateId,
      invoiceId: existing.invoiceId,
      eventType: "revoked",
      createdByUserId: parsed.actorUserId,
      metadata: { reason: "Rotated for resend." }
    });
  }

  const linkId = crypto.randomUUID();
  const token = buildCustomerDocumentToken(linkId);
  const createResult = await createCustomerDocumentLink(client, {
    id: linkId,
    companyId: job.companyId,
    customerId: job.customerId,
    jobId: job.id,
    documentKind: "job_visit",
    accessTokenHash: hashCustomerDocumentToken(token),
    expiresAt: getCustomerDocumentLinkExpiresAt(),
    createdByUserId: parsed.actorUserId
  });

  if (createResult.error || !createResult.data) {
    throw createResult.error ?? new Error("Meet Your Mechanic link could not be created.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: createResult.data.id,
    companyId: createResult.data.companyId,
    customerId: createResult.data.customerId,
    jobId: createResult.data.jobId,
    documentKind: createResult.data.documentKind,
    estimateId: createResult.data.estimateId,
    invoiceId: createResult.data.invoiceId,
    eventType: "created",
    createdByUserId: parsed.actorUserId
  });

  return createResult.data;
}

export async function ensureEstimateAccessLink(input: EnsureEstimateAccessLinkInput) {
  const link = await ensureEstimateAccessLinkRecord(input);
  return toPublicEstimateLinkSummary(link);
}

export async function ensureInvoiceAccessLink(input: EnsureInvoiceAccessLinkInput) {
  const link = await ensureInvoiceAccessLinkRecord(input);
  return toPublicInvoiceLinkSummary(link);
}

export async function ensureJobVisitAccessLink(input: EnsureJobVisitAccessLinkInput) {
  const link = await ensureJobVisitAccessLinkRecord(input);
  return toPublicJobVisitLinkSummary(link);
}

export async function getEstimateAccessLinkSummary(estimateId: string) {
  const client = createServiceRoleSupabaseClient();
  const existingResult = await getLatestCustomerDocumentLinkForEstimate(client, estimateId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  if (!existingResult.data) {
    return null;
  }

  const link = await expireLinkIfNeeded(existingResult.data);
  return toPublicEstimateLinkSummary(link);
}

export async function getInvoiceAccessLinkSummary(invoiceId: string) {
  const client = createServiceRoleSupabaseClient();
  const existingResult = await getLatestCustomerDocumentLinkForInvoice(client, invoiceId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  if (!existingResult.data) {
    return null;
  }

  const link = await expireLinkIfNeeded(existingResult.data);
  return toPublicInvoiceLinkSummary(link);
}

export async function getJobVisitAccessLinkSummary(jobId: string) {
  const client = createServiceRoleSupabaseClient();
  const existingResult = await getLatestCustomerDocumentLinkForJobVisit(client, jobId);

  if (existingResult.error) {
    throw existingResult.error;
  }

  if (!existingResult.data) {
    return null;
  }

  const link = await expireLinkIfNeeded(existingResult.data);
  return toPublicJobVisitLinkSummary(link);
}

export async function markEstimateAccessLinkSent(linkId: string, communicationId: string | null, actorUserId: string) {
  const client = createServiceRoleSupabaseClient();
  const updated = await markCustomerDocumentLinkSent(client, linkId, {
    communicationId,
    sentAt: new Date().toISOString()
  });

  if (updated.error || !updated.data) {
    throw updated.error ?? new Error("Estimate access link sent state could not be updated.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: updated.data.id,
    companyId: updated.data.companyId,
    customerId: updated.data.customerId,
    jobId: updated.data.jobId,
    documentKind: updated.data.documentKind,
    estimateId: updated.data.estimateId,
    invoiceId: updated.data.invoiceId,
    eventType: "sent",
    createdByUserId: actorUserId,
    metadata: {
      communicationId
    }
  });

  return toPublicEstimateLinkSummary(updated.data);
}

export async function markInvoiceAccessLinkSent(linkId: string, communicationId: string | null, actorUserId: string) {
  const client = createServiceRoleSupabaseClient();
  const updated = await markCustomerDocumentLinkSent(client, linkId, {
    communicationId,
    sentAt: new Date().toISOString()
  });

  if (updated.error || !updated.data) {
    throw updated.error ?? new Error("Invoice access link sent state could not be updated.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: updated.data.id,
    companyId: updated.data.companyId,
    customerId: updated.data.customerId,
    jobId: updated.data.jobId,
    documentKind: updated.data.documentKind,
    estimateId: updated.data.estimateId,
    invoiceId: updated.data.invoiceId,
    eventType: "sent",
    createdByUserId: actorUserId,
    metadata: {
      communicationId
    }
  });

  return toPublicInvoiceLinkSummary(updated.data);
}

export async function markJobVisitAccessLinkSent(
  linkId: string,
  communicationId: string | null,
  actorUserId: string
) {
  const client = createServiceRoleSupabaseClient();
  const updated = await markCustomerDocumentLinkSent(client, linkId, {
    communicationId,
    sentAt: new Date().toISOString()
  });

  if (updated.error || !updated.data) {
    throw updated.error ?? new Error("Meet Your Mechanic link sent state could not be updated.");
  }

  await recordCustomerDocumentLinkEvent(client, {
    linkId: updated.data.id,
    companyId: updated.data.companyId,
    customerId: updated.data.customerId,
    jobId: updated.data.jobId,
    documentKind: updated.data.documentKind,
    estimateId: updated.data.estimateId,
    invoiceId: updated.data.invoiceId,
    eventType: "sent",
    createdByUserId: actorUserId,
    metadata: {
      communicationId
    }
  });

  return toPublicJobVisitLinkSummary(updated.data);
}

export async function resolveCustomerDocumentAccess(
  input: ResolveCustomerDocumentAccessInput,
  options: ResolveAccessOptions = {}
): Promise<ResolvedCustomerDocumentAccess> {
  const parsed = resolveCustomerDocumentAccessInputSchema.parse(input);
  const linkId = verifyCustomerDocumentToken(parsed.token);

  if (!linkId) {
    return unavailableResult("invalid", "This link is invalid or unavailable.");
  }

  const client = createServiceRoleSupabaseClient();
  const linkResult = await getCustomerDocumentLinkByTokenHash(client, hashCustomerDocumentToken(parsed.token));

  if (linkResult.error) {
    throw linkResult.error;
  }

  if (!linkResult.data || linkResult.data.id !== linkId) {
    return unavailableResult("invalid", "This link is invalid or unavailable.");
  }

  const link = await expireLinkIfNeeded(linkResult.data);

  if (link.status === "expired") {
    return unavailableResult("expired", "This link has expired. Please request a fresh link from the shop.", link);
  }

  if (link.status === "revoked") {
    return unavailableResult("revoked", "This link is no longer available. Please request a fresh link from the shop.", link);
  }

  if (link.documentKind === "estimate") {
    const detailResult = await getEstimateDetailById(client, link.estimateId ?? "");

    if (detailResult.error || !detailResult.data) {
      throw detailResult.error ?? new Error("Estimate detail not found.");
    }

    const signatureSignedUrlResult = detailResult.data.signature
      ? await createEstimateSignatureSignedUrl(client, detailResult.data.signature)
      : { data: null, error: null };

    if (signatureSignedUrlResult.error) {
      throw signatureSignedUrlResult.error;
    }

    if (["accepted", "declined"].includes(detailResult.data.estimate.status) && link.status === "active") {
      await completeCustomerDocumentLink(client, link.id, { completedAt: new Date().toISOString() });
    }

    const refreshedLinkResult = await getCustomerDocumentLinkById(client, link.id);

    if (refreshedLinkResult.error || !refreshedLinkResult.data) {
      throw refreshedLinkResult.error ?? new Error("Customer estimate link could not be reloaded.");
    }

    if (options.markViewed) {
      await markCustomerDocumentLinkViewed(client, refreshedLinkResult.data.id, {
        viewedAt: new Date().toISOString()
      });

      await recordCustomerDocumentLinkEvent(client, {
        linkId: refreshedLinkResult.data.id,
        companyId: refreshedLinkResult.data.companyId,
        customerId: refreshedLinkResult.data.customerId,
        jobId: refreshedLinkResult.data.jobId,
        documentKind: refreshedLinkResult.data.documentKind,
        estimateId: refreshedLinkResult.data.estimateId,
        invoiceId: refreshedLinkResult.data.invoiceId,
        eventType: "viewed",
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null
      });
    }

    const detail = detailResult.data;
    const companyResult = await getCompanyById(client, detail.estimate.companyId);

    if (companyResult.error || !companyResult.data) {
      throw companyResult.error ?? new Error("Company not found.");
    }

    const estimate: PublicEstimateDocument = {
      documentKind: "estimate",
      companyName: companyResult.data.name,
      companyTimeZone: companyResult.data.timezone,
      customerName: getCustomerDisplayName(detail.customer),
      jobTitle: detail.job.title,
      vehicleLabel: getVehicleDisplayName(detail.vehicle),
      estimateNumber: detail.estimate.estimateNumber,
      title: detail.estimate.title,
      notes: detail.estimate.notes,
      terms: detail.estimate.terms,
      status: detail.estimate.status,
      taxRateBasisPoints: detail.estimate.taxRateBasisPoints,
      lineItems: detail.lineItems.map((item) => ({
        itemType: item.itemType,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineSubtotalCents: item.lineSubtotalCents,
        taxable: item.taxable
      })),
      totals: detail.totals,
      sentAt: detail.estimate.sentAt,
      acceptedAt: detail.estimate.acceptedAt,
      declinedAt: detail.estimate.declinedAt,
      voidedAt: detail.estimate.voidedAt,
      approvedByName: detail.estimate.approvedByName,
      approvalStatement: detail.estimate.approvalStatement,
      signatureImageUrl: signatureSignedUrlResult.data?.signedUrl ?? null,
      canApprove: canCustomerApproveEstimate(detail.estimate.status, refreshedLinkResult.data.status),
      canDecline: canCustomerDeclineEstimate(detail.estimate.status, refreshedLinkResult.data.status)
    };

    return {
      link: refreshedLinkResult.data,
      estimate,
      invoice: null,
      visit: null,
      unavailable: null
    };
  }

  if (link.documentKind === "job_visit") {
    const [jobResult, customerResult, companyResult, addressResult] = await Promise.all([
      getJobById(client, link.jobId),
      getCustomerById(client, link.customerId),
      getCompanyById(client, link.companyId),
      listAddressesByCustomer(client, link.customerId)
    ]);

    if (jobResult.error || !jobResult.data) {
      throw jobResult.error ?? new Error("Visit detail not found.");
    }

    if (customerResult.error || !customerResult.data) {
      throw customerResult.error ?? new Error("Customer not found.");
    }

    const job = jobResult.data;
    const vehicleLookup = await getVehicleById(client, job.vehicleId);

    if (vehicleLookup.error || !vehicleLookup.data) {
      throw vehicleLookup.error ?? new Error("Vehicle not found.");
    }

    if (companyResult.error || !companyResult.data) {
      throw companyResult.error ?? new Error("Company not found.");
    }

    if (addressResult.error) {
      throw addressResult.error;
    }

    const serviceSiteResult = job.serviceSiteId
      ? await client.from("customer_addresses").select("*").eq("id", job.serviceSiteId).single()
      : { data: null, error: null };

    if (serviceSiteResult.error) {
      throw serviceSiteResult.error;
    }

    const refreshedLinkResult = await getCustomerDocumentLinkById(client, link.id);

    if (refreshedLinkResult.error || !refreshedLinkResult.data) {
      throw refreshedLinkResult.error ?? new Error("Meet Your Mechanic link could not be reloaded.");
    }

    if (!job.assignedTechnicianUserId || !isCustomerVisibleVisitJobStatus(job.status)) {
      return unavailableResult(
        "revoked",
        "This visit link is no longer available. Please contact the shop for current visit details.",
        refreshedLinkResult.data
      );
    }

    if (options.markViewed) {
      await markCustomerDocumentLinkViewed(client, refreshedLinkResult.data.id, {
        viewedAt: new Date().toISOString()
      });

      await recordCustomerDocumentLinkEvent(client, {
        linkId: refreshedLinkResult.data.id,
        companyId: refreshedLinkResult.data.companyId,
        customerId: refreshedLinkResult.data.customerId,
        jobId: refreshedLinkResult.data.jobId,
        documentKind: refreshedLinkResult.data.documentKind,
        estimateId: refreshedLinkResult.data.estimateId,
        invoiceId: refreshedLinkResult.data.invoiceId,
        eventType: "viewed",
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null
      });
    }

    const primaryAddress = (addressResult.data ?? [])[0] ?? null;
    const serviceSite = serviceSiteResult.data ?? primaryAddress;
    const servicePostalCode = serviceSite
      ? "postal_code" in serviceSite
        ? serviceSite.postal_code
        : serviceSite.postalCode
      : null;
    const technicianPreview = await getTechnicianProfilePreview(client, job.assignedTechnicianUserId);
    const visit: PublicJobVisitDocument = {
      documentKind: "job_visit",
      companyName: companyResult.data.name,
      companyTimeZone: companyResult.data.timezone,
      customerName: getCustomerDisplayName(customerResult.data),
      jobTitle: job.title,
      jobStatus: job.status,
      vehicleLabel: getVehicleDisplayName(vehicleLookup.data),
      serviceAddress: serviceSite && servicePostalCode
        ? formatServiceAddressSummary({
            line1: serviceSite.line1,
            line2: serviceSite.line2,
            city: serviceSite.city,
            state: serviceSite.state,
            postalCode: servicePostalCode
          })
        : null,
      scheduledStartAt: job.scheduledStartAt,
      scheduledEndAt: job.scheduledEndAt,
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      arrivalWindowEndAt: job.arrivalWindowEndAt,
      technicianName: technicianPreview.technicianName,
      technician: technicianPreview.profile
    };

    return {
      link: refreshedLinkResult.data,
      estimate: null,
      invoice: null,
      visit,
      unavailable: null
    };
  }

  const detailResult = await getInvoiceDetailById(client, link.invoiceId ?? "");

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Invoice detail not found.");
  }

  if (detailResult.data.invoice.status === "paid" && link.status === "active") {
    await completeCustomerDocumentLink(client, link.id, { completedAt: new Date().toISOString() });
  }

  const refreshedLinkResult = await getCustomerDocumentLinkById(client, link.id);

  if (refreshedLinkResult.error || !refreshedLinkResult.data) {
    throw refreshedLinkResult.error ?? new Error("Customer invoice link could not be reloaded.");
  }

  if (options.markViewed) {
    await markCustomerDocumentLinkViewed(client, refreshedLinkResult.data.id, {
      viewedAt: new Date().toISOString()
    });

    await recordCustomerDocumentLinkEvent(client, {
      linkId: refreshedLinkResult.data.id,
      companyId: refreshedLinkResult.data.companyId,
      customerId: refreshedLinkResult.data.customerId,
      jobId: refreshedLinkResult.data.jobId,
      documentKind: refreshedLinkResult.data.documentKind,
      estimateId: refreshedLinkResult.data.estimateId,
      invoiceId: refreshedLinkResult.data.invoiceId,
      eventType: "viewed",
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null
    });
  }

  const detail = detailResult.data;
  const companyResult = await getCompanyById(client, detail.invoice.companyId);

  if (companyResult.error || !companyResult.data) {
    throw companyResult.error ?? new Error("Company not found.");
  }

  const invoice: PublicInvoiceDocument = {
    documentKind: "invoice",
    companyName: companyResult.data.name,
    companyTimeZone: companyResult.data.timezone,
    customerName: getCustomerDisplayName(detail.customer),
    jobTitle: detail.job.title,
    vehicleLabel: getVehicleDisplayName(detail.vehicle),
    invoiceNumber: detail.invoice.invoiceNumber,
    title: detail.invoice.title,
    notes: detail.invoice.notes,
    terms: detail.invoice.terms,
    status: detail.invoice.status,
    taxRateBasisPoints: detail.invoice.taxRateBasisPoints,
    lineItems: detail.lineItems.map((item) => ({
      itemType: item.itemType,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineSubtotalCents: item.lineSubtotalCents,
      taxable: item.taxable
    })),
    totals: detail.totals,
    dueAt: detail.invoice.dueAt,
    issuedAt: detail.invoice.issuedAt,
    paidAt: detail.invoice.paidAt,
    voidedAt: detail.invoice.voidedAt,
    canPay: canCustomerPayInvoice(
      detail.invoice.status,
      detail.invoice.balanceDueCents,
      refreshedLinkResult.data.status
    )
  };

  return {
    link: refreshedLinkResult.data,
    estimate: null,
    invoice,
    visit: null,
    unavailable: null
  };
}

export async function approveEstimateFromAccessLink(input: ApproveEstimateViaLinkInput) {
  const parsed = approveEstimateViaLinkInputSchema.parse(input);
  const resolved = await resolveCustomerDocumentAccess(
    { token: parsed.token },
    { markViewed: false }
  );

  if (!resolved.link || !resolved.estimate || resolved.unavailable) {
    throw new CustomerDocumentActionUnavailableError(
      resolved.unavailable?.message ?? "Estimate approval link is unavailable."
    );
  }

  if (!resolved.estimate.canApprove || !resolved.link.estimateId) {
    throw new CustomerDocumentActionUnavailableError(
      "This estimate can no longer be approved from this link."
    );
  }

  const client = createServiceRoleSupabaseClient();
  await recordCustomerDocumentLinkEvent(client, {
    linkId: resolved.link.id,
    companyId: resolved.link.companyId,
    customerId: resolved.link.customerId,
    jobId: resolved.link.jobId,
    documentKind: resolved.link.documentKind,
    estimateId: resolved.link.estimateId,
    invoiceId: resolved.link.invoiceId,
    eventType: "approval_started"
  });

  const signatureBlob = dataUrlToBlob(parsed.signatureDataUrl);
  const approvalResult = await approveEstimateWithSignature(client, signatureBlob, {
    signatureId: crypto.randomUUID(),
    estimateId: resolved.link.estimateId,
    companyId: resolved.link.companyId,
    jobId: resolved.link.jobId,
    signedByName: parsed.signedByName,
    statement: parsed.statement,
    capturedByUserId: null,
    mimeType: "image/png",
    fileSizeBytes: signatureBlob.size
  });

  if (approvalResult.error || !approvalResult.data) {
    throw approvalResult.error ?? new Error("Estimate approval failed.");
  }

  await completeCustomerDocumentLink(client, resolved.link.id, {
    completedAt: approvalResult.data.acceptedAt ?? new Date().toISOString()
  });

  await recordCustomerDocumentLinkEvent(client, {
    linkId: resolved.link.id,
    companyId: resolved.link.companyId,
    customerId: resolved.link.customerId,
    jobId: resolved.link.jobId,
    documentKind: resolved.link.documentKind,
    estimateId: resolved.link.estimateId,
    invoiceId: resolved.link.invoiceId,
    eventType: "approved",
    metadata: {
      signedByName: parsed.signedByName
    }
  });

  return approvalResult.data;
}

export async function declineEstimateFromAccessLink(input: DeclineEstimateViaLinkInput) {
  const parsed = declineEstimateViaLinkInputSchema.parse(input);
  const resolved = await resolveCustomerDocumentAccess(
    { token: parsed.token },
    { markViewed: false }
  );

  if (!resolved.link || !resolved.estimate || resolved.unavailable) {
    throw new CustomerDocumentActionUnavailableError(
      resolved.unavailable?.message ?? "Estimate decline link is unavailable."
    );
  }

  if (!resolved.estimate.canDecline || !resolved.link.estimateId) {
    throw new CustomerDocumentActionUnavailableError(
      "This estimate can no longer be declined from this link."
    );
  }

  const client = createServiceRoleSupabaseClient();
  const declineResult = await changeEstimateStatus(client, resolved.link.estimateId, {
    status: "declined"
  });

  if (declineResult.error || !declineResult.data) {
    throw declineResult.error ?? new Error("Estimate decline failed.");
  }

  await completeCustomerDocumentLink(client, resolved.link.id, {
    completedAt: declineResult.data.declinedAt ?? new Date().toISOString()
  });

  await recordCustomerDocumentLinkEvent(client, {
    linkId: resolved.link.id,
    companyId: resolved.link.companyId,
    customerId: resolved.link.customerId,
    jobId: resolved.link.jobId,
    documentKind: resolved.link.documentKind,
    estimateId: resolved.link.estimateId,
    invoiceId: resolved.link.invoiceId,
    eventType: "declined"
  });

  return declineResult.data;
}

async function createOrReuseInvoiceCheckoutSession(input: {
  detail: NonNullable<Awaited<ReturnType<typeof getInvoiceDetailById>>["data"]>;
  link: CustomerDocumentLink | null;
  token: string | null;
  surface: InvoiceCheckoutSurface;
}) {
  const client = createServiceRoleSupabaseClient();
  const stripe = getStripeClient();
  const invoice = input.detail.invoice;

  async function clearPersistedCheckoutSession(existingSession?: Stripe.Checkout.Session | null) {
    if (existingSession?.status === "open") {
      await expireCheckoutSessionOrThrow(
        stripe,
        existingSession.id,
        "checkout_session_replacement"
      );
    }

    if (invoice.paymentUrl || invoice.paymentUrlExpiresAt || invoice.stripeCheckoutSessionId) {
      const clearedPaymentLinkResult = await clearInvoicePaymentLink(client, invoice.id);

      if (clearedPaymentLinkResult.error) {
        throw clearedPaymentLinkResult.error;
      }
    }
  }

  if (invoice.paymentUrl && isFutureIsoDate(invoice.paymentUrlExpiresAt)) {
    if (!invoice.stripeCheckoutSessionId) {
      await clearPersistedCheckoutSession();
    } else {
      let existingSession: Stripe.Checkout.Session | null = null;

      try {
        existingSession = await stripe.checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);
      } catch (error) {
        if (!isStripeMissingCheckoutSessionError(error)) {
          throw error;
        }

        await clearPersistedCheckoutSession();
      }

      if (existingSession) {
        if (existingSession.status === "complete" || existingSession.payment_status === "paid") {
          throw new InvoiceCheckoutPendingError();
        }

        const existingSessionHasCustomerLink =
          typeof existingSession.metadata?.customerDocumentLinkId === "string" &&
          existingSession.metadata.customerDocumentLinkId.trim().length > 0;
        const canReuseExistingSession =
          existingSession.status === "open" &&
          existingSession.payment_status === "unpaid" &&
          getInvoiceCheckoutSurface(existingSession.metadata) === input.surface &&
          existingSessionHasCustomerLink === Boolean(input.link);

        if (canReuseExistingSession) {
          if (input.link) {
            await recordCustomerDocumentLinkEvent(client, {
              linkId: input.link.id,
              companyId: input.link.companyId,
              customerId: input.link.customerId,
              jobId: input.link.jobId,
              documentKind: input.link.documentKind,
              estimateId: input.link.estimateId,
              invoiceId: input.link.invoiceId,
              eventType: "payment_started",
              metadata: {
                checkoutSurface: input.surface,
                reusedExistingCheckoutSession: true,
                stripeCheckoutSessionId: existingSession.id
              }
            });
          }

          return existingSession.url ?? invoice.paymentUrl;
        }

        await clearPersistedCheckoutSession(existingSession);
      }
    }
  } else if (invoice.paymentUrl || invoice.paymentUrlExpiresAt || invoice.stripeCheckoutSessionId) {
    await clearPersistedCheckoutSession();
  }

  const checkoutMetadata: Record<string, string> = {
    checkoutSurface: input.surface,
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    jobId: invoice.jobId
  };

  if (input.link) {
    checkoutMetadata.customerDocumentLinkId = input.link.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      billing_address_collection: "auto",
      client_reference_id: invoice.id,
      metadata: checkoutMetadata,
      success_url: buildInvoiceCheckoutReturnUrl(input.token, invoice.jobId, "success", input.surface),
      cancel_url: buildInvoiceCheckoutReturnUrl(input.token, invoice.jobId, "canceled", input.surface),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: invoice.currencyCode.toLowerCase(),
            unit_amount: input.detail.totals.balanceDueCents,
            product_data: {
              name: invoice.title,
              description: `Invoice ${invoice.invoiceNumber} for ${getCustomerDisplayName(input.detail.customer)}`
            }
          }
        }
      ]
    },
    {
      idempotencyKey: [
        "invoice-checkout",
        invoice.id,
        input.surface,
        input.detail.totals.balanceDueCents,
        invoice.updatedAt
      ].join(":")
    }
  );

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  const paymentUrlExpiresAt = checkoutSession.expires_at
    ? new Date(checkoutSession.expires_at * 1000).toISOString()
    : null;
  const paymentLinkResult = await updateInvoicePaymentLink(client, invoice.id, {
    paymentUrl: checkoutSession.url,
    paymentUrlExpiresAt,
    stripeCheckoutSessionId: checkoutSession.id
  });

  if (paymentLinkResult.error) {
    try {
      await stripe.checkout.sessions.expire(checkoutSession.id);
    } catch {
      // Best-effort cleanup. Stripe webhook idempotency still protects reconciliation if expiry fails.
    }

    throw paymentLinkResult.error;
  }

  if (input.link) {
    await recordCustomerDocumentLinkEvent(client, {
      linkId: input.link.id,
      companyId: input.link.companyId,
      customerId: input.link.customerId,
      jobId: input.link.jobId,
      documentKind: input.link.documentKind,
      estimateId: input.link.estimateId,
      invoiceId: input.link.invoiceId,
      eventType: "payment_started",
      metadata: {
        checkoutSurface: input.surface,
        stripeCheckoutSessionId: checkoutSession.id
      }
    });
  }

  return checkoutSession.url;
}

export async function createInvoiceCheckoutFromAccessLink(input: CreateInvoiceCheckoutViaLinkInput) {
  const parsed = createInvoiceCheckoutViaLinkInputSchema.parse(input);
  const resolved = await resolveCustomerDocumentAccess(
    { token: parsed.token },
    { markViewed: false }
  );

  if (!resolved.link || !resolved.invoice || resolved.unavailable) {
    throw new CustomerDocumentActionUnavailableError(
      resolved.unavailable?.message ?? "Invoice payment link is unavailable."
    );
  }

  if (!resolved.invoice.canPay || !resolved.link.invoiceId) {
    throw new CustomerDocumentActionUnavailableError(
      "This invoice can no longer accept payment from this link."
    );
  }

  const client = createServiceRoleSupabaseClient();
  const detailResult = await getInvoiceDetailById(client, resolved.link.invoiceId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Invoice detail not found.");
  }

  return createOrReuseInvoiceCheckoutSession({
    detail: detailResult.data,
    link: resolved.link,
    token: parsed.token,
    surface: "public"
  });
}

export async function createInvoiceCheckoutForOffice(input: { invoiceId: string }) {
  const detailResult = await getInvoiceDetailById(createServiceRoleSupabaseClient(), input.invoiceId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Invoice detail not found.");
  }

  return createOrReuseInvoiceCheckoutSession({
    detail: detailResult.data,
    link: null,
    token: null,
    surface: "office"
  });
}

export async function completeInvoiceAccessLinkAfterPayment(linkId: string) {
  const client = createServiceRoleSupabaseClient();
  const linkResult = await getCustomerDocumentLinkById(client, linkId);

  if (linkResult.error || !linkResult.data) {
    throw linkResult.error ?? new Error("Invoice access link not found.");
  }

  await completeCustomerDocumentLink(client, linkId, {
    completedAt: new Date().toISOString()
  });

  await recordCustomerDocumentLinkEvent(client, {
    linkId: linkResult.data.id,
    companyId: linkResult.data.companyId,
    customerId: linkResult.data.customerId,
    jobId: linkResult.data.jobId,
    documentKind: linkResult.data.documentKind,
    estimateId: linkResult.data.estimateId,
    invoiceId: linkResult.data.invoiceId,
    eventType: "payment_succeeded"
  });
}

export function buildCustomerDocumentPublicUrl(kind: CustomerDocumentKind, linkId: string) {
  return getCustomerDocumentPublicUrl(kind, linkId);
}
