import type { Json, TimestampFields, UUID } from "./common";
import type { EstimateLineItem, EstimateTotals, EstimateStatus } from "./estimate";
import type { InvoiceLineItem, InvoiceTotals, InvoiceStatus } from "./invoice";
import type { JobStatus } from "./job";
import type { PublicTechnicianProfile } from "./technician-profile";

export const customerDocumentKinds = ["estimate", "invoice", "job_visit"] as const;

export type CustomerDocumentKind = (typeof customerDocumentKinds)[number];

export const customerDocumentLinkStatuses = ["active", "expired", "revoked", "completed"] as const;

export type CustomerDocumentLinkStatus = (typeof customerDocumentLinkStatuses)[number];

export const customerDocumentEventTypes = [
  "created",
  "sent",
  "viewed",
  "copied",
  "approval_started",
  "approved",
  "declined",
  "payment_started",
  "payment_succeeded",
  "payment_failed",
  "expired",
  "revoked"
] as const;

export type CustomerDocumentEventType = (typeof customerDocumentEventTypes)[number];

export interface CustomerDocumentLink extends TimestampFields {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID;
  documentKind: CustomerDocumentKind;
  estimateId: UUID | null;
  invoiceId: UUID | null;
  accessTokenHash: string;
  status: CustomerDocumentLinkStatus;
  expiresAt: string;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  sentAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  lastSentCommunicationId: UUID | null;
  createdByUserId: UUID;
}

export interface CustomerDocumentLinkEvent {
  id: UUID;
  linkId: UUID;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID;
  documentKind: CustomerDocumentKind;
  estimateId: UUID | null;
  invoiceId: UUID | null;
  eventType: CustomerDocumentEventType;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Json;
  createdByUserId: UUID | null;
  createdAt: string;
}

export interface CustomerDocumentLinkSummary {
  linkId: UUID;
  documentKind: CustomerDocumentKind;
  status: CustomerDocumentLinkStatus;
  publicUrl: string;
  expiresAt: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

export interface CreateCustomerDocumentLinkInput {
  id?: UUID | undefined;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID;
  documentKind: CustomerDocumentKind;
  estimateId?: UUID | null | undefined;
  invoiceId?: UUID | null | undefined;
  accessTokenHash: string;
  expiresAt: string;
  createdByUserId: UUID;
}

export interface UpdateCustomerDocumentLinkViewInput {
  viewedAt?: string | undefined;
}

export interface UpdateCustomerDocumentLinkSentInput {
  sentAt?: string | undefined;
  communicationId?: UUID | null | undefined;
}

export interface CompleteCustomerDocumentLinkInput {
  completedAt?: string | undefined;
}

export interface RevokeCustomerDocumentLinkInput {
  revokedAt?: string | undefined;
  reason?: string | null | undefined;
}

export interface ExpireCustomerDocumentLinkInput {
  expiredAt?: string | undefined;
}

export interface RecordCustomerDocumentLinkEventInput {
  linkId: UUID;
  companyId: UUID;
  customerId: UUID;
  jobId: UUID;
  documentKind: CustomerDocumentKind;
  estimateId?: UUID | null | undefined;
  invoiceId?: UUID | null | undefined;
  eventType: CustomerDocumentEventType;
  occurredAt?: string | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  metadata?: Json | undefined;
  createdByUserId?: UUID | null | undefined;
}

export interface EnsureEstimateAccessLinkInput {
  estimateId: UUID;
  actorUserId: UUID;
  rotate?: boolean | undefined;
}

export interface EnsureInvoiceAccessLinkInput {
  invoiceId: UUID;
  actorUserId: UUID;
  rotate?: boolean | undefined;
}

export interface EnsureJobVisitAccessLinkInput {
  jobId: UUID;
  actorUserId: UUID;
  rotate?: boolean | undefined;
}

export interface ResolveCustomerDocumentAccessInput {
  token: string;
}

export interface ApproveEstimateViaLinkInput {
  token: string;
  signedByName: string;
  statement: string;
  signatureDataUrl: string;
}

export interface DeclineEstimateViaLinkInput {
  token: string;
}

export interface CreateInvoiceCheckoutViaLinkInput {
  token: string;
}

export interface PublicEstimateLineItem {
  itemType: EstimateLineItem["itemType"];
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  taxable: boolean;
}

export interface PublicInvoiceLineItem {
  itemType: InvoiceLineItem["itemType"];
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  taxable: boolean;
}

export interface PublicEstimateDocument {
  documentKind: "estimate";
  companyName: string;
  companyTimeZone: string;
  customerName: string;
  jobTitle: string;
  vehicleLabel: string;
  estimateNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  status: EstimateStatus;
  taxRateBasisPoints: number;
  lineItems: PublicEstimateLineItem[];
  totals: EstimateTotals;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  voidedAt: string | null;
  approvedByName: string | null;
  approvalStatement: string | null;
  signatureImageUrl: string | null;
  canApprove: boolean;
  canDecline: boolean;
}

export interface PublicInvoiceDocument {
  documentKind: "invoice";
  companyName: string;
  companyTimeZone: string;
  customerName: string;
  jobTitle: string;
  vehicleLabel: string;
  invoiceNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  status: InvoiceStatus;
  taxRateBasisPoints: number;
  lineItems: PublicInvoiceLineItem[];
  totals: InvoiceTotals;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  canPay: boolean;
}

export interface PublicJobVisitDocument {
  documentKind: "job_visit";
  companyName: string;
  companyTimeZone: string;
  customerName: string;
  jobTitle: string;
  jobStatus: JobStatus;
  vehicleLabel: string;
  serviceAddress: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  arrivalWindowStartAt: string | null;
  arrivalWindowEndAt: string | null;
  technicianName: string | null;
  technician: PublicTechnicianProfile | null;
}

export interface CustomerDocumentUnavailableState {
  kind: "invalid" | "expired" | "revoked";
  message: string;
}

export interface ResolvedCustomerDocumentAccess {
  link: CustomerDocumentLink | null;
  estimate: PublicEstimateDocument | null;
  invoice: PublicInvoiceDocument | null;
  visit: PublicJobVisitDocument | null;
  unavailable: CustomerDocumentUnavailableState | null;
}
