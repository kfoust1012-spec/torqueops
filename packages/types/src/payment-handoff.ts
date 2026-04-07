import type { TimestampFields, UUID } from "./common";

export const technicianPaymentHandoffKinds = [
  "follow_up_required",
  "resend_link",
  "promised_to_pay_later",
  "manual_tender",
  "other"
] as const;

export type TechnicianPaymentHandoffKind = (typeof technicianPaymentHandoffKinds)[number];

export const technicianPaymentHandoffStatuses = ["open", "resolved"] as const;

export type TechnicianPaymentHandoffStatus =
  (typeof technicianPaymentHandoffStatuses)[number];

export const technicianPaymentTenderTypes = ["cash", "check", "other"] as const;

export type TechnicianPaymentTenderType = (typeof technicianPaymentTenderTypes)[number];

export const technicianPaymentResolutionDispositions = [
  "manual_tender_reconciled",
  "promise_accepted",
  "link_resent",
  "follow_up_completed",
  "escalated_to_billing_owner",
  "other_resolved"
] as const;

export type TechnicianPaymentResolutionDisposition =
  (typeof technicianPaymentResolutionDispositions)[number];

export interface TechnicianPaymentHandoff extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  invoiceId: UUID;
  technicianUserId: UUID;
  status: TechnicianPaymentHandoffStatus;
  kind: TechnicianPaymentHandoffKind;
  tenderType: TechnicianPaymentTenderType | null;
  amountCents: number | null;
  customerPromiseAt: string | null;
  note: string | null;
  resolutionDisposition: TechnicianPaymentResolutionDisposition | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByUserId: UUID | null;
}

export interface CreateTechnicianPaymentHandoffInput {
  kind: TechnicianPaymentHandoffKind;
  tenderType?: TechnicianPaymentTenderType | null | undefined;
  amountCents?: number | null | undefined;
  customerPromiseAt?: string | null | undefined;
  note?: string | null | undefined;
}

export interface ResolveTechnicianPaymentHandoffInput {
  resolutionDisposition: TechnicianPaymentResolutionDisposition;
  resolutionNote?: string | null | undefined;
}
