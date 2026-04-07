import type { Customer } from "./customer";
import type { TimestampFields, UUID } from "./common";
import type { Estimate } from "./estimate";
import type { Job } from "./job";
import type { Payment } from "./payment";
import type { Vehicle } from "./vehicle";

export const invoiceStatuses = ["draft", "issued", "partially_paid", "paid", "void"] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceLineItemTypes = ["labor", "part", "fee"] as const;

export type InvoiceLineItemType = (typeof invoiceLineItemTypes)[number];

export interface Invoice extends TimestampFields {
  id: UUID;
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID | null;
  status: InvoiceStatus;
  invoiceNumber: string;
  title: string;
  notes: string | null;
  terms: string | null;
  currencyCode: "USD";
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  stripeCheckoutSessionId: string | null;
  taxRateBasisPoints: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdByUserId: UUID;
}

export interface InvoiceLineItem extends TimestampFields {
  id: UUID;
  invoiceId: UUID;
  companyId: UUID;
  jobId: UUID;
  partRequestLineId: UUID | null;
  position: number;
  itemType: InvoiceLineItemType;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  estimatedCostCents: number | null;
  actualCostCents: number | null;
  taxable: boolean;
}

export interface InvoiceTotals {
  subtotalCents: number;
  discountCents: number;
  taxableSubtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
}

export interface InvoiceDetail {
  invoice: Invoice;
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  estimate: Estimate | null;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  totals: InvoiceTotals;
}

export interface InvoiceSummary {
  invoiceId: UUID;
  jobId: UUID;
  status: InvoiceStatus;
  invoiceNumber: string;
  title: string;
  totalCents: number;
  balanceDueCents: number;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  companyId: UUID;
  jobId: UUID;
  estimateId?: UUID | null | undefined;
  invoiceNumber: string;
  title: string;
  notes?: string | null | undefined;
  terms?: string | null | undefined;
  taxRateBasisPoints?: number | undefined;
  discountCents?: number | undefined;
  dueAt?: string | null | undefined;
  createdByUserId: UUID;
}

export interface CreateInvoiceFromEstimateInput {
  companyId: UUID;
  jobId: UUID;
  estimateId: UUID;
  invoiceNumber: string;
  createdByUserId: UUID;
}

export interface UpdateInvoiceInput {
  invoiceNumber: string;
  title: string;
  notes?: string | null | undefined;
  terms?: string | null | undefined;
  taxRateBasisPoints?: number | undefined;
  discountCents?: number | undefined;
  dueAt?: string | null | undefined;
}

export interface CreateInvoiceLineItemInput {
  itemType: InvoiceLineItemType;
  name: string;
  description?: string | null | undefined;
  quantity: number;
  unitPriceCents: number;
  taxable?: boolean | undefined;
}

export interface UpdateInvoiceLineItemInput {
  itemType: InvoiceLineItemType;
  name: string;
  description?: string | null | undefined;
  quantity: number;
  unitPriceCents: number;
  taxable?: boolean | undefined;
}

export interface ChangeInvoiceStatusInput {
  status: InvoiceStatus;
}

export interface InvoiceListQuery {
  status?: InvoiceStatus | undefined;
  query?: string | undefined;
}
