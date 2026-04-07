import type { TimestampFields, UUID } from "./common";
import type { TechnicianPaymentTenderType } from "./payment-handoff";

export const paymentStatuses = ["succeeded", "failed"] as const;
export const paymentProviders = ["stripe", "manual"] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];
export type PaymentProvider = (typeof paymentProviders)[number];

export interface Payment extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  invoiceId: UUID;
  provider: PaymentProvider;
  status: PaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeEventId: string | null;
  manualTenderType: TechnicianPaymentTenderType | null;
  manualReferenceNote: string | null;
  recordedByUserId: UUID | null;
  amountCents: number;
  currencyCode: "USD";
  receiptUrl: string | null;
  paidAt: string;
}

export interface UpdateInvoicePaymentLinkInput {
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  stripeCheckoutSessionId: string | null;
}

export interface RecordStripeInvoicePaymentInput {
  companyId: UUID;
  jobId: UUID;
  invoiceId: UUID;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null | undefined;
  stripeChargeId?: string | null | undefined;
  stripeEventId: string;
  amountCents: number;
  currencyCode: "USD";
  receiptUrl?: string | null | undefined;
  paidAt?: string | undefined;
}

export interface RecordManualInvoicePaymentInput {
  companyId: UUID;
  jobId: UUID;
  invoiceId: UUID;
  tenderType: TechnicianPaymentTenderType;
  amountCents: number;
  currencyCode: "USD";
  note?: string | null | undefined;
  recordedByUserId?: UUID | null | undefined;
  paidAt?: string | undefined;
}
